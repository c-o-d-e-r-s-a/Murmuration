import { resolve } from "node:path";
import { defineConfig } from "vite";

const pages = ["screen", "play", "host", "dev", "replay"];

export default defineConfig({
  root: "web",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve("web", "index.html"),
        ...Object.fromEntries(pages.map((p) => [p, resolve("web", p, "index.html")])),
      },
    },
  },
});
