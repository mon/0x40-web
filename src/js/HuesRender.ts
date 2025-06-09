import HuesCanvas2D from "./HuesCanvas2D";
import type { HuesColour } from "./HuesCore";
import type { HuesCore } from "./HuesCore";
import type { SettingsData } from "./HuesSettings.svelte";
import type { HuesImage } from "./ResourcePack";
import type SoundManager from "./SoundManager";
import { mixColours } from "./Utils";
// import './HuesPixi'; // new WebGL renderer, maybe later

// Given the dimensions of the drawing surface, the dimensions of the image, and
// the image alignment, provide the output x, y, width and height of the image.
// This function will also handle centering the image when the screen is too
// thin, for example on mobile devices.
export function calculateImageDrawCoords(
  canvasWidth: number,
  canvasHeight: number,
  bitmapWidth: number,
  bitmapHeight: number,
  bitmapAlign: RenderParams["bitmapAlign"],
  bitmapCenter: RenderParams["bitmapCenter"],
): [number, number, number, number, number | undefined] {
  let offset; // for centering/right/left align

  let drawHeight = canvasHeight;
  let drawWidth = (bitmapWidth / bitmapHeight) * drawHeight;
  switch (bitmapAlign) {
    case "left":
      offset = 0;
      break;
    case "right":
      offset = canvasWidth - drawWidth;
      break;
    default:
      offset = canvasWidth / 2 - drawWidth / 2;
      break;
  }

  // if we have a custom center and the screen is too thin, focus
  // on the custom center instead
  if (bitmapCenter !== undefined) {
    // scale to canvas
    bitmapCenter *= drawWidth / bitmapWidth;

    let safeWidth;
    switch (bitmapAlign) {
      case "left":
        safeWidth = bitmapCenter * 2;
        break;
      case "right":
        safeWidth = (drawWidth - bitmapCenter) * 2;
        break;
      default:
        if (canvasWidth < drawWidth) {
          // pretend to be left or right aligned based on whether
          // the custom center is left or right leaning
          const drawCenter = drawWidth / 2;
          if (bitmapCenter < drawCenter) {
            offset = 0;
            safeWidth = bitmapCenter * 2;
          } else {
            offset = canvasWidth - drawWidth;
            safeWidth = (drawWidth - bitmapCenter) * 2;
          }
        } else {
          safeWidth = drawWidth;
        }
        break;
    }

    // realign if needed
    if (canvasWidth < safeWidth) {
      offset = canvasWidth / 2 - bitmapCenter;
    }
  }

  // cleaner rendering via exact pixels
  offset = Math.round(offset);

  // x, y, width, height
  return [offset, 0, drawWidth, drawHeight, bitmapCenter];
}

export interface HuesCanvas {
  draw(params: RenderParams): void;
  resize(): void;
  setBlurQuality(quality: SettingsData["blurQuality"]): void;
  setInvertStyle(style: SettingsData["invertStyle"]): void;
}

type SliceParams = {
  count: number; // 1 for no slice, >1 for slices
  percent: number; // ignored if count == 1,
  // randomised "percent of image to create subsequent slice from"
  segments: number[];
  // how many segments (with some variance due to randomness) to make
  avgSegments: number;
  // randomised positive/negative offsets, as percent of width, multiplied by percent
  distances: number[];
};

export type RenderParams = {
  colour: number; // base colour
  lastColour: number; // previous colour
  colourFade?: number; // optional mix between lastColour and colour, from 0.0 to 1.0
  blendMode: GlobalCompositeOperation;
  bgColour: number | "transparent"; // base/backdrop colour for render stack

  overlayColour: number; // blackout/whiteout, hex string
  overlayPercent: number;

  invert: number; // 0.0: normal, 1.0: fully inverted

  bitmap?: HTMLImageElement;
  bitmapAlign?: HuesImage["align"];
  bitmapCenter?: number; // optional point to center on for slim displays

  // same as bitmap, just the previous image
  lastBitmap?: HTMLImageElement;
  lastBitmapAlign?: HuesImage["align"];
  lastBitmapCenter?: number;

  shutter?: number;
  shutterDir?: "←" | "↓" | "↑" | "→";

  xBlur: number;
  yBlur: number;

  // percent, out starts in center and moves out, in is the reverse
  outTrippy?: number;
  inTrippy?: number;

  slices?: {
    // undefined for no slices at all, or...
    x: SliceParams;
    y: SliceParams;
  };

  // debugging features
  border?: boolean; // draw red borders around image bounds, not incl slice/blur
  centerLine?: boolean; // draw green line at image centerpoint
};

