import { defineConfig } from 'vitest/config';

// Served from https://spunlit.github.io/ledger-fix-lab/ (GitHub Pages project site).
// `npm run preview` serves the same build at http://localhost:4173/ledger-fix-lab/ (offline demo).
export default defineConfig({
  base: '/ledger-fix-lab/',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
