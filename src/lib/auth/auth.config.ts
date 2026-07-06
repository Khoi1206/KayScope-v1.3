import type { NextAuthConfig } from 'next-auth'

/**
 * Edge-compatible NextAuth v5 config.
 * Must NOT import Node.js-only modules (drizzle, bcrypt, etc.)
 * because it runs in the Edge Runtime via middleware.
 */
export const authConfig: NextAuthConfig = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    authorized() {
      // Always return true — our custom middleware handles all auth/redirect logic
      return true
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.name = user.name
        token.email = user.email
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false
      }
      // Client called useSession().update({ name }) after a profile change
      if (trigger === 'update' && typeof (session as { name?: unknown } | null)?.name === 'string') {
        token.name = (session as { name: string }).name
      }
      return token
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.name = token.name
        session.user.email = token.email as string
        ;(session.user as { isAdmin?: boolean }).isAdmin = (token.isAdmin as boolean) ?? false
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  providers: [], // Added in auth.ts
}
