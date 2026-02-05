import { memo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ProviderIconProps {
  provider: string;
  className?: string;
  size?: number;
}

// Map provider names to models.dev logo names
const PROVIDER_LOGO_MAP: Record<string, string> = {
  openai: "openai",
  anthropic: "anthropic",
  google: "google",
  openrouter: "openrouter",
  vercel: "vercel",
  deepseek: "deepseek",
  meta: "meta",
  "meta-llama": "meta",
  mistral: "mistral",
  mistralai: "mistral",
  cohere: "cohere",
  perplexity: "perplexity",
  groq: "groq",
  together: "together",
  fireworks: "fireworks",
  replicate: "replicate",
  huggingface: "huggingface",
  aws: "aws",
  azure: "azure",
  bedrock: "bedrock",
  alibaba: "alibaba",
  qwen: "qwen",
  x: "x",
  "x-ai": "x",
  xai: "x",
  nvidia: "nvidia",
};

// Cache for fetched SVG content
const svgCache = new Map<string, string | null>();

// Pending fetches to avoid duplicate requests
const pendingFetches = new Map<string, Promise<string | null>>();

async function fetchSvg(provider: string): Promise<string | null> {
  const logoName = PROVIDER_LOGO_MAP[provider.toLowerCase()] || provider.toLowerCase();
  const cacheKey = logoName;

  // Check cache first
  if (svgCache.has(cacheKey)) {
    return svgCache.get(cacheKey) ?? null;
  }

  // Check if there's already a pending fetch
  if (pendingFetches.has(cacheKey)) {
    return pendingFetches.get(cacheKey)!;
  }

  // Start new fetch
  const fetchPromise = (async () => {
    try {
      const url = `https://models.dev/logos/${logoName}.svg`;
      const response = await fetch(url, {
        mode: "cors",
        credentials: "omit",
      });
      if (!response.ok) {
        console.warn(`[ProviderIcon] Failed to fetch ${url}: ${response.status}`);
        svgCache.set(cacheKey, null);
        return null;
      }
      const svgText = await response.text();
      // Validate it's actually an SVG
      if (!svgText.includes("<svg")) {
        console.warn(`[ProviderIcon] Invalid SVG response from ${url}`);
        svgCache.set(cacheKey, null);
        return null;
      }
      svgCache.set(cacheKey, svgText);
      return svgText;
    } catch (error) {
      console.warn(`[ProviderIcon] Error fetching logo for ${logoName}:`, error);
      svgCache.set(cacheKey, null);
      return null;
    } finally {
      pendingFetches.delete(cacheKey);
    }
  })();

  pendingFetches.set(cacheKey, fetchPromise);
  return fetchPromise;
}

export const ProviderIcon = memo(function ProviderIcon({
  provider,
  className = "",
  size = 16,
}: ProviderIconProps) {
  const [svg, setSvg] = useState<string | null>(() => {
    const logoName = PROVIDER_LOGO_MAP[provider.toLowerCase()] || provider.toLowerCase();
    return svgCache.get(logoName) ?? null;
  });
  const [loading, setLoading] = useState(!svg);

  useEffect(() => {
    let cancelled = false;

    const logoName = PROVIDER_LOGO_MAP[provider.toLowerCase()] || provider.toLowerCase();

    // If already cached, use it immediately
    if (svgCache.has(logoName)) {
      setSvg(svgCache.get(logoName) ?? null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchSvg(provider).then((result) => {
      if (!cancelled) {
        setSvg(result);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [provider]);

  if (loading) {
    // Return a placeholder with the same dimensions while loading
    return (
      <div
        className={cn("rounded-sm bg-muted/30 animate-pulse", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  if (!svg) {
    // No icon available - return nothing or a generic icon placeholder
    return null;
  }

  // Inject size into the SVG and ensure color inheritance works
  // Replace width/height and add fill="currentColor" to ensure visibility
  const processedSvg = svg
    .replace(/width="[^"]*"/, `width="${size}"`)
    .replace(/height="[^"]*"/, `height="${size}"`);

  return (
    <span
      className={cn("inline-flex items-center justify-center shrink-0", className)}
      style={{
        width: size,
        height: size,
        color: "currentColor",
      }}
      dangerouslySetInnerHTML={{ __html: processedSvg }}
    />
  );
});

// Preload common provider icons
export function preloadProviderIcons() {
  const commonProviders = [
    "openai",
    "anthropic",
    "google",
    "openrouter",
    "vercel",
    "deepseek",
    "meta",
    "mistral",
    "alibaba",
    "qwen",
    "x",
    "nvidia",
    "cohere",
  ];
  commonProviders.forEach((provider) => {
    fetchSvg(provider);
  });
}
