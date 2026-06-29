import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Honor the harness-assigned PORT when present; fall back to 5173 locally.
    port: Number(process.env.PORT) || 5173,
  },
});