type SliceInfo = {
  bank?: number;
  start?: number;
  // set with sliceStart
  rampUp?: number;
  rampDown?: number;
  transitionTime?: number;
};

// convenience container to calculate animation times and get the current frame
class RenderImage {
  core: HuesCore;
  audio: SoundManager;

  image?: HuesImage;

  animFrame: number;
  animTimeout: number;
  lastBeat: number;

  constructor(soundManager: SoundManager, core: HuesCore) {
    this.core = core;
    this.audio = soundManager;

    core.addEventListener("beatstring", this.beat.bind(this));
    core.addEventListener("songstarted", this.resetAnimation.bind(this));

    this.animFrame = 0;
    this.animTimeout = 0;
    this.lastBeat = 0;
  }

  resetAnimation() {
    this.animTimeout = this.audio.currentTime;
  }

  beat() {
    this.lastBeat = this.audio.currentTime;
  }

  sameAs(otherImage: HuesImage) {
    return this.image == otherImage;
  }

  setImage(image: HuesImage) {
    this.image = image;
    // Null images don't need anything interesting done to them
    if (!image || !image.bitmaps.length) {
      return;
    }
    this.animFrame = 0;
    if (image.animated) {
      let currentTime = this.audio.currentTime;
      this.animTimeout = currentTime + image.frameDurations[0] / 1000;
      if (
        image.beatsPerAnim &&
        this.core.currentSong &&
        this.core.currentSong.charsPerBeat
      ) {
        this.syncAnim(currentTime);
      }
    }
  }

  getBitmap() {
    if (this.image && this.image.bitmaps.length) {
      return this.image.bitmaps[this.animFrame];
    } else {
      return undefined;
    }
  }

  getBitmapAlign() {
    return this.image ? this.image.align : undefined;
  }

  onRedraw() {
    let currentTime = this.audio.currentTime;
    let needsRedraw = false;

    if (this.image && this.image.animated) {
      if (
        this.image.beatsPerAnim &&
        this.core.currentSong &&
        this.core.currentSong.charsPerBeat
      ) {
        let a = this.animFrame;
        this.syncAnim(currentTime);
        if (this.animFrame != a) {
          needsRedraw = true;
          // If you change to a non-synced song, this needs to be reset
          this.animTimeout = currentTime;
        }
      } else {
        // backgrounded tabs don't hit the animation loop so we get
        // wildly behind time - bring us back to sync no matter what
        while (this.animTimeout < currentTime) {
          this.animFrame++;
          this.animFrame %= this.image.frameDurations.length;
          this.animTimeout += this.image.frameDurations[this.animFrame] / 1000;
          needsRedraw = true;
        }
      }
    }

    return needsRedraw;
  }

  syncAnim(currentTime: number) {
    const song = this.core.currentSong;
    if (!song || !this.image) {
      // fallback to default
      return;
    }
    let index = this.core.beatIndex;
    // When animation has more frames than song has beats, or part thereof
    if (this.lastBeat && this.core.getBeatLength()) {
      let interp = (currentTime - this.lastBeat) / this.core.getBeatLength();
      index += Math.min(interp, 1);
    }
    // This loops A-OK because the core's beatIndex never rolls over for a new loop
    let beatLoc = (index / song.charsPerBeat!) % this.image.beatsPerAnim;

    let aLen = this.image.bitmaps.length;
    this.animFrame = Math.floor(aLen * (beatLoc / this.image.beatsPerAnim));
    if (this.image.syncOffset) {
      this.animFrame += this.image.syncOffset;
    }
    // Because negative mods are different in JS
    this.animFrame = ((this.animFrame % aLen) + aLen) % aLen;
  }
}

