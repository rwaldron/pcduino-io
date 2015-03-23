// Global Deps
require("es6-shim");

// The const caps are used to illustrate the "const-ness"
// of the value, but the binding is not const.
var IS_TEST_ENV = global.IS_TEST_ENV || false;

// Local deps
var fs = IS_TEST_ENV ?
  require("../lib/fs-mock") :
  require("fs");

var duino = IS_TEST_ENV ?
  require("../lib/iotduino-mock") :
  require("iotduino");

var i2c = IS_TEST_ENV ?
  require("../lib/i2c-bus-mock") :
  require("i2c-bus");

var exec = require("child_process").exec;
var Emitter = require("events").EventEmitter;


// Shareds
var priv = new Map();
var tick = global.setImmediate || process.nextTick;
var boards = [];
var reporting = [];

var pinModes = [
  { modes: [] },
  { modes: [] },
  { modes: [0, 1] },
  { modes: [0, 1, 3] },
  { modes: [0, 1] },
  { modes: [0, 1, 3] },
  { modes: [0, 1, 3] },
  { modes: [0, 1] },
  { modes: [0, 1] },
  { modes: [0, 1, 3] },
  { modes: [0, 1, 3] },
  { modes: [0, 1, 3] },
  { modes: [0, 1] },
  { modes: [0, 1] },
  { modes: [0, 1, 2], analogChannel: 0 },
  { modes: [0, 1, 2], analogChannel: 1 },
  { modes: [0, 1, 2], analogChannel: 2 },
  { modes: [0, 1, 2], analogChannel: 3 },
  { modes: [0, 1, 2], analogChannel: 4 },
  { modes: [0, 1, 2], analogChannel: 5 }
];

var modes = Object.freeze({
  INPUT: 0,
  OUTPUT: 1,
  ANALOG: 2,
  PWM: 3,
  SERVO: 4
});

function read() {
  if (read.isReading) {
    return;
  }
  if (!read.samplingInterval) {
    read.samplingInterval = 1;
  }
  read.isReading = true;
  read.interval = setInterval(function() {
    var board;

    if (boards.length && reporting.length) {
      board = boards[0];

      reporting.forEach(function(report, gpio) {
        processRead(board, report, duino[report.operation](report.alias));
      });
    }
  }, read.samplingInterval);
}



function processRead(board, report, value) {
  value = +value;

  if (Number.isNaN(value)) {
    value = 0;
  }

  if (report.scale) {
    value = report.scale(value);
  }

  board.pins[report.index].value = value;
  board.emit(report.event, value);
}


function pcDuino(opts) {
  Emitter.call(this);

  if (!(this instanceof pcDuino)) {
    return new pcDuino(opts);
  }

  opts = opts || {};

  var state = {
    bus: null
  };

  priv.set(this, state);

  this.name = "pcDuino3";
  this.isReady = false;

  this.pins = pinModes.map(function(config, index) {
    config.addr = typeof config.analogChannel === "number" ?
      "A" + config.analogChannel : index;

    return new Pin(config);
  }, this);


  // TODO:
  //  get rid of this magic number
  //
  this.analogPins = this.pins.slice(14).map(function(_, i) {
    return i;
  });

  boards[0] = this;

  // Connected to the device implicitly.
  process.nextTick(this.emit.bind(this, "connect"));

  // The "ready event" is needed to signal to Johnny-Five that
  // communication with the Arduino pinouts is ready.
  process.nextTick(function() {
    this.isReady = true;
    this.emit("ready");
  }.bind(this));
}

pcDuino.prototype = Object.create(Emitter.prototype, {
  constructor: {
    value: pcDuino
  },
  MODES: {
    value: modes
  },
  HIGH: {
    value: 1
  },
  LOW: {
    value: 0
  }
});


pcDuino.prototype.pinMode = function(pin, mode) {
  this.pins[toPinIndex(pin)].mode = +mode;
  return this;
};

pcDuino.prototype.analogRead = function(pin, handler) {
  var pinIndex;
  var alias;
  var event;

  // Convert numeric analog pin numbers to "A*" format
  if (typeof pin === "number") {
    pin = "A" + pin;
  }

  pinIndex = toPinIndex(pin);
  alias = this.pins[pinIndex].analogChannel;
  event = "analog-read-" + alias;

  if (this.pins[pinIndex].mode !== this.MODES.ANALOG) {
    this.pinMode(pin, this.MODES.ANALOG);
  }

  reporting.push({
    alias: alias,
    event: event,
    index: pinIndex,
    operation: "analogRead",
    scale: function(raw) {
      if (alias === 0 || alias === 1) {
        // scale from 6bits to 10
        return raw << 4;
      } else {
        // scale from 12bits to 10
        return raw >> 2;
      }
    }
  });

  this.on(event, handler);

  if (IS_TEST_ENV) {
    // Kickstart the read interval
    read();
  }

  return this;
};

