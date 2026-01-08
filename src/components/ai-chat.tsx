import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Bot,
  User,
  Loader2,
  Settings,
  Trash2,
  Wrench,
  Plus,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  PlayCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
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
import { Label } from "@/components/ui/label";
import {
  useConnectionStore,
  useAIQueryStore,
  useLastChatStore,
  useThemeStore,
} from "@/lib/store";
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

const API_KEY_STORAGE_KEY = "querystudio_openai_api_key";
const ANTHROPIC_KEY_STORAGE_KEY = "querystudio_anthropic_api_key";

// Custom Tokyo Night theme for syntax highlighter
const tokyoNightStyle: { [key: string]: React.CSSProperties } = {
  'code[class*="language-"]': {
    color: "#a9b1d6",
    background: "#1a1b26",
    fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, "Courier New", monospace',
    fontSize: "0.875rem",
  },
  'pre[class*="language-"]': {
    color: "#a9b1d6",
    background: "#1a1b26",
    padding: "1rem",
    margin: 0,
    overflow: "auto",
  },
  comment: { color: "#565f89", fontStyle: "italic" },
  prolog: { color: "#565f89" },
  doctype: { color: "#565f89" },
  cdata: { color: "#565f89" },
  punctuation: { color: "#89ddff" },
  property: { color: "#7dcfff" },
  tag: { color: "#f7768e" },
  boolean: { color: "#ff9e64" },
  number: { color: "#ff9e64" },
  constant: { color: "#ff9e64" },
  symbol: { color: "#73daca" },
  deleted: { color: "#f7768e" },
  selector: { color: "#9ece6a" },
  "attr-name": { color: "#bb9af7" },
  string: { color: "#9ece6a" },
  char: { color: "#9ece6a" },
  builtin: { color: "#7dcfff" },
  inserted: { color: "#9ece6a" },
  operator: { color: "#89ddff" },
  entity: { color: "#7aa2f7", cursor: "help" },
  url: { color: "#7dcfff" },
  ".language-css .token.string": { color: "#9ece6a" },
  ".style .token.string": { color: "#9ece6a" },
  atrule: { color: "#bb9af7" },
  "attr-value": { color: "#9ece6a" },
  keyword: { color: "#bb9af7" },
  function: { color: "#7aa2f7" },
  "class-name": { color: "#7dcfff" },
  regex: { color: "#73daca" },
  important: { color: "#ff9e64", fontWeight: "bold" },
  variable: { color: "#c0caf5" },
  bold: { fontWeight: "bold" },
  italic: { fontStyle: "italic" },
};

