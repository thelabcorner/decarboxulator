import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';

export default defineConfig({
  // GitHub Pages project deploy: VITE_BASE_PATH=/decarboxulator/
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    tanstackStart({
      prerender: {
        enabled: true,
        autoSubfolderIndex: true,
        autoStaticPathsDiscovery: true,
        crawlLinks: true,
        // With a GitHub Pages mount, crawled links carry the external base.
        // Prerender the actual route paths only; prevent a second /decarboxulator/
        // directory from accidentally becoming publicly indexable.
        filter: ({ path }) => !process.env.VITE_BASE_PATH || process.env.VITE_BASE_PATH === '/' ||
          !path.startsWith(process.env.VITE_BASE_PATH),
        concurrency: 4,
        failOnError: true,
      },
    }),
    react(),
  ],
  server: { host: '0.0.0.0', port: 3000 },
});