/*  Takes root element to attach to, and an audio context element for
    getting the current time with reasonable accuracy */
export default class HuesRender {
  render: HuesCanvas2D;
  audio: SoundManager;
  core: HuesCore;

  rendering: boolean;

  needsRedraw: boolean;
  colour: number;
  lastColour: number;
  image: RenderImage;
  lastImage: RenderImage;
  smartAlign: boolean;

  bgColour!: number | "transparent";

  blurDecay!: number;
  blurAmount!: number;
  blurBank: [number?, number?]; // x, y
  blurStart: [number?, number?]; // x, y
  blurDistance: [number, number]; // x, y

  sliceInfo: { x: SliceInfo; y: SliceInfo };
  slices: { x: SliceParams; y: SliceParams };

  shutterEnd?: number;
  shutterDuration: number;
  shutterDir: RenderParams["shutterDir"];
  shutterProgress?: number;

  trippyBank: [number?, number?]; // x, y
  trippyStart: [number?, number?]; // x, y
  trippyRadii: [number?, number?]; // x, y
  trippyOn: boolean;

  blackoutBank?: number;
  blackoutColour: number; // for the whiteout case we must store this
  blackoutLength?: number;
  blackoutStart?: number;
  blackoutTimeout?: number;
  blackoutFadeIn?: boolean;
  bOpacity: number;
  // frame drop mitigation on many fast consecutive short blackouts
  lastBlackout: number;
  currentBlackout: number;
  lastFrameBlack: boolean;

  invert: number;
  invertFadeBank?: number;
  invertFadeStart?: number;
  invertFadeLength?: number;
  // having start/target just be 0/1 is "useless" but might come in handy later
  // if we want to do partial inverts
  invertStart: number;
  invertTarget: number;

  colourFadeBank?: number;
  colourFadeStart?: number;
  colourFadeLength?: number;
  colourFadePercent?: number;

  constructor(root: HTMLElement, soundManager: SoundManager, core: HuesCore) {
    // 720p has great performance and our images are matched to it.
    // Higher resolutions don't get us many benefits
    this.render = new HuesCanvas2D(root, 720);
    this.audio = soundManager;
    soundManager.addEventListener("seek", this.resetEffects.bind(this));
    core.addEventListener("newsong", this.resetEffects.bind(this));
    core.addEventListener("newimage", this.setImage.bind(this));
    core.addEventListener("newcolour", this.setColour.bind(this));
    core.addEventListener("settingsupdated", this.settingsUpdated.bind(this));
    core.addEventListener("frame", this.animationLoop.bind(this));
    this.core = core;

    // rendering during the preloader causes slow loading on FF - keep true
    // for stuff like the respack editor, only HuesCore sets it to false
    this.rendering = true;

    this.needsRedraw = false;
    this.colour = 0xffffff;
    this.lastColour = 0xffffff;
    this.image = new RenderImage(soundManager, core);
    this.lastImage = new RenderImage(soundManager, core);
    this.smartAlign = true; // avoid string comparisons every frame

    // dynamic
    this.blurBank = [undefined, undefined];
    this.blurStart = [undefined, undefined];
    this.blurDistance = [0, 0];

    this.slices = {
      x: this.makeSliceObj(25),
      y: this.makeSliceObj(15),
    };

    this.shutterDuration = 0;

    this.sliceInfo = { x: {}, y: {} };

    // trippy mode
    this.trippyBank = [undefined, undefined]; // x, y
    this.trippyStart = [undefined, undefined]; // x, y
    this.trippyRadii = [undefined, undefined]; // x, y
    // force trippy mode
    this.trippyOn = false;

    this.blackoutColour = 0x000000;
    this.bOpacity = 0;
    // frame drop mitigation on many fast consecutive short blackouts
    this.lastBlackout = 0;
    this.currentBlackout = -1;
    this.lastFrameBlack = false;

    this.invert = 0.0;
    this.invertStart = 1.0;
    this.invertTarget = 0.0;

    // Chosen because they look decent
    this.setBlurAmount("medium");
    this.setBlurDecay("fast");
    this.setBgColour("white");

    window.addEventListener("resize", this.resize.bind(this));
    this.resize();
  }

