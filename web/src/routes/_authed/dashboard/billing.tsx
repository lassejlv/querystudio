import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Infinity as InfinityIcon, ExternalLink, Key } from 'lucide-react'
import { getPricing } from '@/server/pricing'
import { useMutation } from '@tanstack/react-query'
import { createCheckout, createCustomerPortal } from '@/server/billing'
import { toast } from 'sonner'
import Spinner from '@/components/ui/spinner'

export const Route = createFileRoute('/_authed/dashboard/billing')({
  component: BillingPage,
  loader: async () => {
    const pricing = await getPricing()
    return { pricing }
  },
})

function BillingPage() {
  const { user } = Route.useRouteContext()
  const { pricing } = Route.useLoaderData()

  const createCheckoutMutation = useMutation({
    mutationFn: async () => {
      return await createCheckout()
    },
    onSuccess: (data) => {
      return window.location.replace(data.url)
    },
    onError: (err) => {
      toast.error('Error!', { description: err.message })
    },
  })

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Billing</h1>
        <p className='text-muted-foreground'>Manage your subscription and billing</p>
      </div>

      <div className='grid md:grid-cols-2 gap-6'>
        {/* Free Tier */}
        <Card className={!user.isPro ? 'border-primary' : ''}>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-xl'>{pricing.tiers.free.name}</CardTitle>
              {!user.isPro && <Badge variant='secondary'>Current Plan</Badge>}
            </div>
            <CardDescription>Perfect for getting started</CardDescription>
            <div className='mt-4'>
              <span className='text-3xl font-bold'>${pricing.tiers.free.price}</span>
              <span className='text-muted-foreground ml-2'>forever</span>
            </div>
          </CardHeader>
          <CardContent className='space-y-3'>
            <FeatureItem>{pricing.tiers.free.features.maxConnections} database connection</FeatureItem>
            <FeatureItem>{pricing.tiers.free.features.dialects.map((d) => capitalize(d)).join(' & ')} support</FeatureItem>
            <FeatureItem>SQL query runner</FeatureItem>
            <FeatureItem>Auto-complete</FeatureItem>
            <FeatureItem>AI assistant (bring your own key)</FeatureItem>
          </CardContent>
        </Card>

        {/* Pro Tier */}
        <Card className={`relative ${user.isPro ? 'border-primary' : 'border-primary'}`}>
          {!user.isPro && (
            <div className='absolute -top-3 left-1/2 -translate-x-1/2'>
              <span className='bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full'>Early Bird</span>
            </div>
          )}
          <CardHeader>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-xl'>{pricing.tiers.pro.name}</CardTitle>
              {user.isPro && <Badge variant='default'>Current Plan</Badge>}
            </div>
            <CardDescription>For power users and teams</CardDescription>
            <div className='mt-4'>
              <span className='text-3xl font-bold'>${pricing.tiers.pro.earlyBirdPrice}</span>
              <span className='text-muted-foreground ml-2 line-through'>${pricing.tiers.pro.price}</span>
              <span className='text-muted-foreground ml-2'>one-time</span>
            </div>
            <p className='text-sm text-green-600 dark:text-green-400 mt-1'>Save 70% during beta!</p>
          </CardHeader>
          <CardContent className='space-y-3'>
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
          {!user.isPro && (
            <CardFooter>
              <Button className='w-full' onClick={() => createCheckoutMutation.mutate()} disabled={createCheckoutMutation.isPending}>
                {createCheckoutMutation.isPending ? <Spinner /> : 'Upgrade to Pro'}
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Customer Portal - Only show for Pro users */}
      {user.isPro && <CustomerPortalCard />}

      {/* AI Note */}
      <Card className='bg-muted/50'>
        <CardContent className='pt-6'>
          <h3 className='font-semibold mb-2'>Bring Your Own API Key</h3>
          <p className='text-sm text-muted-foreground'>
            QueryStudio's AI features work with your own API keys from {pricing.ai.supportedProviders.map((p) => capitalize(p)).join(', ')}. Your data stays private and you only pay for what you use
            directly to the provider.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function CustomerPortalCard() {
  const portalMutation = useMutation({
    mutationFn: async () => {
      return await createCustomerPortal()
    },
    onSuccess: (data) => {
      window.open(data.url, '_blank')
    },
    onError: (err) => {
      toast.error('Failed to open customer portal', { description: err.message })
    },
  })

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center gap-2'>
          <Key className='h-5 w-5' />
          <CardTitle>Customer Portal</CardTitle>
        </div>
        <CardDescription>Manage your subscription, view your license key, and download invoices</CardDescription>
      </CardHeader>
      <CardContent>
        <p className='text-sm text-muted-foreground mb-4'>Access your customer portal to find your license key, manage billing details, and view your complete purchase history.</p>
        <Button onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending}>
          {portalMutation.isPending ? <Spinner className='h-4 w-4 mr-2' /> : <ExternalLink className='h-4 w-4 mr-2' />}
          Open Customer Portal
        </Button>
      </CardContent>
    </Card>
  )
}

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex items-center gap-3'>
      <Check className='h-4 w-4 text-green-500 shrink-0' />
      <span className='text-sm'>{children}</span>
    </div>
  )
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
