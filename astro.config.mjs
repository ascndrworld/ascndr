import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.ascndrworld.com',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  adapter: vercel(),
  integrations: [
    sitemap({
      changefreq: 'monthly',
      priority: 0.7,
      lastmod: new Date(),
      serialize(item) {
        const path = new URL(item.url).pathname.replace(/\/$/, '');
        if (path === '') {
          item.priority = 1.0;
        } else if (path === '/terminos' || path === '/privacidad') {
          item.priority = 0.3;
          item.changefreq = 'yearly';
        } else if (path === '/contacto') {
          item.priority = 0.8;
        } else if (path.startsWith('/trabajos/')) {
          item.priority = 0.9;
        } else if (path === '/trabajos') {
          item.priority = 0.9;
        } else if (path === '/blog') {
          item.priority = 0.8;
          item.changefreq = 'weekly';
        } else if (path.startsWith('/blog/')) {
          item.priority = 0.7;
        }
        return item;
      },
    }),
  ],
});
