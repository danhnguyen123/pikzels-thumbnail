import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// FastAPI serve bản build (dist). Khi dev tách server, proxy sang FastAPI :8000.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
      "/ws": { target: "ws://localhost:8000", ws: true },
    },
  },
  build: { outDir: "dist" },
});
