# QueryStudio

<p align="center">
  <img src="app-icon.png" alt="QueryStudio Icon" width="120" height="120">
</p>

<p align="center">
  <strong>A modern, AI-powered database IDE for developers</strong>
</p>

<p align="center">
  Built with Tauri + Rust + React 19
</p>

---

## Features

### Multi-Database Support
QueryStudio supports 5 database types out of the box:

- **PostgreSQL** - Full support with advanced features
- **MySQL** - Complete compatibility
- **SQLite** - Bundled, no external dependencies
- **Redis** - Custom console interface with key inspector
- **MongoDB** - Document operations and aggregation support

### AI Assistant (QueryBuddy)
Supercharge your workflow with built-in AI:

- **Natural Language to SQL** - Ask questions in plain English
- **Multiple AI Providers** - OpenAI, Google Gemini, OpenRouter, Vercel AI Gateway
- **Smart Data Exploration** - AI automatically discovers tables and schemas
- **Read-Only Safety** - AI can only execute SELECT queries for security
- **Streaming Responses** - Real-time chat interface

### Modern SQL Editor
- Syntax highlighting and autocomplete
- Error detection and suggestions
- Multiple query execution
- Results export

### Built-in Terminal
- Full PTY terminal using your default shell
- Proper environment setup (Homebrew, etc.)
- Query output and logs

### Plugin System (Experimental)
- **SQL Formatter** - Format queries with multiple dialects
- **Data Generator** - Generate fake data using Faker.js
- **Custom Plugins** - Build and install your own plugins

### Additional Features
- Clean, minimal UI with customizable themes
- Split-pane resizable layout
- Tab persistence across sessions
- Command palette for quick navigation
- Cross-platform: macOS, Windows, Linux

---

## Architecture

QueryStudio consists of two main components:

### Desktop App (Root)
The main database IDE built as a Tauri application:
- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Backend**: Rust with native database drivers
- **State**: Zustand + TanStack Query
- **Editor**: Monaco Editor
- **Terminal**: xterm.js + portable-pty

### Web App (`web/`)
Companion web application for SaaS features:
- **Framework**: TanStack Start (React + Nitro)
- **Auth**: Better Auth (email/password + GitHub OAuth)
- **Billing**: Polar.sh subscriptions
- **Features**: Downloads, license management, waitlist

---

## Prerequisites

- [Bun](https://bun.sh/) - JavaScript runtime and package manager
- [Rust](https://www.rust-lang.org/) - Required for Tauri
- [PostgreSQL](https://www.postgresql.org/) - Only needed for web app development

---

## Development

### Desktop App

```bash
# Install dependencies
bun install

# Run in development mode
bun run tauri dev
```

### Web App

```bash
# Navigate to web directory
cd web

# Install dependencies
bun install

# Run development server
bun run dev
```

---

## Building

### Desktop App

```bash
# Build for production
bun run tauri build
```

### Web App

```bash
cd web
bun run build
```

---

## Scripts

### Desktop App

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Vite dev server |
| `bun run build` | Build for production |
| `bun run tauri dev` | Start Tauri development mode |
| `bun run tauri build` | Build desktop app for distribution |
| `bun run lint` | Run linter (oxlint) |
| `bun run fmt` | Format code (oxfmt) |

### Web App

| Command | Description |
|---------|-------------|
| `cd web && bun run dev` | Start web dev server |
| `cd web && bun run build` | Build web app (runs migrations + vite build) |
| `cd web && bun run start` | Start production server |
| `cd web && bun run test` | Run vitest tests |

---

## AI Configuration

To use the AI Assistant, configure one or more providers in Settings:

1. **OpenAI** - Add your API key
2. **Google Gemini** - Add your API key
3. **OpenRouter** - Add your API key for access to Claude and other models
4. **Vercel AI Gateway** - Configure gateway URL and authentication

---

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code passes linting and formatting checks:

```bash
bun run lint
bun run fmt
```

---

## Sponsoring

If you find QueryStudio useful, consider supporting its development:

- [GitHub Sponsors](https://github.com/sponsors/lassejlv)

Your support helps keep the project alive and enables new features!

---

## License

[MIT](LICENSE) - Free for personal use. Pro license available for commercial use with unlimited connections.
