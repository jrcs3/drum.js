"use strict";

// Ugliness: this is needed to solve the 'this' problem.
// Issue: This must be a singleton until I find a better work around.
var drumThis;

var Drum = function (drumSounds, drumPattern, getPatternFromUI, notifyPlayerChanged) {
    drumThis = this;

    drumThis.decodedDrumSounds = drumThis.loadDecodedDrumSounds(drumSounds);
    drumThis.playing = false;
    drumThis.beatsPerMinute = drumPattern.beatsPerMinute;
    drumThis.framesPerSecond = 44100;
    drumThis.beatsPerMeasure = drumPattern.beatsPerMeasure;
    drumThis.name = drumPattern.name;
    drumThis.notes = drumPattern.notes;
    drumThis.wordsInHeader = 22;
    
    drumThis.getPatternFromUI = getPatternFromUI;
    drumThis.notifyPlayerChanged = notifyPlayerChanged;

    drumThis.int16ToBase64Converter = ConstructInt16ToBase64Converter();

    drumThis.soundSrc = drumThis.int16ToBase64Converter.convert(drumThis.buildMeasure());
    drumThis.player1 = new Audio(drumThis.soundSrc);
    drumThis.player2 = new Audio(drumThis.soundSrc);
    drumThis.audioObject = drumThis.player1;
    drumThis.currentPlayer = 1;
    
    drumThis.patternChanged = false;
}

Drum.prototype.changeDrumPattern = function (drumPattern) {
    
    //drumThis.beatsPerMinute / drumThis.beatsPerMeasure
    drumThis.beatsPerMinute = drumPattern.beatsPerMinute;
    drumThis.beatsPerMeasure = drumPattern.beatsPerMeasure;
    drumThis.name = drumPattern.name;
    drumThis.notes = drumPattern.notes;

    drumThis.soundSrc = drumThis.int16ToBase64Converter.convert(drumThis.buildMeasure());
    drumThis.player1 = new Audio(drumThis.soundSrc);
    drumThis.player2 = new Audio(drumThis.soundSrc);
    drumThis.audioObject = drumThis.player1;
    drumThis.currentPlayer = 1;
    
    drumThis.patternChanged = false;
    drumThis.didPromise = false;
    
    //drumThis = this;
}

Drum.prototype.markPatternChanged = function() {
    drumThis.patternChanged = true;
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
    
    if (typeof(drumThis.changeDrumPattern) == "function"){
        setTimeout(drumThis.reloadPattern, drumThis.getDuration() - 200);
    }
    
    if (typeof(drumThis.notifyPlayerChanged) == "function") {
        var playerInfo = drumThis.currentPlayer.toString() + " " + (drumThis.didPromise ? "Promised": "Not");
        drumThis.notifyPlayerChanged(playerInfo);
    }

    setTimeout(drumThis.loopIt, drumThis.getDuration());
}

Drum.prototype.reloadPattern = function() {
    if (typeof(drumThis.getPatternFromUI) == "function" && drumThis.patternChanged) {
        drumThis.changeDrumPattern(drumThis.getPatternFromUI());
    }
}

Drum.prototype.start = function(event) {
    if (typeof(drumThis.getPatternFromUI) == "function" && drumThis.patternChanged) {
        new Promise(
            function (resolve, reject) {
                drumThis.changeDrumPattern(drumThis.getPatternFromUI());
                resolve("OK");
            }).then(
                function (value) {
                    drumThis.didPromise = true;
                    drumThis.dostart();
                });
    } else {
        drumThis.didPromise = false;
        drumThis.dostart();
    }
}

Drum.prototype.dostart = function () {
    drumThis.isPlaying = true;
    drumThis.loopIt();
}

Drum.prototype.stop = function () {
    drumThis.isPlaying = false;
    drumThis.audioObject.pause();
    drumThis.audioObject.currentTime = 0;
    drumThis.audioObject = drumThis.player1;
    drumThis.currentPlayer = 1;
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
    return drumThis.decodedDrumSounds[fields[0]];
}

Drum.prototype.mixDrumSoundOnMeasure = function (id, measure) {
    var drumSound = drumThis.drumSoundForRow(id);
    var offset = drumSound.frameOffset + drumThis.frameForId(id);
    var initalMeasureLength = measure.length;
    for (var i = drumThis.wordsInHeader; i < drumSound.data.length; i++) {
        if (offset + i >= initalMeasureLength)
            measure[offset + i] = drumSound.data[i];
        else
            measure[offset + i] += drumSound.data[i];
    }
}

Drum.prototype.addDrumSoundsToMeasure = function (measure, beatsPerMeasure) {
    var notes = drumThis.notes;
    for (var i = 0; i < notes.length; i++) {
        drumThis.mixDrumSoundOnMeasure(notes[i], measure);
    }
}

Drum.prototype.limitVolume = function (sound) {
    var maxSoFar = 0;

    for (var i = drumThis.wordsInHeader; i < sound.length; i++) {
        maxSoFar = Math.max(maxSoFar, Math.abs(sound[i]));
    }

    // No limiting needed.
    if (maxSoFar <= 32767)
        return;

    var scalingFactor = 32767 / maxSoFar;

    for (var i = drumThis.wordsInHeader; i < sound.length; i++) {
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
    return drumThis.convertBeatToFrame(beatsPerMeasure, drumThis.framesPerSecond, drumThis.beatsPerMinute);
}

Drum.prototype.initializeMeasure = function (beatsPerMeasure) {

    var measure = drumThis.makeHeader();
    var indexAfterLastFrame = drumThis.wordsInHeader + drumThis.framesPerMeasure(beatsPerMeasure);

    for (var i = drumThis.wordsInHeader; i < indexAfterLastFrame; i++) {
        measure.push(0);
    }

    return measure;
}

Drum.prototype.fractionalBeat = function (beat, note, noteDenominator) {
    return beat + note / noteDenominator;
}

Drum.prototype.frameForId = function (id) {
    var numbers = id.split("_");
    var number = drumThis.convertBeatToFrame(
        drumThis.fractionalBeat(parseInt(numbers[1]), parseInt(numbers[2]), parseInt(numbers[3])),
        drumThis.framesPerSecond,
        drumThis.beatsPerMinute);
    return number;
}

Drum.prototype.buildMeasure = function () {
    var beatsPerMeasure = drumThis.beatsPerMeasure;
    var measure = drumThis.initializeMeasure(beatsPerMeasure);
    drumThis.addDrumSoundsToMeasure(measure, beatsPerMeasure);
    drumThis.limitVolume(measure);
    emplaceUInt32(2 * (measure.length - drumThis.wordsInHeader), 20, measure);
    return measure;
}

Drum.prototype.getDuration = function () {
    return (60 / (drumThis.beatsPerMinute / drumThis.beatsPerMeasure)) * 1000;
}



function DecodedDrumSound(frameOffset, data) {
    this.frameOffset = frameOffset;
    this.data = data;
}
