import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";
import { api } from "./api";
import type {
  AgentMessage,
  AgentEventType,
  ChatSession,
  AIModelId,
  AIModelInfo,
  AIProviderType,
  DatabaseType,
  Message,
  ToolCall,
} from "./types";

// Re-export types for convenience
export type {
  AgentMessage,
  AgentToolCall,
  ChatSession,
  AIModelId,
  Message,
  ToolCall,
} from "./types";

export type ModelId = AIModelId;

export interface ToolCallUpdate {
  id: string;
  name: string;
  status: "start" | "result";
  arguments?: string;
  result?: string;
}

export const AI_MODELS: AIModelInfo[] = [
  { id: "gpt-5", name: "GPT-5", provider: "openai" },
  { id: "gpt-5-mini", name: "GPT-5 Mini", provider: "openai" },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", provider: "google" },
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", provider: "google" },
];

export function getModelProvider(modelId: ModelId): AIProviderType {
  const known = AI_MODELS.find((m) => m.id === modelId)?.provider;
  if (known) return known;
  if (modelId.startsWith("anthropic/")) return "anthropic";
  if (modelId.startsWith("google/") || modelId.startsWith("gemini-")) return "google";
  if (modelId.startsWith("openrouter/")) return "openrouter";
  if (modelId.startsWith("vercel/")) return "vercel";
  if (modelId.startsWith("copilot/")) return "copilot";
  if (modelId.startsWith("opencode/")) return "opencode";
  return "openai";
}

// --- Chat History Management ---

const CHAT_HISTORY_KEY = "querystudio_chat_history";
const MAX_SESSIONS = 50;

function loadChatHistoryFromLocalStorage(): ChatSession[] {
  try {
    const stored = localStorage.getItem(CHAT_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveChatHistoryToLocalStorage(sessions: ChatSession[]): ChatSession[] {
  const limited = sessions.slice(-MAX_SESSIONS);
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(limited));
  return limited;
}

export async function loadChatHistory(): Promise<ChatSession[]> {
  if (isTauri()) {
    try {
      const sessions = await api.getChatHistory();
      if (sessions.length > 0) {
        return sessions;
      }

      // One-time migration path from legacy browser storage into file-backed storage.
      const legacy = loadChatHistoryFromLocalStorage();
      if (legacy.length > 0) {
        return await api.setChatHistory(legacy.slice(-MAX_SESSIONS));
      }

      return sessions;
    } catch {
      return loadChatHistoryFromLocalStorage();
    }
  }

  return loadChatHistoryFromLocalStorage();
}

export async function saveChatHistory(sessions: ChatSession[]): Promise<ChatSession[]> {
  const limited = sessions.slice(-MAX_SESSIONS);
  saveChatHistoryToLocalStorage(limited);

  if (isTauri()) {
    try {
      return await api.setChatHistory(limited);
    } catch {
      return limited;
    }
  }

  return limited;
}

export function createChatSession(
  connectionId: string,
  model: ModelId,
  dbType: DatabaseType,
): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: "New Chat",
    messages: [],
    model,
    connectionId,
    dbType,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function generateSessionTitle(messages: Message[]): string {
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (!firstUserMessage) return "New Chat";

  const content = firstUserMessage.content.trim();
  const maxLength = 40;

  if (content.length <= maxLength) return content;

  const truncated = content.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  return lastSpace > 20 ? `${truncated.substring(0, lastSpace)}...` : `${truncated}...`;
}

// --- Data Conversion ---

export function messageToAgentMessage(msg: Message): AgentMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    tool_calls: msg.toolCalls?.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments,
      result: tc.result,
    })),
  };
}

export function agentMessageToMessage(msg: AgentMessage): Message {
  return {
    id: msg.id,
    role: msg.role as Message["role"],
    content: msg.content,
    toolCalls: msg.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments,
      result: tc.result,
    })),
  };
}

// --- AI Agent ---

export class AIAgent {
  private messageHistory: Message[] = [];
  private unlistenFn: UnlistenFn | null = null;
  private isCancelled: boolean = false;
  private signalNext: (() => void) | null = null;

  constructor(
    private apiKey: string,
    private connectionId: string,
    private dbType: DatabaseType,
    private model: ModelId = "gpt-5",
  ) {}

  setModel(model: ModelId) {
    this.model = model;
  }
  getModel() {
    return this.model;
  }

  loadFromSession(session: ChatSession): void {
    this.messageHistory = session.messages.map(agentMessageToMessage);
    this.dbType = session.dbType;
  }

  clearHistory(): void {
    this.messageHistory = [];
  }

  cancel(): void {
    this.isCancelled = true;
    this.notifyStream();
    this.cleanup();
  }

  async chat(userMessage: string): Promise<string> {
    const history = this.messageHistory.map(messageToAgentMessage);

    const response = await api.aiChat({
      connection_id: this.connectionId,
      session_id: crypto.randomUUID(),
      message: userMessage,
      model: this.model,
      api_key: this.apiKey,
      db_type: this.dbType,
      history,
    });

    this.addToHistory("user", userMessage);
    this.addToHistory("assistant", response.content);

    return response.content;
  }

