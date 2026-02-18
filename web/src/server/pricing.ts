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
    proMonthly: {
      name: 'Pro',
      price: 4.99,
      licenseType: 'monthly',
      features: {
        maxConnections: Infinity,
        dialects: ['all'],
        sqlRunner: true,
        autoComplete: true,
        personalUseOnly: false,
        ai: 'byok',
      },
    },
    proAnnually: {
      name: 'Pro',
      price: 49.99,
      licenseType: 'annually',
      features: {
        maxConnections: Infinity,
        dialects: ['all'],
        sqlRunner: true,
        autoComplete: true,
        personalUseOnly: false,
        ai: 'byok',
      },
    },
    pro: {
      name: 'Onetime-purchase',
      price: 49.99,
      earlyBirdPrice: 34.99,
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
