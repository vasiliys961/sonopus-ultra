/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  transpilePackages: ['vtk.js'],
  webpack: (config) => {
    config.resolve.fallback = { ...(config.resolve.fallback ?? {}), fs: false, path: false, crypto: false }
    config.module.rules.unshift({
      test: /\.glsl$/i,
      include: /node_modules[/\\]vtk\.js/,
      type: 'asset/source',
    })
    return config
  },
}

module.exports = nextConfig
