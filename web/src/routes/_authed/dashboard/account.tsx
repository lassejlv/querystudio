import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { auth } from '@/lib/auth'
import { realtime } from '@/lib/realtime'
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

    const channel = realtime.channel(`backend-user-${user.id}`)
    channel.emit('userBackend.changesSaved', { message: 'Your name has been updated!' })

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
    } catch (error) {
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Account</h1>
        <p className='text-muted-foreground'>Manage your account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='name'>Name</Label>
            <Input id='name' value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='email'>Email</Label>
            <Input id='email' type='email' defaultValue={user.email} disabled />
            <p className='text-xs text-muted-foreground'>Contact support to change your email</p>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-destructive'>Danger Zone</CardTitle>
          <CardDescription>Irreversible actions for your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant='destructive'>Delete account</Button>
        </CardContent>
      </Card>
    </div>
  )
}
