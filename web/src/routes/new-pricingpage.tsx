import { createFileRoute, Link } from '@tanstack/react-router'
import * as React from 'react'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Download, Check } from 'lucide-react'
import { getPricing } from '@/server/pricing'

export const Route = createFileRoute('/new-pricingpage')({
  component: NewPricingPage,
  loader: () => getPricing(),
})

function NewPricingPage() {
  const pricing = Route.useLoaderData() as Awaited<ReturnType<typeof getPricing>>
  const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'annually'>('monthly')

  return (
    <div className='min-h-screen bg-background flex flex-col'>
      <Header />

      <main className='flex-1'>
        <section className='container mx-auto px-4 pt-20 md:pt-28 pb-10'>
          <div className='max-w-2xl'>
            <div className='inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground bg-background/80'>Simple pricing</div>
            <h1 className='mt-6 text-4xl md:text-6xl font-semibold tracking-tight text-foreground leading-[1.05]'>
              Pricing that works
              <br />
              <span className='text-foreground/70'>with your work</span>
            </h1>
            <p className='mt-5 text-lg text-muted-foreground max-w-xl'>Free for personal use. Flexible options for everyone.</p>
          </div>

          <div className='mt-10'>
            <Tabs value={billingCycle} onValueChange={(v) => setBillingCycle(v as 'monthly' | 'annually')}>
              <TabsList className='rounded-full'>
                <TabsTrigger value='monthly'>Monthly</TabsTrigger>
                <TabsTrigger value='annually'>Annually</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </section>

        <section className='container mx-auto px-4 pb-20'>
          <div className='grid gap-6 md:grid-cols-3'>
            <Card className='flex flex-col rounded-3xl hover:shadow-md hover:-translate-y-0.5'>
              <CardHeader>
                <CardTitle className='text-lg'>{pricing.tiers.free.name}</CardTitle>
                <CardDescription>Perfect for hobbyists and students</CardDescription>
              </CardHeader>
              <CardContent className='flex-1'>
                <div className='text-4xl font-semibold mb-6'>$0</div>
                <ul className='space-y-3 text-sm text-muted-foreground'>
                  <li className='flex items-center gap-2'>
                    <Check className='h-4 w-4 text-emerald-500' />
                    Personal use only
                  </li>
                  <li className='flex items-center gap-2'>
                    <Check className='h-4 w-4 text-emerald-500' />
                    {pricing.tiers.free.features.maxConnections} saved connections
                  </li>
                  <li className='flex items-center gap-2'>
                    <Check className='h-4 w-4 text-emerald-500' />
                    All database dialects (1 connection per dialect)
                  </li>
                  <li className='flex items-center gap-2'>
                    <Check className='h-4 w-4 text-emerald-500' />
                    AI assistant (BYOK)
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className='w-full rounded-full' variant='outline'>
                  <Link to='/download'>
                    <Download className='h-4 w-4 mr-2' />
                    Download Free
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            {billingCycle === 'monthly' ? (
              <Card className='flex flex-col rounded-3xl border-primary/60 relative hover:shadow-md hover:-translate-y-0.5'>
                <div className='absolute top-4 right-4'>
                  <Badge variant='default' className='text-xs'>
                    Popular
                  </Badge>
                </div>
                <CardHeader>
                  <CardTitle className='text-lg'>{pricing.tiers.proMonthly.name}</CardTitle>
                  <CardDescription>For professionals and commercial use</CardDescription>
                </CardHeader>
                <CardContent className='flex-1'>
                  <div className='flex items-baseline gap-2 mb-2'>
                    <span className='text-4xl font-semibold'>${pricing.tiers.proMonthly.price}</span>
                    <span className='text-muted-foreground text-sm'>/month</span>
                  </div>
                  <p className='text-sm text-muted-foreground mb-5'>3 days free trial</p>
                  <ul className='space-y-3 text-sm text-muted-foreground'>
                    <li className='flex items-center gap-2'>
                      <Check className='h-4 w-4 text-emerald-500' />
                      Commercial use allowed
                    </li>
                    <li className='flex items-center gap-2'>
                      <Check className='h-4 w-4 text-emerald-500' />
                      Unlimited connections
                    </li>
                    <li className='flex items-center gap-2'>
                      <Check className='h-4 w-4 text-emerald-500' />
                      Priority support
                    </li>
                    <li className='flex items-center gap-2'>
                      <Check className='h-4 w-4 text-emerald-500' />
                      Everything in Free
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button asChild className='w-full rounded-full'>
                    <Link to='/dashboard/billing' search={{ upgrade: true, plan: 'monthly' }}>
                      Get Pro Monthly
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ) : (
              <Card className='flex flex-col rounded-3xl border-primary/60 relative hover:shadow-md hover:-translate-y-0.5'>
                <div className='absolute top-4 right-4'>
                  <Badge variant='default' className='text-xs'>
                    Popular
                  </Badge>
                </div>
                <CardHeader>
                  <CardTitle className='text-lg'>{pricing.tiers.proAnnually.name}</CardTitle>
                  <CardDescription>For professionals and commercial use</CardDescription>
                </CardHeader>
                <CardContent className='flex-1'>
                  <div className='flex items-baseline gap-2 mb-2'>
                    <span className='text-4xl font-semibold'>${pricing.tiers.proAnnually.price}</span>
                    <span className='text-muted-foreground text-sm'>/year</span>
                  </div>
                  <p className='text-sm text-muted-foreground mb-5'>Save 2 months</p>
                  <ul className='space-y-3 text-sm text-muted-foreground'>
                    <li className='flex items-center gap-2'>
                      <Check className='h-4 w-4 text-emerald-500' />
                      Commercial use allowed
                    </li>
                    <li className='flex items-center gap-2'>
                      <Check className='h-4 w-4 text-emerald-500' />
                      Unlimited connections
                    </li>
                    <li className='flex items-center gap-2'>
                      <Check className='h-4 w-4 text-emerald-500' />
                      Priority support
                    </li>
                    <li className='flex items-center gap-2'>
                      <Check className='h-4 w-4 text-emerald-500' />
                      Everything in Free
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button asChild className='w-full rounded-full'>
                    <Link to='/dashboard/billing' search={{ upgrade: true, plan: 'annually' }}>
                      Get Pro Annually
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            )}

            <Card className='flex flex-col rounded-3xl relative hover:shadow-md hover:-translate-y-0.5'>
              <div className='absolute top-4 right-4'>
                <Badge variant='secondary' className='text-xs'>
                  Early Bird
                </Badge>
              </div>
              <CardHeader>
                <CardTitle className='text-lg'>{pricing.tiers.pro.name}</CardTitle>
                <CardDescription>One-time purchase, lifetime access</CardDescription>
              </CardHeader>
              <CardContent className='flex-1'>
                <div className='flex items-baseline gap-2 mb-6'>
                  <span className='text-4xl font-semibold'>${pricing.tiers.pro.earlyBirdPrice}</span>
                  <span className='text-muted-foreground line-through text-sm'>${pricing.tiers.pro.price}</span>
                  <span className='text-muted-foreground text-sm ml-1'>one-time</span>
                </div>
                <ul className='space-y-3 text-sm text-muted-foreground'>
                  <li className='flex items-center gap-2'>
                    <Check className='h-4 w-4 text-emerald-500' />
                    Commercial use allowed
                  </li>
                  <li className='flex items-center gap-2'>
                    <Check className='h-4 w-4 text-emerald-500' />
                    Unlimited connections
                  </li>
                  <li className='flex items-center gap-2'>
                    <Check className='h-4 w-4 text-emerald-500' />
                    Priority support
                  </li>
                  <li className='flex items-center gap-2'>
                    <Check className='h-4 w-4 text-emerald-500' />
                    Lifetime updates
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className='w-full rounded-full' variant='outline'>
                  <Link to='/dashboard/billing' search={{ upgrade: true, plan: 'onetime' }}>
                    Get Pro One-time
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        <section className='border-t'>
          <div className='container mx-auto px-4 py-16'>
            <div className='max-w-3xl'>
              <h2 className='text-2xl md:text-3xl font-semibold'>Frequently asked</h2>
              <p className='mt-3 text-muted-foreground'>Short answers to common questions.</p>
            </div>

            <div className='mt-8 grid gap-8 md:grid-cols-2'>
              <div>
                <h3 className='font-medium'>What does BYOK mean?</h3>
                <p className='mt-2 text-sm text-muted-foreground'>Bring Your Own Key. You provide your own API key for OpenAI or Anthropic to use the AI features.</p>
              </div>
              <div>
                <h3 className='font-medium'>What is the difference between monthly and one-time?</h3>
                <p className='mt-2 text-sm text-muted-foreground'>Monthly is a subscription with continuous updates. One-time is a single payment for lifetime access.</p>
              </div>
              <div>
                <h3 className='font-medium'>Can I upgrade or switch plans later?</h3>
                <p className='mt-2 text-sm text-muted-foreground'>Yes. Start free and upgrade anytime. You can switch between monthly and one-time plans from your dashboard.</p>
              </div>
              <div>
                <h3 className='font-medium'>Do you offer refunds?</h3>
                <p className='mt-2 text-sm text-muted-foreground'>Yes. One-time purchases can be refunded within 14 days. Monthly subscriptions can be canceled anytime.</p>
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
