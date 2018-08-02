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

class SoundManager {
    constructor(core) {
        // Perhaps this will do more later
        this.eventListeners = {
            /* callback seek()
            *
            * Called when the audio has been seeked - reset time determined transforms
            */
            seek : []
        };

        this.core = core;
        this.playing = false;
        this.playbackRate = 1;
        this.song = null;

        this.initPromise = null;
        this.lockedPromise = null;
        this.locked = true;

        /* Lower level audio and timing info */
        this.context = null; // Audio context, Web Audio API
        this.oggSupport = false;
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

    callEventListeners(ev) {
        let args = Array.prototype.slice.call(arguments, 1);
        this.eventListeners[ev].forEach(function(callback) {
            callback.apply(null, args);
        });
    }

    addEventListener(ev, callback) {
        ev = ev.toLowerCase();
        if (typeof(this.eventListeners[ev]) !== "undefined") {
            this.eventListeners[ev].push(callback);
        } else {
            throw Error("Unknown event: " + ev);
        }
    }

    removeEventListener(ev, callback) {
        ev = ev.toLowerCase();
        if (typeof(this.eventListeners[ev]) !== "undefined") {
            this.eventListeners[ev] = this.eventListeners[ev].filter(function(a) {
                return (a !== callback);
            });
        } else {
            throw Error("Unknown event: " + ev);
        }
    }

    init() {
        if(!this.initPromise) {
            this.initPromise = new Promise((resolve, reject) => {
                // Check Web Audio API Support
                try {
                    // More info at http://caniuse.com/#feat=audio-api
                    window.AudioContext = window.AudioContext || window.webkitAudioContext;
                    // These don't always exist
                    AudioContext.prototype.suspend = AudioContext.prototype.suspend || (() => {return Promise.resolve();});
                    AudioContext.prototype.resume = AudioContext.prototype.resume || (() => {return Promise.resolve();});

                    this.context = new window.AudioContext();
                    this.gainNode = this.context.createGain();
                    this.gainNode.connect(this.context.destination);
                } catch(e) {
                    reject(Error("Web Audio API not supported in this browser."));
                    return;
                }
                resolve();
            }).then(() => {
                // check for .ogg support - if not, we'll have to load the ogg decoder
                return new Promise((resolve, reject) => {
                    this.context.decodeAudioData(miniOgg, success => {
                            this.oggSupport = true;
                            resolve();
                        }, error => {
                            this.oggSupport = false;
                            resolve();
                    });
                });
            }).then(() => {
                return new Promise((resolve, reject) => {
                    // See if our audio decoder is working
                    let audioWorker;
                    try {
                        audioWorker = this.createWorker();
                    } catch(e) {
                        console.log(e);
                        reject(Error("Audio Worker cannot be started - correct path set in defaults?"));
                        return;
                    }
                    let pingListener = event => {
                        audioWorker.terminate();
                        resolve();
                    };
                    audioWorker.addEventListener('message', pingListener, false);
                    audioWorker.addEventListener('error', () => {
                        reject(Error("Audio Worker cannot be started - correct path set in defaults?"));
                    }, false);
                    audioWorker.postMessage({ping:true, ogg:this.oggSupport});
                });
            }).then(() => {
                this.locked = this.context.state != "running";
            });
        }
        return this.initPromise;
    }

    unlock() {
        if(this.lockedPromise) {
            return this.lockedPromise;
        }
        this.lockedPromise = new Promise((resolve, reject) => {
            // iOS and other some mobile browsers - unlock the context as
            // it starts in a suspended state
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
        });
        return this.lockedPromise;
    }

    playSong(song, playBuild, forcePlay) {
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
                return Promise.reject("Song changed between load and play - this message can be ignored");
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
        });
        return p;
    }

    stop(dontDeleteBuffers) {
        if (this.playing) {
            if(this.buildSource) {
                this.buildSource.stop(0);
                this.buildSource.disconnect();
                this.buildSource = null;
                if(!dontDeleteBuffers)
                    this.buildup = null;
            }
            // arg required for mobile webkit
            this.loopSource.stop(0);
             // TODO needed?
            this.loopSource.disconnect();
            this.loopSource = null;
            if(!dontDeleteBuffers)
                this.loop = null;
            this.vReady = false;
            this.playing = false;
            this.startTime = 0;
        }
    }

    setRate(rate) {
        // Double speed is more than enough. Famous last words?
        rate = Math.max(Math.min(rate, 2), 0.25);

        let time = this.clampedTime;
        this.playbackRate = rate;
        this.seek(time);
    }

    seek(time, noPlayingUpdate) {
        if(!this.song) {
            return;
        }

        this.callEventListeners("seek");

        //console.log("Seeking to " + time);
        // Clamp the blighter
        time = Math.min(Math.max(time, -this.buildLength), this.loopLength);

        this.stop(true);

        if(!this.loop) {
            return;
        }

        this.loopSource = this.context.createBufferSource();
        this.loopSource.buffer = this.loop;
        this.loopSource.playbackRate.value = this.playbackRate;
        this.loopSource.loop = true;
        this.loopSource.loopStart = 0;
        this.loopSource.loopEnd = this.loopLength;
        this.loopSource.connect(this.gainNode);

        if(time < 0 && this.buildup) {
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
    }

    // In seconds, relative to the loop start
    get currentTime() {
        if(!this.playing) {
            return 0;
        }
        return (this.context.currentTime - this.startTime) * this.playbackRate;
    }

    get clampedTime() {
        let time = this.currentTime;

        if(time > 0) {
            time %= this.loopLength;
        }
        return time;
    }

    loadSong(song) {
        if(song._loadPromise) {
            /* Caused when moving back/forwards rapidly.
               The sound is still loading. We reject this promise, and the already
               running decode will finish and resolve instead.
               NOTE: If anything but playSong calls loadSong, this idea is broken. */
            return Promise.reject("Song changed between load and play - this message can be ignored");
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
    }

    loadBuffer(song, soundName) {
        let buffer = song[soundName];

        // Is this an ogg file?
        let view = new Uint8Array(buffer);
        // Signature for ogg file: OggS
        if(this.oggSupport && view[0] == 0x4F && view[1] == 0x67 && view[2] == 0x67 && view[3] == 0x53) {
            // As we don't control decodeAudioData, we cannot do fast transfers and must copy
            let backup = buffer.slice(0);
            return new Promise((resolve, reject) => {
                this.context.decodeAudioData(buffer, result => {
                        resolve(result);
                    }, error => {
                        reject(Error("decodeAudioData failed to load track"));
                });
            }).then(result => {
                // restore copied buffer
                song[soundName] = backup;
                return result;
            });
        } else { // Use our JS decoder
            return new Promise((resolve, reject) => {
                let audioWorker = this.createWorker();

                audioWorker.addEventListener('error', () => {
                    reject(Error("Audio Worker failed to convert track"));
                }, false);

                audioWorker.addEventListener('message', e => {
                    let decoded = e.data;
                    audioWorker.terminate();

                    // restore transferred buffer
                    song[soundName] = decoded.arrayBuffer;
                    if(decoded.error) {
                        reject(new Error(decoded.error));
                        return;
                    }
                    // Convert to real audio buffer
                    let audio = this.audioBufFromRaw(decoded.rawAudio);
                    resolve(audio);
                }, false);

                // transfer the buffer to save time
                audioWorker.postMessage({buffer: buffer, ogg: this.oggSupport}, [buffer]);
            });
       }

    }

    // Converts continuous PCM array to Web Audio API friendly format
    audioBufFromRaw(raw) {
        let buffer = raw.array;
        let channels = raw.channels;
        let samples = buffer.length/channels;
        let audioBuf = this.context.createBuffer(channels, samples, raw.sampleRate);
        for(let i = 0; i < channels; i++) {
            // Offset is in bytes, length is in elements
            let channel = new Float32Array(buffer.buffer , i * samples * 4, samples);
            // Most browsers
            if(typeof audioBuf.copyToChannel === "function") {
                audioBuf.copyToChannel(channel, i, 0);
            } else { // Safari, Edge sometimes
                audioBuf.getChannelData(i).set(channel);
            }
        }
        return audioBuf;
    }

    createWorker() {
        return new Worker(this.core.settings.workersPath + 'audio-worker.js');
    }

    initVisualiser(bars) {
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
    }

    attachVisualiser() {
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
    }

    sumArray(array, low, high) {
        let total = 0;
        for(let i = low; i <= high; i++) {
            total += array[i];
        }
        return total/(high-low+1);
    }

    getVisualiserData() {
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
    }

    setMute(mute) {
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
    }

    toggleMute() {
        return this.setMute(!this.mute);
    }

    decreaseVolume() {
        this.setMute(false);
        let val = Math.max(this.gainNode.gain.value - 0.1, 0);
        this.setVolume(val);
    }

    increaseVolume() {
        this.setMute(false);
        let val = Math.min(this.gainNode.gain.value + 0.1, 1);
        this.setVolume(val);
    }

    setVolume(vol) {
        this.gainNode.gain.value = vol;
        this.lastVol = vol;
        this.core.userInterface.updateVolume(vol);
    }

    fadeOut(callback) {
        if(!this.mute) {
            // Firefox hackery
            this.gainNode.gain.setValueAtTime(this.lastVol, this.context.currentTime);
            this.gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 2);
        }
        setTimeout(callback, 2000);
    }
}

