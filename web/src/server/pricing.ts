import { createServerFn } from '@tanstack/react-start'

const pricing = {
  tiers: {
    free: {
      name: 'Free',
      price: 0,
      features: {
        maxConnections: 1,
        dialects: ['sqlite', 'postgres'],
        sqlRunner: true,
        autoComplete: true,
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
        dialects: ['sqlite', 'postgres', 'mysql'],
        sqlRunner: true,
        autoComplete: true,
        ai: 'byok',
      },
    },
  },
  ai: {
    model: 'byok',
    supportedProviders: ['openai', 'anthropic', 'gemini'],
  },
} as const

export const getPricing = createServerFn({ method: 'GET' }).handler(async () => pricing)
