import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/header'
import { OptimizedVideo } from '@/components/optimized-video'
import { Download, ArrowRight } from 'lucide-react'
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

      <main>
        {/* Hero */}
        <section className='container mx-auto px-4 pt-16 md:pt-24 pb-12'>
          <div className='max-w-3xl'>
            <h1 className='text-4xl md:text-5xl font-semibold tracking-tight text-foreground'>The database studio you deserve</h1>
            <p className='mt-4 text-lg text-muted-foreground max-w-xl'>Write SQL, explore schemas, and query with natural language. Native desktop app for Mac, Windows, and Linux.</p>
            <div className='mt-8 flex items-center gap-3'>
              <Button asChild size='lg'>
                <Link to='/download'>
                  <Download className='h-4 w-4 mr-2' />
                  Download
                </Link>
              </Button>
              <Button variant='ghost' size='lg' asChild>
                <Link to='/pricing'>
                  View pricing
                  <ArrowRight className='h-4 w-4 ml-2' />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Video */}
        <section className='container mx-auto px-4 pb-20'>
          <OptimizedVideo src='https://assets-cdn.querystudio.dev/QueryStudioExampleNew.mp4' containerClassName='border rounded-lg overflow-hidden aspect-video shadow-sm' />
        </section>

        {/* Features */}
        <section className='border-t bg-muted/30'>
          <div className='container mx-auto px-4 py-20'>
            <div className='grid md:grid-cols-3 gap-12 md:gap-8'>
              <div>
                <h3 className='font-medium text-foreground'>Connections</h3>
                <p className='mt-2 text-sm text-muted-foreground leading-relaxed'>PostgreSQL, MySQL, SQLite. Save connections locally with your credentials stored securely in your system keychain.</p>
              </div>
              <div>
                <h3 className='font-medium text-foreground'>Query editor</h3>
                <p className='mt-2 text-sm text-muted-foreground leading-relaxed'>Syntax highlighting, auto-complete, and keyboard shortcuts. Run queries with ⌘↵ and copy results directly.</p>
              </div>
              <div>
                <h3 className='font-medium text-foreground'>AI assistant</h3>
                <p className='mt-2 text-sm text-muted-foreground leading-relaxed'>Describe what you need in plain English. The assistant writes SQL based on your schema. Read-only by default.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing summary */}
        <section className='border-t'>
          <div className='container mx-auto px-4 py-20'>
            <div className='max-w-xl'>
              <h2 className='text-2xl font-semibold tracking-tight'>Simple pricing</h2>
              <p className='mt-2 text-muted-foreground'>Free to start. One-time payment for unlimited use.</p>

              <div className='mt-8 space-y-4'>
                <div className='flex items-baseline justify-between py-3 border-b'>
                  <div>
                    <span className='font-medium'>{pricing.tiers.free.name}</span>
                    <span className='ml-3 text-sm text-muted-foreground'>{pricing.tiers.free.features.maxConnections} connections, all features</span>
                  </div>
                  <span className='font-medium'>$0</span>
                </div>
                <div className='flex items-baseline justify-between py-3 border-b'>
                  <div>
                    <span className='font-medium'>{pricing.tiers.pro.name}</span>
                    <span className='ml-3 text-sm text-muted-foreground'>Unlimited connections, priority support</span>
                  </div>
                  <div className='text-right'>
                    <span className='font-medium'>${pricing.tiers.pro.earlyBirdPrice}</span>
                    <span className='ml-2 text-sm text-muted-foreground line-through'>${pricing.tiers.pro.price}</span>
                  </div>
                </div>
              </div>

              <div className='mt-8'>
                <Button variant='outline' asChild>
                  <Link to='/pricing'>
                    See full details
                    <ArrowRight className='h-4 w-4 ml-2' />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className='border-t bg-muted/30'>
          <div className='container mx-auto px-4 py-16 text-center'>
            <h2 className='text-xl font-medium'>Ready to try it?</h2>
            <p className='mt-2 text-muted-foreground'>Download for free and start querying in minutes.</p>
            <div className='mt-6'>
              <Button asChild>
                <Link to='/download'>
                  <Download className='h-4 w-4 mr-2' />
                  Download QueryStudio
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className='border-t'>
        <div className='container mx-auto px-4 py-8'>
          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
            <div className='flex items-center gap-2'>
              <img src='https://assets-cdn.querystudio.dev/QueryStudioIconNoBG.png' alt='QueryStudio' className='h-5 w-5' />
              <span className='text-sm text-muted-foreground'>QueryStudio</span>
            </div>
            <nav className='flex items-center gap-6'>
              <Link to='/download' className='text-sm text-muted-foreground hover:text-foreground'>
                Download
              </Link>
              <Link to='/pricing' className='text-sm text-muted-foreground hover:text-foreground'>
                Pricing
              </Link>
              <Link to='/login' className='text-sm text-muted-foreground hover:text-foreground'>
                Login
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
