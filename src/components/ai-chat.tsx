import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { useLayoutStore } from "@/lib/layout-store";
import { motion } from "framer-motion";
import {
  Send,
  Bot,
  Settings,
  Trash2,
  Wrench,
  Plus,
  MessageSquare,
  Copy,
  Check,
  ChevronsUpDown,
  PlayCircle,
  History,
  RotateCcw,
  Loader,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useConnectionStore, useAIQueryStore, useLastChatStore } from "@/lib/store";
import {
  AIAgent,
  AI_MODELS,
  type Message,
  type ModelId,
  type ChatSession,
  type ToolCall,
  loadChatHistory,
  saveChatHistory,
  createChatSession,
  generateSessionTitle,
} from "@/lib/ai-agent";
import { api } from "@/lib/api";
import type { AIModelInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProviderIcon, preloadProviderIcons } from "@/components/ui/provider-icon";
import { Badge } from "./ui/badge";

const OPENAI_API_KEY_STORAGE_KEY = "querystudio_openai_api_key";
const ANTHROPIC_API_KEY_STORAGE_KEY = "querystudio_anthropic_api_key";
const GOOGLE_API_KEY_STORAGE_KEY = "querystudio_google_api_key";
const OPENROUTER_API_KEY_STORAGE_KEY = "querystudio_openrouter_api_key";
const VERCEL_API_KEY_STORAGE_KEY = "querystudio_vercel_api_key";
const COPILOT_ENABLED_STORAGE_KEY = "querystudio_copilot_enabled";
const SELECTED_MODEL_KEY = "querystudio_selected_model";

type ProviderKeys = {
  openai: string;
  anthropic: string;
  google: string;
  openrouter: string;
  vercel: string;
  copilot: string;
};

function getProviderForModel(model: ModelId, allModels: AIModelInfo[]): string {
  return allModels.find((m) => m.id === model)?.provider ?? "openai";
}

function getApiKeyForModel(model: ModelId, allModels: AIModelInfo[], keys: ProviderKeys): string {
  const provider = getProviderForModel(model, allModels);
  if (provider === "anthropic") return keys.anthropic;
  if (provider === "google") return keys.google;
  if (provider === "openrouter") return keys.openrouter;
  if (provider === "vercel") return keys.vercel;
  if (provider === "copilot") return keys.copilot;
  return keys.openai;
}

function isModelAvailable(model: ModelId, allModels: AIModelInfo[], keys: ProviderKeys): boolean {
  const key = getApiKeyForModel(model, allModels, keys);
  return !!key.trim();
}

// ============================================================================
// Memoized Code Block Component
// ============================================================================

// Props interface for CodeBlock to receive callbacks from parent
interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
  onAppendToRunner: (code: string) => void;
}

