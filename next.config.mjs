/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  swcMinify: true,
  experimental: {
    // Turbopack for faster dev server (experimental)
    turbo: {},
  },
}

export default nextConfig
