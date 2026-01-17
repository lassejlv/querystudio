import { realtime } from '@/lib/realtime'
import { createFileRoute } from '@tanstack/react-router'
import { rateLimitMiddleware } from '@/server/middleware/ratelimit'

export const Route = createFileRoute('/api/test')({
  server: {
    middleware: [rateLimitMiddleware],
    handlers: {
      GET: async () => {
        const channel = realtime.channel('backend-user-user_862a0XTp2jc40FbDxoBy1ezHZXlBrT6ysMVilYWdi')
        channel.emit('userBackend.changesSaved', { message: 'Changes was saved with success!' })
        return Response.json({ message: 'event has been emitted' })
      },
    },
  },
})
