<script lang="ts">
  import HuesCanvas2D from "../HuesCanvas2D";
  import HuesCanvasWebGL from "../HuesCanvasWebGL";
  import HuesRender, {
    type HuesCanvas,
    type RenderParams,
  } from "../HuesRender";
  import OptionalRange from "./OptionalRange.svelte";
  import Range from "./Range.svelte";

  let canvas2DEl = $state<HTMLDivElement>();
  let canvasWebGLEl = $state<HTMLDivElement>();
  let canvas2D = $derived(
    canvas2DEl ? new HuesCanvas2D(canvas2DEl, 400) : undefined,
  );
  let canvasWebGL = $derived(
    canvasWebGLEl ? new HuesCanvasWebGL(canvasWebGLEl, 400) : undefined,
  );

  let renderTime2D = $state(0);
  let renderTimeWebGl = $state(0);

  let needRender = $state(true);

  let invertStyle = $state<"everything" | "image">("everything");

  $effect(() => {
    for (const canvas of [canvas2D, canvasWebGL]) {
      canvas?.resize();
      canvas?.setBlurQuality("extreme");
      canvas?.setInvertStyle(invertStyle);
      needRender = true;
    }
  });

  const blurAmount = 96 / 1280; // HuesRender "medium", for slice effect

  let params = $state<RenderParams>({
    colour: 0,
    lastColour: 0,
    colourFade: undefined,
    blendMode: "hard-light",
    // bgColour: 0,
    // bgColour: 0xffffff,
    bgColour: "transparent",

    overlayColour: 0,
    overlayPercent: 0,

    invert: 0,

    bitmap: undefined, // TODO: aspect ratio
    bitmapAlign: "center", //  TODO
    bitmapCenter: 605, // TODO

    lastBitmap: undefined,
    lastBitmapAlign: "left",
    lastBitmapCenter: 401,

    shutter: undefined,
    shutterDir: "←",

    xBlur: 0,
    yBlur: 0, // TODO

    outTrippy: undefined, // TODO: aspect ratio
    inTrippy: undefined,

    slices: {
      // TODO
      x: {
        ...HuesRender.generateSliceSegments(
          HuesRender.makeSliceObj(25),
          blurAmount,
        ),
        percent: 1.0,
      },
      y: HuesRender.generateSliceSegments(
        HuesRender.makeSliceObj(15),
        blurAmount,
      ),
    },

    border: false, // TODO
    centerLine: false, // TODO
  });

  function updateSlices() {
    if (!params.slices) return;
    HuesRender.generateSliceSegments(params.slices.x, blurAmount);
    HuesRender.generateSliceSegments(params.slices.y, blurAmount);
    needRender = true;
  }

  let colourInput = $state("#9d439d");
  $effect(() => {
    params.colour = hexToInt(colourInput);
  });
  let lastColourInput = $state("#dfad00");
  $effect(() => {
    params.lastColour = hexToInt(lastColourInput);
  });

  let renderCanvas = $state(true);

  // Load the example images
  const loadImage = (path: string, cb: (img: ImageBitmap) => void) => {
    const img = new Image();
    img.src = path;
    img.onload = () => {
      createImageBitmap(img, {
        premultiplyAlpha: HuesCanvasWebGL.PREMULTIPLIED
          ? "premultiply"
          : "none",
      }).then(cb);
    };
  };

  loadImage("../respacks/Yuki.png", (img) => (params.bitmap = img));
  loadImage("../respacks/Misaka.png", (img) => (params.lastBitmap = img));

  function hexToInt(hex: string): number {
    return parseInt(hex.replace("#", ""), 16);
  }

  function render() {
    requestAnimationFrame(render);
    if (!canvas2D || !canvasWebGL || !params.bitmap || !needRender) return;

    renderTimeWebGl = timeRender(canvasWebGL);
    if (renderCanvas) renderTime2D = timeRender(canvas2D);

    needRender = false;
  }

  function timeRender(canvas: HuesCanvas) {
    const start = performance.now();
    canvas.draw(params);
    return performance.now() - start;
  }

  function handleResize() {
    canvas2D?.resize();
    canvasWebGL?.resize();
    needRender = true;
  }

  $effect(() => {
    params.colour;
    params.lastColour;
    params.colourFade;
    params.blendMode;
    params.bgColour;
    params.overlayColour;
    params.overlayPercent;
    params.invert;
    params.bitmap;
    params.bitmapAlign;
    params.bitmapCenter;
    params.lastBitmap;
    params.lastBitmapAlign;
    params.lastBitmapCenter;
    params.shutter;
    params.shutterDir;
    params.xBlur;
    params.yBlur;
    params.outTrippy;
    params.inTrippy;
    params.slices;
    params.slices?.x.percent;
    params.slices?.y.percent;
    params.border;
    params.centerLine;
    renderCanvas;
    needRender = true;
  });

  $effect(() => {
    requestAnimationFrame(render);
  });
</script>

<svelte:window onresize={handleResize} />

