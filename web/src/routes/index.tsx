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
  const pricing = Route.useLoaderData()

  return (
    <div className='min-h-screen bg-background'>
      <Header />

      <main>
        <section className='container mx-auto px-4 pt-20 md:pt-32 pb-16'>
          <div className='max-w-3xl'>
            <h1 className='text-5xl md:text-6xl font-semibold tracking-tight text-foreground leading-[1.1]'>
              The database studio
              <br />
              you deserve
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
                  Download
                </Link>
              </Button>
              <Button variant='ghost' size='lg' asChild className='h-12 px-6 text-base'>
                <Link to='/pricing'>View pricing</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className='container mx-auto px-4 pb-24'>
          <OptimizedVideo src='https://assets-cdn.querystudio.dev/QueryStudioExampleNew.mp4' containerClassName='border rounded-xl overflow-hidden aspect-video shadow-lg bg-muted/50' />
        </section>

        <section className='border-t bg-muted/30'>
          <div className='container mx-auto px-4 py-24'>
            <div className='grid md:grid-cols-3 gap-16 md:gap-12'>
              <div className='group'>
                <div className='w-10 h-10 rounded-lg bg-background border flex items-center justify-center mb-4 group-hover:border-foreground/20 transition-colors'>
                  <Database className='h-5 w-5 text-foreground' />
                </div>
                <h3 className='font-semibold text-foreground text-lg'>Connections</h3>
                <p className='mt-3 text-muted-foreground leading-relaxed'>PostgreSQL & MySQL (soon sqlite, mongodb and redis). All local-first and secure.</p>
              </div>
              <div className='group'>
                <div className='w-10 h-10 rounded-lg bg-background border flex items-center justify-center mb-4 group-hover:border-foreground/20 transition-colors'>
                  <Code2 className='h-5 w-5 text-foreground' />
                </div>
                <h3 className='font-semibold text-foreground text-lg'>Query editor</h3>
                <p className='mt-3 text-muted-foreground leading-relaxed'>Syntax highlighting, auto-complete, and keyboard shortcuts. Run queries with ⌘↵ and copy results directly.</p>
              </div>
              <div className='group'>
                <div className='w-10 h-10 rounded-lg bg-background border flex items-center justify-center mb-4 group-hover:border-foreground/20 transition-colors'>
                  <Sparkles className='h-5 w-5 text-foreground' />
                </div>
                <h3 className='font-semibold text-foreground text-lg'>QueryBuddy</h3>
                <p className='mt-3 text-muted-foreground leading-relaxed'>
                  A native AI agent built into your database. Describe what you need in plain English and it writes SQL based on your schema. Read-only by default.
                </p>
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
              <Link to='/download' className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
                Download
              </Link>
              <Link to='/pricing' className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
                Pricing
              </Link>
              <Link to='/login' className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
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