const CodeBlock = memo(function CodeBlock({
  children,
  className,
  onAppendToRunner,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const language = className?.replace("language-", "") || "";
  const isSql = language === "sql" || language === "pgsql" || language === "postgresql";
  const code = String(children).replace(/\n$/, "");

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleAppendToRunner = useCallback(() => {
    onAppendToRunner(code);
  }, [code, onAppendToRunner]);

  return (
    <div className="relative group my-1.5 rounded-md overflow-hidden border border-border/40">
      <div className="flex items-center justify-between bg-muted/40 px-2 py-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          {language || "code"}
        </span>
        <div className="flex items-center gap-1.5">
          {isSql && (
            <button
              onClick={handleAppendToRunner}
              className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors font-medium"
            >
              <PlayCircle className="h-3 w-3" />
              Run
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-green-500" />
                <span className="text-green-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: "0.75rem",
          lineHeight: "1.4",
          padding: "0.5rem",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
});

// ============================================================================
// Memoized Inline Code Component
// ============================================================================

const InlineCode = memo(function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted px-1.5 py-0.5 rounded text-primary text-sm font-mono">
      {children}
    </code>
  );
});

// ============================================================================
// Streaming Text Component with Typewriter Effect
// ============================================================================

interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
  markdownComponents: Record<
    string,
    React.ComponentType<{ children?: React.ReactNode; className?: string }>
  >;
}

const StreamingText = memo(function StreamingText({
  content,
  isStreaming,
  markdownComponents,
}: StreamingTextProps) {
  const [displayedLength, setDisplayedLength] = useState(content.length);
  const prevContentRef = useRef(content);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // If content grew, animate the new characters
    if (content.length > prevContentRef.current.length && isStreaming) {
      const startLength = prevContentRef.current.length;
      const targetLength = content.length;
      const charsToAnimate = targetLength - startLength;

      // Animate faster for larger chunks, slower for small ones
      const charsPerFrame = Math.max(1, Math.ceil(charsToAnimate / 8));
      let currentLength = startLength;

      const animate = () => {
        currentLength = Math.min(currentLength + charsPerFrame, targetLength);
        setDisplayedLength(currentLength);

        if (currentLength < targetLength) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      // Cancel any existing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      animationRef.current = requestAnimationFrame(animate);
    } else if (!isStreaming) {
      // When streaming stops, show full content immediately
      setDisplayedLength(content.length);
    }

    prevContentRef.current = content;

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [content, isStreaming]);

  // Reset when content resets (new message)
  useEffect(() => {
    if (content.length < displayedLength) {
      setDisplayedLength(content.length);
      prevContentRef.current = content;
    }
  }, [content, displayedLength]);

  const displayedContent = content.slice(0, displayedLength);

  return (
    <div className="text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {displayedContent}
      </ReactMarkdown>
      {isStreaming && <span className="streaming-cursor" />}
    </div>
  );
});

// ============================================================================
// Memoized Message Component
// ============================================================================

interface MessageBubbleProps {
  message: Message;
  onAppendToRunner: (code: string) => void;
}

const ToolThinkingSkeleton = memo(function ToolThinkingSkeleton() {
  return (
    <div className="mt-2 space-y-1.5">
      <div className="h-2 w-40 rounded bg-muted/60 animate-pulse" />
      <div className="h-2 w-56 rounded bg-muted/50 animate-pulse" />
      <div className="h-2 w-32 rounded bg-muted/40 animate-pulse" />
    </div>
  );
});

const TOOL_PAYLOAD_MAX_CHARS = 6000;

function formatToolPayload(payload?: string): string {
  if (!payload || !payload.trim()) {
    return "No data.";
  }

  const trimmed = payload.trim();
  let formatted = trimmed;

  try {
    const parsed = JSON.parse(trimmed);
    formatted = JSON.stringify(parsed, null, 2);
  } catch {
    // Keep raw payload if not JSON.
  }

  if (formatted.length > TOOL_PAYLOAD_MAX_CHARS) {
    return `${formatted.slice(0, TOOL_PAYLOAD_MAX_CHARS)}\n\n…truncated`;
  }

  return formatted;
}

const ToolCallChip = memo(function ToolCallChip({ toolCall }: { toolCall: ToolCall }) {
  const formattedArguments = useMemo(
    () => formatToolPayload(toolCall.arguments),
    [toolCall.arguments],
  );
  const formattedResult = useMemo(() => formatToolPayload(toolCall.result), [toolCall.result]);
  const isCompleted = toolCall.result !== undefined;
  const toolName = toolCall.name?.trim() || "Tool Call";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/35 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          title="Click to inspect tool logs"
        >
          <Wrench className="h-2.5 w-2.5" />
          <span>{toolName}</span>
          {isCompleted ? (
            <span className="text-emerald-400">done</span>
          ) : (
            <span className="text-amber-400">running</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[460px] max-w-[calc(100vw-2rem)] space-y-2 p-3"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{toolName}</p>
          <span className="font-mono text-[10px] text-muted-foreground">#{toolCall.id}</span>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Arguments
          </p>
          <pre className="max-h-40 overflow-auto rounded-md border border-border/60 bg-muted/25 p-2 font-mono text-[11px] leading-relaxed">
            {formattedArguments}
          </pre>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Result
          </p>
          <pre className="max-h-44 overflow-auto rounded-md border border-border/60 bg-muted/25 p-2 font-mono text-[11px] leading-relaxed">
            {formattedResult}
          </pre>
        </div>
      </PopoverContent>
    </Popover>
  );
});

const MessageBubble = memo(function MessageBubble({
  message,
  onAppendToRunner,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  // Memoize the markdown components to ensure stable references
  // This prevents React from seeing different component trees during streaming
  const markdownComponents = useMemo(
    () => ({
      // Code blocks
      code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
        const isBlock = className?.includes("language-") || String(children).includes("\n");
        if (isBlock) {
          return (
            <CodeBlock className={className} onAppendToRunner={onAppendToRunner}>
              {children}
            </CodeBlock>
          );
        }
        return <InlineCode {...props}>{children}</InlineCode>;
      },
      pre({ children }: { children?: React.ReactNode }) {
        return <>{children}</>;
      },
      // Headings
      h1({ children }: { children?: React.ReactNode }) {
        return (
          <h1 className="text-lg font-semibold text-foreground mt-4 mb-2 first:mt-0">{children}</h1>
        );
      },
      h2({ children }: { children?: React.ReactNode }) {
        return (
          <h2 className="text-base font-semibold text-foreground mt-3 mb-1.5 first:mt-0">
            {children}
          </h2>
        );
      },
      h3({ children }: { children?: React.ReactNode }) {
        return (
          <h3 className="text-sm font-semibold text-foreground mt-2.5 mb-1 first:mt-0">
            {children}
          </h3>
        );
      },
      h4({ children }: { children?: React.ReactNode }) {
        return (
          <h4 className="text-sm font-medium text-foreground mt-2 mb-1 first:mt-0">{children}</h4>
        );
      },
      // Paragraphs
      p({ children }: { children?: React.ReactNode }) {
        return <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0">{children}</p>;
      },
      // Lists
      ul({ children }: { children?: React.ReactNode }) {
        return (
          <ul className="my-1.5 ml-4 list-disc space-y-0.5 marker:text-muted-foreground">
            {children}
          </ul>
        );
      },
      ol({ children }: { children?: React.ReactNode }) {
        return (
          <ol className="my-1.5 ml-4 list-decimal space-y-0.5 marker:text-muted-foreground">
            {children}
          </ol>
        );
      },
      li({ children }: { children?: React.ReactNode }) {
        return <li className="pl-1">{children}</li>;
      },
      // Blockquotes
      blockquote({ children }: { children?: React.ReactNode }) {
        return (
          <blockquote className="my-2 border-l-2 border-primary/50 pl-3 text-muted-foreground italic">
            {children}
          </blockquote>
        );
      },
      // Links
      a({ href, children }: { href?: string; children?: React.ReactNode }) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
          >
            {children}
          </a>
        );
      },
      // Strong/Bold
      strong({ children }: { children?: React.ReactNode }) {
        return <strong className="font-semibold text-foreground">{children}</strong>;
      },
      // Emphasis/Italic
      em({ children }: { children?: React.ReactNode }) {
        return <em className="italic">{children}</em>;
      },
      // Horizontal rule
      hr() {
        return <hr className="my-3 border-border/50" />;
      },
      // Tables
      table({ children }: { children?: React.ReactNode }) {
        return (
          <div className="overflow-x-auto my-2 rounded-md border border-border/50">
            <table className="min-w-full text-xs">{children}</table>
          </div>
        );
      },
      thead({ children }: { children?: React.ReactNode }) {
        return <thead className="bg-muted/40">{children}</thead>;
      },
      tbody({ children }: { children?: React.ReactNode }) {
        return <tbody className="divide-y divide-border/30">{children}</tbody>;
      },
      tr({ children }: { children?: React.ReactNode }) {
        return <tr className="hover:bg-muted/20 transition-colors">{children}</tr>;
      },
      th({ children }: { children?: React.ReactNode }) {
        return (
          <th className="px-2.5 py-1.5 text-left font-medium text-foreground border-b border-border/50 text-xs">
            {children}
          </th>
        );
      },
      td({ children }: { children?: React.ReactNode }) {
        return <td className="px-2.5 py-1.5 text-xs">{children}</td>;
      },
    }),
    [onAppendToRunner],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn("flex w-full gap-2", isUser && "justify-end")}
    >
      {!isUser && (
        <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
          <Bot className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[90%] rounded-2xl border px-3 py-2.5 text-sm",
          isUser
            ? "border-primary/30 bg-primary/95 text-primary-foreground"
            : "border-border/70 bg-card/75 text-foreground backdrop-blur-sm",
        )}
      >
        {/* Loading state - waiting for first content */}
        {message.isLoading && !message.content ? (
          <div className="space-y-1.5">
            {message.toolCalls?.length ? (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader className="h-3 w-3 animate-spin" />
                  <span>
                    {(message.toolCalls[message.toolCalls.length - 1].name?.trim() || "Tool Call") +
                      "..."}
                  </span>
                </div>
                <ToolThinkingSkeleton />
              </div>
            ) : (
              <div className="flex items-center gap-1 py-1">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              </div>
            )}
          </div>
        ) : message.isLoading && message.content ? (
          // Streaming state with typewriter effect
          <>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {message.toolCalls.map((tc) => (
                  <ToolCallChip key={tc.id} toolCall={tc} />
                ))}
              </div>
            )}
            <StreamingText
              content={message.content}
              isStreaming={true}
              markdownComponents={markdownComponents}
            />
          </>
        ) : (
          // Complete state
          <>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {message.toolCalls.map((tc) => (
                  <ToolCallChip key={tc.id} toolCall={tc} />
                ))}
              </div>
            )}
            {message.content ? (
              <div className="text-sm leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : null}
          </>
        )}
      </div>
    </motion.div>
  );
});

