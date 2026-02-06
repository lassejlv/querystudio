import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import appCss from '../styles.css?url'
import { Toaster } from '@/components/ui/sonner'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'QueryStudio - Modern Database Studio',
      },
      {
        name: 'description',
        content: 'A modern, lightweight database studio built with Tauri, React, and Rust. Features AI-powered natural language queries, table browsing, and full CRUD operations.',
      },
      {
        name: 'keywords',
        content: 'database, SQL, Tauri, React, Rust, AI, GPT-4, PostgreSQL, MySQL, SQLite',
      },
      {
        property: 'og:title',
        content: 'QueryStudio - Modern Database Studio',
      },
      {
        property: 'og:description',
        content: 'A modern, lightweight database studio with AI-powered natural language queries.',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:image',
        content: 'https://assets-cdn.querystudio.dev/QueryStudioIconNoBG.png',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: 'QueryStudio - Modern Database Studio',
      },
      {
        name: 'twitter:description',
        content: 'A modern, lightweight database studio with AI-powered natural language queries.',
      },
      {
        name: 'twitter:image',
        content: 'https://assets-cdn.querystudio.dev/QueryStudioIconNoBG.png',
      },
    ],
    links: [
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@400;500;600;700&display=swap',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        href: 'https://assets-cdn.querystudio.dev/QueryStudioIconNoBG.png',
      },
      {
        rel: 'apple-touch-icon',
        href: 'https://assets-cdn.querystudio.dev/QueryStudioIconNoBG.png',
      },
    ],
    scripts: [
      {
        src: 'https://analytics.lassejlv.dk/script.js',
        'data-website-id': '31f1090c-9170-46df-aa85-59842cc2dfb1',
        async: true,
      },
    ],
  }),

  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient()

  return (
    <html lang='en' className='dark'>
      <head>
        <HeadContent />
      </head>
      <body className='antialiased'>
        <QueryClientProvider client={queryClient}>
          <Toaster theme='dark' />
          {children}
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
