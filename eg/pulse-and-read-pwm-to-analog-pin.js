var pcDuino = require("../lib/pcduino-io");
var board = new pcDuino();

board.on("ready", function() {

  this.pinMode("A0", this.MODES.ANALOG);

  this.analogRead("A0", function(data) {
    console.log(data);
  });


  var state = 1;

  // Blinks
  this.pinMode(13, this.MODES.OUTPUT);
  setInterval(function() {
    this.digitalWrite(13, (state ^= 1));
  }.bind(this), 500);


  // Pulses
  this.pinMode(11, this.MODES.PWM);
  var level = 0;
  var step = 10;

  setInterval(function() {
    if (level > 255 || level < 0) {
      step *= -1;
    }

    level += step;

    this.analogWrite(11, level);
  }.bind(this), 1000/(255/step));

});
