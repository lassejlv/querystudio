import { auth } from '@/lib/auth'
import { createFileRoute } from '@tanstack/react-router'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono().basePath('/api/auth')

app.use(
  cors({
    origin: ['http://localhost:1420'],
    credentials: true,
  }),
)

app.on(['POST', 'GET'], '/*', (c) => {
  return auth.handler(c.req.raw)
})

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      ANY: ({ request: req }) => app.fetch(req),
    },
  },
})
