import HuesRender from "./HuesRender";
import { HuesEditor } from "./HuesEditor.svelte";
import {
  makeSettings,
  type SettingsData,
  initUI as initSettingsUI,
  type SettingsDataWithUpdate,
} from "./HuesSettings.svelte";
import HuesWindow from "./HuesWindow";
import {
  HuesUI,
  RetroUI,
  WeedUI,
  ModernUI,
  XmasUI,
  HalloweenUI,
  MinimalUI,
} from "./HuesUI";
import Resources from "./ResourceManager";
import SoundManager from "./SoundManager";
import { HuesImage, HuesSong } from "./ResourcePack";
import EventListener from "./EventListener";
import HuesInfo from "./HuesInfo.svelte";

import "string_score";

import { mount } from "svelte";

export type HuesColour = {
  c: number; // colour in hex
  n: string; // name
};

type CoreEvents = {
  // When everything has completely loaded and we're ready to go
  loaded: () => void;

  // When the song time is updated - negative for buildup
  time: (seconds: number) => void;

  // The current blur amounts, in percent of full blur
  blurupdate: (xPercent: number, yPercent: number) => void;

  // Called on song change, whether user triggered or autosong.
  newsong: (song: HuesSong) => void;

  // Called on image change, whether user triggered or FULL AUTO mode.
  newimage: (image: HuesImage) => void;

  // Called on colour change.
  // colour: colour object.
  // isFade: if the colour is fading from the previous value
  newcolour: (colour: HuesColour, isFade: boolean) => void;

  // Called on mode change. (full auto or locked to one image)
  newmode: (mode: boolean) => void;

  // Called on every non-blank beat character. If multiple banks are being
  //   used, this may be called several times per frame.
  // For custom hooks: You can optionally return `true` to stop HuesCore from
  //   processing this beat.
  // beat is the new beat
  // beatIndex is the beat index. Negative during buildups
  // bank is the bank this beat is from
  beat: (beat: string, beatIndex: number, bank: number) => boolean | undefined;

  // Called on every beat.
  // beatString is a 256 char long string of current and upcoming beat chars
  // - if banks are being used, and many characters fall on the same beat, the
  //   beat at a given index will be the closest normal beat character that
  //   has the effects being used.
  // beatIndex is the beat index. Negative during buildups
  beatstring: (beatString: string, beatIndex: number) => void;

  // Called on each new frame, at the end of all other frame processing
  frame: () => void;

  // Called when the song actually begins to play, not just when the new song
  // processing begins.
  songstarted: (song: HuesSong) => void;

  // Called when settings are updated and should be re-read from the settings object
  settingsupdated: () => void;
};

export enum Effect {
  StopAll,
  BlurX,
  BlurY,
  TrippyIn,
  TrippyOut,
  Blackout,
  Whiteout,
  ShortBlackout,
  ShortWhiteout,
  FadeOutBlackout,
  FadeOutWhiteout,
  FadeInBlackout,
  FadeInWhiteout,
  InstantBlackout,
  InstantWhiteout,
  RandomColour,
  ColourFade,
  RandomImage,
  SliceX,
  SliceY,
  ShutterUp,
  ShutterDown,
  ShutterLeft,
  ShutterRight,
  InvertToggle,
  InvertFade,
}

// since it's used in so many effects
export const ImageColour = [Effect.RandomColour, Effect.RandomImage];

// prettier-ignore
export const BeatTypes = {
  "_": [] as Effect[],
  // has to be after _ or it doesn't get picked for the beat string compression
  ".": [] as Effect[],
  "¯": [Effect.StopAll],
  "X": [Effect.BlurY],
  "x": [Effect.BlurY, ...ImageColour],
  "O": [Effect.BlurX],
  "o": [Effect.BlurX, ...ImageColour],
  "-": [...ImageColour],
  "+": [Effect.Blackout, Effect.BlurX],
  "¤": [Effect.Whiteout, Effect.BlurX],
  "|": [Effect.ShortBlackout, ...ImageColour],
  "!": [Effect.ShortWhiteout, ...ImageColour],
  "┊": [Effect.InstantBlackout],
  "¡": [Effect.InstantWhiteout],
  "▼": [Effect.FadeOutBlackout],
  "▽": [Effect.FadeOutWhiteout],
  "▲": [Effect.FadeInBlackout],
  "△": [Effect.FadeInWhiteout],
  ":": [Effect.RandomColour],
  "*": [Effect.RandomImage],
  ")": [Effect.TrippyIn, Effect.BlurX, ...ImageColour],
  "(": [Effect.TrippyOut, Effect.BlurY, ...ImageColour],
  ">": [Effect.TrippyIn, Effect.RandomColour],
  "<": [Effect.TrippyOut, Effect.RandomColour],
  "~": [Effect.ColourFade],
  "=": [Effect.ColourFade, Effect.RandomImage],
  "i": [Effect.InvertToggle],
  "I": [Effect.InvertToggle, ...ImageColour],
  "ı": [Effect.InvertFade],
  "s": [Effect.SliceX],
  "S": [Effect.SliceX, ...ImageColour],
  "v": [Effect.SliceY],
  "V": [Effect.SliceY, ...ImageColour],
  "#": [Effect.SliceX, Effect.SliceY],
  "@": [Effect.SliceX, Effect.SliceY, ...ImageColour],
  "←": [Effect.ShutterLeft, ...ImageColour],
  "↓": [Effect.ShutterDown, ...ImageColour],
  "↑": [Effect.ShutterUp, ...ImageColour],
  "→": [Effect.ShutterRight, ...ImageColour],
};

export class HuesCore extends EventListener<CoreEvents> {
  version: number;
  versionStr: string;
  versionHex: string;
  beatIndex: number;

  buildLength: number;
  loopLength: number;

  currentSong: HuesSong | null;
  currentImage: HuesImage | null;
  songIndex: number;
  imageIndex: number;
  lastSongArray: number[];
  lastImageArray: number[];

  colourIndex: number;
  colours: HuesColour[];
  oldColours: HuesColour[];
  weedColours: HuesColour[];
  pastelColours: HuesColour[];

  autoSong: SettingsData["autoSong"];
  loopCount: number;
  doBuildup: boolean;
  uiArray: HuesUI[];
  userInterface?: HuesUI; // the current UI

