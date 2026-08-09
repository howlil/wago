import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/app": "http://127.0.0.1:3100",
      "/health": "http://127.0.0.1:3100",
      "/messages": "http://127.0.0.1:3100",
      "/whatsapp": "http://127.0.0.1:3100"
    }
  }
});
