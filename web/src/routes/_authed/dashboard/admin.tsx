import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export const Route = createFileRoute('/_authed/dashboard/admin')({
  component: AdminPage,
})

type WaitlistEntry = {
  id: string
  email: string
  status: 'pending' | 'accepted' | 'rejected'
  requestedAt: Date | string
  processedAt?: Date | string
}

function AdminPage() {
  const { user } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const [processingId, setProcessingId] = useState<string | null>(null)

  const isAdmin = user.email === 'vestergaardlasse2@gmail.com'

  const {
    data: entries = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['waitlist-entries'],
    queryFn: async () => {
      const response = await authClient.waitlist.list({
        query: {
          limit: 100,
        },
      })
      if (response.error) throw response.error
      return (response.data?.data ?? []) as WaitlistEntry[]
    },
    enabled: isAdmin,
  })

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      setProcessingId(id)
      const response = await authClient.waitlist.request.approve({ id })
      if (response.error) throw response.error
    },
    onSuccess: () => {
      toast.success('Entry approved')
      queryClient.invalidateQueries({ queryKey: ['waitlist-entries'] })
    },
    onError: () => {
      toast.error('Failed to approve entry')
    },
    onSettled: () => {
      setProcessingId(null)
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      setProcessingId(id)
      const response = await authClient.waitlist.request.reject({ id })
      if (response.error) throw response.error
    },
    onSuccess: () => {
      toast.success('Entry rejected')
      queryClient.invalidateQueries({ queryKey: ['waitlist-entries'] })
    },
    onError: () => {
      toast.error('Failed to reject entry')
    },
    onSettled: () => {
      setProcessingId(null)
    },
  })

  if (!isAdmin) {
    return (
      <div className='max-w-md'>
        <h1 className='text-lg font-medium'>Admin</h1>
        <p className='mt-1 text-sm text-muted-foreground'>You don't have permission to access this page.</p>
      </div>
    )
  }

  const pendingEntries = entries.filter((e) => e.status === 'pending')
  const acceptedEntries = entries.filter((e) => e.status === 'accepted')
  const rejectedEntries = entries.filter((e) => e.status === 'rejected')

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString()
  }

  return (
    <div className='max-w-2xl'>
      <div className='flex items-baseline justify-between'>
        <div>
          <h1 className='text-lg font-medium'>Admin</h1>
          <p className='mt-1 text-sm text-muted-foreground'>Manage waitlist entries.</p>
        </div>
        <button onClick={() => refetch()} disabled={isLoading} className='text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5'>
          <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className='mt-8 flex gap-8 text-sm'>
        <div>
          <span className='text-2xl font-semibold'>{entries.length}</span>
          <p className='text-muted-foreground'>Total</p>
        </div>
        <div>
          <span className='text-2xl font-semibold'>{pendingEntries.length}</span>
          <p className='text-muted-foreground'>Pending</p>
        </div>
        <div>
          <span className='text-2xl font-semibold'>{acceptedEntries.length}</span>
          <p className='text-muted-foreground'>Accepted</p>
        </div>
        <div>
          <span className='text-2xl font-semibold'>{rejectedEntries.length}</span>
          <p className='text-muted-foreground'>Rejected</p>
        </div>
      </div>

      {/* Pending */}
      {pendingEntries.length > 0 && (
        <div className='mt-12'>
          <h2 className='text-sm font-medium'>Pending requests</h2>
          <p className='mt-1 text-sm text-muted-foreground'>Review and approve or reject waitlist requests.</p>

          <table className='mt-4 w-full'>
            <thead>
              <tr className='border-b text-left'>
                <th className='pb-3 text-sm font-medium'>Email</th>
                <th className='pb-3 text-sm font-medium'>Requested</th>
                <th className='pb-3 text-sm font-medium text-right'>Actions</th>
              </tr>
            </thead>
            <tbody className='text-sm'>
              {pendingEntries.map((entry) => (
                <tr key={entry.id} className='border-b'>
                  <td className='py-3'>{entry.email}</td>
                  <td className='py-3 text-muted-foreground'>{formatDate(entry.requestedAt)}</td>
                  <td className='py-3 text-right'>
                    <div className='flex items-center justify-end gap-3'>
                      <button onClick={() => rejectMutation.mutate(entry.id)} disabled={processingId === entry.id} className='text-muted-foreground hover:text-foreground disabled:opacity-50'>
                        Reject
                      </button>
                      <Button size='sm' onClick={() => approveMutation.mutate(entry.id)} disabled={processingId === entry.id}>
                        {processingId === entry.id ? 'Processing...' : 'Approve'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* All entries */}
      <div className='mt-12'>
        <h2 className='text-sm font-medium'>All entries</h2>
        <p className='mt-1 text-sm text-muted-foreground'>Complete list of waitlist entries.</p>

        {isLoading ? (
          <p className='mt-4 text-sm text-muted-foreground'>Loading...</p>
        ) : entries.length === 0 ? (
          <p className='mt-4 text-sm text-muted-foreground'>No waitlist entries yet.</p>
        ) : (
          <table className='mt-4 w-full'>
            <thead>
              <tr className='border-b text-left'>
                <th className='pb-3 text-sm font-medium'>Email</th>
                <th className='pb-3 text-sm font-medium'>Status</th>
                <th className='pb-3 text-sm font-medium text-right'>Date</th>
              </tr>
            </thead>
            <tbody className='text-sm'>
              {entries.map((entry) => (
                <tr key={entry.id} className='border-b'>
                  <td className='py-3'>{entry.email}</td>
                  <td className='py-3'>
                    <span className={entry.status === 'accepted' ? 'text-foreground' : entry.status === 'rejected' ? 'text-muted-foreground' : 'text-muted-foreground'}>{entry.status}</span>
                  </td>
                  <td className='py-3 text-right text-muted-foreground'>{formatDate(entry.requestedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
