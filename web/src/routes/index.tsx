import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/header'
import { OptimizedVideo } from '@/components/optimized-video'
import { Download, ArrowRight, Database, Code2, Sparkles, Check, Terminal, Table, Zap } from 'lucide-react'
import { getPricing } from '@/server/pricing'
import { useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/')({
  component: LandingPage,
  loader: () => getPricing(),
})

// Animated counter hook
function useCountUp(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0)
  const countRef = useRef<HTMLSpanElement>(null)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true)
            let startTime: number
            const animate = (currentTime: number) => {
              if (!startTime) startTime = currentTime
              const progress = Math.min((currentTime - startTime) / duration, 1)
              setCount(Math.floor(progress * end))
              if (progress < 1) {
                requestAnimationFrame(animate)
              }
            }
            requestAnimationFrame(animate)
          }
        })
      },
      { threshold: 0.5 },
    )

    if (countRef.current) {
      observer.observe(countRef.current)
    }

    return () => observer.disconnect()
  }, [end, duration, hasAnimated])

  return { count, countRef }
}

// Scroll reveal hook
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' },
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}

// Floating icon component
function FloatingIcon({ icon: Icon, className, delay = 0 }: { icon: React.ElementType; className?: string; delay?: number }) {
  return (
    <div className={`absolute opacity-20 ${className}`} style={{ animationDelay: `${delay}s` }}>
      <Icon className='w-full h-full' />
    </div>
  )
}

