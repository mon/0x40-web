import { type RenderParams, type HuesCanvas } from "./HuesRender";
import type { SettingsData } from "./HuesSettings.svelte";
import vertShaderSrc from "../shaders/vertex.glsl?raw";
import fragSliceShaderSrc from "../shaders/frag_slice.glsl?raw";
import fragMainShaderSrc from "../shaders/frag_main.glsl?raw";
import fragSharedSrc from "../shaders/shared.glsl?raw";

function colourIntToFloats(int: number): [number, number, number] {
  const r = (int & 0xff0000) / 0xff0000;
  const g = (int & 0x00ff00) / 0x00ff00;
  const b = (int & 0x0000ff) / 0x0000ff;
  return [r, g, b];
}

type SharedUniforms = {
  u_xBlur: WebGLUniformLocation | null;
  u_yBlur: WebGLUniformLocation | null;
  u_blurAmount: WebGLUniformLocation | null;

  u_xSlice: WebGLUniformLocation | null;
  u_xSliceSeed: WebGLUniformLocation | null;
  u_ySlice: WebGLUniformLocation | null;
  u_ySliceSeed: WebGLUniformLocation | null;

  u_shutter: WebGLUniformLocation | null;
  u_shutterDir: WebGLUniformLocation | null;
  u_shutterWidth: WebGLUniformLocation | null;
};

export default class HuesCanvasWebGL implements HuesCanvas {
  static PREMULTIPLIED = true;

  root: HTMLElement;
  baseHeight: number;

  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  a_position: number;

  // Multi-pass rendering
  programs: WebGLProgram[];

  // Framebuffers and their textures
  fbo: WebGLFramebuffer;
  fboTex: WebGLTexture;

  shutterWidth: number;

  textures: WebGLTexture[];
  bitmaps: (ImageBitmap | undefined)[];

  uniforms: [
    SharedUniforms & {
      u_images: (WebGLUniformLocation | null)[];
    },
    SharedUniforms & {
      u_image: WebGLUniformLocation | null;

      u_colour: WebGLUniformLocation | null;
      u_bgColour: WebGLUniformLocation | null;

      u_invert: WebGLUniformLocation | null;
      u_invertEverything: WebGLUniformLocation | null;
      u_blendMode: WebGLUniformLocation | null;
      u_overlayColour: WebGLUniformLocation | null;

      u_outTrippy: WebGLUniformLocation | null;
      u_inTrippy: WebGLUniformLocation | null;
      u_lastColour: WebGLUniformLocation | null;
      u_colourFade: WebGLUniformLocation | null;
    },
  ];

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

    // Initialize all three shader programs
    this.programs = [
      this.initShaderProgram(vertShaderSrc, fragSliceShaderSrc),
      this.initShaderProgram(vertShaderSrc, fragMainShaderSrc),
    ];

    // look up where the vertex data needs to go.
    this.a_position = 0; // per MDN: always enable vertex attrib 0 as an array
    this.gl.bindAttribLocation(this.programs[0], 0, "a_position");
    this.gl.bindAttribLocation(this.programs[1], 0, "a_position");

    // look up uniform locations
    const getLoc = (program: number, name: string) =>
      this.gl.getUniformLocation(this.programs[program], name);
    this.uniforms = [
      {
        u_images: [getLoc(0, "u_image"), getLoc(0, "u_lastImage")],
        u_xBlur: getLoc(0, "u_xBlur"),
        u_yBlur: getLoc(0, "u_yBlur"),
        u_blurAmount: getLoc(0, "u_blurAmount"),
        u_shutter: getLoc(0, "u_shutter"),
        u_shutterDir: getLoc(0, "u_shutterDir"),
        u_shutterWidth: getLoc(0, "u_shutterWidth"),
        u_xSlice: getLoc(0, "u_xSlice"),
        u_xSliceSeed: getLoc(0, "u_xSliceSeed"),
        u_ySlice: getLoc(0, "u_ySlice"),
        u_ySliceSeed: getLoc(0, "u_ySliceSeed"),
      },
      {
        u_image: getLoc(1, "u_image"),
        u_colour: getLoc(1, "u_colour"),
        u_lastColour: getLoc(1, "u_lastColour"),
        u_colourFade: getLoc(1, "u_colourFade"),
        u_overlayColour: getLoc(1, "u_overlayColour"),
        u_bgColour: getLoc(1, "u_bgColour"),
        u_xBlur: getLoc(1, "u_xBlur"),
        u_yBlur: getLoc(1, "u_yBlur"),
        u_blurAmount: getLoc(1, "u_blurAmount"),
        u_invert: getLoc(1, "u_invert"),
        u_invertEverything: getLoc(1, "u_invertEverything"),
        u_blendMode: getLoc(1, "u_blendMode"),
        u_outTrippy: getLoc(1, "u_outTrippy"),
        u_inTrippy: getLoc(1, "u_inTrippy"),
        u_shutter: getLoc(1, "u_shutter"),
        u_shutterDir: getLoc(1, "u_shutterDir"),
        u_shutterWidth: getLoc(1, "u_shutterWidth"),
        u_xSlice: getLoc(1, "u_xSlice"),
        u_xSliceSeed: getLoc(1, "u_xSliceSeed"),
        u_ySlice: getLoc(1, "u_ySlice"),
        u_ySliceSeed: getLoc(1, "u_ySliceSeed"),
      },
    ];

