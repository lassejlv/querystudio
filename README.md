# QueryStudio

<p align="center">
  <img src="app-icon.png" alt="QueryStudio Icon" width="120" height="120">
</p>

<p align="center">
  <strong>The open-source, lightweight SQL studio you deserve.</strong><br>
  Built with Tauri, Rust, and React 19.
</p>

---

## 🚀 Features

- **Multi-DB Support**: PostgreSQL, MySQL, SQLite, Redis, and MongoDB.
- **AI Assistant (QueryBuddy)**: Natural language to SQL using OpenAI, Gemini, or OpenRouter.
- **Modern Editor**: Syntax highlighting, autocomplete, and results export.
- **Built-in Terminal**: Full PTY terminal using your default shell.
- **Plugin System**: Experimental support for custom SQL formatters and data generators.
- **Cross-Platform**: Runs on macOS, Windows, and Linux.

## 🛠️ Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, TanStack Router/Query, Zustand.
- **Backend**: Rust (Tauri v2) with native database drivers.
- **Runtime/Build**: Bun, Vite.
- **Web App**: Nitro, Hono, Drizzle ORM, Better Auth.

## 🏁 Getting Started

### Prerequisites
- [Bun](https://bun.sh/)
- [Rust](https://www.rust-lang.org/)

### Quick Start (Desktop App)
```bash
# Install dependencies
bun install

# Start development mode
bun run tauri dev
```

### Web App
```bash
cd web
bun install
bun run dev
```

## 📜 Available Scripts

| Command | Action |
|---------|--------|
| `bun run dev` | Start Vite dev server |
| `bun run tauri dev` | Start Tauri development app |
| `bun run tauri build` | Build production desktop app |
| `bun run lint` | Run linter (oxlint) |
| `bun run fmt` | Format code (oxfmt) |

## 🤝 Contributing

1. Fork the repo and create your branch.
2. Ensure your code passes `bun run lint` and `bun run fmt`.
3. Open a Pull Request.

## 📄 License

[MIT](LICENSE) - Free for personal use.

---

<p align="center">
  Support development via <a href="https://github.com/sponsors/lassejlv">GitHub Sponsors</a>
</p>
