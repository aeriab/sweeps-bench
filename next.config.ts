// In next.config.js

import { basePath, assetPrefix } from './config';

const nextConfig = {
  output: 'export',
  basePath: basePath,
  assetPrefix: assetPrefix,
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