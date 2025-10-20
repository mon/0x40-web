attribute vec2 a_position;

uniform vec2 u_resolution;
uniform mat3 u_matrix;

varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(u_matrix * vec3(a_position, 1), 1);
  v_texCoord = a_position;
}
