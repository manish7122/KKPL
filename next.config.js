/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingExcludes: {
    '/api/*': ['./.env']
  }
};

module.exports = nextConfig;
