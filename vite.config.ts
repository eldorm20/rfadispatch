import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Honor the harness-assigned PORT when present; fall back to 5173 locally.
    port: Number(process.env.PORT) || 5173,
  },
  build: {
    // Split heavy vendors into their own cached chunks so first paint downloads less,
    // and the big Firebase SDK loads in parallel / stays cached across deploys.
    rollupOptions: {
      output: {
        manualChunks: {
          "firebase-app": ["firebase/app", "firebase/auth"],
          "firebase-firestore": ["firebase/firestore"],
          router: ["react-router-dom"],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
