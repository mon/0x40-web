/* Copyright (c) 2015 William Toohey <will@mon.im>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

// Flash value
var LAME_DELAY_START = 2258;
var LAME_DELAY_END = 0;

function SoundManager(core) {
    this.core = core;
    this.playing = false;
    this.song = null;

    /* Lower level audio and timing info */
    this.bufSource = null;
    this.buffer = null;
    this.context = null; // Audio context, Web Audio API
    this.startTime = 0;  // File start time - 0 is loop start, not build start
    this.loopStart = 0;  // When the build ends, if any
    this.loopLength = 0; // For calculating beat lengths

    // Volume
    this.gainNode = null;
    this.mute = false;
    this.lastVol = 1;
    
    // Visualiser
    this.vReady = false;
    this.vBars = 0;
    this.splitter = null;
    this.analysers = [];
    this.analyserArrays = [];
    this.logArrays = [];
    this.binCutoffs = [];
    this.linBins = 0;
    this.logBins = 0;
    this.maxBinLin = 0;

    // For concatenating our files
    this.tmpBuffer = null;
    this.tmpBuild = null;
    this.onLoadCallback = null;

    // In case of API non-support
    this.canUse = true;

    // Check Web Audio API Support
    try {
        // More info at http://caniuse.com/#feat=audio-api
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new window.AudioContext();
        this.gainNode = this.context.createGain();
        this.gainNode.connect(this.context.destination);
    } catch(e) {
        this.canUse = false;
        this.errorMsg = "Web Audio API not supported in this browser.";
        return;
    }
    
    this.mp3Worker = new Worker(core.settings.defaults.mp3WorkerPath + 'mp3-worker.js');
    this.mp3Worker.addEventListener('message', this.workerFinished.bind(this), false);

    window.addEventListener('touchend', function() {
        // create empty buffer
        var buffer = this.context.createBuffer(1, 1, 22050);
        var source =  this.context.createBufferSource();
        source.buffer = buffer;

        // connect to output (your speakers)
        source.connect( this.context.destination);

        // play the file
        source.start(0);

    }.bind(this), false);
}

SoundManager.prototype.playSong = function(song, playBuild, callback) {
    if(this.song == song) {
        return;
    }
    this.stop();
    this.song = song;
    if(!song || (!song.sound)) { // null song
        return;
    }
    
    // if there's a fadeout happening from AutoSong, kill it
    this.gainNode.gain.cancelScheduledValues(0);
    // Reset original volume
    this.setVolume(this.lastVol);
    if(this.mute) {
        this.setMute(true);
    }

    this.loadBuffer(song, function() {
        // To prevent race condition if you press "next" twice fast
        if(song == this.song) {
            // more racing than the Melbourne Cup
            try {
                this.bufSource.stop(0);
            } catch(err) {}
            this.bufSource = this.context.createBufferSource();
            this.bufSource.buffer = this.buffer;
            this.bufSource.loop = true;
            this.bufSource.loopStart = this.loopStart;
            this.bufSource.loopEnd = this.buffer.duration;
            this.bufSource.connect(this.gainNode);

            // This fixes sync issues on Firefox and slow machines.
            if(this.context.suspend && this.context.resume) {
                this.context.suspend().then(function() {
                    if(playBuild) {
                        // mobile webkit requires offset, even if 0
                        this.bufSource.start(0);
                        this.startTime = this.context.currentTime + this.loopStart;
                    } else {
                        this.bufSource.start(0, this.loopStart);
                        this.startTime = this.context.currentTime;
                    }
                    this.context.resume().then(function() {
                        this.playing = true;
                        if(callback)
                            callback();
                    }.bind(this));
                }.bind(this));
            } else {
                if(playBuild) {
                    // mobile webkit requires offset, even if 0
                    this.bufSource.start(0);
                    this.startTime = this.context.currentTime + this.loopStart;
                } else {
                    this.bufSource.start(0, this.loopStart);
                    this.startTime = this.context.currentTime;
                }
                this.playing = true;
                if(callback)
                    callback();
            }
        }
    }.bind(this));
};

SoundManager.prototype.stop = function() {
    if (this.playing) {
        // arg required for mobile webkit
        this.bufSource.stop(0);
        this.bufSource.disconnect(); // TODO needed?
        this.bufSource = null;
        this.vReady = false;
        this.playing = false;
        this.startTime = 0;
        this.loopStart = 0;
        this.loopLength = 0;
    }
};

// In seconds, relative to the loop start
SoundManager.prototype.currentTime = function() {
    if(!this.playing) {
        return 0;
    }
    return this.context.currentTime - this.startTime;
};

SoundManager.prototype.displayableTime = function() {
    if(!this.playing) {
        return 0;
    }
    var time = this.currentTime();
    if(time < 0) {
        return 0;
    } else {
        return time % this.loopLength;
    }
};

