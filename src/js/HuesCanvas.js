// HTML5 canvas backend for HuesRender

(function(window, document) {
    "use strict";

    /*  Takes root DOM element to attach to */
    class HuesCanvas {
        constructor(root, core) {
            core.addEventListener("settingsupdated", this.settingsUpdated.bind(this));
            this.core = core;

            // 720p has great performance and our images are matched to it.
            // Higher resolutions don't get us many benefits
            this.baseWidth = 1280;
            this.baseHeight = 720;

            this.blurIterations = null;
            this.blurDelta = null;
            this.blurAlpha = null;

            this.trippyRadius = 0;

            // so it can be modified at runtime by aspiring people
            this.shutterWidth = 1;

            // Chosen because it looks decent
            this.setBlurQuality("high");

            this.canvas = document.createElement('canvas');
            this.context = this.canvas.getContext("2d");
            this.canvas.width = this.baseWidth;
            this.canvas.height = this.baseHeight;
            this.canvas.className = "hues-canvas";
            root.appendChild(this.canvas);

            this.offCanvas = document.createElement('canvas');
            this.offContext = this.offCanvas.getContext('2d');

            window.addEventListener('resize', this.resize.bind(this));
            this.resize();
        }

        settingsUpdated() {
            this.setBlurQuality(this.core.settings.blurQuality);
        }

        setBlurQuality(quality) {
            this.blurIterations = {"low" : -1, "medium" : 11, "high" : 19, "extreme" : 35}[quality];
            this.blurDelta = 1 / (this.blurIterations/2);
            this.blurAlpha = 1 / (this.blurIterations/2);
        }

        resize() {
            // height is clamped, we expand width to suit
            let height = this.core.root.clientHeight;
            let ratio = this.core.root.clientWidth / height;
            this.canvas.height = Math.min(height, this.baseHeight);
            this.canvas.width = Math.ceil(this.canvas.height * ratio);
            this.offCanvas.height = this.canvas.height;
            this.offCanvas.width = this.canvas.width;
            this.trippyRadius = Math.max(this.canvas.width, this.canvas.height) / 2;
        }

        /*
        example object:
        {
            colour: 0xFF00FF, // base colour, int
            lastColour: 0xFF00FF, // previous colour, int
            blendMode: 'hard-light',

            overlayColour: '#000', // blackout/whiteout, hex string
            overlayPercent: 0.5,

            invert: false,

            bitmap: 'a bitmap or null',
            bitmapAlign: 'left', // one of 'left','right',null

            // same as bitmap, just the previous image
            lastBitmap: 'a bitmap or null',
            lastBitmapAlign: 'left', // one of 'left','right',null

            shutter: 0.5,
            shutterDir: '→',

            xBlur: 0.5,
            yBlur: 0.0,

            // percent, out starts in center and moves out, in is the reverse
            outTrippy: 0.5,
            inTrippy: 0.3,

            slices: { // null for no slices at all, or...
                x: {
                    count: 1, // 1 for no slice, >1 for slices
                    percent: 0.0, // ignored if count == 1,
                    // randomised "percent of image to create subsequent slice from"
                    segments: [0.024, 0.028, 0.026, ... ],
                    // randomised positive/negative offsets, as percent of width, multiplied by percent
                    distances: [37.2, 41.7, -26.8, ... ],
                },
                y: ... // same format as x
            }
        }
        */
        draw(params) {
            let width = this.canvas.width;
            let height = this.canvas.height;

            // white BG for the hard light filter
            this.context.globalAlpha = 1;
            this.context.globalCompositeOperation = "source-over";

            // optimise the draw
            if(params.overlayPercent >= 1) {
                this.context.fillStyle = this.intToHex(params.overlayColour);
                this.context.fillRect(0,0,width,height);
                if(params.invert) {
                    this.drawInvert();
                }
                return;
            }

            // might be doing a clipping region for shutter
            this.context.save();

            this.context.fillStyle = "#FFF";
            this.context.fillRect(0,0,width,height);

            if(params.shutter) {
                let vertical;
                let reverse;

                switch(params.shutterDir) {
                    case '→':
                        reverse = false;
                        vertical = false;
                        break;
                    case '←':
                        reverse = true;
                        vertical = false;
                        break;
                    case '↑':
                        reverse = true;
                        vertical = true;
                        break;
                    case '↓':
                        reverse = false;
                        vertical = true;
                        break;
                }

                let full;
                if(vertical) {
                    full = height+this.shutterWidth;
                } else {
                    full = width+this.shutterWidth;
                }

                let edge = Math.floor(full * params.shutter);
                if(reverse) {
                    edge = full - edge;
                }

                let region1 = new Path2D();
                let region2 = new Path2D();
                if(vertical) {
                    region1.rect(0, edge, width, full-edge);
                    region2.rect(0, 0, width, edge-this.shutterWidth);
                } else {
                    region1.rect(edge, 0, full-edge, height);
                    region2.rect(0, 0, edge-this.shutterWidth, height);
                }

                if(reverse) {
                    let tmp = region1;
                    region1 = region2;
                    region2 = tmp;
                }

                // make the shutter itself black
                this.context.fillStyle = "#000";
                if(vertical) {
                    this.context.fillRect(0, edge-this.shutterWidth, width, this.shutterWidth);
                } else {
                    this.context.fillRect(edge-this.shutterWidth, 0, this.shutterWidth, height);
                }

                // clip the underlay image and draw it
                this.context.save();
                this.context.clip(region1);

                this.drawBitmap(
                    params.lastBitmap,
                    params.lastBitmapAlign,
                    width, height,
                    params.slices,
                    params.xBlur, params.yBlur);

                this.drawColour(
                    params.lastColour, params.blendMode,
                    params.outTrippy, params.inTrippy,
                    width, height);

                this.context.restore();

                // clip the overlay and continue
                this.context.clip(region2);
            }

            this.drawBitmap(
                params.bitmap,
                params.bitmapAlign,
                width, height,
                params.slices,
                params.xBlur, params.yBlur);

            this.drawColour(
                params.colour, params.blendMode,
                params.outTrippy, params.inTrippy,
                width, height);

            // all operations after this affect the entire image
            this.context.restore();

            if(params.overlayPercent > 0) {
                this.context.globalAlpha = params.overlayPercent;
                this.context.fillStyle = this.intToHex(params.overlayColour);
                this.context.fillRect(0,0,width,height);
            }

            if(params.invert) {
                this.drawInvert();
            }
        }

        drawBitmap(bitmap, bitmapAlign, width, height, slices, xBlur, yBlur) {
            let offset; // for centering/right/left align

            if(bitmap) {
                let drawHeight = bitmap.height * (height / bitmap.height);
                let drawWidth = (bitmap.width / bitmap.height) * drawHeight;
                switch(bitmapAlign) {
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

                if(slices) {
                    bitmap = this.drawSlice(slices, bitmap, drawWidth, drawHeight, width, height);
                    drawWidth = width;
                    drawHeight = height;
                }

                if(xBlur || yBlur) {
                    this.drawBlur(bitmap, offset, drawWidth, drawHeight, xBlur, yBlur);
                } else {
                    this.context.globalAlpha = 1;
                    this.context.drawImage(bitmap, offset, 0, drawWidth, drawHeight);
                }
            }
        }

        drawColour(colour, blendMode, outTrippy, inTrippy, width, height) {
            if(outTrippy || inTrippy) {
                this.drawTrippy(outTrippy, inTrippy, colour, width, height);
            } else {
                this.offContext.fillStyle = this.intToHex(colour);
                this.offContext.fillRect(0,0,width,height);
            }
            this.context.globalAlpha = 0.7;
            this.context.globalCompositeOperation = blendMode;
            this.context.drawImage(this.offCanvas, 0, 0);
        }

        drawInvert() {
            this.context.globalAlpha = 1;
            this.context.globalCompositeOperation = "difference";
            this.context.fillStyle = "#FFF";
            this.context.fillRect(0,0,this.canvas.width,this.canvas.height);
        }

        drawSlice(slices, bitmap, drawWidth, drawHeight, width, height) {
            this.offContext.clearRect(0,0,width,height);

            let bitmapXOffset = 0;
            let drawXOffset = 0;
            for (let i = 0; i < slices.x.count; i++) {
                let xSegment = slices.x.segments[i];
                let sliceXDistance = slices.x.distances[i] * slices.x.percent * this.canvas.width;
                let segmentBitmapWidth = Math.ceil(xSegment * bitmap.width);
                let segmentDrawWidth = Math.ceil(xSegment * drawWidth);

                let bitmapYOffset = 0;
                let drawYOffset = 0;
                for (let j = 0; j < slices.y.count; j++) {
                    let ySegment = slices.y.segments[j];
                    let sliceYDistance = slices.y.distances[j] * slices.y.percent * this.canvas.width;
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

        drawBlur(bitmap, offset, drawWidth, drawHeight, xBlur, yBlur) {
            this.context.globalAlpha = this.blurAlpha;
            let dist;
            if(xBlur) {
                // since blur is based on 720p
                dist = xBlur * 720;
                if(this.blurIterations < 0) {
                    this.context.globalAlpha = 1;
                    this.context.drawImage(bitmap, Math.floor(offset - dist/2), 0,
                        drawWidth + dist, drawHeight);
                } else {
                    for(let i=-1; i<=1; i+= this.blurDelta) {
                        this.context.drawImage(bitmap, Math.floor(dist * i) + offset, 0, drawWidth, drawHeight);
                    }
                }
            } else if(yBlur) {
                dist = yBlur * 720;
                if(this.blurIterations < 0) {
                    this.context.globalAlpha = 1;
                    this.context.drawImage(bitmap, offset, Math.floor(-dist/2),
                        drawWidth, drawHeight + this.blurDistance);
                } else {
                    for(let i=-1; i<=1; i+= this.blurDelta) {
                        this.context.drawImage(bitmap, offset, Math.floor(dist * i), drawWidth, drawHeight);
                    }
                }
            }
        }

        // draws the correct trippy colour circles onto the offscreen canvas
        drawTrippy(outTrippy, inTrippy, colour, width, height) {
            outTrippy *= this.trippyRadius;
            inTrippy *= this.trippyRadius;
            // x blur moves inwards from the corners, y comes out
            // So the base colour is inverted for y, normal for x
            // Thus if the y start is more recent, we invert
            let trippyRadii;
            let baseInvert;
            if(outTrippy > inTrippy) {
                baseInvert = true;
                trippyRadii = [outTrippy, inTrippy];
            } else {
                baseInvert = false;
                trippyRadii = [inTrippy, outTrippy];
            }

            let invertC = this.intToHex(0xFFFFFF ^ colour);
            let normalC = this.intToHex(colour);
            this.offContext.fillStyle = baseInvert ? invertC : normalC;
            this.offContext.fillRect(0,0,width,height);

            let invert = !baseInvert;
            for(let i = 0; i < 2; i++) {
                if(trippyRadii[i] === 0) {
                    continue;
                }
                // Invert for each subsequent draw
                this.offContext.beginPath();
                this.offContext.fillStyle = this.intToHex(invert ? invertC : normalC);
                this.offContext.arc(width/2, height/2, Math.floor(trippyRadii[i]), 0, 2 * Math.PI, false);
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
    }

    window.HuesCanvas = HuesCanvas;

})(window, document);
