import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getCurrentUserFn } from '@/server/auth'

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
  return <Outlet />
}