  settings: SettingsDataWithUpdate;
  root: HTMLElement;

  window: HuesWindow;
  soundManager: SoundManager;
  resourceManager: Resources;
  editor: HuesEditor;
  renderer!: HuesRender;

  preloader!: HTMLDivElement;
  preloadMsg!: HTMLDivElement;
  preloadSubMsg!: HTMLDivElement;
  visualiser: HTMLCanvasElement;
  // if this fails to init, everything will break anyway
  vCtx!: CanvasRenderingContext2D;

  constructor(defaults: Partial<SettingsData>) {
    super();

    // Bunch-o-initialisers

    // provided by vite, x.y
    this.versionStr = VERSION;
    this.version = parseInt(VERSION.replace(".", ""));
    this.versionHex = this.version.toString(16);
    this.beatIndex = 0;

    // How long a beat lasts for in each section
    this.buildLength = -1;
    this.loopLength = -1;

    this.currentSong = null;
    this.currentImage = null;
    this.songIndex = -1;
    this.imageIndex = -1;
    this.lastSongArray = [];
    this.lastImageArray = [];

    // cleaner then putting the arrays here
    this.oldColours = oldColours;
    this.weedColours = weedColours;
    this.pastelColours = pastelColours;

    this.colourIndex = 0x3f;
    this.colours = this.oldColours;

    this.loopCount = 0;
    this.doBuildup = true;
    this.uiArray = [];

    this.settings = makeSettings(defaults);

    // What's our root element?
    if (!this.settings.root) {
      this.root = document.body;
    } else if (typeof this.settings.root === "string") {
      let tryRoot = document.getElementById(this.settings.root);
      if (tryRoot) {
        this.root = tryRoot;
      } else {
        this.root = document.body;
      }
    } else {
      // been given an element
      this.root = this.settings.root;
    }
    this.root.classList.add("hues-root");
    // Special case for full page Hues
    if (this.root === document.body) {
      document.documentElement.className = "hues-root";
    }
    // Yes, we do indeed have Javascript
    this.root.innerHTML = "";

    this.makePreloader(this.root);

    window.onerror = (msg, url, line, col, error) => {
      this.error(msg as string);
      // Get more info in console
      return false;
    };

    this.window = new HuesWindow(this.root, this.settings);

    console.log("0x40 Hues v" + this.versionStr + " - start your engines!");

    this.soundManager = new SoundManager(this, this.settings.volume);
    this.resourceManager = new Resources(this, this.window);
    this.editor = new HuesEditor(this, this.window);

    if (this.settings.enableWindow) {
      initSettingsUI(this.window, this.settings);

      let infoContents = this.window.addTab("INFO");
      mount(HuesInfo, {
        target: infoContents,
        props: {
          version: this.versionStr,
          huesName: this.settings.huesName,
          huesDesc: this.settings.huesDesc,
        },
      });

      this.window.selectTab(this.settings.firstWindow, true);
    }

    let ui = document.createElement("div");
    ui.className = "hues-ui";
    this.root.appendChild(ui);
    this.uiArray.push(
      new RetroUI(ui),
      new WeedUI(ui),
      new ModernUI(ui),
      new XmasUI(ui),
      new HalloweenUI(ui),
      new MinimalUI(ui),
    );

    this.autoSong = this.settings.autoSong;

    this.visualiser = document.createElement("canvas");
    this.visualiser.className = "hues-visualiser";
    this.visualiser.height = 64;
    this.vCtx = this.visualiser.getContext("2d")!;

    this.asyncInit();

    if (!this.settings.disableKeyboard) {
      document.addEventListener("keydown", (e) => {
        e = e || window.event;
        if (e.defaultPrevented) {
          return true;
        }

        let target = e.target as HTMLElement;
        // If we've focused a text input, let the input go through!
        if (
          target.tagName.toLowerCase() == "input" ||
          target.contentEditable === "true"
        ) {
          return true;
        }
        let key = e.key;
        // Special case for Alt+Enter fullscreen
        if (e.altKey && key == "Enter") {
          document.body.requestFullscreen();
        }
        // Ignore modifiers so we don't steal other events
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
          return true;
        }

        return this.keyHandler(key);
      });
    }
  }

  private async asyncInit() {
    try {
      await this.soundManager.init();
      if (this.soundManager.locked || this.settings.skipPreloader == "off") {
        let sizes = await this.resourceManager.getSizes(this.settings.respacks);

        let size: number | string | null = sizes.reduce((prev, curr) => {
          return typeof prev === "number" && typeof curr === "number"
            ? prev + curr
            : null;
        }, 0);
        if (typeof size === "number") {
          size = size.toFixed(1);
        } else {
          size =
            '<abbr title="Content-Length header not present for respack URLs">???</abbr>';
        }

        let warning =
          size +
          "MB of music/images.<br />" +
          "Flashing lights.<br />" +
          "<b>Tap or click to start</b>";

        if (!this.soundManager.locked) {
          warning += "<br /><span>Skip this screen from Options</span>";
        }
        this.warning(warning);
        // Even if not locked, this steals clicks which is useful here
        await this.soundManager.unlock();
      }

      this.clearMessage();
      setInterval(this.loopCheck.bind(this), 1000);
      this.renderer = new HuesRender(this.root, this.soundManager, this);
      // rendering during the preloader causes slow loading on FF
      this.renderer.rendering = false;
      // Now all our objects are instantiated, we fire the updated settings
      this.settings.onupdate = () => {
        this.settingsUpdated();
      };
      this.settingsUpdated();
      this.setColour(this.colourIndex);
      this.animationLoop();

      if (this.settings.load) {
        await this.resourceManager.addAll(
          this.settings.respacks,
          (progress) => {
            this.preloader.style.backgroundPosition =
              100 - progress * 100 + "% 0%";
            let scale = Math.floor(progress * this.settings.preloadMax);
            let padding = this.settings.preloadMax.toString(
              this.settings.preloadBase,
            ).length;
            this.preloadMsg.textContent =
              this.settings.preloadPrefix +
              (
                Array(padding).join("0") +
                scale.toString(this.settings.preloadBase)
              ).slice(-padding);
          },
        );
      } else {
        this.preloader.style.display = "none";
      }

      this.renderer.rendering = true;
      this.preloader.classList.add("hues-preloader--loaded");
      this.callEventListeners("loaded");
      if (this.settings.firstImage) {
        this.setImageByName(this.settings.firstImage);
      } else {
        // keep things like the flash
        this.setImageByName("Airi Akizuki");
        // it will fallback to image index 0 if not present
        if (this.imageIndex === 0) {
          this.setImageByName("Megumi"); // alternate name
        }
      }
      if (this.settings.autoplay) {
        if (this.settings.firstSong) {
          this.setSongByName(this.settings.firstSong);
        } else {
          this.setSong(0);
        }
      }
    } catch (e) {
      this.error(e as string);
    }
  }

  makePreloader(root: HTMLElement) {
    this.preloader = document.createElement("div");
    this.preloader.className = "hues-preloader";
    root.appendChild(this.preloader);

    if (this.settings.preloadTitle) {
      let preloadTitle = document.createElement("div");
      preloadTitle.className = "hues-preloader__title";
      preloadTitle.textContent = this.settings.preloadTitle;
      this.preloader.appendChild(preloadTitle);
    }

    this.preloadMsg = document.createElement("div");
    this.preloadMsg.className = "hues-preloader__text";
    this.preloadMsg.textContent = "Initialising...";
    this.preloader.appendChild(this.preloadMsg);

    this.preloadSubMsg = document.createElement("div");
    this.preloadSubMsg.className = "hues-preloader__subtext";
    this.preloader.appendChild(this.preloadSubMsg);
  }

  resizeVisualiser() {
    this.soundManager.initVisualiser(this.visualiser.width / 2);
  }

  updateVisualiser() {
    if (this.settings.visualiser != "on") {
      return;
    }

    let logArrays = this.soundManager.getVisualiserData();
    if (!logArrays) {
      return;
    }

    this.vCtx.clearRect(0, 0, this.vCtx.canvas.width, this.vCtx.canvas.height);

    let gradient = this.vCtx.createLinearGradient(0, 64, 0, 0);
    // 8% to 100%
    const gVal = this.renderer.invert * 92;
    const gStart = 8 + gVal;
    const gEnd = 100 - gVal;
    gradient.addColorStop(0, `hsla(0, 0%, ${gStart}%, 0.6)`);
    gradient.addColorStop(1, `hsla(0, 0%, ${gEnd}%, 0.6)`);

    this.vCtx.fillStyle = gradient;

    let barWidth = 2;
    let barHeight;
    let x = 0;
    for (let a = 0; a < logArrays.length; a++) {
      let vals = logArrays[a];
      for (let i = 0; i < vals.length; i++) {
        let index = 0;
        if (logArrays.length == 2 && a === 0) {
          index = vals.length - i - 1;
        } else {
          index = i;
        }
        barHeight = vals[index] / 4;

        this.vCtx.fillRect(
          x,
          this.vCtx.canvas.height - barHeight,
          barWidth,
          barHeight,
        );

        x += barWidth;
      }
    }
  }

  animationLoop() {
    requestAnimationFrame(this.animationLoop.bind(this));
    if (!this.soundManager.playing || !this.currentSong) {
      this.callEventListeners("frame");
      return;
    }
    this.updateVisualiser();
    let now = this.soundManager.currentTime;
    this.callEventListeners("time", this.soundManager.clampedTime);
    if (now >= 0 && this.doBuildup) {
      this.currentSong.buildupPlayed = true;
    }
    for (
      let beatTime = this.beatIndex * this.getBeatLength();
      beatTime < now;
      beatTime = ++this.beatIndex * this.getBeatLength()
    ) {
      this.callEventListeners(
        "beatstring",
        this.getBeatString(),
        this.getBeatIndex(),
      );

      for (const [bank, beat] of this.getBeats(this.beatIndex).entries()) {
        this.beater(beat, bank);
      }
    }
    this.callEventListeners("frame");
  }

  recalcBeatIndex(forcedNow?: number) {
    let now =
      typeof forcedNow === "number" ? forcedNow : this.soundManager.currentTime;
    // getBeatLength isn't updated with the right beatIndex yet
    this.beatIndex = Math.floor(
      now / (now < 0 ? this.buildLength : this.loopLength),
    );
    // beatIndex is NaN, abort
    if (this.beatIndex != this.beatIndex || !this.currentSong) {
      this.renderer.setInvert(false);
      return;
    }

    // We should sync up to how many inverts there are
    let invertCount = 0;
    let rhythmInverts = 0;
    for (let bank = 0; bank < this.currentSong.bankCount; bank++) {
      const rhythm = this.currentSong.loop.banks[bank];
      const build = this.currentSong.build?.banks[bank];
      let mapSoFar;

      if (this.beatIndex < 0) {
        // Clamp to 0 in case we've juuust started
        mapSoFar = build!.slice(0, Math.max(this.beatIndex + build!.length, 0));
      } else {
        rhythmInverts += (rhythm.match(/i|I|ı/g) || []).length % 2;

        mapSoFar = (build ? build : "") + rhythm.slice(0, this.beatIndex);
      }

      invertCount += (mapSoFar.match(/i|I|ı/g) || []).length;
    }
    // If the rhythm has an odd number of inverts, don't reset because it
    // alternates on each loop anyway
    if (rhythmInverts % 2) {
      return;
    }
    // If there's an odd amount of inverts thus far, invert our display
    this.renderer.setInvert(invertCount % 2 === 1);
  }

  getBeatIndex() {
    if (!this.soundManager.playing || !this.currentSong) {
      return 0;
    } else if (this.beatIndex < 0) {
      return this.beatIndex;
    } else {
      return this.beatIndex % this.currentSong.loop.mapLen;
    }
  }

  getSafeBeatIndex() {
    let index = this.getBeatIndex();
    if (index < 0) {
      return 0;
    } else {
      return index;
    }
  }

  blurUpdated(x: number, y: number) {
    this.callEventListeners("blurupdate", x, y);
  }

  nextSong() {
    let index = (this.songIndex + 1) % this.resourceManager.enabledSongs.length;
    this.setSong(index);
  }

  previousSong() {
    let index =
      (this.songIndex - 1 + this.resourceManager.enabledSongs.length) %
      this.resourceManager.enabledSongs.length;
    this.setSong(index);
  }

  setSongByName(name: string) {
    let bestSong = 0;
    let bestScore = 0;
    for (const [i, song] of this.resourceManager.enabledSongs.entries()) {
      let score = song.title.score(name);
      if (score > bestScore) {
        bestScore = score;
        bestSong = i;
      }
    }
    return this.setSong(bestSong);
  }

  /* To set songs via reference instead of index - used in HuesEditor */
  setSongOject(song: HuesSong) {
    for (let i = 0; i < this.resourceManager.enabledSongs.length; i++) {
      if (this.resourceManager.enabledSongs[i] === song) {
        return this.setSong(i);
      }
    }
  }

  setSong(index: number, leaveArray: boolean = false) {
    if (this.currentSong == this.resourceManager.enabledSongs[index]) {
      return;
    }
    // When not randoming, clear this
    if (!leaveArray) {
      this.lastSongArray = [];
    }
    this.lastSongArray.push(index);
    this.songIndex = index;
    this.currentSong = this.resourceManager.enabledSongs[this.songIndex];
    if (this.currentSong === undefined) {
      this.currentSong = new HuesSong("None");
    }
    console.log("Next song:", this.songIndex, this.currentSong);
    this.callEventListeners("newsong", this.currentSong);
    this.loopCount = 0;
    if (this.currentSong.build?.sound) {
      switch (this.settings.playBuildups) {
        case "off":
          this.currentSong.buildupPlayed = true;
          this.doBuildup = false;
          break;
        case "on":
          this.currentSong.buildupPlayed = false;
          this.doBuildup = true;
          break;
        case "once":
          this.doBuildup = !this.currentSong.buildupPlayed;
          break;
      }
    }
    this.renderer.setInvert(false);
    this.renderer.doInstantBlackout(false, undefined);
    return this.soundManager
      .playSong(this.currentSong, this.doBuildup)
      .then(() => {
        this.resetAudio();
        this.fillBuildup();
        this.callEventListeners("songstarted", this.currentSong);
      });
  }

  updateBeatLength() {
    if (this.currentSong?.loop.sound) {
      this.loopLength =
        this.soundManager.loop.length / this.currentSong.loop.mapLen;
    } else {
      this.loopLength = -1;
    }

    if (this.currentSong?.build?.sound) {
      this.buildLength =
        this.soundManager.build.length / this.currentSong.build.mapLen;
    } else {
      this.buildLength = -1;
    }
  }

  getBeatLength() {
    if (this.beatIndex < 0) {
      return this.buildLength;
    } else {
      return this.loopLength;
    }
  }

  fillBuildup() {
    // update loop length for flash style filling
    this.updateBeatLength();
    if (this.currentSong?.build?.sound) {
      if (this.currentSong.independentBuild) {
        console.log("New behaviour - separate build/loop lengths");
        // Do nothing
      } else {
        console.log("Flash behaviour - filling buildup");
        let buildBeats = Math.floor(
          this.soundManager.build.length / this.loopLength,
        );
        if (buildBeats < 1) {
          buildBeats = 1;
        }
        console.log("Buildup length:", buildBeats);

        let builds = this.currentSong.build.banks;
        for (let bank = 0; bank < builds.length; bank++) {
          while (builds[bank].length < buildBeats) {
            builds[bank] += ".";
          }
        }
        this.currentSong.build.recalcBeatString();
        this.currentSong.build.checkConsistency();
      }
    }
    // update with a buildup of possibly different length
    this.updateBeatLength();
    // If we're in the build or loop this will adjust
    // If we've lagged a bit, we'll miss the first beat. Rewind!
    this.recalcBeatIndex(this.doBuildup ? -this.soundManager.build.length : 0);
  }

  randomSong() {
    let songCount = this.resourceManager.enabledSongs.length;
    let index = Math.floor(Math.random() * songCount);
    if (
      songCount > 1 &&
      (index == this.songIndex || this.lastSongArray.indexOf(index) != -1)
    ) {
      this.randomSong();
    } else {
      console.log("Randoming a song!");
      this.setSong(index, true);
      let noRepeat = Math.min(5, Math.floor(songCount / 2));
      while (this.lastSongArray.length > noRepeat && noRepeat >= 0) {
        this.lastSongArray.shift();
      }
    }
  }

  /* This is its own function because requestAnimationFrame is called very very
       rarely when the tab is backgrounded. As autoSong is often used to chill with
       music, it's important to keep checking the loop so songs don't go for too
       long. */
  loopCheck() {
    if (
      Math.floor(
        this.soundManager.currentTime / this.soundManager.loop.length,
      ) > this.loopCount
    ) {
      this.onLoop();
    }
  }

  onLoop() {
    this.loopCount++;
    switch (this.settings.autoSong) {
      case "loop":
        console.log("Checking loops");
        if (this.loopCount >= this.settings.autoSongDelay) {
          this.doAutoSong();
        }
        break;
      case "time":
        console.log("Checking times");
        if (
          this.soundManager.loop.length * this.loopCount >=
          this.settings.autoSongDelay * 60
        ) {
          this.doAutoSong();
        }
        break;
    }
  }

  doAutoSong() {
    if (this.resourceManager.enabledSongs.length < 2) {
      return; // don't move if there's nothing to move to
    }
    let func;
    if (this.settings.autoSongShuffle === "on") {
      func = () => this.randomSong();
    } else {
      func = () => this.nextSong();
    }
    if (this.settings.autoSongFadeout === "on") {
      this.soundManager.fadeOut(func);
    } else {
      func();
    }
  }

  songDataUpdated() {
    if (this.currentSong) {
      this.callEventListeners("newsong", this.currentSong);
      this.callEventListeners("newimage", this.currentImage);
    }
  }

  resetAudio() {
    this.beatIndex = 0;
    this.songDataUpdated();
    if (this.settings.visualiser == "on") {
      this.soundManager.initVisualiser(this.visualiser.width / 2);
    }
  }

  randomImage() {
    if (this.settings.shuffleImages == "on") {
      let len = this.resourceManager.enabledImages.length;
      let index = Math.floor(Math.random() * len);
      if (
        (index == this.imageIndex ||
          this.lastImageArray.indexOf(index) != -1) &&
        len > 1
      ) {
        this.randomImage();
      } else {
        this.setImage(index, true);
        this.lastImageArray.push(index);
        let cull = Math.min(20, Math.floor(len / 2));
        while (this.lastImageArray.length > cull && cull >= 0) {
          this.lastImageArray.shift();
        }
      }
    } else {
      // jk, not actually random
      let img =
        (this.imageIndex + 1) % this.resourceManager.enabledImages.length;
      this.setImage(img);
    }
  }

  setImage(index: number, leaveArray: boolean = false) {
    // If there are no images, this corrects NaN to 0
    this.imageIndex = index ? index : 0;
    let img = this.resourceManager.enabledImages[this.imageIndex];
    if (img == this.currentImage && img) {
      return;
    }
    // When not randoming, clear this
    if (!leaveArray) {
      this.lastImageArray = [];
    }
    if (img) {
      this.currentImage = img;
    } else {
      this.currentImage = new HuesImage();
      this.imageIndex = -1;
      this.lastImageArray = [];
    }
    this.callEventListeners("newimage", this.currentImage);
  }

  setImageByName(name: string) {
    let images = this.resourceManager.enabledImages;
    for (let i = 0; i < images.length; i++) {
      if (images[i].name == name || images[i].fullname == name) {
        this.setImage(i);
        return;
      }
    }
    this.setImage(0); // fallback
  }

  nextImage() {
    this.setIsFullAuto(false);
    let img = (this.imageIndex + 1) % this.resourceManager.enabledImages.length;
    this.setImage(img);
  }

  previousImage() {
    this.setIsFullAuto(false);
    let img =
      (this.imageIndex - 1 + this.resourceManager.enabledImages.length) %
      this.resourceManager.enabledImages.length;
    this.setImage(img);
  }

  randomColourIndex(): number {
    let index = Math.floor(Math.random() * this.colours.length);
    if (index == this.colourIndex) {
      return this.randomColourIndex();
    }
    return index;
  }

  randomColour(isFade: boolean = false) {
    let index = this.randomColourIndex();
    this.setColour(index, isFade);
  }

  // for experiments
  getRandomColour() {
    let index = this.randomColourIndex();
    return this.colours[index];
  }

  setColour(index: number, isFade: boolean = false) {
    this.colourIndex = index;
    let colour = this.colours[this.colourIndex];
    this.callEventListeners("newcolour", colour, isFade);
  }

  getBeat(index: number, bank: number) {
    let song = this.currentSong!;
    if (index < 0) {
      return song.build!.banks[bank][song.build!.mapLen + index];
    } else {
      return song.loop.banks[bank][index % song.loop.mapLen];
    }
  }

  // getBeat for all banks at once
  getBeats(index: number): string[] {
    let song = this.currentSong!;
    if (index < 0) {
      return song.build!.beatsAt(song.build!.mapLen + index);
    } else {
      return song.loop.beatsAt(index % song.loop.mapLen);
    }
  }

  beater(beat: string, bank: number) {
    // if someone hooked into us decided to cancel this beat
    if (
      this.callEventListeners("beat", beat, this.getBeatIndex(), bank) === true
    ) {
      return;
    }

    // any unknown beats always change image + colour
    const effects: Effect[] = (BeatTypes as any)[beat] ?? ImageColour;

    // any non-blank/stop char clears blackout
    let clearBlackout = beat != "." && beat != "_";
    for (const effect of effects) {
      switch (effect) {
        case Effect.StopAll:
          this.renderer.stopEffects(bank);
          break;
        case Effect.BlurX:
          this.renderer.doXBlur(bank);
          break;
        case Effect.BlurY:
          this.renderer.doYBlur(bank);
          break;
        case Effect.TrippyIn:
          this.renderer.doTrippyX(bank);
          break;
        case Effect.TrippyOut:
          this.renderer.doTrippyY(bank);
          break;
        case Effect.Blackout:
          this.renderer.doBlackout(false, bank);
          clearBlackout = false;
          break;
        case Effect.Whiteout:
          this.renderer.doBlackout(true, bank);
          clearBlackout = false;
          break;
        case Effect.InstantBlackout:
          this.renderer.doInstantBlackout(false, bank);
          clearBlackout = false;
          break;
        case Effect.InstantWhiteout:
          this.renderer.doInstantBlackout(true, bank);
          clearBlackout = false;
          break;
        case Effect.FadeOutBlackout:
          this.renderer.doBlackout(false, bank, this.timeToNextBeat(bank));
          clearBlackout = false;
          break;
        case Effect.FadeOutWhiteout:
          this.renderer.doBlackout(true, bank, this.timeToNextBeat(bank));
          clearBlackout = false;
          break;
        case Effect.FadeInBlackout:
          this.renderer.doBlackout(
            false,
            bank,
            this.timeToNextBeat(bank),
            true,
          );
          clearBlackout = false;
          break;
        case Effect.FadeInWhiteout:
          this.renderer.doBlackout(true, bank, this.timeToNextBeat(bank), true);
          clearBlackout = false;
          break;
        case Effect.ShortBlackout:
          this.renderer.doShortBlackout(this.getBeatLength(), false, bank);
          clearBlackout = false;
          break;
        case Effect.ShortWhiteout:
          this.renderer.doShortBlackout(this.getBeatLength(), true, bank);
          clearBlackout = false;
          break;
        case Effect.RandomColour:
          this.randomColour();
          break;
        case Effect.ColourFade:
          this.renderer.doColourFade(this.timeToNextBeat(bank), bank);
          this.randomColour(true);
          break;
        case Effect.RandomImage:
          if (this.settings.fullAuto) {
            this.randomImage();
          }
          break;
        case Effect.SliceX:
          // yes, SliceX is "y". I think I messed up. It renders right, don't worry
          this.renderer.doSlice(
            this.getBeatLength(),
            this.charsToNextBeat(bank),
            "y",
            bank,
          );
          break;
        case Effect.SliceY:
          this.renderer.doSlice(
            this.getBeatLength(),
            this.charsToNextBeat(bank),
            "x",
            bank,
          );
          break;
        case Effect.ShutterUp:
          this.renderer.doShutter(
            "↑",
            this.getBeatLength(),
            this.charsToNextBeat(bank),
          );
          break;
        case Effect.ShutterDown:
          this.renderer.doShutter(
            "↓",
            this.getBeatLength(),
            this.charsToNextBeat(bank),
          );
          break;
        case Effect.ShutterLeft:
          this.renderer.doShutter(
            "←",
            this.getBeatLength(),
            this.charsToNextBeat(bank),
          );
          break;
        case Effect.ShutterRight:
          this.renderer.doShutter(
            "→",
            this.getBeatLength(),
            this.charsToNextBeat(bank),
          );
          break;
        case Effect.InvertToggle:
          this.renderer.toggleInvert();
          break;
        case Effect.InvertFade:
          this.renderer.doInvertFade(this.timeToNextBeat(bank), bank);
          break;
      }
    }

    if (clearBlackout) {
      this.renderer.clearBlackout(bank);
    }
  }

  charsToNextBeat(bank: number) {
    // case: fade in build, not in rhythm. Must max out fade timer.
    let maxSearch = this.currentSong!.loop.mapLen;
    if (this.beatIndex < 0) {
      maxSearch -= this.beatIndex;
    }
    let nextBeat;
    for (nextBeat = 1; nextBeat <= maxSearch; nextBeat++) {
      const beat = this.getBeat(nextBeat + this.beatIndex, bank);
      // immediate stop char is meant to look jarring, for effect
      if (beat != "." && beat != "¯") {
        break;
      }
    }
    return nextBeat;
  }

  timeToNextBeat(bank: number) {
    // don't need to scale by playbackRate because currentTime is scaled
    return this.charsToNextBeat(bank) * this.getBeatLength();
  }

  // gets the best effort banks flattened down to a single string for display
  getBeatString(length = 256) {
    let beatString = "";
    if (this.currentSong) {
      const build = this.currentSong.build?.beatString;
      const loop = this.currentSong.loop.beatString;

      if (this.beatIndex < 0) {
        beatString = build!.slice(build!.length + this.beatIndex);
      } else {
        beatString = loop.slice(this.beatIndex % loop.length);
      }
      while (beatString.length < length) {
        beatString += loop;
      }
    }

    return beatString;
  }

  setIsFullAuto(auto: boolean) {
    this.settings.fullAuto = auto;
    if (this.userInterface) {
      this.callEventListeners("newmode", this.settings.fullAuto);
    }
  }

  toggleFullAuto() {
    this.setIsFullAuto(!this.settings.fullAuto);
  }

  changeUI(index: number) {
    if (
      index >= 0 &&
      this.uiArray.length > index &&
      this.userInterface != this.uiArray[index]
    ) {
      this.hideLists();
      if (this.userInterface) {
        this.userInterface.disconnect();
      }
      this.userInterface = this.uiArray[index];
      this.userInterface.connectCore(this);
      this.userInterface.updateVolume(this.soundManager.lastVol);
      this.callEventListeners("newmode", this.settings.fullAuto);
      this.callEventListeners("newsong", this.currentSong);
      this.callEventListeners("newimage", this.currentImage);
      this.callEventListeners(
        "newcolour",
        this.colours[this.colourIndex],
        false,
      );
      this.callEventListeners(
        "beatstring",
        this.getBeatString(),
        this.getBeatIndex(),
      );
    }
  }

  settingsUpdated() {
    this.callEventListeners("settingsupdated");
    // not an event listener - HuesCanvas can't be attached to HuesCore for
    // ease of respack_edit.html
    this.renderer.render.setBlurQuality(this.settings.blurQuality);
    this.renderer.render.setInvertStyle(this.settings.invertStyle);
    switch (this.settings.currentUI) {
      case "retro":
        this.changeUI(0);
        break;
      case "v4.20":
        this.changeUI(1);
        break;
      case "modern":
        this.changeUI(2);
        break;
      case "xmas":
        this.changeUI(3);
        break;
      case "hlwn":
        this.changeUI(4);
        break;
      case "mini":
        this.changeUI(5);
        break;
    }
    switch (this.settings.colourSet) {
      case "normal":
        this.colours = oldColours;
        break;
      case "pastel":
        this.colours = pastelColours;
        break;
      case "v4.20":
        this.colours = weedColours;
        break;
    }
    // the actual opacity is handled by the renderer
    if (this.settings.blackoutUI === "off") {
      this.userInterface?.show();
    }
    switch (this.settings.visualiser) {
      case "off":
        this.visualiser.classList.add("hidden");
        break;
      case "on":
        this.visualiser.classList.remove("hidden");
        if (!this.soundManager.vReady) {
          this.soundManager.initVisualiser(this.visualiser.width / 2);
        }
        break;
    }
    if (this.autoSong == "off" && this.settings.autoSong != "off") {
      console.log("Resetting loopCount since AutoSong was enabled");
      this.loopCount = 0;
    }
    this.autoSong = this.settings.autoSong;
  }

  enabledChanged() {
    this.resourceManager.rebuildEnabled();
  }

  hideLists() {
    this.resourceManager.hideLists();
  }

  toggleSongList() {
    this.window.hide();
    this.resourceManager.toggleSongList();
  }

  toggleImageList() {
    this.window.hide();
    this.resourceManager.toggleImageList();
  }

  openSongSource() {
    if (this.currentSong && this.currentSong.source) {
      window.open(this.currentSong.source, "_blank");
    }
  }

  openImageSource() {
    if (this.currentImage && this.currentImage.source) {
      window.open(this.currentImage.source, "_blank");
    }
  }

  keyHandler(key: string) {
    switch (key) {
      case "ArrowLeft":
        this.previousImage();
        break;
      case "ArrowRight":
        this.nextImage();
        break;
      case "ArrowUp":
      case "MediaTrackNext":
        this.nextSong();
        break;
      case "ArrowDown":
      case "MediaTrackPrevious":
        this.previousSong();
        break;
      case "f":
        this.toggleFullAuto();
        break;
      case "-":
        this.soundManager.decreaseVolume();
        break;
      case "=": // actualy a "+" but shift is disabled
        this.soundManager.increaseVolume();
        break;
      case "b":
        this.soundManager.seek(-this.soundManager.build.length);
        break;
      case "m":
        this.soundManager.toggleMute();
        break;
      case "h":
        this.userInterface?.toggleHide();
        break;
      case "r":
        this.window.selectTab("RESOURCES");
        break;
      case "e":
        this.window.selectTab("EDITOR");
        break;
      case "o":
        this.window.selectTab("OPTIONS");
        break;
      case "i":
        this.window.selectTab("INFO");
        break;
      case "1":
        this.settings.currentUI = "retro";
        break;
      case "2":
        this.settings.currentUI = "v4.20";
        break;
      case "3":
        this.settings.currentUI = "modern";
        break;
      case "4":
        this.settings.currentUI = "xmas";
        break;
      case "5":
        this.settings.currentUI = "hlwn";
        break;
      case "6":
        this.settings.currentUI = "mini";
        break;
      case "c":
        this.toggleImageList();
        break;
      case "s":
        this.toggleSongList();
        break;
      case "w":
        this.window.toggle();
        break;
      case "n":
        this.randomSong();
        break;
      case "l":
        this.resourceManager.fileInput.click();
        break;
      default:
        return true;
    }
    return false;
  }

  error(message: string) {
    console.error(message);
    this.preloadSubMsg.textContent = message;
    this.preloadMsg.style.color = "#F00";
  }

  warning(message: string) {
    this.preloadSubMsg.innerHTML = message;
    this.preloadMsg.style.color = "#F93";
    console.warn(this.preloadSubMsg.textContent);
  }

  clearMessage() {
    this.preloadSubMsg.textContent = "";
    this.preloadMsg.style.color = "";
  }
}

