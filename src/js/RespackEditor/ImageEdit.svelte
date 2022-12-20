<script lang="ts">
import { onMount, tick } from "svelte";
import HuesCanvas2D from "../HuesCanvas2D";
import type { HuesImage } from "../ResourcePack";

export let images: HuesImage[];

let selectedImage: HuesImage | undefined;
let animI = 0;
let animTimeout: NodeJS.Timeout | undefined;

let canvas: HuesCanvas2D;
let imboxEl: HTMLDivElement;

let centerLine = false;
let phoneRatio: number = 22/9;

async function resizeCanvas() {
    await tick();
    canvas.resize();
}

function toggleCenter(e: Event) {
    if(!selectedImage) {
        return;
    }

    if(selectedImage.centerPixel !== undefined) {
        selectedImage.centerPixel = undefined;
    } else {
        const width = selectedImage!.bitmaps[0].naturalWidth;
        switch(selectedImage.align) {
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
    canvas.draw({
        colour: 0xFFFFFF,
        lastColour: 0xFFFFFF,
        blendMode:  'soft-light',
        bgColour: 0xFFFFFF,

        overlayColour: 0,
        overlayPercent: 0,

        invert: false,

        bitmap: selectedImage?.bitmaps[animI],
        bitmapAlign: selectedImage?.align,
        bitmapCenter: selectedImage?.centerPixel,

        xBlur: 0,
        yBlur: 0,

        border: true,
        centerLine,
    });
}

onMount(async () => {
    await tick();

    canvas = new HuesCanvas2D(imboxEl);

    let raf: number;
    let cb = () => {
        onFrame();
        raf = window.requestAnimationFrame(cb);
    };
    raf = window.requestAnimationFrame(cb);

    return () => {
        window.cancelAnimationFrame(raf);
    };
})

const nextFrame = () => {
    animI++;
    // fine to just assume frameDurations.length === bitmaps.length because
    // respack loader guarantees it for animations
    animI %= selectedImage!.frameDurations.length;
    animTimeout = setTimeout(nextFrame, selectedImage!.frameDurations[animI]);
}

const newImage = () => {
    animI = 0;

    if(animTimeout !== undefined) {
        clearTimeout(animTimeout);
        animTimeout = undefined;
    }

    if(selectedImage?.animated) {
        animTimeout = setTimeout(nextFrame, selectedImage.frameDurations[animI]);
    }
}
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
    <input id="centerPx" type="checkbox" on:change={toggleCenter} checked={selectedImage.centerPixel !== undefined}/>
    {#if selectedImage.centerPixel !== undefined}
        <input type="range"
            bind:value={selectedImage.centerPixel}
            min=0
            max={selectedImage.bitmaps[animI].naturalWidth}
        />
        <input type="number"
            bind:value={selectedImage.centerPixel}
            min=0
            max={selectedImage.bitmaps[animI].naturalWidth}
            style="width: 5em"
        />
    {/if}

</div>
<div>
    <label for="showCenter">Show centerline:</label>
    <input id="showCenter" type="checkbox" bind:checked={centerLine}/>

    <label for="phoneSim">Screen aspect ratio:</label>
    <select id="phoneSim" bind:value={phoneRatio} on:change={resizeCanvas}>
        <option value={22/9}>Wide PC (22:9)</option>
        <option value={16/9}>Normal PC (16:9)</option>
        <option value={1/1}>Square</option>
        <option value={3/4}>iPad (4:3)</option>
        <option value={9/16}>Vertical PC (16:9)</option>
        <option value={9/19.5}>iPhone (19.5:9)</option>
        <option value={9/22}>Z Flip (22:9)</option>
    </select>
    <input type="range"
        bind:value={phoneRatio}
        on:input={resizeCanvas}
        min={9/30}
        max={30/9}
        step=0.01
    />

    <!-- Make a super-wide preview box to demonstrate image alignment -->
    <div class="imbox" bind:this={imboxEl} style="aspect-ratio:{phoneRatio}" />
</div>
{/if}

<style>
.controls {
    display: flex;
    align-items: center;
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
