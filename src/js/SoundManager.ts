import type { HuesCore } from "./HuesCore";
import type { HuesSong, HuesSongSection } from "./ResourcePack";
import EventListener from "./EventListener";
import CodecParser, { type CodecValue } from "codec-parser";
import { type MPEGDecodedAudio, MPEGDecoderWebWorker } from "mpg123-decoder";
import {
  type OggOpusDecodedAudio,
  OggOpusDecoderWebWorker,
} from "ogg-opus-decoder";
import {
  type OggVorbisDecodedAudio,
  OggVorbisDecoderWebWorker,
} from "@wasm-audio-decoders/ogg-vorbis";

type SoundCallbacks = {
  // Called when the audio has been seeked - reset time determined transforms
  seek: () => void;

  // Called when someone requests a new song to be played - used when
  // you want to do something with the finished AudioBuffers, like
  // display length, or display a waveform.
  songloading: (promise: Promise<void>, song: HuesSong) => void;
};

type SongBuffer = {
  source?: AudioBufferSourceNode;
  buffer?: AudioBuffer;
  length: number; // For calculating beat lengths
};

// just for songLoad
type AudioBuffers = { loop?: AudioBuffer; buildup?: AudioBuffer };

declare global {
  // the most logical place to store these
  interface AudioBuffer {
    replayGain?: number;
  }
}

interface SoundManagerSong extends HuesSong {
  _loadPromise?: Promise<AudioBuffers>;
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
    super();

    this.core = core;
    this.playing = false;
    this.playbackRate = 1;

    this.locked = true;

    this.build = { length: 0 };
    this.loop = { length: 0 };
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
    if (!this.initPromise) {
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
    } catch (e) {
      throw Error("Web Audio API not supported in this browser.");
    }

      // ensure decoders work
    await new MPEGDecoderWebWorker().ready;
    await new OggOpusDecoderWebWorker().ready;
    await new OggVorbisDecoderWebWorker().ready;

