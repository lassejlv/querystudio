import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { getDevicesFn, deactivateDeviceFn, reactivateDeviceFn, deleteDeviceFn } from '@/server/devices'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

export const Route = createFileRoute('/_authed/dashboard/devices')({
  component: DevicesPage,
  loader: async () => {
    const devices = await getDevicesFn()
    return { devices }
  },
})

type DeviceData = Awaited<ReturnType<typeof getDevicesFn>>
type Device = DeviceData['devices'][number]

function DevicesPage() {
  const { user } = Route.useRouteContext() as { user: { isPro?: boolean } }
  const initialData = Route.useLoaderData() as { devices: DeviceData }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['devices'],
    queryFn: () => getDevicesFn(),
    initialData: initialData.devices,
  })

  const deactivateMutation = useMutation({
    mutationFn: (deviceId: string) => deactivateDeviceFn({ data: { deviceId } }),
    onSuccess: () => {
      toast.success('Device deactivated')
      refetch()
    },
    onError: (err) => toast.error('Failed to deactivate', { description: err.message }),
  })

  const reactivateMutation = useMutation({
    mutationFn: (deviceId: string) => reactivateDeviceFn({ data: { deviceId } }),
    onSuccess: () => {
      toast.success('Device reactivated')
      refetch()
    },
    onError: (err) => toast.error('Failed to reactivate', { description: err.message }),
  })

  const deleteMutation = useMutation({
    mutationFn: (deviceId: string) => deleteDeviceFn({ data: { deviceId } }),
    onSuccess: () => {
      toast.success('Device deleted')
      refetch()
    },
    onError: (err) => toast.error('Failed to delete', { description: err.message }),
  })

  if (!user.isPro) {
    return (
      <div className='max-w-md'>
        <h1 className='text-lg font-medium'>Devices</h1>
        <p className='mt-1 text-sm text-muted-foreground'>Manage your activated devices.</p>

        <div className='mt-8 py-8 text-center'>
          <p className='text-sm text-muted-foreground'>Upgrade to Pro to use QueryStudio on multiple devices.</p>
          <Button size='sm' className='mt-4' asChild>
            <Link to='/dashboard/billing'>Upgrade to Pro</Link>
          </Button>
        </div>
      </div>
    )
  }

  const isPending = deactivateMutation.isPending || reactivateMutation.isPending || deleteMutation.isPending

  return (
    <div className='max-w-md'>
      <div className='flex items-baseline justify-between'>
        <div>
          <h1 className='text-lg font-medium'>Devices</h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            {data.activeCount} of {data.maxDevices} devices active.
          </p>
        </div>
        {!data.licenseValid && <span className='text-xs text-destructive'>{data.licenseError || 'License invalid'}</span>}
      </div>

      <div className='mt-8'>
        {isLoading ? (
          <p className='text-sm text-muted-foreground py-8 text-center'>Loading...</p>
        ) : data.devices.length === 0 ? (
          <p className='text-sm text-muted-foreground py-8 text-center'>No devices activated yet.</p>
        ) : (
          <table className='w-full'>
            <thead>
              <tr className='border-b text-left'>
                <th className='pb-3 text-sm font-medium'>Device</th>
                <th className='pb-3 text-sm font-medium'>Status</th>
                <th className='pb-3 text-sm font-medium text-right'>Actions</th>
              </tr>
            </thead>
            <tbody className='text-sm'>
              {data.devices.map((device: Device) => (
                <tr key={device.id} className='border-b'>
                  <td className='py-3'>
                    <div>
                      <span className={device.active ? '' : 'text-muted-foreground'}>{device.name}</span>
                      <p className='text-xs text-muted-foreground'>{device.lastSeenAt ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true }) : 'Never used'}</p>
                    </div>
                  </td>
                  <td className='py-3'>
                    <span className={device.active ? 'text-foreground' : 'text-muted-foreground'}>{device.active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className='py-3 text-right'>
                    <div className='flex items-center justify-end gap-2'>
                      {device.active ? (
                        <button onClick={() => deactivateMutation.mutate(device.id)} disabled={isPending} className='text-sm text-muted-foreground hover:text-foreground disabled:opacity-50'>
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => reactivateMutation.mutate(device.id)}
                          disabled={isPending || data.activeCount >= data.maxDevices}
                          className='text-sm text-muted-foreground hover:text-foreground disabled:opacity-50'
                        >
                          Activate
                        </button>
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className='text-sm text-destructive hover:text-destructive/80'>Delete</button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {device.name}?</AlertDialogTitle>
                            <AlertDialogDescription>This device will need to be reactivated to use QueryStudio again.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(device.id)} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
