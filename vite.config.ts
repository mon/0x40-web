import { defineConfig } from "vite";
import { resolve } from "path";
import serveStatic from "serve-static";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        respack_edit: resolve(__dirname, "respack_edit.html"),
      },
    },
  },
  define: {
    VERSION: JSON.stringify(require("./package.json").version),
  },
  plugins: [
    svelte(),
    // Put all testing/development respacks in dev_public
    {
      name: "dev-public",
      configureServer(server) {
        server.middlewares.use(serveStatic(resolve(__dirname, "dev_public")));
      },
    },
  ],
});
