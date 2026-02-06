import * as React from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu, User, LogOut, Settings } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/download', label: 'Download' },
  { to: '/changelog', label: 'Changelog' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/status', label: 'Status' },
] as const

export function Header() {
  const location = useLocation()
  const currentPath = location.pathname
  const [isMobileNavOpen, setIsMobileNavOpen] = React.useState(false)

  const { data: session, isLoading } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const result = await authClient.getSession()
      return result.data
    },
  })

  const user = session?.user

  const handleSignOut = async () => {
    await authClient.signOut()
    window.location.href = '/'
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <header className='sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md'>
      <div className='container mx-auto flex h-14 items-center justify-between px-4'>
        <Link to='/' className='flex items-center gap-2 hover:opacity-70 transition-opacity'>
          <img src='https://assets-cdn.querystudio.dev/QueryStudioIconNoBG.png' alt='QueryStudio' className='h-6 w-6' />
          <span className='font-medium'>QueryStudio</span>
        </Link>

        <div className='hidden items-center gap-2 md:flex'>
          <nav className='flex items-center gap-1 rounded-full border border-border/80 bg-background/80 p-1'>
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn('rounded-full px-3 py-1.5 text-sm transition-colors', currentPath === item.to ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {isLoading ? (
            <div className='h-7 w-7 rounded-full bg-muted' />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className='flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium hover:bg-muted/80'>{getInitials(user.name)}</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-48'>
                <div className='px-2 py-1.5'>
                  {user.name && <p className='text-sm font-medium'>{user.name}</p>}
                  {user.email && <p className='truncate text-xs text-muted-foreground'>{user.email}</p>}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to='/dashboard'>
                    <User className='mr-2 h-4 w-4' />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to='/dashboard/account'>
                    <Settings className='mr-2 h-4 w-4' />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className='text-red-600 focus:text-red-600'>
                  <LogOut className='mr-2 h-4 w-4' />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className='flex items-center gap-2'>
              <Button variant='ghost' size='sm' asChild>
                <Link to='/login'>Login</Link>
              </Button>
              <Button size='sm' asChild>
                <Link to='/signup'>Sign up</Link>
              </Button>
            </div>
          )}
        </div>

        <div className='md:hidden'>
          <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant='ghost' size='icon' aria-label='Open menu'>
                <Menu className='h-5 w-5' />
              </Button>
            </SheetTrigger>
            <SheetContent side='right' className='w-[85%]'>
              <SheetHeader className='px-0 pt-2'>
                <SheetTitle>Menu</SheetTitle>
                <SheetDescription>Explore QueryStudio and manage your account.</SheetDescription>
              </SheetHeader>

              <nav className='mt-2 grid gap-2'>
                {navItems.map((item) => (
                  <SheetClose asChild key={item.to}>
                    <Link
                      to={item.to}
                      className={cn(
                        'rounded-md px-3 py-2 text-sm transition-colors',
                        currentPath === item.to ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                      )}
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>

              <div className='mt-4 border-t pt-4'>
                {user ? (
                  <div className='grid gap-2'>
                    <div className='rounded-md bg-muted/50 px-3 py-2'>
                      {user.name && <p className='text-sm font-medium'>{user.name}</p>}
                      {user.email && <p className='truncate text-xs text-muted-foreground'>{user.email}</p>}
                    </div>
                    <SheetClose asChild>
                      <Button variant='outline' asChild>
                        <Link to='/dashboard'>Dashboard</Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button variant='outline' asChild>
                        <Link to='/dashboard/account'>Settings</Link>
                      </Button>
                    </SheetClose>
                    <Button
                      variant='destructive'
                      onClick={async () => {
                        setIsMobileNavOpen(false)
                        await handleSignOut()
                      }}
                    >
                      Sign out
                    </Button>
                  </div>
                ) : (
                  <div className='grid gap-2'>
                    <SheetClose asChild>
                      <Button variant='outline' asChild>
                        <Link to='/login'>Login</Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button asChild>
                        <Link to='/signup'>Sign up</Link>
                      </Button>
                    </SheetClose>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
