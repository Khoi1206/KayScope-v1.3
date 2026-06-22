import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { authConfig } from './auth.config'
import { findUserByEmail } from '@/db/queries/users'
import { upsertPersonalWorkspace } from '@/db/queries/workspaces'
import logger from '@/lib/logger'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          logger.warn('[auth] authorize: missing email or password')
          return null
        }

        let user: Awaited<ReturnType<typeof findUserByEmail>>
        try {
          user = await findUserByEmail(credentials.email as string)
        } catch (err) {
          logger.error(err, '[auth] authorize: DB error looking up user')
          return null
        }

        if (!user) {
          logger.warn('[auth] authorize: no user found for email')
          return null
        }
        if (!user.passwordHash) {
          logger.warn({ userId: user.id }, '[auth] authorize: user has no password hash')
          return null
        }

        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        if (!valid) {
          logger.warn('[auth] authorize: password mismatch')
          return null
        }

        // Auto-create workspace if somehow missing (e.g. first login after DB migration)
        await upsertPersonalWorkspace(user.id, `${user.name}'s Workspace`).catch(() => {})

        return { id: user.id, name: user.name, email: user.email }
      },
    }),
  ],

  secret: process.env.AUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
})
