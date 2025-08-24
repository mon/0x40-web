import type { HuesCore } from "./HuesCore.svelte";
import type { HuesSong, HuesSongSection } from "./ResourcePack.svelte";
import EventListener from "./EventListener";
import type { CodecValue } from "codec-parser";
import type CodecParser from "codec-parser";
import type { MPEGDecodedAudio, MPEGDecoderWebWorker } from "mpg123-decoder";
import type {
  OggOpusDecodedAudio,
  OggOpusDecoderWebWorker,
} from "ogg-opus-decoder";
import type {
  OggVorbisDecodedAudio,
  OggVorbisDecoderWebWorker,
} from "@wasm-audio-decoders/ogg-vorbis";

let MPEGDecoderWebWorker_: typeof MPEGDecoderWebWorker | undefined;
let OggVorbisDecoderWebWorker_: typeof OggVorbisDecoderWebWorker | undefined;
let OggOpusDecoderWebWorker_: typeof OggOpusDecoderWebWorker | undefined;
let CodecParser_: typeof CodecParser | undefined;

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
  oggVorbisSupport: boolean;
  oggOpusSupport: boolean;
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
    super();

    this.core = core;
    this.playing = false;
    this.playbackRate = 1;

    this.locked = true;

    this.oggVorbisSupport = false;
    this.oggOpusSupport = false;
    this.mp3IsSane = false;
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

    // check for .ogg support - if not, we'll have to load the ogg decoder
    try {
      await this.context.decodeAudioData(miniOggVorbis);
      this.oggVorbisSupport = true;
    } catch (e) {
      this.oggVorbisSupport = false;
      OggVorbisDecoderWebWorker_ = (
        await import("@wasm-audio-decoders/ogg-vorbis")
      ).OggVorbisDecoderWebWorker;
      await new OggVorbisDecoderWebWorker_().ready;
    }
    try {
      await this.context.decodeAudioData(miniOggOpus);
      this.oggOpusSupport = true;
    } catch (e) {
      this.oggOpusSupport = false;
      OggOpusDecoderWebWorker_ = (await import("ogg-opus-decoder"))
        .OggOpusDecoderWebWorker;
      await new OggOpusDecoderWebWorker_().ready;
    }

    if (!this.oggVorbisSupport || !this.oggOpusSupport) {
      CodecParser_ = (await import("codec-parser")).default;
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
    } catch (e) {
      this.mp3IsSane = false;
    }

    if (!this.mp3IsSane) {
      MPEGDecoderWebWorker_ = (await import("mpg123-decoder"))
        .MPEGDecoderWebWorker;
      await new MPEGDecoderWebWorker_().ready;
    }

    console.log(
      `Native audio decoder support: vorbis:${this.oggVorbisSupport} opus:${this.oggOpusSupport} mp3:${this.mp3IsSane}`,
    );

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
    forcePlay: boolean = false,
  ): Promise<void> {
    let promise = this._playSong(song, playBuild, forcePlay);
    this.callEventListeners("songloading", promise, song);
    return promise;
  }

  private async _playSong(
    song: HuesSong,
    playBuild: boolean,
    forcePlay: boolean,
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
        "Song changed between load and play - this message can be ignored",
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
        this.context.currentTime - time / this.playbackRate,
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
        "Song changed between load and play - this message can be ignored",
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
        }),
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

    // Is this a file supported by the browser's importer?
    let view = new Uint8Array(buffer);

    let format: "ogg" | "mp3";

    if (
      // Signature for ogg file: OggS
      view[0] == 0x4f &&
      view[1] == 0x67 &&
      view[2] == 0x67 &&
      view[3] == 0x53
    ) {
      format = "ogg";
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
      format = "mp3";
    } else {
      throw Error("Cannot determine filetype");
    }

    const decodeNative = async () => {
      // As we don't control decodeAudioData, we cannot do fast transfers and must copy
      let backup = buffer.slice(0);
      let result = await this.context.decodeAudioData(buffer);

      // restore copied buffer
      section.sound = backup;
      this.applyGain(result);
      return result;
    };

    if (
      (format === "ogg" && this.oggVorbisSupport && this.oggOpusSupport) ||
      (format === "mp3" && this.mp3IsSane)
    ) {
      return await decodeNative();
    }

    // Use our JS decoder
    let decoded: OggOpusDecodedAudio | OggVorbisDecodedAudio | MPEGDecodedAudio;

    switch (format) {
      case "ogg":
        let codec: CodecValue | undefined = undefined;
        const parser = new CodecParser_!("audio/ogg", {
          onCodec: (c) => {
            codec = c;
          },
          enableFrameCRC32: false,
        });
        parser.parseChunk(view).next();
        if (codec === "opus") {
          if (this.oggOpusSupport) {
            return await decodeNative();
          }

          const decoder = new OggOpusDecoderWebWorker_!({ forceStereo: true });
          await decoder.ready;
          decoded = await decoder.decodeFile(view);
        } else if (codec === "vorbis") {
          if (this.oggVorbisSupport) {
            return await decodeNative();
          }

          const decoder = new OggVorbisDecoderWebWorker_!();
          await decoder.ready;
          decoded = await decoder.decodeFile(view);
        } else if (codec === undefined) {
          throw Error("Cannot determine OGG codec");
        } else {
          throw Error(`Unsupported OGG codec ${codec}`);
        }
        break;
      case "mp3":
        const decoder = new MPEGDecoderWebWorker_!({ enableGapless: true });
        await decoder.ready;
        decoded = await decoder.decode(view);
        break;
    }

    let audio = this.audioBufFromRaw(decoded);
    this.applyGain(audio);
    return audio;
  }

  // Converts continuous PCM array to Web Audio API friendly format
  audioBufFromRaw(
    raw: OggOpusDecodedAudio | OggVorbisDecodedAudio | MPEGDecodedAudio,
  ): AudioBuffer {
    let audioBuf = this.context.createBuffer(
      raw.channelData.length,
      raw.samplesDecoded,
      raw.sampleRate,
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
          this.binCutoffs[cutoff],
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
        this.context.currentTime + 2,
      );
    }
    setTimeout(callback, 2000);
  }
}