<div class="container">
  <div class="controls">
    <div class="control-group">
      <label>Border</label>
      <div class="control-row">
        <input type="checkbox" bind:checked={params.border} />
      </div>
    </div>

    <div class="control-group">
      <label>Centerline</label>
      <div class="control-row">
        <input type="checkbox" bind:checked={params.centerLine} />
      </div>
    </div>

    <div class="control-group">
      <label>Background colour</label>
      <div class="control-row">
        <select bind:value={params.bgColour}>
          <option value={0xffffff}>white</option>
          <option value={0}>black</option>
          <option value="transparent">transparent</option>
        </select>
      </div>
    </div>

    <Range bind:value={params.overlayPercent} min={0} max={1} step={0.01}>
      Overlay Percent: {params.overlayPercent.toFixed(2)}
    </Range>

    <Range bind:value={params.invert} min={0} max={1} step={0.01}>
      Invert: {params.invert.toFixed(2)}
    </Range>

    <div class="control-group">
      <label>Invert style</label>
      <div class="control-row">
        <select bind:value={invertStyle}>
          <option value="everything">everything</option>
          <option value="image">image</option>
        </select>
      </div>
    </div>

    <OptionalRange bind:value={params.outTrippy} min={0} max={1.0} step={0.001}>
      Trippy out: {params.outTrippy?.toFixed(3)}
    </OptionalRange>

    <OptionalRange bind:value={params.inTrippy} min={0} max={1.0} step={0.001}>
      Trippy in: {params.inTrippy?.toFixed(3)}
    </OptionalRange>

    <OptionalRange
      bind:value={params.colourFade}
      min={0}
      max={1.0}
      step={0.001}
    >
      Colour fade: {params.colourFade?.toFixed(3)}
    </OptionalRange>

    <OptionalRange bind:value={params.shutter} min={0} max={1.0} step={0.001}>
      Shutter: {params.shutter?.toFixed(3)}
    </OptionalRange>

    <div class="control-group">
      <label>Shutter dir</label>
      <div class="control-row">
        <select bind:value={params.shutterDir}>
          <option value="←">←</option>
          <option value="↓">↓</option>
          <option value="↑">↑</option>
          <option value="→">→</option>
        </select>
      </div>
    </div>

    <div class="control-group">
      <div class="control-row">
        <button onclick={updateSlices}>Regen slices</button>
      </div>
    </div>

    <Range bind:value={params.slices!.x.percent} min={0} max={1.0} step={0.01}>
      X Slice: {params.slices?.x.percent.toFixed(2)}
    </Range>

    <Range bind:value={params.slices!.y.percent} min={0} max={1.0} step={0.01}>
      Y Slice: {params.slices?.y.percent.toFixed(2)}
    </Range>

    <Range bind:value={params.xBlur} min={0} max={0.5} step={0.0001}>
      X Blur: {params.xBlur.toFixed(4)}
    </Range>

    <Range bind:value={params.yBlur} min={0} max={0.5} step={0.0001}>
      Y Blur: {params.yBlur.toFixed(4)}
    </Range>

    <div class="control-group">
      <label>Colour</label>
      <div class="control-row">
        <input type="color" bind:value={colourInput} />
        <span>{colourInput}</span>
      </div>
    </div>

    <div class="control-group">
      <label>Last Colour</label>
      <div class="control-row">
        <input type="color" bind:value={lastColourInput} />
        <span>{lastColourInput}</span>
      </div>
    </div>

    <div class="control-group">
      <label>Blend Mode</label>
      <div class="control-row">
        <select bind:value={params.blendMode}>
          <option value="multiply">multiply</option>
          <option value="screen">screen</option>
          <option value="hard-light">hard-light</option>
        </select>
      </div>
    </div>
  </div>

  <div class="canvas-container">
    <div class="canvas-wrapper">
      <h2>
        Canvas 2D - {renderTime2D.toFixed(2)}ms
        <input type="checkbox" bind:checked={renderCanvas} />
      </h2>
      <div class="canvas-area" bind:this={canvas2DEl}></div>
    </div>

    <div class="canvas-wrapper">
      <h2>Canvas WebGL - {renderTimeWebGl.toFixed(2)}ms</h2>
      <div class="canvas-area" bind:this={canvasWebGLEl}></div>
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
  }

  .canvas-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 20px;
  }

  .canvas-wrapper {
    background: #000;
    border: 2px solid #333;
    border-radius: 8px;
    overflow: hidden;
  }

  .canvas-wrapper h2 {
    margin: 0;
    padding: 10px;
    background: #2a2a2a;
    text-align: center;
    font-size: 18px;
    color: #fff;
  }

  .canvas-area {
    width: 100%;
    height: 400px;
    position: relative;
  }

  :global(.canvas-area .hues-canvas) {
    width: 100%;
    height: 100%;
    display: block;
  }

  .controls {
    background: #2a2a2a;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
  }

  :global {
    .control-group {
      margin-bottom: 15px;
    }

    .control-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
      color: #fff;
    }

    .control-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .control-row input[type="range"] {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: #444;
      outline: none;
    }

    .control-row input[type="range"]::-webkit-slider-thumb {
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #4caf50;
      cursor: pointer;
    }

    .control-row input[type="range"]::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #4caf50;
      cursor: pointer;
      border: none;
    }

    .control-row span {
      min-width: 80px;
      text-align: right;
      font-family: monospace;
      color: #fff;
    }

    .control-row input[type="color"] {
      width: 60px;
      height: 36px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
  }
  button {
    background: #4caf50;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    margin-right: 10px;
  }

  button:hover {
    background: #45a049;
  }

  button:active {
    background: #3d8b40;
  }

  select {
    background: #444;
    color: white;
    border: 1px solid #666;
    padding: 8px;
    border-radius: 4px;
    font-size: 14px;
  }
</style>
