import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'

import appCss from '../styles.css?url'

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
        title: 'QueryStudio - Modern PostgreSQL Client',
      },
      {
        name: 'description',
        content: 'A modern, lightweight PostgreSQL client built with Tauri, React, and Rust. Features AI-powered natural language queries, table browsing, and full CRUD operations.',
      },
      {
        name: 'keywords',
        content: 'PostgreSQL, database client, SQL, Tauri, React, Rust, AI, GPT-4',
      },
      {
        property: 'og:title',
        content: 'QueryStudio - Modern PostgreSQL Client',
      },
      {
        property: 'og:description',
        content: 'A modern, lightweight PostgreSQL client with AI-powered natural language queries.',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: 'QueryStudio - Modern PostgreSQL Client',
      },
      {
        name: 'twitter:description',
        content: 'A modern, lightweight PostgreSQL client with AI-powered natural language queries.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
      },
    ],
    scripts: [
      {
        src: 'https://analytics.lasse.services/script.js',
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
  return (
    <html lang='en'>
      <head>
        <HeadContent />
      </head>
      <body className='antialiased'>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
