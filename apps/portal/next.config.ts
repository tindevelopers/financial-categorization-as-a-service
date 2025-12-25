import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ESLint configuration - allow builds to succeed with warnings
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // Optimize images
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  
  // Enable compression
  compress: true,
  
  // Bundle optimization for consumer portal
  experimental: {
    optimizePackageImports: [
      "@tinadmin/core",
      "@tinadmin/ui-consumer",
      "@heroicons/react",
    ],
  },
  
  // Webpack configuration
  webpack(config, { isServer }) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    
    // Optimize bundle size with aliases for better tree-shaking
    const path = require('path');
    config.resolve.alias = {
      ...config.resolve.alias,
      '@tinadmin/core': path.resolve(__dirname, '../../packages/@tinadmin/core/src'),
      '@tinadmin/ui-consumer': path.resolve(__dirname, '../../packages/@tinadmin/ui-consumer/src'),
      '@tinadmin/config': path.resolve(__dirname, '../../packages/@tinadmin/config/src'),
    };
    
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    
    return config;
  },
  
  // Headers for caching
  async headers() {
    return [
      {
        source: "/:all*(svg|jpg|jpeg|png|webp|avif|ico)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Disable caching for review page to ensure latest changes are deployed
      {
        source: "/dashboard/review",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

