import { useState, useEffect, memo, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProviderIcon } from "@/components/ui/provider-icon";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { AIModelInfo } from "@/lib/types";
import {
  Key,
  Check,
  ExternalLink,
  AlertCircle,
  Github,
  FlaskConical,
  Search,
  Loader2,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface AISettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  experimentalOpencode: boolean;
  // Current values
  openaiApiKey: string;
  anthropicApiKey: string;
  googleApiKey: string;
  openrouterApiKey: string;
  vercelApiKey: string;
  copilotEnabled: boolean;
  opencodeUrl: string;
  // Save handler
  onSave: (settings: AISettingsValues) => void;
}

export interface AISettingsValues {
  openaiApiKey: string;
  anthropicApiKey: string;
  googleApiKey: string;
  openrouterApiKey: string;
  vercelApiKey: string;
  copilotEnabled: boolean;
  opencodeUrl: string;
}

// ============================================================================
// Provider Configuration
// ============================================================================

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  docsUrl?: string;
  placeholder?: string;
  helpText?: string;
  isToggle?: boolean;
  isExperimental?: boolean;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o, GPT-5, o1, o3, o4-mini and more",
    icon: "openai",
    docsUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-...",
    helpText: "Get your API key from the OpenAI dashboard",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude 3.5, Claude 4 Sonnet/Opus",
    icon: "anthropic",
    docsUrl: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-...",
    helpText: "Get your API key from the Anthropic console",
  },
  {
    id: "google",
    name: "Google AI",
    description: "Gemini 2.5 Pro, Gemini 2.5 Flash",
    icon: "google",
    docsUrl: "https://aistudio.google.com/app/apikey",
    placeholder: "AIza...",
    helpText: "Get your API key from Google AI Studio",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access 100+ models via one API",
    icon: "openrouter",
    docsUrl: "https://openrouter.ai/keys",
    placeholder: "sk-or-...",
    helpText: "Unified API for Claude, DeepSeek, Llama, and more",
  },
  {
    id: "vercel",
    name: "Vercel AI Gateway",
    description: "Route to multiple providers",
    icon: "vercel",
    docsUrl: "https://vercel.com/docs/ai/ai-sdk-gateway",
    placeholder: "sk-...",
    helpText: "Use Vercel's AI Gateway for unified access",
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    description: "Use your Copilot subscription",
    icon: "copilot",
    docsUrl:
      "https://docs.github.com/en/copilot/using-github-copilot/using-github-copilot-in-the-command-line",
    helpText: "Requires Copilot CLI. Run: gh extension install github/gh-copilot",
    isToggle: true,
  },
  {
    id: "opencode",
    name: "OpenCode",
    description: "Connect to local OpenCode server",
    icon: "opencode",
    placeholder: "http://127.0.0.1:4096",
    helpText: "Experimental: OpenCode uses its own tools",
    isExperimental: true,
  },
];

// ============================================================================
// Sidebar Item Component
// ============================================================================

interface SidebarItemProps {
  provider: ProviderConfig;
  isActive: boolean;
  isConfigured: boolean;
  modelCount?: number;
  onClick: () => void;
}

const SidebarItem = memo(function SidebarItem({
  provider,
  isActive,
  isConfigured,
  modelCount,
  onClick,
}: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
          isActive
            ? "border-primary/30 bg-primary/10"
            : "border-border/50 bg-background group-hover:border-border",
        )}
      >
        {provider.id === "copilot" ? (
          <Github className="h-4 w-4" />
        ) : (
          <ProviderIcon provider={provider.icon} size={16} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{provider.name}</span>
          {provider.isExperimental && <FlaskConical className="h-3 w-3 text-amber-500" />}
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          {isConfigured && modelCount !== undefined
            ? `${modelCount} models available`
            : provider.description}
        </p>
      </div>
      {isConfigured && (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
          <Check className="h-3 w-3 text-emerald-500" />
        </div>
      )}
    </button>
  );
});

// ============================================================================
// Model List Component
// ============================================================================

