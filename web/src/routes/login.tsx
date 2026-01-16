import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Header } from '@/components/header'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'
import Spinner from '@/components/ui/spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const loginGithub = () => {
    return authClient.signIn.social({ provider: 'github' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
      })

      if (error) {
        toast.error(error.message || 'Failed to sign in')
        return
      }

      toast.success('Signed in successfully')
      navigate({ to: '/' })
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='min-h-screen bg-muted/40 flex flex-col'>
      <Header />
      <div className='flex-1 flex items-center justify-center p-4'>
        <Card className='w-full max-w-sm shadow-md'>
          <CardHeader className='space-y-1'>
            <CardTitle className='text-2xl font-bold'>Sign in</CardTitle>
            <CardDescription>Enter your email below to login to your account</CardDescription>
          </CardHeader>
          <CardContent className='grid gap-4'>
            <form onSubmit={handleSubmit} className='grid gap-4'>
              <div className='grid gap-2'>
                <Label htmlFor='email'>Email</Label>
                <Input id='email' type='email' placeholder='you@example.com' value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='password'>Password</Label>
                <Input id='password' type='password' placeholder='••••••••' value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
              </div>
              <Button type='submit' className='w-full' disabled={isLoading}>
                {isLoading && <Spinner size={16} />}
                Sign in
              </Button>
            </form>

            <div className='relative'>
              <div className='absolute inset-0 flex items-center'>
                <span className='w-full border-t' />
              </div>
              <div className='relative flex justify-center text-xs uppercase'>
                <span className='bg-card px-2 text-muted-foreground'>Or continue with</span>
              </div>
            </div>

            <Button variant='outline' className='w-full' onClick={loginGithub} disabled={isLoading}>
              Github
            </Button>
          </CardContent>
          <div className='p-6 pt-0 text-center text-sm text-muted-foreground'>
            Don't have an account?{' '}
            <Link to='/signup' className='underline underline-offset-4 hover:text-primary'>
              Sign up
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
