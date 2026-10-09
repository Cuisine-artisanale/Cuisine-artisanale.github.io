import type { NextConfig } from 'next';

// Déployé sur Vercel (pages + routes API). Pas d'export statique.
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
