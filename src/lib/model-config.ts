import type { ModelId } from "@/lib/ai-agent";
import type { AIModelInfo } from "@/lib/types";

// ============================================================================
// Storage Keys
// ============================================================================

export const OPENAI_API_KEY_STORAGE_KEY = "querystudio_openai_api_key";
export const ANTHROPIC_API_KEY_STORAGE_KEY = "querystudio_anthropic_api_key";
export const GOOGLE_API_KEY_STORAGE_KEY = "querystudio_google_api_key";
export const OPENROUTER_API_KEY_STORAGE_KEY = "querystudio_openrouter_api_key";
export const VERCEL_API_KEY_STORAGE_KEY = "querystudio_vercel_api_key";
export const COPILOT_ENABLED_STORAGE_KEY = "querystudio_copilot_enabled";
export const OPENCODE_URL_STORAGE_KEY = "querystudio_opencode_url";
export const SELECTED_MODEL_KEY = "querystudio_selected_model";

// ============================================================================
// Types
// ============================================================================

export type ProviderKeys = {
  openai: string;
  anthropic: string;
  google: string;
  openrouter: string;
  vercel: string;
  copilot: string;
  opencode: string;
};

// ============================================================================
// Provider & API Key Helpers
// ============================================================================

export function getProviderForModel(model: ModelId, allModels: AIModelInfo[]): string {
  return allModels.find((m) => m.id === model)?.provider ?? "openai";
}

export function getApiKeyForModel(
  model: ModelId,
  allModels: AIModelInfo[],
  keys: ProviderKeys,
): string {
  const provider = getProviderForModel(model, allModels);
  if (provider === "anthropic") return keys.anthropic;
  if (provider === "google") return keys.google;
  if (provider === "openrouter") return keys.openrouter;
  if (provider === "vercel") return keys.vercel;
  if (provider === "copilot") return keys.copilot;
  if (provider === "opencode") return keys.opencode;
  return keys.openai;
}

export function isModelAvailable(
  model: ModelId,
  allModels: AIModelInfo[],
  keys: ProviderKeys,
): boolean {
  const key = getApiKeyForModel(model, allModels, keys);
  return !!key.trim();
}

// ============================================================================
// Context Token Estimation
// ============================================================================

export const DEFAULT_MODEL_MAX_CONTEXT_TOKENS = 128_000;

export function inferModelMaxContextTokens(modelId: string, provider?: string): number {
  const id = modelId.toLowerCase();
  const normalizedProvider = provider?.toLowerCase();

  // OpenAI family
  if (id === "gpt-5" || id === "gpt-5-mini") return 400_000;
  if (
    id.startsWith("gpt-4.1") ||
    id.startsWith("gpt-4o") ||
    id.startsWith("o1") ||
    id.startsWith("o3") ||
    id.startsWith("o4")
  ) {
    return 128_000;
  }

  // Anthropic family
  if (id.includes("claude")) return 200_000;

  // Gemini family
  if (id.includes("gemini-2.5") || id.includes("gemini-3")) return 1_000_000;

  // OpenRouter/Vercel/Copilot are mixed catalogs; keep a safe fallback.
  if (
    normalizedProvider === "openrouter" ||
    normalizedProvider === "vercel" ||
    normalizedProvider === "copilot"
  ) {
    if (id.includes("claude")) return 200_000;
    if (id.includes("gemini")) return 1_000_000;
    return DEFAULT_MODEL_MAX_CONTEXT_TOKENS;
  }

  // Provider-level defaults
  if (normalizedProvider === "google") return 1_000_000;
  if (normalizedProvider === "anthropic") return 200_000;
  if (normalizedProvider === "openai") return 128_000;

  return DEFAULT_MODEL_MAX_CONTEXT_TOKENS;
}

// ============================================================================
// Token Estimation Utilities
// ============================================================================

import type { Message, ToolCall } from "@/lib/ai-agent";

export function estimateTextTokens(text: string): number {
  if (!text) return 0;
  // UTF-8 bytes / 4 gives a reasonable rough token estimate across providers.
  const byteLength = new TextEncoder().encode(text).length;
  return Math.max(1, Math.round(byteLength / 4));
}

export function estimateToolCallsTokens(toolCalls?: ToolCall[]): number {
  if (!toolCalls?.length) return 0;
  let total = 0;
  for (const tc of toolCalls) {
    total += estimateTextTokens(tc.name);
    total += estimateTextTokens(tc.arguments);
    total += estimateTextTokens(tc.result ?? "");
    total += 12; // structural overhead
  }
  return total;
}

export function estimateMessageTokens(message: Pick<Message, "content" | "toolCalls">): number {
  return estimateTextTokens(message.content) + estimateToolCallsTokens(message.toolCalls) + 8;
}

export function estimateConversationTokens(messages: Message[]): number {
  return messages.reduce((sum, message) => sum + estimateMessageTokens(message), 18);
}

// ============================================================================
// Formatting Utilities
// ============================================================================

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}

export function getContextUsageColorClass(percent: number): string {
  if (percent >= 90) return "text-red-500";
  if (percent >= 75) return "text-amber-500";
  return "text-emerald-500";
}
