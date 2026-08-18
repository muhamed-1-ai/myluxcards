import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

export default function nextConfig(phase: string): NextConfig {
  return {
    // Keep development chunks isolated from production builds. Running `next build`
    // must never replace files required by an active `next dev` server.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
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
      return [{
        source: '/dashboard',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, no-cache, must-revalidate, max-age=0' },
        ],
      }];
    },
  };
}