  makeSliceObj(avgSegments: number): SliceParams {
    return {
      count: 0,
      percent: 0,
      avgSegments: avgSegments,
      segments: [],
      distances: [],
    };
  }

  settingsUpdated() {
    this.setSmartAlign(this.core.settings.smartAlign);
    this.setBlurAmount(this.core.settings.blurAmount);
    this.setBlurDecay(this.core.settings.blurDecay);
    this.setBgColour(this.core.settings.bgColour);
    this.trippyOn = this.core.settings.trippyMode == "on";
  }

  resetEffects() {
    this.colourFadeStart = undefined;
    this.invertFadeStart = undefined;
    this.trippyStart = [undefined, undefined];
    this.sliceInfo.x.start = undefined;
    this.sliceInfo.y.start = undefined;
    this.resetSliceSegments("x");
    this.resetSliceSegments("y");
    this.blurStart = [undefined, undefined];
    this.clearBlackout();
    this.core.blurUpdated(0, 0);
  }

  stopEffects(bank: number) {
    if (this.colourFadeBank == bank) {
      this.colourFadeStart = undefined;
    }
    if (this.invertFadeBank == bank) {
      this.invertFadeStart = undefined;
    }
    if (this.trippyBank[0] == bank) {
      this.trippyStart[0] = undefined;
    }
    if (this.trippyBank[1] == bank) {
      this.trippyStart[1] = undefined;
    }
    if (this.sliceInfo.x.bank == bank) {
      this.sliceInfo.x.start = undefined;
      this.resetSliceSegments("x");
    }
    if (this.sliceInfo.y.bank == bank) {
      this.sliceInfo.y.start = undefined;
      this.resetSliceSegments("y");
    }
    if (this.blurBank[0] == bank) {
      this.blurStart[0] = undefined;
    }
    if (this.blurBank[1] == bank) {
      this.blurStart[1] = undefined;
    }
    this.clearBlackout(bank);

    this.needsRedraw = true;
  }

  resize() {
    this.needsRedraw = true;
    this.render.resize();
  }

  redraw() {
    if (this.core.settings.blackoutUI === "on") {
      this.core.userInterface?.setOpacity(1.0 - this.bOpacity);
    }

    // when images aren't changing, shutter needs something to feed off
    const lastImage = this.core.settings.fullAuto ? this.lastImage : this.image;

    const params: RenderParams = {
      colour: this.colour,
      lastColour: this.lastColour,
      colourFade: this.colourFadeStart ? this.colourFadePercent : undefined,
      blendMode: this.core.settings.blendMode,
      bgColour: this.bgColour,

      overlayColour: this.blackoutColour,
      overlayPercent: this.bOpacity,

      invert: this.invert,

      bitmap: this.image.getBitmap(),
      bitmapAlign: this.smartAlign ? this.image.getBitmapAlign() : undefined,
      bitmapCenter: this.image.image?.centerPixel,

      lastBitmap: lastImage.getBitmap(),
      lastBitmapAlign: lastImage.getBitmapAlign(),
      lastBitmapCenter: lastImage.image?.centerPixel,

      shutter: this.shutterProgress,
      shutterDir: this.shutterDir,

      xBlur: this.blurDistance[0],
      yBlur: this.blurDistance[1],

      outTrippy: this.trippyRadii[1],
      inTrippy: this.trippyRadii[0],

      slices:
        this.sliceInfo.x.start !== undefined ||
        this.sliceInfo.y.start !== undefined
          ? this.slices
          : undefined,
    };

    this.render.draw(params);
  }

