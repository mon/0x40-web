// without this file, vscode language server can't deal with ts svelte files
const sveltePreprocess = require('svelte-preprocess');

module.exports = {
  preprocess: sveltePreprocess()
};
