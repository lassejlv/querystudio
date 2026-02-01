import { createFileRoute, Link } from '@tanstack/react-router'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { ExternalLink, Download, Apple, Monitor, Terminal, Sparkles } from 'lucide-react'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useRef, useState } from 'react'
import { redis } from 'bun'

const donateUrl = 'https://buy.polar.sh/polar_cl_GjR7lflPCEnKKPTB2QE5eNOfWOLqlRNYJAvsF2Tf9t6'

interface FormattedAsset {
  name: string
  downloadUrl: string
  size: number
  downloadCount: number
  contentType: string
  platform: 'macos' | 'windows' | 'linux' | 'unknown'
  arch: 'x64' | 'arm64' | 'universal' | 'unknown'
}

interface FormattedRelease {
  id: number
  version: string
  name: string
  body: string
  isPrerelease: boolean
  createdAt: string
  publishedAt: string
  assets: FormattedAsset[]
  htmlUrl: string
}

const getLatestRelease = createServerFn({ method: 'GET' }).handler(async () => {
  const GITHUB_REPO = 'lassejlv/querystudio-releases'
  const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

  const cachedData = await redis.get('latest-release')

  if (cachedData) {
    return JSON.parse(cachedData) as FormattedRelease
  }

  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'QueryStudio-Web',
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error('Failed to fetch latest release')
    }

    const release = await response.json()

    const detectPlatform = (filename: string): FormattedAsset['platform'] => {
      const lower = filename.toLowerCase()
      if (lower.includes('.dmg') || lower.includes('macos') || lower.includes('darwin')) {
        return 'macos'
      }
      if (lower.includes('.exe') || lower.includes('.msi') || lower.includes('windows') || lower.includes('win32') || lower.includes('win64')) {
        return 'windows'
      }
      if (lower.includes('.deb') || lower.includes('.rpm') || lower.includes('.appimage') || lower.includes('linux')) {
        return 'linux'
      }
      return 'unknown'
    }

    const detectArch = (filename: string): FormattedAsset['arch'] => {
      const lower = filename.toLowerCase()
      if (lower.includes('universal')) {
        return 'universal'
      }
      if (lower.includes('arm64') || lower.includes('aarch64')) {
        return 'arm64'
      }
      if (lower.includes('x64') || lower.includes('x86_64') || lower.includes('amd64')) {
        return 'x64'
      }
      return 'unknown'
    }

    const data = {
      id: release.id,
      version: release.tag_name,
      name: release.name || release.tag_name,
      body: release.body || '',
      isPrerelease: release.prerelease,
      createdAt: release.created_at,
      publishedAt: release.published_at,
      htmlUrl: release.html_url,
      assets: release.assets.map((asset: { name: string; browser_download_url: string; size: number; download_count: number; content_type: string }) => ({
        name: asset.name,
        downloadUrl: asset.browser_download_url,
        size: asset.size,
        downloadCount: asset.download_count,
        contentType: asset.content_type,
        platform: detectPlatform(asset.name),
        arch: detectArch(asset.name),
      })),
    } as FormattedRelease

    await redis.set('latest-release', JSON.stringify(data), 'EX', 3600)

    return data
  } catch (error) {
    console.error('Error fetching latest release:', error)
    return null
  }
})

export const Route = createFileRoute('/download')({
  component: DownloadPage,
  loader: () => getLatestRelease(),
})

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function isSignatureFile(filename: string): boolean {
  return filename.endsWith('.sig') || filename.endsWith('.asc')
}

function getArchLabel(arch: FormattedAsset['arch']) {
  switch (arch) {
    case 'arm64':
      return 'Apple Silicon'
    case 'x64':
      return 'Intel'
    case 'universal':
      return 'Universal'
    default:
      return ''
  }
}

// Scroll reveal hook
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}

