import type { HuesCore } from "./HuesCore";
import type { HuesSong, HuesSongSection } from "./ResourcePack";
import EventListener from "./EventListener";

type SoundCallbacks = {
    // Called when the audio has been seeked - reset time determined transforms
    seek : (() => void)[],

    // Called when someone requests a new song to be played - used when
    // you want to do something with the finished AudioBuffers, like
    // display length, or display a waveform.
    songloading : ((promise: Promise<void>, song: HuesSong) => void)[],
}

type SongBuffer = {
    source?: AudioBufferSourceNode;
    buffer?: AudioBuffer;
    length: number; // For calculating beat lengths
}

// just for songLoad
type AudioBuffers = {loop?: AudioBuffer, buildup?: AudioBuffer};

declare global {
    // the most logical place to store these
    interface AudioBuffer { replayGain?: number; }
}

interface SoundManagerSong extends HuesSong {
    _loadPromise?: Promise<AudioBuffers>
}

export default class SoundManager extends EventListener<SoundCallbacks> {
    core: HuesCore;
    playing: boolean;
    playbackRate: number;
    song?: HuesSong;

    initPromise?: Promise<void>;
    lockedPromise?: Promise<void>;
    locked: boolean;

    // Lower level audio and timing info
    // @ts-ignore: Object is possibly 'undefined'.
    context!: AudioContext; // Audio context, Web Audio API
    oggSupport: boolean;
    mp3IsSane: boolean;
    build: SongBuffer;
    loop: SongBuffer;

    startTime: number; // File start time - 0 is loop start, not build start

    // Volume
    gainNode!: GainNode;
    replayGainNode!: GainNode;
    mute: boolean;
    lastVol: number;

    // Visualiser
    vReady: boolean;
    vBars: number;
    vTotalBars: number;
    splitter?: ChannelSplitterNode;
    analysers: AnalyserNode[];
    analyserArrays: Uint8Array[];
    logArrays: Uint8Array[];
    binCutoffs: number[];
    linBins: number;
    logBins: number;
    maxBinLin: number;

    constructor(core: HuesCore, initialVolume = 1) {
        // Perhaps this will do more later
        super({
            seek : [],
            songloading : [],
        });

        this.core = core;
        this.playing = false;
        this.playbackRate = 1;

        this.locked = true;

        this.oggSupport = false;
        this.mp3IsSane = false;
        this.build = {length: 0};
        this.loop = {length: 0};
        this.startTime = 0;

        this.mute = false;
        this.lastVol = initialVolume;

        this.vReady = false;
        this.vBars = 0;
        this.vTotalBars = 0;
        this.analysers = [];
        this.analyserArrays = [];
        this.logArrays = [];
        this.binCutoffs = [];
        this.linBins = 0;
        this.logBins = 0;
        this.maxBinLin = 0;
    }

    init() {
        if(!this.initPromise) {
            this.initPromise = this._init();
        }
        return this.initPromise;
    }

