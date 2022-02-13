/* Copyright (c) 2015 William Toohey <will@mon.im>
 * Portions Copyright (c) 2015 Calvin Walton <calvin.walton@kepstin.ca>
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

import './HuesCanvas';
// import './HuesPixi'; // new WebGL renderer, maybe later

(function(window, document) {
"use strict";

// convenience container to calculate animation times and get the current frame
class RenderImage {
    constructor(soundManager, core) {
        this.core = core;
        this.audio = soundManager;

        core.addEventListener("beat", this.beat.bind(this));
        core.addEventListener("songstarted", this.resetAnimation.bind(this));

        this.image = null;
        this.animFrame = null;
        this.animTimeout = null;
        this.lastBeat = 0;
    }

    resetAnimation() {
        this.animTimeout = this.audio.currentTime;
    }

    beat() {
        this.lastBeat = this.audio.currentTime;
    }

    sameAs(otherImage) {
        return this.image == otherImage;
    }

    setImage(image) {
        this.image = image;
        // Null images don't need anything interesting done to them
        if(!image || (!image.bitmap && !image.bitmaps)) {
            return;
        }
        if(image.animated) {
            let currentTime = this.audio.currentTime;
            this.animFrame = 0;
            this.animTimeout = currentTime + image.frameDurations[0]/1000;
            if(image.beatsPerAnim && this.core.currentSong && this.core.currentSong.charsPerBeat) {
                this.syncAnim(currentTime);
            }
        }
    }

    getBitmap() {
        if(this.image && (this.image.bitmap || this.image.bitmaps)) {
            return this.image.animated ?
                this.image.bitmaps[this.animFrame] : this.image.bitmap;
        } else {
            return null;
        }
    }

    getBitmapAlign() {
        return this.image ? this.image.align : null;
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

    syncAnim(currentTime) {
        let song = this.core.currentSong;
        if(!song) { // fallback to default
           return;
        }
        let index = this.core.beatIndex;
        // When animation has more frames than song has beats, or part thereof
        if(this.lastBeat && this.core.getBeatLength()) {
            let interp = (currentTime - this.lastBeat) / this.core.getBeatLength();
            index += Math.min(interp, 1);
        }
        // This loops A-OK because the core's beatIndex never rolls over for a new loop
        let beatLoc = (index / song.charsPerBeat) % this.image.beatsPerAnim;

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
class HuesRender {
    constructor(root, soundManager, core) {
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

        // set later
        this.blurDecay = null;
        this.blurAmount = null;
        // dynamic
        this.blurStart = 0;
        this.blurDistance = 0;
        this.xBlur = false;
        this.yBlur = false;

        this.sliceDistance = 0;
        this.sliceStart = 0;
        this.slices = {
            x : this.makeSliceObj(25),
            y : this.makeSliceObj(15)
        };

        this.shutterEnd = 0;
        this.shutterDuration = 0;
        this.shutterDir = null;
        this.shutterProgress = 0;

        // trippy mode
        this.trippyStart = [0, 0]; // x, y
        this.trippyRadii = [0, 0]; // x, y
        // force trippy mode
        this.trippyOn = false;

        this.blackout = false;
        this.blackoutColour = 0x000000; // for the whiteout case we must store this
        this.blackoutTimeout = null;
        this.bOpacity = 0;
        // frame drop mitigation on many fast consecutive short blackouts
        this.lastBlackout = 0;
        this.currentBlackout = -1;
        this.lastFrameBlack = false;

        this.invert = false;

        this.colourFade = false;
        this.colourFadeStart=0;
        this.colourFadeLength=0;
        this.oldColour=0xFFFFFF;
        this.newColour=0xFFFFFF;

        this.blendMode = "hard-light";
        // Chosen because they look decent
        this.setBlurAmount("medium");
        this.setBlurDecay("fast");

        window.addEventListener('resize', this.resize.bind(this));
        this.resize();
    }

    makeSliceObj(avgSegments) {
        return {
            count       : 0,
            percent     : 0,
            avgSegments : avgSegments,
            segments    : [],
            distances   : []
        };
    }

    setInvert(invert) {
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
        this.colourFadeStart = 0;
        this.colourFade = false;
        this.trippyStart = [0, 0];
        this.sliceStart = 0;
        this.blurStart = 0;
        this.blurDistance = 0;
        this.xBlur = false;
        this.yBlur = false;
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
            bitmapAlign: this.smartAlign ? this.image.getBitmapAlign() : null,

            lastBitmap: lastImage.getBitmap(),
            lastBitmapAlign: lastImage.getBitmapAlign(),

            shutter: this.shutterProgress,
            shutterDir: this.shutterDir,

            xBlur: this.xBlur ? this.blurDistance : 0,
            yBlur: this.yBlur ? this.blurDistance : 0,

            outTrippy: this.trippyRadii[1],
            inTrippy: this.trippyRadii[0],

            slices: this.sliceStart ? this.slices : null,
        };

        this.render.draw(params);
    }

    animationLoop() {
        if (this.colourFade) {
            let delta = this.audio.currentTime - this.colourFadeStart;
            let fadeVal = delta / this.colourFadeLength;
            if (fadeVal >= 1) {
                this.stopFade();
                this.colour = this.newColour;
            } else {
                this.mixColours(fadeVal);
            }
            this.needsRedraw = true;
        }
        if(this.blackoutTimeout && this.audio.currentTime > this.blackoutTimeout) {
            this.clearBlackout();
        }
        if(this.blackout) {
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
        if(this.blurStart) {
            // flash offsets blur gen by a frame
            let delta = this.audio.currentTime - this.blurStart + (1/30);
            this.blurDistance = this.blurAmount * Math.exp(-this.blurDecay * delta);

            // Update UI
            let dist = this.blurDistance / this.blurAmount;
            if(this.xBlur)
                this.core.blurUpdated(dist, 0);
            else
                this.core.blurUpdated(0, dist);
        }
        if(this.sliceStart) {
            let transitionPercent = 0.8;
            let delta;
            let now = this.audio.currentTime;
            if(now < this.sliceRampUp) {
                delta = this.sliceRampUp - now;
                this.sliceDistance = (1-(delta / this.sliceTransitionTime)) * transitionPercent;
            } else if(now < this.sliceRampDown) {
                delta = this.sliceRampDown - now;
                let longTransition = this.sliceRampDown - this.sliceRampUp;
                this.sliceDistance = transitionPercent + ((1-(delta / longTransition)) * (1-transitionPercent));
            } else {
                let endEffect = this.sliceRampDown + this.sliceTransitionTime;
                if(now > endEffect) {
                    this.sliceStart = 0;
                    this.sliceDistance = 0;
                } else {
                    delta = endEffect - now;
                    this.sliceDistance = delta / this.sliceTransitionTime;
                }
            }
            this.slices.x.percent = this.sliceDistance;
            this.slices.y.percent = this.sliceDistance;
            this.needsRedraw = true;
        }
        if(this.shutterEnd) {
            if(this.audio.currentTime < this.shutterEnd) {
                let delta = this.shutterEnd - this.audio.currentTime;
                this.shutterProgress = (this.shutterDuration-delta) / this.shutterDuration;
            } else {
                this.shutterEnd = 0;
                this.shutterProgress = 0;
            }
        }
        for(let i = 0; i < 2; i++) {
            if(this.trippyStart[i] || this.trippyRadii[i]) {
                this.needsRedraw = true;
                this.trippyRadii[i] = (this.audio.currentTime - this.trippyStart[i]) * 2;
                if(this.trippyRadii[i] > 1) {
                    this.trippyStart[i] = 0;
                    this.trippyRadii[i] = 0;
                    continue;
                }
                // x comes from outside the window
                if(i % 2 === 0) {
                    this.trippyRadii[i] = 1 - this.trippyRadii[i];
                }
            }
        }

        if(this.blurStart && this.blurDistance < 0.0001) {
            this.core.blurUpdated(0, 0);
            this.blurDistance = 0;
            this.blurStart = 0;
            this.xBlur = this.yBlur = false;
            this.redraw();
        } else if(this.blurStart) {
            this.redraw();
        } else if(this.needsRedraw){
            this.redraw();
        }
    }

    setImage(image) {
        this.needsRedraw = true;

        let swap = this.lastImage;
        this.lastImage = this.image;
        this.image = swap;

        this.image.setImage(image);
    }

    setColour(colour, isFade) {
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
        this.blackoutTimeout = 0; // indefinite
        // Don't restart the blackout animation if we're already blacked out
        if(!this.blackout) {
            this.blackoutStart = this.audio.currentTime;
        }
        this.blackout = true;
        this.needsRedraw = true;
        if(this.core.settings.blackoutUI == "on") {
            this.core.userInterface.hide();
        }
    }

    clearBlackout() {
        this.blackout = false;
        this.blackoutTimeout = 0;
        this.needsRedraw = true;
        if(this.core.settings.blackoutUI == "on") {
            this.core.userInterface.show();
        }
    }

    doShortBlackout(beatTime, whiteout = false) {
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

    doColourFade(length) {
        this.colourFade = true;
        this.colourFadeLength = length;
        this.colourFadeStart = this.audio.currentTime;
        this.oldColour = this.colour;
    }

    stopFade() {
        this.colourFade = false;
        this.colourFadeStart = 0;
        this.colourFadeLength = 0;
    }

    mixColours(percent) {
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

    doXBlur() {
        this.blurStart = this.audio.currentTime;
        if(this.trippyOn)
            this.trippyStart[0] = this.blurStart;
        this.blurDistance = this.blurAmount;
        this.xBlur = true;
        this.yBlur = false;
        this.needsRedraw = true;
    }

    doYBlur() {
        this.blurStart = this.audio.currentTime;
        if(this.trippyOn)
            this.trippyStart[1] = this.blurStart;
        this.blurDistance = this.blurAmount;
        this.xBlur = false;
        this.yBlur = true;
        this.needsRedraw = true;
    }

    doTrippyX() {
        let saveTrippy = this.trippyOn;
        // force trippy
        this.trippyOn = true;
        this.doXBlur();
        this.trippyOn = saveTrippy;
    }

    doTrippyY() {
        let saveTrippy = this.trippyOn;
        // force trippy
        this.trippyOn = true;
        this.doYBlur();
        this.trippyOn = saveTrippy;
    }

    doShutter(beat, beatLength, beatCount) {
        let freeTime = beatLength * beatCount * 0.8;
        // if the beats are super close together, we have to crush the speed down
        // if they're super far apart, keep the effect fast and crisp
        this.shutterDuration = Math.min(0.2, freeTime);

        this.shutterEnd = this.audio.currentTime + this.shutterDuration;
        this.shutterDir = beat;

        this.needsRedraw = true;
    }

    doSlice(beatLength, beatCount, sliceX, sliceY) {
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

    generateSliceSegments(direction) {
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

    resetSliceSegments(direction) {
        this.slices[direction].count = 1;
        this.slices[direction].segments[0] = 1;
        this.slices[direction].distances[0] = 0;
    }

    setBlurDecay(decay) {
        this.blurDecay = {"slow" : 7.8, "medium" : 14.1, "fast" : 20.8, "faster!" : 28.7}[decay];
    }

    setBlurAmount(amount) {
        // flash is pixel counts based off 1280x720 res
        // x is more striking so ignore aspect ratio disparity on y
        this.blurAmount = {"low" : 48/1280, "medium" : 96/1280, "high" : 384/1280}[amount];
    }

    setSmartAlign(align) {
        this.smartAlign = align == "on";
    }
}

window.HuesRender = HuesRender;

})(window, document);