  animationLoop() {
    if (!this.rendering) return;

    // some if statements rely on this not changing throughout the func
    const now = this.audio.currentTime;

    if (this.colourFadeStart !== undefined) {
      const delta = now - this.colourFadeStart;
      const fadeVal = delta / this.colourFadeLength!;
      if (fadeVal >= 1) {
        this.colourFadeStart = undefined;
      } else {
        this.colourFadePercent = fadeVal;
      }
      this.needsRedraw = true;
    }
    if (this.invertFadeStart !== undefined) {
      const delta = now - this.invertFadeStart;

      const fadeVal = delta / this.invertFadeLength!;
      if (fadeVal >= 1.0) {
        this.invert = this.invertTarget;
        this.invertFadeStart = undefined;
      } else {
        this.invert =
          this.invertStart + (this.invertTarget - this.invertStart) * fadeVal;
      }
      this.needsRedraw = true;
    } else {
      this.invert = this.invertTarget;
    }
    if (this.blackoutTimeout !== undefined && now > this.blackoutTimeout) {
      this.clearBlackout();
    }
    if (this.blackoutStart !== undefined) {
      const delta = now - this.blackoutStart;
      this.bOpacity = delta / this.blackoutLength!;

      if (this.blackoutFadeIn) {
        this.bOpacity = 1 - this.bOpacity;
      }

      // If a short blackout is scheduled, but we missed the image frame
      // from the last one, you can get only black frames over and over
      // this will forcibly swap to the image to increase perceived speed
      if (
        this.bOpacity >= 1 &&
        !(this.lastBlackout != this.currentBlackout && this.lastFrameBlack)
      ) {
        this.lastFrameBlack = true;
        this.lastBlackout = this.currentBlackout;
      } else {
        this.lastFrameBlack = false;
      }
    } else {
      this.bOpacity = 0;
    }
    if (this.image.onRedraw()) {
      this.needsRedraw = true;
    }
    for (const [axis, blur] of this.blurStart.entries()) {
      if (blur !== undefined) {
        if (now >= blur) {
          // flash offsets blur gen by a frame
          let delta = now - blur + 1 / 30;
          this.blurDistance[axis] =
            this.blurAmount * Math.exp(-this.blurDecay * delta);
        } else {
          // rare race when song loading is slow
          this.blurDistance[axis] = 0;
        }

        // Update UI
        this.updateCoreBlur();
      } else {
        this.blurDistance[axis] = 0;
      }
    }
    for (const [_axis, info] of Object.entries(this.sliceInfo)) {
      const axis = _axis as "x" | "y";

      if (info.start === undefined) {
        continue;
      }

      let transitionPercent = 0.8;
      let delta;
      let sliceDistance;
      if (now < info.rampUp!) {
        delta = info.rampUp! - now;
        sliceDistance = (1 - delta / info.transitionTime!) * transitionPercent;
      } else if (now < info.rampDown!) {
        delta = info.rampDown! - now;
        let longTransition = info.rampDown! - info.rampUp!;
        sliceDistance =
          transitionPercent +
          (1 - delta / longTransition) * (1 - transitionPercent);
      } else {
        let endEffect = info.rampDown! + info.transitionTime!;
        if (now > endEffect) {
          info.start = undefined;
          this.resetSliceSegments(axis);
          sliceDistance = 0;
        } else {
          delta = endEffect - now;
          sliceDistance = delta / info.transitionTime!;
        }
      }
      this.slices[axis].percent = sliceDistance;
      this.needsRedraw = true;
    }
    if (this.shutterEnd !== undefined) {
      if (now < this.shutterEnd) {
        let delta = this.shutterEnd - now;
        this.shutterProgress =
          (this.shutterDuration - delta) / this.shutterDuration;
      } else {
        this.shutterEnd = undefined;
        this.shutterProgress = undefined;
      }
    }
    for (let i = 0; i < 2; i++) {
      if (this.trippyStart[i] !== undefined) {
        this.needsRedraw = true;
        this.trippyRadii[i] = (now - this.trippyStart[i]!) * 2;
        if (this.trippyRadii[i]! > 1) {
          this.trippyStart[i] = undefined;
          this.trippyRadii[i] = undefined;
          continue;
        }
        // x comes from outside the window
        if (i % 2 === 0) {
          this.trippyRadii[i] = 1 - this.trippyRadii[i]!;
        }
      } else {
        this.trippyRadii[i] = undefined;
      }
    }

    for (const [axis, blur] of this.blurStart.entries()) {
      if (blur !== undefined && this.blurDistance[axis] < 0.0001) {
        this.blurDistance[axis] = 0;
        this.blurStart[axis] = undefined;
        this.updateCoreBlur();
        this.needsRedraw = true;
      } else if (blur !== undefined) {
        this.needsRedraw = true;
      }
    }

    if (this.needsRedraw) {
      this.redraw();
    }
  }

