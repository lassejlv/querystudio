import { invoke, isTauri } from "@tauri-apps/api/core";

const DEFAULT_APP_FONT_FAMILY =
  '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const MAX_CUSTOM_FONT_FAMILY_LENGTH = 200;

const FALLBACK_FONT_FAMILIES = [
  "Geist",
  "SF Pro Text",
  "SF Pro Display",
  "Segoe UI",
  "Inter",
  "Roboto",
  "Helvetica Neue",
  "Arial",
  "Noto Sans",
  "Ubuntu",
  "Cantarell",
  "Source Sans 3",
  "Fira Sans",
  "JetBrains Mono",
  "Fira Code",
  "IBM Plex Sans",
  "IBM Plex Serif",
  "Avenir Next",
  "Avenir",
  "Proxima Nova",
  "Lato",
  "Open Sans",
  "Montserrat",
  "Poppins",
  "Merriweather",
  "Georgia",
  "Times New Roman",
  "Menlo",
  "Monaco",
  "Consolas",
  "Courier New",
];

type LocalFontRecord = {
  family?: string;
};

type FontQueryWindow = Window & {
  queryLocalFonts?: () => Promise<LocalFontRecord[]>;
};

export type FontDiscoveryResult = {
  families: string[];
  source: "local" | "fallback";
};

type FontDiscoveryOptions = {
  forceRefresh?: boolean;
};

let cachedFontDiscovery: FontDiscoveryResult | null = null;

function sortFontFamilies(families: Set<string>): string[] {
  return Array.from(families).sort((a, b) => a.localeCompare(b));
}

export function getFallbackFontFamilies(): string[] {
  return [...FALLBACK_FONT_FAMILIES];
}

export async function discoverFontFamilies(
  options?: FontDiscoveryOptions,
): Promise<FontDiscoveryResult> {
  if (!options?.forceRefresh && cachedFontDiscovery) {
    return cachedFontDiscovery;
  }

  const allFamilies = new Set(FALLBACK_FONT_FAMILIES);
  let hasLocalFonts = false;

  if (typeof window === "undefined") {
    return {
      families: sortFontFamilies(allFamilies),
      source: "fallback",
    };
  }

  if (isTauri()) {
    try {
      const commandName = options?.forceRefresh
        ? "refresh_local_fonts_cache"
        : "list_local_fonts";
      const localFamilies = await invoke<string[]>(commandName);
      for (const familyName of localFamilies) {
        const family = normalizeCustomFontFamily(familyName);
        if (family) {
          allFamilies.add(family);
          hasLocalFonts = true;
        }
      }

      if (hasLocalFonts) {
        const result: FontDiscoveryResult = {
          families: sortFontFamilies(allFamilies),
          source: "local",
        };
        cachedFontDiscovery = result;
        return result;
      }
    } catch {
      // Fall through to browser API and fallback list.
    }
  }

  const fontWindow = window as FontQueryWindow;
  if (!fontWindow.queryLocalFonts) {
    const result: FontDiscoveryResult = {
      families: sortFontFamilies(allFamilies),
      source: hasLocalFonts ? "local" : "fallback",
    };
    cachedFontDiscovery = result;
    return result;
  }

  try {
    const localFonts = await fontWindow.queryLocalFonts();
    for (const font of localFonts) {
      const family = normalizeCustomFontFamily(font.family || "");
      if (family) {
        allFamilies.add(family);
        hasLocalFonts = true;
      }
    }

    const result: FontDiscoveryResult = {
      families: sortFontFamilies(allFamilies),
      source: hasLocalFonts || localFonts.length > 0 ? "local" : "fallback",
    };
    cachedFontDiscovery = result;
    return result;
  } catch {
    const result: FontDiscoveryResult = {
      families: sortFontFamilies(allFamilies),
      source: hasLocalFonts ? "local" : "fallback",
    };
    cachedFontDiscovery = result;
    return result;
  }
}

export function normalizeCustomFontFamily(fontFamily: string): string {
  return fontFamily
    .replace(/[{};\n\r\t]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, MAX_CUSTOM_FONT_FAMILY_LENGTH);
}

export function buildAppFontFamily(customFontFamily: string): string {
  const normalized = normalizeCustomFontFamily(customFontFamily);
  if (!normalized) {
    return DEFAULT_APP_FONT_FAMILY;
  }

  return `${normalized}, ${DEFAULT_APP_FONT_FAMILY}`;
}

export function applyCustomFontFamily(customFontFamily: string): void {
  if (typeof document === "undefined") return;

  document.documentElement.style.setProperty(
    "--app-font-family",
    buildAppFontFamily(customFontFamily),
  );
}
