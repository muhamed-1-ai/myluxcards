import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

export default function nextConfig(phase: string): NextConfig {
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://checkout.razorpay.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: https://*.wasabisys.com https://lh3.googleusercontent.com https://accounts.google.com",
    "media-src 'self' data: blob: https://*.wasabisys.com",
    "connect-src 'self' https://accounts.google.com https://apis.google.com https://*.wasabisys.com https://api.razorpay.com https://lumberjack.razorpay.com wss:",
    "frame-src 'self' https://accounts.google.com https://api.razorpay.com https://checkout.razorpay.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'self'",
  ].join("; ");

  return {
    poweredByHeader: false,
    distDir: process.env.NEXT_BUILD_DIR || '.next',
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: '**.wasabisys.com',
        },
        {
          protocol: 'http',
          hostname: '**.wasabisys.com',
        },
        {
          protocol: 'https',
          hostname: 'lh3.googleusercontent.com',
        },
      ],
    },
    async redirects() {
      return [
        { source: '/index.html', destination: '/', permanent: true },
        { source: '/corporate.html', destination: '/corporate', permanent: true },
        { source: '/find.html', destination: '/find', permanent: true },
        { source: '/privacy.html', destination: '/privacy', permanent: true },
        { source: '/support.html', destination: '/support', permanent: true },
      ];
    },
    async headers() {
      return [
        {
          source: '/dashboard',
          headers: [
            { key: 'Cache-Control', value: 'private, no-store, no-cache, must-revalidate, max-age=0' },
          ],
        },
        {
          source: '/:path*',
          headers: [
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
            { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
            { key: 'Content-Security-Policy-Report-Only', value: cspHeader },
          ],
        },
      ];
    },
  };
}
