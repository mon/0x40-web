#version 300 es
precision highp float;

in vec2 a_position;

out vec2 v_texCoord;

const vec2 madd = vec2(0.5, 0.5);

void main() {
  v_texCoord =
      a_position.xy * madd + madd; // scale vertex attribute to [0-1] range
  gl_Position = vec4(a_position.xy, 0.0, 1.0);
}
