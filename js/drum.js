var Drum = function(playing, beatsPerMinute, framesPerSecond, beatsPerMeasure, name) {
  this.playing = playing;
  this.beatsPerMinute = beatsPerMinute;
  this.framesPerSecond = framesPerSecond;
  this.beatsPerMeasure = beatsPerMeasure;
  this.name = name;
}

Drum.prototype.playSound = function(sound) {
  sound.currentTime = 0;
  sound.play();
}

Drum.prototype.setPlaying = function(value) {
  this.playing = value;
}

Drum.prototype.stopSound = function(sound)
{
  sound.pause();
  sound.currentTime = 0;
}