// ============================================================================
// Main AI Chat Component
// ============================================================================

export const AIChat = memo(function AIChat() {
  const connection = useConnectionStore((s) => s.getActiveConnection());
  const selectedTable = useConnectionStore((s) => s.selectedTable);
  const selectedRowsContext = useAIQueryStore((s) => s.selectedRowsContext);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [openaiApiKey, setOpenaiApiKey] = useState(
    () => localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || "",
  );
  const [anthropicApiKey, setAnthropicApiKey] = useState(
    () => localStorage.getItem(ANTHROPIC_API_KEY_STORAGE_KEY) || "",
  );
  const [googleApiKey, setGoogleApiKey] = useState(
    () => localStorage.getItem(GOOGLE_API_KEY_STORAGE_KEY) || "",
  );
  const [openrouterApiKey, setOpenrouterApiKey] = useState(
    () => localStorage.getItem(OPENROUTER_API_KEY_STORAGE_KEY) || "",
  );
  const [vercelApiKey, setVercelApiKey] = useState(
    () => localStorage.getItem(VERCEL_API_KEY_STORAGE_KEY) || "",
  );
  const [copilotEnabled, setCopilotEnabled] = useState(
    () => localStorage.getItem(COPILOT_ENABLED_STORAGE_KEY) === "true",
  );
  const [showSettings, setShowSettings] = useState(false);
  const [tempOpenaiKey, setTempOpenaiKey] = useState("");
  const [tempAnthropicKey, setTempAnthropicKey] = useState("");
  const [tempGoogleKey, setTempGoogleKey] = useState("");
  const [tempOpenrouterKey, setTempOpenrouterKey] = useState("");
  const [tempVercelKey, setTempVercelKey] = useState("");
  const [tempCopilotEnabled, setTempCopilotEnabled] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>(() => {
    return localStorage.getItem(SELECTED_MODEL_KEY) || "gpt-5";
  });
  const [openaiModels, setOpenaiModels] = useState<AIModelInfo[]>([]);
  const [geminiModels, setGeminiModels] = useState<AIModelInfo[]>([]);
  const [anthropicModels, setAnthropicModels] = useState<AIModelInfo[]>([]);
  const [openrouterModels, setOpenrouterModels] = useState<AIModelInfo[]>([]);
  const [vercelModels, setVercelModels] = useState<AIModelInfo[]>([]);
  const [copilotModels, setCopilotModels] = useState<AIModelInfo[]>([]);
  const [copilotModelsLoading, setCopilotModelsLoading] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);

  // Fetch OpenAI models when API key changes
  useEffect(() => {
    if (!openaiApiKey.trim()) {
      setOpenaiModels([]);
      return;
    }
    let cancelled = false;
    api.aiFetchOpenAIModels(openaiApiKey).then(
      (models) => {
        if (!cancelled) setOpenaiModels(models);
      },
      () => {
        if (!cancelled) setOpenaiModels([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [openaiApiKey]);

  // Fetch Gemini models when API key changes
  useEffect(() => {
    if (!googleApiKey.trim()) {
      setGeminiModels([]);
      return;
    }
    let cancelled = false;
    api.aiFetchGeminiModels(googleApiKey).then(
      (models) => {
        if (!cancelled) setGeminiModels(models);
      },
      () => {
        if (!cancelled) setGeminiModels([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [googleApiKey]);

  // Fetch Anthropic models when API key changes
  useEffect(() => {
    if (!anthropicApiKey.trim()) {
      setAnthropicModels([]);
      return;
    }
    let cancelled = false;
    api.aiFetchAnthropicModels(anthropicApiKey).then(
      (models) => {
        if (!cancelled) setAnthropicModels(models);
      },
      () => {
        if (!cancelled) setAnthropicModels([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [anthropicApiKey]);

  // Fetch OpenRouter models when API key changes
  useEffect(() => {
    if (!openrouterApiKey.trim()) {
      setOpenrouterModels([]);
      return;
    }
    let cancelled = false;
    api.aiFetchOpenRouterModels(openrouterApiKey).then(
      (models) => {
        if (!cancelled) setOpenrouterModels(models);
      },
      () => {
        if (!cancelled) setOpenrouterModels([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [openrouterApiKey]);

  // Fetch Vercel models when API key changes
  useEffect(() => {
    if (!vercelApiKey.trim()) {
      setVercelModels([]);
      return;
    }
    let cancelled = false;
    api.aiFetchVercelModels(vercelApiKey).then(
      (models) => {
        if (!cancelled) setVercelModels(models);
      },
      () => {
        if (!cancelled) setVercelModels([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [vercelApiKey]);

  const fetchCopilotModels = useCallback(async () => {
    if (!copilotEnabled) {
      setCopilotModels([]);
      setCopilotModelsLoading(false);
      return;
    }
    setCopilotModelsLoading(true);
    try {
      const models = await api.aiFetchCopilotModels();
      setCopilotModels(models);
    } catch {
      setCopilotModels([]);
    } finally {
      setCopilotModelsLoading(false);
    }
  }, [copilotEnabled]);

  useEffect(() => {
    void fetchCopilotModels();
  }, [fetchCopilotModels]);

  const allModels = useMemo(() => {
    const merged = [
      ...AI_MODELS,
      ...openaiModels,
      ...geminiModels,
      ...anthropicModels,
      ...openrouterModels,
      ...vercelModels,
      ...copilotModels,
    ];

    const seen = new Set<string>();
    return merged.filter((model) => {
      if (seen.has(model.id)) {
        return false;
      }
      seen.add(model.id);
      return true;
    });
  }, [openaiModels, geminiModels, anthropicModels, openrouterModels, vercelModels, copilotModels]);

  const apiKeys = useMemo(
    () => ({
      openai: openaiApiKey,
      anthropic: anthropicApiKey,
      google: googleApiKey,
      openrouter: openrouterApiKey,
      vercel: vercelApiKey,
      copilot: copilotEnabled ? "enabled" : "",
    }),
    [openaiApiKey, anthropicApiKey, googleApiKey, openrouterApiKey, vercelApiKey, copilotEnabled],
  );

  const agentRef = useRef<AIAgent | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const queuedMessagesRef = useRef<Array<{ text: string; addUserMessage: boolean }>>([]);
  const [queuedMessageCount, setQueuedMessageCount] = useState(0);

  // Debug request from query editor
  const debugRequest = useAIQueryStore((s) => s.debugRequest);
  const clearDebugRequest = useAIQueryStore((s) => s.clearDebugRequest);
  const appendSql = useAIQueryStore((s) => s.appendSql);

  // Layout store for code block actions
  const getAllLeafPanes = useLayoutStore((s) => s.getAllLeafPanes);
  const setActiveTab = useLayoutStore((s) => s.setActiveTab);
  const createTab = useLayoutStore((s) => s.createTab);
  const getActivePane = useLayoutStore((s) => s.getActivePane);

  // Last chat session persistence
  const setLastSession = useLastChatStore((s) => s.setLastSession);
  const getLastSession = useLastChatStore((s) => s.getLastSession);

  // Preload common provider icons on mount
  useEffect(() => {
    preloadProviderIcons();
  }, []);

  // Load chat history on mount
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const history = await loadChatHistory();
      if (cancelled) return;

      setSessions(history);

      if (connection?.id) {
        const lastSessionId = getLastSession(connection.id);
        if (lastSessionId) {
          const lastSession = history.find((s) => s.id === lastSessionId);
          if (lastSession) {
            setCurrentSessionId(lastSessionId);
            setMessages(lastSession.messages);
            setSelectedModel(lastSession.model as ModelId);
          }
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [connection?.id, getLastSession]);

  // Save current session ID when it changes
  useEffect(() => {
    if (connection?.id && currentSessionId) {
      setLastSession(connection.id, currentSessionId);
    }
  }, [connection?.id, currentSessionId, setLastSession]);

  // Get the current API key based on selected model
  const currentApiKey = getApiKeyForModel(selectedModel, allModels, apiKeys);

  // Initialize agent
  useEffect(() => {
    if (currentApiKey && connection?.id && connection?.db_type) {
      agentRef.current = new AIAgent(
        currentApiKey,
        connection.id,
        connection.db_type,
        selectedModel,
      );
    } else {
      agentRef.current = null;
    }
  }, [currentApiKey, connection?.id, connection?.db_type, selectedModel]);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle debug request from query editor
  useEffect(() => {
    if (debugRequest && currentApiKey && connection?.id) {
      const debugMessage = `I got this SQL error. Please help me debug it:\n\n**Query:**\n\`\`\`sql\n${debugRequest.query}\n\`\`\`\n\n**Error:**\n\`\`\`\n${debugRequest.error}\n\`\`\``;
      setInput(debugMessage);
      clearDebugRequest();
    }
  }, [debugRequest, currentApiKey, connection?.id, clearDebugRequest]);

  // Filter sessions for current connection
  const connectionSessions = sessions.filter((s) => s.connectionId === connection?.id);

  const handleSaveApiKeys = () => {
    setOpenaiApiKey(tempOpenaiKey);
    setAnthropicApiKey(tempAnthropicKey);
    setGoogleApiKey(tempGoogleKey);
    setOpenrouterApiKey(tempOpenrouterKey);
    setVercelApiKey(tempVercelKey);
    setCopilotEnabled(tempCopilotEnabled);
    localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, tempOpenaiKey);
    localStorage.setItem(ANTHROPIC_API_KEY_STORAGE_KEY, tempAnthropicKey);
    localStorage.setItem(GOOGLE_API_KEY_STORAGE_KEY, tempGoogleKey);
    localStorage.setItem(OPENROUTER_API_KEY_STORAGE_KEY, tempOpenrouterKey);
    localStorage.setItem(VERCEL_API_KEY_STORAGE_KEY, tempVercelKey);
    localStorage.setItem(COPILOT_ENABLED_STORAGE_KEY, tempCopilotEnabled ? "true" : "false");
    setShowSettings(false);
  };

  const handleNewChat = () => {
    if (!connection?.id) return;
    const session = createChatSession(connection.id, selectedModel, connection.db_type);
    const newSessions = [...sessions, session];
    setSessions(newSessions);
    void saveChatHistory(newSessions);
    setCurrentSessionId(session.id);
    setMessages([]);
    agentRef.current?.clearHistory();
  };

  const handleSelectSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    setCurrentSessionId(sessionId);
    setMessages(session.messages);

    // Migrate old model values to gpt-5
    const validModel = allModels.some((m) => m.id === session.model)
      ? (session.model as ModelId)
      : "gpt-5";
    setSelectedModel(validModel);

    if (agentRef.current) {
      agentRef.current.loadFromSession(session);
      // Ensure agent uses the valid model
      agentRef.current.setModel(validModel);
    }
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter((s) => s.id !== sessionId);
    setSessions(newSessions);
    void saveChatHistory(newSessions);

    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
      agentRef.current?.clearHistory();
    }
  };

  const handleClearChat = () => {
    if (currentSessionId) {
      const newSessions = sessions.map((s) =>
        s.id === currentSessionId
          ? { ...s, messages: [], title: "New Chat", updatedAt: Date.now() }
          : s,
      );
      setSessions(newSessions);
      void saveChatHistory(newSessions);
    }
    setMessages([]);
    agentRef.current?.clearHistory();
  };

  const handleModelChange = (model: ModelId) => {
    setSelectedModel(model);
    localStorage.setItem(SELECTED_MODEL_KEY, model);
    agentRef.current?.setModel(model);

    if (currentSessionId) {
      const newSessions = sessions.map((s) =>
        s.id === currentSessionId ? { ...s, model, updatedAt: Date.now() } : s,
      );
      setSessions(newSessions);
      void saveChatHistory(newSessions);
    }
  };

  const saveCurrentSession = (updatedMessages: Message[]) => {
    if (!connection?.id) return;

    let newSessions: ChatSession[];

    if (currentSessionId) {
      newSessions = sessions.map((s) =>
        s.id === currentSessionId
          ? {
              ...s,
              messages: updatedMessages,
              title: generateSessionTitle(updatedMessages),
              updatedAt: Date.now(),
            }
          : s,
      );
    } else {
      const session = createChatSession(connection.id, selectedModel, connection.db_type);
      session.messages = updatedMessages;
      session.title = generateSessionTitle(updatedMessages);
      newSessions = [...sessions, session];
      setCurrentSessionId(session.id);
    }

    setSessions(newSessions);
    void saveChatHistory(newSessions);
  };

  // Handler for appending code to the query runner
  const handleAppendToRunner = useCallback(
    (code: string) => {
      appendSql(code);
      // Switch to an existing query tab or create a new one
      if (connection?.id) {
        const leafPanes = getAllLeafPanes(connection.id);
        // Find any query tab in any pane
        for (const pane of leafPanes) {
          const queryTab = pane.tabs.find((t) => t.type === "query");
          if (queryTab) {
            setActiveTab(connection.id, pane.id, queryTab.id);
            return;
          }
        }
        // No query tab found, create one in the active pane
        const activePane = getActivePane(connection.id);
        if (activePane) {
          createTab(connection.id, activePane.id, "query", { title: "Query" });
        }
      }
    },
    [connection, getAllLeafPanes, setActiveTab, createTab, getActivePane, appendSql],
  );

  const handleCancel = useCallback(() => {
    // First cancel the agent to stop listening for events and interrupt the generator
    if (agentRef.current) {
      agentRef.current.cancel();
    }
    // Then abort the controller to signal the loop to stop
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const enqueueMessage = useCallback((text: string, addUserMessage: boolean) => {
    queuedMessagesRef.current.push({ text, addUserMessage });
    setQueuedMessageCount(queuedMessagesRef.current.length);
  }, []);

  const composePromptWithContext = useCallback(
    (userText: string) => {
      const contextLines: string[] = [];

      if (selectedTable) {
        contextLines.push(`Active table: ${selectedTable.schema}.${selectedTable.name}`);
      }

      if (selectedRowsContext?.preview) {
        contextLines.push(
          `Selected row context (${selectedRowsContext.schema}.${selectedRowsContext.table}, ${selectedRowsContext.count} row):\n${selectedRowsContext.preview}`,
        );
      }

      if (contextLines.length === 0) {
        return userText;
      }

      return `Database context:\n${contextLines.join("\n\n")}\n\nUser request:\n${userText}`;
    },
    [selectedTable, selectedRowsContext],
  );

  const quickActions = useMemo(() => {
    const activeTableRef = selectedTable
      ? `${selectedTable.schema}.${selectedTable.name}`
      : "the active table";

    const actions = [
      {
        label: "Schema Summary",
        prompt: `Give me a concise schema summary for ${activeTableRef}.`,
      },
      {
        label: "Generate Update SQL",
        prompt: `Generate a safe SQL UPDATE statement for ${activeTableRef} with best practices and a WHERE clause.`,
      },
      {
        label: "Find Anomalies",
        prompt: `What are the best anomaly checks I should run on ${activeTableRef}? Include SQL examples.`,
      },
    ];

    if (selectedRowsContext?.preview) {
      actions.unshift({
        label: "Explain Selected Row",
        prompt:
          "Explain the currently selected row, highlight suspicious values, and suggest follow-up SQL checks.",
      });
    }

    return actions;
  }, [selectedTable, selectedRowsContext]);

  const sendMessage = useCallback(
    async (userText: string, addUserMessage: boolean = true) => {
      if (!agentRef.current) return;

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      setLastUserMessage(userText);

      if (addUserMessage) {
        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: "user",
          content: userText,
        };
        setMessages((prev) => [...prev, userMessage]);
      }

      setInput("");
      setIsLoading(true);

      const loadingId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: loadingId, role: "assistant", content: "", isLoading: true },
      ]);

      try {
        const promptWithContext = composePromptWithContext(userText);
        const stream = agentRef.current.chatStream(promptWithContext, (toolUpdate) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === loadingId
                ? {
                    ...m,
                    toolCalls: (() => {
                      const existing = [...(m.toolCalls || [])];
                      const existingIndex = existing.findIndex((tc) => tc.id === toolUpdate.id);

                      if (existingIndex === -1) {
                        existing.push({
                          id: toolUpdate.id,
                          name: toolUpdate.name?.trim() || "Tool Call",
                          arguments: toolUpdate.arguments || "",
                          result: toolUpdate.result,
                        });
                        return existing;
                      }

                      const current = existing[existingIndex];
                      existing[existingIndex] = {
                        ...current,
                        name: toolUpdate.name?.trim() || current.name || "Tool Call",
                        arguments:
                          toolUpdate.arguments !== undefined
                            ? toolUpdate.arguments
                            : current.arguments,
                        result:
                          toolUpdate.status === "result"
                            ? (toolUpdate.result ?? "")
                            : current.result,
                      };
                      return existing;
                    })(),
                  }
                : m,
            ),
          );
        });

        let fullContent = "";
        for await (const chunk of stream) {
          // Check if aborted
          if (abortControllerRef.current?.signal.aborted) {
            throw new Error("Request cancelled");
          }
          fullContent += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === loadingId ? { ...m, content: fullContent, isLoading: true } : m,
            ),
          );
          scrollToBottom();
        }

        setMessages((prev) => {
          const updated = prev.map((m) => (m.id === loadingId ? { ...m, isLoading: false } : m));
          saveCurrentSession(updated);
          return updated;
        });
      } catch (error) {
        const isCancelled = error instanceof Error && error.message === "Request cancelled";
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === loadingId
              ? {
                  ...m,
                  content: isCancelled
                    ? "_Response cancelled_"
                    : `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
                  isLoading: false,
                }
              : m,
          );
          return updated;
        });
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;

        const next = queuedMessagesRef.current.shift();
        setQueuedMessageCount(queuedMessagesRef.current.length);
        if (next && agentRef.current) {
          void sendMessage(next.text, next.addUserMessage);
        }
      }
    },
    [scrollToBottom, saveCurrentSession, composePromptWithContext],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || !agentRef.current) return;

    if (isLoading) {
      const queuedUserMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmedInput,
      };
      setMessages((prev) => [...prev, queuedUserMessage]);
      setInput("");
      enqueueMessage(trimmedInput, false);
      return;
    }

    await sendMessage(trimmedInput, true);
  };

  const handleRetry = useCallback(() => {
    if (!lastUserMessage || isLoading || !agentRef.current) return;

    // Remove the last assistant message
    setMessages((prev) => {
      // Find last assistant message index
      let lastAssistantIndex = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === "assistant") {
          lastAssistantIndex = i;
          break;
        }
      }
      if (lastAssistantIndex === -1) return prev;
      return prev.slice(0, lastAssistantIndex);
    });

    // Clear the agent's last exchange and resend
    agentRef.current.clearHistory();

    sendMessage(lastUserMessage, false);
  }, [lastUserMessage, isLoading, sendMessage]);

  // ============================================================================
  // Render States
  // ============================================================================

  if (!connection) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-foreground">Connect to a database first</p>
          <p className="text-sm text-muted-foreground">Querybuddy needs an active connection</p>
        </div>
      </div>
    );
  }

  // Check if user has ANY API key configured
  const hasAnyApiKey = !!(
    apiKeys.openai.trim() ||
    apiKeys.anthropic.trim() ||
    apiKeys.google.trim() ||
    apiKeys.openrouter.trim() ||
    apiKeys.vercel.trim() ||
    apiKeys.copilot.trim()
  );

  if (!hasAnyApiKey) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4 max-w-sm">
          <div className="space-y-2">
            <p className="text-lg font-medium text-foreground">API Key Required</p>
            <p className="text-sm text-muted-foreground">
              To use AI features, you need to provide at least one API key (OpenAI, Anthropic,
              Google, OpenRouter, Vercel AI Gateway) or enable GitHub Copilot CLI. Your keys are
              stored locally.
            </p>
          </div>
          <Button
            onClick={() => {
              setTempOpenaiKey(openaiApiKey);
              setTempAnthropicKey(anthropicApiKey);
              setTempGoogleKey(googleApiKey);
              setTempOpenrouterKey(openrouterApiKey);
              setTempVercelKey(vercelApiKey);
              setTempCopilotEnabled(copilotEnabled);
              setShowSettings(true);
            }}
          >
            <Settings className="mr-2 h-4 w-4" />
            Configure API Keys
          </Button>

          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>API Keys</DialogTitle>
                <DialogDescription>
                  Enter your API keys to enable Querybuddy. You can use OpenAI, Anthropic, Google,
                  OpenRouter, Vercel AI Gateway, or GitHub Copilot CLI.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="openaiKey">OpenAI API Key</Label>
                  <Input
                    id="openaiKey"
                    type="password"
                    placeholder="sk-..."
                    value={tempOpenaiKey}
                    onChange={(e) => setTempOpenaiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">For GPT models</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="anthropicKey">Anthropic API Key</Label>
                  <Input
                    id="anthropicKey"
                    type="password"
                    placeholder="sk-ant-..."
                    value={tempAnthropicKey}
                    onChange={(e) => setTempAnthropicKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">For Claude models</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="googleKey">Google API Key</Label>
                  <Input
                    id="googleKey"
                    type="password"
                    placeholder="AIza..."
                    value={tempGoogleKey}
                    onChange={(e) => setTempGoogleKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">For Gemini models</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openrouterKey">OpenRouter API Key</Label>
                  <Input
                    id="openrouterKey"
                    type="password"
                    placeholder="sk-or-..."
                    value={tempOpenrouterKey}
                    onChange={(e) => setTempOpenrouterKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    For OpenRouter models (Claude, DeepSeek, etc.)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vercelKey">Vercel AI Gateway Key</Label>
                  <Input
                    id="vercelKey"
                    type="password"
                    placeholder="sk-..."
                    value={tempVercelKey}
                    onChange={(e) => setTempVercelKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">For Vercel AI Gateway models</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="copilotEnabled">
                      GitHub Copilot CLI <Badge variant="outline">Experimental</Badge>
                    </Label>
                    <Switch
                      id="copilotEnabled"
                      checked={tempCopilotEnabled}
                      onCheckedChange={setTempCopilotEnabled}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No API key needed. Install Copilot CLI and run `copilot login`.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSettings(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveApiKeys}
                  disabled={
                    !tempOpenaiKey.trim() &&
                    !tempAnthropicKey.trim() &&
                    !tempGoogleKey.trim() &&
                    !tempOpenrouterKey.trim() &&
                    !tempVercelKey.trim() &&
                    !tempCopilotEnabled
                  }
                >
                  Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Main Chat UI
  // ============================================================================

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="z-10 shrink-0 border-b border-border/55 bg-background/80 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight">Querybuddy</span>
            </div>
          </div>
          <div className="ml-3 flex items-center gap-1">
            {/* Chat History Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg border border-transparent hover:border-border/60 hover:bg-muted/70"
                  title="Chat History"
                >
                  <History className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Recent Chats</p>
                </div>
                <DropdownMenuSeparator />
                <ScrollArea className="max-h-64">
                  {connectionSessions.length === 0 ? (
                    <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                      No chat history yet
                    </div>
                  ) : (
                    connectionSessions
                      .sort((a, b) => b.updatedAt - a.updatedAt)
                      .slice(0, 20)
                      .map((session) => (
                        <DropdownMenuItem
                          key={session.id}
                          className="flex cursor-pointer items-center justify-between gap-2"
                          onClick={() => handleSelectSession(session.id)}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate text-sm">{session.title}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 shrink-0 p-0 opacity-50 hover:opacity-100"
                            onClick={(e) => handleDeleteSession(session.id, e)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </DropdownMenuItem>
                      ))
                  )}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* New Chat */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg border border-transparent hover:border-border/60 hover:bg-muted/70"
              onClick={handleNewChat}
              title="New Chat"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>

            {/* Clear Chat */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg border border-transparent hover:border-border/60 hover:bg-muted/70"
              onClick={handleClearChat}
              disabled={messages.length === 0}
              title="Clear Chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>

            {/* Settings */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg border border-transparent hover:border-border/60 hover:bg-muted/70"
              onClick={() => {
                setTempOpenaiKey(openaiApiKey);
                setTempAnthropicKey(anthropicApiKey);
                setTempGoogleKey(googleApiKey);
                setTempOpenrouterKey(openrouterApiKey);
                setTempVercelKey(vercelApiKey);
                setTempCopilotEnabled(copilotEnabled);
                setShowSettings(true);
              }}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="z-10 flex-1 overflow-y-auto px-3 py-3" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-sm space-y-4 rounded-2xl border border-border/55 bg-card/50 p-5 text-center backdrop-blur-sm">
              <div className="flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                  <Bot className="h-5 w-5 text-primary/60" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Ask anything about your database
                </p>
                <p className="text-xs text-muted-foreground">
                  I can inspect schema, debug SQL, and generate queries.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {quickActions.slice(0, 4).map((action) => (
                  <button
                    key={action.label}
                    onClick={() => setInput(action.prompt)}
                    className="rounded-md border border-border/55 bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-4xl space-y-3">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onAppendToRunner={handleAppendToRunner}
              />
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="z-10 border-t border-border/45 bg-background/85 px-3 pb-3 pt-2 backdrop-blur-sm">
        <form onSubmit={handleSubmit}>
          <div className="mx-auto w-full max-w-4xl rounded-[28px] border border-white/8 bg-card/50 p-3 supports-[backdrop-filter]:bg-card/40">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (e.shiftKey) return;
                  e.preventDefault();
                  if (input.trim()) {
                    handleSubmit(e);
                  }
                }
              }}
              placeholder="Ask about your database..."
              className="min-h-[92px] max-h-56 rounded-2xl border-transparent bg-transparent px-2 py-1.5 text-[15px] leading-relaxed placeholder:text-muted-foreground/70 shadow-none focus-visible:border-transparent focus-visible:ring-0"
            />

            <div className="mt-1 flex flex-wrap items-center gap-1.5 px-1">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => setInput(action.prompt)}
                  className="inline-flex items-center gap-1 rounded-full border border-border/55 bg-background/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground"
                >
                  <Sparkles className="h-3 w-3" />
                  {action.label}
                </button>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2.5">
              <div className="flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <Popover
                  open={modelPickerOpen}
                  onOpenChange={(open) => {
                    setModelPickerOpen(open);
                    if (
                      open &&
                      copilotEnabled &&
                      !copilotModelsLoading &&
                      copilotModels.length === 0
                    ) {
                      void fetchCopilotModels();
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={modelPickerOpen}
                      className="h-9 min-w-[220px] justify-between rounded-2xl border-border/50 bg-background/30 px-3 text-xs hover:bg-background/40"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <ProviderIcon
                          provider={
                            allModels.find((m) => m.id === selectedModel)?.logo_provider ||
                            allModels.find((m) => m.id === selectedModel)?.provider ||
                            "openai"
                          }
                          size={14}
                        />
                        <span className="truncate">
                          {allModels.find((m) => m.id === selectedModel)?.name ?? selectedModel}
                        </span>
                      </div>
                      <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search models..." className="h-9" />
                      <CommandList className="max-h-64">
                        <CommandEmpty>
                          {copilotModelsLoading ? "Loading models..." : "No models found."}
                        </CommandEmpty>
                        <CommandGroup>
                          {allModels
                            .filter((model) => isModelAvailable(model.id, allModels, apiKeys))
                            .map((model) => (
                              <CommandItem
                                key={model.id}
                                value={`${model.name} ${model.provider} ${model.logo_provider || ""}`}
                                onSelect={() => {
                                  handleModelChange(model.id);
                                  setModelPickerOpen(false);
                                }}
                                className="text-xs"
                              >
                                <Check
                                  className={cn(
                                    "h-3 w-3 shrink-0",
                                    selectedModel === model.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <ProviderIcon
                                  provider={model.logo_provider || model.provider}
                                  size={14}
                                />
                                <span className="truncate">
                                  {model.name}
                                  <span className="ml-1 text-muted-foreground">
                                    ({model.provider})
                                  </span>
                                </span>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {!isLoading && lastUserMessage && messages.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRetry}
                    className="h-9 rounded-2xl border-border/50 bg-background/30 px-3 text-xs hover:bg-background/40"
                    title="Retry last message"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}

                {queuedMessageCount > 0 && (
                  <span className="rounded-xl border border-border/50 bg-background/30 px-2 py-1 text-[10px] text-muted-foreground">
                    Queue: {queuedMessageCount}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {isLoading ? (
                  <>
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!input.trim()}
                      className="h-10 w-10 rounded-2xl border border-border/60 bg-background/35 text-muted-foreground hover:bg-background/50 disabled:opacity-50"
                      title="Queue message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      onClick={handleCancel}
                      className="h-10 rounded-2xl border border-border/60 bg-background/35 px-3 text-xs text-muted-foreground hover:bg-background/50"
                      title="Generating... Click to stop"
                    >
                      <Loader className="mr-1.5 h-4 w-4 animate-spin" />
                      Stop
                    </Button>
                  </>
                ) : (
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim()}
                    className="h-10 w-10 rounded-2xl bg-primary/90 text-primary-foreground hover:bg-primary disabled:bg-muted disabled:text-muted-foreground"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Settings</DialogTitle>
            <DialogDescription>
              Configure your API keys or enable GitHub Copilot CLI for Querybuddy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="openaiKey2">OpenAI API Key</Label>
              <Input
                id="openaiKey2"
                type="password"
                placeholder="sk-..."
                value={tempOpenaiKey}
                onChange={(e) => setTempOpenaiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">For GPT models</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="anthropicKey2">Anthropic API Key</Label>
              <Input
                id="anthropicKey2"
                type="password"
                placeholder="sk-ant-..."
                value={tempAnthropicKey}
                onChange={(e) => setTempAnthropicKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">For Claude models</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="googleKey2">Google API Key</Label>
              <Input
                id="googleKey2"
                type="password"
                placeholder="AIza..."
                value={tempGoogleKey}
                onChange={(e) => setTempGoogleKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">For Gemini models</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="openrouterKey2">OpenRouter API Key</Label>
              <Input
                id="openrouterKey2"
                type="password"
                placeholder="sk-or-..."
                value={tempOpenrouterKey}
                onChange={(e) => setTempOpenrouterKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                For OpenRouter models (Claude, DeepSeek, etc.)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vercelKey2">Vercel AI Gateway Key</Label>
              <Input
                id="vercelKey2"
                type="password"
                placeholder="sk-..."
                value={tempVercelKey}
                onChange={(e) => setTempVercelKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">For Vercel AI Gateway models</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="copilotEnabled2">GitHub Copilot CLI</Label>
                <Switch
                  id="copilotEnabled2"
                  checked={tempCopilotEnabled}
                  onCheckedChange={setTempCopilotEnabled}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                No API key needed. Install Copilot CLI and run `copilot auth login`.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveApiKeys}
              disabled={
                !tempOpenaiKey.trim() &&
                !tempAnthropicKey.trim() &&
                !tempGoogleKey.trim() &&
                !tempOpenrouterKey.trim() &&
                !tempVercelKey.trim() &&
                !tempCopilotEnabled
              }
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});
