import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { authConfig } from './auth.config'
import { findUserByEmail } from '@/db/queries/users'
import { upsertPersonalWorkspace } from '@/db/queries/workspaces'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await findUserByEmail(credentials.email as string).catch(() => null)
        if (!user || !user.passwordHash) return null

        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        if (!valid) return null

        // Auto-create workspace if somehow missing (e.g. first login after DB migration)
        await upsertPersonalWorkspace(user.id, `${user.name}'s Workspace`).catch(() => {})

        return { id: user.id, name: user.name, email: user.email }
      },
    }),
  ],

  secret: process.env.AUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
})
