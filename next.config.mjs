/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  swcMinify: true,
  experimental: {
    // Turbopack for faster dev server (experimental)
    turbo: {},
    // Enable instrumentation hook for startup validation
    instrumentationHook: true,
  },
}

export default nextConfig
