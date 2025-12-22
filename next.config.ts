import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // ESLint configuration - don't fail build on warnings
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // TypeScript configuration - don't fail build on type errors during dev
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
  
  // Optimize production builds
  // swcMinify is deprecated in Next.js 15+ (always enabled)
  
  // Bundle optimization
  experimental: {
    optimizePackageImports: [
      "@tinadmin/core",
      "@heroicons/react",
      "apexcharts",
      "react-apexcharts",
      "@fullcalendar/react",
      "@fullcalendar/core",
      "@fullcalendar/daygrid",
      "@fullcalendar/timegrid",
      "@fullcalendar/list",
      "@fullcalendar/interaction",
      "simplebar-react",
      "swiper",
    ],
  },
  
  // Webpack configuration
  webpack(config, { isServer }) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    
    // Optimize bundle size with aliases for better tree-shaking
    config.resolve.alias = {
      ...config.resolve.alias,
      '@tinadmin/core': path.resolve(__dirname, 'packages/@tinadmin/core/src'),
    };
    
    // Handle optional dependencies that may not be installed
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@google-cloud/documentai': false,
      '@google-cloud/storage': false,
    };
    
    // Optimize bundle size
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
    ];
  },
};

export default nextConfig;
