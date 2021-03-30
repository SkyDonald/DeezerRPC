const fs = require('fs');
const shell = require('shelljs');

shell.cp('-R', './src/view', './build/');

if (!fs.existsSync('./build/assets')) {
  shell.mkdir('./build/assets');
  shell.cp('./assets/icon.png', './build/assets/icon.png');
  shell.cp('./assets/play-pause.png', './build/assets/play-pause.png');
  shell.cp('./assets/previous-track.png', './build/assets/previous-track.png');
  shell.cp('./assets/next-track.png', './build/assets/next-track.png');
}
