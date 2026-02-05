# QueryStudio

Lightweight, open-source SQL studio built with Tauri, Rust, and React.

## What it does

- Connects to PostgreSQL, MySQL, SQLite, Redis, and MongoDB
- Lets you write and run queries in a modern editor
- Includes an AI assistant (QueryBuddy) for natural language to SQL
- Supports plugins (experimental)
- Runs on macOS, Windows, and Linux

## Stack

- Frontend: React 19, Tailwind CSS 4, TanStack Router/Query, Zustand
- Desktop backend: Rust with Tauri v2
- Build/runtime: Bun, Vite
- Web app: Nitro, Hono, Drizzle ORM, Better Auth

## Setup

Prerequisites:

- [Bun](https://bun.sh/)
- [Rust](https://www.rust-lang.org/)

Desktop app:

```bash
bun install
bun run tauri dev
```

Web app:

```bash
cd web
bun install
bun run dev
```

## Common commands

- `bun run dev` - Start desktop Vite dev server
- `bun run tauri dev` - Start Tauri desktop app
- `bun run tauri build` - Build desktop app
- `bun run lint` - Run oxlint
- `bun run fmt` - Format with oxfmt

## Contributing

1. Create a branch.
2. Run `bun run lint` and `bun run fmt`.
3. Open a pull request.

## License

[GNU AGPL v3](LICENSE)
