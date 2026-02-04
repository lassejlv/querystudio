import { z } from 'zod/v4'

const envSchema = z.object({
  DATABASE_URL: z.url(),
  DATABASE_DIRECT_URL: z.url(),
  REDIS_URL: z.url(),
  USESEND_API_KEY: z.string(),
  USESEND_FROM: z.string(),
  POLAR_ACCESS_TOKEN: z.string(),
  POLAR_WEBHOOK_SECRET: z.string(),
  POLAR_PRICING_ID: z.string(),
  POLAR_EARLY_BIRD_DISCOUNT: z.string(),
  POLAR_ORGANIZATION_ID: z.string(),
  POLAR_MONTHLY_ID: z.string(),
  POLAR_ANNUALLY_ID: z.string(),
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  TURNSTILE_SECRET_KEY: z.string(),
  TURNSTILE_SITE_KEY: z.string(),
})

export const env = envSchema.parse(process.env)