    this.locked = this.context.state != "running";
  }

  unlock() {
    if (this.lockedPromise) {
      return this.lockedPromise;
    }
    this.lockedPromise = new Promise((resolve, reject) => {
      // iOS and other some mobile browsers - unlock the context as
      // it starts in a suspended state
      let unlocker = () => {
        // create empty buffer
        let buffer = this.context.createBuffer(1, 1, 22050);
        let source = this.context.createBufferSource();
        source.buffer = buffer;

        // connect to output (your speakers)
        source.connect(this.context.destination);

        // play the file
        source.start(0);

        window.removeEventListener("touchend", unlocker);
        window.removeEventListener("click", unlocker);
        this.core.clearMessage();
        resolve();
      };
      window.addEventListener("touchend", unlocker, false);
      window.addEventListener("click", unlocker, false);
    });
    return this.lockedPromise;
  }

  playSong(
    song: HuesSong,
    playBuild: boolean,
    forcePlay: boolean = false
  ): Promise<void> {
    let promise = this._playSong(song, playBuild, forcePlay);
    this.callEventListeners("songloading", promise, song);
    return promise;
  }

  private async _playSong(
    song: HuesSong,
    playBuild: boolean,
    forcePlay: boolean
  ) {
    // Editor forces play on audio updates
    if (this.song == song && !forcePlay) {
      return;
    }
    this.stop();
    this.song = song;
    if (!song || !song.loop.sound) {
      // null song
      return;
    }

    // if there's a fadeout happening from AutoSong, kill it
    this.gainNode.gain.cancelScheduledValues(0);
    // Reset original volume
    this.setVolume(this.lastVol);
    if (this.mute) {
      this.setMute(true);
    }

    let buffers = await this.loadSong(song);
    // To prevent race condition if you press "next" twice fast
    if (song != this.song) {
      throw Error(
        "Song changed between load and play - this message can be ignored"
      );
    }

    this.build.buffer = buffers.buildup;
    this.build.length = this.build.buffer ? this.build.buffer.duration : 0;
    this.loop.buffer = buffers.loop;
    this.loop.length = this.loop.buffer!.duration;

    // This fixes sync issues on Firefox and slow machines.
    await this.context.suspend();

    if (playBuild) {
      this.seek(-this.build.length, true);
    } else {
      this.seek(0, true);
    }

    await this.context.resume();

    this.playing = true;
  }

  stop(dontDeleteBuffers?: boolean) {
    if (this.playing) {
      if (this.build.source) {
        this.build.source.stop(0);
        this.build.source.disconnect();
        this.build.source = undefined;
        if (!dontDeleteBuffers) this.build.buffer = undefined;
      }
      // arg required for mobile webkit
      this.loop.source!.stop(0);
      // TODO needed?
      this.loop.source!.disconnect();
      this.loop.source = undefined;
      if (!dontDeleteBuffers) this.loop.buffer = undefined;
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
    if (!this.song) {
      return;
    }

    this.callEventListeners("seek");

    //console.log("Seeking to " + time);
    // Clamp the blighter
    time = Math.min(Math.max(time, -this.build.length), this.loop.length);

    this.stop(true);

    if (!this.loop.buffer) {
      return;
    }

    this.loop.source = this.context.createBufferSource();
    this.loop.source.buffer = this.loop.buffer;
    this.loop.source.playbackRate.value = this.playbackRate;
    this.loop.source.loop = true;
    this.loop.source.loopStart = 0;
    this.loop.source.loopEnd = this.loop.length;
    this.loop.source.connect(this.replayGainNode!);

    if (time < 0 && this.build.buffer) {
      this.build.source = this.context.createBufferSource();
      this.build.source.buffer = this.build.buffer;
      this.build.source.playbackRate.value = this.playbackRate;
      this.build.source.connect(this.replayGainNode!);
      this.build.source.start(0, this.build.length + time);
      this.loop.source.start(
        this.context.currentTime - time / this.playbackRate
      );
    } else {
      this.loop.source.start(0, time);
    }

    let gain = this.loop.buffer.replayGain;
    if (this.build.buffer) {
      gain = Math.min(gain!, this.build.buffer.replayGain!);
    }
    this.replayGainNode.gain.setValueAtTime(gain!, this.context.currentTime);

    this.startTime = this.context.currentTime - time / this.playbackRate;
    if (!noPlayingUpdate) {
      this.playing = true;
    }
    this.initVisualiser();
    this.core.recalcBeatIndex();
  }

  // In seconds, relative to the loop start
  get currentTime() {
    if (!this.playing) {
      return 0;
    }
    return (this.context.currentTime - this.startTime) * this.playbackRate;
  }

  get clampedTime() {
    let time = this.currentTime;

    if (time > 0) {
      time %= this.loop.length;
    }
    return time;
  }

  loadSong(song: SoundManagerSong): Promise<AudioBuffers> {
    if (song._loadPromise) {
      /* Caused when moving back/forwards rapidly.
               The sound is still loading. We reject this promise, and the already
               running decode will finish and resolve instead.
               NOTE: If anything but playSong calls loadSong, this idea is broken. */
      return Promise.reject(
        "Song changed between load and play - this message can be ignored"
      );
    }

    let buffers: AudioBuffers = {};

    let promises = [
      this.loadBuffer(song.loop).then((buffer) => {
        buffers.loop = buffer;
      }),
    ];
    if (song.build?.sound) {
      promises.push(
        this.loadBuffer(song.build).then((buffer) => {
          buffers.buildup = buffer;
        })
      );
    } else {
      this.build.length = 0;
    }
    song._loadPromise = Promise.all(promises).then(() => {
      song._loadPromise = undefined;
      return buffers;
    });
    return song._loadPromise;
  }

  async loadBuffer(section: HuesSongSection): Promise<AudioBuffer> {
    let buffer = section.sound;

    if (!buffer) {
      throw Error("Section has no buffer: " + section);
    }

    let decoded: OggOpusDecodedAudio | OggVorbisDecodedAudio | MPEGDecodedAudio;

    // Is this a file supported by the browser's importer?
    let view = new Uint8Array(buffer);
    if (
      // Signature for ogg file: OggS
      view[0] == 0x4f &&
      view[1] == 0x67 &&
      view[2] == 0x67 &&
      view[3] == 0x53
    ) {
      let codec: CodecValue | undefined = undefined;
      const parser = new CodecParser("audio/ogg", {
        onCodec: (c) => {
          codec = c;
        },
        enableFrameCRC32: false,
      });
      parser.parseChunk(view).next();
      if (codec === "opus") {
        const decoder  = new OggOpusDecoderWebWorker({ forceStereo: true });
        await decoder.ready;
        decoded = await decoder.decodeFile(view);
      } else if (codec === "vorbis") {
        const decoder = new OggVorbisDecoderWebWorker();
        await decoder.ready;
        decoded = await decoder.decodeFile(view);
      } else if (codec === undefined) {
        throw Error("Cannot determine OGG codec");
      } else {
        throw Error(`Unsupported OGG codec ${codec}`);
      }
    } else if (
      // untagged MP3
      (view[0] == 0xff &&
        (view[1] == 0xfb ||
          view[1] == 0xfa ||
          view[1] == 0xf2 ||
          view[1] == 0xf3)) ||
      // ID3v2 tagged MP3 "ID3"
      (view[0] == 0x49 && view[1] == 0x44 && view[2] == 0x33)
    ) {
      const decoder = new MPEGDecoderWebWorker({ enableGapless: true });
      await decoder.ready;
      decoded = await decoder.decode(view);
    } else {
      throw Error("Cannot determine filetype");
    }

    let audio = this.audioBufFromRaw(decoded);
    this.applyGain(audio);
    return audio;
  }

  // Converts continuous PCM array to Web Audio API friendly format
  audioBufFromRaw(
    raw: OggOpusDecodedAudio | OggVorbisDecodedAudio | MPEGDecodedAudio
  ): AudioBuffer {
    let audioBuf = this.context.createBuffer(
      raw.channelData.length,
      raw.samplesDecoded,
      raw.sampleRate
    );
    for (const [i, channel] of raw.channelData.entries()) {
      // Most browsers
      if (typeof audioBuf.copyToChannel === "function") {
        audioBuf.copyToChannel(channel, i, 0);
      } else {
        // Safari, Edge sometimes
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
    averages.sort(function (a, b) {
      return a - b;
    });
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

  initVisualiser(bars?: number) {
    // When restarting the visualiser
    if (!bars) {
      bars = this.vTotalBars;
    }
    this.vReady = false;
    this.vTotalBars = bars;
    for (let i = 0; i < this.analysers.length; i++) {
      this.analysers[i].disconnect();
    }
    if (this.splitter) {
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
    if (!this.playing || this.vReady) {
      return;
    }

    // Get our info from the loop
    let channels = this.loop.source!.channelCount;
    // In case channel counts change, this is changed each time
    this.splitter = this.context.createChannelSplitter(channels);
    // Connect to the gainNode so we get buildup stuff too
    this.loop.source!.connect(this.splitter);
    if (this.build.source) {
      this.build.source.connect(this.splitter);
    }
    // Split display up into each channel
    this.vBars = Math.floor(this.vTotalBars / channels);

    for (let i = 0; i < channels; i++) {
      let analyser = this.context.createAnalyser();
      // big fft buffers are new-ish
      try {
        analyser.fftSize = 8192;
      } catch (err) {
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
    this.maxBinLin = Math.floor(2000 / binWidth);
    // Don't stretch the first 2kHz, it looks awful
    this.linBins = Math.min(this.maxBinLin, Math.floor(this.vBars / 2));
    // Only go up to 22KHz
    let maxBinLog = Math.floor(22000 / binWidth);
    let logBins = this.vBars - this.linBins;

    let logLow = Math.log2(2000);
    let logDiff = Math.log2(22000) - logLow;
    for (let i = 0; i < logBins; i++) {
      let cutoff = i * (logDiff / logBins) + logLow;
      let freqCutoff = Math.pow(2, cutoff);
      let binCutoff = Math.floor(freqCutoff / binWidth);
      this.binCutoffs.push(binCutoff);
    }
    this.vReady = true;
  }

  sumArray(array: Uint8Array, low: number, high: number) {
    let total = 0;
    for (let i = low; i <= high; i++) {
      total += array[i];
    }
    return total / (high - low + 1);
  }

  getVisualiserData() {
    if (!this.vReady) {
      return null;
    }
    for (let a = 0; a < this.analyserArrays.length; a++) {
      let data = this.analyserArrays[a];
      let result = this.logArrays[a];
      this.analysers[a].getByteFrequencyData(data);

      for (let i = 0; i < this.linBins; i++) {
        let scaled = Math.round((i * this.maxBinLin) / this.linBins);
        result[i] = data[scaled];
      }
      result[this.linBins] = data[this.binCutoffs[0]];
      for (let i = this.linBins + 1; i < this.vBars; i++) {
        let cutoff = i - this.linBins;
        result[i] = this.sumArray(
          data,
          this.binCutoffs[cutoff - 1],
          this.binCutoffs[cutoff]
        );
      }
    }
    return this.logArrays;
  }

  setMute(mute: boolean) {
    if (!this.mute && mute) {
      // muting
      this.lastVol = this.gainNode.gain.value;
    }
    let newVol;
    if (mute) {
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
    if (!this.mute) {
      // Firefox hackery
      this.gainNode.gain.setValueAtTime(this.lastVol, this.context.currentTime);
      this.gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.context.currentTime + 2
      );
    }
    setTimeout(callback, 2000);
  }
}
