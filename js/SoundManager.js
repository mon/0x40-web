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

// Flash value + MAGIC WEB VALUE
var LAME_DELAY_START = 2258 + 1534;
var LAME_DELAY_END = 1000;

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
    
    // For concatenating our files
    this.leftToLoad = 0;
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
    var audio  = document.createElement("audio"),
    canPlayMP3 = (typeof audio.canPlayType === "function" &&
              audio.canPlayType("audio/mpeg") !== "");
    if(!canPlayMP3) {
        this.canUse = false;
        this.errorMsg = "MP3 not supported in this browser.";
        return;
    }
    
    var that = this;
    window.addEventListener('touchend', function() {
        // create empty buffer
        var buffer = that.context.createBuffer(1, 1, 22050);
        var source =  that.context.createBufferSource();
        source.buffer = buffer;

        // connect to output (your speakers)
        source.connect( that.context.destination);

        // play the file
        source.noteOn(0);

    }, false);
}

SoundManager.prototype.playSong = function(song, playBuild, callback) {
    var that = this;
    if(this.song == song) {
        return;
    }
    this.stop();
    this.song = song;
    if(!song || (!song.sound)) { // null song
        return;
    }
    
    this.loadBuffer(song, function() {
        // To prevent race condition if you press "next" twice fast
        if(song == that.song) {
            that.bufSource = that.context.createBufferSource();
            that.bufSource.buffer = that.buffer;
            that.bufSource.loop = true;
            that.bufSource.loopStart = that.loopStart;
            that.bufSource.loopEnd = that.buffer.duration;
            that.bufSource.connect(that.gainNode);
            
            if(callback)
                callback();
            
            // This fixes sync issues on Firefox and slow machines.
            that.context.suspend().then(function() {
                if(playBuild) {
                    // mobile webkit requires offset, even if 0
                    that.bufSource.start(0);
                    that.startTime = that.context.currentTime + that.loopStart;
                } else {
                    that.bufSource.start(0, that.loopStart);
                    that.startTime = that.context.currentTime;
                }
                that.context.resume();
                that.playing = true;
            });
        }
    });
}

SoundManager.prototype.stop = function() {
    if (this.playing) {
        // arg required for mobile webkit
        this.bufSource.stop(0);
        this.bufSource.disconnect(); // TODO needed?
        this.bufSource = null;
        this.playing = false;
        this.startTime = 0;
        this.loopStart = 0;
        this.loopLength = 0;
    }
}

// In seconds, relative to the loop start
SoundManager.prototype.currentTime = function() {
    if(!this.playing) {
        return 0;
    }
    return this.context.currentTime - this.startTime;
}

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
}

SoundManager.prototype.loadBuffer = function(song, callback) {
    if(callback) {
        this.onLoadCallback = callback;
    }
    if(song.buildup) {
        this.loadAudioFile(song, true);
    }
    this.loadAudioFile(song, false);
}

SoundManager.prototype.loadAudioFile = function(song, isBuild) {
    this.context.decodeAudioData(
        isBuild ? song.buildup : song.sound,
        this.getAudioCallback(song, isBuild),
            function() {
                console.log('Error decoding audio "' + song.name + '".');
        }
    );
}

/* decodeAudioData nukes our original MP3 array, but we want to keep it around
  for memory saving purposes, so we must duplicate it locally here */
SoundManager.prototype.getAudioCallback = function(song, isBuild) {
    var that = this;
    var current = isBuild ? song.buildup : song.sound;
    var copy = current.slice(0);
    return function(buffer) {
        // before the race condition check or we might lose data
        if(isBuild) {
            song.buildup = copy;
        } else {
            song.sound = copy;
        }
        // race condition prevention
        if(that.song != song) {
            return;
        }
        if(isBuild) {
            that.tmpBuild = that.trimMP3(buffer, song.forceTrim);
        } else {
            that.tmpBuffer = that.trimMP3(buffer, song.forceTrim);
        }
        that.onSongLoad(song);
    };
}

SoundManager.prototype.onSongLoad = function(song) {
    // if this fails, we need to wait for the other part to load
    if(this.tmpBuffer && (!song.buildup || this.tmpBuild)) {
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
    }
}

// because MP3 is bad, we nuke silence
SoundManager.prototype.trimMP3 = function(buffer, forceTrim) {
    // Firefox has to trim always, Chrome only on PackShit
    var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    // forceTrim is because PackShit breaks everything
    if(!(isFirefox || forceTrim)) {
        return buffer;
    }
    var start = LAME_DELAY_START;
    var newLength = buffer.length - LAME_DELAY_START - LAME_DELAY_END;
    if(forceTrim && !isFirefox) {
        // yes, really
        newLength -= 1200;
        start += 1200;
    }
    var ret = this.context.createBuffer(buffer.numberOfChannels, newLength, buffer.sampleRate);
    for(var i=0; i<buffer.numberOfChannels; i++) {
        var oldBuf = buffer.getChannelData(i);
        var newBuf = ret.getChannelData(i);
        for(var j=0; j<ret.length; j++) {
            newBuf[j] = oldBuf[start + j];
        }
    }
    return ret;
}

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

SoundManager.prototype.setMute = function(mute) {
    if(!this.mute && mute) { // muting
        this.lastVol = this.gainNode.gain.value;
        this.gainNode.gain.value = 0;
    } else if(this.mute && !mute) { // unmuting
        this.gainNode.gain.value = this.lastVol;
    }
    this.core.userInterface.updateVolume(this.gainNode.gain.value);
    this.mute = mute;
    return mute;
}

SoundManager.prototype.toggleMute = function() {
    return this.setMute(!this.mute);
}

SoundManager.prototype.decreaseVolume = function() {
    this.setMute(false);
    val = Math.max(this.gainNode.gain.value - 0.1, 0);
    this.gainNode.gain.value = val;
    this.core.userInterface.updateVolume(val);
}

SoundManager.prototype.increaseVolume = function() {
    this.setMute(false);
    val = Math.min(this.gainNode.gain.value + 0.1, 1);
    this.gainNode.gain.value = val;
    this.core.userInterface.updateVolume(val);
}

SoundManager.prototype.setVolume = function(vol) {
    this.gainNode.gain.value = vol;
    this.core.userInterface.updateVolume(vol);
}