// Stage 1:
// Aspect-corrected texture rendering
//
// Slice (both directions)
// x blur (if no shutter or shutter is vertical)
// y blur (if shutter is horizontal)

#pragma vscode_glsllint_stage : frag

uniform sampler2D u_image;
uniform sampler2D u_lastImage;

uniform float u_aspect;
uniform float u_lastAspect;

void main() {
  int shutter = shutterStatus();
  if (shutter == 2)
    return;

  float aspect = shutter == 1 ? u_lastAspect : u_aspect;
  vec2 baseUv = vec2(
      // aspect correct
      v_texCoord.x * aspect,
      // want to maintain compat for Canvas2D, not Y-flipping input textures yet
      1.0 - v_texCoord.y);

  // First pass: we want to sample textures that "collide" through the shutter,
  // so blur/slice can sample pixels that aren't directly being displayed. The
  // next pass can then blur "with the grain". This still has an issue if an
  // image is cropped due to a thin display, and a top-to-bottom shutter is
  // running, as the X blur samples can't pull from outside pixels. But it's an
  // acceptable edge-case, as shutters run fast.
  vec2 blurDir;
  if (u_shutterDir == 0 || u_shutterDir == 3) {
    baseUv.x += sliceOffset(baseUv.y, SLICE_Y_SEGMENTS, u_ySlice, u_ySliceSeed);
    blurDir = vec2(u_xBlur, 0);
  } else {
    baseUv.y += sliceOffset(baseUv.x, SLICE_X_SEGMENTS, u_xSlice, u_xSliceSeed);
    blurDir = vec2(0, u_yBlur);
  }

  if (shutter == 1) {
    fragColor = blur(baseUv, blurDir, u_lastImage);
  } else {
    fragColor = blur(baseUv, blurDir, u_image);
  }
}
