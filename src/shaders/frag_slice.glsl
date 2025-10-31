#version 300 es
precision highp float;

// Slice (and align/scale) is the first operation, as the blurring is performed
// on it

uniform sampler2D u_image;
in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  fragColor = texture(u_image, v_texCoord);
}
