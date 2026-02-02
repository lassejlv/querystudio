import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/header'
import { OptimizedVideo } from '@/components/optimized-video'
import { Download, ArrowRight, Database, Code2, Sparkles, Check } from 'lucide-react'
import { getPricing } from '@/server/pricing'

export const Route = createFileRoute('/')({
  component: LandingPage,
  loader: () => getPricing(),
})

function LandingPage() {
  return (
    <div className='min-h-screen bg-background'>
      <Header />

      <main>
        <section className='container mx-auto px-4 pt-20 md:pt-32 pb-16'>
          <div className='max-w-3xl'>
            <h1 className='text-5xl md:text-7xl font-semibold tracking-tight text-foreground leading-[1.1]'>
              The database studio
              <br />
              <span className='text-primary'>you deserve</span>
            </h1>
            <p className='mt-6 text-xl text-muted-foreground max-w-2xl leading-relaxed'>
              Write SQL, explore schemas, and query with natural language.
              <br className='hidden md:block' />
              Native desktop app for Mac, Windows, and Linux.
            </p>
            <div className='mt-10 flex items-center gap-4'>
              <Button asChild size='lg' className='h-12 px-8 text-base'>
                <Link to='/download'>
                  <Download className='h-5 w-5 mr-2' />
                  Download Free
                </Link>
              </Button>
              <Button variant='ghost' size='lg' asChild className='h-12 px-6 text-base'>
                <a href='https://github.com/querystudio/querystudio' target='_blank'>
                  View on Github
                  <ArrowRight className='h-4 w-4 ml-2' />
                </a>
              </Button>
            </div>

            <div className='mt-12 flex items-center gap-6 text-sm text-muted-foreground'>
              <div className='flex items-center gap-2'>
                <Check className='w-4 h-4 text-green-500' />
                <span>Open Source</span>
              </div>
              <div className='flex items-center gap-2'>
                <Check className='w-4 h-4 text-green-500' />
                <span>Local-first</span>
              </div>
              <div className='flex items-center gap-2'>
                <Check className='w-4 h-4 text-green-500' />
                <span>No cloud</span>
              </div>
            </div>
          </div>
        </section>

        <section className='container mx-auto px-4 pb-24'>
          <OptimizedVideo src='https://assets-cdn.querystudio.dev/QueryStudioExampleNew.mp4' containerClassName='relative border rounded-xl overflow-hidden aspect-video shadow-lg bg-muted/50' />
        </section>

        <section className='border-t bg-muted/30'>
          <div className='container mx-auto px-4 py-24'>
            <div className='text-center mb-16'>
              <h2 className='text-3xl md:text-4xl font-semibold mb-4'>Everything you need</h2>
              <p className='text-muted-foreground max-w-2xl mx-auto'>A complete database studio with powerful features for developers and teams</p>
            </div>

            <div className='grid md:grid-cols-3 gap-8'>
              <div className='p-8 rounded-2xl bg-background border'>
                <div className='w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6'>
                  <Database className='h-6 w-6 text-primary' />
                </div>
                <h3 className='font-semibold text-foreground text-xl mb-3'>Multiple Connections</h3>
                <p className='text-muted-foreground leading-relaxed'>PostgreSQL & MySQL support with SQLite, MongoDB and Redis coming soon. All local-first and secure.</p>
              </div>

              <div className='p-8 rounded-2xl bg-background border'>
                <div className='w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6'>
                  <Code2 className='h-6 w-6 text-primary' />
                </div>
                <h3 className='font-semibold text-foreground text-xl mb-3'>Smart Query Editor</h3>
                <p className='text-muted-foreground leading-relaxed'>Syntax highlighting, auto-complete, and keyboard shortcuts. Run queries with ⌘↵ and copy results directly.</p>
              </div>

              <div className='p-8 rounded-2xl bg-background border'>
                <div className='w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6'>
                  <Sparkles className='h-6 w-6 text-primary' />
                </div>
                <h3 className='font-semibold text-foreground text-xl mb-3'>QueryBuddy AI</h3>
                <p className='text-muted-foreground leading-relaxed'>A native AI agent built into your database. Describe what you need in plain English and it writes SQL based on your schema.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className='border-t'>
        <div className='container mx-auto px-4 py-10'>
          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-6'>
            <div className='flex items-center gap-3'>
              <img src='https://assets-cdn.querystudio.dev/QueryStudioIconNoBG.png' alt='QueryStudio' className='h-6 w-6' />
              <span className='font-medium'>QueryStudio</span>
            </div>
            <nav className='flex items-center gap-8'>
              <Link to='/download' className='text-sm text-muted-foreground hover:text-foreground'>
                Download
              </Link>
              <Link to='/pricing' className='text-sm text-muted-foreground hover:text-foreground'>
                Pricing
              </Link>
              <Link to='/privacy' className='text-sm text-muted-foreground hover:text-foreground'>
                Privacy
              </Link>
              <Link to='/terms' className='text-sm text-muted-foreground hover:text-foreground'>
                Terms
              </Link>
              <Link to='/login' className='text-sm text-muted-foreground hover:text-foreground'>
                Login
              </Link>
            </nav>
          </div>
          <div className='mt-8 pt-8 border-t flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-muted-foreground'>
            <span>© {new Date().getFullYear()} QueryStudio. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
