import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
  },
  server: {
    port: 5177,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  preview: {
    port: 4177,
  },
});
