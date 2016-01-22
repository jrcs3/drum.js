"use strict";

// Ugliness: this is needed to solve the 'this' problem.
// Issue: This must be a singleton until I find a better work around.
var drumThis;

var Drum = function (drumSounds, drumPattern) {
    this.decodedDrumSounds = this.loadDecodedDrumSounds(drumSounds);
    this.playing = false;
    this.beatsPerMinute = drumPattern.beatsPerMinute;
    this.framesPerSecond = 44100;
    this.beatsPerMeasure = drumPattern.beatsPerMeasure;
    this.name = drumPattern.name;
    this.notes = drumPattern.notes;
    this.wordsInHeader = 22;

    this.int16ToBase64Converter = ConstructInt16ToBase64Converter();

    this.soundSrc = this.int16ToBase64Converter.convert(this.buildMeasure());
    this.player1 = new Audio(this.soundSrc);
    this.player2 = new Audio(this.soundSrc);
    this.audioObject = this.player1;
    this.currentPlayer = 1;
    
    this.patternChanged = false;
    
    drumThis = this;
}

Drum.prototype.changeDrumPattern = function (drumPattern) {
    
    //this.beatsPerMinute / this.beatsPerMeasure
    this.beatsPerMinute = drumPattern.beatsPerMinute;
    this.beatsPerMeasure = drumPattern.beatsPerMeasure;
    this.name = drumPattern.name;
    this.notes = drumPattern.notes;

    this.soundSrc = this.int16ToBase64Converter.convert(this.buildMeasure());
    this.player1 = new Audio(this.soundSrc);
    this.player2 = new Audio(this.soundSrc);
    this.audioObject = this.player1;
    this.currentPlayer = 1;
    
    this.patternChanged = false;
    
    drumThis = this;
}

Drum.prototype.markPatternChanged = function() {
    this.patternChanged = true;
}

// See: http://stackoverflow.com/a/25938297
Drum.prototype.loopIt = function () {
    if (!drumThis.isPlaying) {
        return;
    }

    if (drumThis.currentPlayer === 1) {
        drumThis.audioObject = drumThis.player2;
        drumThis.currentPlayer = 2;
    }
    else {
        drumThis.audioObject = drumThis.player1;
        drumThis.currentPlayer = 1;
    }

    drumThis.audioObject.play();

    setTimeout(drumThis.loopIt, drumThis.getDuration());
}

Drum.prototype.start = function () {
    this.isPlaying = true;
    this.loopIt();
}

Drum.prototype.stop = function () {
    this.isPlaying = false;
    this.audioObject.pause();
    this.audioObject.currentTime = 0;
    this.audioObject = this.player1;
    this.currentPlayer = 1;
}

Drum.prototype.loadDecodedDrumSounds = function (drumSounds) {
    var base64ToInt16Converter = ConstructBase64ToInt16Converter();

    // drumSounds is assigned in drum_sounds.js.
    var decodedDrumSounds = [];
    for (var i = 0; i < drumSounds.length; i++) {
        decodedDrumSounds.push(new DecodedDrumSound(
            drumSounds[i].frameOffset,
            base64ToInt16Converter.convert(drumSounds[i].dataURL)));
    }
    return decodedDrumSounds;
}

Drum.prototype.drumSoundForRow = function (id) {
    var fields = id.split("_");
    return this.decodedDrumSounds[fields[0]];
}

Drum.prototype.mixDrumSoundOnMeasure = function (id, measure) {
    var drumSound = this.drumSoundForRow(id);
    var offset = drumSound.frameOffset + this.frameForId(id);
    var initalMeasureLength = measure.length;
    for (var i = this.wordsInHeader; i < drumSound.data.length; i++) {
        if (offset + i >= initalMeasureLength)
            measure[offset + i] = drumSound.data[i];
        else
            measure[offset + i] += drumSound.data[i];
    }
}

Drum.prototype.addDrumSoundsToMeasure = function (measure, beatsPerMeasure) {
    var notes = this.notes;
    for (var i = 0; i < notes.length; i++) {
        this.mixDrumSoundOnMeasure(notes[i], measure);
    }
}

Drum.prototype.limitVolume = function (sound) {
    var maxSoFar = 0;

    for (var i = this.wordsInHeader; i < sound.length; i++) {
        maxSoFar = Math.max(maxSoFar, Math.abs(sound[i]));
    }

    // No limiting needed.
    if (maxSoFar <= 32767)
        return;

    var scalingFactor = 32767 / maxSoFar;

    for (var i = this.wordsInHeader; i < sound.length; i++) {
        sound[i] *= scalingFactor;
    }
}

Drum.prototype.makeHeader = function (measure) {
    return [18770, 17990, 29472, 0, 16727, 17750, 28006, 8308, 16, 0, 1, 1, -21436, 0, 22664, 1, 2, 16, 24932, 24948, 0, 0];
}

Drum.prototype.convertBeatToFrame = function (beat, framesPerSecond, beatsPerMinute) {
    return Math.floor(beat * framesPerSecond * 60.0 / beatsPerMinute);
}

Drum.prototype.framesPerMeasure = function (beatsPerMeasure) {
    return this.convertBeatToFrame(beatsPerMeasure, this.framesPerSecond, this.beatsPerMinute);
}

Drum.prototype.initializeMeasure = function (beatsPerMeasure) {

    var measure = this.makeHeader();
    var indexAfterLastFrame = this.wordsInHeader + this.framesPerMeasure(beatsPerMeasure);

    for (var i = this.wordsInHeader; i < indexAfterLastFrame; i++) {
        measure.push(0);
    }

    return measure;
}

Drum.prototype.fractionalBeat = function (beat, note, noteDenominator) {
    return beat + note / noteDenominator;
}

Drum.prototype.frameForId = function (id) {
    var numbers = id.split("_");
    var number = this.convertBeatToFrame(
        this.fractionalBeat(parseInt(numbers[1]), parseInt(numbers[2]), parseInt(numbers[3])),
        this.framesPerSecond,
        this.beatsPerMinute);
    return number;
}

Drum.prototype.buildMeasure = function () {
    var beatsPerMeasure = this.beatsPerMeasure;
    var measure = this.initializeMeasure(beatsPerMeasure);
    this.addDrumSoundsToMeasure(measure, beatsPerMeasure);
    this.limitVolume(measure);
    emplaceUInt32(2 * (measure.length - this.wordsInHeader), 20, measure);
    return measure;
}

Drum.prototype.getDuration = function () {
    return (60 / (this.beatsPerMinute / this.beatsPerMeasure)) * 1000;
}



function DecodedDrumSound(frameOffset, data) {
    this.frameOffset = frameOffset;
    this.data = data;
}
