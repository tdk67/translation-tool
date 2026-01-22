/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // CRITICAL FIX: This makes paths relative so Electron can find CSS/JS
  assetPrefix: './', 
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    }
    return config;
  },
};

export default nextConfig;