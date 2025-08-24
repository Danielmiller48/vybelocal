// next.config.mjs
import nextPWA from 'next-pwa';

const isDev = process.env.NODE_ENV === 'development';

const withPWA = nextPWA({
  dest: 'public',
  disable:  isDev,   // <-- no service-worker in `pnpm dev`
  register: true,
  skipWaiting: true,

  /* -------- runtime caching ---------- */
  runtimeCaching: [
    // 1) Static assets – cache-first
    {
      urlPattern: /^https?.*\.(png|jpe?g|svg|gif|webp|avif|js|css)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },

    // 2) API / HTML – network-first
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'http-calls',
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
      },
    },

    // 3) Offline fallback for navigation
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkOnly',
      options: {
        // served when both network and cache miss
        precacheFallback: { fallbackURL: '/offline.html' },
      },
    },
  ],

  /* -------- kill the ghost route ---------- */
  // Anything that *contains* “/find” in its generated path is left out of precache,
  // so the new sw.js won’t request it again.
 buildExcludes: [/\/find/], 
});

export default withPWA({
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tzwksdoffzoerzcfsucm.supabase.co',
        pathname: '/storage/v1/object/public/event-images/**',
      },
      {
        protocol: 'https',
        hostname: 'tzwksdoffzoerzcfsucm.supabase.co',
        pathname: '/storage/v1/object/public/profile-avatars/**',
      },
    ],
  },
});
