import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// base './' so the built files work from any folder (a Cirro dataset's web viewer path).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
});
