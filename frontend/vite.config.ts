import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function copyRubberbandWorklet(): Plugin {
  const copy = () => {
    const root = path.dirname(fileURLToPath(import.meta.url));
    const src = path.join(root, "node_modules/rubberband-web/public/rubberband-processor.js");
    const destDir = path.join(root, "public/worklets");
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, path.join(destDir, "rubberband-processor.js"));
  };
  return {
    name: "copy-rubberband-worklet",
    buildStart: copy,
    configureServer: copy,
  };
}

export default defineConfig({
  plugins: [react(), copyRubberbandWorklet()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/ws": { target: "ws://localhost:8000", ws: true },
    },
  },
});
