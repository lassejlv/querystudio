import { createFileRoute, Link } from '@tanstack/react-router'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Download, Check } from 'lucide-react'
import { getPricing } from '@/server/pricing'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
  loader: () => getPricing(),
})

function PricingPage() {
  const pricing = Route.useLoaderData()

  return (
    <div className='min-h-screen bg-background flex flex-col'>
      <Header />

      <main className='flex-1 container mx-auto px-4 py-16 md:py-24'>
        <div className='max-w-2xl mx-auto text-center mb-16'>
          <h1 className='text-3xl font-bold tracking-tight sm:text-4xl'>Pricing that you can overcome</h1>
          <p className='mt-4 text-muted-foreground text-lg'>Free for personal use. One-time payment for professionals.</p>
        </div>

        <div className='grid md:grid-cols-2 gap-8 max-w-4xl mx-auto'>
          {/* Free Tier */}
          <Card className='flex flex-col shadow-md'>
            <CardHeader>
              <CardTitle className='text-xl'>{pricing.tiers.free.name}</CardTitle>
              <CardDescription>Perfect for hobbyists and students</CardDescription>
            </CardHeader>
            <CardContent className='flex-1'>
              <div className='text-3xl font-bold mb-6'>$0</div>
              <ul className='space-y-3 text-sm'>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-primary' />
                  <span>Personal use only</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-primary' />
                  <span>{pricing.tiers.free.features.maxConnections} Saved Connections</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-primary' />
                  <span>All database dialects</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-primary' />
                  <span>AI Assistant (BYOK)</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-primary' />
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

          {/* Pro Tier */}
          <Card className='flex flex-col shadow-md border-primary relative overflow-hidden'>
            <div className='absolute top-0 right-0 p-3'>
              <Badge variant='secondary' className='text-xs'>
                Early Bird
              </Badge>
            </div>
            <CardHeader>
              <CardTitle className='text-xl'>{pricing.tiers.pro.name}</CardTitle>
              <CardDescription>For professionals and commercial use</CardDescription>
            </CardHeader>
            <CardContent className='flex-1'>
              <div className='flex items-baseline gap-2 mb-6'>
                <span className='text-3xl font-bold'>${pricing.tiers.pro.earlyBirdPrice}</span>
                <span className='text-muted-foreground line-through text-sm'>${pricing.tiers.pro.price}</span>
                <span className='text-muted-foreground text-sm ml-1'>one-time</span>
              </div>
              <ul className='space-y-3 text-sm'>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-primary' />
                  <span>Commercial use allowed</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-primary' />
                  <span>Unlimited Connections</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-primary' />
                  <span>Priority Support</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-primary' />
                  <span>Everything in Free</span>
                </li>
                <li className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-primary' />
                  <span>Lifetime updates</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className='w-full'>
                <Link to='/dashboard/billing' search={{ upgrade: true }}>
                  Get Pro
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* FAQ */}
        <div className='mt-24 max-w-3xl mx-auto'>
          <h2 className='text-2xl font-semibold text-center mb-12'>Frequently Asked Questions</h2>
          <div className='grid gap-8 md:grid-cols-2'>
            <div>
              <h3 className='font-medium mb-2'>What does BYOK mean?</h3>
              <p className='text-sm text-muted-foreground'>Bring Your Own Key. You provide your own API key for OpenAI or Anthropic to use the AI features. We don't mark up AI costs.</p>
            </div>
            <div>
              <h3 className='font-medium mb-2'>Is Pro really one-time?</h3>
              <p className='text-sm text-muted-foreground'>Yes. Pay once, use forever. All future updates are included. No subscriptions.</p>
            </div>
            <div>
              <h3 className='font-medium mb-2'>Can I upgrade later?</h3>
              <p className='text-sm text-muted-foreground'>Yes. Start with the Free version and upgrade to Pro anytime from your dashboard when you need more power.</p>
            </div>
            <div>
              <h3 className='font-medium mb-2'>Do you offer refunds?</h3>
              <p className='text-sm text-muted-foreground'>Yes. If you're not satisfied, email us within 14 days of purchase for a full refund. No questions asked.</p>
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
