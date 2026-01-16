import { createFileRoute } from '@tanstack/react-router'
import { Hono } from 'hono/tiny'
import { cors } from 'hono/cors'

const GITHUB_REPO = 'lassejlv/querystudio-releases'
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`

interface GitHubAsset {
  name: string
  browser_download_url: string
  size: number
  download_count: number
  content_type: string
}

interface GitHubRelease {
  id: number
  tag_name: string
  name: string
  body: string
  draft: boolean
  prerelease: boolean
  created_at: string
  published_at: string
  assets: GitHubAsset[]
  html_url: string
}

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

function detectPlatform(filename: string): FormattedAsset['platform'] {
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

function detectArch(filename: string): FormattedAsset['arch'] {
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

function formatRelease(release: GitHubRelease): FormattedRelease {
  return {
    id: release.id,
    version: release.tag_name,
    name: release.name || release.tag_name,
    body: release.body || '',
    isPrerelease: release.prerelease,
    createdAt: release.created_at,
    publishedAt: release.published_at,
    htmlUrl: release.html_url,
    assets: release.assets.map((asset) => ({
      name: asset.name,
      downloadUrl: asset.browser_download_url,
      size: asset.size,
      downloadCount: asset.download_count,
      contentType: asset.content_type,
      platform: detectPlatform(asset.name),
      arch: detectArch(asset.name),
    })),
  }
}

const app = new Hono()
  .use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET'],
    }),
  )
  .get('/latest', async (c) => {
    try {
      const response = await fetch(`${GITHUB_API_URL}/latest`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'QueryStudio-Web',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return c.json({ error: 'No releases found' }, 404)
        }
        return c.json({ error: 'Failed to fetch latest release' }, response.status as 400)
      }

      const release: GitHubRelease = await response.json()
      return c.json(formatRelease(release))
    } catch (error) {
      console.error('Error fetching latest release:', error)
      return c.json({ error: 'Failed to fetch latest release' }, 500)
    }
  })
  .get('/all', async (c) => {
    try {
      const response = await fetch(GITHUB_API_URL, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'QueryStudio-Web',
        },
      })

      if (!response.ok) {
        return c.json({ error: 'Failed to fetch releases' }, response.status as 400)
      }

      const releases: GitHubRelease[] = await response.json()
      return c.json(releases.map(formatRelease))
    } catch (error) {
      console.error('Error fetching releases:', error)
      return c.json({ error: 'Failed to fetch releases' }, 500)
    }
  })
  .basePath('/api/downloads')

export const Route = createFileRoute('/api/downloads/$')({
  server: {
    handlers: {
      GET: ({ request }) => app.fetch(request),
    },
  },
})
