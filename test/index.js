"use strict";

global.IS_TEST_ENV = true;


var rewire = require("rewire");
var pcDuino = rewire("../lib/pcduino-io.js");
var Emitter = require("events").EventEmitter;
var sinon = require("sinon");


var duino = require("../lib/iotduino-mock");
var i2c = require("../lib/i2c-bus-mock");


pcDuino.__set__("duino", duino);
pcDuino.__set__("i2c", i2c);

var Pin = pcDuino.__Pin;
var read = pcDuino.__read;

function restore(target) {
  for (var prop in target) {
    if (typeof target[prop].restore === "function") {
      target[prop].restore();
    }
  }
}

exports["pcDuino"] = {
  setUp: function(done) {

    this.clock = sinon.useFakeTimers();

    this.pcduino = new pcDuino();

    this.proto = {};

    this.proto.functions = [{
      name: "analogRead"
    }, {
      name: "analogWrite"
    }, {
      name: "digitalRead"
    }, {
      name: "digitalWrite"
    }, {
      name: "servoWrite"
    }];

    this.proto.objects = [{
      name: "MODES"
    }];

    this.proto.numbers = [{
      name: "HIGH"
    }, {
      name: "LOW"
    }];

    this.instance = [{
      name: "pins"
    }, {
      name: "analogPins"
    }];

    done();
  },
  tearDown: function(done) {
    restore(this);
    pcDuino.reset();
    done();
  },
  shape: function(test) {
    test.expect(
      this.proto.functions.length +
      this.proto.objects.length +
      this.proto.numbers.length +
      this.instance.length
    );

    this.proto.functions.forEach(function(method) {
      test.equal(typeof this.pcduino[method.name], "function");
    }, this);

    this.proto.objects.forEach(function(method) {
      test.equal(typeof this.pcduino[method.name], "object");
    }, this);

    this.proto.numbers.forEach(function(method) {
      test.equal(typeof this.pcduino[method.name], "number");
    }, this);

    this.instance.forEach(function(property) {
      test.notEqual(typeof this.pcduino[property.name], "undefined");
    }, this);

    test.done();
  },
  readonly: function(test) {
    test.expect(7);

    test.equal(this.pcduino.HIGH, 1);

    test.throws(function() {
      this.pcduino.HIGH = 42;
    });

    test.equal(this.pcduino.LOW, 0);

    test.throws(function() {
      this.pcduino.LOW = 42;
    });

    test.deepEqual(this.pcduino.MODES, {
      INPUT: 0,
      OUTPUT: 1,
      ANALOG: 2,
      PWM: 3,
      SERVO: 4
    });

    test.throws(function() {
      this.pcduino.MODES.INPUT = 42;
    });

    test.throws(function() {
      this.pcduino.MODES = 42;
    });

    test.done();
  },
  emitter: function(test) {
    test.expect(1);
    test.ok(this.pcduino instanceof Emitter);
    test.done();
  },
  connected: function(test) {
    test.expect(1);

    this.pcduino.on("connect", function() {
      test.ok(true);
      test.done();
    });
  },
  ready: function(test) {
    test.expect(1);

    this.pcduino.on("ready", function() {
      test.ok(true);
      test.done();
    });
  }
};


exports["pcDuino.prototype.analogRead"] = {
  setUp: function(done) {
    this.clock = sinon.useFakeTimers();

    this.pcduino = new pcDuino();

    done();
  },
  tearDown: function(done) {
    restore(this);
    pcDuino.reset();

    this.pcduino.removeAllListeners("analog-read-0");
    this.pcduino.removeAllListeners("digital-read-9");

    done();
  },
  correctMode: function(test) {
    test.expect(1);

    // Reading from an ANALOG pin should set its mode to 1 ("out")
    this.pcduino.analogRead("A0", function() {});

    test.equal(this.pcduino.pins[14].mode, 2);
    this.clock.tick(10);
    test.done();
  },

  scaling6bits: function(test) {
    test.expect(2);

    this.read = sinon.stub(duino, "analogRead", function(pin) {
      return 64;
    });

    var handler = function(data) {
      test.equal(data, 1024);
      test.done();
    };


    this.pcduino.analogRead(0, handler);
    test.equal(this.pcduino.pins[14].mode, 2);

    this.clock.tick(10);
  },

  analogPinNumber: function(test) {
    test.expect(2);

    this.read = sinon.stub(duino, "analogRead", function(pin) {
      return 64;
    });

    var handler = function(data) {
      test.equal(data, 1024);
      test.done();
    };


    this.pcduino.analogRead(0, handler);
    test.equal(this.pcduino.pins[14].mode, 2);

    this.clock.tick(10);
  },

  analogPinString: function(test) {
    test.expect(2);

    this.read = sinon.stub(duino, "analogRead", function(pin) {
      return 64;
    });

    var handler = function(data) {
      test.equal(data, 1024);
      test.done();
    };

    this.pcduino.analogRead("A0", handler);
    this.clock.tick(10);
    test.equal(this.pcduino.pins[14].mode, 2);
  },

  event: function(test) {
    test.expect(1);

    var event = "analog-read-0";

    this.read = sinon.stub(duino, "analogRead", function(pin) {
      return 64;
    });

    this.pcduino.once(event, function(data) {
      test.equal(data, 1024);
      test.done();
    });

    var handler = function(data) {};

    this.pcduino.analogRead("A0", handler);

    this.clock.tick(20);
  }
};

