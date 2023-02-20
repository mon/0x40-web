// HTML5 canvas backend for HuesRender

import {
  type RenderParams,
  type HuesCanvas,
  calculateImageDrawCoords,
} from "./HuesRender";
import type { SettingsData } from "./HuesSettings";
import { mixColours, intToHex } from "./Utils";

// can't just use CanvasImageSource since some of the options (SVG stuff) don't
// have width/height
type Drawable = HTMLImageElement | HTMLCanvasElement | undefined;

/*  Takes root DOM element to attach to */
export default class HuesCanvas2D implements HuesCanvas {
  root: HTMLElement;

  baseHeight: number;

  blurIterations!: number;
  blurDelta!: number;
  blurAlpha!: number;
  blurFinalAlpha!: number;

  invertEverything!: boolean;

  trippyRadius: number;
  shutterWidth: number;

  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;

  // these may be better suited as arrays but somehow I can visualise this better
  offCanvas: HTMLCanvasElement;
  offContext: CanvasRenderingContext2D;
  offCanvas2: HTMLCanvasElement;
  offContext2: CanvasRenderingContext2D;
  offCanvas3: HTMLCanvasElement;
  offContext3: CanvasRenderingContext2D;

  constructor(root: HTMLElement, height = 720) {
    this.root = root;

    this.baseHeight = height;

    this.trippyRadius = 0;

    // so it can be modified at runtime by aspiring people
    this.shutterWidth = 1;

    // Chosen because it looks decent
    this.setBlurQuality("high");

    // matches the flash
    this.setInvertStyle("everything");

    this.canvas = document.createElement("canvas");
    // marked as never-null because if this fails, you're screwed
    this.context = this.canvas.getContext("2d")!;
    this.canvas.className = "hues-canvas";
    root.appendChild(this.canvas);

    this.offCanvas = document.createElement("canvas");
    this.offContext = this.offCanvas.getContext("2d")!;

    this.offCanvas2 = document.createElement("canvas");
    this.offContext2 = this.offCanvas2.getContext("2d")!;

    this.offCanvas3 = document.createElement("canvas");
    this.offContext3 = this.offCanvas3.getContext("2d")!;
  }

  get width() {
    return this.canvas.width;
  }

  get height() {
    return this.canvas.height;
  }

  setInvertStyle(style: SettingsData["invertStyle"]) {
    this.invertEverything = style === "everything";
  }

  setBlurQuality(quality: SettingsData["blurQuality"]) {
    this.blurIterations = { low: -1, medium: 11, high: 19, extreme: 35 }[
      quality
    ];
    // you might be thinking "hey aren't you approximating a gaussian
    // blur, shouldn't this be not constant?" and you would be right,
    // but HTML canvas does not support additive alpha operations, only
    // multiplicative. As a result, once the image merges fully
    // together, you get an opacity that isn't quite fully there. It'd
    // be better to invest effort into a GPU renderer that *can* support
    // additive alpha, than work out a clean algorithm to properly fix
    // this (because it won't work properly on greyscale anyway, I
    // think...)
    this.blurDelta = 1 / (this.blurIterations / 2);
    this.blurAlpha = 1 / (this.blurIterations / 2);
    // because, again, premultiplied alpha, the final stack isn't fully
    // opaque. To avoid a "pop" as the non-blurred render kicks in, we
    // actually render at this opacity. Sucks, but whatever... Worse case is
    // "extreme" which renders at 87% final opacity.
    this.blurFinalAlpha = 1 - Math.pow(1 - this.blurAlpha, this.blurIterations);
    // but low quality can just use full alpha
    if (this.blurIterations == -1) {
      this.blurFinalAlpha = 1;
    }
  }

