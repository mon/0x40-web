// todo
// https://github.com/amilajack/gaussian-blur/tree/master

precision mediump float;

uniform sampler2D u_image;
uniform sampler2D u_lastImage;

uniform vec4 u_colour;
uniform vec4 u_lastColour;
uniform float u_colourFade;
uniform vec4 u_bgColour;
uniform vec4 u_overlayColour;

uniform float u_blurAmount;
uniform float u_invert;
uniform bool u_invertEverything;

uniform float u_shutter;
uniform int u_shutterDir;
uniform vec2 u_shutterWidth;

uniform float u_outTrippy;
uniform float u_inTrippy;

uniform int u_blendMode;

// GPU is quick, we can get away with a lot more. Timings on Firefox for Android
// on my Z Flip 7:
#define BLUR_ITERATIONS_MEDIUM 64.0   // 3ms
#define BLUR_ITERATIONS_HIGH 128.0    // 5ms
#define BLUR_ITERATIONS_EXTREME 512.0 // 7ms

#define BLUR_ITERATIONS 35.0

// the texCoords passed in from the vertex shader.
varying vec2 v_texCoord;

vec4 blendMultiply(vec4 px, vec4 colour) {
  return px * colour;
}

vec4 blendScreen(vec4 px, vec4 colour) {
  return 1.0 - (1.0 - px) * (1.0 - colour);
}

vec4 blendHardLight(vec4 px, vec4 colour) {
  return mix(2.0 * px * colour, 1.0 - 2.0 * (1.0 - px) * (1.0 - colour),
             step(0.5, colour));
}

// void main() { gl_FragColor = vec4(1, 0, 0, 1); }
void main() {
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
    gl_FragColor = vec4(vec3(u_invert), 1.0);
    return;
  }
  bool useLastImage = shutterProgress < 0.0;

  vec4 px = vec4(0.0);
  for (float index = 0.0; index < BLUR_ITERATIONS; index++) {
    vec2 uv = v_texCoord +
              vec2((index / (BLUR_ITERATIONS - 1.0) - 0.5) * u_blurAmount, 0.0);
    if (useLastImage)
      px += texture2D(u_lastImage, uv);
    else
      px += texture2D(u_image, uv);
  }
  px = px / BLUR_ITERATIONS;
  if (!u_invertEverything) {
    px.rgb = abs(vec3(u_invert) - px.rgb);
  }

  vec2 dist = abs(vec2(0.5) - v_texCoord);
  dist *= dist;
  float radius = sqrt(dist.x + dist.y);

  vec4 colour =
      mix(u_lastColour, useLastImage ? u_lastColour : u_colour, u_colourFade);

  if ((radius < u_inTrippy && radius < u_outTrippy) ||
      (radius > u_outTrippy && radius > u_inTrippy)) {
    colour.rgb = vec3(1.0) - colour.rgb;
  }

  // surely there's an easier way to draw things on top of other things
  vec4 withBg = mix(u_bgColour, px, px.a);

  vec4 blended;
  if (u_blendMode == 0)
    blended = blendHardLight(withBg, colour);
  else if (u_blendMode == 1)
    blended = blendScreen(withBg, colour);
  else
    blended = blendMultiply(withBg, colour);

  // I don't understand premultiplied alpha, but I *do* understand filthy hacks
  // gl_FragColor = blended;
  vec4 overlaid = mix(withBg, blended, 0.7);
  if (u_bgColour.a == 0.0)
    gl_FragColor = mix(mix(vec4(1.0), colour, 0.7), overlaid, withBg.a);
  else
    gl_FragColor = overlaid;

  if (u_invertEverything) {
    gl_FragColor.rgb = abs(u_invert - gl_FragColor.rgb);
    vec3 invertedOverlay = abs(u_invert - u_overlayColour.rgb);
    gl_FragColor.rgb =
        mix(gl_FragColor.rgb, invertedOverlay, u_overlayColour.a);
  }
}
