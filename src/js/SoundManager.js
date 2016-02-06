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

(function(window, document) {
"use strict";

function SoundManager(core) {
    this.core = core;
    this.playing = false;
    this.playbackRate = 1;
    this.song = null;
    
    this.initPromise = null;

    /* Lower level audio and timing info */
    this.context = null; // Audio context, Web Audio API
    this.buildSource = null;
    this.loopSource = null;
    this.buildup = null;
    this.loop = null;
    this.startTime = 0;  // File start time - 0 is loop start, not build start
    this.buildLength = 0;
    this.loopLength = 0; // For calculating beat lengths

    // Volume
    this.gainNode = null;
    this.mute = false;
    this.lastVol = 1;
    
    // Visualiser
    this.vReady = false;
    this.vBars = 0;
    this.vTotalBars = 0;
    this.splitter = null;
    this.analysers = [];
    this.analyserArrays = [];
    this.logArrays = [];
    this.binCutoffs = [];
    this.linBins = 0;
    this.logBins = 0;
    this.maxBinLin = 0;
}

SoundManager.prototype.init = function() {
    if(!this.initPromise) {
        this.initPromise = new Promise((resolve, reject) => {
            // Check Web Audio API Support
            try {
                // More info at http://caniuse.com/#feat=audio-api
                window.AudioContext = window.AudioContext || window.webkitAudioContext;
                this.context = new window.AudioContext();
                // These don't always exist
                this.context.suspend = this.context.suspend || Promise.resolve();
                this.context.resume = this.context.resume || Promise.resolve();
                this.gainNode = this.context.createGain();
                this.gainNode.connect(this.context.destination);
            } catch(e) {
                reject(Error("Web Audio API not supported in this browser."));
                return;
            }
            resolve();
        }).then(response => {
            return new Promise((resolve, reject) => {          
                // See if our MP3 decoder is working
                let mp3Worker;
                try {
                    mp3Worker = this.createWorker();
                } catch(e) {
                    console.log(e);
                    reject(Error("MP3 Worker cannot be started - correct path set in defaults?"));
                }
                let pingListener = event => {
                    mp3Worker.removeEventListener('message', pingListener);
                    mp3Worker.terminate();
                    resolve();
                };
                mp3Worker.addEventListener('message', pingListener, false);
                mp3Worker.addEventListener('error', () => {
                    reject(Error("MP3 Worker cannot be started - correct path set in defaults?"));
                }, false);
                mp3Worker.postMessage({ping:true});
            });
        }).then(response => {
            return new Promise((resolve, reject) => {
                // iOS and other some mobile browsers - unlock the context as
                // it starts in a suspended state
                if(this.context.state != "running") {
                    this.core.warning("We're about to load about 10MB of stuff. Tap to begin!");
                    let unlocker = () => {
                        // create empty buffer
                        let buffer = this.context.createBuffer(1, 1, 22050);
                        let source =  this.context.createBufferSource();
                        source.buffer = buffer;

                        // connect to output (your speakers)
                        source.connect( this.context.destination);

                        // play the file
                        source.start(0);
                        
                        window.removeEventListener('touchend', unlocker);
                        window.removeEventListener('click', unlocker);
                        this.core.clearMessage();
                        resolve();
                    };
                    window.addEventListener('touchend', unlocker, false);
                    window.addEventListener('click', unlocker, false);
                } else {
                    resolve();
                }
            });
        });
    }
    return this.initPromise;
};

SoundManager.prototype.playSong = function(song, playBuild, forcePlay) {
    let p = Promise.resolve();
    // Editor forces play on audio updates
    if(this.song == song && !forcePlay) {
        return p;
    }
    this.stop();
    this.song = song;
    if(!song || (!song.sound)) { // null song
        return p;
    }
    
    // if there's a fadeout happening from AutoSong, kill it
    this.gainNode.gain.cancelScheduledValues(0);
    // Reset original volume
    this.setVolume(this.lastVol);
    if(this.mute) {
        this.setMute(true);
    }

    p = p.then(() => {
        return this.loadSong(song);
    }).then(buffers => {
        // To prevent race condition if you press "next" twice fast
        if(song != this.song) {
            // Stop processing - silently ignored in the catch below
            throw Error("Song not playable - ignoring!");
        }
        
        this.buildup = buffers.buildup;
        this.buildLength = this.buildup ? this.buildup.duration : 0;
        this.loop = buffers.loop;
        this.loopLength = this.loop.duration;

        // This fixes sync issues on Firefox and slow machines.
        return this.context.suspend();
    }).then(() => {
        if(playBuild) {
            this.seek(-this.buildLength, true);
        } else {
            this.seek(0, true);
        }
        
        return this.context.resume();
    }).then(() => {
        this.playing = true;
    }).catch(error => {
        // Just to ignore it if the song was invalid
        // Log it in case it's something weird
        console.log(error);
        return;
    });
    return p;
};

SoundManager.prototype.stop = function() {
    if (this.playing) {
        if(this.buildSource) {
            this.buildSource.stop(0);
            this.buildSource.disconnect();
            this.buildSource = null;
        }        
        // arg required for mobile webkit
        this.loopSource.stop(0);
         // TODO needed?
        this.loopSource.disconnect();
        this.loopSource = null;
        this.vReady = false;
        this.playing = false;
        this.startTime = 0;
    }
};

SoundManager.prototype.setRate = function(rate) {
    // Double speed is more than enough. Famous last words?
    rate = Math.max(Math.min(rate, 2), 0.25);
    
    let time = this.clampedTime();
    this.playbackRate = rate;
    this.seek(time);
};

SoundManager.prototype.seek = function(time, noPlayingUpdate) {
    if(!this.song) {
        return;
    }
    //console.log("Seeking to " + time);
    // Clamp the blighter
    time = Math.min(Math.max(time, -this.buildLength), this.loopLength);
    
    this.stop();
        
    this.loopSource = this.context.createBufferSource();
    this.loopSource.buffer = this.loop;
    this.loopSource.playbackRate.value = this.playbackRate;
    this.loopSource.loop = true;
    this.loopSource.loopStart = 0;
    this.loopSource.loopEnd = this.loopLength;
    this.loopSource.connect(this.gainNode);
    
    if(time < 0) {
        this.buildSource = this.context.createBufferSource();
        this.buildSource.buffer = this.buildup;
        this.buildSource.playbackRate.value = this.playbackRate;
        this.buildSource.connect(this.gainNode);
        this.buildSource.start(0, this.buildLength + time);
        this.loopSource.start(this.context.currentTime - (time / this.playbackRate));
    } else {
        this.loopSource.start(0, time);
    }
    
    this.startTime = this.context.currentTime - (time / this.playbackRate);
    if(!noPlayingUpdate) {
        this.playing = true;
    }
    this.initVisualiser();
    this.core.recalcBeatIndex();
};

// In seconds, relative to the loop start
SoundManager.prototype.currentTime = function() {
    if(!this.playing) {
        return 0;
    }
    return (this.context.currentTime - this.startTime) * this.playbackRate;
};

SoundManager.prototype.clampedTime = function() {
    let time = this.currentTime();
    
    if(time > 0) {
        time %= this.loopLength;
    }
    return time;
};

SoundManager.prototype.displayableTime = function() {
    let time = this.clampedTime();
    if(time < 0) {
        return 0;
    } else {
        return time;
    }
};

SoundManager.prototype.loadSong = function(song) {
    if(song._loadPromise) {
        // Someone went forward then immediately back then forward again
        // Either way, the sound is still loading. It'll come back when it's ready
        return;
    }
    
    let buffers = {loop: null, buildup: null};
    
    let promises = [this.loadBuffer(song, "sound").then(buffer => {
        buffers.loop = buffer;
    })];
    if(song.buildup) {
        promises.push(this.loadBuffer(song, "buildup").then(buffer => {
            buffers.buildup = buffer;
        }));
    } else {
        this.buildLength = 0;
    }
    song._loadPromise = Promise.all(promises)
    .then(() => {
        song._loadPromise = null;
        return buffers;
    });
    return song._loadPromise;
};

SoundManager.prototype.loadBuffer = function(song, soundName) {
    return new Promise((resolve, reject) => {
        let mp3Worker = this.createWorker();
        
        mp3Worker.addEventListener('error', () => {
            reject(Error("MP3 Worker failed to convert track"));
        }, false);
        
        mp3Worker.addEventListener('message', e => {
            let decoded = e.data;
            mp3Worker.terminate();
            
            // restore transferred buffer
            song[soundName] = decoded.arrayBuffer;
            // Convert to real audio buffer
            let audio = this.audioBufFromRaw(decoded.rawAudio);
            resolve(audio);
        }, false);
        
        // transfer the buffer to save time
        mp3Worker.postMessage(song[soundName], [song[soundName]]);
    });
};

// Converts continuous PCM array to Web Audio API friendly format
SoundManager.prototype.audioBufFromRaw = function(raw) {
    let buffer = raw.array;
    let channels = raw.channels;
    let samples = buffer.length/channels;
    let audioBuf = this.context.createBuffer(channels, samples, raw.sampleRate);
    //let audioBuf = this.context.createBuffer(1, buffer.length, raw.sampleRate);
    //audioBuf.copyToChannel(buffer, 0, 0);
    for(let i = 0; i < channels; i++) {
        //console.log("Making buffer at offset",i*samples,"and length",samples,".Original buffer is",channels,"channels and",buffer.length,"elements");
        // Offset is in bytes, length is in elements
        let channel = new Float32Array(buffer.buffer , i * samples * 4, samples);
        //console.log(channel);
        audioBuf.copyToChannel(channel, i, 0);
    }
    return audioBuf;
};

SoundManager.prototype.createWorker = function() {
    return new Worker(this.core.settings.defaults.workersPath + 'mp3-worker.js');
};

SoundManager.prototype.initVisualiser = function(bars) {
    // When restarting the visualiser
    if(!bars) {
        bars = this.vTotalBars;
    }
    this.vReady = false;
    this.vTotalBars = bars;
    for(let i = 0; i < this.analysers.length; i++) {
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
};

SoundManager.prototype.attachVisualiser = function() {
    if(!this.playing || this.vReady) {
        return;
    }

    // Get our info from the loop
    let channels = this.loopSource.channelCount;
    // In case channel counts change, this is changed each time
    this.splitter = this.context.createChannelSplitter(channels);
    // Connect to the gainNode so we get buildup stuff too
    this.loopSource.connect(this.splitter);
    if(this.buildSource) {
        this.buildSource.connect(this.splitter);
    }
    // Split display up into each channel
    this.vBars = Math.floor(this.vTotalBars/channels);
    
    for(let i = 0; i < channels; i++) {
        let analyser = this.context.createAnalyser();
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
    let binCount = this.analysers[0].frequencyBinCount;
    let binWidth = this.loopSource.buffer.sampleRate / binCount;
    // first 2kHz are linear
    this.maxBinLin = Math.floor(2000/binWidth);
    // Don't stretch the first 2kHz, it looks awful
    this.linBins = Math.min(this.maxBinLin, Math.floor(this.vBars/2));
    // Only go up to 22KHz
    let maxBinLog = Math.floor(22000/binWidth);
    let logBins = this.vBars - this.linBins;

    let logLow = Math.log2(2000);
    let logDiff = Math.log2(22000) - logLow;
    for(let i = 0; i < logBins; i++) {
        let cutoff = i * (logDiff/logBins) + logLow;
        let freqCutoff = Math.pow(2, cutoff);
        let binCutoff = Math.floor(freqCutoff / binWidth);
        this.binCutoffs.push(binCutoff);
    }
    this.vReady = true;
};

SoundManager.prototype.sumArray = function(array, low, high) {
    let total = 0;
    for(let i = low; i <= high; i++) {
        total += array[i];
    }
    return total/(high-low+1);
};

SoundManager.prototype.getVisualiserData = function() {
    if(!this.vReady) {
        return null;
    }
    for(let a = 0; a < this.analyserArrays.length; a++) {
        let data = this.analyserArrays[a];
        let result = this.logArrays[a];
        this.analysers[a].getByteFrequencyData(data);
        
        for(let i = 0; i < this.linBins; i++) {
            let scaled = Math.round(i * this.maxBinLin / this.linBins);
            result[i] = data[scaled];
        }
        result[this.linBins] = data[this.binCutoffs[0]];
        for(let i = this.linBins+1; i < this.vBars; i++) {
            let cutoff = i - this.linBins;
            result[i] = this.sumArray(data, this.binCutoffs[cutoff-1], 
                                            this.binCutoffs[cutoff]);
        }
    }
    return this.logArrays;
};

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
    let val = Math.max(this.gainNode.gain.value - 0.1, 0);
    this.setVolume(val);
};

SoundManager.prototype.increaseVolume = function() {
    this.setMute(false);
    let val = Math.min(this.gainNode.gain.value + 0.1, 1);
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
};

window.SoundManager = SoundManager;

})(window, document);