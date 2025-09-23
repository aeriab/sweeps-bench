import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  output: 'export',

  basePath: isProd ? '/sweeps-bench' : '',
  
  assetPrefix: isProd ? '/sweeps-bench/' : '',

  images: {
    unoptimized: true,
    
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;