    private async _init() {
        // Check Web Audio API Support
        try {
            this.context = new AudioContext();
            this.gainNode = this.context.createGain();
            this.replayGainNode = this.context.createGain();
            this.gainNode.connect(this.context.destination);
            this.replayGainNode.connect(this.gainNode);
        } catch(e) {
            throw Error("Web Audio API not supported in this browser.");
        }

        // check for .ogg support - if not, we'll have to load the ogg decoder
        try {
            await this.context.decodeAudioData(miniOgg);
            this.oggSupport = true;
        } catch(e) {
            this.oggSupport = false;
        }

        // check if MP3 decoding is sane - if not, we'll have to load the mp3 decoder
        // Specifically: older versions of Firefox and Safari(?) don't
        // use the LAME header to correctly strip the leadin, causing
        // gaps in playback. Our test file is exactly 1 sample long. If
        // the decoder is not sane, the test file will be ~3000 samples.
        // Because decoding resamples the audio to your computer's rate,
        // and some people use high sample rates, just check if samples
        // < 10 - this allows up to 400KHz sample rates which should
        // futureproof any insane audiophiles.
        try {
            const buffer = await this.context.decodeAudioData(miniMp3);
            this.mp3IsSane = buffer.length < 10;
        } catch(e) {
            this.mp3IsSane = false;
        }

        // if both formats supported, don't even try the audio worker
        if(!this.oggSupport || !this.mp3IsSane) {
            await new Promise<void>((resolve, reject) => {
                // See if our audio decoder is working
                let audioWorker: Worker;
                try {
                    audioWorker = this.createWorker();
                } catch(e) {
                    console.log(e);
                    reject(Error("Audio Worker cannot be started - correct path set in defaults?"));
                    return;
                }
                let pingListener = (event: any) => {
                    audioWorker.terminate();
                    resolve();
                };
                audioWorker.addEventListener('message', pingListener, false);
                audioWorker.addEventListener('error', () => {
                    reject(Error("Audio Worker cannot be started - correct path set in defaults?"));
                }, false);
                audioWorker.postMessage({ping:true, ogg:this.oggSupport, mp3:this.mp3IsSane});
            });
        }

        this.locked = this.context.state != "running";
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

    playSong(song: HuesSong, playBuild: boolean, forcePlay: boolean = false): Promise<void> {
        let promise = this._playSong(song, playBuild, forcePlay);
        this.callEventListeners("songloading", promise, song);
        return promise;
    }

    private async _playSong(song: HuesSong, playBuild: boolean, forcePlay: boolean) {
        // Editor forces play on audio updates
        if(this.song == song && !forcePlay) {
            return;
        }
        this.stop();
        this.song = song;
        if(!song || (!song.loop.sound)) { // null song
            return;
        }

        // if there's a fadeout happening from AutoSong, kill it
        this.gainNode.gain.cancelScheduledValues(0);
        // Reset original volume
        this.setVolume(this.lastVol);
        if(this.mute) {
            this.setMute(true);
        }

        let buffers = await this.loadSong(song);
        // To prevent race condition if you press "next" twice fast
        if(song != this.song) {
            throw Error("Song changed between load and play - this message can be ignored");
        }

        this.build.buffer = buffers.buildup;
        this.build.length = this.build.buffer ? this.build.buffer.duration : 0;
        this.loop.buffer = buffers.loop;
        this.loop.length = this.loop.buffer!.duration;

        // This fixes sync issues on Firefox and slow machines.
        await this.context.suspend();

        if(playBuild) {
            this.seek(-this.build.length, true);
        } else {
            this.seek(0, true);
        }

        await this.context.resume();

        this.playing = true;
    }

    stop(dontDeleteBuffers?: boolean) {
        if (this.playing) {
            if(this.build.source) {
                this.build.source.stop(0);
                this.build.source.disconnect();
                this.build.source = undefined;
                if(!dontDeleteBuffers)
                    this.build.buffer = undefined;
            }
            // arg required for mobile webkit
            this.loop.source!.stop(0);
             // TODO needed?
            this.loop.source!.disconnect();
            this.loop.source = undefined;
            if(!dontDeleteBuffers)
                this.loop.buffer = undefined;
            this.vReady = false;
            this.playing = false;
            this.startTime = 0;
        }
    }

    setRate(rate: number) {
        // Double speed is more than enough. Famous last words?
        rate = Math.max(Math.min(rate, 2), 0.25);

        let time = this.clampedTime;
        this.playbackRate = rate;
        this.seek(time);
    }

    seek(time: number, noPlayingUpdate: boolean = false) {
        if(!this.song) {
            return;
        }

        this.callEventListeners("seek");

        //console.log("Seeking to " + time);
        // Clamp the blighter
        time = Math.min(Math.max(time, -this.build.length), this.loop.length);

        this.stop(true);

        if(!this.loop.buffer) {
            return;
        }

        this.loop.source = this.context.createBufferSource();
        this.loop.source.buffer = this.loop.buffer;
        this.loop.source.playbackRate.value = this.playbackRate;
        this.loop.source.loop = true;
        this.loop.source.loopStart = 0;
        this.loop.source.loopEnd = this.loop.length;
        this.loop.source.connect(this.replayGainNode!);

        if(time < 0 && this.build.buffer) {
            this.build.source = this.context.createBufferSource();
            this.build.source.buffer = this.build.buffer;
            this.build.source.playbackRate.value = this.playbackRate;
            this.build.source.connect(this.replayGainNode!);
            this.build.source.start(0, this.build.length + time);
            this.loop.source.start(this.context.currentTime - (time / this.playbackRate));
        } else {
            this.loop.source.start(0, time);
        }

        let gain = this.loop.buffer.replayGain;
        if(this.build.buffer) {
            gain = Math.min(gain!, this.build.buffer.replayGain!);
        }
        this.replayGainNode.gain.setValueAtTime(gain!, this.context.currentTime);

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
            time %= this.loop.length;
        }
        return time;
    }

    loadSong(song: SoundManagerSong): Promise<AudioBuffers> {
        if(song._loadPromise) {
            /* Caused when moving back/forwards rapidly.
               The sound is still loading. We reject this promise, and the already
               running decode will finish and resolve instead.
               NOTE: If anything but playSong calls loadSong, this idea is broken. */
            return Promise.reject("Song changed between load and play - this message can be ignored");
        }

        let buffers: AudioBuffers = {};

        let promises = [this.loadBuffer(song.loop).then(buffer => {
            buffers.loop = buffer;
        })];
        if(song.build?.sound) {
            promises.push(this.loadBuffer(song.build).then(buffer => {
                buffers.buildup = buffer;
            }));
        } else {
            this.build.length = 0;
        }
        song._loadPromise = Promise.all(promises)
        .then(() => {
            song._loadPromise = undefined;
            return buffers;
        });
        return song._loadPromise;
    }

