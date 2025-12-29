// todo
// https://github.com/amilajack/gaussian-blur/tree/master

uniform sampler2D u_image;

uniform vec4 u_colour;
uniform vec4 u_lastColour;
uniform float u_colourFade;
uniform vec4 u_bgColour;
uniform vec4 u_overlayColour;

uniform float u_invert;
uniform bool u_invertEverything;

uniform float u_outTrippy;
uniform float u_inTrippy;

uniform int u_blendMode;

uniform float u_pixelWidth;
uniform bool u_border;
uniform float u_centerLine;

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

// void main() { fragColor = vec4(1, 0, 0, 1); }
void main() {
  int shutter = shutterStatus();
  if (shutter == 2) {
    fragColor = vec4(vec3(u_invert), 1);
    return;
  }

  // second blur/slice pass, see the other main()
  vec2 baseUv = v_texCoord;
  vec2 blurDir;
  if (u_shutterDir == 1 || u_shutterDir == 2) {
    baseUv.x += sliceOffset(baseUv.y, SLICE_Y_SEGMENTS, u_ySlice, u_ySliceSeed);
    blurDir = vec2(u_xBlur, 0);
  } else {
    baseUv.y += sliceOffset(baseUv.x, SLICE_X_SEGMENTS, u_xSlice, u_xSliceSeed);
    blurDir = vec2(0, u_yBlur);
  }

  vec4 px = blur(baseUv, blurDir, u_image);

  if (!u_invertEverything) {
    px.rgb = abs(vec3(u_invert) - px.rgb);
  }

  vec2 dist = abs(vec2(0.5) - v_texCoord);
  dist *= dist;
  float radius = sqrt(dist.x + dist.y);

  vec4 colour =
      mix(u_lastColour, shutter == 1 ? u_lastColour : u_colour, u_colourFade);

  if ((radius < u_inTrippy && radius < u_outTrippy) ||
      (radius > u_outTrippy && radius > u_inTrippy)) {
    colour.rgb = vec3(1) - colour.rgb;
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
    fragColor = mix(mix(vec4(1), colour, 0.7), overlaid, withBg.a);
  else
    fragColor = overlaid;

  if (u_invertEverything) {
    fragColor.rgb = abs(u_invert - fragColor.rgb);
    vec3 invertedOverlay = abs(u_invert - u_overlayColour.rgb);
    fragColor.rgb = mix(fragColor.rgb, invertedOverlay, u_overlayColour.a);
  }

  if (u_border && any(lessThanEqual(v_texCoord, vec2(u_pixelWidth)))) {
    fragColor = mix(fragColor, vec4(1, 0, 0, 1), 0.5);
  }
  if (v_texCoord.x >= u_centerLine &&
      v_texCoord.x < (u_centerLine + u_pixelWidth)) {
    fragColor = mix(fragColor, vec4(0, 1, 0, 1), 0.5);
  }
}