function DownloadPage() {
  const release = Route.useLoaderData()
  const [userPlatform, setUserPlatform] = useState<'macos' | 'windows' | 'linux' | null>(null)
  const cardsRef = useScrollReveal()

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('mac')) setUserPlatform('macos')
    else if (ua.includes('win')) setUserPlatform('windows')
    else if (ua.includes('linux') || ua.includes('x11')) setUserPlatform('linux')
  }, [])

  if (!release) {
    return (
      <div className='min-h-screen bg-background'>
        <Header />
        <main className='container mx-auto px-4 py-16'>
          <div className='max-w-xl mx-auto text-center'>
            <div className='w-16 h-16 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center'>
              <Download className='w-8 h-8 text-muted-foreground' />
            </div>
            <h1 className='text-2xl font-semibold mb-2'>Download</h1>
            <p className='mt-2 text-muted-foreground'>No releases available yet.</p>
            <div className='mt-6'>
              <Button variant='outline' asChild>
                <Link to='/' className='inline-flex items-center gap-2'>Back to home</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const macosAssets = release.assets.filter((a) => a.platform === 'macos' && !isSignatureFile(a.name))
  const windowsAssets = release.assets.filter((a) => a.platform === 'windows' && !isSignatureFile(a.name))
  const linuxAssets = release.assets.filter((a) => a.platform === 'linux' && !isSignatureFile(a.name))

  const PlatformIcon = ({ platform }: { platform: string }) => {
    switch (platform) {
      case 'macos':
        return <Apple className='w-6 h-6' />
      case 'windows':
        return <Monitor className='w-6 h-6' />
      case 'linux':
        return <Terminal className='w-6 h-6' />
      default:
        return <Download className='w-6 h-6' />
    }
  }

  return (
    <div className='min-h-screen bg-background'>
      <Header />

      <main className='container mx-auto px-4 py-16 max-w-5xl'>
        {/* Hero */}
        <div className='text-center mb-16'>
          <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm mb-6'>
            <Sparkles className='w-4 h-4' />
            <span>Latest Release</span>
          </div>
          
          <h1 className='text-4xl md:text-5xl font-bold mb-4'>Download QueryStudio</h1>
          <p className='text-xl text-muted-foreground'>
            Version <span className='font-mono text-primary'>{release.version}</span> · {' '}
            <time dateTime={release.publishedAt}>
              {new Date(release.publishedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </time>
          </p>
        </div>

        <div 
          ref={cardsRef.ref}
          className={`grid md:grid-cols-3 gap-6 mb-12 transition-all duration-1000 ${cardsRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* macOS */}
          <div className={`group relative p-6 rounded-2xl border bg-card hover-glow card-shine transition-all duration-300 ${userPlatform === 'macos' ? 'ring-2 ring-primary' : ''}`}>
            <div className='flex items-center justify-between mb-6'>
              <div className='flex items-center gap-3'>
                <div className='w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform'>
                  <PlatformIcon platform='macos' />
                </div>
                <div>
                  <h2 className='font-semibold text-lg'>macOS</h2>
                  <p className='text-sm text-muted-foreground'>10.15 or later</p>
                </div>
              </div>
              {userPlatform === 'macos' && (
                <span className='text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full animate-pulse'>
                  Your platform
                </span>
              )}
            </div>
            
            {macosAssets.length > 0 ? (
              <div className='space-y-2'>
                {macosAssets.map((asset) => (
                  <a 
                    key={asset.name} 
                    href={asset.downloadUrl} 
                    download 
                    className='flex items-center justify-between py-3 px-4 -mx-4 rounded-lg hover:bg-muted transition-all group/link'
                  >
                    <div className='flex items-center gap-3'>
                      <Download className='w-4 h-4 text-muted-foreground group-hover/link:text-primary transition-colors' />
                      <span className='font-medium'>{getArchLabel(asset.arch)}</span>
                    </div>
                    <span className='text-sm text-muted-foreground'>{formatBytes(asset.size)}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className='text-sm text-muted-foreground py-4'>Coming soon</p>
            )}
          </div>

          {/* Windows */}
          <div className={`group relative p-6 rounded-2xl border bg-card hover-glow card-shine transition-all duration-300 ${userPlatform === 'windows' ? 'ring-2 ring-primary' : ''}`}>
            <div className='flex items-center justify-between mb-6'>
              <div className='flex items-center gap-3'>
                <div className='w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform'>
                  <PlatformIcon platform='windows' />
                </div>
                <div>
                  <h2 className='font-semibold text-lg'>Windows</h2>
                  <p className='text-sm text-muted-foreground'>10 or later</p>
                </div>
              </div>
              {userPlatform === 'windows' && (
                <span className='text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full animate-pulse'>
                  Your platform
                </span>
              )}
            </div>
            
            {windowsAssets.length > 0 ? (
              <div className='space-y-2'>
                {windowsAssets.map((asset) => (
                  <a 
                    key={asset.name} 
                    href={asset.downloadUrl} 
                    download 
                    className='flex items-center justify-between py-3 px-4 -mx-4 rounded-lg hover:bg-muted transition-all group/link'
                  >
                    <div className='flex items-center gap-3'>
                      <Download className='w-4 h-4 text-muted-foreground group-hover/link:text-primary transition-colors' />
                      <span className='font-medium'>
                        {asset.name.endsWith('.exe') ? 'Installer' : asset.name.endsWith('.msi') ? 'MSI' : getArchLabel(asset.arch)}
                      </span>
                    </div>
                    <span className='text-sm text-muted-foreground'>{formatBytes(asset.size)}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className='text-sm text-muted-foreground py-4'>Coming soon</p>
            )}
          </div>

          {/* Linux */}
          <div className={`group relative p-6 rounded-2xl border bg-card hover-glow card-shine transition-all duration-300 ${userPlatform === 'linux' ? 'ring-2 ring-primary' : ''}`}>
            <div className='flex items-center justify-between mb-6'>
              <div className='flex items-center gap-3'>
                <div className='w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform'>
                  <PlatformIcon platform='linux' />
                </div>
                <div>
                  <h2 className='font-semibold text-lg'>Linux</h2>
                  <p className='text-sm text-muted-foreground'>Various distros</p>
                </div>
              </div>
              {userPlatform === 'linux' && (
                <span className='text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full animate-pulse'>
                  Your platform
                </span>
              )}
            </div>
            
            {linuxAssets.length > 0 ? (
              <div className='space-y-2'>
                {linuxAssets.map((asset) => (
                  <a 
                    key={asset.name} 
                    href={asset.downloadUrl} 
                    download 
                    className='flex items-center justify-between py-3 px-4 -mx-4 rounded-lg hover:bg-muted transition-all group/link'
                  >
                    <div className='flex items-center gap-3'>
                      <Download className='w-4 h-4 text-muted-foreground group-hover/link:text-primary transition-colors' />
                      <span className='font-medium'>
                        {asset.name.endsWith('.deb') ? 'Debian/Ubuntu' : asset.name.endsWith('.rpm') ? 'Fedora/RHEL' : asset.name.endsWith('.AppImage') ? 'AppImage' : getArchLabel(asset.arch)}
                      </span>
                    </div>
                    <span className='text-sm text-muted-foreground'>{formatBytes(asset.size)}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className='text-sm text-muted-foreground py-4'>Coming soon</p>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className='relative p-8 rounded-2xl bg-muted/30 border'>
          <div className='grid md:grid-cols-2 gap-8'>
            <div>
              <h3 className='font-semibold mb-3 flex items-center gap-2'>
                <Apple className='w-5 h-5' />
                macOS Note
              </h3>
              <p className='text-sm text-muted-foreground leading-relaxed'>
                The app isn't signed yet. Right-click and select "Open" on first launch to bypass Gatekeeper.
              </p>
              <a 
                href={donateUrl} 
                target='_blank' 
                rel='noopener noreferrer' 
                className='inline-flex items-center gap-1 text-sm mt-3 hover:underline text-primary'
              >
                Support signing <ExternalLink className='h-3 w-3' />
              </a>
            </div>
            
            <div>
              <h3 className='font-semibold mb-3'>Release Notes</h3>
              <p className='text-sm text-muted-foreground leading-relaxed mb-3'>
                View the full changelog and release notes on GitHub.
              </p>
              <a 
                href={release.htmlUrl} 
                target='_blank' 
                rel='noopener noreferrer' 
                className='inline-flex items-center gap-1 text-sm hover:underline text-primary'
              >
                View on GitHub <ExternalLink className='h-3 w-3' />
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
