import { createFileRoute, Link } from '@tanstack/react-router'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Download, Check, Sparkles, Zap, Crown } from 'lucide-react'
import { getPricing } from '@/server/pricing'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
  loader: () => getPricing(),
})

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

function PricingPage() {
  const pricing = Route.useLoaderData()
  const cardsRef = useScrollReveal()
  const faqRef = useScrollReveal()

  return (
    <div className='min-h-screen bg-background flex flex-col'>
      <Header />

      <main className='flex-1 container mx-auto px-4 py-16 md:py-24'>
        <div className='max-w-2xl mx-auto text-center mb-16'>
          <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm mb-6'>
            <Sparkles className='w-4 h-4' />
            <span>Simple, transparent pricing</span>
          </div>
          <h1 className='text-4xl md:text-5xl font-bold tracking-tight'>Pricing that you can overcome</h1>
          <p className='mt-4 text-muted-foreground text-lg'>Free for personal use. Monthly or one-time options for professionals.</p>
        </div>

        <div ref={cardsRef.ref} className={`grid md:grid-cols-3 gap-8 max-w-5xl mx-auto transition-all duration-1000 ${cardsRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Free Tier */}
          <Card className='flex flex-col shadow-md hover-glow card-shine transition-all duration-300 group'>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-xl'>{pricing.tiers.free.name}</CardTitle>
              </div>
              <CardDescription>Perfect for hobbyists and students</CardDescription>
            </CardHeader>
            <CardContent className='flex-1'>
              <div className='text-4xl font-bold mb-6'>$0</div>
              <ul className='space-y-3 text-sm'>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-green-500' />
                  <span>Personal use only</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-green-500' />
                  <span>{pricing.tiers.free.features.maxConnections} Saved Connections</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-green-500' />
                  <span>All database dialects (1 connection per dialect)</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-green-500' />
                  <span>AI Assistant (BYOK)</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-green-500' />
                  <span>Local-first & Secure</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className='w-full' variant='outline'>
                <Link to='/download'>
                  <Download className='h-4 w-4 mr-2' />
                  Download Free
                </Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Pro Monthly Tier */}
          <Card className='flex flex-col shadow-lg border-primary relative overflow-hidden hover-glow card-shine transition-all duration-300 group'>
            <div className='absolute top-0 right-0 p-3'>
              <Badge variant='default' className='text-xs animate-pulse'>
                Popular
              </Badge>
            </div>
            <div className='absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity' />

            <CardHeader className='relative'>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-xl'>{pricing.tiers.proMonthly.name}</CardTitle>
              </div>
              <CardDescription>For professionals and commercial use</CardDescription>
            </CardHeader>
            <CardContent className='flex-1 relative'>
              <div className='flex items-baseline gap-2 mb-2'>
                <span className='text-4xl font-bold'>${pricing.tiers.proMonthly.price}</span>
                <span className='text-muted-foreground text-sm'>/month</span>
              </div>
              <p className='text-sm text-muted-foreground mb-4'>3 days free trial</p>
              <ul className='space-y-3 text-sm'>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-green-500' />
                  <span className='font-medium'>Commercial use allowed</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-green-500' />
                  <span className='font-medium'>Unlimited Connections</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-green-500' />
                  <span className='font-medium'>Priority Support</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-green-500' />
                  <span>Everything in Free</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-green-500' />
                  <span>Continuous updates</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter className='relative'>
              <Button asChild className='w-full animate-pulse-glow'>
                <Link to='/dashboard/billing' search={{ upgrade: true, plan: 'monthly' }}>
                  Get Pro Monthly
                </Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Pro One-time Tier */}
          <Card className='flex flex-col shadow-md relative overflow-hidden hover-glow card-shine transition-all duration-300 group'>
            <div className='absolute top-0 right-0 p-3'>
              <Badge variant='secondary' className='text-xs'>
                Early Bird
              </Badge>
            </div>

            <div className='absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity' />

            <CardHeader className='relative'>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-xl'>{pricing.tiers.pro.name}</CardTitle>
              </div>
              <CardDescription>One-time purchase, lifetime access</CardDescription>
            </CardHeader>
            <CardContent className='flex-1 relative'>
              <div className='flex items-baseline gap-2 mb-6'>
                <span className='text-4xl font-bold'>${pricing.tiers.pro.earlyBirdPrice}</span>
                <span className='text-muted-foreground line-through text-sm'>${pricing.tiers.pro.price}</span>
                <span className='text-muted-foreground text-sm ml-1'>one-time</span>
              </div>
              <ul className='space-y-3 text-sm'>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-green-500' />
                  <span>Commercial use allowed</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-green-500' />
                  <span>Unlimited Connections</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-green-500' />
                  <span>Priority Support</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-green-500' />
                  <span>Everything in Free</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-green-500' />
                  <span className='font-medium text-primary'>Lifetime updates</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter className='relative'>
              <Button asChild className='w-full' variant='outline'>
                <Link to='/dashboard/billing' search={{ upgrade: true, plan: 'onetime' }}>
                  Get Pro One-time
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* FAQ */}
        <div ref={faqRef.ref} className={`mt-24 max-w-3xl mx-auto transition-all duration-1000 ${faqRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className='text-2xl font-semibold text-center mb-12'>Frequently Asked Questions</h2>
          <div className='grid gap-8 md:grid-cols-2'>
            <div className='group p-4 rounded-xl hover:bg-muted/50 transition-colors'>
              <h3 className='font-medium mb-2 flex items-center gap-2'>
                <span className='w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs'>?</span>
                What does BYOK mean?
              </h3>
              <p className='text-sm text-muted-foreground'>Bring Your Own Key. You provide your own API key for OpenAI or Anthropic to use the AI features. We don't mark up AI costs.</p>
            </div>
            <div className='group p-4 rounded-xl hover:bg-muted/50 transition-colors'>
              <h3 className='font-medium mb-2 flex items-center gap-2'>
                <span className='w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs'>?</span>
                What's the difference between monthly and one-time?
              </h3>
              <p className='text-sm text-muted-foreground'>
                Monthly is a subscription at $4.99/month with 3 days free trial and continuous updates. One-time is a single payment of $19.99 (early bird) for lifetime access and updates. Both have
                the same features.
              </p>
            </div>
            <div className='group p-4 rounded-xl hover:bg-muted/50 transition-colors'>
              <h3 className='font-medium mb-2 flex items-center gap-2'>
                <span className='w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs'>?</span>
                Can I upgrade or switch plans later?
              </h3>
              <p className='text-sm text-muted-foreground'>Yes. Start with the Free version and upgrade to Pro anytime. You can also switch between monthly and one-time plans from your dashboard.</p>
            </div>
            <div className='group p-4 rounded-xl hover:bg-muted/50 transition-colors'>
              <h3 className='font-medium mb-2 flex items-center gap-2'>
                <span className='w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs'>?</span>
                Do you offer refunds?
              </h3>
              <p className='text-sm text-muted-foreground'>
                Yes. For one-time purchases, email us within 14 days for a full refund. For monthly subscriptions, you can cancel anytime and keep access until the end of your billing period.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className='border-t py-8 mt-12'>
        <div className='container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4'>
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
      </footer>
    </div>
  )
}
