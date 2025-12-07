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
};

export default nextConfig;