    this.gl.useProgram(this.programs[0]);
    this.gl.uniform1i(this.uniforms[0].u_images[0], 0);
    this.gl.uniform1i(this.uniforms[0].u_images[1], 1);
    this.gl.useProgram(this.programs[1]);
    this.gl.uniform1i(this.uniforms[1].u_image, 3); // TODO make this 2 lol

    // provide texture coordinates for the rectangle.
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    // https://stackoverflow.com/a/59739538/7972801
    // ^ I'm convinced, one bigass triangle it is
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      this.gl.STATIC_DRAW,
    );
    this.gl.enableVertexAttribArray(this.a_position);
    this.gl.vertexAttribPointer(this.a_position, 2, this.gl.FLOAT, false, 0, 0);

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

    // Initialize framebuffers and their textures
    this.fbo = this.gl.createFramebuffer();
    this.fboTex = this.gl.createTexture();

    // Set up FBO textures (will be resized in resize())
    this.gl.activeTexture(this.gl.TEXTURE3);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.fboTex);
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
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR,
    );

    this.gl.useProgram(this.programs[0]);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      this.fboTex,
      0,
    );

    this.gl.useProgram(this.programs[1]);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.clearColor(0, 0, 0, 0);
  }

  get width() {
    return this.canvas.width;
  }

  get height() {
    return this.canvas.height;
  }

  setInvertStyle(style: SettingsData["invertStyle"]) {
    this.gl.uniform1i(
      this.uniforms[1].u_invertEverything,
      style === "everything" ? 1 : 0,
    );
  }

  setBlurQuality(_quality: SettingsData["blurQuality"]) {}

  resize() {
    let height = this.root.clientHeight;
    let ratio = this.root.clientWidth / height;
    this.canvas.height = Math.min(height, this.baseHeight);
    this.canvas.width = Math.ceil(this.canvas.height * ratio);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Resize FBO textures to match canvas size
    this.gl.activeTexture(this.gl.TEXTURE3);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.canvas.width,
      this.canvas.height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      null,
    );

    for (const [i, uniform] of this.uniforms.entries()) {
      this.gl.useProgram(this.programs[i]);
      this.gl.uniform2f(
        uniform.u_shutterWidth,
        this.shutterWidth / this.canvas.width,
        this.shutterWidth / this.canvas.height,
      );
    }
  }

  draw(params: RenderParams) {
    if (!params.bitmap) return;

    this.setTexture(0, params.bitmap);
    this.setTexture(1, params.lastBitmap);

    const sharedUniforms = (program: number) => {
      const u = this.uniforms[program];
      this.gl.uniform1f(u.u_shutter, params.shutter ?? 1.0);
      this.gl.uniform1i(
        u.u_shutterDir,
        { "←": 0, "↓": 1, "↑": 2, "→": 3 }[params.shutterDir ?? "←"],
      );

      this.gl.uniform1f(u.u_xBlur, params.xBlur);
      this.gl.uniform1f(u.u_yBlur, params.yBlur);

      this.gl.uniform1f(
        u.u_blurAmount,
        params.slices?.x.blurAmount ?? params.slices?.y.blurAmount ?? 0.0,
      );

      this.gl.uniform1f(u.u_xSlice, params.slices?.x.percent ?? 0.0);
      this.gl.uniform1f(u.u_xSliceSeed, params.slices?.x.seed ?? 0.0);
      this.gl.uniform1f(u.u_ySlice, params.slices?.y.percent ?? 0.0);
      this.gl.uniform1f(u.u_ySliceSeed, params.slices?.y.seed ?? 0.0);

      // rest done in resize() or ctor
    };

    // ========== PASS 1: Slice (render to FBO1) ==========
    this.gl.useProgram(this.programs[0]);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo);

    sharedUniforms(0);

    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);

    // ========== PASS 2: Main composite (render to canvas) ==========
    this.gl.useProgram(this.programs[1]);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    sharedUniforms(1);

    // Set all uniforms for main pass
    if (params.bgColour === "transparent") {
      this.gl.uniform4f(this.uniforms[1].u_bgColour, 1.0, 1.0, 1.0, 0.0);
    } else {
      this.gl.uniform4f(
        this.uniforms[1].u_bgColour,
        ...colourIntToFloats(params.bgColour),
        1.0,
      );
    }

    this.gl.uniform4f(
      this.uniforms[1].u_colour,
      ...colourIntToFloats(params.colour),
      1.0,
    );
    this.gl.uniform4f(
      this.uniforms[1].u_lastColour,
      ...colourIntToFloats(params.lastColour),
      1.0,
    );
    this.gl.uniform1f(this.uniforms[1].u_colourFade, params.colourFade ?? 1.0);
    this.gl.uniform4f(
      this.uniforms[1].u_overlayColour,
      ...colourIntToFloats(params.overlayColour),
      params.overlayPercent,
    );
    this.gl.uniform1f(this.uniforms[1].u_invert, params.invert);
    this.gl.uniform1i(
      this.uniforms[1].u_blendMode,
      { "hard-light": 0, screen: 1, multiply: 2 }[params.blendMode],
    );
    this.gl.uniform1f(this.uniforms[1].u_outTrippy, params.outTrippy ?? 1.0);
    this.gl.uniform1f(this.uniforms[1].u_inTrippy, params.inTrippy ?? 0.0);

    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);

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
    const fragShader = this.compileShader(
      this.gl.FRAGMENT_SHADER,
      fragSharedSrc + fragSrc,
    );
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
