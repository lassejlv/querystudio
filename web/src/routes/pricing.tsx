import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Infinity as InfinityIcon } from 'lucide-react'
import { getPricing } from '@/server/pricing'
import { Header } from '@/components/header'

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
  loader: () => getPricing(),
})

function PricingPage() {
  const pricing = Route.useLoaderData()

  return (
    <div className='min-h-screen bg-background'>
      <Header />

      {/* Pricing Section */}
      <section className='container mx-auto px-4 py-24'>
        <div className='text-center mb-16'>
          <h1 className='text-4xl md:text-5xl font-bold mb-4'>Prices, you can overcome</h1>
          <p className='text-muted-foreground text-lg max-w-2xl mx-auto'>Start for free, upgrade when you need more. No subscriptions, no recurring fees.</p>
        </div>

        <div className='grid md:grid-cols-2 gap-8 max-w-4xl mx-auto'>
          {/* Free Tier */}
          <Card className='relative'>
            <CardHeader>
              <CardTitle className='text-2xl'>{pricing.tiers.free.name}</CardTitle>
              <CardDescription>Perfect for getting started</CardDescription>
              <div className='mt-4'>
                <span className='text-4xl font-bold'>${pricing.tiers.free.price}</span>
                <span className='text-muted-foreground ml-2'>forever</span>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <FeatureItem>{pricing.tiers.free.features.maxConnections} database connection</FeatureItem>
              <FeatureItem>{pricing.tiers.free.features.dialects.map((d) => capitalize(d)).join(' & ')} support</FeatureItem>
              <FeatureItem>SQL query runner</FeatureItem>
              <FeatureItem>Auto-complete</FeatureItem>
              <FeatureItem>AI assistant (bring your own key)</FeatureItem>
            </CardContent>
            <CardFooter>
              <Button variant='outline' className='w-full' asChild>
                <Link to='/waitlist'>Join Waitlist</Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Pro Tier */}
          <Card className='relative border-primary'>
            <div className='absolute -top-3 left-1/2 -translate-x-1/2'>
              <span className='bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full'>Early Bird</span>
            </div>
            <CardHeader>
              <CardTitle className='text-2xl'>{pricing.tiers.pro.name}</CardTitle>
              <CardDescription>For power users and teams</CardDescription>
              <div className='mt-4'>
                <span className='text-4xl font-bold'>${pricing.tiers.pro.earlyBirdPrice}</span>
                <span className='text-muted-foreground ml-2 line-through'>${pricing.tiers.pro.price}</span>
                <span className='text-muted-foreground ml-2'>one-time</span>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <FeatureItem>
                <InfinityIcon className='h-4 w-4 inline mr-1' />
                Unlimited connections
              </FeatureItem>
              <FeatureItem>{pricing.tiers.pro.features.dialects.map((d) => capitalize(d)).join(', ')} support</FeatureItem>
              <FeatureItem>SQL query runner</FeatureItem>
              <FeatureItem>Auto-complete</FeatureItem>
              <FeatureItem>AI assistant (bring your own key)</FeatureItem>
              <FeatureItem>Priority support</FeatureItem>
              <FeatureItem>Lifetime updates</FeatureItem>
            </CardContent>
            <CardFooter>
              <Button className='w-full' asChild>
                <Link to='/waitlist'>Join Waitlist</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* AI Note */}
        <div className='mt-16 text-center'>
          <Card className='max-w-2xl mx-auto bg-muted/50'>
            <CardContent className='pt-6'>
              <h3 className='font-semibold mb-2'>Bring Your Own API Key</h3>
              <p className='text-sm text-muted-foreground'>
                QueryStudio's AI features work with your own API keys from {pricing.ai.supportedProviders.map((p) => capitalize(p)).join(', ')}. Your data stays private and you only pay for what you
                use directly to the provider.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex items-center gap-3'>
      <Check className='h-5 w-5 text-green-500 flex-shrink-0' />
      <span className='text-sm'>{children}</span>
    </div>
  )
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
