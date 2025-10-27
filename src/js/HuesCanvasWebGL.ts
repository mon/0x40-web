import { type RenderParams, type HuesCanvas } from "./HuesRender";
import type { SettingsData } from "./HuesSettings.svelte";
import vertShaderSrc from "../shaders/vertex.glsl?raw";
import fragShaderSrc from "../shaders/fragment.glsl?raw";

function colourIntToFloats(int: number): [number, number, number] {
  const r = (int & 0xff0000) / 0xff0000;
  const g = (int & 0x00ff00) / 0x00ff00;
  const b = (int & 0x0000ff) / 0x0000ff;
  return [r, g, b];
}

export default class HuesCanvasWebGL implements HuesCanvas {
  static PREMULTIPLIED = true;

  root: HTMLElement;
  baseHeight: number;

  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  shaderProgram: WebGLProgram;
  a_position: number;
  u_matrixLoc: WebGLUniformLocation | null;

  shutterWidth: number;

  textures: WebGLTexture[];
  bitmaps: (ImageBitmap | undefined)[];
  u_images: (WebGLUniformLocation | null)[];

  u_colour: WebGLUniformLocation | null;
  u_bgColour: WebGLUniformLocation | null;

  u_blurAmount: WebGLUniformLocation | null;
  u_invert: WebGLUniformLocation | null;
  u_invertEverything: WebGLUniformLocation | null;
  u_blendMode: WebGLUniformLocation | null;
  u_overlayColour: WebGLUniformLocation | null;

  u_outTrippy: WebGLUniformLocation | null;
  u_inTrippy: WebGLUniformLocation | null;
  u_lastColour: WebGLUniformLocation | null;
  u_colourFade: WebGLUniformLocation | null;
  u_shutter: WebGLUniformLocation | null;
  u_shutterDir: WebGLUniformLocation | null;
  u_shutterWidth: WebGLUniformLocation | null;

