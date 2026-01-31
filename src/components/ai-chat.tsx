import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { useLayoutStore } from "@/lib/layout-store";
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
  PlayCircle,
  History,
  RotateCcw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useConnectionStore, useAIQueryStore, useLastChatStore } from "@/lib/store";
import {
  AIAgent,
  AI_MODELS,
  type Message,
  type ModelId,
  type ChatSession,
  loadChatHistory,
  saveChatHistory,
  createChatSession,
  generateSessionTitle,
  getModelProvider,
} from "@/lib/ai-agent";
import { cn } from "@/lib/utils";

const OPENAI_API_KEY_STORAGE_KEY = "querystudio_openai_api_key";
const ANTHROPIC_API_KEY_STORAGE_KEY = "querystudio_anthropic_api_key";
const GOOGLE_API_KEY_STORAGE_KEY = "querystudio_google_api_key";
const SELECTED_MODEL_KEY = "querystudio_selected_model";

function getApiKeyForModel(
  model: ModelId,
  openaiKey: string,
  anthropicKey: string,
  googleKey: string,
): string {
  const provider = getModelProvider(model);
  if (provider === "anthropic") return anthropicKey;
  if (provider === "google") return googleKey;
  return openaiKey;
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
// Memoized Message Component
// ============================================================================

interface MessageBubbleProps {
  message: Message;
  onAppendToRunner: (code: string) => void;
}

const MessageBubble = memo(function MessageBubble({
  message,
  onAppendToRunner,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  // Memoize the markdown components to ensure stable references
  // This prevents React from seeing different component trees during streaming
  const markdownComponents = useMemo(
    () => ({
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
      table({ children }: { children?: React.ReactNode }) {
        return (
          <div className="overflow-x-auto my-1.5 rounded-md border border-border/50">
            <table className="min-w-full text-xs">{children}</table>
          </div>
        );
      },
      th({ children }: { children?: React.ReactNode }) {
        return (
          <th className="bg-muted/40 px-2 py-1 text-left font-medium text-foreground border-b border-border/50 text-xs">
            {children}
          </th>
        );
      },
      td({ children }: { children?: React.ReactNode }) {
        return <td className="px-2 py-1 border-b border-border/30 text-xs">{children}</td>;
      },
    }),
    [onAppendToRunner],
  );

  return (
    <div className={cn("flex gap-2", isUser && "justify-end")}>
      <div
        className={cn(
          "max-w-[90%] rounded-xl px-3 py-2 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-transparent text-foreground",
        )}
      >
        {/* Loading state */}
        {message.isLoading && !message.content ? (
          <div className="space-y-1.5">
            {message.toolCalls?.length ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wrench className="h-3 w-3 animate-pulse" />
                <span>{message.toolCalls[message.toolCalls.length - 1].name}...</span>
              </div>
            ) : null}
            <div className="space-y-1">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ) : message.isLoading && message.content ? (
          // Streaming state
          <>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {message.toolCalls.map((tc) => (
                  <div
                    key={tc.id}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5"
                  >
                    <Wrench className="h-2.5 w-2.5" />
                    <span>{tc.name}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="prose prose-sm prose-invert max-w-none prose-p:my-0.5 prose-ul:my-0.5 prose-ol:my-0.5 prose-li:my-0 prose-table:my-1.5 prose-headings:my-1 prose-hr:hidden">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
              <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 rounded-sm" />
            </div>
          </>
        ) : (
          // Complete state
          <>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {message.toolCalls.map((tc) => (
                  <div
                    key={tc.id}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5"
                  >
                    <Wrench className="h-2.5 w-2.5" />
                    <span>{tc.name}</span>
                  </div>
                ))}
              </div>
            )}
            {message.content ? (
              <div className="prose prose-sm prose-invert max-w-none prose-p:my-0.5 prose-ul:my-0.5 prose-ol:my-0.5 prose-li:my-0 prose-table:my-1.5 prose-headings:my-1 prose-hr:hidden">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// Main AI Chat Component
// ============================================================================

export const AIChat = memo(function AIChat() {
  const connection = useConnectionStore((s) => s.getActiveConnection());
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
  const [showSettings, setShowSettings] = useState(false);
  const [tempOpenaiKey, setTempOpenaiKey] = useState("");
  const [tempAnthropicKey, setTempAnthropicKey] = useState("");
  const [tempGoogleKey, setTempGoogleKey] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelId>(() => {
    const saved = localStorage.getItem(SELECTED_MODEL_KEY);
    if (saved && AI_MODELS.some((m) => m.id === saved)) {
      return saved as ModelId;
    }
    return "gpt-5";
  });

  // Clean up invalid model from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(SELECTED_MODEL_KEY);
    if (saved && !AI_MODELS.some((m) => m.id === saved)) {
      localStorage.removeItem(SELECTED_MODEL_KEY);
    }
  }, []);

  const agentRef = useRef<AIAgent | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);

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

  // Load chat history on mount
  useEffect(() => {
    const history = loadChatHistory();
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
  }, [connection?.id, getLastSession]);

  // Save current session ID when it changes
  useEffect(() => {
    if (connection?.id && currentSessionId) {
      setLastSession(connection.id, currentSessionId);
    }
  }, [connection?.id, currentSessionId, setLastSession]);

  // Get the current API key based on selected model
  const currentApiKey = getApiKeyForModel(
    selectedModel,
    openaiApiKey,
    anthropicApiKey,
    googleApiKey,
  );

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
    localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, tempOpenaiKey);
    localStorage.setItem(ANTHROPIC_API_KEY_STORAGE_KEY, tempAnthropicKey);
    localStorage.setItem(GOOGLE_API_KEY_STORAGE_KEY, tempGoogleKey);
    setShowSettings(false);
  };

  const handleNewChat = () => {
    if (!connection?.id) return;
    const session = createChatSession(connection.id, selectedModel, connection.db_type);
    const newSessions = [...sessions, session];
    setSessions(newSessions);
    saveChatHistory(newSessions);
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
    const validModel = AI_MODELS.some((m) => m.id === session.model)
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
    saveChatHistory(newSessions);

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
      saveChatHistory(newSessions);
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
      saveChatHistory(newSessions);
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
    saveChatHistory(newSessions);
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
        const stream = agentRef.current.chatStream(userText, (toolName, args) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === loadingId
                ? {
                    ...m,
                    toolCalls: [
                      ...(m.toolCalls || []),
                      {
                        id: crypto.randomUUID(),
                        name: toolName,
                        arguments: args,
                      },
                    ],
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
      }
    },
    [scrollToBottom, saveCurrentSession],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !agentRef.current) return;
    await sendMessage(input.trim(), true);
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

  if (!currentApiKey) {
    const provider = getModelProvider(selectedModel);
    const missingProvider =
      provider === "anthropic" ? "Anthropic" : provider === "google" ? "Google" : "OpenAI";
    const modelType = selectedModel.startsWith("claude")
      ? "Claude"
      : selectedModel.startsWith("gemini")
        ? "Gemini"
        : "GPT";

    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4 max-w-sm">
          <div className="space-y-2">
            <p className="text-lg font-medium text-foreground">
              {missingProvider} API Key Required
            </p>
            <p className="text-sm text-muted-foreground">
              To use {modelType} models, you need to provide a {missingProvider} API key. Your keys
              are stored locally.
            </p>
          </div>
          <Button
            onClick={() => {
              setTempOpenaiKey(openaiApiKey);
              setTempAnthropicKey(anthropicApiKey);
              setTempGoogleKey(googleApiKey);
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
                  or any combination.
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
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSettings(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveApiKeys}
                  disabled={
                    !tempOpenaiKey.trim() && !tempAnthropicKey.trim() && !tempGoogleKey.trim()
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
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">Querybuddy</span>
        </div>
        <div className="flex items-center gap-0.5">
          {/* Chat History Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" title="Chat History">
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
                        className="flex items-center justify-between gap-2 cursor-pointer"
                        onClick={() => handleSelectSession(session.id)}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm">{session.title}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 shrink-0 opacity-50 hover:opacity-100"
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
            className="h-6 w-6"
            onClick={handleNewChat}
            title="New Chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>

          {/* Clear Chat */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
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
            className="h-6 w-6"
            onClick={() => {
              setTempOpenaiKey(openaiApiKey);
              setTempAnthropicKey(anthropicApiKey);
              setTempGoogleKey(googleApiKey);
              setShowSettings(true);
            }}
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-3 max-w-xs">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-primary/40" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Ask me anything about your database</p>
              <div className="flex flex-wrap justify-center gap-2">
                {["What tables do I have?", "Show me recent data", "Describe the schema"].map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {suggestion}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
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
      <div className="border-t border-border p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (input.trim() && !isLoading) {
                    handleSubmit(e);
                  }
                }
              }}
              placeholder="Ask about your database..."
              disabled={isLoading}
              className="pr-24 rounded-xl"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {!isLoading && lastUserMessage && messages.length > 0 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={handleRetry}
                  className="h-8 w-8"
                  title="Retry last message"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              {isLoading ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={handleCancel}
                  className="h-8 w-8"
                  title="Stop generating"
                >
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                  </span>
                </Button>
              ) : (
                <Button type="submit" size="icon" disabled={!input.trim()} className="h-8 w-8">
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Select value={selectedModel} onValueChange={handleModelChange}>
              <SelectTrigger className="h-8 w-48 text-xs rounded-xl">
                <SelectValue placeholder="GPT-5" />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">↵ to send</span>
          </div>
        </form>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Settings</DialogTitle>
            <DialogDescription>Configure your API keys for Querybuddy.</DialogDescription>
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
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveApiKeys}
              disabled={!tempOpenaiKey.trim() && !tempAnthropicKey.trim() && !tempGoogleKey.trim()}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});
