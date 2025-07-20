/** @type {import('next').NextConfig} */
const nextConfig = {
  // Core configuration
  reactStrictMode: true,
  poweredByHeader: false,
  generateEtags: true,
  compress: true,
  
  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
    tsconfigPath: './tsconfig.json',
  },
  
  // ESLint configuration
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['app', 'components', 'lib', 'types'],
  },
  
  // Performance optimizations
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.myshopify.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '') || 'localhost',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Experimental features
  experimental: {
    // Server actions
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: [
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      ],
    },
    
    // Performance optimizations
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    webVitalsAttribution: ['CLS', 'LCP'],
    
    // Advanced features
    appDir: true,
    serverComponentsExternalPackages: ['sharp', 'onnxruntime-node'],
    
    // Caching
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  
  // Webpack configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Optimization for AI/ML packages
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push({
        '@tensorflow/tfjs-node': 'commonjs @tensorflow/tfjs-node',
        'sharp': 'commonjs sharp',
      });
    }
    
    // Bundle analyzer
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
        })
      );
    }
    
    // Performance optimizations
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    
    return config;
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/api/webhooks/:path*',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.CORS_ORIGIN || '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
  
  // Redirects for legacy URLs
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/dashboard',
        permanent: true,
      },
    ];
  },
  
  // Rewrites for API proxying
  async rewrites() {
    return [
      {
        source: '/healthz',
        destination: '/api/health',
      },
      {
        source: '/metrics',
        destination: '/api/metrics',
      },
    ];
  },
  
  // Output configuration for deployment
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  
  // Logging
  logging: {
    fetches: {
      level: process.env.NODE_ENV === 'development' ? 'verbose' : 'error',
    },
  },
  
  // Development configuration
  ...(process.env.NODE_ENV === 'development' && {
    devIndicators: {
      buildActivity: true,
      buildActivityPosition: 'bottom-right',
    },
  }),
  
  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    compiler: {
      removeConsole: {
        exclude: ['error'],
      },
    },
    productionBrowserSourceMaps: false,
  }),
};

export default nextConfig;