  setImage(image: HuesImage) {
    this.needsRedraw = true;

    let swap = this.lastImage;
    this.lastImage = this.image;
    this.image = swap;

    this.image.setImage(image);
  }

  setColour(colour: HuesColour, isFade: boolean) {
    if (colour.c == this.colour) {
      return;
    }

    if (this.colourFadeStart !== undefined) {
      // we're interrupting an existing fade, so properly mix the last frame
      this.lastColour = mixColours(
        this.lastColour,
        this.colour,
        this.colourFadePercent!,
      );
    } else {
      this.lastColour = this.colour;
    }

    this.colour = colour.c;

    if (!isFade) {
      this.colourFadeStart = undefined;
    }
    this.needsRedraw = true;
  }

  doBlackout(
    whiteout: boolean,
    bank?: number,
    fadeLength?: number,
    fadeIn?: boolean,
  ) {
    this.blackoutBank = bank;
    this.blackoutColour = whiteout ? 0xffffff : 0x000000;
    this.blackoutTimeout = undefined; // indefinite
    this.blackoutStart = this.audio.currentTime;
    this.blackoutFadeIn = false;

    if (fadeLength === undefined) {
      // original is 3 frames at 30fps, this is close
      this.blackoutLength = 0.1;
    } else {
      this.blackoutLength = fadeLength;

      // fadeIn only valid when also given fadeLength
      if (fadeIn) {
        this.blackoutFadeIn = true;
        this.blackoutTimeout = this.blackoutStart + fadeLength;
      }
    }

    this.needsRedraw = true;
  }

  clearBlackout(bank?: number) {
    // only clear blackouts in this bank, unless the blackout was set by
    // song change (ie blackoutBank === undefined)
    if (
      bank !== undefined &&
      this.blackoutBank !== undefined &&
      bank != this.blackoutBank
    ) {
      return;
    }

    this.blackoutStart = undefined;
    this.blackoutTimeout = undefined;
    this.needsRedraw = true;
  }

  doShortBlackout(beatTime: number, whiteout: boolean, bank: number) {
    // looks better if we go right to black
    this.doInstantBlackout(whiteout, bank);
    this.blackoutTimeout = this.audio.currentTime + beatTime / 1.7;
    this.currentBlackout++;
  }

  doInstantBlackout(whiteout: boolean, bank?: number) {
    this.doBlackout(whiteout, bank);
    // sufficiently negative
    this.blackoutStart = -Math.pow(2, 32);
  }

  doColourFade(length: number, bank: number) {
    this.colourFadeBank = bank;
    this.colourFadeLength = length;
    this.colourFadeStart = this.audio.currentTime;
  }

  // hard set invert for new song or seeking
  setInvert(invert: boolean) {
    this.invertTarget = Number(invert);
    this.invertStart = Number(!invert);

    this.invertFadeStart = undefined;
    this.needsRedraw = true;
  }

  toggleInvert() {
    // if a fade is ongoing, this won't interrupt it, just polarity inverts it
    [this.invertStart, this.invertTarget] = [
      this.invertTarget,
      this.invertStart,
    ];
  }

