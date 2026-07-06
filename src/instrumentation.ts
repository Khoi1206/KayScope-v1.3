/**
 * Next.js instrumentation hook — runs once per server startup.
 * Requires `experimental.instrumentationHook: true` in next.config.mjs.
 */
export async function register() {
  // Only run in the Node.js runtime (skip Edge/middleware bundling)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { seedAdminUser } = await import('@/lib/auth/seed-admin')
    await seedAdminUser()
  }
}