// Code block component with copy button and syntax highlighting
function CodeBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const language = className?.replace("language-", "") || "";
  const isSql =
    language === "sql" || language === "pgsql" || language === "postgresql";
  const theme = useThemeStore((s) => s.theme);

  const code = String(children).replace(/\n$/, "");

  const appendSql = useAIQueryStore((s) => s.appendSql);
  const setActiveTab = useAIQueryStore((s) => s.setActiveTab);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleAppendToRunner = useCallback(() => {
    appendSql(code);
    setActiveTab("query");
  }, [code, appendSql, setActiveTab]);

  const syntaxStyle = theme === "tokyo-night" ? tokyoNightStyle : oneDark;

  return (
    <div className="relative group my-2">
      <div className="flex items-center justify-between bg-card px-3 py-1.5 rounded-t-md border-b border-border">
        <span className="text-xs text-muted-foreground uppercase">
          {language || "code"}
        </span>
        <div className="flex items-center gap-2">
          {isSql && (
            <button
              onClick={handleAppendToRunner}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <PlayCircle className="h-3 w-3" />
              Add to Query
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
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
        style={syntaxStyle}
        customStyle={{
          margin: 0,
          borderRadius: "0 0 6px 6px",
          fontSize: "0.875rem",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// Inline code component
function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-secondary px-1.5 py-0.5 rounded text-blue-400 text-sm">
      {children}
    </code>
  );
}

export function AIChat() {
  const connection = useConnectionStore((s) => s.connection);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [openaiKey, setOpenaiKey] = useState(
    () => localStorage.getItem(API_KEY_STORAGE_KEY) || "",
  );
  const [anthropicKey, setAnthropicKey] = useState(
    () => localStorage.getItem(ANTHROPIC_KEY_STORAGE_KEY) || "",
  );
  const [showSettings, setShowSettings] = useState(false);
  const [tempOpenaiKey, setTempOpenaiKey] = useState("");
  const [tempAnthropicKey, setTempAnthropicKey] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelId>("gpt-5");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const agentRef = useRef<AIAgent | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Debug request from query editor
  const debugRequest = useAIQueryStore((s) => s.debugRequest);
  const clearDebugRequest = useAIQueryStore((s) => s.clearDebugRequest);

  // Last chat session persistence
  const setLastSession = useLastChatStore((s) => s.setLastSession);
  const getLastSession = useLastChatStore((s) => s.getLastSession);

  // Get the appropriate API key based on model provider
  const currentProvider = getModelProvider(selectedModel);
  const currentApiKey =
    currentProvider === "anthropic" ? anthropicKey : openaiKey;

  // Load chat history on mount and restore last session
  useEffect(() => {
    const history = loadChatHistory();
    setSessions(history);

    // Restore last session for this connection
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

  // Initialize agent when connection, API key, or model changes
  useEffect(() => {
    if (currentApiKey && connection?.id) {
      agentRef.current = new AIAgent(
        currentApiKey,
        connection.id,
        selectedModel,
      );
    } else {
      agentRef.current = null;
    }
  }, [currentApiKey, connection?.id, selectedModel]);

  // Auto-scroll to bottom
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
  const connectionSessions = sessions.filter(
    (s) => s.connectionId === connection?.id,
  );

  const handleSaveApiKeys = () => {
    setOpenaiKey(tempOpenaiKey);
    setAnthropicKey(tempAnthropicKey);
    localStorage.setItem(API_KEY_STORAGE_KEY, tempOpenaiKey);
    localStorage.setItem(ANTHROPIC_KEY_STORAGE_KEY, tempAnthropicKey);
    setShowSettings(false);
  };

  const handleNewChat = () => {
    if (!connection?.id) return;
    const session = createChatSession(connection.id, selectedModel);
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
    setSelectedModel(session.model as ModelId);

    // Reload agent with session history
    if (agentRef.current) {
      agentRef.current.loadFromSession(session);
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
      // Update session with empty messages
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
    agentRef.current?.setModel(model);

    // Update current session model
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
      // Update existing session
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
      // Create new session
      const session = createChatSession(connection.id, selectedModel);
      session.messages = updatedMessages;
      session.title = generateSessionTitle(updatedMessages);
      newSessions = [...sessions, session];
      setCurrentSessionId(session.id);
    }

    setSessions(newSessions);
    saveChatHistory(newSessions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !agentRef.current) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // Add loading indicator
    const loadingId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: loadingId, role: "assistant", content: "", isLoading: true },
    ]);

    try {
      // Use streaming API
      const stream = agentRef.current.chatStream(
        userMessage.content,
        (toolName, args) => {
          // Update loading message to show tool being called
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
        },
      );

      // Stream response chunks
      let fullContent = "";
      for await (const chunk of stream) {
        fullContent += chunk;
        // Update message content as chunks arrive
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? { ...m, content: fullContent, isLoading: true }
              : m,
          ),
        );
        // Keep scrolled to bottom while streaming
        scrollToBottom();
      }

      // Mark message as complete
      setMessages((prev) => {
        const updated = prev.map((m) =>
          m.id === loadingId ? { ...m, isLoading: false } : m,
        );
        // Save session after streaming completes
        saveCurrentSession(updated);
        return updated;
      });
    } catch (error) {
      setMessages((prev) => {
        const updated = prev.map((m) =>
          m.id === loadingId
            ? {
                ...m,
                content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
                isLoading: false,
              }
            : m,
        );
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!connection) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg">Connect to a database first</p>
          <p className="text-sm text-muted-foreground">
            The AI assistant needs an active connection
          </p>
        </div>
      </div>
    );
  }

  if (!currentApiKey) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center space-y-4">
          <Bot className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg">API Key Required</p>
          <p className="text-sm text-muted-foreground max-w-md">
            To use the AI assistant, you need to provide an API key. Your keys
            are stored locally and never sent to our servers.
          </p>
          <Button
            onClick={() => {
              setTempOpenaiKey(openaiKey);
              setTempAnthropicKey(anthropicKey);
              setShowSettings(true);
            }}
          >
            <Settings className="mr-2 h-4 w-4" />
            Configure API Keys
          </Button>
        </div>

        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>API Keys</DialogTitle>
              <DialogDescription>
                Enter your API keys to enable the AI assistant.
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
                <p className="text-xs text-muted-foreground">
                  Get your key from{" "}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    platform.openai.com
                  </a>
                </p>
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
                <p className="text-xs text-muted-foreground">
                  Get your key from{" "}
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    console.anthropic.com
                  </a>
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveApiKeys}
                disabled={!tempOpenaiKey.trim() && !tempAnthropicKey.trim()}
              >
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex h-full relative">
      {/* Chat History Sidebar */}
      <div
        className={cn(
          "flex flex-col border-r border-border bg-card/50 transition-all duration-200",
          sidebarOpen ? "w-64" : "w-0 overflow-hidden",
        )}
      >
        <div className="flex items-center justify-between border-b border-border p-3">
          <span className="text-sm font-medium text-muted-foreground">History</span>
          <Button variant="ghost" size="sm" onClick={handleNewChat}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {connectionSessions.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No chat history yet
              </p>
            ) : (
              connectionSessions
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleSelectSession(session.id)}
                    className={cn(
                      "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                      currentSessionId === session.id
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                    )}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{session.title}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      onClick={(e) => handleDeleteSession(session.id, e)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Toggle Sidebar Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="flex h-6 w-6 items-center justify-center self-center -ml-3 z-10 rounded-full border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground"
      >
        {sidebarOpen ? (
          <ChevronLeft className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="font-medium text-foreground">AI Assistant</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewChat}
              title="New Chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              disabled={messages.length === 0}
              title="Clear Chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTempOpenaiKey(openaiKey);
                setTempAnthropicKey(anthropicKey);
                setShowSettings(true);
              }}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <p>Ask me anything about your database!</p>
                <p className="text-sm text-muted-foreground">
                  Examples: "What tables do I have?" or "Show me the top 10
                  users"
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" && "justify-end",
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                      <Bot className="h-4 w-4 text-blue-400" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-4 py-2",
                      message.role === "user"
                        ? "bg-secondary text-foreground"
                        : "bg-secondary text-foreground",
                    )}
                  >
                    {message.isLoading && !message.content ? (
                      <div className="space-y-2">
                        {message.toolCalls?.length ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Wrench className="h-3 w-3" />
                            <span>Calling {message.toolCalls[message.toolCalls.length - 1].name}...</span>
                          </div>
                        ) : null}
                        <Skeleton className="h-4 w-48 bg-muted" />
                        <Skeleton className="h-4 w-36 bg-muted" />
                        <Skeleton className="h-4 w-24 bg-muted" />
                      </div>
                    ) : message.isLoading && message.content ? (
                      // Streaming state - show content with cursor
                      <>
                        {message.toolCalls && message.toolCalls.length > 0 && (
                          <div className="mb-2 space-y-1">
                            {message.toolCalls.map((tc) => (
                              <div
                                key={tc.id}
                                className="flex items-center gap-1 text-xs text-muted-foreground"
                              >
                                <Wrench className="h-3 w-3" />
                                <span>{tc.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
                          <ReactMarkdown
                            components={{
                              code({ className, children, ...props }) {
                                const isBlock =
                                  className?.includes("language-") ||
                                  String(children).includes("\n");
                                if (isBlock) {
                                  return (
                                    <CodeBlock className={className}>
                                      {children}
                                    </CodeBlock>
                                  );
                                }
                                return (
                                  <InlineCode {...props}>{children}</InlineCode>
                                );
                              },
                              pre({ children }) {
                                return <>{children}</>;
                              },
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                          <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-0.5" />
                        </div>
                      </>
                    ) : (
                      <>
                        {message.toolCalls && message.toolCalls.length > 0 && (
                          <div className="mb-2 space-y-1">
                            {message.toolCalls.map((tc) => (
                              <div
                                key={tc.id}
                                className="flex items-center gap-1 text-xs text-muted-foreground"
                              >
                                <Wrench className="h-3 w-3" />
                                <span>{tc.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
                          <ReactMarkdown
                            components={{
                              code({ className, children, ...props }) {
                                const isBlock =
                                  className?.includes("language-") ||
                                  String(children).includes("\n");
                                if (isBlock) {
                                  return (
                                    <CodeBlock className={className}>
                                      {children}
                                    </CodeBlock>
                                  );
                                }
                                return (
                                  <InlineCode {...props}>{children}</InlineCode>
                                );
                              },
                              pre({ children }) {
                                return <>{children}</>;
                              },
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <User className="h-4 w-4 text-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Input - Sticky at bottom */}
        <div className="sticky bottom-0 border-t border-border bg-background p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Select value={selectedModel} onValueChange={handleModelChange}>
              <SelectTrigger className="h-9 w-36 text-xs shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your database..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Settings</DialogTitle>
            <DialogDescription>
              Configure your API keys for the AI assistant.
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
              <p className="text-xs text-muted-foreground">
                Get your key from{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  platform.openai.com
                </a>
              </p>
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
              <p className="text-xs text-muted-foreground">
                Get your key from{" "}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  console.anthropic.com
                </a>
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveApiKeys}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