  doInvertFade(length: number, bank: number) {
    this.invertFadeBank = bank;
    this.invertFadeLength = length;
    this.invertFadeStart = this.audio.currentTime;
    this.toggleInvert();
  }

  updateCoreBlur() {
    let x = this.blurDistance[0] / this.blurAmount;
    let y = this.blurDistance[1] / this.blurAmount;
    this.core.blurUpdated(x, y);
  }

  doBlur(axis: 0 | 1, bank: number) {
    // only allow one blur type at a time per bank. Matches flash behaviour,
    // while letting multi-bank be used for dual blur
    const other = Number(!axis);
    if (this.blurBank[other] === bank) {
      this.blurStart[other] = undefined;
    }

    this.blurBank[axis] = bank;
    this.blurStart[axis] = this.audio.currentTime;
    if (this.trippyOn) {
      this.doTrippy(axis, bank);
    }
    this.needsRedraw = true;
  }

  doXBlur(bank: number) {
    this.doBlur(0, bank);
  }

  doYBlur(bank: number) {
    this.doBlur(1, bank);
  }

  doTrippy(axis: 0 | 1, bank: number) {
    this.trippyStart[axis] = this.audio.currentTime;
    this.trippyBank[axis] = bank;
  }

  doTrippyX(bank: number) {
    this.doTrippy(0, bank);
  }

  doTrippyY(bank: number) {
    this.doTrippy(1, bank);
  }

  doShutter(
    beat: RenderParams["shutterDir"],
    beatLength: number,
    beatCount: number,
  ) {
    let freeTime = beatLength * beatCount * 0.8;
    // if the beats are super close together, we have to crush the speed down
    // if they're super far apart, keep the effect fast and crisp
    this.shutterDuration = Math.min(0.2, freeTime);

    this.shutterEnd = this.audio.currentTime + this.shutterDuration;
    this.shutterDir = beat;

    this.needsRedraw = true;
  }

  doSlice(beatLength: number, beatCount: number, dir: "x" | "y", bank: number) {
    let transitionTime = Math.min(0.06, beatLength);

    let info = this.sliceInfo[dir];

    info.bank = bank;
    info.start = this.audio.currentTime;
    info.rampUp = info.start + transitionTime;
    info.rampDown = info.start + beatLength * beatCount - transitionTime;
    info.transitionTime = transitionTime;

    this.generateSliceSegments(dir);

    this.needsRedraw = true;
  }

  generateSliceSegments(direction: "x" | "y") {
    let even = 1.0 / this.slices[direction].avgSegments;
    let spread = even / 2;
    let total = 0;
    let i;
    for (i = 0; ; i++) {
      let rando = even + Math.random() * spread * 2 - spread;
      this.slices[direction].segments[i] = rando;
      total += rando;

      this.slices[direction].distances[i] =
        Math.random() * this.blurAmount - this.blurAmount / 2;

      if (total > 1.0) {
        this.slices[direction].segments[i] -= total - 1.0;
        break;
      }
    }

    this.slices[direction].count = i + 1;
  }

  resetSliceSegments(direction: "x" | "y") {
    this.slices[direction].count = 1;
    this.slices[direction].segments[0] = 1;
    this.slices[direction].distances[0] = 0;
  }

  setBlurDecay(decay: SettingsData["blurDecay"]) {
    this.blurDecay = { slow: 7.8, medium: 14.1, fast: 20.8, "faster!": 28.7 }[
      decay
    ];
  }

  setBlurAmount(amount: SettingsData["blurAmount"]) {
    // flash is pixel counts based off 1280x720 res
    // x is more striking so ignore aspect ratio disparity on y
    this.blurAmount = { low: 48 / 1280, medium: 96 / 1280, high: 384 / 1280 }[
      amount
    ];
  }

  setBgColour(colour: SettingsData["bgColour"]) {
    this.bgColour = { white: 0xffffff, black: 0, transparent: "transparent" }[
      colour
    ] as typeof this.bgColour;
  }

  setSmartAlign(align: SettingsData["smartAlign"]) {
    this.smartAlign = align == "on";
  }
}
