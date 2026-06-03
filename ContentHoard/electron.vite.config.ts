import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ["electron", "electron-store"]
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        external: ["electron"]
      }
    }
  },
  renderer: {
    plugins: [react()]
  }
});