pcDuino.prototype.digitalRead = function(pin, handler) {
  var pinIndex = toPinIndex(pin);
  var gpio = this.pins[pinIndex].gpio;
  var event = "digital-read-" + pin;

  if (this.pins[pinIndex].mode !== this.MODES.INPUT) {
    this.pinMode(pin, this.MODES.INPUT);
  }

  reporting.push({
    alias: pinIndex,
    event: event,
    index: pinIndex,
    operation: "digitalRead",
    scale: null
  });

  this.on(event, handler);

  if (IS_TEST_ENV) {
    // Kickstart the read interval
    read();
  }

  return this;
};

pcDuino.prototype.analogWrite = function(pin, value) {
  var pinIndex = toPinIndex(pin);

  if (this.pins[pinIndex].mode !== this.MODES.PWM) {
    this.pinMode(pin, this.MODES.PWM);
  }

  this.pins[pinIndex].write(value);

  return this;
};

pcDuino.prototype.digitalWrite = function(pin, value) {
  var pinIndex = toPinIndex(pin);

  if (this.pins[pinIndex].mode !== this.MODES.OUTPUT) {
    this.pinMode(pin, this.MODES.OUTPUT);
  }

  this.pins[pinIndex].write(value);

  return this;
};

pcDuino.prototype.servoWrite = function(pin, value) {
  throw new Error("servoWrite is not supported on the pcDuino");
};


pcDuino.prototype.i2cConfig = function(delay) {
  var state = priv.get(this);
  // Initialize the I2C interface if none currently exists
  if (!state.bus) {
    state.bus = i2c.openSync(2);
    state.bus.delay = delay || 0;
  }
};

// Map to Board.prototype.sendI2CWriteRequest
pcDuino.prototype.i2cWrite = function(address, cmdRegOrData, inBytes) {
  /**
   * cmdRegOrData:
   * [... arbitrary bytes]
   *
   * or
   *
   * cmdRegOrData, inBytes:
   * command [, ...]
   *
   */
  var state = priv.get(this);
  var buffer;

  if (state.bus === null) {
    this.i2cConfig();
  }


  // If i2cWrite was used for an i2cWriteReg call...
  if (arguments.length === 3 &&
      !Array.isArray(cmdRegOrData) &&
      !Array.isArray(inBytes)) {

    return this.i2cWriteReg(address, cmdRegOrData, inBytes);
  }

  // Fix arguments if called with Firmata.js API
  if (arguments.length === 2) {
    if (Array.isArray(cmdRegOrData)) {
      inBytes = cmdRegOrData.slice();
      cmdRegOrData = inBytes.shift();
    } else {
      inBytes = [];
    }
  }

  buffer = new Buffer([cmdRegOrData].concat(inBytes));

  if (buffer.length) {
    state.bus.i2cWriteSync(address, buffer.length, buffer);
  }

  return this;
};

pcDuino.prototype.i2cWriteReg = function(address, register, value) {
  var state = priv.get(this);

  if (state.bus === null) {
    this.i2cConfig();
  }

  state.bus.i2cWriteSync(address, 2, new Buffer([register, value]));

  return this;
};

pcDuino.prototype.i2cRead = function(address, register, bytesToRead, callback) {

  var continuousRead = function() {
    this.i2cReadOnce(address, register, bytesToRead, function(bytes) {
      callback(bytes);
      continuousRead();
    });
  }.bind(this);

  continuousRead();

  return this;
};

// Map to Board.prototype.sendI2CReadRequest
pcDuino.prototype.i2cReadOnce = function(address, register, bytesToRead, callback) {
  var state = priv.get(this);
  var event = "I2C-reply" + address + "-";

  if (state.bus === null) {
    this.i2cConfig();
  }

  // Fix arguments if called with Firmata.js API
  if (arguments.length === 3 &&
      typeof register === "number" &&
      typeof bytesToRead === "function") {
    callback = bytesToRead;
    bytesToRead = register;
    register = null;
  }

  callback = typeof callback === "function" ? callback : function() {};

  if (register !== null) {
    this.i2cWrite(address, register);
  } else {
    register = 0;
  }

  event += register;

  this.once(event, callback);

  var buffer = new Buffer(bytesToRead);

  state.bus.i2cRead(address, bytesToRead, buffer, function(error, bytesToRead, buffer) {
    if (error) {
      this.emit("error", error);
      return;
    }

    var values = [];

    for (var i = 0; i < bytesToRead; i++) {
      values.push(buffer.readUInt8(i));
    }

    this.emit(event, values);
  }.bind(this));

  return this;
};

