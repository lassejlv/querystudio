import { createFileRoute, Link } from '@tanstack/react-router'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
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

function DownloadPage() {
  const release = Route.useLoaderData()
  const [userPlatform, setUserPlatform] = useState<'macos' | 'windows' | 'linux' | null>(null)

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
          <h1 className='text-2xl font-semibold'>Download</h1>
          <p className='mt-2 text-muted-foreground'>No releases available yet.</p>
          <div className='mt-6'>
            <Button variant='outline' asChild>
              <Link to='/'>Back to home</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const macosAssets = release.assets.filter((a) => a.platform === 'macos' && !isSignatureFile(a.name))
  const windowsAssets = release.assets.filter((a) => a.platform === 'windows' && !isSignatureFile(a.name))
  const linuxAssets = release.assets.filter((a) => a.platform === 'linux' && !isSignatureFile(a.name))

  return (
    <div className='min-h-screen bg-background'>
      <Header />

      <main className='container mx-auto px-4 py-16 max-w-4xl'>
        <div className='mb-12'>
          <h1 className='text-2xl font-semibold'>Download QueryStudio</h1>
          <p className='mt-1 text-muted-foreground'>
            Version {release.version} · {new Date(release.publishedAt).toLocaleDateString()}
          </p>
        </div>

        <div className='grid md:grid-cols-3 gap-8 mb-10'>
          {/* macOS */}
          <section>
            <div className='flex items-center gap-2 mb-4'>
              <h2 className='font-medium'>macOS</h2>
              {userPlatform === 'macos' && <span className='text-xs bg-muted px-2 py-0.5 rounded'>Your platform</span>}
            </div>
            {macosAssets.length > 0 ? (
              <div className='space-y-2'>
                {macosAssets.map((asset) => (
                  <a key={asset.name} href={asset.downloadUrl} download className='flex items-center justify-between py-2 px-3 -mx-3 rounded hover:bg-muted transition-colors'>
                    <span>{getArchLabel(asset.arch)}</span>
                    <span className='text-sm text-muted-foreground'>{formatBytes(asset.size)}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className='text-sm text-muted-foreground'>Coming soon</p>
            )}
          </section>

          {/* Windows */}
          <section>
            <div className='flex items-center gap-2 mb-4'>
              <h2 className='font-medium'>Windows</h2>
              {userPlatform === 'windows' && <span className='text-xs bg-muted px-2 py-0.5 rounded'>Your platform</span>}
            </div>
            {windowsAssets.length > 0 ? (
              <div className='space-y-2'>
                {windowsAssets.map((asset) => (
                  <a key={asset.name} href={asset.downloadUrl} download className='flex items-center justify-between py-2 px-3 -mx-3 rounded hover:bg-muted transition-colors'>
                    <span>{asset.name.endsWith('.exe') ? 'Installer' : asset.name.endsWith('.msi') ? 'MSI' : getArchLabel(asset.arch)}</span>
                    <span className='text-sm text-muted-foreground'>{formatBytes(asset.size)}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className='text-sm text-muted-foreground'>Coming soon</p>
            )}
          </section>

          {/* Linux */}
          <section>
            <div className='flex items-center gap-2 mb-4'>
              <h2 className='font-medium'>Linux</h2>
              {userPlatform === 'linux' && <span className='text-xs bg-muted px-2 py-0.5 rounded'>Your platform</span>}
            </div>
            {linuxAssets.length > 0 ? (
              <div className='space-y-2'>
                {linuxAssets.map((asset) => (
                  <a key={asset.name} href={asset.downloadUrl} download className='flex items-center justify-between py-2 px-3 -mx-3 rounded hover:bg-muted transition-colors'>
                    <span>
                      {asset.name.endsWith('.deb') ? 'Debian/Ubuntu' : asset.name.endsWith('.rpm') ? 'Fedora/RHEL' : asset.name.endsWith('.AppImage') ? 'AppImage' : getArchLabel(asset.arch)}
                    </span>
                    <span className='text-sm text-muted-foreground'>{formatBytes(asset.size)}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className='text-sm text-muted-foreground'>Coming soon</p>
            )}
          </section>
        </div>

        <hr className='my-10' />

        {/* Notes */}
        <section className='mb-10'>
          <h2 className='font-medium mb-3'>macOS note</h2>
          <p className='text-sm text-muted-foreground leading-relaxed'>The app isn't signed yet. Right-click and select "Open" on first launch to bypass Gatekeeper.</p>
          <a href={donateUrl} target='_blank' rel='noopener noreferrer' className='inline-flex items-center gap-1 text-sm mt-2 hover:underline'>
            Support signing <ExternalLink className='h-3 w-3' />
          </a>
        </section>

        <section>
          <a href={release.htmlUrl} target='_blank' rel='noopener noreferrer' className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'>
            View release notes on GitHub <ExternalLink className='h-3 w-3' />
          </a>
        </section>
      </main>
    </div>
  )
}
