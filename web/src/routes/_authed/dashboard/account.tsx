import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { auth } from '@/lib/auth'
import { db } from 'drizzle'
import { user as userTable } from 'drizzle/schema/auth'
import { eq } from 'drizzle-orm'
import { useState } from 'react'
import { toast } from 'sonner'
import z from 'zod'

const updateNameFn = createServerFn()
  .inputValidator(z.object({ name: z.string() }))
  .handler(async ({ data }) => {
    const req = getRequest()
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session) throw new Error('Unauthorized')

    const { user } = session

    await db.update(userTable).set({ name: data.name }).where(eq(userTable.id, user.id))

    return { success: true }
  })

export const Route = createFileRoute('/_authed/dashboard/account')({
  component: AccountPage,
})

function AccountPage() {
  const { user } = Route.useRouteContext()
  const [name, setName] = useState(user.name)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateNameFn({ data: { name } })
      toast.success('Changes saved')
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className='max-w-md'>
      <h1 className='text-lg font-medium'>Account</h1>
      <p className='mt-1 text-sm text-muted-foreground'>Manage your profile information.</p>

      <div className='mt-8 space-y-6'>
        <div className='space-y-4'>
          <div>
            <label htmlFor='name' className='text-sm font-medium'>
              Name
            </label>
            <Input id='name' value={name} onChange={(e) => setName(e.target.value)} className='mt-1.5' />
          </div>

          <div>
            <label htmlFor='email' className='text-sm font-medium'>
              Email
            </label>
            <Input id='email' type='email' defaultValue={user.email} disabled className='mt-1.5' />
            <p className='mt-1.5 text-xs text-muted-foreground'>Contact support to change your email.</p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving} size='sm'>
          {isSaving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>

      <div className='mt-16 pt-8 border-t'>
        <h2 className='text-sm font-medium text-destructive'>Delete account</h2>
        <p className='mt-1 text-sm text-muted-foreground'>Permanently delete your account and all associated data.</p>
        <Button variant='outline' size='sm' className='mt-4 text-destructive hover:text-destructive'>
          Delete account
        </Button>
      </div>
    </div>
  )
}
