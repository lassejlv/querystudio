import { handle } from '@upstash/realtime'
import { realtime } from '@/lib/realtime'
import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth'
import { rateLimitMiddleware } from '@/server/middleware/ratelimit'

// Match timeout to realtime config
export const maxDuration = 300

const realtimeHandler = handle({
  realtime,
  middleware: async ({ request, channels }) => {
    const currentUser = await auth.api.getSession({ headers: request.headers })

    for (const channel of channels) {
      if (currentUser && channel === `backend-user-${currentUser.user.id}`) {
        console.log('Access granted!')
        continue
      } else {
        return new Response('Forbidden', { status: 403 })
      }
    }
  },
})

export const Route = createFileRoute('/api/realtime')({
  server: {
    middleware: [rateLimitMiddleware],
    handlers: {
      GET: async ({ request }) => {
        const response = await realtimeHandler(request)
        return response ?? new Response('No response', { status: 500 })
      },
    },
  },
})
