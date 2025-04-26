import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
  // note: keep up to date with the one in webpack.config.js
  compilerOptions: {
    // disable all accessibility warnings
    warningFilter: (warning) => !warning.code.startsWith('a11y')
  }
};
