import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authed/dashboard/security')({
  component: SecurityPage,
})

function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setIsLoading(true)

    try {
      // TODO: Implement password change with authClient
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast.success('Password updated')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      toast.error('Failed to update password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='max-w-md'>
      <h1 className='text-lg font-medium'>Security</h1>
      <p className='mt-1 text-sm text-muted-foreground'>Manage your password and sessions.</p>

      <form onSubmit={handleChangePassword} className='mt-8 space-y-4'>
        <div>
          <label htmlFor='current-password' className='text-sm font-medium'>
            Current password
          </label>
          <Input
            id='current-password'
            type='password'
            placeholder='••••••••'
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            disabled={isLoading}
            className='mt-1.5'
          />
        </div>

        <div>
          <label htmlFor='new-password' className='text-sm font-medium'>
            New password
          </label>
          <Input
            id='new-password'
            type='password'
            placeholder='••••••••'
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            disabled={isLoading}
            className='mt-1.5'
          />
        </div>

        <div>
          <label htmlFor='confirm-password' className='text-sm font-medium'>
            Confirm new password
          </label>
          <Input
            id='confirm-password'
            type='password'
            placeholder='••••••••'
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            disabled={isLoading}
            className='mt-1.5'
          />
        </div>

        <Button type='submit' disabled={isLoading} size='sm'>
          {isLoading ? 'Updating...' : 'Update password'}
        </Button>
      </form>

      <div className='mt-16 pt-8 border-t'>
        <h2 className='text-sm font-medium'>Sessions</h2>
        <p className='mt-1 text-sm text-muted-foreground'>Manage your active sessions across devices.</p>

        <div className='mt-4 py-3 flex items-center justify-between border-b'>
          <div>
            <p className='text-sm'>Current session</p>
            <p className='text-xs text-muted-foreground'>This device</p>
          </div>
          <span className='text-xs text-muted-foreground'>Active</span>
        </div>

        <Button variant='outline' size='sm' className='mt-4'>
          Sign out other sessions
        </Button>
      </div>
    </div>
  )
}
