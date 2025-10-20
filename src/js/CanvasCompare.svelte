<script lang="ts">
  import HuesCanvas2D from "./HuesCanvas2D";
  import HuesCanvasWebGL from "./HuesCanvasWebGL";

  let canvas2DEl = $state<HTMLDivElement>();
  let canvasWebGLEl = $state<HTMLDivElement>();
  let canvas2D = $derived(
    canvas2DEl ? new HuesCanvas2D(canvas2DEl, 400) : undefined,
  );
  let canvasWebGL = $derived(
    canvasWebGLEl ? new HuesCanvasWebGL(canvasWebGLEl, 400) : undefined,
  );

  $effect(() => {
    canvas2D?.resize();
    canvasWebGL?.resize();
  });

  // Control states
  let bgColor = $state(0xffffff);
  let overlayColour = $state(0);
  let overlayPercent = $state(0);
  let invert = $state(0);
  let xBlur = $state(0);
  let yBlur = $state(0);
  let colorTint = $state("#FF00FF");
  let blendMode = $state<GlobalCompositeOperation>("hard-light");

  let testRunning = $state(false);
  let testInterval = $state<NodeJS.Timeout>();
  let loadedImage = $state<HTMLImageElement>();

  // Load the example image
  $effect(() => {
    const img = new Image();
    img.src = "../respacks/0x40 Hues 5.0 Defaults/Images/Yuki.png";
    img.onload = () => {
      loadedImage = img;
      render();
    };
  });

  function hexToInt(hex: string): number {
    return parseInt(hex.replace("#", ""), 16);
  }

  function render() {
    if (!canvas2D || !canvasWebGL || !loadedImage) return;

    const params = {
      bgColour: bgColor,
      overlayPercent: overlayPercent / 100,
      overlayColour,
      invert: invert / 100,
      xBlur: xBlur / 100,
      yBlur: yBlur / 100,
      colour: hexToInt(colorTint),
      lastColour: hexToInt(colorTint),
      blendMode,
      bitmap: loadedImage,
      lastBitmap: undefined,
      bitmapAlign: "center" as const,
      slices: undefined,
      bitmapCenter: undefined,
      lastBitmapCenter: undefined,
      border: false,
      centerLine: false,
    };

    canvas2D.draw(params);
    canvasWebGL.draw(params);
  }

  function toggleTest() {
    if (testRunning) {
      if (testInterval) {
        clearInterval(testInterval);
        testInterval = undefined;
      }
      testRunning = false;
    } else {
      testRunning = true;
      let step = 0;
      testInterval = setInterval(() => {
        // invert = Math.cos(step * 0.03) * 50 + 50;
        xBlur = Math.sin(step * 0.04) * 5 + 5;
        yBlur = Math.cos(step * 0.06) * 5 + 5;
        step++;
      }, 50);
    }
  }

  function handleResize() {
    canvas2D?.resize();
    canvasWebGL?.resize();
    render();
  }

  $effect(() => {
    overlayPercent;
    invert;
    xBlur;
    yBlur;
    bgColor;
    overlayColour;
    colorTint;
    blendMode;
    render();
  });
</script>

<svelte:window onresize={handleResize} />

<div class="container">
  <div class="controls">
    <div class="control-group">
      <label>Background colour</label>
      <div class="control-row">
        <select bind:value={bgColor}>
          <option value={0xffffff}>white</option>
          <option value={0}>black</option>
          <option value="transparent">transparent</option>
        </select>
      </div>
    </div>

    <div class="control-group">
      <label>Overlay colour</label>
      <div class="control-row">
        <select bind:value={overlayColour}>
          <option value={0xffffff}>white</option>
          <option value={0}>black</option>
        </select>
      </div>
    </div>

    <div class="control-group">
      <label>Overlay Percent: {(overlayPercent / 100).toFixed(2)}</label>
      <div class="control-row">
        <input
          type="range"
          bind:value={overlayPercent}
          min="0"
          max="100"
          step="1"
        />
      </div>
    </div>

    <div class="control-group">
      <label>Invert: {(invert / 100).toFixed(2)}</label>
      <div class="control-row">
        <input type="range" bind:value={invert} min="0" max="100" step="1" />
      </div>
    </div>

    <div class="control-group">
      <label>X Blur: {(xBlur / 100).toFixed(2)}</label>
      <div class="control-row">
        <input type="range" bind:value={xBlur} min="0" max="100" step="1" />
      </div>
    </div>

    <div class="control-group">
      <label>Y Blur: {(yBlur / 100).toFixed(2)}</label>
      <div class="control-row">
        <input type="range" bind:value={yBlur} min="0" max="100" step="1" />
      </div>
    </div>

    <div class="control-group">
      <label>Color Tint</label>
      <div class="control-row">
        <input type="color" bind:value={colorTint} />
        <span>{colorTint}</span>
      </div>
    </div>

    <div class="control-group">
      <label>Blend Mode</label>
      <div class="control-row">
        <select bind:value={blendMode}>
          <option value="multiply">multiply</option>
          <option value="screen">screen</option>
          <option value="hard-light">hard-light</option>
        </select>
      </div>
    </div>
  </div>

  <div class="canvas-container">
    <div class="canvas-wrapper">
      <h2>Canvas 2D</h2>
      <div class="canvas-area" bind:this={canvas2DEl}></div>
    </div>

    <div class="canvas-wrapper">
      <h2>Canvas WebGL</h2>
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

  h1 {
    text-align: center;
    margin-bottom: 20px;
    color: #fff;
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
