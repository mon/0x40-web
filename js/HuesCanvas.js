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

/*  Takes an element name to attach to, and an audio context element for
    getting the current time with reasonable accuracy */
function HuesCanvas(element, aContext, core) {
    'use strict';
    this.aContext = aContext;
    this.core = core;

    this.needsRedraw = false;
    this.colour = 0xFFFFFF;
    this.image = null;
    this.smartAlign = true; // avoid string comparisons every frame

    this.animTimeout = null;
    this.animFrame = null;
    this.animSync = false; // for synced anims

    // set later
    this.blurDecay = null;
    this.blurAmount = null;
    this.blurIterations = null;
    this.blurMin = null;
    this.blurMax = null;
    this.blurDelta = null;
    this.blurAlpha = null;
    // dynamic
    this.blurStart = 0;
    this.blurDistance = 0;
    this.xBlur = false;
    this.yBlur = false;

    this.blackout = false;
    this.blackoutColour = "#000"; // for the whiteout case we must store this
    this.blackoutTimeout = null;

    this.colourFade = false;
    this.colourFadeStart=0;
    this.colourFadeLength=0;
    this.oldColour=0xFFFFFF;
    this.newColour=0xFFFFFF;
    this.serialColour = 0;

    this.blendMode = "hard-light";
    // Chosen because they look decent
    this.setBlurAmount("medium");
    this.setBlurQuality("high");
    this.setBlurDecay("fast");
    this.canvas = document.getElementById(element).getContext("2d");
    window.addEventListener('resize', this.resizeHandler(this));
    this.resize();

    this.animating = true;
    requestAnimationFrame(this.getAnimLoop());
}

HuesCanvas.prototype.sendSerial = function() {
    if(!ser)
        return;
    var col = this.colour;
    if(this.blackout) {
        bOpacity = (this.aContext.currentTime - this.blackoutStart)*10;
        bOpacity = Math.min(1, bOpacity);
        col *= 1 - bOpacity;
        col = Math.floor(col);
    }
    if(col == this.serialColour)
        return;
    this.serialColour = col;
    var str = String(col);
    for(var i = 0; i < str.length; i++) {
        ser.send(str[i]);
    }
    ser.send("\n".charCodeAt(0));
}

HuesCanvas.prototype.resizeHandler = function(that) {
    return function() {that.resize();};
}

HuesCanvas.prototype.resize = function() {
    // height is constant 720px, we expand width to suit
    var ratio = window.innerWidth / window.innerHeight;
    this.canvas.canvas.width = 720 * ratio + 1;
    this.needsRedraw = true;
}

HuesCanvas.prototype.redraw = function() {
    var offset; // for centering/right/left align
    var bOpacity;
    var width = this.canvas.canvas.width;

    var cTime = this.aContext.currentTime;
    // white BG for the hard light filter
    this.canvas.globalAlpha = 1;
    this.canvas.globalCompositeOperation = "source-over";
    if(this.blackout) {
        // original is 3 frames at 30fps, this is close
        bOpacity = (cTime - this.blackoutStart)*10;
        if(bOpacity > 1) { // optimise the draw
            this.canvas.fillStyle = this.blackoutColour;
            this.canvas.fillRect(0,0,width,720);
            this.needsRedraw = false;
            return;
        }
    } else {
        this.canvas.fillStyle = "#FFF";
        this.canvas.fillRect(0,0,width,720);
    }

    if(this.image && (this.image.bitmap || this.image.bitmaps)) {
        var bitmap = this.image.animated ?
            this.image.bitmaps[this.animFrame] : this.image.bitmap;
        if(this.smartAlign) {
            switch(this.image.align) {
                case "left":
                    offset = 0;
                    break;
                case "right":
                    offset = width - bitmap.width;
                    break;
                default:
                    offset = width/2 - bitmap.width/2;
                    break;
            }
        } else {
            offset = width/2 - bitmap.width/2;
        }
        if(this.xBlur || this.yBlur) {
            this.canvas.globalAlpha = this.blurAlpha;
        }
        if(this.xBlur) {
            for(var i=this.blurMin; i<=this.blurMax; i+= this.blurDelta) {
                this.canvas.drawImage(bitmap, Math.floor(this.blurDistance * i) + offset, 0);
            }
        } else if(this.yBlur) {
            for(var i=this.blurMin; i<=this.blurMax; i+= this.blurDelta) {
                this.canvas.drawImage(bitmap, offset, Math.floor(this.blurDistance * i));
            }
        } else {
            this.canvas.globalAlpha = 1;
            this.canvas.drawImage(bitmap, offset, 0);
        }
    }
    this.canvas.globalAlpha = 0.7;
    this.canvas.fillStyle = this.intToHex(this.colour);
    this.canvas.globalCompositeOperation = this.blendMode;
    this.canvas.fillRect(0,0,width,720);
    if(this.blackout) {
        this.canvas.globalAlpha = bOpacity;
        this.canvas.fillStyle = this.blackoutColour;
        this.canvas.fillRect(0,0,width,720);
        this.needsRedraw = true;
    } else {
        this.needsRedraw = false;
    }
}

