# QueryStudio Plugins

This directory contains local tab plugins that extend QueryStudio's functionality.

## ⚠️ Experimental Feature

The plugin system is an **experimental feature**. To enable it:

1. Go to **Settings > Experimental**
2. Enable **"Plugin System"**
3. A new **"Plugins"** tab will appear in Settings

## How Plugins Work

QueryStudio supports two types of plugins:

1. **Bundled Plugins** - Shipped with the app in `src/plugins/`, registered at startup
2. **User Plugins** - Installed through Settings > Plugins, stored in localStorage

## Managing Plugins

### Installing Plugins

There are two ways to install a plugin:

#### Option 1: Import a File

1. Go to **Settings > Plugins**
2. Click **"Add Plugin"**
3. Select the **"Import File"** tab
4. Click to select a plugin file (`.tsx`, `.ts`, `.jsx`, or `.js`)
5. The plugin metadata will be extracted automatically if available
6. Review and complete any missing details
7. Click **"Add Plugin"**

#### Option 2: Manual Entry

1. Go to **Settings > Plugins**
2. Click **"Add Plugin"**
3. Select the **"Manual"** tab
4. Fill in the plugin details:
   - **Plugin Type**: Unique identifier (lowercase, no spaces, e.g., `my-custom-tab`)
   - **Display Name**: Human-readable name shown in the UI
   - **Icon**: Choose from available icons
   - **Description**: What the plugin does
   - **Author** and **Version**: Optional metadata
   - **Component Code**: Optional - paste the React component code
5. Click **"Add Plugin"**

### Enabling/Disabling Plugins

Toggle the switch next to any plugin to enable or disable it. **Restart the app** for changes to take effect.

### Uninstalling Plugins

Click the trash icon next to a user-installed plugin to remove it. Bundled plugins cannot be uninstalled.

## Plugin File Format

When importing a plugin file, you can include metadata in a special comment block:

```tsx
/* @plugin {
  "type": "my-custom-tab",
  "displayName": "My Custom Tab",
  "description": "A custom tab plugin",
  "author": "Your Name",
  "version": "1.0.0"
} */

import { useState } from "react";
import type { TabContentProps } from "@/lib/tab-sdk";

export function Component({ tabId, paneId, connectionId }: TabContentProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <h1>Hello from my custom tab!</h1>
    </div>
  );
}
```

If the `@plugin` comment is not present, the importer will try to extract `type` and `displayName` from the code.

## Creating a Bundled Plugin

To add a new bundled plugin that ships with QueryStudio:

### 1. Create Your Plugin File

Create a new file in this directory (e.g., `my-plugin.tsx`):

```tsx
import { useState } from "react";
import { Smile } from "lucide-react";
import type { TabPluginRegistration, TabContentProps } from "@/lib/tab-sdk";
import type { LocalPluginModule } from "@/lib/local-plugins";

// Plugin Definition
export const plugin: TabPluginRegistration = {
  type: "my-custom-tab",           // Unique identifier
  displayName: "My Custom Tab",    // Shown in UI
  icon: Smile,                     // Lucide icon
  getDefaultTitle: (index) => `My Tab ${index}`,
  canCreate: true,                 // Show in "New Tab" menu
  allowMultiple: true,             // Allow multiple instances
  priority: 50,                    // Menu ordering (higher = first)
  experimental: false,             // Require experimental flag?
};

// Tab Component - receives tab context props
export function Component({ tabId, paneId, connectionId }: TabContentProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <h1>Hello from my custom tab!</h1>
    </div>
  );
}

// Export as LocalPluginModule
const myPlugin: LocalPluginModule = { plugin, Component };
export default myPlugin;
```

### 2. Register Your Plugin

Add your plugin to `src/plugins/index.ts`:

```tsx
import myPlugin from "./my-plugin";

export const localPlugins: LocalPluginModule[] = [
  testTabPlugin,
  myPlugin,  // Add your plugin here
];
```

### 3. Restart the Application

Your new tab type will appear in the "+" menu in the tab bar and in Settings > Plugins as a bundled plugin.

## Plugin API Reference

### TabPluginRegistration

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `string` | Yes | Unique identifier for the tab type |
| `displayName` | `string` | Yes | Human-readable name shown in UI |
| `icon` | `LucideIcon` | Yes | Icon component from lucide-react |
| `getDefaultTitle` | `(index, metadata?) => string` | Yes | Generate default tab title |
| `canCreate` | `boolean` | No | Show in creation menu (default: true) |
| `allowMultiple` | `boolean` | No | Allow multiple instances (default: true) |
| `priority` | `number` | No | Menu order, higher = first (default: 0) |
| `experimental` | `boolean` | No | Require experimental flag (default: false) |
| `createShortcut` | `string` | No | Keyboard shortcut hint (e.g., "⌘T") |
| `lifecycle` | `TabLifecycleHooks` | No | Lifecycle callbacks |

### TabContentProps

Props passed to your Component:

| Prop | Type | Description |
|------|------|-------------|
| `tabId` | `string` | Unique ID of this tab instance |
| `paneId` | `string` | ID of the pane containing this tab |
| `connectionId` | `string` | ID of the current database connection |

### TabLifecycleHooks

Optional callbacks for tab lifecycle events:

```tsx
lifecycle: {
  onCreate: (tabId, metadata) => { /* Tab was created */ },
  onClose: (tabId, metadata) => { /* Tab was closed */ },
  onActivate: (tabId, metadata) => { /* Tab became active */ },
  onDeactivate: (tabId, metadata) => { /* Tab became inactive */ },
  onBeforeClose: (tabId, metadata) => boolean | Promise<boolean>,
}
```

### Available Icons

When adding a user plugin through Settings, you can choose from these icons:

| Icon Name | Description |
|-----------|-------------|
| `puzzle` | Default plugin icon |
| `flask` | For experimental/test plugins |
| `sparkles` | For AI/magic features |
| `zap` | For performance/quick actions |
| `star` | For favorites/highlights |
| `heart` | For social features |
| `rocket` | For deployment/launch features |
| `globe` | For web/network features |
| `code` | For code-related plugins |
| `terminal` | For CLI/terminal plugins |
| `file` | For file/document plugins |
| `database` | For data plugins |
| `settings` | For configuration plugins |
| `layout` | For layout/UI plugins |
| `box` | Generic container |

## Plugin SDK

The Plugin SDK provides plugins with access to QueryStudio's core functionality. Use the `usePluginSDK` hook in your plugin component:

```tsx
import { usePluginSDK } from "@/lib/plugin-sdk";

export function Component({ tabId, paneId, connectionId }: TabContentProps) {
  const sdk = usePluginSDK(connectionId, tabId, paneId);
  
  // Now you have access to:
  // - sdk.connection - Connection info and operations
  // - sdk.api - Database API functions
  // - sdk.utils - Utility functions
  // - sdk.layout - Tab/layout operations
}
```

### sdk.connection

Access to current database connection:

| Property/Method | Description |
|----------------|-------------|
| `isConnected` | Whether there's an active connection |
| `connection` | The connection object (or null) |
| `databaseType` | Database type (postgres, mysql, sqlite, etc.) |
| `tables` | Array of tables in the database |
| `selectedTable` | Currently selected table `{ schema, name }` |
| `selectTable(schema, name)` | Select a table |
| `clearSelection()` | Clear table selection |

### sdk.api

Database operations:

| Method | Description |
|--------|-------------|
| `executeQuery(sql)` | Execute a SQL query and return results |
| `listTables()` | Get list of all tables |
| `getTableColumns(schema, table)` | Get columns for a table |
| `getTableData(schema, table, limit?, offset?)` | Get table data with pagination |
| `getTableCount(schema, table)` | Get row count for a table |

### sdk.utils

Utility functions:

| Category | Methods |
|----------|---------|
| `toast` | `success()`, `error()`, `info()`, `warning()`, `loading()`, `dismiss()` |
| `clipboard` | `copy(text)`, `read()` |
| `format` | `number()`, `date()`, `bytes()`, `duration()` |
| `sql` | `escapeString()`, `escapeIdentifier()`, `format()` |

### sdk.layout

Tab operations:

| Method | Description |
|--------|-------------|
| `createTab(type, options?)` | Create a new tab |
| `closeCurrentTab()` | Close the current tab |
| `updateTitle(title)` | Update the current tab's title |
| `getTabs()` | Get all tabs in the current pane |

### Example: Query and Display Results

```tsx
const runQuery = async () => {
  if (!sdk.connection.isConnected) {
    sdk.utils.toast.error("Not connected");
    return;
  }
  
  try {
    const result = await sdk.api.executeQuery("SELECT * FROM users LIMIT 10");
    sdk.utils.toast.success(`Found ${result.results[0].row_count} rows`);
  } catch (error) {
    sdk.utils.toast.error(`Query failed: ${error}`);
  }
};
```

## Examples

See `test-tab.tsx` for a complete example with:
- Using the Plugin SDK to access connection data
- Executing queries through the API
- Using utility functions (toast, clipboard, formatting)
- Layout operations (creating tabs, updating title)
- Styling with Tailwind CSS
- Lifecycle hooks

## Security Warning

⚠️ **Only install plugins from sources you trust.** Plugins have access to:
- The React component tree
- localStorage and sessionStorage
- Network requests
- Any data visible in the application

Malicious plugins could potentially access or exfiltrate your data.

## Tips

1. **Styling**: Use existing Tailwind CSS classes and CSS variables for consistent theming
2. **Icons**: Import icons from `lucide-react` for consistency with the app
3. **State**: Use React hooks for local state, or create a Zustand store for complex state
4. **Backend**: Use `invoke` from `@tauri-apps/api/core` to call Rust backend functions
5. **Connection**: Use `connectionId` to scope data to the current database connection
6. **Restart Required**: After installing or modifying plugins, restart the app for changes to take effect