SoundManager.prototype.loadBuffer = function(song, callback) {
    if(callback) {
        this.onLoadCallback = callback;
    }
    if(song.sound.byteLength == 0) {
        // Someone went forward then immediately back then forward again
        // Either way, the sound is still loading. It'll come back when it's ready
        return;
    }
    var transferrables = [song.sound];
    if(song.buildup) {
        transferrables.push(song.buildup);
    }
    this.mp3Worker.postMessage(song, transferrables);
};

SoundManager.prototype.workerFinished = function(event) {
    var result = event.data;
    
    // restore our old ArrayBuffers TODO race
    var song = this.restoreBuffers(result.song);
    
    // Something else started loading after we started
    if(this.song != song) {
        console.log("Song changed before we could play it, user is impatient!");
        return;
    }

    if(song.buildup) {
        this.tmpBuild = this.trimMP3(this.audioBufFromRaw(result.build), song.forceTrim, song.noTrim);
    }
    this.tmpBuffer = this.trimMP3(this.audioBufFromRaw(result.loop), song.forceTrim, song.noTrim);
    this.onSongLoad(song);
}

// We pass our ArrayBuffers away, so we need to put them back
// We must iterate all the songs in case the player has moved on in the meantime
 SoundManager.prototype.restoreBuffers = function(newSong) {
     var songs = this.core.resourceManager.allSongs;
     for(var i = 0; i < songs.length; i++) {
         var oldSong = songs[i];
         var same = true;
         for(var attr in oldSong) {
            if(oldSong.hasOwnProperty(attr) && attr != "buildup" && attr != "sound") {
                var oldV = oldSong[attr];
                var newV = newSong[attr];
                if(oldV != newV) {
                    // Equality checks break for NaN, and isNaN coerces args to Number, which we don't want
                    if(!( (oldV != oldV) && (newV != newV) )) {
                        same = false;
                        break;
                    }
                }
            }
         }
         if(same) {
             oldSong.sound = newSong.sound;
             oldSong.buildup = newSong.buildup;
             return oldSong;
         }
     }
     console.log("Oh no! Original song has been lost!");
     return null;
 }

// Converts interleaved PCM to Web Audio API friendly format
SoundManager.prototype.audioBufFromRaw = function(sound) {
    var buffer = sound.array;
    var channels = sound.channels;
    var samples = buffer.length/channels;
    var audioBuf = this.context.createBuffer(channels, samples, sound.sampleRate);
    var audioChans = [];
    for(var i = 0; i < channels; i++) {
        audioChans.push(audioBuf.getChannelData(i));
    }
    for(var i = 0; i < buffer.length; i++) {
        audioChans[i % channels][Math.round(i/channels)] = buffer[i];
    }
    return audioBuf;
}

SoundManager.prototype.onSongLoad = function(song) {
    if(song.buildup) {
        this.buffer = this.concatenateAudioBuffers(this.tmpBuild, this.tmpBuffer);
        this.loopStart = this.tmpBuild.duration;
    } else {
        this.buffer = this.tmpBuffer;
        this.loopStart = 0;
    }
    this.loopLength = this.buffer.duration - this.loopStart;
    // free dat memory
    this.tmpBuild = this.tmpBuffer = null;
    if(this.onLoadCallback) {
        this.onLoadCallback();
        this.onLoadCallback = null;
    }
};

// because MP3 is bad, we nuke silence
SoundManager.prototype.trimMP3 = function(buffer, forceTrim, noTrim) {
    var start = LAME_DELAY_START;
    var newLength = buffer.length - LAME_DELAY_START - LAME_DELAY_END;
    var ret = this.context.createBuffer(buffer.numberOfChannels, newLength, buffer.sampleRate);
    for(var i=0; i<buffer.numberOfChannels; i++) {
        var oldBuf = buffer.getChannelData(i);
        var newBuf = ret.getChannelData(i);
        for(var j=0; j<ret.length; j++) {
            newBuf[j] = oldBuf[start + j];
        }
    }
    return ret;
};

// This wouldn't be required if Web Audio could do gapless playback properly
SoundManager.prototype.concatenateAudioBuffers = function(buffer1, buffer2) {
    if (!buffer1 || !buffer2) {
        console.log("no buffers!");
        return null;
    }

    if (buffer1.numberOfChannels != buffer2.numberOfChannels) {
        console.log("number of channels is not the same!");
        return null;
    }

    if (buffer1.sampleRate != buffer2.sampleRate) {
        console.log("sample rates don't match!");
        return null;
    }

    var tmp = this.context.createBuffer(buffer1.numberOfChannels,
        buffer1.length + buffer2.length, buffer1.sampleRate);

    for (var i=0; i<tmp.numberOfChannels; i++) {
        var data = tmp.getChannelData(i);
        data.set(buffer1.getChannelData(i));
        data.set(buffer2.getChannelData(i),buffer1.length);
    }
    return tmp;
};