  async *chatStream(
    userMessage: string,
    onToolCall?: (update: ToolCallUpdate) => void,
  ): AsyncGenerator<string, void, unknown> {
    const sessionId = crypto.randomUUID();
    this.isCancelled = false;
    this.signalNext = null;

    const history = this.messageHistory.map(messageToAgentMessage);
    const eventName = `ai-stream-${sessionId}`;

    console.info(
      `[AIAgent] stream start [session=${sessionId}] model=${this.model} conn=${this.connectionId} db=${this.dbType}`,
    );
    console.debug(
      `[AIAgent] stream message preview [session=${sessionId}]: ${userMessage.slice(0, 100)}`,
    );

    // Stream state
    const chunkQueue: string[] = [];
    const pendingToolCalls = new Map<string, ToolCall>();
    const completedToolCalls: ToolCall[] = [];
    let finalContent = "";
    let error: string | null = null;
    let isDone = false;
    let eventCount = 0;
    let contentChunkCount = 0;

    // Listen for backend events
    this.unlistenFn = await listen<AgentEventType>(eventName, (event) => {
      if (this.isCancelled) return;

      const { type, data } = event.payload;
      eventCount += 1;
      console.debug(`[AIAgent] stream event [session=${sessionId}] #${eventCount}: ${type}`);

      switch (type) {
        case "Content":
          contentChunkCount += 1;
          chunkQueue.push(data);
          this.notifyStream();
          break;

        case "ToolCallStart":
          console.info(
            `[AIAgent] tool start [session=${sessionId}] id=${data.id} name=${data.name}`,
          );
          pendingToolCalls.set(data.id, { id: data.id, name: data.name, arguments: "" });
          onToolCall?.({
            id: data.id,
            name: data.name,
            status: "start",
            arguments: "",
          });
          break;

        case "ToolCallDelta":
          const deltaTc = pendingToolCalls.get(data.id);
          if (deltaTc) deltaTc.arguments += data.arguments;
          break;

        case "ToolResult":
          const resultTc = pendingToolCalls.get(data.id);
          if (resultTc) {
            console.info(
              `[AIAgent] tool result [session=${sessionId}] id=${data.id} name=${data.name}`,
            );
            resultTc.result = data.result;
            completedToolCalls.push(resultTc);
            pendingToolCalls.delete(data.id);
            onToolCall?.({
              id: data.id,
              name: data.name,
              status: "result",
              result: data.result,
            });
          }
          break;

        case "Done":
          finalContent = data.content;
          isDone = true;
          console.info(
            `[AIAgent] stream done [session=${sessionId}] events=${eventCount} chunks=${contentChunkCount} tools=${completedToolCalls.length} chars=${finalContent.length}`,
          );
          this.notifyStream();
          break;

        case "Error":
          error = data;
          isDone = true;
          console.error(`[AIAgent] stream error [session=${sessionId}]:`, data);
          this.notifyStream();
          break;
      }
    });

    try {
      await api.aiChatStream({
        connection_id: this.connectionId,
        session_id: sessionId,
        message: userMessage,
        model: this.model,
        api_key: this.apiKey,
        db_type: this.dbType,
        history,
      });

      // Stream Generator Loop
      while (!isDone && !this.isCancelled) {
        if (chunkQueue.length > 0) {
          yield chunkQueue.shift()!;
        } else {
          // Wait for next event signal
          await new Promise<void>((resolve) => {
            this.signalNext = resolve;
          });
        }
      }

      // Flush remaining chunks
      while (chunkQueue.length > 0 && !this.isCancelled) {
        yield chunkQueue.shift()!;
      }

      if (this.isCancelled) throw new Error("Request cancelled");
      if (error) throw new Error(error);

      // Save complete interaction to history
      this.addToHistory("user", userMessage);
      this.addToHistory("assistant", finalContent, completedToolCalls);
    } finally {
      if (this.isCancelled) {
        console.info(
          `[AIAgent] stream cancelled [session=${sessionId}] events=${eventCount} chunks=${contentChunkCount}`,
        );
      }
      this.cleanup();
    }
  }

  private notifyStream() {
    if (this.signalNext) {
      this.signalNext();
      this.signalNext = null;
    }
  }

  private addToHistory(role: "user" | "assistant", content: string, toolCalls?: ToolCall[]) {
    this.messageHistory.push({
      id: crypto.randomUUID(),
      role,
      content,
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    });
  }

  private cleanup(): void {
    if (this.unlistenFn) {
      this.unlistenFn();
      this.unlistenFn = null;
    }
    this.signalNext = null;
  }
}

// --- Helpers ---

export async function getAvailableModels(): Promise<AIModelInfo[]> {
  try {
    return await api.aiGetModels();
  } catch {
    return AI_MODELS;
  }
}

export async function validateApiKey(apiKey: string, model: ModelId = "gpt-5"): Promise<boolean> {
  try {
    return await api.aiValidateKey(apiKey, model);
  } catch {
    return false;
  }
}