  resize() {
    // height is clamped, we expand width to suit
    let height = this.root.clientHeight;
    let ratio = this.root.clientWidth / height;
    this.canvas.height = Math.min(height, this.baseHeight);
    this.canvas.width = Math.ceil(this.canvas.height * ratio);
    this.offCanvas.height = this.canvas.height;
    this.offCanvas.width = this.canvas.width;
    this.offCanvas2.height = this.canvas.height;
    this.offCanvas2.width = this.canvas.width;
    this.offCanvas3.height = this.canvas.height;
    this.offCanvas3.width = this.canvas.width;
    // to fill a square to the edges
    this.trippyRadius =
      (Math.max(this.canvas.width, this.canvas.height) / 2) * Math.SQRT2;
  }

  draw(params: RenderParams) {
    let width = this.canvas.width;
    let height = this.canvas.height;

    // white BG for the hard light filter
    this.context.globalAlpha = 1;
    this.context.globalCompositeOperation = "source-over";

    // optimise the draw
    if (params.overlayPercent >= 1) {
      this.drawOverlay(
        params.overlayPercent,
        params.overlayColour,
        params.invert
      );
      return;
    }

    // might be doing a clipping region for shutter
    this.context.save();

    this.context.globalAlpha = 1;
    this.context.globalCompositeOperation = "source-over";

    if (params.bgColour === "transparent") {
      this.context.clearRect(0, 0, width, height);
    } else {
      this.context.fillStyle = intToHex(params.bgColour);
      this.context.fillRect(0, 0, width, height);
    }

    if (params.shutter !== undefined) {
      let vertical;
      let reverse;

      switch (params.shutterDir) {
        case "→":
          reverse = false;
          vertical = false;
          break;
        case "←":
          reverse = true;
          vertical = false;
          break;
        case "↑":
          reverse = true;
          vertical = true;
          break;
        case "↓":
          reverse = false;
          vertical = true;
          break;
      }

      let full;
      if (vertical) {
        full = height + this.shutterWidth;
      } else {
        full = width + this.shutterWidth;
      }

      let edge = Math.floor(full * params.shutter);
      if (reverse) {
        edge = full - edge;
      }

      let region1 = new Path2D();
      let region2 = new Path2D();
      if (vertical) {
        region1.rect(0, edge, width, full - edge);
        region2.rect(0, 0, width, edge - this.shutterWidth);
      } else {
        region1.rect(edge, 0, full - edge, height);
        region2.rect(0, 0, edge - this.shutterWidth, height);
      }

      if (reverse) {
        let tmp = region1;
        region1 = region2;
        region2 = tmp;
      }

      // make the shutter itself black
      this.context.fillStyle = "#000";
      if (vertical) {
        this.context.fillRect(
          0,
          edge - this.shutterWidth,
          width,
          this.shutterWidth
        );
      } else {
        this.context.fillRect(
          edge - this.shutterWidth,
          0,
          this.shutterWidth,
          height
        );
      }

      // clip the underlay image and draw it
      this.context.save();
      this.context.clip(region1);

      this.drawBitmap(
        params.lastBitmap,
        params.lastBitmapAlign,
        width,
        height,
        params.slices,
        params.xBlur,
        params.yBlur,
        params.invert,
        params.lastBitmapCenter,
        params.border,
        params.centerLine
      );

      this.drawColour(
        params.lastColour,
        params.blendMode,
        params.bgColour,
        params.outTrippy,
        params.inTrippy,
        width,
        height
      );

      this.context.restore();

      // clip the overlay and continue
      this.context.clip(region2);
    }

    this.drawBitmap(
      params.bitmap,
      params.bitmapAlign,
      width,
      height,
      params.slices,
      params.xBlur,
      params.yBlur,
      params.invert,
      params.bitmapCenter,
      params.border,
      params.centerLine
    );

    const colour =
      params.colourFade !== undefined
        ? mixColours(params.lastColour, params.colour, params.colourFade)
        : params.colour;

    this.drawColour(
      colour,
      params.blendMode,
      params.bgColour,
      params.outTrippy,
      params.inTrippy,
      width,
      height
    );

    // all operations after this affect the entire image
    this.context.restore();

    if (params.invert && this.invertEverything) {
      this.drawInvert(params.invert);
    }

    if (params.overlayPercent > 0) {
      this.drawOverlay(
        params.overlayPercent,
        params.overlayColour,
        params.invert
      );
    }
  }

