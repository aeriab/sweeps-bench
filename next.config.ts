// In next.config.js

import { basePath, assetPrefix } from './config';

const nextConfig = {
  output: 'export',
  basePath: basePath,
  assetPrefix: assetPrefix,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;