exports["pcDuino.prototype.digitalRead"] = {
  setUp: function(done) {
    this.clock = sinon.useFakeTimers();

    this.pcduino = new pcDuino();

    done();
  },
  tearDown: function(done) {
    restore(this);
    pcDuino.reset();

    this.pcduino.removeAllListeners("analog-read-0");
    this.pcduino.removeAllListeners("digital-read-9");

    done();
  },
  correctMode: function(test) {
    test.expect(1);

    // Reading from an ANALOG pin should set its mode to 1 ("out")
    this.pcduino.digitalRead(9, function() {});

    test.equal(this.pcduino.pins[9].mode, 0);
    this.clock.tick(10);
    test.done();
  },

  digitalPinNumber: function(test) {
    test.expect(2);

    this.read = sinon.stub(duino, "digitalRead", function(pin) {
      return 1;
    });

    var handler = function(data) {
      test.equal(data, 1);
      test.done();
    };

    this.pcduino.digitalRead(9, handler);
    this.clock.tick(10);
    test.equal(this.pcduino.pins[9].mode, 0);
  },

  event: function(test) {
    test.expect(1);

    var scaled = 1;
    var event = "digital-read-9";

    this.read = sinon.stub(duino, "digitalRead", function(pin) {
      return 1;
    });

    this.pcduino.once(event, function(data) {
      test.equal(data, scaled);
      test.done();
    });

    var handler = function(data) {};

    this.pcduino.digitalRead(9, handler);
    this.clock.tick(10);
  }
};


exports["pcDuino.prototype.analogWrite"] = {
  setUp: function(done) {
    this.clock = sinon.useFakeTimers();

    this.analogWrite = sinon.spy(duino, "analogWrite");
    this.write = sinon.spy(Pin.prototype, "write");
    this.pcduino = new pcDuino();


    this.write.reset();
    done();
  },
  tearDown: function(done) {
    restore(this);
    pcDuino.reset();
    done();
  },

  mode: function(test) {
    test.expect(2);

    var value = 255;
    var pin = 11;

    this.pcduino.pinMode(11, this.pcduino.MODES.PWM);
    test.equal(this.pcduino.pins[11].mode, 3);
    test.equal(this.pcduino.pins[11].isPwm, true);

    test.done();
  },

  write: function(test) {
    test.expect(4);

    var value = 255;
    var pin = 11;

    this.pcduino.analogWrite(11, value);

    // Internal write is called
    test.equal(this.write.callCount, 1);
    test.equal(this.write.args[0][0], value);

    // Value is stored in pin state
    test.equal(this.pcduino.pins[11].value, value);
    test.equal(this.analogWrite.callCount, 1);


    test.done();
  },

  stored: function(test) {
    test.expect(1);

    var value = 255;
    this.pcduino.analogWrite(11, value);

    test.equal(this.pcduino.pins[11].value, value);

    test.done();
  }
};

