/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip TypeScript type checking during build for faster builds
  typescript: {
    ignoreBuildErrors: false, // Set to true if you want to skip type errors during build
  },
  // Skip ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Optimize build performance
  swcMinify: true,
  // Increase build timeout
  staticPageGenerationTimeout: 120,
};

module.exports = nextConfig;