interface ModelListProps {
  models: AIModelInfo[];
  isLoading: boolean;
  error?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const ModelList = memo(function ModelList({
  models,
  isLoading,
  error,
  searchQuery,
  onSearchChange,
}: ModelListProps) {
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    const query = searchQuery.toLowerCase();
    return models.filter(
      (m) => m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query),
    );
  }, [models, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading models...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
        <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="mt-2 text-sm text-muted-foreground">No models found</p>
        <p className="text-xs text-muted-foreground/70">
          Enter your API key above to fetch available models
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search models..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <ScrollArea className="h-50 rounded-lg border border-border/50 bg-muted/10">
        <div className="p-2 space-y-1">
          {filteredModels.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No models match "{searchQuery}"
            </p>
          ) : (
            filteredModels.map((model) => (
              <div
                key={model.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
              >
                <ProviderIcon provider={model.logo_provider || model.provider} size={14} />
                <span className="flex-1 truncate">{model.name}</span>
                <span className="text-[10px] text-muted-foreground">{model.id}</span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      <p className="text-[11px] text-muted-foreground">
        {filteredModels.length} of {models.length} models
      </p>
    </div>
  );
});

// ============================================================================
// Provider Form Component
// ============================================================================

interface ProviderFormProps {
  provider: ProviderConfig;
  value: string;
  onChange: (value: string) => void;
  isToggle?: boolean;
  toggleValue?: boolean;
  onToggleChange?: (value: boolean) => void;
  models: AIModelInfo[];
  isLoadingModels: boolean;
  modelsError?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const ProviderForm = memo(function ProviderForm({
  provider,
  value,
  onChange,
  isToggle,
  toggleValue,
  onToggleChange,
  models,
  isLoadingModels,
  modelsError,
  searchQuery,
  onSearchChange,
}: ProviderFormProps) {
  const isConfigured = isToggle ? toggleValue : !!value.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl border",
            "border-border/50 bg-muted/30",
          )}
        >
          {provider.id === "copilot" ? (
            <Github className="h-6 w-6" />
          ) : (
            <ProviderIcon provider={provider.icon} size={24} />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{provider.name}</h3>
            {provider.isExperimental && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                Experimental
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{provider.description}</p>
        </div>
      </div>

      {/* Configuration */}
      <div className="space-y-4">
        {isToggle ? (
          <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Enable {provider.name}</Label>
                <p className="text-xs text-muted-foreground">{provider.helpText}</p>
              </div>
              <Switch checked={toggleValue} onCheckedChange={onToggleChange} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor={`${provider.id}-key`} className="flex items-center gap-2">
                <Key className="h-3.5 w-3.5 text-muted-foreground" />
                {provider.id === "opencode" ? "Server URL" : "API Key"}
              </Label>
              <div className="relative">
                <Input
                  id={`${provider.id}-key`}
                  type={provider.id === "opencode" ? "text" : "password"}
                  placeholder={provider.placeholder}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="pr-10"
                />
                {value && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Check className="h-4 w-4 text-emerald-500" />
                  </div>
                )}
              </div>
            </div>

            {provider.helpText && (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                {provider.helpText}
              </p>
            )}
          </div>
        )}

        {provider.isExperimental && provider.id === "opencode" && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              OpenCode uses its own tools. QueryStudio database tools are not available when using
              this provider.
            </p>
          </div>
        )}

        {provider.docsUrl && (
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            View documentation
          </a>
        )}
      </div>

      {/* Available Models */}
      {isConfigured && (
        <div className="space-y-3 border-t border-border/50 pt-6">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium">Available Models</h4>
          </div>
          <ModelList
            models={models}
            isLoading={isLoadingModels}
            error={modelsError}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
          />
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Model Fetching Hook
// ============================================================================

interface UseProviderModelsResult {
  models: AIModelInfo[];
  isLoading: boolean;
  error?: string;
}

function useProviderModels(
  providerId: string,
  apiKey: string,
  isEnabled: boolean,
): UseProviderModelsResult {
  const [models, setModels] = useState<AIModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!isEnabled || !apiKey.trim()) {
      setModels([]);
      setError(undefined);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(undefined);

    const fetchModels = async () => {
      try {
        let result: AIModelInfo[] = [];
        switch (providerId) {
          case "openai":
            result = await api.aiFetchOpenAIModels(apiKey);
            break;
          case "anthropic":
            result = await api.aiFetchAnthropicModels(apiKey);
            break;
          case "google":
            result = await api.aiFetchGeminiModels(apiKey);
            break;
          case "openrouter":
            result = await api.aiFetchOpenRouterModels(apiKey);
            break;
          case "vercel":
            result = await api.aiFetchVercelModels(apiKey);
            break;
          case "copilot":
            result = await api.aiFetchCopilotModels();
            break;
          case "opencode":
            result = await api.aiFetchOpenCodeModels(apiKey);
            break;
        }
        if (!cancelled) {
          setModels(result);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch models");
          setModels([]);
          setIsLoading(false);
        }
      }
    };

    fetchModels();

    return () => {
      cancelled = true;
    };
  }, [providerId, apiKey, isEnabled]);

  return { models, isLoading, error };
}

// ============================================================================
// Main Modal Component
// ============================================================================

export const AISettingsModal = memo(function AISettingsModal({
  open,
  onOpenChange,
  experimentalOpencode,
  openaiApiKey,
  anthropicApiKey,
  googleApiKey,
  openrouterApiKey,
  vercelApiKey,
  copilotEnabled,
  opencodeUrl,
  onSave,
}: AISettingsModalProps) {
  // Local state for editing
  const [tempOpenaiKey, setTempOpenaiKey] = useState(openaiApiKey);
  const [tempAnthropicKey, setTempAnthropicKey] = useState(anthropicApiKey);
  const [tempGoogleKey, setTempGoogleKey] = useState(googleApiKey);
  const [tempOpenrouterKey, setTempOpenrouterKey] = useState(openrouterApiKey);
  const [tempVercelKey, setTempVercelKey] = useState(vercelApiKey);
  const [tempCopilotEnabled, setTempCopilotEnabled] = useState(copilotEnabled);
  const [tempOpencodeUrl, setTempOpencodeUrl] = useState(opencodeUrl);
  const [activeProvider, setActiveProvider] = useState("openai");
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});

  // Fetch models for each provider
  const openaiModels = useProviderModels("openai", tempOpenaiKey, !!tempOpenaiKey.trim());
  const anthropicModels = useProviderModels(
    "anthropic",
    tempAnthropicKey,
    !!tempAnthropicKey.trim(),
  );
  const googleModels = useProviderModels("google", tempGoogleKey, !!tempGoogleKey.trim());
  const openrouterModels = useProviderModels(
    "openrouter",
    tempOpenrouterKey,
    !!tempOpenrouterKey.trim(),
  );
  const vercelModels = useProviderModels("vercel", tempVercelKey, !!tempVercelKey.trim());
  const copilotModels = useProviderModels("copilot", "enabled", tempCopilotEnabled);
  const opencodeModels = useProviderModels("opencode", tempOpencodeUrl, !!tempOpencodeUrl.trim());

  // Reset state when modal opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setTempOpenaiKey(openaiApiKey);
      setTempAnthropicKey(anthropicApiKey);
      setTempGoogleKey(googleApiKey);
      setTempOpenrouterKey(openrouterApiKey);
      setTempVercelKey(vercelApiKey);
      setTempCopilotEnabled(copilotEnabled);
      setTempOpencodeUrl(opencodeUrl);
      setSearchQueries({});
    }
    onOpenChange(newOpen);
  };

  const handleSave = () => {
    onSave({
      openaiApiKey: tempOpenaiKey,
      anthropicApiKey: tempAnthropicKey,
      googleApiKey: tempGoogleKey,
      openrouterApiKey: tempOpenrouterKey,
      vercelApiKey: tempVercelKey,
      copilotEnabled: tempCopilotEnabled,
      opencodeUrl: tempOpencodeUrl,
    });
    onOpenChange(false);
  };

  // Check if any provider is configured
  const isProviderConfigured = (providerId: string): boolean => {
    switch (providerId) {
      case "openai":
        return !!tempOpenaiKey.trim();
      case "anthropic":
        return !!tempAnthropicKey.trim();
      case "google":
        return !!tempGoogleKey.trim();
      case "openrouter":
        return !!tempOpenrouterKey.trim();
      case "vercel":
        return !!tempVercelKey.trim();
      case "copilot":
        return tempCopilotEnabled;
      case "opencode":
        return !!tempOpencodeUrl.trim();
      default:
        return false;
    }
  };

  // Get model count for provider
  const getModelCount = (providerId: string): number | undefined => {
    if (!isProviderConfigured(providerId)) return undefined;
    switch (providerId) {
      case "openai":
        return openaiModels.models.length || undefined;
      case "anthropic":
        return anthropicModels.models.length || undefined;
      case "google":
        return googleModels.models.length || undefined;
      case "openrouter":
        return openrouterModels.models.length || undefined;
      case "vercel":
        return vercelModels.models.length || undefined;
      case "copilot":
        return copilotModels.models.length || undefined;
      case "opencode":
        return opencodeModels.models.length || undefined;
      default:
        return undefined;
    }
  };

  // Get models result for provider
  const getModelsResult = (providerId: string): UseProviderModelsResult => {
    switch (providerId) {
      case "openai":
        return openaiModels;
      case "anthropic":
        return anthropicModels;
      case "google":
        return googleModels;
      case "openrouter":
        return openrouterModels;
      case "vercel":
        return vercelModels;
      case "copilot":
        return copilotModels;
      case "opencode":
        return opencodeModels;
      default:
        return { models: [], isLoading: false };
    }
  };

  // Get value for provider
  const getProviderValue = (providerId: string): string => {
    switch (providerId) {
      case "openai":
        return tempOpenaiKey;
      case "anthropic":
        return tempAnthropicKey;
      case "google":
        return tempGoogleKey;
      case "openrouter":
        return tempOpenrouterKey;
      case "vercel":
        return tempVercelKey;
      case "opencode":
        return tempOpencodeUrl;
      default:
        return "";
    }
  };

  // Set value for provider
  const setProviderValue = (providerId: string, value: string) => {
    switch (providerId) {
      case "openai":
        setTempOpenaiKey(value);
        break;
      case "anthropic":
        setTempAnthropicKey(value);
        break;
      case "google":
        setTempGoogleKey(value);
        break;
      case "openrouter":
        setTempOpenrouterKey(value);
        break;
      case "vercel":
        setTempVercelKey(value);
        break;
      case "opencode":
        setTempOpencodeUrl(value);
        break;
    }
  };

  // Filter providers based on experimental flag
  const visibleProviders = PROVIDERS.filter((p) => !p.isExperimental || experimentalOpencode);

  const activeProviderConfig = visibleProviders.find((p) => p.id === activeProvider);
  const activeModelsResult = getModelsResult(activeProvider);

  const configuredCount = visibleProviders.filter((p) => isProviderConfigured(p.id)).length;

  const canSave =
    tempOpenaiKey.trim() ||
    tempAnthropicKey.trim() ||
    tempGoogleKey.trim() ||
    tempOpenrouterKey.trim() ||
    tempVercelKey.trim() ||
    tempCopilotEnabled ||
    tempOpencodeUrl.trim();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-225 gap-0 overflow-hidden p-0">
        <div className="flex h-150">
          {/* Sidebar */}
          <div className="flex w-80 shrink-0 flex-col border-r border-border/50 bg-muted/20">
            <div className="border-b border-border/50 px-4 py-4">
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-base">AI Providers</DialogTitle>
                <DialogDescription className="text-xs">
                  {configuredCount} of {visibleProviders.length} configured
                </DialogDescription>
              </DialogHeader>
            </div>
            <ScrollArea className="flex-1 px-2 py-2">
              <div className="space-y-1">
                {visibleProviders.map((provider) => (
                  <SidebarItem
                    key={provider.id}
                    provider={provider}
                    isActive={activeProvider === provider.id}
                    isConfigured={isProviderConfigured(provider.id)}
                    modelCount={getModelCount(provider.id)}
                    onClick={() => setActiveProvider(provider.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col">
            <ScrollArea className="flex-1 px-6 py-6">
              {activeProviderConfig && (
                <ProviderForm
                  provider={activeProviderConfig}
                  value={getProviderValue(activeProviderConfig.id)}
                  onChange={(v) => setProviderValue(activeProviderConfig.id, v)}
                  isToggle={activeProviderConfig.isToggle}
                  toggleValue={tempCopilotEnabled}
                  onToggleChange={setTempCopilotEnabled}
                  models={activeModelsResult.models}
                  isLoadingModels={activeModelsResult.isLoading}
                  modelsError={activeModelsResult.error}
                  searchQuery={searchQueries[activeProvider] || ""}
                  onSearchChange={(q) =>
                    setSearchQueries((prev) => ({ ...prev, [activeProvider]: q }))
                  }
                />
              )}
            </ScrollArea>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border/50 bg-muted/10 px-6 py-4">
              <p className="text-xs text-muted-foreground">
                API keys are stored locally in your browser
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={!canSave}>
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
