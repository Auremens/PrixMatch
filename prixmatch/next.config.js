// next.config.js — Configuration principale de l'application PrixMatch
const withPWA = require('next-pwa')({
  dest: 'public',
  // Désactiver le service worker complètement pour éviter les problèmes de cache
  disable: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    return config;
  },
};

module.exports = withPWA(nextConfig);
