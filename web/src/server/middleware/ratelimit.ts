import { createMiddleware } from '@tanstack/react-start'
import { apiRatelimit } from '@/lib/ratelimit'

/**
 * Rate limit middleware for API routes
 * Uses Upstash Ratelimit with sliding window algorithm
 */
export const rateLimitMiddleware = createMiddleware().server(async ({ request, next }) => {
  // Get identifier (IP address)
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'anonymous'
  const identifier = `api:${ip}`

  const { success, limit, remaining, reset } = await apiRatelimit.limit(identifier)

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000)

    // Return Response directly to short-circuit the middleware chain
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(reset),
        },
      },
    )
  }

  // Continue to the handler
  const result = await next()

  // Add rate limit headers to the response
  result.response.headers.set('X-RateLimit-Limit', String(limit))
  result.response.headers.set('X-RateLimit-Remaining', String(remaining))
  result.response.headers.set('X-RateLimit-Reset', String(reset))

  return result
})
