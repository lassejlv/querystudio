import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Theme, ThemeRegistry } from "./themes";
import defaultTheme from "../themes/default.json";
import darkTheme from "../themes/dark.json";
import tokyonightTheme from "../themes/tokyonight.json";
import onedarkTheme from "../themes/onedark.json";
import githubDarkTheme from "../themes/github-dark.json";
import rosePineTheme from "../themes/rose-pine.json";
import catppuccinTheme from "../themes/catppuccin.json";
import vesperTheme from "../themes/vesper.json";

// Built-in themes
const BUILTIN_THEMES: Record<string, Theme> = {
  default: defaultTheme as Theme,
  dark: darkTheme as Theme,
  tokyonight: tokyonightTheme as Theme,
  onedark: onedarkTheme as Theme,
  "github-dark": githubDarkTheme as Theme,
  "rose-pine": rosePineTheme as Theme,
  catppuccin: catppuccinTheme as Theme,
  vesper: vesperTheme as Theme,
};

interface ThemeState extends ThemeRegistry {
  // Theme management
  setActiveTheme: (themeId: string) => void;
  getActiveTheme: () => Theme;
  getAllThemes: () => Theme[];
  getTheme: (themeId: string) => Theme | null;

  // Custom theme management
  addCustomTheme: (theme: Theme) => void;
  removeCustomTheme: (themeId: string) => void;
  importTheme: (themeJson: string) => { success: boolean; error?: string };
  exportTheme: (themeId: string) => string | null;

  // Theme application
  applyTheme: (theme: Theme) => void;
  refreshTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      // Initial state
      themes: { ...BUILTIN_THEMES },
      activeTheme: "dark",
      customThemes: {},

      // Theme management
      setActiveTheme: (themeId: string) => {
        const { themes, applyTheme } = get();
        const theme = themes[themeId];

        if (!theme) {
          console.error(`Theme "${themeId}" not found`);
          return;
        }

        set({ activeTheme: themeId });
        applyTheme(theme);
      },

      getActiveTheme: () => {
        const { themes, activeTheme } = get();
        return themes[activeTheme] || themes.default;
      },

      getAllThemes: () => {
        const { themes } = get();
        return Object.values(themes);
      },

      getTheme: (themeId: string) => {
        const { themes } = get();
        return themes[themeId] || null;
      },

      // Custom theme management
      addCustomTheme: (theme: Theme) => {
        set((state) => ({
          themes: {
            ...state.themes,
            [theme.id]: theme,
          },
          customThemes: {
            ...state.customThemes,
            [theme.id]: theme,
          },
        }));
      },

      removeCustomTheme: (themeId: string) => {
        const { activeTheme } = get();

        // Don't allow removing built-in themes
        if (BUILTIN_THEMES[themeId]) {
          console.error(`Cannot remove built-in theme "${themeId}"`);
          return;
        }

        // Switch to default theme if removing active theme
        if (activeTheme === themeId) {
          get().setActiveTheme("default");
        }

        set((state) => {
          const newThemes = { ...state.themes };
          const newCustomThemes = { ...state.customThemes };

          delete newThemes[themeId];
          delete newCustomThemes[themeId];

          return {
            themes: newThemes,
            customThemes: newCustomThemes,
          };
        });
      },

      importTheme: (themeJson: string) => {
        try {
          const theme: Theme = JSON.parse(themeJson);

          // Validate theme structure
          if (!theme.id || !theme.name || !theme.colors) {
            return { success: false, error: "Invalid theme structure" };
          }

          // Mark as custom theme
          theme.isBuiltIn = false;

          // Add or override theme
          get().addCustomTheme(theme);

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to parse theme JSON",
          };
        }
      },

      exportTheme: (themeId: string) => {
        const { getTheme } = get();
        const theme = getTheme(themeId);

        if (!theme) {
          return null;
        }

        return JSON.stringify(theme, null, 2);
      },

      // Theme application
      applyTheme: (theme: Theme) => {
        if (typeof document === "undefined") return;

        const root = document.documentElement;
        const colors = theme.colors;

        // Apply CSS custom properties
        root.style.setProperty("--background", colors.background);
        root.style.setProperty("--foreground", colors.foreground);
        root.style.setProperty("--card", colors.card);
        root.style.setProperty("--card-foreground", colors.cardForeground);
        root.style.setProperty("--popover", colors.popover);
        root.style.setProperty("--popover-foreground", colors.popoverForeground);
        root.style.setProperty("--primary", colors.primary);
        root.style.setProperty("--primary-foreground", colors.primaryForeground);
        root.style.setProperty("--secondary", colors.secondary);
        root.style.setProperty("--secondary-foreground", colors.secondaryForeground);
        root.style.setProperty("--muted", colors.muted);
        root.style.setProperty("--muted-foreground", colors.mutedForeground);
        root.style.setProperty("--accent", colors.accent);
        root.style.setProperty("--accent-foreground", colors.accentForeground);
        root.style.setProperty("--destructive", colors.destructive);
        root.style.setProperty("--border", colors.border);
        root.style.setProperty("--input", colors.input);
        root.style.setProperty("--ring", colors.ring);
        root.style.setProperty("--chart-1", colors.chart1);
        root.style.setProperty("--chart-2", colors.chart2);
        root.style.setProperty("--chart-3", colors.chart3);
        root.style.setProperty("--chart-4", colors.chart4);
        root.style.setProperty("--chart-5", colors.chart5);
        root.style.setProperty("--sidebar", colors.sidebar);
        root.style.setProperty("--sidebar-foreground", colors.sidebarForeground);
        root.style.setProperty("--sidebar-primary", colors.sidebarPrimary);
        root.style.setProperty("--sidebar-primary-foreground", colors.sidebarPrimaryForeground);
        root.style.setProperty("--sidebar-accent", colors.sidebarAccent);
        root.style.setProperty("--sidebar-accent-foreground", colors.sidebarAccentForeground);
        root.style.setProperty("--sidebar-border", colors.sidebarBorder);
        root.style.setProperty("--sidebar-ring", colors.sidebarRing);

        // Update dark mode class
        if (theme.isDark) {
          root.classList.add("dark");
          document.body.classList.add("dark");
        } else {
          root.classList.remove("dark");
          document.body.classList.remove("dark");
        }
      },

      refreshTheme: () => {
        const { getActiveTheme, applyTheme } = get();
        const activeTheme = getActiveTheme();
        applyTheme(activeTheme);
      },
    }),
    {
      name: "querystudio_themes",
      partialize: (state) => ({
        activeTheme: state.activeTheme,
        customThemes: state.customThemes,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.customThemes) {
          // Merge custom themes back into the themes object
          state.themes = {
            ...BUILTIN_THEMES,
            ...state.customThemes,
          };
        }
      },
    },
  ),
);

// Initialize theme on app load
if (typeof document !== "undefined") {
  const themeStore = useThemeStore.getState();
  themeStore.refreshTheme();
}
