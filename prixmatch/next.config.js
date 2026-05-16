// next.config.js — Configuration principale de l'application PrixMatch
const withPWA = require('next-pwa')({
  dest: 'public',
  // Désactiver le service worker en développement pour éviter les conflits de cache
  disable: process.env.NODE_ENV === 'development',
  // Mise en cache du modèle Tesseract (gros fichier, à cacher impérativement)
  runtimeCaching: [
    {
      urlPattern: /.*\.traineddata/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'tesseract-models',
        expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 jours
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Nécessaire pour Tesseract.js côté client (worker)
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
