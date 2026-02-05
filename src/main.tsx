import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./main.css";
import "./lib/theme-store";
import { initializeSettingsStore } from "./lib/settings-store";
import { registerBuiltInPlugins } from "./lib/tab-sdk";
import { registerTabComponents } from "./lib/register-tab-components";
import {
  registerLocalPlugins,
  trackBundledPlugin,
  registerImportedPlugins,
} from "./lib/local-plugins";
import { localPlugins } from "./plugins";

// Initialize Tab SDK with built-in plugins
registerBuiltInPlugins();

// Register React components for built-in tab types
registerTabComponents();

// Register bundled local plugins (e.g., test-tab)
registerLocalPlugins(localPlugins);

// Track bundled plugins in the plugin store for UI display
localPlugins.forEach((plugin) => trackBundledPlugin(plugin));

// Register user-imported plugins from the plugin store
registerImportedPlugins();
void initializeSettingsStore();

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