function LandingPage() {
  const heroRef = useScrollReveal()
  const featuresRef = useScrollReveal()
  const videoRef = useScrollReveal()
  const statsRef = useScrollReveal()

  return (
    <div className='min-h-screen bg-background overflow-x-hidden'>
      <Header />

      <main>
        {/* Hero Section with Animated Background */}
        <section className='relative'>
          {/* Animated gradient background */}
          <div className='absolute inset-0 bg-gradient-to-br from-background via-background to-muted/30 animate-gradient' />

          {/* Grid pattern overlay */}
          <div className='absolute inset-0 grid-pattern opacity-50' />

          {/* Floating icons */}
          <div className='absolute inset-0 overflow-hidden pointer-events-none'>
            <FloatingIcon icon={Database} className='w-16 h-16 top-20 left-[10%] text-primary animate-float' delay={0} />
            <FloatingIcon icon={Code2} className='w-12 h-12 top-40 right-[15%] text-primary animate-float-reverse' delay={1} />
            <FloatingIcon icon={Terminal} className='w-20 h-20 bottom-32 left-[20%] text-primary animate-float-slow' delay={2} />
            <FloatingIcon icon={Table} className='w-14 h-14 top-60 left-[5%] text-primary animate-float' delay={1.5} />
            <FloatingIcon icon={Zap} className='w-10 h-10 bottom-40 right-[10%] text-primary animate-float-reverse' delay={0.5} />
          </div>

          <div className='container mx-auto px-4 pt-20 md:pt-32 pb-16 relative z-10'>
            <div ref={heroRef.ref} className={`max-w-3xl transition-all duration-1000 ${heroRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <h1 className='text-5xl md:text-7xl font-semibold tracking-tight text-foreground leading-[1.1] animate-fade-in-up stagger-1'>
                The database studio
                <br />
                <span className='gradient-text'>you deserve</span>
              </h1>
              <p className='mt-6 text-xl text-muted-foreground max-w-2xl leading-relaxed animate-fade-in-up stagger-2'>
                Write SQL, explore schemas, and query with natural language.
                <br className='hidden md:block' />
                Native desktop app for Mac, Windows, and Linux.
              </p>
              <div className='mt-10 flex items-center gap-4 animate-fade-in-up stagger-3'>
                <Button asChild size='lg' className='h-12 px-8 text-base animate-pulse-glow hover:scale-105 transition-transform'>
                  <Link to='/download'>
                    <Download className='h-5 w-5 mr-2' />
                    Download Free
                  </Link>
                </Button>
                <Button variant='ghost' size='lg' asChild className='h-12 px-6 text-base group'>
                  <Link to='/pricing'>
                    View pricing
                    <ArrowRight className='h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform' />
                  </Link>
                </Button>
              </div>

              {/* Trust badges */}
              <div className='mt-12 flex items-center gap-6 text-sm text-muted-foreground animate-fade-in-up stagger-4'>
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
          </div>
        </section>

        {/* Video Section */}
        <section ref={videoRef.ref} className={`container mx-auto px-4 pb-24 transition-all duration-1000 delay-300 ${videoRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className='relative group'>
            <div className='absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500' />
            <OptimizedVideo
              src='https://assets-cdn.querystudio.dev/QueryStudioExampleNew.mp4'
              containerClassName='relative border rounded-xl overflow-hidden aspect-video shadow-2xl bg-muted/50 hover-glow'
            />
          </div>
        </section>

        {/* Features Section */}
        <section className='border-t bg-muted/30'>
          <div ref={featuresRef.ref} className={`container mx-auto px-4 py-24 transition-all duration-1000 ${featuresRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className='text-center mb-16'>
              <h2 className='text-3xl md:text-4xl font-semibold mb-4'>Everything you need</h2>
              <p className='text-muted-foreground max-w-2xl mx-auto'>A complete database studio with powerful features for developers and teams</p>
            </div>

            <div className='grid md:grid-cols-3 gap-8'>
              <div className='group relative p-8 rounded-2xl bg-background border hover-glow card-shine transition-all duration-300'>
                <div className='w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform'>
                  <Database className='h-6 w-6 text-primary' />
                </div>
                <h3 className='font-semibold text-foreground text-xl mb-3'>Multiple Connections</h3>
                <p className='text-muted-foreground leading-relaxed'>PostgreSQL & MySQL support with SQLite, MongoDB and Redis coming soon. All local-first and secure.</p>
                <div className='mt-6 flex items-center gap-2 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity'>
                  <span>Learn more</span>
                  <ArrowRight className='w-4 h-4' />
                </div>
              </div>

              <div className='group relative p-8 rounded-2xl bg-background border hover-glow card-shine transition-all duration-300'>
                <div className='w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform'>
                  <Code2 className='h-6 w-6 text-primary' />
                </div>
                <h3 className='font-semibold text-foreground text-xl mb-3'>Smart Query Editor</h3>
                <p className='text-muted-foreground leading-relaxed'>Syntax highlighting, auto-complete, and keyboard shortcuts. Run queries with ⌘↵ and copy results directly.</p>
                <div className='mt-6 flex items-center gap-2 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity'>
                  <span>Learn more</span>
                  <ArrowRight className='w-4 h-4' />
                </div>
              </div>

              <div className='group relative p-8 rounded-2xl bg-background border hover-glow card-shine transition-all duration-300'>
                <div className='w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform'>
                  <Sparkles className='h-6 w-6 text-primary' />
                </div>
                <h3 className='font-semibold text-foreground text-xl mb-3'>QueryBuddy AI</h3>
                <p className='text-muted-foreground leading-relaxed'>A native AI agent built into your database. Describe what you need in plain English and it writes SQL based on your schema.</p>
                <div className='mt-6 flex items-center gap-2 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity'>
                  <span>Learn more</span>
                  <ArrowRight className='w-4 h-4' />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className='container mx-auto px-4 py-24'>
          <div className='max-w-4xl mx-auto text-center'>
            <div className='relative p-12 rounded-3xl bg-linear-to-br from-primary/5 via-background to-accent/5 border'>
              <div className='absolute inset-0 bg-grid-pattern opacity-30 rounded-3xl' />
              <div className='relative z-10'>
                <h2 className='text-3xl md:text-4xl font-semibold mb-4'>Ready to supercharge your workflow?</h2>
                <p className='text-muted-foreground text-lg mb-8 max-w-xl mx-auto'>Join developers who've switched to QueryStudio for their database management needs.</p>
                <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
                  <Button asChild size='lg' className='h-12 px-8 animate-pulse-glow'>
                    <Link to='/download'>
                      <Download className='h-5 w-5 mr-2' />
                      Download for Free
                    </Link>
                  </Button>
                  <Button variant='outline' size='lg' asChild className='h-12 px-8'>
                    <Link to='/pricing'>View Pricing</Link>
                  </Button>
                </div>
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