  constructor(root: HTMLElement, height = 720) {
    this.root = root;
    this.baseHeight = height;
    this.shutterWidth = 1;

    this.canvas = document.createElement("canvas");
    const gl = this.canvas.getContext("webgl2", {
      premultipliedAlpha: HuesCanvasWebGL.PREMULTIPLIED,
    });
    if (!gl) {
      throw new Error("WebGL2 not supported");
    }
    // console.log("uniforms: ", gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS));
    this.gl = gl;
    this.canvas.className = "hues-canvas";
    root.appendChild(this.canvas);

    this.shaderProgram = this.initShaderProgram(vertShaderSrc, fragShaderSrc);
    this.gl.useProgram(this.shaderProgram);

    // look up where the vertex data needs to go.
    this.a_position = 0; // per MDN: always enable vertex attrib 0 as an array
    this.gl.bindAttribLocation(this.shaderProgram, 0, "a_position");

    // look up uniform locations
    const getLoc = (name: string) =>
      this.gl.getUniformLocation(this.shaderProgram, name);
    this.u_matrixLoc = getLoc("u_matrix");
    this.u_images = [getLoc("u_image"), getLoc("u_lastImage")];
    this.u_colour = getLoc("u_colour");
    this.u_lastColour = getLoc("u_lastColour");
    this.u_colourFade = getLoc("u_colourFade");
    this.u_overlayColour = getLoc("u_overlayColour");
    this.u_bgColour = getLoc("u_bgColour");
    this.u_blurAmount = getLoc("u_blurAmount");
    this.u_invert = getLoc("u_invert");
    this.u_invertEverything = getLoc("u_invertEverything");
    this.u_blendMode = getLoc("u_blendMode");
    this.u_outTrippy = getLoc("u_outTrippy");
    this.u_inTrippy = getLoc("u_inTrippy");
    this.u_shutter = getLoc("u_shutter");
    this.u_shutterDir = getLoc("u_shutterDir");
    this.u_shutterWidth = getLoc("u_shutterWidth");

    // provide texture coordinates for the rectangle.
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([
        0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0,
      ]),
      this.gl.STATIC_DRAW,
    );
    this.gl.enableVertexAttribArray(this.a_position);
    this.gl.vertexAttribPointer(this.a_position, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.uniform1i(this.u_images[0], 0);
    this.gl.uniform1i(this.u_images[1], 1);
    this.textures = [this.gl.createTexture(), this.gl.createTexture()];
    this.bitmaps = [];

    for (const [i, tex] of this.textures.entries()) {
      this.gl.activeTexture(this.gl.TEXTURE0 + i);
      this.gl.bindTexture(this.gl.TEXTURE_2D, tex);

      // Set the parameters so we can render any size image.
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_WRAP_S,
        this.gl.CLAMP_TO_EDGE,
      );
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_WRAP_T,
        this.gl.CLAMP_TO_EDGE,
      );
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_MIN_FILTER,
        this.gl.LINEAR,
      );
      // TODO: embiggening better as nearest?
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_MAG_FILTER,
        this.gl.LINEAR,
      );
    }

    this.gl.clearColor(0, 0, 0, 0);
  }

  get width() {
    return this.canvas.width;
  }

  get height() {
    return this.canvas.height;
  }

  setInvertStyle(style: SettingsData["invertStyle"]) {
    this.gl.uniform1i(this.u_invertEverything, style === "everything" ? 1 : 0);
  }

  setBlurQuality(_quality: SettingsData["blurQuality"]) {}

  resize() {
    let height = this.root.clientHeight;
    let ratio = this.root.clientWidth / height;
    this.canvas.height = Math.min(height, this.baseHeight);
    this.canvas.width = Math.ceil(this.canvas.height * ratio);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.uniform2f(
      this.u_shutterWidth,
      this.shutterWidth / this.canvas.width,
      this.shutterWidth / this.canvas.height,
    );
  }

  draw(params: RenderParams) {
    // this.gl.clearColor(...colourIntToFloats(params.bgColour), 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    if (params.bgColour === "transparent") {
      // this.gl.uniform4f(this.u_bgColour, 0.0, 0.0, 0.0, 0.0);
      this.gl.uniform4f(this.u_bgColour, 1.0, 1.0, 1.0, 0.0);
    } else {
      this.gl.uniform4f(
        this.u_bgColour,
        ...colourIntToFloats(params.bgColour),
        1.0,
      );
    }

    this.gl.uniform4f(this.u_colour, ...colourIntToFloats(params.colour), 1.0);
    this.gl.uniform4f(
      this.u_lastColour,
      ...colourIntToFloats(params.lastColour),
      1.0,
    );
    this.gl.uniform1f(this.u_colourFade, params.colourFade ?? 1.0);
    this.gl.uniform4f(
      this.u_overlayColour,
      ...colourIntToFloats(params.overlayColour),
      params.overlayPercent,
    );
    this.gl.uniform1f(this.u_blurAmount, params.xBlur);
    this.gl.uniform1f(this.u_invert, params.invert);
    this.gl.uniform1i(
      this.u_blendMode,
      { "hard-light": 0, screen: 1, multiply: 2 }[params.blendMode],
    );
    this.gl.uniform1f(this.u_outTrippy, params.outTrippy ?? 1.0);
    this.gl.uniform1f(this.u_inTrippy, params.inTrippy ?? 0.0);
    this.gl.uniform1f(this.u_shutter, params.shutter ?? 1.0);
    this.gl.uniform1i(
      this.u_shutterDir,
      { "←": 0, "↓": 1, "↑": 2, "→": 3 }[params.shutterDir ?? "←"],
    );

    if (!params.bitmap) return;

    this.setTexture(0, params.bitmap);
    this.setTexture(1, params.lastBitmap);

    const dstX = 0;
    const dstY = 0;
    const dstWidth = this.gl.canvas.width;
    const dstHeight = this.gl.canvas.height;

    // convert dst pixel coords to clipspace coords
    const clipX = (dstX / this.gl.canvas.width) * 2 - 1;
    const clipY = (dstY / this.gl.canvas.height) * -2 + 1;
    const clipWidth = (dstWidth / this.gl.canvas.width) * 2;
    const clipHeight = (dstHeight / this.gl.canvas.height) * -2;

    // build a matrix that will stretch our
    // unit quad to our desired size and location
    this.gl.uniformMatrix3fv(this.u_matrixLoc, false, [
      clipWidth,
      0,
      0,
      0,
      clipHeight,
      0,
      clipX,
      clipY,
      1,
    ]);

    // Draw the rectangle.
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    this.gl.finish();
  }

  setTexture(i: number, tex?: ImageBitmap) {
    if (tex == this.bitmaps[i] || tex === undefined) return;

    this.bitmaps[i] = tex;

    // Bind texture to texture unit 0
    this.gl.activeTexture(this.gl.TEXTURE0 + i);

    // Upload the image into the texture.
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      tex,
    );
  }

  initShaderProgram(vertSrc: string, fragSrc: string) {
    const vertShader = this.compileShader(this.gl.VERTEX_SHADER, vertSrc);
    const fragShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragSrc);
    const shaderProgram = this.gl.createProgram();
    this.gl.attachShader(shaderProgram, vertShader);
    this.gl.attachShader(shaderProgram, fragShader);
    this.gl.linkProgram(shaderProgram);

    if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
      throw new Error(
        `Unable to initialize the shader program: ${this.gl.getProgramInfoLog(
          shaderProgram,
        )}`,
      );
    }

    return shaderProgram;
  }

  compileShader(type: number, source: string) {
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error("Failed to createShader, bad type?");

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const errInfo = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Failed to compile shader ${errInfo}`);
    }

    return shader;
  }
}
