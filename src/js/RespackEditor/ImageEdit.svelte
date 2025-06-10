<script lang="ts">
  import { onMount, tick } from "svelte";
  import HuesCanvas2D from "../HuesCanvas2D";
  import type { HuesImage } from "../ResourcePack";
  import { oldColours } from "../HuesCore.svelte";
  import { intToHex } from "../Utils";

  export let images: HuesImage[];

  let selectedImage: HuesImage | undefined;
  let animI = 0;
  let animTimeout: NodeJS.Timeout | undefined;

  let imboxEl: HTMLDivElement;
  $: canvas =
    imboxEl !== undefined
      ? (resizeCanvas(), new HuesCanvas2D(imboxEl))
      : undefined;

  let centerLine = false;
  let phoneRatio: number = 22 / 9;

  // other render options
  // closest to no filter, best for most image editing scenarios
  let blendMode: GlobalCompositeOperation = "multiply";
  let bgColour: number | "transparent" = 0xffffff;
  let colour = 0xffffff; // white
  let invert = 0.0;

  async function resizeCanvas() {
    await tick();
    canvas?.resize();
  }

  function toggleCenter(e: Event) {
    if (!selectedImage) {
      return;
    }

    if (selectedImage.centerPixel !== undefined) {
      selectedImage.centerPixel = undefined;
    } else {
      const width = selectedImage!.bitmaps[0].naturalWidth;
      switch (selectedImage.align) {
        case "center":
          selectedImage.centerPixel = width / 2;
          break;
        case "left":
          selectedImage.centerPixel = 0;
          break;
        case "right":
          selectedImage.centerPixel = width;
          break;
      }
    }
  }

  function onFrame() {
    canvas?.draw({
      colour,
      lastColour: 0xffffff,
      blendMode,
      bgColour,

      overlayColour: 0,
      overlayPercent: 0,

      invert,

      bitmap: selectedImage?.bitmaps[animI],
      bitmapAlign: selectedImage?.align,
      bitmapCenter: selectedImage?.centerPixel,

      xBlur: 0,
      yBlur: 0,

      border: true,
      centerLine,
    });
  }

  onMount(() => {
    window.addEventListener("resize", resizeCanvas);

    let raf: number;
    let cb = () => {
      onFrame();
      raf = window.requestAnimationFrame(cb);
    };
    raf = window.requestAnimationFrame(cb);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resizeCanvas);
    };
  });

  const nextFrame = () => {
    animI++;
    // fine to just assume frameDurations.length === bitmaps.length because
    // respack loader guarantees it for animations
    animI %= selectedImage!.frameDurations.length;
    animTimeout = setTimeout(nextFrame, selectedImage!.frameDurations[animI]);
  };

  const newImage = () => {
    animI = 0;

    if (animTimeout !== undefined) {
      clearTimeout(animTimeout);
      animTimeout = undefined;
    }

    if (selectedImage?.animated) {
      animTimeout = setTimeout(nextFrame, selectedImage.frameDurations[animI]);
    }
  };
</script>

<select bind:value={selectedImage} on:change={newImage} size="20">
  {#each images as image}
    <option value={image}>{image.name}</option>
  {/each}
</select>

{#if selectedImage}
  <div class="controls">
    <label for="imName">Name:</label>
    <input id="imName" type="text" bind:value={selectedImage.name} />

    <label for="imFull">Full name:</label>
    <input id="imFull" type="text" bind:value={selectedImage.fullname} />

    <label for="imAlign">Align:</label>
    <select id="imAlign" bind:value={selectedImage.align}>
      <option>center</option>
      <option>left</option>
      <option>right</option>
    </select>

    <label for="centerPx">Center pixel</label>
    <input
      id="centerPx"
      type="checkbox"
      on:change={toggleCenter}
      checked={selectedImage.centerPixel !== undefined}
    />
    {#if selectedImage.centerPixel !== undefined}
      <input
        type="range"
        bind:value={selectedImage.centerPixel}
        min="0"
        max={selectedImage.bitmaps[animI].naturalWidth}
      />
      <input
        type="number"
        bind:value={selectedImage.centerPixel}
        min="0"
        max={selectedImage.bitmaps[animI].naturalWidth}
        style="width: 5em"
      />
    {/if}
  </div>
  <div>
    <label for="showCenter">Show centerline:</label>
    <input id="showCenter" type="checkbox" bind:checked={centerLine} />

    <label for="phoneSim">Screen aspect ratio:</label>
    <select id="phoneSim" bind:value={phoneRatio} on:change={resizeCanvas}>
      <option value={22 / 9}>Wide PC (22:9)</option>
      <option value={16 / 9}>Normal PC (16:9)</option>
      <option value={1 / 1}>Square</option>
      <option value={3 / 4}>iPad (4:3)</option>
      <option value={9 / 16}>Vertical PC (16:9)</option>
      <option value={9 / 19.5}>iPhone (19.5:9)</option>
      <option value={9 / 22}>Z Flip (22:9)</option>
    </select>
    <input
      type="range"
      bind:value={phoneRatio}
      on:input={resizeCanvas}
      min={9 / 30}
      max={30 / 9}
      step="0.01"
    />

    <div>
      <label for="colour">Colour</label>
      <select id="colour" bind:value={colour}>
        {#each oldColours as col}
          <option value={col["c"]}>{col["n"]}</option>
        {/each}
      </select>
      <span class="colourbox" style="background-color: {intToHex(colour)}"
      ></span>

      <label for="blendMode">Blend mode</label>
      <select id="blendMode" bind:value={blendMode}>
        {#each ["hard-light", "screen", "multiply"] as blend}
          <option value={blend}>{blend}</option>
        {/each}
      </select>

      <label for="bgColour">Background colour</label>
      <select id="bgColour" bind:value={bgColour}>
        <option value={0xffffff}>White</option>
        <option value={0}>Black</option>
        <option value="transparent">Transparent</option>
      </select>

      <label for="invert">Invert</label>
      <input
        id="invert"
        type="range"
        bind:value={invert}
        min={0}
        max={1}
        step="0.01"
      />

      {#if canvas}
        <label for="errythin">invert everything</label>
        <input
          id="errythin"
          type="checkbox"
          bind:checked={canvas.invertEverything}
        />
      {/if}
    </div>

    <!-- Make a super-wide preview box to demonstrate image alignment -->
    <div
      class="imbox"
      bind:this={imboxEl}
      style="aspect-ratio:{phoneRatio}"
    ></div>
  </div>
{/if}

<style>
  .controls {
    display: flex;
    align-items: center;
  }

  .colourbox {
    display: inline-block;
    width: 3em;
    height: 1em;
  }

  .imbox {
    position: relative;
    border: 1px solid blue;
    max-width: 100%;
    max-height: 720px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
</style>