// Necessary for Firmata.js compatibility.
pcDuino.prototype.sendI2CWriteRequest = pcDuino.prototype.i2cWrite;
pcDuino.prototype.sendI2CReadRequest = pcDuino.prototype.i2cReadOnce;
pcDuino.prototype.sendI2CConfig = pcDuino.prototype.i2cConfig;

pcDuino.prototype.setSamplingInterval = function(ms) {
  read.samplingInterval = Math.min(Math.max(ms, 0), 65535);
  clearInterval(read.interval);
  read();
};


function Pin(opts) {
  Emitter.call(this);

  var isDigital = typeof opts.analogChannel !== "number";
  var isAnalog = !isDigital;
  var state = {
    addr: opts.addr,
    mode: isAnalog ? 2 : 1,
    isPwm: false,
    gpio: {
      value: null,
    },
    pwm: {
      // PWM/Servo specific
      // Numeric values are in nanoseconds
      // CURRENTLY UNUSED.
      polarity: "normal",
      enable: 0,
      duty: 0,
      period: 0,
      resolution: 0,
      details: null
    }
  };

  Object.assign(state, opts);

  priv.set(this, state);

  Object.defineProperties(this, {
    value: {
      get: function() {
        return state.gpio.value;
      },
      set: function(value) {
        state.gpio.value = value;
      }
    },
    mode: {
      get: function() {
        return state.mode;
      },
      set: function(mode) {
        // INPUT: 0
        // OUTPUT: 1
        // ANALOG: 2
        // PWM: 3
        // SERVO: 4
        //
        var direction = mode === 0 || mode === 2 ? "INPUT" : "OUTPUT";
        var isChanging = state.mode !== mode;
        var index, frequency;

        state.mode = mode;

        if (mode === 3 || mode === 4) {

          state.isPwm = true;

          if (mode === modes.PWM) {
            duino.setPwmFrequency(this.addr, Pin.PULSES[this.addr]);
          }

          // No Servo support.
        }

        if (!isChanging) {
          return;
        }

        duino.pinMode(this.addr, modes[direction]);
      }
    },
    isPwm: {
      get: function() {
        return state.isPwm;
      }
    },
    addr: {
      get: function() {
        return state.addr;
      }
    }
  });

  // Initialize in default states
  if (typeof opts.analogChannel === "number") {
    this.analogChannel = opts.analogChannel;
    this.mode = modes.ANALOG;
  } else {
    // Set all digital pins:
    //  - mode: OUTPUT
    //  - state: LOW
    this.mode = modes.OUTPUT;
  }

  this.write(0);
}

Pin.PULSES = {
  /*
    5, 6: 195Hz, 260Hz, 390Hz, 520Hz and 781Hz
    3, 9, 10, 11: [126, 2000]Hz
   */
  3: 520,
  5: 520,
  6: 520,
  9: 520,
  10: 520,
  11: 520,
};

Pin.prototype = Object.create(Emitter.prototype, {
  constructor: {
    value: Pin
  }
});


Pin.prototype.write = function(value) {
  var state = priv.get(this);
  var min, max, operation, writeValue;

  if (state.isPwm) {
    if (state.mode === 3) {
      min = 0;
      max = 255;
      operation = "analogWrite";
    }

    // Eventually need this for Servos
    if (state.mode === 4) {
      min = 0;
      max = 180;
      operation = "servoWrite";
    }

    writeValue = constrain(value, min, max, min, max);
  } else {
    operation = "digitalWrite";
    writeValue = value ? 1 : 0;
  }

  this.value = writeValue;

  if (typeof duino[operation] === "function") {
    duino[operation](this.addr, this.value);
  }
};

function toPinIndex(pin) {
  var offset = pin[0] === "A" ? 14 : 0;
  return ((pin + "").replace("A", "") | 0) + offset;
}


function toDutyCycle(value, vrange, min, max) {
  if (value > vrange) {
    return max;
  }

  if (value < 0) {
    return min;
  }

  return (min + (value / vrange) * (max - min));
}

function scale(value, inMin, inMax, outMin, outMax) {
  return (value - inMin) * (outMax - outMin) /
    (inMax - inMin) + outMin;
}

function constrain(value, min, max) {
  return value > max ? max : value < min ? min : value;
}


if (IS_TEST_ENV) {
  pcDuino.__read = read;
  pcDuino.__Pin = Pin;
  pcDuino.reset = function() {
    boards.length = 0;
    reporting.length = 0;
    read.isReading = false;
    read.samplingInterval = 1;
    clearInterval(read.interval);
    priv.clear();
  };
} else {
  read();
}

module.exports = pcDuino;

