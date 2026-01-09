import { useRef, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Database, Table, Terminal, Shield, Download, Command, MousePointer, MessageSquare } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className='min-h-screen bg-background'>
      <section className='container mx-auto px-4 py-24 md:py-32'>
        <div className='flex flex-col items-center text-center gap-8'>
          <h1 className='text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl'>The modern database studio you deserve</h1>

          <p className='text-xl text-muted-foreground max-w-2xl'>A beautiful & lightweight sql studio, built with Tauri, React, and Rust. Query your data with SQL or let AI do it for you.</p>

          <div className='flex flex-col sm:flex-row gap-4 mt-4'>
            <Button size='lg' className='text-base' disabled>
              <Download className='h-5 w-5 mr-2' />
              Coming Soon
            </Button>
            <Button size='lg' variant='outline' className='text-base' asChild>
              <a href='https://github.com' target='_blank' rel='noopener noreferrer'>
                Waitlist
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section className='container mx-auto px-4 pb-24'>
        <div className='relative rounded-xl border bg-muted/50 overflow-hidden shadow-2xl'>
          <div className='flex items-center gap-2 px-4 py-3 border-b bg-background'>
            <div className='flex gap-2'>
              <div className='w-3 h-3 rounded-full bg-red-500' />
              <div className='w-3 h-3 rounded-full bg-yellow-500' />
              <div className='w-3 h-3 rounded-full bg-green-500' />
            </div>
            <span className='text-sm text-muted-foreground ml-2'>QueryStudio</span>
          </div>
          <DemoVideo />
        </div>
      </section>

      {/* Features Section */}
      <section id='features' className='container mx-auto px-4 py-24 border-t'>
        <div className='text-center mb-16'>
          <h2 className='text-3xl md:text-4xl font-bold mb-4'>Everything you need</h2>
          <p className='text-muted-foreground text-lg max-w-2xl mx-auto'>QueryStudio combines powerful features with a clean, intuitive interface.</p>
        </div>

        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
          <FeatureCard
            icon={<Database className='h-6 w-6' />}
            title='Connection Management'
            description='Save and quickly switch between database connections with Cmd+K. Your connections are stored securely on your machine.'
          />
          <FeatureCard
            icon={<Table className='h-6 w-6' />}
            title='Table Browser'
            description='Browse schemas and tables with row counts. View paginated data with column types and primary key indicators.'
          />
          <FeatureCard
            icon={<Terminal className='h-6 w-6' />}
            title='Query Editor'
            description='Execute custom SQL queries with syntax highlighting. Run queries with Cmd+Enter and see results instantly.'
          />
          <FeatureCard
            icon={<MessageSquare className='h-6 w-6' />}
            title='AI Assistant'
            description='Ask questions in natural language and let AI write the SQL for you. Explore your data without writing a single query.'
          />
          <FeatureCard
            icon={<MousePointer className='h-6 w-6' />}
            title='CRUD Operations'
            description='Add, edit, and delete rows with ease. Right-click context menus make data manipulation intuitive.'
          />
          <FeatureCard icon={<Shield className='h-6 w-6' />} title='Safe by Default' description='AI queries are read-only. Your data is never sent anywhere except to your configured OpenAI key.' />
        </div>
      </section>

      {/* Keyboard Shortcuts Section */}
      <section className='container mx-auto px-4 py-24 border-t'>
        <div className='grid md:grid-cols-2 gap-12 items-center'>
          <div>
            <h2 className='text-3xl md:text-4xl font-bold mb-4'>Built for speed</h2>
            <p className='text-muted-foreground text-lg mb-8'>Navigate and query your database without leaving the keyboard. QueryStudio is designed for developers who value efficiency.</p>

            <div className='space-y-4'>
              <ShortcutItem shortcut='⌘K' description='Open connection switcher' />
              <ShortcutItem shortcut='⌘↵' description='Execute query' />
              <ShortcutItem shortcut='⌘C' description='Copy cell content' />
              <ShortcutItem shortcut='Click' description='Right-click for context menu' />
            </div>
          </div>

          <div className='bg-muted rounded-xl p-8'>
            <div className='space-y-4'>
              <div className='flex items-center gap-3 p-3 bg-background rounded-lg'>
                <Command className='h-5 w-5 text-muted-foreground' />
                <span className='text-sm'>Search connections...</span>
              </div>
              <div className='space-y-2'>
                {['Production DB', 'Staging DB', 'Local Development'].map((conn, i) => (
                  <div key={conn} className={`p-3 rounded-lg text-sm ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-background'}`}>
                    <Database className='h-4 w-4 inline mr-2' />
                    {conn}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className='bg-card hover:bg-muted/50 transition-colors'>
      <CardHeader>
        <div className='h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2'>{icon}</div>
        <CardTitle className='text-xl'>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className='text-base'>{description}</CardDescription>
      </CardContent>
    </Card>
  )
}

function DemoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 1.5
    }
  }, [])

  return (
    <video ref={videoRef} className='w-full aspect-video' autoPlay loop muted playsInline>
      <source src='https://assets-cdn.querystudio.dev/QueryStudioExample.mp4' type='video/mp4' />
      Your browser does not support the video tag.
    </video>
  )
}

function ShortcutItem({ shortcut, description }: { shortcut: string; description: string }) {
  return (
    <div className='flex items-center gap-4'>
      <kbd className='px-3 py-1.5 bg-muted rounded-md font-mono text-sm min-w-[60px] text-center'>{shortcut}</kbd>
      <span className='text-muted-foreground'>{description}</span>
    </div>
  )
}