let miniOggRaw =
"T2dnUwACAAAAAAAAAADFYgAAAAAAAMLKRdwBHgF2b3JiaXMAAAAAAUSsAAAA" +
"AAAAgLsAAAAAAAC4AU9nZ1MAAAAAAAAAAAAAxWIAAAEAAACcKCV2Dzv/////" +
"////////////MgN2b3JiaXMrAAAAWGlwaC5PcmcgbGliVm9yYmlzIEkgMjAx" +
"MjAyMDMgKE9tbmlwcmVzZW50KQAAAAABBXZvcmJpcx9CQ1YBAAABABhjVClG" +
"mVLSSokZc5QxRplikkqJpYQWQkidcxRTqTnXnGusubUghBAaU1ApBZlSjlJp" +
"GWOQKQWZUhBLSSV0EjonnWMQW0nB1phri0G2HIQNmlJMKcSUUopCCBlTjCnF" +
"lFJKQgcldA465hxTjkooQbicc6u1lpZji6l0kkrnJGRMQkgphZJKB6VTTkJI" +
"NZbWUikdc1JSakHoIIQQQrYghA2C0JBVAAABAMBAEBqyCgBQAAAQiqEYigKE" +
"hqwCADIAAASgKI7iKI4jOZJjSRYQGrIKAAACABAAAMBwFEmRFMmxJEvSLEvT" +
"RFFVfdU2VVX2dV3XdV3XdSA0ZBUAAAEAQEinmaUaIMIMZBgIDVkFACAAAABG" +
"KMIQA0JDVgEAAAEAAGIoOYgmtOZ8c46DZjloKsXmdHAi1eZJbirm5pxzzjkn" +
"m3PGOOecc4pyZjFoJrTmnHMSg2YpaCa05pxznsTmQWuqtOacc8Y5p4NxRhjn" +
"nHOatOZBajbW5pxzFrSmOWouxeaccyLl5kltLtXmnHPOOeecc84555xzqhen" +
"c3BOOOecc6L25lpuQhfnnHM+Gad7c0I455xzzjnnnHPOOeecc4LQkFUAABAA" +
"AEEYNoZxpyBIn6OBGEWIacikB92jwyRoDHIKqUejo5FS6iCUVMZJKZ0gNGQV" +
"AAAIAAAhhBRSSCGFFFJIIYUUUoghhhhiyCmnnIIKKqmkoooyyiyzzDLLLLPM" +
"Muuws8467DDEEEMMrbQSS0211VhjrbnnnGsO0lpprbXWSimllFJKKQgNWQUA" +
"gAAAEAgZZJBBRiGFFFKIIaaccsopqKACQkNWAQCAAAACAAAAPMlzREd0REd0" +
"REd0REd0RMdzPEeUREmUREm0TMvUTE8VVdWVXVvWZd32bWEXdt33dd/3dePX" +
"hWFZlmVZlmVZlmVZlmVZlmVZgtCQVQAACAAAgBBCCCGFFFJIIaUYY8wx56CT" +
"UEIgNGQVAAAIACAAAADAURzFcSRHciTJkixJkzRLszzN0zxN9ERRFE3TVEVX" +
"dEXdtEXZlE3XdE3ZdFVZtV1Ztm3Z1m1flm3f933f933f933f933f93UdCA1Z" +
"BQBIAADoSI6kSIqkSI7jOJIkAaEhqwAAGQAAAQAoiqM4juNIkiRJlqRJnuVZ" +
"omZqpmd6qqgCoSGrAABAAAABAAAAAAAomuIppuIpouI5oiNKomVaoqZqriib" +
"suu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6LhAasgoAkAAA" +
"0JEcyZEcSZEUSZEcyQFCQ1YBADIAAAIAcAzHkBTJsSxL0zzN0zxN9ERP9ExP" +
"FV3RBUJDVgEAgAAAAgAAAAAAMCTDUixHczRJlFRLtVRNtVRLFVVPVVVVVVVV" +
"VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVNU3TNE0gNGQlAAAEAMBijcHl" +
"ICElJeXeEMIQk54xJiG1XiEEkZLeMQYVg54yogxy3kLjEIMeCA1ZEQBEAQAA" +
"xiDHEHPIOUepkxI556h0lBrnHKWOUmcpxZhizSiV2FKsjXOOUketo5RiLC12" +
"lFKNqcYCAAACHAAAAiyEQkNWBABRAACEMUgppBRijDmnnEOMKeeYc4Yx5hxz" +
"jjnnoHRSKuecdE5KxBhzjjmnnHNSOieVc05KJ6EAAIAABwCAAAuh0JAVAUCc" +
"AIBBkjxP8jRRlDRPFEVTdF1RNF3X8jzV9ExTVT3RVFVTVW3ZVFVZljzPND3T" +
"VFXPNFXVVFVZNlVVlkVV1W3TdXXbdFXdlm3b911bFnZRVW3dVF3bN1XX9l3Z" +
"9n1Z1nVj8jxV9UzTdT3TdGXVdW1bdV1d90xTlk3XlWXTdW3blWVdd2XZ9zXT" +
"dF3TVWXZdF3ZdmVXt11Z9n3TdYXflWVfV2VZGHZd94Vb15XldF3dV2VXN1ZZ" +
"9n1b14Xh1nVhmTxPVT3TdF3PNF1XdV1fV13X1jXTlGXTdW3ZVF1ZdmXZ911X" +
"1nXPNGXZdF3bNl1Xll1Z9n1XlnXddF1fV2VZ+FVX9nVZ15Xh1m3hN13X91VZ" +
"9oVXlnXh1nVhuXVdGD5V9X1TdoXhdGXf14XfWW5dOJbRdX1hlW3hWGVZOX7h" +
"WJbd95VldF1fWG3ZGFZZFoZf+J3l9n3jeHVdGW7d58y67wzH76T7ytPVbWOZ" +
"fd1ZZl93juEYOr/w46mqr5uuKwynLAu/7evGs/u+soyu6/uqLAu/KtvCseu+" +
"8/y+sCyj7PrCasvCsNq2Mdy+biy/cBzLa+vKMeu+UbZ1fF94CsPzdHVdeWZd" +
"x/Z1dONHOH7KAACAAQcAgAATykChISsCgDgBAI8kiaJkWaIoWZYoiqbouqJo" +
"uq6kaaapaZ5pWppnmqZpqrIpmq4saZppWp5mmpqnmaZomq5rmqasiqYpy6Zq" +
"yrJpmrLsurJtu65s26JpyrJpmrJsmqYsu7Kr267s6rqkWaapeZ5pap5nmqZq" +
"yrJpmq6reZ5qep5oqp4oqqpqqqqtqqosW55nmproqaYniqpqqqatmqoqy6aq" +
"2rJpqrZsqqptu6rs+rJt67ppqrJtqqYtm6pq267s6rIs27ovaZppap5nmprn" +
"maZpmrJsmqorW56nmp4oqqrmiaZqqqosm6aqypbnmaoniqrqiZ5rmqoqy6Zq" +
"2qppmrZsqqotm6Yqy65t+77ryrJuqqpsm6pq66ZqyrJsy77vyqruiqYpy6aq" +
"2rJpqrIt27Lvy7Ks+6JpyrJpqrJtqqouy7JtG7Ns+7pomrJtqqYtm6oq27It" +
"+7os27rvyq5vq6qs67It+7ru+q5w67owvLJs+6qs+ror27pv6zLb9n1E05Rl" +
"UzVt21RVWXZl2fZl2/Z90TRtW1VVWzZN1bZlWfZ9WbZtYTRN2TZVVdZN1bRt" +
"WZZtYbZl4XZl2bdlW/Z115V1X9d949dl3ea6su3Lsq37qqv6tu77wnDrrvAK" +
"AAAYcAAACDChDBQashIAiAIAAIxhjDEIjVLOOQehUco55yBkzkEIIZXMOQgh" +
"lJI5B6GUlDLnIJSSUgihlJRaCyGUlFJrBQAAFDgAAATYoCmxOEChISsBgFQA" +
"AIPjWJbnmaJq2rJjSZ4niqqpqrbtSJbniaJpqqptW54niqapqq7r65rniaJp" +
"qqrr6rpomqapqq7ruroumqKpqqrrurKum6aqqq4ru7Ls66aqqqrryq4s+8Kq" +
"uq4ry7Jt68Kwqq7ryrJs27Zv3Lqu677v+8KRreu6LvzCMQxHAQDgCQ4AQAU2" +
"rI5wUjQWWGjISgAgAwCAMAYhgxBCBiGEkFJKIaWUEgAAMOAAABBgQhkoNGRF" +
"ABAnAAAYQymklFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSCmllFJKKaWU" +
"UkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSqmklFJKKaWU" +
"UkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWU" +
"UkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWU" +
"UkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWU" +
"UkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWU" +
"UkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimVUkoppZRS" +
"SimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRS" +
"SimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFIKAJCKcACQejCh" +
"DBQashIASAUAAIxRSinGnIMQMeYYY9BJKClizDnGHJSSUuUchBBSaS23yjkI" +
"IaTUUm2Zc1JaizHmGDPnpKQUW805h1JSi7HmmmvupLRWa64151paqzXXnHPN" +
"ubQWa64515xzyzHXnHPOOecYc84555xzzgUA4DQ4AIAe2LA6wknRWGChISsB" +
"gFQAAAIZpRhzzjnoEFKMOecchBAihRhzzjkIIVSMOeccdBBCqBhzzDkIIYSQ" +
"OecchBBCCCFzDjroIIQQQgcdhBBCCKGUzkEIIYQQSighhBBCCCGEEDoIIYQQ" +
"QgghhBBCCCGEUkoIIYQQQgmhlFAAAGCBAwBAgA2rI5wUjQUWGrISAAACAIAc" +
"lqBSzoRBjkGPDUHKUTMNQkw50ZliTmozFVOQORCddBIZakHZXjILAACAIAAg" +
"wAQQGCAo+EIIiDEAAEGIzBAJhVWwwKAMGhzmAcADRIREAJCYoEi7uIAuA1zQ" +
"xV0HQghCEIJYHEABCTg44YYn3vCEG5ygU1TqIAAAAAAADADgAQDgoAAiIpqr" +
"sLjAyNDY4OjwCAAAAAAAFgD4AAA4PoCIiOYqLC4wMjQ2ODo8AgAAAAAAAAAA" +
"gICAAAAAAABAAAAAgIBPZ2dTAAQBAAAAAAAAAMViAAACAAAA22A/JwIBAQAK";

// write the bytes of the string to an ArrayBuffer
let miniOggBin = atob(miniOggRaw);
let miniOgg = new ArrayBuffer(miniOggBin.length);
let view = new Uint8Array(miniOgg);
for (var i = 0; i < miniOggBin.length; i++) {
    view[i] = miniOggBin.charCodeAt(i);
}

window.SoundManager = SoundManager;

})(window, document);