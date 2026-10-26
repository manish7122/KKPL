/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  outputFileTracingExcludes: {
    '/api/*': ['./.env']
  }
};

module.exports = nextConfig;
