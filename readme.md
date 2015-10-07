![](https://github.com/rwaldron/pcduino-io/raw/master/logo.png)

# pcDuino-IO


[![Build Status](https://travis-ci.org/rwaldron/pcduino-io.png?branch=master)](https://travis-ci.org/rwaldron/pcduino-io)

## pcDuino-IO is compatible with pcDuino3


pcDuino-IO is an [IO-Plugin](https://github.com/rwaldron/io-plugins) class for writing Node.js programs with [Johnny-Five](https://github.com/rwaldron/johnny-five) that run on the [pcDuino3](http://www.pcduino.com/). This project was built at [Bocoup](http://bocoup.com)

### Getting Started

pcDuino-IO scripts are run directly from the pcDuino3 (or similar in family) board. Assuming your pcDuino has already been setup for networking, getting started is easy: 

#### Install a compatible version of node/npm
```sh
wget http://nodejs.org/dist/v0.10.24/node-v0.10.24-linux-arm-pi.tar.gz
tar xvzf node-v0.10.24-linux-arm-pi.tar.gz
cd node-v0.10.24-linux-arm-pi
sudo cp -R * /usr/local
```

#### Create a directory for your project, cd into the directory and run the following: 

```sh
npm init; # follow the prompts
npm install johnny-five pcduino-io --save
```

#### "Hello World!" with Johnny-Five
```js
var five = require("johnny-five");
var pcDuino = require("pcduino-io");
var board = new five.Board({
  io: new pcDuino()
});

board.on("ready", function() {
  var led = new five.Led(13);
  led.blink();
});
```

- See [Johnny-Five's API](http://johnny-five.io/api/) for information!
- See [Johnny-Five's examples](http://johnny-five.io/examples/) for inspiration!

## License
See LICENSE file.

