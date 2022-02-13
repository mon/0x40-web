// PixiJS backend for HuesRender

import * as PIXI from 'pixi.js';
// hard light doesn't work natively, need a filter
import { HardlightFilter } from './PixiHardLight';

(function(window, document) {
    "use strict";

    /*  Takes root DOM element to attach to */
    class HuesPixi {
        constructor(root, core) {
            core.addEventListener("settingsupdated", this.settingsUpdated.bind(this));
            this.core = core;

            // 720p has great performance and our images are matched to it.
            // Higher resolutions don't get us many benefits
            this.baseWidth = 1280;
            this.baseHeight = 720;

            this.trippyRadius = 0;

            this.blurIterations = null;
            this.blurMulti = null;
            // Chosen because it looks decent
            this.setBlurQuality("high");

            this.lastImage = null;

            this.app = new PIXI.Application({ width: this.baseWidth, height: this.baseHeight });

            // create our render stack
            this.background = new PIXI.Graphics();
            this.app.stage.addChild(this.background);

            this.image = new PIXI.Container();
            this.app.stage.addChild(this.image);

            // colour shenanigans because hardlight is too hard???
            //this.renderTexture = PIXI.RenderTexture.create({});
            // colour is not in a container
            //this.colour = new PIXI.Graphics();
            //this.colour.alpha = 0.7;

            //this.test = new Sprite(this.renderTexture);
            //this.app.stage.addChild(this.test);
            //this.app.stage.addChild(this.colour);

            // this.overlay = new PIXI.Graphics();
            // this.app.stage.addChild(this.overlay);

            this.hardLight = new HardlightFilter();
            //this.app.stage.filters = [filter];
            this.app.stage.filters = [this.hardLight];

            this.app.view.className = "hues-canvas2";
            root.appendChild(this.app.view);

            window.addEventListener('resize', this.resize.bind(this));
            this.resize();
        }

        settingsUpdated() {
            this.setBlurQuality(this.core.settings.blurQuality);
        }

        setBlurQuality(quality) {
            this.blurIterations = {"low" : 3, "medium" : 5, "high" : 15, "extreme" : 35}[quality];
            this.blurMulti = {"low" : 1, "medium" : 1, "high" : 2, "extreme" : 3}[quality];
        }

        resize() {
            // height is clamped, we expand width to suit
            let height = this.core.root.clientHeight;
            let ratio = this.core.root.clientWidth / height;
            this.app.view.height = Math.min(height, this.baseHeight);
            this.app.view.width = Math.ceil(this.app.view.height * ratio);

            this.trippyRadius = Math.max(this.app.view.width, this.app.view.height) / 2;

            // white BG for the hard light filter
            this.background.clear();
            this.background.beginFill(0xFFFFFF);
            this.background.drawRect(0,0,this.app.view.width,this.app.view.height);

            let screenRect = new PIXI.Rectangle(0, 0,
                this.app.renderer.width / this.app.renderer.resolution,
                this.app.renderer.height / this.app.renderer.resolution);
            this.app.stage.filterArea = screenRect;
            // this.app.stage.filters = [new PIXI.filters.AlphaFilter(0.1)];

            //this.renderTexture.resize(this.app.screen.width, this.app.screen.height, true);
        }

        /*
        example object:
        {
            colour: 0xFF00FF, // base colour, int
            blendMode: 'hard-light',

            overlayColour: 0x000000, // blackout/whiteout, int
            overlayPercent: 0.5,

            invert: false,

            bitmap: 'a bitmap or null',
            bitmapAlign: 'left', // one of 'left','right',null

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
            let width = this.app.view.width;
            let height = this.app.view.height;

            if(params.bitmap) {
                if(params.bitmap.sprite === undefined) {
                    params.bitmap.sprite = new PIXI.Sprite.from(params.bitmap);

                    params.bitmap.blur = new PIXI.filters.BlurFilter();
                    params.bitmap.sprite.filters = [params.bitmap.blur];

                    this.app.stage.addChild(params.bitmap.sprite);
                }

                let drawHeight = params.bitmap.height * (height / params.bitmap.height);
                let drawWidth = (params.bitmap.width / params.bitmap.height) * drawHeight;
                switch(params.bitmapAlign) {
                    case "left":
                        params.bitmap.sprite.x = 0;
                        break;
                    case "right":
                        params.bitmap.sprite.x = width - drawWidth;
                        break;
                    default:
                        params.bitmap.sprite.x = width/2 - drawWidth/2;
                        break;
                }

                if(params.slices) {
                    params.bitmap = this.drawSlice(params.slices, params.bitmap, drawWidth, drawHeight, width, height);
                    drawWidth = width;
                    drawHeight = height;
                }

                // extra multipliers makes PIXI blurs match flash blur more closely
                // quality makes the blur appear perceptually less....
                params.bitmap.blur.blurX = params.xBlur * 720 * this.blurMulti;
                params.bitmap.blur.blurY = params.yBlur * 720 * this.blurMulti;
                params.bitmap.blur.quality = this.blurIterations;
                params.bitmap.sprite.alpha = 1;
                if(this.lastImage && this.lastImage != params.bitmap.sprite) {
                    this.lastImage.alpha = 0;
                }
                this.lastImage = params.bitmap.sprite;
            }

            if(params.outTrippy || params.inTrippy) {
                this.drawTrippy(params.outTrippy, params.inTrippy, params.colour, width, height);
            } else {
                // TODO TODO params.blendMode
                //this.test.filters = getBlendFilterArray(PIXI.BLEND_MODES.HARD_LIGHT);
                //this.renderTexture.filters = getBlendFilterArray(PIXI.BLEND_MODES.HARD_LIGHT);
                //this.colour.filters = getBlendFilterArray(PIXI.BLEND_MODES.HARD_LIGHT);
                // this.colour.clear();
                // this.colour.beginFill(params.colour);
                // this.colour.drawRect(0,0,width,height);
                //this.app.renderer.render(this.colour,this.renderTexture);
                this.hardLight.colour = params.colour;
            }

            this.hardLight.overlay = [params.overlayColour, params.overlayPercent];

            if(params.invert) {
                this.drawInvert();
            }
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
                dist = xBlur * this.canvas.width;
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
                dist = yBlur * this.canvas.width;
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

    window.HuesPixi = HuesPixi;

})(window, document);
