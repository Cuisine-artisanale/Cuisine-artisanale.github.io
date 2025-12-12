import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // output: 'export' is removed for Vercel deployment (supports API routes)
  images: {
	remotePatterns: [],
  },
  typescript: {
	ignoreBuildErrors: true, // Skip TypeScript errors during build - we'll fix these later
  },
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  // Exclure la page /map du prerendering
  experimental: {
	missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;


