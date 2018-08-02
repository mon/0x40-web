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

(function(window, document) {
"use strict";

/*  Takes root element to attach to, and an audio context element for
    getting the current time with reasonable accuracy */
class HuesCanvas {
    constructor(root, soundManager, core) {
        this.audio = soundManager;
        soundManager.addEventListener("seek", this.resetEffects.bind(this));
        core.addEventListener("newsong", this.resetEffects.bind(this));
        core.addEventListener("newimage", this.setImage.bind(this));
        core.addEventListener("newcolour", this.setColour.bind(this));
        core.addEventListener("beat", this.beat.bind(this));
        core.addEventListener("invert", this.setInvert.bind(this));
        core.addEventListener("settingsupdated", this.settingsUpdated.bind(this));
        core.addEventListener("frame", this.animationLoop.bind(this));
        this.core = core;

        this.needsRedraw = false;
        this.colour = 0xFFFFFF;
        this.image = null;
        this.smartAlign = true; // avoid string comparisons every frame

        this.animTimeout = null;
        this.animFrame = null;
        this.lastBeat = 0;

        // set later
        this.blurDecay = null;
        this.blurAmount = null;
        this.blurIterations = null;
        this.blurDelta = null;
        this.blurAlpha = null;
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

        // trippy mode
        this.trippyStart = [0, 0]; // x, y
        this.trippyRadii = [0, 0]; // x, y
        // force trippy mode
        this.trippyOn = false;
        this.trippyRadius = 0;

        this.blackout = false;
        this.blackoutColour = "#000"; // for the whiteout case we must store this
        this.blackoutTimeout = null;
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
        this.setBlurQuality("high");
        this.setBlurDecay("fast");

        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext("2d");
        this.canvas.width = 1280;
        this.canvas.height = 720;
        this.canvas.className = "hues-canvas";
        root.appendChild(this.canvas);

        this.offCanvas = document.createElement('canvas');
        this.offContext = this.offCanvas.getContext('2d');

        window.addEventListener('resize', this.resize.bind(this));
        this.resize();
    }

    makeSliceObj(avgSegments) {
        return {
            count       : 0,
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
        this.setBlurQuality(this.core.settings.blurQuality);
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
        // height is max 720px, we expand width to suit
        let height = this.core.root.clientHeight;
        let ratio = this.core.root.clientWidth / height;
        this.canvas.height = Math.min(height, 720);
        this.canvas.width = Math.ceil(this.canvas.height * ratio);
        this.offCanvas.height = this.canvas.height;
        this.offCanvas.width = this.canvas.width;
        this.trippyRadius = Math.max(this.canvas.width, this.canvas.height) / 2;
        this.needsRedraw = true;
    }

    redraw() {
        let offset; // for centering/right/left align
        let bOpacity;
        let width = this.canvas.width;
        let height = this.canvas.height;

        let cTime = this.audio.currentTime;
        // white BG for the hard light filter
        this.context.globalAlpha = 1;
        this.context.globalCompositeOperation = "source-over";
        if(this.blackout) {
            // original is 3 frames at 30fps, this is close
            bOpacity = (cTime - this.blackoutStart)*10;
            if(bOpacity > 1) { // optimise the draw
                // If a short blackout is scheduled, but we missed the image frame
                // from the last one, you can get only black frames over and over
                // this will forcibly swap to the image to increase perceived speed
                if(this.lastBlackout != this.currentBlackout && this.lastFrameBlack) {
                    this.lastFrameBlack = false;
                    this.context.fillStyle = "#FFF";
                    this.context.fillRect(0,0,width,height);
                } else {
                    this.lastFrameBlack = true;
                    this.lastBlackout = this.currentBlackout;
                    this.context.fillStyle = this.blackoutColour;
                    this.context.fillRect(0,0,width,height);
                    this.needsRedraw = false;
                    this.drawInvert();
                    return;
                }
            }
        } else {
            this.lastFrameBlack = false;
            this.context.fillStyle = "#FFF";
            this.context.fillRect(0,0,width,height);
        }

        if(this.image && (this.image.bitmap || this.image.bitmaps)) {
            let bitmap = this.image.animated ?
                this.image.bitmaps[this.animFrame] : this.image.bitmap;
            let drawHeight = bitmap.height * (height / bitmap.height);
            let drawWidth = (bitmap.width / bitmap.height) * drawHeight;
            if(this.smartAlign) {
                switch(this.image.align) {
                    case "left":
                        offset = 0;
                        break;
                    case "right":
                        offset = width - drawWidth;
                        break;
                    default:
                        offset = width/2 - drawWidth/2;
                        break;
                }
            } else {
                offset = width/2 - drawWidth/2;
            }

            if(this.sliceStart) {
                bitmap = this.drawSlice(bitmap, drawWidth, drawHeight, width, height);
                drawWidth = width;
                drawHeight = height;
            }

            if(this.xBlur || this.yBlur) {
                this.drawBlur(bitmap, offset, drawWidth, drawHeight);
            }else {
                this.context.globalAlpha = 1;
                this.context.drawImage(bitmap, offset, 0, drawWidth, drawHeight);
            }
        }

        if(this.trippyStart[0] || this.trippyStart[1]) {
            this.drawTrippy(width, height);
        } else {
            this.offContext.fillStyle = this.intToHex(this.colour);
            this.offContext.fillRect(0,0,width,height);
        }
        this.context.globalAlpha = 0.7;
        this.context.globalCompositeOperation = this.blendMode;
        this.context.drawImage(this.offCanvas, 0, 0);
        if(this.blackout) {
            this.context.globalAlpha = bOpacity;
            this.context.fillStyle = this.blackoutColour;
            this.context.fillRect(0,0,width,height);
            this.needsRedraw = true;
        } else {
            this.needsRedraw = false;
        }
        this.drawInvert();
    }

    drawInvert() {
        if(this.invert) {
            this.context.globalAlpha = 1;
            this.context.globalCompositeOperation = "difference";
            this.context.fillStyle = "#FFF";
            this.context.fillRect(0,0,this.canvas.width,this.canvas.height);
        }
    }

    drawSlice(bitmap, drawWidth, drawHeight, width, height) {
        this.offContext.clearRect(0,0,width,height);

        let bitmapXOffset = 0;
        let drawXOffset = 0;
        for (let i = 0; i < this.slices.x.count; i++) {
            let xSegment = this.slices.x.segments[i];
            let sliceXDistance = this.slices.x.distances[i] * this.sliceDistance;
            let segmentBitmapWidth = Math.ceil(xSegment * bitmap.width);
            let segmentDrawWidth = Math.ceil(xSegment * drawWidth);

            let bitmapYOffset = 0;
            let drawYOffset = 0;
            for (let j = 0; j < this.slices.y.count; j++) {
                let ySegment = this.slices.y.segments[j];
                let sliceYDistance = this.slices.y.distances[j] * this.sliceDistance;
                let segmentBitmapHeight = Math.ceil(ySegment * bitmap.height);
                let segmentDrawHeight = Math.ceil(ySegment * drawHeight);

                this.offContext.drawImage(bitmap,
                    bitmapXOffset, bitmapYOffset,            // subsection x, y
                    segmentBitmapWidth, segmentBitmapHeight, // subsection w, h
                    drawXOffset + sliceYDistance, drawYOffset + sliceXDistance, // drawn x, y
                    segmentDrawWidth, segmentDrawHeight);    // drawn w, h

                bitmapYOffset += segmentBitmapHeight;
                drawYOffset += segmentDrawHeight;
            }

            bitmapXOffset += segmentBitmapWidth;
            drawXOffset += segmentDrawWidth;
        }

        return this.offCanvas;
    }

    drawBlur(bitmap, offset, drawWidth, drawHeight) {
        this.context.globalAlpha = this.blurAlpha;
        if(this.xBlur) {
            if(this.blurIterations < 0) {
                this.context.globalAlpha = 1;
                this.context.drawImage(bitmap, Math.floor(offset - this.blurDistance/2), 0,
                    drawWidth + this.blurDistance, drawHeight);
            } else {
                for(let i=-1; i<=1; i+= this.blurDelta) {
                    this.context.drawImage(bitmap, Math.floor(this.blurDistance * i) + offset, 0, drawWidth, drawHeight);
                }
            }
        } else if(this.yBlur) {
            if(this.blurIterations < 0) {
                this.context.globalAlpha = 1;
                this.context.drawImage(bitmap, offset, Math.floor(-this.blurDistance/2),
                    drawWidth, drawHeight + this.blurDistance);
            } else {
                for(let i=-1; i<=1; i+= this.blurDelta) {
                    this.context.drawImage(bitmap, offset, Math.floor(this.blurDistance * i), drawWidth, drawHeight);
                }
            }
        }
    }

    // draws the correct trippy colour circles onto the offscreen canvas
    drawTrippy(width, height) {
        // x blur moves inwards from the corners, y comes out
        // So the base colour is inverted for y, normal for x
        // Thus if the y start is more recent, we invert
        let baseInvert = this.trippyStart[1] > this.trippyStart[0];
        let invertC = this.intToHex(0xFFFFFF ^ this.colour);
        let normalC = this.intToHex(this.colour);
        this.offContext.fillStyle = baseInvert ? invertC : normalC;
        this.offContext.fillRect(0,0,width,height);

        // sort high to low
        this.trippyRadii.sort(function(a,b) {
            return b - a;
        });

        let invert = !baseInvert;
        for(let i = 0; i < 2; i++) {
            if(this.trippyRadii[i] === 0) {
                continue;
            }
            // Invert for each subsequent draw
            this.offContext.beginPath();
            this.offContext.fillStyle = this.intToHex(invert ? invertC : normalC);
            this.offContext.arc(width/2, height/2, this.trippyRadii[i], 0, 2 * Math.PI, false);
            this.offContext.fill();
            this.offContext.closePath();
            invert = !invert;
        }
    }

    /* Second fastest method from
     http://stackoverflow.com/questions/10073699/pad-a-number-with-leading-zeros-in-javascript
     It stil does millions of ops per second, and isn't ugly like the integer if/else */
    intToHex(num) {
        return '#' + ("00000"+num.toString(16)).slice(-6);
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
        if(this.image && this.image.animated){
            if(this.image.beatsPerAnim && this.core.currentSong && this.core.currentSong.charsPerBeat) {
                let a = this.animFrame;
                this.syncAnim();
                if(this.animFrame != a) {
                    this.needsRedraw = true;
                    // If you change to a non-synced song, this needs to be reset
                    this.animTimeout = this.audio.currentTime;
                }
            } else if(this.animTimeout < this.audio.currentTime) {
                this.animFrame++;
                this.animFrame %= this.image.frameDurations.length;
                // Don't rebase to current time otherwise we may lag
                this.animTimeout += this.image.frameDurations[this.animFrame]/1000;
                this.needsRedraw = true;
            }
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
            this.needsRedraw = true;
        }
        for(let i = 0; i < 2; i++) {
            if(this.trippyStart[i] || this.trippyRadii[i]) {
                this.needsRedraw = true;
                this.trippyRadii[i] = Math.floor((this.audio.currentTime - this.trippyStart[i]) * this.trippyRadius) * 2;
                if(this.trippyRadii[i] > this.trippyRadius) {
                    this.trippyStart[i] = 0;
                    this.trippyRadii[i] = 0;
                    continue;
                }
                // x comes from outside the window
                if(i % 2 === 0) {
                    this.trippyRadii[i] = this.trippyRadius - this.trippyRadii[i];
                }
            }
        }

        if(this.blurStart && this.blurDistance < 1) {
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
        if(this.image == image) {
            return;
        }
        this.needsRedraw = true;
        this.image = image;
        // Null images don't need anything interesting done to them
        if(!image || (!image.bitmap && !image.bitmaps)) {
            return;
        }
        if(image.animated) {
            this.animBeat = null;
            this.animFrame = 0;
            this.animTimeout = this.audio.currentTime + image.frameDurations[0]/1000;
            if(image.beatsPerAnim && this.core.currentSong && this.core.currentSong.charsPerBeat) {
                this.syncAnim();
            }
        }
    }

    beat() {
        this.lastBeat = this.audio.currentTime;
    }

    syncAnim() {
        let song = this.core.currentSong;
        if(!song) { // fallback to default
           return;
        }
        let index = this.core.beatIndex;
        // When animation has more frames than song has beats, or part thereof
        if(this.lastBeat && this.core.getBeatLength()) {
            let interp = (this.audio.currentTime - this.lastBeat) / this.core.getBeatLength();
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

    setColour(colour, isFade) {
        if(colour.c == this.colour) {
            return;
        }
        if(isFade) {
            this.newColour = colour.c;
        } else {
            this.stopFade();
            this.colour = colour.c;
        }
        this.needsRedraw = true;
    }

    doBlackout(whiteout) {
        if(typeof(whiteout) === 'undefined') whiteout = false;
        if(whiteout) {
            this.blackoutColour = "#FFF";
        } else {
            this.blackoutColour = "#000";
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

    doShortBlackout(beatTime) {
        // looks better if we go right to black
        this.doInstantBlackout();
        this.blackoutTimeout = this.audio.currentTime + beatTime / 1.7;
        this.currentBlackout++;
    }

    doInstantBlackout() {
        this.doBlackout();
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

    setBlurQuality(quality) {
        this.blurIterations = {"low" : -1, "medium" : 11, "high" : 19, "extreme" : 35}[quality];
        this.blurDelta = 1 / (this.blurIterations/2);
        this.blurAlpha = 1 / (this.blurIterations/2);
    }

    setBlurAmount(amount) {
        this.blurAmount = {"low" : 48, "medium" : 96, "high" : 384}[amount];
    }

    setSmartAlign(align) {
        this.smartAlign = align == "on";
    }
}

window.HuesCanvas = HuesCanvas;

})(window, document);