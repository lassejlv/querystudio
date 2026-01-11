import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getCurrentUserFn } from '@/server/auth'
import { createRealtime } from '@upstash/realtime/client'
import type { RealtimeEvents } from '@/lib/realtime'
import { toast } from 'sonner'

const { useRealtime } = createRealtime<RealtimeEvents>()

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUserFn()

    if (!user) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }

    return { user }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const { user } = Route.useRouteContext()

  useRealtime({
    channels: [`backend-user-${user.id}`],
    events: ['userBackend.changesSaved'],
    onData({ event, data, channel }) {
      console.table({ event, data, channel })
      toast.success(data.message)
    },
  })

  return <Outlet />
}
