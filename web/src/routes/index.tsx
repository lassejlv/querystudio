import { useRef, useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/header'
import { Database, Table, Terminal, Shield, Download, Command, MousePointer, Check, Infinity as InfinityIcon, Bot } from 'lucide-react'
import { getPricing } from '@/server/pricing'

export const Route = createFileRoute('/')({
  component: LandingPage,
  loader: () => getPricing(),
})

function LandingPage() {
  const pricing = Route.useLoaderData()

  return (
    <div className='min-h-screen bg-background'>
      <Header />
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
              <Link to='/waitlist'>Waitlist</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section className='container mx-auto px-4 pb-24'>
        <div className='relative rounded-xl overflow-hidden shadow-2xl'>
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
            icon={<Bot className='h-6 w-6' />}
            title='Querybuddy'
            description='Ask Querybuddy in natural language and let him write the SQL for you. Explore your data without writing a single query.'
          />
          <FeatureCard
            icon={<MousePointer className='h-6 w-6' />}
            title='CRUD Operations'
            description='Add, edit, and delete rows with ease. Right-click context menus make data manipulation intuitive.'
          />
          <FeatureCard icon={<Shield className='h-6 w-6' />} title='Safe by Default' description='AI queries are read-only. Your data is never sent anywhere except to your configured OpenAI key.' />
        </div>
      </section>

      {/* Pricing Section */}
      <section id='pricing' className='container mx-auto px-4 py-24 border-t'>
        <div className='text-center mb-16'>
          <h2 className='text-3xl md:text-4xl font-bold mb-4'>Prices, you can overcome</h2>
          <p className='text-muted-foreground text-lg max-w-2xl mx-auto'>Start for free, then pay once and use it forever!</p>
        </div>

        <div className='grid md:grid-cols-2 gap-8 max-w-4xl mx-auto'>
          <Card className='relative'>
            <CardHeader>
              <CardTitle className='text-2xl'>{pricing.tiers.free.name}</CardTitle>
              <CardDescription>Perfect for getting started</CardDescription>
              <div className='mt-4'>
                <span className='text-4xl font-bold'>${pricing.tiers.free.price}</span>
                <span className='text-muted-foreground ml-2'>forever</span>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <PricingFeatureItem>{pricing.tiers.free.features.maxConnections} connections</PricingFeatureItem>
              <PricingFeatureItem>All features</PricingFeatureItem>
              <PricingFeatureItem>All dialects</PricingFeatureItem>
              <PricingFeatureItem>AI-agent (BYOK)</PricingFeatureItem>
            </CardContent>
            <CardFooter>
              <Button variant='outline' className='w-full' asChild>
                <Link to='/waitlist'>Join Waitlist</Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Pro Tier */}
          <Card className='relative border-primary'>
            <div className='absolute -top-3 left-1/2 -translate-x-1/2'>
              <span className='bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full'>Early Bird</span>
            </div>
            <CardHeader>
              <CardTitle className='text-2xl'>{pricing.tiers.pro.name}</CardTitle>
              <CardDescription>For power users and teams</CardDescription>
              <div className='mt-4'>
                <span className='text-4xl font-bold'>${pricing.tiers.pro.earlyBirdPrice}</span>
                <span className='text-muted-foreground ml-2 line-through'>${pricing.tiers.pro.price}</span>
                <span className='text-muted-foreground ml-2'>one-time</span>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <PricingFeatureItem>
                <InfinityIcon className='h-4 w-4 inline mr-1' />
                Unlimited connections
              </PricingFeatureItem>
              <PricingFeatureItem>All features</PricingFeatureItem>
              <PricingFeatureItem>All dialects</PricingFeatureItem>
              <PricingFeatureItem>AI-agent (BYOK)</PricingFeatureItem>
              <PricingFeatureItem>Priority support</PricingFeatureItem>
              <PricingFeatureItem>2 devices</PricingFeatureItem>
            </CardContent>
            <CardFooter>
              <Button className='w-full' asChild>
                <Link to='/waitlist'>Join Waitlist</Link>
              </Button>
            </CardFooter>
          </Card>
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
      <kbd className='px-3 py-1.5 bg-muted rounded-md font-mono text-sm min-w-15 text-center'>{shortcut}</kbd>
      <span className='text-muted-foreground'>{description}</span>
    </div>
  )
}

function PricingFeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex items-center gap-3'>
      <Check className='h-5 w-5 text-green-600 shrink-0' />
      <span className='text-sm'>{children}</span>
    </div>
  )
}
