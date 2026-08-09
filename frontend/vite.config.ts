import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const backendTarget = "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/app": backendTarget,
      "/health": backendTarget,
      "/messages": backendTarget,
      "/ready": backendTarget,
      "/recipients": backendTarget,
      "/whatsapp": backendTarget,
    },
  },
});
