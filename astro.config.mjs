// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://lab.einsia.ai',
  base: '/',
  output: 'static',
  redirects: {
    '/benchmarks': '/news',
  },
});
