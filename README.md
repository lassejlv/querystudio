# QueryStudio

The open-source lightweight SQL-studio that you deserve. Built with Tauri + Rust + React

## Features

- Modern SQL editor with syntax highlighting and autocomplete
- Support for multiple database connections (PostgreSQL, SQLite)
- Built-in terminal for query output
- Clean, minimal UI with customizable themes
- Cross-platform desktop app via Tauri

## Prerequisites

- [Bun](https://bun.sh/) - JavaScript runtime and package manager
- [Rust](https://www.rust-lang.org/) - Required for Tauri

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run tauri dev
```

## Building

```bash
# Build for production
bun run tauri build
```

## Scripts

| Command               | Description              |
| --------------------- | ------------------------ |
| `bun run tauri dev`   | Start development server |
| `bun run tauri build` | Build production app     |
| `bun run lint`        | Run linter (oxlint)      |
| `bun run fmt`         | Format code (oxfmt)      |

## Sponsoring

If you find QueryStudio useful, consider supporting its development:

- [GitHub Sponsors](https://github.com/sponsors/lassejlv)

Your support helps keep the project alive and enables new features!
