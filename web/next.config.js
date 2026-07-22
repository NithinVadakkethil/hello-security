/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const baseUrl = apiUrl.replace(/\/api\/v1\/?$/, '');

    return [
      {
        source: '/api/v1/:path*',
        destination: `${baseUrl}/api/v1/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${baseUrl}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
