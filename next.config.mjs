import createNextIntlPlugin from 'next-intl/plugin'
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss:",
      "frame-ancestors 'self'",
    ].join('; '),
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['piscina', 'ioredis'],
    instrumentationHook: true, // src/instrumentation.ts — seeds bootstrap admin on startup
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      config.plugins.push(
        new MonacoWebpackPlugin({
          languages: ['json', 'javascript', 'typescript', 'html', 'xml', 'css'],
          filename: 'static/[name].worker.js',
        })
      )
    }
    config.infrastructureLogging = { ...(config.infrastructureLogging ?? {}), level: 'error' }
    return config
  },
}

export default withNextIntl(nextConfig)
