import pino from 'pino'

const isDev = process.env.NODE_ENV === 'development'

// NOTE: pino-pretty uses thread-stream workers which crash inside Next.js dev server
// (worker tries to require a non-existent .next/server/vendor-chunks path).
// Use plain JSON output in dev to avoid the worker failure — pretty-print is nice
// to have but not worth the false-500s from logger.error() throws.
const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  // Never log these paths in full to avoid leaking secrets
  redact: {
    paths: [
      'scopes.env',
      'scopes.local',
      'scopes.collection',
      'scopes.global',
      'envVars',
      'variables',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.apiKey',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
})

export default logger
