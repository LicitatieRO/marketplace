import type { NextConfig } from 'next';
import { isSiteIndexingEnabled } from './src/lib/site-indexing';
const baselineSecurityHeaders: { key: string; value: string }[] = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
function responseSecurityHeaders() {
  const headers = [...baselineSecurityHeaders];
  if (!isSiteIndexingEnabled()) {
    headers.push({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
  }
  return headers;
}
const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: 'standalone',
  outputFileTracingIncludes: {
    '/tiles/[...path]': ['./data/tiles/**'],
  },
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
  async headers() {
    return [{ source: '/:path*', headers: responseSecurityHeaders() }];
  },
};
export default nextConfig;
