import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_authed/dashboard')({
  component: DashboardLayout,
})

const sidebarItems = [
  { label: 'Account', href: '/dashboard/account' },
  { label: 'Security', href: '/dashboard/security' },
  { label: 'Billing', href: '/dashboard/billing' },
  { label: 'Devices', href: '/dashboard/devices' },
]

function DashboardLayout() {
  const location = useLocation()

  return (
    <div className='min-h-screen bg-background'>
      {/* Header */}
      <header className='border-b'>
        <div className='container mx-auto px-4 h-14 flex items-center justify-between'>
          <Link to='/' className='flex items-center gap-2 hover:opacity-70 transition-opacity'>
            <img src='https://assets-cdn.querystudio.dev/QueryStudioIconNoBG.png' alt='QueryStudio' className='h-6 w-6' />
            <span className='font-medium'>QueryStudio</span>
          </Link>
          <nav className='flex items-center gap-6'>
            <Link to='/download' className='text-sm text-muted-foreground hover:text-foreground'>
              Download
            </Link>
            <Link to='/pricing' className='text-sm text-muted-foreground hover:text-foreground'>
              Pricing
            </Link>
          </nav>
        </div>
      </header>

      <div className='container mx-auto px-4 py-8'>
        <div className='flex gap-12'>
          {/* Sidebar */}
          <aside className='w-40 shrink-0'>
            <nav className='space-y-1'>
              {sidebarItems.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn('block py-1.5 text-sm transition-colors', isActive ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </aside>

          {/* Main content */}
          <main className='flex-1 min-w-0'>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
