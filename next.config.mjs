import nextPWA from 'next-pwa';

/** @type {import('next').NextConfig} */
const withPWA = nextPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,

  // ---- Runtime-caching rules ----
  runtimeCaching: [
    // 1) Static assets – cache-first
    {
      urlPattern: /^https?.*\.(?:png|jpg|jpeg|svg|gif|webp|avif|js|css)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }, // 30 days
      },
    },
    // 2) API / HTML – network-first
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'http-calls',
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },      // 1 day
      },
    },
    // 3) Offline fallback for navigation
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkOnly',
      options: { fallbackURL: '/offline.html' },
    },
  ],
});

export default withPWA({
  reactStrictMode: true,
  images: {
    domains: ['your-image-cdn.com'],
  },
});