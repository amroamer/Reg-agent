/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    // In Docker: NEXT_PUBLIC_API_URL=http://backend:8000 (set by compose)
    // In local dev: defaults to http://127.0.0.1:8011
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8011";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
