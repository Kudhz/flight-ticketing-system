import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    proxy: {
      "/server": {
        target: "http://192.168.111.177:9594",
        changeOrigin: true,
      },
      "/api": {
        target: "http://192.168.111.177:3001",
        changeOrigin: true,
      },
    },
  },
});
