import HuesCanvas from "./HuesCanvas";
import type { HuesColour } from "./HuesCore";
import type { HuesCore } from "./HuesCore";
import type { SettingsData } from "./HuesSettings";
import type { HuesImage } from "./ResourcePack";
import type SoundManager from "./SoundManager";
// import './HuesPixi'; // new WebGL renderer, maybe later

type SliceParams = {
    count: number; // 1 for no slice, >1 for slices
    percent: number; // ignored if count == 1,
    // randomised "percent of image to create subsequent slice from"
    segments: number[];
    // how many segments (with some variance due to randomness) to make
    avgSegments: number;
    // randomised positive/negative offsets, as percent of width, multiplied by percent
    distances: number[];
}

export type RenderParams = {
    colour: number; // base colour
    lastColour: number; // previous colour
    blendMode:  GlobalCompositeOperation;

    overlayColour: number; // blackout/whiteout, hex string
    overlayPercent: number;

    invert: boolean;

    bitmap?: HTMLImageElement;
    bitmapAlign?: HuesImage["align"];

    // same as bitmap, just the previous image
    lastBitmap?: HTMLImageElement;
    lastBitmapAlign?: HuesImage["align"];

    shutter: number;
    shutterDir?: "←" | "↓" | "↑" | "→";

    xBlur: number;
    yBlur: number;

    // percent, out starts in center and moves out, in is the reverse
    outTrippy: number;
    inTrippy: number;

    slices?: { // undefined for no slices at all, or...
        x: SliceParams;
        y: SliceParams;
    }
}

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

        core.addEventListener("beat", this.beat.bind(this));
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
        if(!image ||!image.bitmaps.length) {
            return;
        }
        this.animFrame = 0;
        if(image.animated) {
            let currentTime = this.audio.currentTime;
            this.animTimeout = currentTime + image.frameDurations[0]/1000;
            if(image.beatsPerAnim && this.core.currentSong && this.core.currentSong.charsPerBeat) {
                this.syncAnim(currentTime);
            }
        }
    }

    getBitmap() {
        if(this.image && this.image.bitmaps.length) {
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

        if(this.image && this.image.animated){
            if(this.image.beatsPerAnim && this.core.currentSong && this.core.currentSong.charsPerBeat) {
                let a = this.animFrame;
                this.syncAnim(currentTime);
                if(this.animFrame != a) {
                    needsRedraw = true;
                    // If you change to a non-synced song, this needs to be reset
                    this.animTimeout = currentTime;
                }
            } else {
                // backgrounded tabs don't hit the animation loop so we get
                // wildly behind time - bring us back to sync no matter what
                while(this.animTimeout < currentTime) {
                    this.animFrame++;
                    this.animFrame %= this.image.frameDurations.length;
                    this.animTimeout += this.image.frameDurations[this.animFrame]/1000;
                    needsRedraw = true;
                }
            }
        }

        return needsRedraw;
    }

    syncAnim(currentTime: number) {
        const song = this.core.currentSong;
        if(!song || !this.image) { // fallback to default
           return;
        }
        let index = this.core.beatIndex;
        // When animation has more frames than song has beats, or part thereof
        if(this.lastBeat && this.core.getBeatLength()) {
            let interp = (currentTime - this.lastBeat) / this.core.getBeatLength();
            index += Math.min(interp, 1);
        }
        // This loops A-OK because the core's beatIndex never rolls over for a new loop
        let beatLoc = (index / song.charsPerBeat!) % this.image.beatsPerAnim;

        let aLen = this.image.bitmaps.length;
        this.animFrame = Math.floor(aLen * (beatLoc / this.image.beatsPerAnim));
        if(this.image.syncOffset) {
            this.animFrame += this.image.syncOffset;
        }
        // Because negative mods are different in JS
        this.animFrame = ((this.animFrame % aLen) + aLen) % aLen;
    }
}

/*  Takes root element to attach to, and an audio context element for
    getting the current time with reasonable accuracy */
export default class HuesRender {
    render: HuesCanvas;
    audio: SoundManager;
    core: HuesCore;

    needsRedraw: boolean;
    colour: number;
    lastColour: number;
    image: RenderImage;
    lastImage: RenderImage;
    smartAlign: boolean;

    blurDecay!: number;
    blurAmount!: number;
    blurStart: [number?, number?]; // x, y
    blurDistance: [number, number]; // x, y

    sliceStart?: number;
    // marked as never-null since they get set with sliceStart
    sliceRampUp!: number;
    sliceRampDown!: number;
    sliceTransitionTime!: number;
    slices: {
        x: SliceParams;
        y: SliceParams;
    };

    shutterEnd?: number;
    shutterDuration: number;
    shutterDir: RenderParams['shutterDir'];
    shutterProgress: number;

