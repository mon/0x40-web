#version 300 es
precision highp float;

// GPU is quick, we can get away with a lot more. Timings on Firefox for Android
// on my Z Flip 7:
#define BLUR_ITERATIONS_MEDIUM 64.0   // 3ms
#define BLUR_ITERATIONS_HIGH 128.0    // 5ms
#define BLUR_ITERATIONS_EXTREME 512.0 // 7ms

#define BLUR_ITERATIONS 35.0

#define SLICE_X_SEGMENTS 25.0
#define SLICE_Y_SEGMENTS 15.0
// worst case 2x the larger of the two average segments
#define SLICE_LOOP_ITERS 50.0

in vec2 v_texCoord;
out vec4 fragColor;

uniform float u_shutter;
uniform int u_shutterDir;
uniform vec2 u_shutterWidth;

uniform float u_xBlur;
uniform float u_yBlur;
uniform float u_blurAmount;

uniform float u_xSlice;
uniform float u_xSliceSeed;
uniform float u_ySlice;
uniform float u_ySliceSeed;

// return value:
// 0 = current
// 1 = last
// 2 = black strip in shutter
int shutterStatus() {
  float shutterProgress;
  float shutterWidth;
  if (u_shutterDir == 0) { // ←
    shutterProgress = v_texCoord.x - (1.0 - u_shutter);
    shutterWidth = u_shutterWidth.x;
  } else if (u_shutterDir == 1) { // ↓
    shutterProgress = u_shutter - v_texCoord.y;
    shutterWidth = u_shutterWidth.y;
  } else if (u_shutterDir == 2) { // ↑
    shutterProgress = v_texCoord.y - (1.0 - u_shutter);
    shutterWidth = u_shutterWidth.y;
  } else if (u_shutterDir == 3) { // →
    shutterProgress = u_shutter - v_texCoord.x;
    shutterWidth = u_shutterWidth.x;
  }
  if (shutterProgress <= 0.0 && shutterProgress > -shutterWidth) {
    return 2;
  }

  return int(shutterProgress < 0.0);
}

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float sliceOffset(float offset, float avgSegments, float percent, float seed) {
  float even = 1.0 / avgSegments;
  float spread = even / 2.0;
  float total = 0.0;
  for (float i = 0.0; i < SLICE_LOOP_ITERS; i++) {
    float rando = even + hash(seed + i) * spread * 2.0 - spread;
    total += rando;

    float distance =
        hash(seed + i + avgSegments) * u_blurAmount - u_blurAmount / 2.0;

    if (offset < total) {
      // minus, because we're offsetting the texture sample, not the draw
      return -(distance * percent);
    }
  }
  // should never happen
  return 0.0;
}

vec4 blur(vec2 baseUv, vec2 blurAmount, sampler2D image) {
  vec4 px = vec4(0);
  float iters = 0.0;
  for (float index = 0.0; index < BLUR_ITERATIONS; index++) {
    vec2 uv = baseUv + vec2(index / (BLUR_ITERATIONS - 1.0) - 0.5) * blurAmount;
    if (any(greaterThan(uv, vec2(1))))
      continue;

    iters++;
    px += texture(image, uv);
  }
  if (iters == 0.0) {
    return px;
  }
  return px / iters;
}