function decode(b64: string): ArrayBuffer {
  if (Uint8Array.fromBase64 !== undefined) {
    return Uint8Array.fromBase64(b64).buffer;
  }

  let miniBin = atob(b64);
  let miniArray = new ArrayBuffer(miniBin.length);
  let view = new Uint8Array(miniArray);
  for (let i = 0; i < miniBin.length; i++) {
    view[i] = miniBin.charCodeAt(i);
  }
  return miniArray;
}

const miniOggVorbis = decode(
  "T2dnUwACAAAAAAAAAABMYRrMAAAAAFjJMFABHgF2b3JiaXMAAAAAAUAfAAAAAAAAgFcAAAAAAACZAU9n" +
    "Z1MAAAAAAAAAAAAATGEazAEAAABJ+vLoC0H///////////+1A3ZvcmJpcw0AAABMYXZmNTguNzYuMTAw" +
    "AQAAACAAAABlbmNvZGVyPUxhdmM1OC4xMzQuMTAwIGxpYnZvcmJpcwEFdm9yYmlzEkJDVgEAAAEADFIU" +
    "ISUZU0pjCJVSUikFHWNQW0cdY9Q5RiFkEFOISRmle08qlVhKyBFSWClFHVNMU0mVUpYpRR1jFFNIIVPW" +
    "MWWhcxRLhkkJJWxNrnQWS+iZY5YxRh1jzlpKnWPWMUUdY1JSSaFzGDpmJWQUOkbF6GJ8MDqVokIovsfe" +
    "UukthYpbir3XGlPrLYQYS2nBCGFz7bXV3EpqxRhjjDHGxeJTKILQkFUAAAEAAEAEAUJDVgEACgAAwlAM" +
    "RVGA0JBVAEAGAIAAFEVxFMdxHEeSJMsCQkNWAQBAAAACAAAojuEokiNJkmRZlmVZlqZ5lqi5qi/7ri7r" +
    "ru3qug6EhqwEAMgAABiGIYfeScyQU5BJJilVzDkIofUOOeUUZNJSxphijFHOkFMMMQUxhtAphRDUTjml" +
    "DCIIQ0idZM4gSz3o4GLnOBAasiIAiAIAAIxBjCHGkHMMSgYhco5JyCBEzjkpnZRMSiittJZJCS2V1iLn" +
    "nJROSialtBZSy6SU1kIrBQAABDgAAARYCIWGrAgAogAAEIOQUkgpxJRiTjGHlFKOKceQUsw5xZhyjDHo" +
    "IFTMMcgchEgpxRhzTjnmIGQMKuYchAwyAQAAAQ4AAAEWQqEhKwKAOAEAgyRpmqVpomhpmih6pqiqoiiq" +
    "quV5pumZpqp6oqmqpqq6rqmqrmx5nml6pqiqnimqqqmqrmuqquuKqmrLpqvatumqtuzKsm67sqzbnqrK" +
    "tqm6sm6qrm27smzrrizbuuR5quqZput6pum6quvasuq6su2ZpuuKqivbpuvKsuvKtq3Ksq5rpum6oqva" +
    "rqm6su3Krm27sqz7puvqturKuq7Ksu7btq77sq0Lu+i6tq7Krq6rsqzrsi3rtmzbQsnzVNUzTdf1TNN1" +
    "Vde1bdV1bVszTdc1XVeWRdV1ZdWVdV11ZVv3TNN1TVeVZdNVZVmVZd12ZVeXRde1bVWWfV11ZV+Xbd33" +
    "ZVnXfdN1dVuVZdtXZVn3ZV33hVm3fd1TVVs3XVfXTdfVfVvXfWG2bd8XXVfXVdnWhVWWdd/WfWWYdZ0w" +
    "uq6uq7bs66os676u68Yw67owrLpt/K6tC8Or68ax676u3L6Patu+8Oq2Mby6bhy7sBu/7fvGsamqbZuu" +
    "q+umK+u6bOu+b+u6cYyuq+uqLPu66sq+b+u68Ou+Lwyj6+q6Ksu6sNqyr8u6Lgy7rhvDatvC7tq6cMyy" +
    "Lgy37yvHrwtD1baF4dV1o6vbxm8Lw9I3dr4AAIABBwCAABPKQKEhKwKAOAEABiEIFWMQKsYghBBSCiGk" +
    "VDEGIWMOSsYclBBKSSGU0irGIGSOScgckxBKaKmU0EoopaVQSkuhlNZSai2m1FoMobQUSmmtlNJaaim2" +
    "1FJsFWMQMuekZI5JKKW0VkppKXNMSsagpA5CKqWk0kpJrWXOScmgo9I5SKmk0lJJqbVQSmuhlNZKSrGl" +
    "0kptrcUaSmktpNJaSam11FJtrbVaI8YgZIxByZyTUkpJqZTSWuaclA46KpmDkkopqZWSUqyYk9JBKCWD" +
    "jEpJpbWSSiuhlNZKSrGFUlprrdWYUks1lJJaSanFUEprrbUaUys1hVBSC6W0FkpprbVWa2ottlBCa6Gk" +
    "FksqMbUWY22txRhKaa2kElspqcUWW42ttVhTSzWWkmJsrdXYSi051lprSi3W0lKMrbWYW0y5xVhrDSW0" +
    "FkpprZTSWkqtxdZaraGU1koqsZWSWmyt1dhajDWU0mIpKbWQSmyttVhbbDWmlmJssdVYUosxxlhzS7XV" +
    "lFqLrbVYSys1xhhrbjXlUgAAwIADAECACWWg0JCVAEAUAABgDGOMQWgUcsw5KY1SzjknJXMOQggpZc5B" +
    "CCGlzjkIpbTUOQehlJRCKSmlFFsoJaXWWiwAAKDAAQAgwAZNicUBCg1ZCQBEAQAgxijFGITGIKUYg9AY" +
    "oxRjECqlGHMOQqUUY85ByBhzzkEpGWPOQSclhBBCKaWEEEIopZQCAAAKHAAAAmzQlFgcoNCQFQFAFAAA" +
    "YAxiDDGGIHRSOikRhExKJ6WREloLKWWWSoolxsxaia3E2EgJrYXWMmslxtJiRq3EWGIqAADswAEA7MBC" +
    "KDRkJQCQBwBAGKMUY845ZxBizDkIITQIMeYchBAqxpxzDkIIFWPOOQchhM455yCEEELnnHMQQgihgxBC" +
    "CKWU0kEIIYRSSukghBBCKaV0EEIIoZRSCgAAKnAAAAiwUWRzgpGgQkNWAgB5AACAMUo5JyWlRinGIKQU" +
    "W6MUYxBSaq1iDEJKrcVYMQYhpdZi7CCk1FqMtXYQUmotxlpDSq3FWGvOIaXWYqw119RajLXm3HtqLcZa" +
    "c865AADcBQcAsAMbRTYnGAkqNGQlAJAHAEAgpBRjjDmHlGKMMeecQ0oxxphzzinGGHPOOecUY4w555xz" +
    "jDHnnHPOOcaYc84555xzzjnnoIOQOeecc9BB6JxzzjkIIXTOOecchBAKAAAqcAAACLBRZHOCkaBCQ1YC" +
    "AOEAAIAxlFJKKaWUUkqoo5RSSimllFICIaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkop" +
    "pZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkop" +
    "pZRSSimllFJKKZVSSimllFJKKaWUUkoppQAg3woHAP8HG2dYSTorHA0uNGQlABAOAAAYwxiEjDknJaWG" +
    "MQildE5KSSU1jEEopXMSUkopg9BaaqWk0lJKGYSUYgshlZRaCqW0VmspqbWUUigpxRpLSqml1jLnJKSS" +
    "Wkuttpg5B6Wk1lpqrcUQQkqxtdZSa7F1UlJJrbXWWm0tpJRaay3G1mJsJaWWWmupxdZaTKm1FltLLcbW" +
    "YkutxdhiizHGGgsA4G5wAIBIsHGGlaSzwtHgQkNWAgAhAQAEMko555yDEEIIIVKKMeeggxBCCCFESjHm" +
    "nIMQQgghhIwx5yCEEEIIoZSQMeYchBBCCCGEUjrnIIRQSgmllFJK5xyEEEIIpZRSSgkhhBBCKKWUUkop" +
    "IYQQSimllFJKKSWEEEIopZRSSimlhBBCKKWUUkoppZQQQiillFJKKaWUEkIIoZRSSimllFJCCKWUUkop" +
    "pZRSSighhFJKKaWUUkoJJZRSSimllFJKKSGUUkoppZRSSimlAACAAwcAgAAj6CSjyiJsNOHCAxAAAAAC" +
    "AAJMAIEBgoJRCAKEEQgAAAAAAAgA+AAASAqAiIho5gwOEBIUFhgaHB4gIiQAAAAAAAAAAAAAAAAET2dn" +
    "UwAEAQAAAAAAAABMYRrMAgAAAH5MZkgCAQEAAA==",
);

const miniOggOpus = decode(
  "T2dnUwACAAAAAAAAAABVV2vLAAAAANdbyfEBE09wdXNIZWFkAQE4AYC7AAAAAABPZ2dTAAAAAAAAAAAA" +
    "AFVXa8sBAAAAvO1WzAE/T3B1c1RhZ3MNAAAATGF2ZjU4Ljc2LjEwMAEAAAAeAAAAZW5jb2Rlcj1MYXZj" +
    "NTguMTM0LjEwMCBsaWJvcHVzT2dnUwAEOQEAAAAAAABVV2vLAgAAAP8Zh7EBBwgL5jsjq2A=",
);

const miniMp3 = decode(
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
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==",
);
