// In /config.ts

const isProd = process.env.NODE_ENV === 'production';

export const repoName = 'sweeps-bench';

export const basePath = isProd ? `/${repoName}/` : '';
export const assetPrefix = isProd ? `/${repoName}/` : '';