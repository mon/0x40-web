#version 300 es
precision highp float;

// we perform X blur first, because if the viewport is narrow we want to sample
// outside of it and still blur the texture appropriately. Since images are full
// height, we can then Y blur later with no change in result

uniform sampler2D u_image;
in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  fragColor = texture(u_image, v_texCoord);
}
