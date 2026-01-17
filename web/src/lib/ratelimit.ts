import { Ratelimit } from '@upstash/ratelimit'
import { redis } from './redis'

// Rate limiter for API routes: 100 requests per 60 seconds
export const apiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(300, '60 s'),
  prefix: '@upstash/ratelimit:api',
  analytics: true,
})

// Stricter rate limiter for auth endpoints: 10 requests per 60 seconds
export const authRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '60 s'),
  prefix: '@upstash/ratelimit:auth',
  analytics: true,
})