    async loadBuffer(section: HuesSongSection): Promise<AudioBuffer> {
        let buffer = section.sound;

        if(!buffer) {
            throw Error("Section has no buffer: " + section);
        }

        // Is this a file supported by the browser's importer?
        let view = new Uint8Array(buffer);
        // Signature for ogg file: OggS
        if((this.oggSupport && view[0] == 0x4F && view[1] == 0x67 && view[2] == 0x67 && view[3] == 0x53) ||
                (this.mp3IsSane &&
                    // untagged MP3
                    (view[0] == 0xFF && (view[1] == 0xFB || view[1] == 0xFA || view[1] == 0xF2 || view[1] == 0xF3)) ||
                    // ID3v2 tagged MP3 "ID3"
                    (view[0] == 0x49 && view[1] == 0x44 && view[2] == 0x33))) {
            // As we don't control decodeAudioData, we cannot do fast transfers and must copy
            let backup = buffer.slice(0);
            let result = await this.context.decodeAudioData(buffer);

            // restore copied buffer
            section.sound = backup;
            this.applyGain(result);
            return result;
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
                    section.sound = decoded.arrayBuffer;
                    if(decoded.error) {
                        reject(new Error(decoded.error));
                        return;
                    }
                    // Convert to real audio buffer
                    let audio = this.audioBufFromRaw(decoded.rawAudio);
                    this.applyGain(audio);
                    resolve(audio);
                }, false);

                // transfer the buffer to save time
                // don't really know why TS forgets we did a null check already
                audioWorker.postMessage({buffer: buffer!, ogg: this.oggSupport, mp3:this.mp3IsSane}, [buffer!]);
            });
       }

    }

    // Converts continuous PCM array to Web Audio API friendly format
    audioBufFromRaw(raw: {array: Float32Array, channels: number, sampleRate: number}): AudioBuffer {
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

    // find rough ReplayGain volume to normalise song audio
    // from https://github.com/est31/js-audio-normalizer
    applyGain(data: AudioBuffer) {
        let buffer = data.getChannelData(0);
        var sliceLen = Math.floor(data.sampleRate * 0.05);
        var averages = [];
        var sum = 0.0;
        for (var i = 0; i < buffer.length; i++) {
            sum += Math.pow(buffer[i], 2);
            if (i % sliceLen === 0) {
                sum = Math.sqrt(sum / sliceLen);
                averages.push(sum);
                sum = 0;
            }
        }
        // Ascending sort of the averages array
        averages.sort(function(a, b) { return a - b; });
        // Take the average at the 95th percentile
        var a = averages[Math.floor(averages.length * 0.95)];

        var gain = 1.0 / a;
        // Perform some clamping
        gain = Math.max(gain, 0.02);
        gain = Math.min(gain, 100.0);

        // ReplayGain uses pink noise for this one one but we just take
        // some arbitrary value... we're no standard
        // Important is only that we don't output on levels
        // too different from other websites
        data.replayGain = gain / 4.0;
    }

    createWorker() {
        return new Worker(this.core.settings.workersPath + 'audio-worker.js');
    }

    initVisualiser(bars?: number) {
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
            this.splitter = undefined;
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
        let channels = this.loop.source!.channelCount;
        // In case channel counts change, this is changed each time
        this.splitter = this.context.createChannelSplitter(channels);
        // Connect to the gainNode so we get buildup stuff too
        this.loop.source!.connect(this.splitter);
        if(this.build.source) {
            this.build.source.connect(this.splitter);
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
        let binWidth = this.loop.source!.buffer!.sampleRate / binCount;
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

    sumArray(array: Uint8Array, low: number, high: number) {
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

    setMute(mute: boolean) {
        if(!this.mute && mute) { // muting
            this.lastVol = this.gainNode.gain.value;
        }
        let newVol;
        if(mute) {
            newVol = 0;
        } else {
            newVol = this.lastVol;
        }
        this.gainNode.gain.setValueAtTime(newVol, this.context.currentTime);
        this.core.userInterface?.updateVolume(newVol);
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

    setVolume(vol: number) {
        this.gainNode.gain.setValueAtTime(vol, this.context.currentTime);
        this.lastVol = vol;
        this.core.userInterface?.updateVolume(vol);
    }

    fadeOut(callback: () => void) {
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

let miniMp3Raw =
"//tQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAACcQCAgICAgICA" +
"gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA////" +
"////////////////////////////////////////////////////////////" +
"//8AAAA5TEFNRTMuMTAwAaUAAAAAAAAAABRAJAa/QgAAQAAAAnFDELIBAAAA" +
"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7UMQAA8AAAaQAAAAgAAA0" +
"gAAABExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
"VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
"VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
"VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
"VVVVVVVVVVVVVVX/+1LEXYPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVV" +
"VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
"VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
"VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV" +
"VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==";

// write the bytes of the string to an ArrayBuffer
let miniOggBin = atob(miniOggRaw);
let miniOgg = new ArrayBuffer(miniOggBin.length);
let view = new Uint8Array(miniOgg);
for (let i = 0; i < miniOggBin.length; i++) {
    view[i] = miniOggBin.charCodeAt(i);
}

let miniMp3Bin = atob(miniMp3Raw);
let miniMp3 = new ArrayBuffer(miniMp3Bin.length);
let viewMp3 = new Uint8Array(miniMp3);
for (let i = 0; i < miniMp3Bin.length; i++) {
    viewMp3[i] = miniMp3Bin.charCodeAt(i);
}
