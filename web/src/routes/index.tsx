import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/header'
import { Database, Terminal, Shield, Download, Check, Bot } from 'lucide-react'
import { getPricing } from '@/server/pricing'

export const Route = createFileRoute('/')({
  component: LandingPage,
  loader: () => getPricing(),
})

function LandingPage() {
  const pricing = Route.useLoaderData()

  return (
    <div className='min-h-screen bg-background'>
      <Header />

      {/* Hero */}
      <section className='container mx-auto px-4 py-16 md:py-24'>
        <div className='max-w-2xl'>
          <h1 className='text-3xl md:text-4xl font-semibold tracking-tight mb-4'>A simple database studio</h1>
          <p className='text-muted-foreground text-lg mb-6'>Query your databases with SQL or natural language. Built with Tauri, React, and Rust.</p>
          <Button asChild>
            <Link to='/download'>
              <Download className='h-4 w-4 mr-2' />
              Download
            </Link>
          </Button>
        </div>
      </section>

      {/* Video */}
      <section className='container mx-auto px-4 pb-16'>
        <div className='border rounded-lg overflow-hidden'>
          <video className='w-full' autoPlay loop muted playsInline>
            <source src='https://assets-cdn.querystudio.dev/QueryStudioExampleNew.mp4' type='video/mp4' />
          </video>
        </div>
      </section>

      {/* Features */}
      <section className='container mx-auto px-4 py-16 border-t'>
        <h2 className='text-xl font-semibold mb-8'>Features</h2>
        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-8'>
          <Feature icon={<Database className='h-5 w-5' />} title='Connection Management' description='Save and switch between database connections. Stored securely on your machine.' />
          <Feature icon={<Terminal className='h-5 w-5' />} title='Query Editor' description='Execute SQL with syntax highlighting. Run queries with Cmd+Enter.' />
          <Feature icon={<Bot className='h-5 w-5' />} title='AI-agent' description='Ask questions in natural language and get SQL queries generated for you.' />
          <Feature icon={<Shield className='h-5 w-5' />} title='Safe by Default' description='AI queries are read-only. Your data stays on your machine.' />
        </div>
      </section>

      {/* Pricing */}
      <section className='container mx-auto px-4 py-16 border-t'>
        <div className='flex items-center justify-between mb-8'>
          <div>
            <h2 className='text-xl font-semibold mb-2'>Pricing</h2>
            <p className='text-muted-foreground'>Start free, pay once for unlimited use.</p>
          </div>
          <Link to='/pricing' className='text-sm text-muted-foreground hover:text-foreground'>
            View details →
          </Link>
        </div>

        <div className='grid md:grid-cols-2 gap-6 max-w-2xl'>
          {/* Free */}
          <div className='border rounded-lg p-6'>
            <div className='mb-4'>
              <h3 className='font-medium'>{pricing.tiers.free.name}</h3>
              <p className='text-2xl font-semibold mt-1'>${pricing.tiers.free.price}</p>
            </div>
            <ul className='space-y-2 text-sm text-muted-foreground mb-6'>
              <li className='flex items-center gap-2'>
                <Check className='h-4 w-4 text-foreground' />
                {pricing.tiers.free.features.maxConnections} connections
              </li>
              <li className='flex items-center gap-2'>
                <Check className='h-4 w-4 text-foreground' />
                All features
              </li>
              <li className='flex items-center gap-2'>
                <Check className='h-4 w-4 text-foreground' />
                AI assistant (BYOK)
              </li>
            </ul>
            <Button variant='outline' className='w-full' asChild>
              <Link to='/download'>Download</Link>
            </Button>
          </div>

          {/* Pro */}
          <div className='border rounded-lg p-6'>
            <div className='mb-4'>
              <h3 className='font-medium'>{pricing.tiers.pro.name}</h3>
              <div className='flex items-baseline gap-2 mt-1'>
                <p className='text-2xl font-semibold'>${pricing.tiers.pro.earlyBirdPrice}</p>
                <p className='text-sm text-muted-foreground line-through'>${pricing.tiers.pro.price}</p>
                <span className='text-xs text-muted-foreground'>one-time</span>
              </div>
            </div>
            <ul className='space-y-2 text-sm text-muted-foreground mb-6'>
              <li className='flex items-center gap-2'>
                <Check className='h-4 w-4 text-foreground' />
                Unlimited connections
              </li>
              <li className='flex items-center gap-2'>
                <Check className='h-4 w-4 text-foreground' />
                All features
              </li>
              <li className='flex items-center gap-2'>
                <Check className='h-4 w-4 text-foreground' />
                Priority support
              </li>
              <li className='flex items-center gap-2'>
                <Check className='h-4 w-4 text-foreground' />2 devices
              </li>
            </ul>
            <Button className='w-full' asChild>
              <Link to='/dashboard/billing' search={{ upgrade: true }}>
                Get Pro
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Shortcuts */}
      <section className='container mx-auto px-4 py-16 border-t'>
        <h2 className='text-xl font-semibold mb-2'>Keyboard shortcuts</h2>
        <p className='text-muted-foreground mb-6'>Navigate without leaving the keyboard.</p>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl'>
          <Shortcut keys='⌘K' label='Switch connection' />
          <Shortcut keys='⌘↵' label='Run query' />
          <Shortcut keys='⌘C' label='Copy cell' />
          <Shortcut keys='Right-click' label='Context menu' />
        </div>
      </section>

      {/* Footer */}
      <footer className='container mx-auto px-4 py-8 border-t'>
        <p className='text-sm text-muted-foreground'>QueryStudio</p>
      </footer>
    </div>
  )
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div>
      <div className='flex items-center gap-2 mb-2'>
        <span className='text-muted-foreground'>{icon}</span>
        <h3 className='font-medium'>{title}</h3>
      </div>
      <p className='text-sm text-muted-foreground'>{description}</p>
    </div>
  )
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <div>
      <kbd className='inline-block px-2 py-1 bg-muted rounded text-sm font-mono mb-1'>{keys}</kbd>
      <p className='text-sm text-muted-foreground'>{label}</p>
    </div>
  )
}
