import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Minimal Vite config for the provided test-harness.
// The dev server prints its URL on `npm run dev`.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
