import { type RenderParams, type HuesCanvas } from "./HuesRender";
import type { SettingsData } from "./HuesSettings.svelte";
import vertShaderSrc from "../shaders/vertex.glsl?raw";
import fragShaderSrc from "../shaders/fragment.glsl?raw";

export default class HuesCanvasWebGL implements HuesCanvas {
  root: HTMLElement;
  baseHeight: number;

  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  shaderProgram: WebGLProgram;

  constructor(root: HTMLElement, height = 720) {
    this.root = root;
    this.baseHeight = height;

    this.canvas = document.createElement("canvas");
    const gl = this.canvas.getContext("webgl2");
    if (!gl) {
      throw new Error("WebGL2 not supported");
    }
    this.gl = gl;
    this.canvas.className = "hues-canvas";
    root.appendChild(this.canvas);

    this.shaderProgram = this.initShaderProgram(vertShaderSrc, fragShaderSrc);

    this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
  }

  get width() {
    return this.canvas.width;
  }

  get height() {
    return this.canvas.height;
  }

  setInvertStyle(_style: SettingsData["invertStyle"]) {}

  setBlurQuality(_quality: SettingsData["blurQuality"]) {}

  resize() {
    let height = this.root.clientHeight;
    let ratio = this.root.clientWidth / height;
    this.canvas.height = Math.min(height, this.baseHeight);
    this.canvas.width = Math.ceil(this.canvas.height * ratio);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(params: RenderParams) {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    if (!params.bitmap) return;

    this.gl.useProgram(this.shaderProgram);

    // look up where the vertex data needs to go.
    var positionLocation = this.gl.getAttribLocation(
      this.shaderProgram,
      "a_position",
    );

    // look up uniform locations
    var u_imageLoc = this.gl.getUniformLocation(this.shaderProgram, "u_image");
    var u_matrixLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "u_matrix",
    );

    // provide texture coordinates for the rectangle.
    var positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([
        0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0,
      ]),
      this.gl.STATIC_DRAW,
    );
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(
      positionLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0,
    );

    var texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

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
    // TODO: do you like embiggening to be nearest?
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.NEAREST,
    );

    // Upload the image into the texture.
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      params.bitmap,
    );

    var dstX = 0;
    var dstY = 0;
    var dstWidth = this.gl.canvas.width;
    var dstHeight = this.gl.canvas.height;

    // convert dst pixel coords to clipspace coords
    var clipX = (dstX / this.gl.canvas.width) * 2 - 1;
    var clipY = (dstY / this.gl.canvas.height) * -2 + 1;
    var clipWidth = (dstWidth / this.gl.canvas.width) * 2;
    var clipHeight = (dstHeight / this.gl.canvas.height) * -2;

    // build a matrix that will stretch our
    // unit quad to our desired size and location
    this.gl.uniformMatrix3fv(u_matrixLoc, false, [
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
