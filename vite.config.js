import { defineConfig } from "vite";

// Tauri serves the frontend from a Vite dev server in development and from the
// built `dist/` folder in production. `root: "src"` keeps index.html/main.js/
// styles.css where the scaffold placed them.
export default defineConfig({
  root: "src",
  // Prevent Vite from obscuring Rust errors.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    // Output to <project>/dist (one level up from `src`).
    outDir: "../dist",
    emptyOutDir: true,
    target: "esnext",
  },
});
