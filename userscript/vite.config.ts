import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/main.ts',
      name: 'IPLAuctionArenaExporter',
      fileName: () => 'ipl-auction-arena.user.js',
      formats: ['iife'],
    },
    outDir: '../public/userscript',
    emptyOutDir: true,
    minify: false, // Keep readable for debugging
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
})