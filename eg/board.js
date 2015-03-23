var pcDuino = require("../lib/pcduino-io.js");
var board = new pcDuino();

board.on("ready", function() {

  // console.log(this);
  console.log("Ready.");

  var pin = 11;

  this.pinMode(pin, this.MODES.OUTPUT);
  this.digitalWrite(pin, 1);


  this.pinMode(pin, this.MODES.PWM);
  this.analogWrite(pin, 255);


  this.analogRead("A0", function(data) {
    // console.log("data:", data);
    // process.exit(0);
  });

  var value = 0;
  this.digitalRead(2, function(data) {

    if (data !== value) {
      value = data;
      console.log("Changed: ", value);
    }
  });
});