SoundManager.prototype.initVisualiser = function(bars) {
    if(!bars) {
        return;
    }
    this.vReady = false;
    this.vBars = bars;
    for(var i = 0; i < this.analysers.length; i++) {
        this.analysers[i].disconnect();
    }
    if(this.splitter) {
        this.splitter.disconnect();
        this.splitter = null;
    }
    this.analysers = [];
    this.analyserArrays = [];
    this.logArrays = [];
    this.binCutoffs = [];
    
    this.linBins = 0;
    this.logBins = 0;
    this.maxBinLin = 0;
    
    this.attachVisualiser();
}

SoundManager.prototype.attachVisualiser = function() {
    if(!this.playing || this.vReady) {
        return;
    }

    var channels = this.bufSource.channelCount;
    // In case channel counts change, this is changed each time
    this.splitter = this.context.createChannelSplitter(channels);
    this.bufSource.connect(this.splitter);
    // Split display up into each channel
    this.vBars = Math.floor(this.vBars/channels);
    
    for(var i = 0; i < channels; i++) {
        var analyser = this.context.createAnalyser();
        // big fft buffers are new-ish
        try {
            analyser.fftSize = 8192;
        } catch(err) {
            analyser.fftSize = 2048;
        }
        // Chosen because they look nice, no maths behind it
        analyser.smoothingTimeConstant = 0.6;
        analyser.minDecibels = -70;
        analyser.maxDecibels = -25;
        this.analyserArrays.push(new Uint8Array(analyser.frequencyBinCount));
        analyser.getByteTimeDomainData(this.analyserArrays[i]);
        this.splitter.connect(analyser, i);   
        this.analysers.push(analyser);
        this.logArrays.push(new Uint8Array(this.vBars));
    }
    var binCount = this.analysers[0].frequencyBinCount;
    var binWidth = this.bufSource.buffer.sampleRate / binCount;
    // first 2kHz are linear
    this.maxBinLin = Math.floor(2000/binWidth);
    // Don't stretch the first 2kHz, it looks awful
    this.linBins = Math.min(this.maxBinLin, Math.floor(this.vBars/2));
    // Only go up to 22KHz
    var maxBinLog = Math.floor(22000/binWidth);
    var logBins = this.vBars - this.linBins;

    var logLow = Math.log2(2000);
    var logDiff = Math.log2(22000) - logLow;
    for(var i = 0; i < logBins; i++) {
        var cutoff = i * (logDiff/logBins) + logLow;
        var freqCutoff = Math.pow(2, cutoff);
        var binCutoff = Math.floor(freqCutoff / binWidth);
        this.binCutoffs.push(binCutoff);
    }
    this.vReady = true;
}

SoundManager.prototype.sumArray = function(array, low, high) {
    var total = 0;
    for(var i = low; i <= high; i++) {
        total += array[i];
    }
    return total/(high-low+1);
}

SoundManager.prototype.getVisualiserData = function() {
    if(!this.vReady) {
        return null;
    }
    for(var a = 0; a < this.analyserArrays.length; a++) {
        var data = this.analyserArrays[a];
        var result = this.logArrays[a];
        this.analysers[a].getByteFrequencyData(data);
        
        for(var i = 0; i < this.linBins; i++) {
            var scaled = Math.round(i * this.maxBinLin / this.linBins);
            result[i] = data[scaled];
        }
        result[this.linBins] = data[this.binCutoffs[0]];
        for(var i = this.linBins+1; i < this.vBars; i++) {
            var cutoff = i - this.linBins;
            result[i] = this.sumArray(data, this.binCutoffs[cutoff-1], 
                                            this.binCutoffs[cutoff]);
        }
    }
    return this.logArrays;
}

SoundManager.prototype.setMute = function(mute) {
    if(!this.mute && mute) { // muting
        this.lastVol = this.gainNode.gain.value;
    }
    if(mute) {
        this.gainNode.gain.value = 0;
    } else {
        this.gainNode.gain.value = this.lastVol;
    }
    this.core.userInterface.updateVolume(this.gainNode.gain.value);
    this.mute = mute;
    return mute;
};

SoundManager.prototype.toggleMute = function() {
    return this.setMute(!this.mute);
};

SoundManager.prototype.decreaseVolume = function() {
    this.setMute(false);
    var val = Math.max(this.gainNode.gain.value - 0.1, 0);
    this.setVolume(val);
};

SoundManager.prototype.increaseVolume = function() {
    this.setMute(false);
    var val = Math.min(this.gainNode.gain.value + 0.1, 1);
    this.setVolume(val);
};

SoundManager.prototype.setVolume = function(vol) {
    this.gainNode.gain.value = vol;
    this.lastVol = vol;
    this.core.userInterface.updateVolume(vol);
};

SoundManager.prototype.fadeOut = function(callback) {
    if(!this.mute) {
        // Firefox hackery
        this.gainNode.gain.setValueAtTime(this.lastVol, this.context.currentTime);
        this.gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 2);
    }
    setTimeout(callback, 2000);
}
