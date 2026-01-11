import { Link, useLocation } from '@tanstack/react-router'

export function Header() {
  const location = useLocation()
  const currentPath = location.pathname

  return (
    <header className='border-b'>
      <div className='container mx-auto px-4 py-4 flex items-center justify-between'>
        <Link to='/' className='flex items-center gap-3 hover:opacity-80 transition-opacity'>
          <img src='https://assets-cdn.querystudio.dev/QueryStudioIconNoBG.png' alt='QueryStudio' className='h-8 w-8' />
          <span className='font-semibold text-lg'>QueryStudio</span>
        </Link>
        <nav className='flex items-center gap-6'>
          <Link to='/' className={`text-sm transition-colors ${currentPath === '/' ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
            Home
          </Link>
          <a href='/#pricing' className='text-sm transition-colors text-muted-foreground hover:text-foreground'>
            Pricing
          </a>
        </nav>
      </div>
    </header>
  )
}