    trippyStart: [number?, number?]; // x, y
    trippyRadii: [number, number]; // x, y
    trippyOn: boolean;

    blackoutColour: number; // for the whiteout case we must store this
    blackoutStart?: number;
    blackoutTimeout?: number;
    bOpacity: number;
    // frame drop mitigation on many fast consecutive short blackouts
    lastBlackout: number;
    currentBlackout: number;
    lastFrameBlack: boolean;

    invert: boolean;

    colourFadeStart?: number;
    colourFadeLength?: number;
    oldColour!: number;
    newColour!: number;

    blendMode: GlobalCompositeOperation;

    constructor(root: HTMLElement, soundManager: SoundManager, core: HuesCore) {
        this.render = new HuesCanvas(root, core);
        this.audio = soundManager;
        soundManager.addEventListener("seek", this.resetEffects.bind(this));
        core.addEventListener("newsong", this.resetEffects.bind(this));
        core.addEventListener("newimage", this.setImage.bind(this));
        core.addEventListener("newcolour", this.setColour.bind(this));
        core.addEventListener("invert", this.setInvert.bind(this));
        core.addEventListener("settingsupdated", this.settingsUpdated.bind(this));
        core.addEventListener("frame", this.animationLoop.bind(this));
        this.core = core;

        this.needsRedraw = false;
        this.colour = 0xFFFFFF;
        this.lastColour = 0xFFFFFF;
        this.image = new RenderImage(soundManager, core);
        this.lastImage = new RenderImage(soundManager, core);
        this.smartAlign = true; // avoid string comparisons every frame

        // dynamic
        this.blurStart = [undefined, undefined];
        this.blurDistance = [0, 0];

        this.slices = {
            x : this.makeSliceObj(25),
            y : this.makeSliceObj(15)
        };

        this.shutterDuration = 0;
        this.shutterProgress = 0;

        // trippy mode
        this.trippyStart = [undefined, undefined]; // x, y
        this.trippyRadii = [0, 0]; // x, y
        // force trippy mode
        this.trippyOn = false;

        this.blackoutColour = 0x000000;
        this.bOpacity = 0;
        // frame drop mitigation on many fast consecutive short blackouts
        this.lastBlackout = 0;
        this.currentBlackout = -1;
        this.lastFrameBlack = false;

        this.invert = false;

        this.blendMode = "hard-light";
        // Chosen because they look decent
        this.setBlurAmount("medium");
        this.setBlurDecay("fast");

        window.addEventListener('resize', this.resize.bind(this));
        this.resize();
    }

    makeSliceObj(avgSegments: number): SliceParams {
        return {
            count       : 0,
            percent     : 0,
            avgSegments : avgSegments,
            segments    : [],
            distances   : []
        };
    }

    setInvert(invert: boolean) {
        this.invert = invert;
        this.needsRedraw = true;
    }

    settingsUpdated() {
        this.setSmartAlign(this.core.settings.smartAlign);
        this.setBlurAmount(this.core.settings.blurAmount);
        this.setBlurDecay(this.core.settings.blurDecay);
        this.trippyOn = this.core.settings.trippyMode == "on";
    }

    resetEffects() {
        this.colourFadeStart = undefined;
        this.trippyStart = [undefined, undefined];
        this.sliceStart = undefined;
        this.blurStart = [undefined, undefined];
    }

    resize() {
        this.needsRedraw = true;
    }

    redraw() {
        // when images aren't changing, shutter needs something to feed off
        let lastImage = this.core.settings.fullAuto ? this.lastImage : this.image;

        let params = {
            colour: this.colour,
            lastColour: this.lastColour,
            blendMode: this.blendMode,

            overlayColour: this.blackoutColour,
            overlayPercent: this.bOpacity,

            invert: this.invert,

            bitmap: this.image.getBitmap(),
            bitmapAlign: this.smartAlign ? this.image.getBitmapAlign() : undefined,

            lastBitmap: lastImage.getBitmap(),
            lastBitmapAlign: lastImage.getBitmapAlign(),

            shutter: this.shutterProgress,
            shutterDir: this.shutterDir,

            xBlur: this.blurDistance[0],
            yBlur: this.blurDistance[1],

            outTrippy: this.trippyRadii[1],
            inTrippy: this.trippyRadii[0],

            slices: (this.sliceStart !== undefined) ? this.slices : undefined,
        };

        this.render.draw(params);
    }

