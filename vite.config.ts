import { defineConfig } from 'vitest/config';

// Served from https://spunlit.github.io/ledger-fix-lab/ (GitHub Pages project site).
// Two pages: index.html is the landing page (static, its own CSS and a small script),
// app.html is the trainer itself (cases, daily file, practice files, plan), routed by hash.
// `npm run preview` serves the same build at http://localhost:4173/ledger-fix-lab/ (offline demo).
export default defineConfig({
  base: '/ledger-fix-lab/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        app: 'app.html',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // The exhaustive state-space and large-file tests take seconds on a small CI machine.
    testTimeout: 30_000,
  },
});