exports["pcDuino.prototype.digitalWrite"] = {
  setUp: function(done) {
    this.clock = sinon.useFakeTimers();

    this.digitalWrite = sinon.spy(duino, "digitalWrite");
    this.write = sinon.spy(Pin.prototype, "write");
    this.pcduino = new pcDuino();

    this.digitalWrite.reset();
    this.write.reset();
    done();
  },
  tearDown: function(done) {
    restore(this);
    pcDuino.reset();
    done();
  },

  mode: function(test) {
    test.expect(2);

    var value = 1;
    var pin = 11;

    this.pcduino.pinMode(11, this.pcduino.MODES.OUTPUT);
    test.equal(this.pcduino.pins[11].mode, 1);
    test.equal(this.pcduino.pins[11].isPwm, false);

    test.done();
  },

  write: function(test) {
    test.expect(4);

    var value = 1;
    var pin = 11;

    this.pcduino.digitalWrite(11, value);

    // Internal write is called
    test.equal(this.write.callCount, 1);
    test.equal(this.write.args[0][0], value);

    // Value is stored in pin state
    test.equal(this.pcduino.pins[11].value, value);
    test.equal(this.digitalWrite.callCount, 1);


    test.done();
  },

  stored: function(test) {
    test.expect(1);

    var value = 1;
    this.pcduino.digitalWrite(11, value);

    test.equal(this.pcduino.pins[11].value, value);

    test.done();
  }
};


exports["pcDuino.prototype.pinMode (analog)"] = {
  setUp: function(done) {
    this.clock = sinon.useFakeTimers();
    this.pcduino = new pcDuino();

    done();
  },
  tearDown: function(done) {
    restore(this);
    pcDuino.reset();

    done();
  },
  analogOut: function(test) {
    test.expect(1);

    this.pcduino.pinMode("A0", 1);
    test.equal(this.pcduino.pins[14].mode, 1);

    test.done();
  },
  analogIn: function(test) {
    test.expect(2);

    this.pcduino.pinMode("A0", 2);
    test.equal(this.pcduino.pins[14].mode, 2);

    this.pcduino.pinMode(0, 2);
    test.equal(this.pcduino.pins[14].mode, 2);

    test.done();
  }
};

exports["pcDuino.prototype.pinMode (digital)"] = {
  setUp: function(done) {
    this.clock = sinon.useFakeTimers();
    this.pcduino = new pcDuino();

    done();
  },
  tearDown: function(done) {
    restore(this);
    pcDuino.reset();

    done();
  },
  digitalOut: function(test) {
    test.expect(1);

    this.pcduino.pinMode(3, 1);
    test.equal(this.pcduino.pins[3].mode, 1);

    test.done();
  },
  digitalIn: function(test) {
    test.expect(1);

    this.pcduino.pinMode(3, 0);
    test.equal(this.pcduino.pins[3].mode, 0);

    test.done();
  }
};

exports["pcDuino.prototype.pinMode (pwm/servo)"] = {
  setUp: function(done) {
    this.clock = sinon.useFakeTimers();
    this.pcduino = new pcDuino();

    done();
  },
  tearDown: function(done) {
    restore(this);
    pcDuino.reset();

    done();
  },
  pwm: function(test) {
    test.expect(2);

    this.pcduino.pinMode(3, 3);
    test.equal(this.pcduino.pins[3].mode, 3);
    test.equal(this.pcduino.pins[3].isPwm, true);

    test.done();
  },
  // modeInvalid: function(test) {
  //   test.expect(4);

  //   test.throws(function() {
  //     this.pcduino.pinMode(12, this.pcduino.MODES.PWM);
  //   }.bind(this));

  //   test.throws(function() {
  //     this.pcduino.analogWrite(12, 255);
  //   }.bind(this));

  //   test.throws(function() {
  //     this.pcduino.pinMode(12, this.pcduino.MODES.SERVO);
  //   }.bind(this));

  //   test.throws(function() {
  //     this.pcduino.servoWrite(12, 255);
  //   }.bind(this));

  //   test.done();
  // },
};

exports["pcDuino.prototype.setSamplingInterval"] = {
  setUp: function(done) {
    this.clock = sinon.useFakeTimers();
    this.pcduino = new pcDuino();

    done();
  },
  tearDown: function(done) {
    restore(this);
    pcDuino.reset();

    done();
  },
  samplingIntervalDefault: function(test) {
    test.expect(1);
    read();
    test.equal(read.samplingInterval, 1);
    test.done();
  },
  samplingIntervalCustom: function(test) {
    test.expect(1);
    read();
    this.pcduino.setSamplingInterval(1000);
    test.equal(read.samplingInterval, 1000);
    test.done();
  }
};
