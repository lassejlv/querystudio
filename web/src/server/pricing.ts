import { createServerFn } from '@tanstack/react-start'

const pricing = {
  tiers: {
    free: {
      name: 'Free',
      price: 0,
      features: {
        maxConnections: 2,
        dialects: ['all'],
        sqlRunner: true,
        autoComplete: true,
        personalUseOnly: true,
        ai: 'byok',
      },
    },
    pro: {
      name: 'Pro',
      price: 29.99,
      earlyBirdPrice: 14.99,
      licenseType: 'one-time',
      features: {
        maxConnections: Infinity,
        dialects: ['all'],
        sqlRunner: true,
        autoComplete: true,
        personalUseOnly: false,
        ai: 'byok',
      },
    },
  },
  ai: {
    supportedProviders: ['openai', 'anthropic', 'google'],
  },
} as const

export const getPricing = createServerFn({ method: 'GET' }).handler(async () => pricing)
