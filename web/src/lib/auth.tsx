import { betterAuth } from 'better-auth'
import { captcha } from 'better-auth/plugins'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { waitlist } from 'better-auth-waitlist'
import { db } from 'drizzle'
import { zeroId } from 'zero-id'
import { emailer } from './emailer'
import { env } from './env'
import { render } from '@react-email/render'
import VerifyEmail from '@/emails/verify-email'
import WaitlistJoined from '@/emails/waitlist-joined'
import WaitlistStatus from '@/emails/waitlist-status'
import { polar } from './polar'
import { user } from 'drizzle/schema/auth'
import { eq } from 'drizzle-orm'

const ADMIN_EMAILS = ['vestergaardlasse2@gmail.com']

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  user: {
    additionalFields: {
      polarCustomerId: {
        type: 'string',
        required: false,
      },
      isPro: {
        type: 'boolean',
        required: false,
      },
      licenseKey: {
        type: 'string',
        required: false,
      },
      cancelAtPeriodEnd: {
        type: 'boolean',
        required: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async ({ email, name }) => {
          try {
            const newCustomer = await polar.customers.create({ email: email, name: name })
            await db.update(user).set({ polarCustomerId: newCustomer.id }).where(eq(user.email, email))
            console.log(`Create new polar customer for user ${name} with email ${email}`)
          } catch (error) {
            console.error(error)
          }
        },
      },
    },
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
    },
    database: {
      generateId: () => zeroId({ randomLength: 32 }),
    },
  },
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  emailVerification: {
    sendVerificationEmail: async (data) => {
      await emailer.emails.send({
        from: env.USESEND_FROM,
        to: data.user.email,
        subject: 'QueryStudio - Verify your email',
        html: await render(<VerifyEmail url={data.url} />),
      })
    },
    autoSignInAfterVerification: true,
  },
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },
  plugins: [
    captcha({
      provider: 'cloudflare-turnstile',
      secretKey: env.TURNSTILE_SECRET_KEY,
    }),
    waitlist({
      enabled: true,
      onJoinRequest: async ({ request }) => {
        await emailer.emails.send({
          from: env.USESEND_FROM,
          to: request.email,
          subject: "You're on the QueryStudio waitlist!",
          html: await render(<WaitlistJoined />),
        })
      },
      onStatusChange: async (entry) => {
        if (entry.status === 'accepted' || entry.status === 'rejected') {
          await emailer.emails.send({
            from: env.USESEND_FROM,
            to: entry.email,
            subject: entry.status === 'accepted' ? "You've been approved for QueryStudio!" : 'Update on your QueryStudio waitlist request',
            html: await render(<WaitlistStatus status={entry.status === 'accepted' ? 'approved' : 'rejected'} />),
          })
        }
      },
      canManageWaitlist: async (user) => {
        return ADMIN_EMAILS.includes(user.email)
      },
    }),
  ],
  trustedOrigins: ['http://localhost:3000', 'https://querystudio.dev', 'tauri://localhost', 'http://tauri.localhost', 'http://localhost:1420'],
})
