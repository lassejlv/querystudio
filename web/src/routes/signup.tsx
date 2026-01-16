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

export const Route = createFileRoute('/signup')({
  component: SignupPage,
})

function SignupPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
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
      const { error } = await authClient.signUp.email({
        name,
        email,
        password,
      })

      if (error) {
        toast.error(error.message || 'Failed to create account')
        return
      }

      toast.success('Account created! Please check your email to verify your account.')
      navigate({ to: '/login' })
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
            <CardTitle className='text-2xl font-bold'>Create an account</CardTitle>
            <CardDescription>Enter your information to create an account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className='grid gap-4'>
              <div className='grid gap-2'>
                <Label htmlFor='name'>Name</Label>
                <Input id='name' type='text' placeholder='John Doe' value={name} onChange={(e) => setName(e.target.value)} required disabled={isLoading} />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='email'>Email</Label>
                <Input id='email' type='email' placeholder='you@example.com' value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='password'>Password</Label>
                <Input id='password' type='password' placeholder='••••••••' value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} disabled={isLoading} />
                <p className='text-xs text-muted-foreground'>At least 8 characters</p>
              </div>
              <Button type='submit' className='w-full' disabled={isLoading}>
                {isLoading && <Spinner size={16} />}
                Create account
              </Button>
            </form>

            <div className='relative my-4'>
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
            Already have an account?{' '}
            <Link to='/login' className='underline underline-offset-4 hover:text-primary'>
              Sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
