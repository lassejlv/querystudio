import { Ratelimit } from '@upstash/ratelimit'
import { redis } from './redis'

export const apiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(300, '60 s'),
  prefix: '@upstash/ratelimit:api',
  analytics: true,
})

export const authRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '60 s'),
  prefix: '@upstash/ratelimit:auth',
  analytics: true,
})
