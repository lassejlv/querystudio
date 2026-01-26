import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import { getPricing } from '@/server/pricing'
import { useMutation } from '@tanstack/react-query'
import { createCheckout, createCustomerPortal } from '@/server/billing'
import { toast } from 'sonner'

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
      toast.error('Error', { description: err.message })
    },
  })

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
    <div className='max-w-md'>
      <h1 className='text-lg font-medium'>Billing</h1>
      <p className='mt-1 text-sm text-muted-foreground'>Manage your subscription and license.</p>

      <div className='mt-8'>
        <div className='flex items-baseline justify-between pb-4 border-b'>
          <div>
            <span className='font-medium'>{user.isPro ? 'Pro' : 'Free'}</span>
            <span className='ml-2 text-sm text-muted-foreground'>{user.isPro && 'Lifetime access'}</span>
          </div>
          {user.isPro && (
            <button onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending} className='text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1'>
              Manage
              <ExternalLink className='h-3 w-3' />
            </button>
          )}
        </div>

        {user.isPro ? (
          <div className='mt-6'>
            <h2 className='text-sm font-medium'>What's included</h2>
            <ul className='mt-3 space-y-2 text-sm text-muted-foreground'>
              <li>Unlimited connections</li>
              <p>Commercial use allowed</p>
              <li>Priority support</li>
              <li>2 devices</li>
              <li>Lifetime updates</li>
            </ul>
          </div>
        ) : (
          <div className='mt-6'>
            <h2 className='text-sm font-medium'>Upgrade to Pro</h2>
            <p className='mt-1 text-sm text-muted-foreground'>One-time payment for unlimited access.</p>

            <div className='mt-4 py-4 border-b'>
              <div className='flex items-baseline justify-between'>
                <span className='text-sm'>Pro license</span>
                <div>
                  <span className='font-medium'>${pricing.tiers.pro.earlyBirdPrice}</span>
                  <span className='ml-2 text-sm text-muted-foreground line-through'>${pricing.tiers.pro.price}</span>
                </div>
              </div>
              <ul className='mt-3 space-y-1 text-sm text-muted-foreground'>
                <li>Unlimited connections</li>
                <p>Commercial use allowed</p>

                <li>Priority support</li>
                <li>2 devices</li>
                <li>Lifetime updates</li>
              </ul>
            </div>

            <Button size='sm' className='mt-4' onClick={() => createCheckoutMutation.mutate()} disabled={createCheckoutMutation.isPending}>
              {createCheckoutMutation.isPending ? 'Loading...' : 'Upgrade'}
            </Button>
          </div>
        )}
      </div>

      <div className='mt-16 pt-8 border-t'>
        <h2 className='text-sm font-medium'>Need help?</h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          Contact support at{' '}
          <a href='mailto:querystudio@lasse.email' className='text-foreground hover:underline'>
            querystudio@lasse.email
          </a>
        </p>
      </div>
    </div>
  )
}
