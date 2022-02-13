// WebGL pixi doesn't actually implement this by itself, and pixi/picture doesn't
// work, you just get a white image... So draw the hardlight colour ourselves

import * as PIXI from 'pixi.js';

export class HardlightFilter extends PIXI.Filter {
    constructor() {
        var vertexShader = null;

        var fragmentShader = `
        precision mediump float;

        varying vec2 vTextureCoord;

        uniform vec3 colour;
        uniform vec4 overlay;
        uniform sampler2D uSampler;

        void main(void) {
            vec3 tex = texture2D(uSampler, vTextureCoord).rgb;
            vec3 col = colour;
            vec3 result;

            vec3 mult = 2.0 * tex * col;
            vec3 screen = 1.0 - 2.0 * (1.0 - tex) * (1.0 - col);

            if(tex.r > 0.5) { result.r = mult.r; } else { result.r = screen.r;}
            if(tex.g > 0.5) { result.g = mult.g; } else { result.g = screen.g;}
            if(tex.b > 0.5) { result.b = mult.b; } else { result.b = screen.b;}

            vec3 filtered = mix(tex, result, 0.7);
            gl_FragColor.rgb = mix(filtered, overlay.rgb, clamp(overlay.a, 0.0, 1.0));

            //gl_FragColor = vec4(colour, 0.7);
            //gl_FragColor.rgba = tex;
        }
        `;


        var uniforms = {
            colour: [0,0,0],
            overlay: [0,0,0,0],
        };

        super(vertexShader, fragmentShader, uniforms);
    }

    get colour() {
        return (
            Math.round(this.uniforms.colour[0]*255) << 16 |
            Math.round(this.uniforms.colour[1]*255) << 8 |
            Math.round(this.uniforms.colour[2]*255) << 0);
    }

    // eats 0xRRGGBB
    set colour(val) {
        this.uniforms.colour[0] = ((val >> 16) & 0xff) / 255;
        this.uniforms.colour[1] = ((val >> 8)  & 0xff) / 255;
        this.uniforms.colour[2] = ((val >> 0)  & 0xff) / 255;
    }

    set overlay(rgb_a) {
        let rgb = rgb_a[0];
        let a = rgb_a[1];
        this.uniforms.overlay[0] = ((rgb >> 16) & 0xff) / 255;
        this.uniforms.overlay[1] = ((rgb >> 8)  & 0xff) / 255;
        this.uniforms.overlay[2] = ((rgb >> 0)  & 0xff) / 255;
        this.uniforms.overlay[3] = a;
    }
}