/* Second fastest method from
 http://stackoverflow.com/questions/10073699/pad-a-number-with-leading-zeros-in-javascript
 It stil does millions of ops per second, and isn't ugly like the integer if/else */
HuesCanvas.prototype.intToHex = function(num) {
    return '#' + ("00000"+num.toString(16)).slice(-6);
}

HuesCanvas.prototype.getAnimLoop = function() {
    var that = this;
    return function() {that.animationLoop()};
}

HuesCanvas.prototype.animationLoop = function() {
    if (this.colourFade) {
        var delta = this.aContext.currentTime - this.colourFadeStart;
        var fadeVal = delta / this.colourFadeLength;
        if (fadeVal >= 1) {
            this.stopFade();
            this.colour = this.newColour;
        } else {
            this.mixColours(fadeVal);
        }
        this.needsRedraw = true;
    }
    if(this.blackoutTimeout && this.aContext.currentTime > this.blackoutTimeout) {
        this.clearBlackout();
    }
    if(this.image && this.image.animated){
        if(this.image.beatsPerAnim && this.core.currentSong && this.core.currentSong.charsPerBeat) {
            var a = this.animFrame;
            this.syncAnim();
            if(this.animFrame != a) {
                this.needsRedraw = true;
                // If you change to a non-synced song, this needs to be reset
                this.animTimeout = this.aContext.currentTime;
            }
        } else if(this.animTimeout < this.aContext.currentTime) {
            this.animFrame++;
            this.animFrame %= this.image.frameDurations.length;
            // Don't rebase to current time otherwise we may lag
            this.animTimeout += this.image.frameDurations[this.animFrame]/1000;
            this.needsRedraw = true;
        }
    }
    if(this.blurStart) {
        var delta = this.aContext.currentTime - this.blurStart;
        this.blurDistance = this.blurAmount * Math.exp(-this.blurDecay * delta);
        
        // Update UI
        var dist = this.blurDistance / this.blurAmount;
        if(this.xBlur)
            this.core.blurUpdated(dist, 0);
        else
            this.core.blurUpdated(0, dist);
    }
    if(this.blurStart && this.blurDistance < 0.3) {
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
    if(this.animating) {
        requestAnimationFrame(this.getAnimLoop());
    }
    this.sendSerial();
}

HuesCanvas.prototype.setImage = function(image) {
    this.needsRedraw = true;
    this.image = image;
    // Null images don't need anything interesting done to them
    if(!image || (!image.bitmap && !image.bitmaps)) {
        return;
    }
    if(image.animated) {
        this.animBeat = null;
        this.animFrame = 0;
        this.animTimeout = this.aContext.currentTime + image.frameDurations[0]/1000;
        if(image.beatsPerAnim && this.core.currentSong && this.core.currentSong.charsPerBeat) {
            this.syncAnim();
        }
    }
}

HuesCanvas.prototype.syncAnim = function() {
    var song = this.core.currentSong;
    if(!song) { // fallback to default
       return;
    }
    // This loops A-OK because the core's beatIndex never rolls over for a new loop
    var beatLoc = (this.core.beatIndex / song.charsPerBeat) % this.image.beatsPerAnim;
    this.animFrame = Math.floor(this.image.bitmaps.length * (beatLoc / this.image.beatsPerAnim));
    // for build
    if(this.animFrame < 0) {
        this.animFrame += this.image.bitmaps.length;
    }
    this.animSync = true;
}

HuesCanvas.prototype.setColour = function(colour, isFade) {
    if(isFade) {
        this.newColour = colour;
    } else {
        this.stopFade();
        this.colour = colour;
    }
    this.needsRedraw = true;
}

HuesCanvas.prototype.doBlackout = function(whiteout) {
    if (typeof(whiteout)==='undefined') whiteout = false;
    if(whiteout) {
        this.blackoutColour = "#FFF";
    } else {
        this.blackoutColour = "#000";
    }
    this.blackoutTimeout = 0; // indefinite
    this.blackoutStart = this.aContext.currentTime;
    this.blackout = true;
    this.needsRedraw = true;
    if(localStorage["blackoutUI"] == "on") {
        this.core.userInterface.hide();
    }
}

// for song changes
HuesCanvas.prototype.clearBlackout = function() {
    this.blackout = false;
    this.blackoutTimeout = 0;
    this.needsRedraw = true;
    if(localStorage["blackoutUI"] == "on") {
        this.core.userInterface.show();
    }
}

HuesCanvas.prototype.doShortBlackout = function(beatTime) {
    this.doBlackout();
    this.blackoutTimeout = this.aContext.currentTime + beatTime / 1.7;
    // looks better if we go right to black
    this.blackoutStart = 0;
}

HuesCanvas.prototype.doColourFade = function(length) {
    this.colourFade = true;
    this.colourFadeLength = length;
    this.colourFadeStart = this.aContext.currentTime;
    this.oldColour = this.colour;
}

HuesCanvas.prototype.stopFade = function() {
    this.colourFade = false;
    this.colourFadeStart = 0;
    this.colourFadeLength = 0;
}

HuesCanvas.prototype.mixColours = function(percent) {
    percent = Math.min(1, percent);
    var oldR = this.oldColour >> 16 & 0xFF;
    var oldG = this.oldColour >> 8  & 0xFF;
    var oldB = this.oldColour       & 0xFF;
    var newR = this.newColour >> 16 & 0xFF;
    var newG = this.newColour >> 8  & 0xFF;
    var newB = this.newColour       & 0xFF;
    var mixR = oldR * (1 - percent) + newR * percent;
    var mixG = oldG * (1 - percent) + newG * percent;
    var mixB = oldB * (1 - percent) + newB * percent;
    this.colour = mixR << 16 | mixG << 8 | mixB;
}

HuesCanvas.prototype.doXBlur = function() {
    this.blurStart = this.aContext.currentTime;
    this.blurDistance = this.blurAmount;
    this.xBlur = true;
    this.yBlur = false;
    this.needsRedraw = true;
}

HuesCanvas.prototype.doYBlur = function() {
    this.blurStart = this.aContext.currentTime;
    this.blurDistance = this.blurAmount;
    this.xBlur = false;
    this.yBlur = true;
    this.needsRedraw = true;
}

HuesCanvas.prototype.setBlurDecay = function(decay) {
    this.blurDecay = {"slow" : 10, "medium" : 15, "fast" : 22, "faster!" : 30}[decay];
}

HuesCanvas.prototype.setBlurQuality = function(quality) {
    this.blurIterations = {"low" : 3, "medium" : 11, "high" : 19, "extreme" : 35}[quality];
    this.blurDelta = this.blurAmount / this.blurIterations;
    this.blurAlpha = 1/(this.blurIterations/2);
}

HuesCanvas.prototype.setBlurAmount = function(amount) {
    this.blurAmount = {"low" : 9, "medium" : 15, "high" : 25}[amount];
    this.blurMin = -this.blurAmount/2;
    this.blurMax = this.blurAmount/2;
    this.blurDelta = this.blurAmount / this.blurIterations;
}

HuesCanvas.prototype.setSmartAlign = function(align) {
    this.smartAlign = align == "on";
}

HuesCanvas.prototype.setAnimating = function(anim) {
    if(!this.animating && anim) {
        requestAnimationFrame(this.animationLoop);
    }
    this.animating = anim;
}