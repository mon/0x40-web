<script lang="ts">
  import { onMount } from "svelte";
  import type SoundManager from "../SoundManager";

  export let disabled = false;
  export let soundManager: SoundManager | null = null;

  const WAVE_PIXELS_PER_SECOND = 100;
  const WAVE_HEIGHT_PIXELS = 30;

  let canvas: HTMLCanvasElement;
  let waveContext: CanvasRenderingContext2D | null;

  let buildWave: HTMLCanvasElement | null;
  let loopWave: HTMLCanvasElement | null;

  let renderWave = (buffer: AudioBuffer | undefined, length: number) => {
    if (!buffer) {
      return null;
    }
    // The individual wave section
    let wave = document.createElement("canvas");
    let waveContext = wave.getContext("2d")!;

    wave.height = WAVE_HEIGHT_PIXELS;
    wave.width = Math.floor(WAVE_PIXELS_PER_SECOND * length);

    let samplesPerPixel = Math.floor(
      buffer.sampleRate / WAVE_PIXELS_PER_SECOND
    );
    let waveData = [];
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      waveData.push(buffer.getChannelData(i));
    }
    let channels = buffer.numberOfChannels;
    // Half pixel offset makes things look crisp
    let pixel = 0.5;
    let halfHeight = WAVE_HEIGHT_PIXELS / 2;
    for (let i = 0; i < buffer.length; i += samplesPerPixel) {
      let min = 0,
        max = 0,
        avgHi = 0,
        avgLo = 0;
      let j;
      for (j = 0; j < samplesPerPixel && i + j < buffer.length; j++) {
        for (let chan = 0; chan < channels; chan++) {
          let sample = waveData[chan][i + j];
          if (sample > 0) {
            avgHi += sample;
          } else {
            avgLo += sample;
          }
          if (sample > max) max = sample;
          if (sample < min) min = sample;
        }
      }
      let maxPix = Math.floor(halfHeight + max * halfHeight);
      // Min is negative, addition is correct
      let minPix = Math.floor(halfHeight + min * halfHeight);
      waveContext.strokeStyle = "black";
      waveContext.globalAlpha = 1;
      waveContext.beginPath();
      waveContext.moveTo(pixel, maxPix);
      waveContext.lineTo(pixel, minPix);
      waveContext.stroke();

      // Draw the average too, gives a better feel for the wave
      avgHi /= j * channels;
      avgLo /= j * channels;
      let maxAvg = Math.floor(halfHeight + avgHi * halfHeight);
      let minAvg = Math.floor(halfHeight + avgLo * halfHeight);
      waveContext.strokeStyle = "white";
      waveContext.globalAlpha = 0.5;
      waveContext.beginPath();
      waveContext.moveTo(pixel, maxAvg);
      waveContext.lineTo(pixel, minAvg);
      waveContext.stroke();

      pixel += 1;
    }

    return wave;
  };

  let drawOneWave = (
    wave: HTMLCanvasElement,
    waveOffset: number,
    drawOffset: number,
    width: number
  ) => {
    let drawWidth = Math.min(width - drawOffset, wave.width - waveOffset);
    waveContext!.drawImage(
      wave,
      waveOffset,
      0, // source x/y
      drawWidth,
      WAVE_HEIGHT_PIXELS, // source width/height
      drawOffset,
      0, // dest x/y
      drawWidth,
      WAVE_HEIGHT_PIXELS
    ); // dest width/height
    return drawOffset + drawWidth;
  };

  let drawWaveBar = (colour: string, offset: number) => {
    waveContext!.strokeStyle = colour;
    waveContext!.lineWidth = 2;
    waveContext!.beginPath();
    waveContext!.moveTo(offset, 0);
    waveContext!.lineTo(offset, WAVE_HEIGHT_PIXELS);
    waveContext!.stroke();
  };

  let drawWave = () => {
    if ((!buildWave && !loopWave) || disabled || !soundManager) return;

    let width = canvas.width;
    let now = soundManager.currentTime;
    let timespan = width / WAVE_PIXELS_PER_SECOND / 2;
    let minTime = now - timespan;
    let maxTime = now + timespan;

    let bLen = soundManager.build.length;
    let loopLen = soundManager.loop.length;

    let drawTime, drawOffset;
    if (bLen) {
      drawTime = Math.max(minTime, -bLen);
    } else {
      drawTime = Math.max(minTime, 0);
    }
    // drawOffset is "pixels from the left"
    drawOffset = Math.floor((drawTime - minTime) * WAVE_PIXELS_PER_SECOND);

    waveContext!.clearRect(0, 0, width, WAVE_HEIGHT_PIXELS);

    if (buildWave && bLen && minTime < 0) {
      // Bit of legwork to convert negative to positive
      let waveOffset = Math.floor(
        (1 - drawTime / -bLen) * (buildWave.width - 1)
      );
      try {
        drawOffset = drawOneWave(buildWave, waveOffset, drawOffset, width);
      } catch (err) {
        console.log(canvas);
      }
      // If there's more to draw after the build, it'll be from the start of the wave
      drawTime = 0;
    }

    let loopPoints = [];
    if (loopWave && loopLen && maxTime > 0) {
      while (drawOffset < width) {
        if (drawTime === 0) {
          loopPoints.push(drawOffset);
        }

        let waveOffset = Math.floor(
          (drawTime / loopLen) * (loopWave.width - 1)
        );
        drawOffset = drawOneWave(loopWave, waveOffset, drawOffset, width);
        // If we're drawing more than 1 loop it's starting at 0
        drawTime = 0;
      }
    }

    // trackbar
    drawWaveBar("red", width / 2);
    // Signify loop point with a green bar, drawing over the wave
    for (let point of loopPoints) {
      drawWaveBar("green", point);
    }
  };

  $: if (soundManager) {
    buildWave = renderWave(
      soundManager.build.buffer,
      soundManager.build.length
    );
    loopWave = renderWave(soundManager.loop.buffer, soundManager.loop.length);
  }

  let resize = () => {
    canvas.width = canvas.clientWidth;
  };

  onMount(() => {
    resize();
    waveContext = canvas.getContext("2d");

    let rid = requestAnimationFrame(function update() {
      drawWave();
      rid = requestAnimationFrame(update);
    });

    // resize doesn't work when the window is hidden, so capture when
    // visibility changes as well
    let observer = new IntersectionObserver((entries, observer) => {
      for (let entry of entries) {
        if (entry.intersectionRatio > 0) {
          resize();
        }
      }
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(rid);
      observer.disconnect();
    };
  });
</script>

<svelte:window on:resize={resize} />

<canvas
  bind:this={canvas}
  height={WAVE_HEIGHT_PIXELS}
  style="height:{WAVE_HEIGHT_PIXELS}px"
/>

<style>
  canvas {
    width: 100%;
  }
</style>
