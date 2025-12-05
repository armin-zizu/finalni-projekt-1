import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Firebase Hosting - static export
  output: 'export',
  images: {
    unoptimized: true, // Potrebno za static export
  },
  // Onemogući ESLint greške u build procesu (privremeno)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Onemogući TypeScript greške u build procesu (privremeno)
  typescript: {
    ignoreBuildErrors: true,
  },
  // PWA podrška - Next.js automatski kopira fajlove iz public/ u build output
  // Service Worker (sw.js) i manifest.json će biti dostupni na root nivou
};

export default nextConfig;