    animationLoop() {
        if (this.colourFadeStart !== undefined) {
            let delta = this.audio.currentTime - this.colourFadeStart;
            let fadeVal = delta / this.colourFadeLength!;
            if (fadeVal >= 1) {
                this.stopFade();
                this.colour = this.newColour;
            } else {
                this.mixColours(fadeVal);
            }
            this.needsRedraw = true;
        }
        if(this.blackoutTimeout !== undefined && this.audio.currentTime > this.blackoutTimeout) {
            this.clearBlackout();
        }
        if(this.blackoutStart !== undefined) {
            // original is 3 frames at 30fps, this is close
            this.bOpacity = (this.audio.currentTime - this.blackoutStart)*10;

            // If a short blackout is scheduled, but we missed the image frame
            // from the last one, you can get only black frames over and over
            // this will forcibly swap to the image to increase perceived speed
            if(this.bOpacity >= 1 && !(this.lastBlackout != this.currentBlackout && this.lastFrameBlack)) {
                this.lastFrameBlack = true;
                this.lastBlackout = this.currentBlackout;
            } else {
                this.lastFrameBlack = false;
            }
        } else {
            this.bOpacity = 0;
        }
        if(this.image.onRedraw()) {
            this.needsRedraw = true;
        }
        for(const [axis, blur] of this.blurStart.entries()) {
            if(blur !== undefined) {
                // flash offsets blur gen by a frame
                let delta = this.audio.currentTime - blur + (1/30);
                this.blurDistance[axis] = this.blurAmount * Math.exp(-this.blurDecay * delta);

                // Update UI
                this.updateCoreBlur();
            } else {
                this.blurDistance[axis] = 0;
            }
        }
        if(this.sliceStart !== undefined) {
            let transitionPercent = 0.8;
            let delta;
            let sliceDistance;
            let now = this.audio.currentTime;
            if(now < this.sliceRampUp) {
                delta = this.sliceRampUp - now;
                sliceDistance = (1-(delta / this.sliceTransitionTime)) * transitionPercent;
            } else if(now < this.sliceRampDown) {
                delta = this.sliceRampDown - now;
                let longTransition = this.sliceRampDown - this.sliceRampUp;
                sliceDistance = transitionPercent + ((1-(delta / longTransition)) * (1-transitionPercent));
            } else {
                let endEffect = this.sliceRampDown + this.sliceTransitionTime;
                if(now > endEffect) {
                    this.sliceStart = undefined;
                    sliceDistance = 0;
                } else {
                    delta = endEffect - now;
                    sliceDistance = delta / this.sliceTransitionTime;
                }
            }
            this.slices.x.percent = sliceDistance;
            this.slices.y.percent = sliceDistance;
            this.needsRedraw = true;
        }
        if(this.shutterEnd !== undefined) {
            if(this.audio.currentTime < this.shutterEnd) {
                let delta = this.shutterEnd - this.audio.currentTime;
                this.shutterProgress = (this.shutterDuration-delta) / this.shutterDuration;
            } else {
                this.shutterEnd = undefined;
                this.shutterProgress = 0;
            }
        }
        for(let i = 0; i < 2; i++) {
            if(this.trippyStart[i] !== undefined) {
                this.needsRedraw = true;
                this.trippyRadii[i] = (this.audio.currentTime - this.trippyStart[i]!) * 2;
                if(this.trippyRadii[i] > 1) {
                    this.trippyStart[i] = undefined;
                    continue;
                }
                // x comes from outside the window
                if(i % 2 === 0) {
                    this.trippyRadii[i] = 1 - this.trippyRadii[i];
                }
            } else {
                this.trippyRadii[i] = 0;
            }
        }

        for(const [axis, blur] of this.blurStart.entries()) {
            if(blur !== undefined && this.blurDistance[axis] < 0.0001) {
                this.blurDistance[axis] = 0;
                this.blurStart[axis] = undefined;
                this.updateCoreBlur();
                this.needsRedraw = true;
            } else if(blur !== undefined) {
                this.needsRedraw = true;
            }
        }

        if(this.needsRedraw) {
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
        if(colour.c == this.colour) {
            return;
        }
        this.lastColour = this.colour;
        if(isFade) {
            this.newColour = colour.c;
        } else {
            this.stopFade();
            this.colour = colour.c;
        }
        this.needsRedraw = true;
    }

    doBlackout(whiteout = false) {
        if(whiteout) {
            this.blackoutColour = 0xFFFFFF;
        } else {
            this.blackoutColour = 0x000000;
        }
        this.blackoutTimeout = undefined; // indefinite
        // Don't restart the blackout animation if we're already blacked out
        if(this.blackoutStart == undefined) {
            this.blackoutStart = this.audio.currentTime;
        }
        this.needsRedraw = true;
        if(this.core.settings.blackoutUI == "on") {
            this.core.userInterface?.hide();
        }
    }

    clearBlackout() {
        this.blackoutStart = undefined;
        this.blackoutTimeout = undefined;
        this.needsRedraw = true;
        if(this.core.settings.blackoutUI == "on") {
            this.core.userInterface?.show();
        }
    }

    doShortBlackout(beatTime: number, whiteout = false) {
        // looks better if we go right to black
        this.doInstantBlackout(whiteout);
        this.blackoutTimeout = this.audio.currentTime + beatTime / 1.7;
        this.currentBlackout++;
    }

    doInstantBlackout(whiteout = false) {
        this.doBlackout(whiteout);
        // sufficiently negative
        this.blackoutStart = -Math.pow(2, 32);
    }

    doColourFade(length: number) {
        this.colourFadeLength = length;
        this.colourFadeStart = this.audio.currentTime;
        this.oldColour = this.colour;
    }

    stopFade() {
        this.colourFadeStart = undefined;
    }

    mixColours(percent: number) {
        percent = Math.min(1, percent);
        let oldR = this.oldColour >> 16 & 0xFF;
        let oldG = this.oldColour >> 8  & 0xFF;
        let oldB = this.oldColour       & 0xFF;
        let newR = this.newColour >> 16 & 0xFF;
        let newG = this.newColour >> 8  & 0xFF;
        let newB = this.newColour       & 0xFF;
        let mixR = oldR * (1 - percent) + newR * percent;
        let mixG = oldG * (1 - percent) + newG * percent;
        let mixB = oldB * (1 - percent) + newB * percent;
        this.colour = mixR << 16 | mixG << 8 | mixB;
    }

    updateCoreBlur() {
        let x = this.blurDistance[0] / this.blurAmount;
        let y = this.blurDistance[1] / this.blurAmount;
        this.core.blurUpdated(x, y);
    }

    doBlur(axis: 0 | 1) {
        this.blurStart[axis] = this.audio.currentTime;
        if(this.trippyOn)
            this.trippyStart[axis] = this.blurStart[axis];
        this.needsRedraw = true;
    }

    doXBlur() {
        this.doBlur(0);
    }

    doYBlur() {
        this.doBlur(1);
    }

    doTrippy(axis: 0 | 1) {
        let saveTrippy = this.trippyOn;
        // force trippy
        this.trippyOn = true;
        this.doBlur(axis);
        this.trippyOn = saveTrippy;
    }

    doTrippyX() {
        this.doTrippy(0);
    }

    doTrippyY() {
        this.doTrippy(1);
    }

    doShutter(beat: RenderParams['shutterDir'], beatLength: number, beatCount: number) {
        let freeTime = beatLength * beatCount * 0.8;
        // if the beats are super close together, we have to crush the speed down
        // if they're super far apart, keep the effect fast and crisp
        this.shutterDuration = Math.min(0.2, freeTime);

        this.shutterEnd = this.audio.currentTime + this.shutterDuration;
        this.shutterDir = beat;

        this.needsRedraw = true;
    }

    doSlice(beatLength: number, beatCount: number, sliceX: boolean, sliceY: boolean) {
        let transitionTime = Math.min(0.06, beatLength);

        this.sliceStart = this.audio.currentTime;
        this.sliceRampUp = this.sliceStart + transitionTime;
        this.sliceRampDown = this.sliceStart + (beatLength * beatCount) - transitionTime;
        this.sliceTransitionTime = transitionTime;

        if (sliceX)
            this.generateSliceSegments('x');
        else
            this.resetSliceSegments('x');
        if (sliceY)
            this.generateSliceSegments('y');
        else
            this.resetSliceSegments('y');

        this.needsRedraw = true;
    }

    generateSliceSegments(direction: "x" | "y") {
        let even = 1.0 / this.slices[direction].avgSegments;
        let spread = even / 2;
        let total = 0;
        let i;
        for(i = 0; ; i++) {
            let rando = even + Math.random() * spread * 2 - spread;
            this.slices[direction].segments[i] = rando;
            total += rando;

            this.slices[direction].distances[i] =
                Math.random() * this.blurAmount - this.blurAmount / 2;

            if(total > 1.0) {
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

    setBlurDecay(decay: SettingsData['blurDecay']) {
        this.blurDecay = {"slow" : 7.8, "medium" : 14.1, "fast" : 20.8, "faster!" : 28.7}[decay];
    }

    setBlurAmount(amount: SettingsData['blurAmount']) {
        // flash is pixel counts based off 1280x720 res
        // x is more striking so ignore aspect ratio disparity on y
        this.blurAmount = {"low" : 48/1280, "medium" : 96/1280, "high" : 384/1280}[amount];
    }

    setSmartAlign(align: SettingsData['smartAlign']) {
        this.smartAlign = align == "on";
    }
}
