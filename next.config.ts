import type { NextConfig } from 'next'

// Content-Security-Policy: only the origins the sites actually use (measured
// 2026-10-18: no third-party requests except Blob photos and, on Napsugár,
// OSM map tiles). 'unsafe-inline' is needed for Next's inline bootstrap
// scripts and the JSON-LD blocks; everything else is locked to 'self'.
// Production only — next dev relies on eval for fast refresh.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ')

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
    qualities: [70, 75],
  },
  // The OG route reads the vendored TTFs at runtime.
  outputFileTracingIncludes: { '/brand/og': ['./assets/fonts/**'] },
  // Browsers still probe /favicon.ico (e.g. on the 404 page): serve the house mark.
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/brand/icon' }]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(process.env.NODE_ENV === 'production' ? [{ key: 'Content-Security-Policy', value: csp }] : []),
        ],
      },
    ]
  },
}

export default nextConfig
