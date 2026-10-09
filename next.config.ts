import type { NextConfig } from 'next';

// Déployé sur Vercel (pages + routes API). Pas d'export statique.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Photos des recettes (Firebase Storage) : redimensionnées et converties en WebP par Vercel.
    // Voir src/lib/utils/image.ts pour les autres sources.
    remotePatterns: [{ protocol: 'https', hostname: 'firebasestorage.googleapis.com' }],
    // Cache long : les URL Firebase (avec token) ne changent pas pour une même image
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
