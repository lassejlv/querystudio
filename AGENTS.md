# Agent Guidelines for QueryStudio

## Build Commands

### Root Project (Tauri Desktop App)

- `bun run dev` - Start Vite dev server for desktop app
- `bun run build` - Build desktop app (type check + vite build)
- `bun run preview` - Preview production build
- `bun run tauri` - Run Tauri CLI commands

### Web Project (Web App)

- `cd web && bun run dev` - Start web dev server
- `cd web && bun run build` - Build web app (runs migrations + vite build)
- `cd web && bun run start` - Start production server

## Lint/Test Commands

### Root Project

- `bun run lint` - Run oxlint on TypeScript files
- `bun run fmt` - Format code with oxfmt

### Web Project

- `cd web && bun run test` - Run vitest tests
- Run single test: `cd web && bun vitest run <path-to-test-file>`

### Rust (Tauri)

- `cd src-tauri && cargo build` - Build Rust code
- `cd src-tauri && cargo clippy` - Run Rust linter
- `cd src-tauri && cargo test` - Run Rust tests

## Package Manager

**Use Bun exclusively** - Do not use npm, yarn, or pnpm. All package management commands should use `bun`:

- `bun install` - Install dependencies
- `bun add <package>` - Add a dependency
- `bun add -d <package>` - Add a dev dependency
- `bun remove <package>` - Remove a dependency
- `bun run <script>` - Run package.json scripts

## Code Style Guidelines

### TypeScript/React

- Use strict TypeScript with `noUnusedLocals` and `noUnusedParameters`
- Path alias: `@/` maps to `./src/`
- React 19 with React Compiler enabled
- Use `type` keyword for type imports (e.g., `import type { Foo }`)

### Formatting (oxfmt)

- Uses oxfmt for formatting (not Prettier)
- Configuration in `.oxfmt.json`
- Experimental Tailwind CSS support enabled

### Linting (oxlint)

- Plugins: unicorn, typescript, oxc, react, eslint, react-perf
- All rules set to "warn" level
- Configuration in `.oxlintrc.json`

### Web Project Formatting

- Uses Prettier: no semicolons, single quotes, 200 print width
- Configuration in `web/.prettierrc.json`

### Naming Conventions

- React components: PascalCase (e.g., `Button.tsx`)
- Utilities/hooks: camelCase (e.g., `useStore.ts`)
- Types/interfaces: PascalCase with descriptive names
- Zustand stores: `use<Name>Store` pattern

### Imports

- Group imports: React, external libs, internal (@/), types
- Use `@/` alias for all internal imports
- Import React as namespace: `import * as React from "react"`

### Component Structure

- Use function declarations for components
- Destructure props in parameters
- Use `cn()` utility for className merging
- Use CVA (class-variance-authority) for variant components

### State Management

- Zustand for global state with persistence middleware
- React Query for server state
- URL state via TanStack Router

### Error Handling

- Use Result/Option patterns where appropriate
- Prefer early returns over nested conditionals
- Use TypeScript's strict null checks

## Project Structure

### Root (Desktop App)

```
src/
  components/     # React components
    ui/          # shadcn/ui components
  routes/        # TanStack Router routes
  lib/           # Utilities, stores, types
  hooks/         # Custom React hooks
```

### Web (Web App)

```
web/src/
  routes/        # API routes and pages
  components/    # Shared components
  server/        # Server-side code
  emails/        # React Email templates
  lib/           # Utilities
```

### Tauri (Rust)

```
src-tauri/src/
  main.rs        # Entry point
  lib.rs         # Library exports
  commands/      # Tauri commands
  database/      # Database adapters
```

## Key Technologies

- **Frontend**: React 19, TypeScript 5.9, TanStack Router/Query
- **Styling**: Tailwind CSS 4, shadcn/ui components
- **State**: Zustand, React Query
- **Desktop**: Tauri v2 (Rust)
- **Web**: Nitro, Hono, Drizzle ORM
- **Build**: Vite (rolldown-vite), Bun
- **Auth**: Better Auth
- **Testing**: Vitest (web only)

## Database Support

PostgreSQL, MySQL, SQLite, Redis, MongoDB

## Notes

- Desktop app runs on port 1420 (Tauri requirement)
- Web app uses Bun runtime
- React Compiler enabled for both projects
- No test files currently exist in root project

## Plugins System

QueryStudio has an experimental plugin system for creating custom tab plugins. See `src/plugins/README.md` for full documentation.

### Quick Reference

**Enabling Plugins:**

1. Go to **Settings > Experimental**
2. Enable **"Plugin System"**
3. A **"Plugins"** tab will appear in Settings

**Creating a Bundled Plugin:**

1. Create a new file in `src/plugins/` (e.g., `my-plugin.tsx`)
2. Export a `plugin` object with `type`, `displayName`, `icon`, and `getDefaultTitle`
3. Export a `Component` function that receives `TabContentProps`
4. Register in `src/plugins/index.ts`
5. Restart the app

**Plugin SDK:**
Use `usePluginSDK(connectionId, tabId, paneId)` hook to access:

- `sdk.connection` - Connection info and operations
- `sdk.api` - Database API functions (executeQuery, listTables, etc.)
- `sdk.utils` - Utilities (toast, clipboard, format, sql)
- `sdk.layout` - Tab operations (createTab, closeCurrentTab, updateTitle)

**Important:** Plugins are experimental and require app restart after changes.