export const oldColours = [
  { c: 0x000000, n: "black" },
  { c: 0x550000, n: "brick" },
  { c: 0xaa0000, n: "crimson" },
  { c: 0xff0000, n: "red" },
  { c: 0x005500, n: "turtle" },
  { c: 0x555500, n: "sludge" },
  { c: 0xaa5500, n: "brown" },
  { c: 0xff5500, n: "orange" },
  { c: 0x00aa00, n: "green" },
  { c: 0x55aa00, n: "grass" },
  { c: 0xaaaa00, n: "maize" },
  { c: 0xffaa00, n: "citrus" },
  { c: 0x00ff00, n: "lime" },
  { c: 0x55ff00, n: "leaf" },
  { c: 0xaaff00, n: "chartreuse" },
  { c: 0xffff00, n: "yellow" },
  { c: 0x000055, n: "midnight" },
  { c: 0x550055, n: "plum" },
  { c: 0xaa0055, n: "pomegranate" },
  { c: 0xff0055, n: "rose" },
  { c: 0x005555, n: "swamp" },
  { c: 0x555555, n: "dust" },
  { c: 0xaa5555, n: "dirt" },
  { c: 0xff5555, n: "blossom" },
  { c: 0x00aa55, n: "sea" },
  { c: 0x55aa55, n: "ill" },
  { c: 0xaaaa55, n: "haze" },
  { c: 0xffaa55, n: "peach" },
  { c: 0x00ff55, n: "spring" },
  { c: 0x55ff55, n: "mantis" },
  { c: 0xaaff55, n: "brilliant" },
  { c: 0xffff55, n: "canary" },
  { c: 0x0000aa, n: "navy" },
  { c: 0x5500aa, n: "grape" },
  { c: 0xaa00aa, n: "mauve" },
  { c: 0xff00aa, n: "purple" },
  { c: 0x0055aa, n: "cornflower" },
  { c: 0x5555aa, n: "deep" },
  { c: 0xaa55aa, n: "lilac" },
  { c: 0xff55aa, n: "lavender" },
  { c: 0x00aaaa, n: "aqua" },
  { c: 0x55aaaa, n: "steel" },
  { c: 0xaaaaaa, n: "grey" },
  { c: 0xffaaaa, n: "pink" },
  { c: 0x00ffaa, n: "bay" },
  { c: 0x55ffaa, n: "marina" },
  { c: 0xaaffaa, n: "tornado" },
  { c: 0xffffaa, n: "saltine" },
  { c: 0x0000ff, n: "blue" },
  { c: 0x5500ff, n: "twilight" },
  { c: 0xaa00ff, n: "orchid" },
  { c: 0xff00ff, n: "magenta" },
  { c: 0x0055ff, n: "azure" },
  { c: 0x5555ff, n: "liberty" },
  { c: 0xaa55ff, n: "royalty" },
  { c: 0xff55ff, n: "thistle" },
  { c: 0x00aaff, n: "ocean" },
  { c: 0x55aaff, n: "sky" },
  { c: 0xaaaaff, n: "periwinkle" },
  { c: 0xffaaff, n: "carnation" },
  { c: 0x00ffff, n: "cyan" },
  { c: 0x55ffff, n: "turquoise" },
  { c: 0xaaffff, n: "powder" },
  { c: 0xffffff, n: "white" },
];
export const pastelColours = [
  { c: 0xcd4a4a, n: "Mahogany" },
  { c: 0xfae7b5, n: "Banana Mania" },
  { c: 0x9f8170, n: "Beaver" },
  { c: 0x232323, n: "Black" },
  { c: 0xbc5d58, n: "Chestnut" },
  { c: 0xdd9475, n: "Copper" },
  { c: 0x9aceeb, n: "Cornflower" },
  { c: 0x2b6cc4, n: "Denim" },
  { c: 0xefcdb8, n: "Desert Sand" },
  { c: 0x6e5160, n: "Eggplant" },
  { c: 0x1df914, n: "Electric Lime" },
  { c: 0x71bc78, n: "Fern" },
  { c: 0xfcd975, n: "Goldenrod" },
  { c: 0xa8e4a0, n: "Granny Smith Apple" },
  { c: 0x95918c, n: "Gray" },
  { c: 0x1cac78, n: "Green" },
  { c: 0xff1dce, n: "Hot Magenta" },
  { c: 0xb2ec5d, n: "Inch Worm" },
  { c: 0x5d76cb, n: "Indigo" },
  { c: 0xfdfc74, n: "Laser Lemon" },
  { c: 0xfcb4d5, n: "Lavender" },
  { c: 0xffbd88, n: "Macaroni and Cheese" },
  { c: 0x979aaa, n: "Manatee" },
  { c: 0xff8243, n: "Mango Tango" },
  { c: 0xfdbcb4, n: "Melon" },
  { c: 0x1a4876, n: "Midnight Blue" },
  { c: 0xffa343, n: "Neon Carrot" },
  { c: 0xbab86c, n: "Olive Green" },
  { c: 0xff7538, n: "Orange" },
  { c: 0xe6a8d7, n: "Orchid" },
  { c: 0x414a4c, n: "Outer Space" },
  { c: 0xff6e4a, n: "Outrageous Orange" },
  { c: 0x1ca9c9, n: "Pacific Blue" },
  { c: 0xc5d0e6, n: "Periwinkle" },
  { c: 0x8e4585, n: "Plum" },
  { c: 0x7442c8, n: "Purple Heart" },
  { c: 0xd68a59, n: "Raw Sienna" },
  { c: 0xe3256b, n: "Razzmatazz" },
  { c: 0xee204d, n: "Red" },
  { c: 0x1fcecb, n: "Robin Egg Blue" },
  { c: 0x7851a9, n: "Royal Purple" },
  { c: 0xff9baa, n: "Salmon" },
  { c: 0xfc2847, n: "Scarlet" },
  { c: 0x9fe2bf, n: "Sea Green" },
  { c: 0xa5694f, n: "Sepia" },
  { c: 0x8a795d, n: "Shadow" },
  { c: 0x45cea2, n: "Shamrock" },
  { c: 0xfb7efd, n: "Shocking Pink" },
  { c: 0xeceabe, n: "Spring Green" },
  { c: 0xfd5e53, n: "Sunset Orange" },
  { c: 0xfaa76c, n: "Tan" },
  { c: 0xfc89ac, n: "Tickle Me Pink" },
  { c: 0xdbd7d2, n: "Timberwolf" },
  { c: 0x17806d, n: "Tropical Rain Forest" },
  { c: 0x77dde7, n: "Turquoise Blue" },
  { c: 0xffa089, n: "Vivid Tangerine" },
  { c: 0x8f509d, n: "Vivid Violet" },
  { c: 0xededed, n: "White" },
  { c: 0xff43a4, n: "Wild Strawberry" },
  { c: 0xfc6c85, n: "Wild Watermelon" },
  { c: 0xcda4de, n: "Wisteria" },
  { c: 0xfce883, n: "Yellow" },
  { c: 0xc5e384, n: "Yellow Green" },
  { c: 0xffb653, n: "Yellow Orange" },
];
export const weedColours = [
  { c: 0x00ff00, n: "Green" },
  { c: 0x5a6351, n: "Lizard" },
  { c: 0x636f57, n: "Cactus" },
  { c: 0x4a7023, n: "Kakapo" },
  { c: 0x3d5229, n: "Wet Moss" },
  { c: 0x659d32, n: "Tree Moss" },
  { c: 0x324f17, n: "Lime Rind" },
  { c: 0x7f8778, n: "Flight Jacket" },
  { c: 0xbced91, n: "Green Mist" },
  { c: 0x488214, n: "Holly" },
  { c: 0x577a3a, n: "Mtn Dew Bottle" },
  { c: 0x748269, n: "Seaweed Roll" },
  { c: 0x83f52c, n: "Neon Green" },
  { c: 0xc0d9af, n: "Lichen" },
  { c: 0xa6d785, n: "Guacamole" },
  { c: 0x687e5a, n: "Pond Scum" },
  { c: 0x3f602b, n: "Douglas Fir" },
  { c: 0x3f6826, n: "Royal Palm" },
  { c: 0x646f5e, n: "Seaweed" },
  { c: 0x476a34, n: "Noble Fir" },
  { c: 0x5dfc0a, n: "Green Led" },
  { c: 0x435d36, n: "Spinach" },
  { c: 0x84be6a, n: "Frog" },
  { c: 0x5b9c64, n: "Emerald" },
  { c: 0x3a6629, n: "Circuit Board" },
  { c: 0x308014, n: "Sapgreen" },
  { c: 0x31b94d, n: "Pool Table" },
  { c: 0x55ae3a, n: "Leaf" },
  { c: 0x4dbd33, n: "Grass" },
  { c: 0x596c56, n: "Snake" },
  { c: 0x86c67c, n: "100 Euro" },
  { c: 0x7bcc70, n: "Night Vision" },
  { c: 0xa020f0, n: "Purple" },
  { c: 0x9b30ff, n: "Purple" },
  { c: 0x912cee, n: "Purple" },
  { c: 0x7d26cd, n: "Purple" },
  { c: 0xaa00ff, n: "Purple" },
  { c: 0x800080, n: "Purple" },
  { c: 0xa74cab, n: "Turnip" },
  { c: 0x8f5e99, n: "Violet" },
  { c: 0x816687, n: "Eggplant" },
  { c: 0xcc00ff, n: "Grape" },
  { c: 0x820bbb, n: "Wild Violet" },
  { c: 0x660198, n: "Concord Grape" },
  { c: 0x71637d, n: "Garden Plum" },
  { c: 0xb272a6, n: "Purple Fish" },
  { c: 0x5c246e, n: "Ultramarine Violet" },
  { c: 0x5e2d79, n: "Purple Rose" },
  { c: 0x683a5e, n: "Sea Urchin" },
  { c: 0x91219e, n: "Cobalt Violet Deep" },
  { c: 0x8b668b, n: "Plum" },
  { c: 0x9932cd, n: "Dark Orchid" },
  { c: 0xbf5fff, n: "Violet Flower" },
  { c: 0xbda0cb, n: "Purple Candy" },
  { c: 0x551a8b, n: "Deep Purple" },
  { c: 0xb5509c, n: "Thistle" },
  { c: 0x871f78, n: "Dark Purple" },
  { c: 0x9c6b98, n: "Purple Ink" },
  { c: 0xdb70db, n: "Orchid" },
  { c: 0x990099, n: "True Purple" },
  { c: 0x8b008b, n: "Darkmagenta" },
  { c: 0xb62084, n: "Harold's Crayon" },
  { c: 0x694489, n: "Purple Rain" },
  { c: 0xffd700, n: "Gold" },
];

(<any>window).HuesCore = HuesCore;