  drawOverlay(percent: number, colour: number, invert: number) {
    // If we draw the overlay and then invert, and the overlay and invert
    // percent are identical, and the overlay colour is white, the invert
    // actually cancels itself out... So we always draw this with a precomputed
    // invert colour and do any "real" inverts beforehand
    this.context.globalCompositeOperation = "source-over";
    this.context.globalAlpha = percent;
    this.context.fillStyle = intToHex(mixColours(colour, ~colour, invert));
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawBitmap(
    bitmap: Drawable,
    bitmapAlign: RenderParams["bitmapAlign"],
    width: number,
    height: number,
    slices: RenderParams["slices"],
    xBlur: number,
    yBlur: number,
    invert: number,
    bitmapCenter?: number,
    borders?: boolean,
    centerLine?: boolean
  ) {
    if (!bitmap) {
      return;
    }

    let [x, _y, drawWidth, drawHeight, scaledBitmapCenter] =
      calculateImageDrawCoords(
        width,
        height,
        bitmap.width,
        bitmap.height,
        bitmapAlign,
        bitmapCenter
      );

    // the debugging draws have to happen last, but these are modified in between
    const origHeight = drawHeight;
    const origWidth = drawWidth;
    const origX = x;

    // invert image-only if needed, correctly handling cursed transparency
    // see drawColour for more information
    if (invert && !this.invertEverything) {
      // invert layer
      this.offContext3.globalCompositeOperation = "copy";
      this.offContext3.fillStyle = intToHex(mixColours(0, 0xffffff, invert));
      this.offContext3.fillRect(0, 0, this.canvas.width, this.canvas.height);
      // mask with image
      this.offContext3.globalCompositeOperation = "destination-in";
      this.offContext3.drawImage(bitmap, x, 0, drawWidth, drawHeight);

      // perform invert for real
      this.offContext3.globalCompositeOperation = "difference";
      this.offContext3.drawImage(bitmap, x, 0, drawWidth, drawHeight);

      // since the bitmap is replaced with a correctly offset and scaled version
      drawWidth = width;
      drawHeight = height;
      x = 0;

      bitmap = this.offCanvas3;
    }

    if (slices) {
      bitmap = this.drawSlice(
        slices,
        bitmap,
        x,
        drawWidth,
        drawHeight,
        width,
        height
      );
      // since the bitmap is replaced with a correctly offset and scaled version
      drawWidth = width;
      drawHeight = height;
      x = 0;
    }

    if (xBlur || yBlur) {
      this.drawBlur(bitmap, x, drawWidth, drawHeight, xBlur, yBlur);
    } else {
      this.context.globalAlpha = this.blurFinalAlpha;
      this.context.drawImage(bitmap, x, 0, drawWidth, drawHeight);
    }

    // debug stuff
    if (borders) {
      this.context.strokeStyle = "#f00";
      this.context.lineWidth = 1;
      this.context.strokeRect(origX, 0, origWidth, origHeight);
    }
    if (centerLine && scaledBitmapCenter !== undefined) {
      const center = origX + scaledBitmapCenter;
      this.context.strokeStyle = "#0f0";
      this.context.lineWidth = 1;
      // this produces 2 lines sometimes for some reason
      // this.context.strokeRect(center, 0, center, origHeight);
      this.context.beginPath();
      this.context.moveTo(center, 0);
      this.context.lineTo(center, origHeight);
      this.context.stroke();
    }
  }

  drawColour(
    colour: number,
    blendMode: GlobalCompositeOperation,
    bgColour: number | "transparent",
    outTrippy: number | undefined,
    inTrippy: number | undefined,
    width: number,
    height: number
  ) {
    if (outTrippy !== undefined || inTrippy !== undefined) {
      this.drawTrippy(outTrippy, inTrippy, colour, width, height);
    } else {
      this.offContext.fillStyle = intToHex(colour);
      this.offContext.fillRect(0, 0, width, height);
    }

    if (bgColour !== "transparent") {
      // sane draw
      this.context.globalAlpha = 0.7;
      this.context.globalCompositeOperation = blendMode;
      this.context.drawImage(this.offCanvas, 0, 0);
    } else {
      // so basically, HTML canvas blend modes act nothing like what you
      // would expect when you start using alpha with them. If you try and
      // fade invert the image later, the first frame of the invert, where
      // the difference layer is opaque black pixels (theoretically a
      // no-op), actually dims the entire background by a significant
      // amount. So we need to copy the look of the transparent
      // background, but make the image totally opaque so our filters
      // work. This is done by:
      // - Isolating the pixels *without* the image, and drawing the
      //   colour over a white background with no blend
      // - Isolating the pixels *with* the image, and blending the colour
      //   as normal
      // At this point in the code, we now have:
      // - context: the image (sliced and/or blurred) with transparency
      // - offContext: the colour (maybe trippy)
      // So we can use offContext2 and offContext3 as scratch space

      // backup the image
      this.offContext3.globalCompositeOperation = "copy";
      this.offContext3.drawImage(this.canvas, 0, 0);
      // re-add white background to main canvas
      this.context.globalAlpha = 1;
      this.context.globalCompositeOperation = "destination-over";
      this.context.fillStyle = "#fff";
      this.context.fillRect(0, 0, width, height);

      this.context.globalAlpha = 0.7;
      this.context.globalCompositeOperation = blendMode;

      // create colour only where the image is
      this.offContext2.globalAlpha = 1;
      this.offContext2.globalCompositeOperation = "copy";
      this.offContext2.drawImage(this.offCanvas, 0, 0);
      this.offContext2.globalCompositeOperation = "destination-in";
      this.offContext2.drawImage(this.offCanvas3, 0, 0);
      // draw this with the right blend
      this.context.drawImage(this.offCanvas2, 0, 0);

      // create colour only where the image *isn't*
      this.offContext2.globalCompositeOperation = "copy";
      this.offContext2.drawImage(this.offCanvas, 0, 0);
      this.offContext2.globalCompositeOperation = "destination-out";
      this.offContext2.drawImage(this.offCanvas3, 0, 0);
      // draw this with no blend
      this.context.globalCompositeOperation = "source-over";
      this.context.drawImage(this.offCanvas2, 0, 0);
    }
  }

  drawInvert(invert: number) {
    this.context.globalAlpha = 1;
    this.context.globalCompositeOperation = "difference";
    this.context.fillStyle = intToHex(mixColours(0, 0xffffff, invert));

    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawSlice(
    _slices: RenderParams["slices"],
    bitmap: Drawable,
    offset: number,
    drawWidth: number,
    drawHeight: number,
    width: number,
    height: number
  ) {
    this.offContext.clearRect(0, 0, width, height);
    if (!bitmap) {
      return this.offCanvas;
    }

    // since we always call this with valid slice data
    const slices = _slices!;

    let bitmapXOffset = 0;
    let drawXOffset = offset;
    for (let i = 0; i < slices.x.count; i++) {
      let xSegment = slices.x.segments[i];
      let sliceXDistance =
        slices.x.distances[i] * slices.x.percent * this.canvas.width;
      let segmentBitmapWidth = Math.ceil(xSegment * bitmap.width);
      let segmentDrawWidth = Math.ceil(xSegment * drawWidth);

      let bitmapYOffset = 0;
      let drawYOffset = 0;
      for (let j = 0; j < slices.y.count; j++) {
        let ySegment = slices.y.segments[j];
        let sliceYDistance =
          slices.y.distances[j] * slices.y.percent * this.canvas.width;
        let segmentBitmapHeight = Math.ceil(ySegment * bitmap.height);
        let segmentDrawHeight = Math.ceil(ySegment * drawHeight);

        this.offContext.drawImage(
          bitmap,
          bitmapXOffset,
          bitmapYOffset, // subsection x, y
          segmentBitmapWidth,
          segmentBitmapHeight, // subsection w, h
          drawXOffset + sliceYDistance,
          drawYOffset + sliceXDistance, // drawn x, y
          segmentDrawWidth,
          segmentDrawHeight
        ); // drawn w, h

        bitmapYOffset += segmentBitmapHeight;
        drawYOffset += segmentDrawHeight;
      }

      bitmapXOffset += segmentBitmapWidth;
      drawXOffset += segmentDrawWidth;
    }

    return this.offCanvas;
  }

  drawBlur(
    _bitmap: Drawable,
    offset: number,
    drawWidth: number,
    drawHeight: number,
    xBlur: number,
    yBlur: number
  ) {
    let bitmap = _bitmap!; // only ever called with valid data
    if (this.blurIterations < 0) {
      // "LOW" blur quality is special - just warps the images
      // extra little oomph to make it more obvious
      let xDist = xBlur * this.baseHeight * 1.5;
      let yDist = yBlur * this.baseHeight * 1.5;

      this.context.globalAlpha = 1;
      this.context.drawImage(
        bitmap,
        Math.round(offset - xDist / 2),
        Math.round(-yDist / 2),
        drawWidth + xDist,
        drawHeight + yDist
      );
    } else {
      this.context.globalAlpha = this.blurAlpha;
      let dist;
      if (xBlur) {
        // have to use offCanvas/context2 here, because we might
        // have been passed the first offCanvas from the slice
        // effect
        let xContext = this.context;
        // do we even need the offCanvas?
        if (yBlur) {
          this.offContext2.globalAlpha = this.blurAlpha;
          this.offContext2.globalCompositeOperation = "source-over";
          this.offContext2.clearRect(
            0,
            0,
            this.canvas.width,
            this.canvas.height
          );
          xContext = this.offContext2;
        }

        // since blur is based on render height
        dist = xBlur * this.baseHeight;
        for (let i = -1; i <= 1; i += this.blurDelta) {
          xContext.drawImage(
            bitmap,
            Math.round(dist * i) + offset,
            0,
            drawWidth,
            drawHeight
          );
        }

        if (yBlur) {
          offset = 0;
          bitmap = this.offCanvas2;
          drawWidth = this.canvas.width;
          drawHeight = this.canvas.height;
        }
      }
      if (yBlur) {
        dist = yBlur * this.baseHeight;
        for (let i = -1; i <= 1; i += this.blurDelta) {
          this.context.drawImage(
            bitmap,
            offset,
            Math.round(dist * i),
            drawWidth,
            drawHeight
          );
        }
      }
    }
  }

  // draws the correct trippy colour circles onto the offscreen canvas
  drawTrippy(
    outTrippy: number | undefined,
    inTrippy: number | undefined,
    colour: number,
    width: number,
    height: number
  ) {
    outTrippy = outTrippy === undefined ? 1 : outTrippy;
    inTrippy = inTrippy === undefined ? 0 : inTrippy;

    let trippyRadii;
    if (outTrippy > inTrippy) {
      trippyRadii = [outTrippy, inTrippy];
    } else {
      trippyRadii = [inTrippy, outTrippy];
    }

    let invertC = intToHex(0xffffff ^ colour);
    let normalC = intToHex(colour);
    this.offContext.fillStyle = invertC;
    this.offContext.fillRect(0, 0, width, height);

    let invert = false;
    for (let i = 0; i < 2; i++) {
      // Invert for each subsequent draw
      this.offContext.beginPath();
      this.offContext.fillStyle = invert ? invertC : normalC;
      this.offContext.arc(
        width / 2,
        height / 2,
        Math.floor(trippyRadii[i]! * this.trippyRadius),
        0,
        2 * Math.PI,
        false
      );
      this.offContext.fill();
      this.offContext.closePath();
      invert = !invert;
    }
  }
}
