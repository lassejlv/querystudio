import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { api } from "./api";
import type {
  AgentMessage,
  AgentToolCall,
  AgentEventType,
  ChatSession,
  AIModelId,
  AIModelInfo,
  AIProviderType,
  DatabaseType,
  Message,
  ToolCall,
} from "./types";

export type { AgentMessage, AgentToolCall, ChatSession, AIModelId, Message, ToolCall };

export const AI_MODELS: AIModelInfo[] = [
  { id: "gpt-5", name: "GPT-5", provider: "openai" },
  { id: "gpt-5-mini", name: "GPT-5 Mini", provider: "openai" },
];

export type ModelId = AIModelId;

export function getModelProvider(modelId: ModelId): AIProviderType {
  const model = AI_MODELS.find((m) => m.id === modelId);
  return model?.provider ?? "openai";
}

const CHAT_HISTORY_KEY = "querystudio_chat_history";
const MAX_SESSIONS = 50;

export function loadChatHistory(): ChatSession[] {
  try {
    const stored = localStorage.getItem(CHAT_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveChatHistory(sessions: ChatSession[]): void {
  const limited = sessions.slice(-MAX_SESSIONS);
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(limited));
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

  return lastSpace > 20 ? truncated.substring(0, lastSpace) + "..." : truncated + "...";
}

// ============================================================================
// Convert between frontend Message and backend AgentMessage
// ============================================================================

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

// ============================================================================
// AI Agent Class (Backend-based)
// ============================================================================

export class AIAgent {
  private connectionId: string;
  private model: ModelId;
  private apiKey: string;
  private dbType: DatabaseType;
  private messageHistory: Message[];
  private unlistenFn: UnlistenFn | null = null;
  private isCancelled: boolean = false;
  private pendingResolve: ((value: { done: boolean; value?: string }) => void) | null = null;

  constructor(
    apiKey: string,
    connectionId: string,
    dbType: DatabaseType,
    model: ModelId = "gpt-5",
  ) {
    this.apiKey = apiKey;
    this.connectionId = connectionId;
    this.dbType = dbType;
    this.model = model;
    this.messageHistory = [];
  }

  setModel(model: ModelId): void {
    this.model = model;
  }

  getModel(): ModelId {
    return this.model;
  }

  loadFromSession(session: ChatSession): void {
    this.messageHistory = session.messages.map(agentMessageToMessage);
    this.dbType = session.dbType;
  }

  clearHistory(): void {
    this.messageHistory = [];
  }

  /**
   * Stream a chat response from the backend
   */
  async *chatStream(
    userMessage: string,
    onToolCall?: (toolName: string, args: string) => void,
  ): AsyncGenerator<string, void, unknown> {
    const sessionId = crypto.randomUUID();

    // Reset cancelled state for new stream
    this.isCancelled = false;
    this.pendingResolve = null;

    // Prepare history for the backend
    const history: AgentMessage[] = this.messageHistory.map(messageToAgentMessage);

    // Set up event listener for streaming
    const eventName = `ai-stream-${sessionId}`;
    const chunks: string[] = [];
    let isDone = false;
    let error: string | null = null;
    let finalContent = "";
    const toolCalls: ToolCall[] = [];
    const pendingToolCalls: Map<string, ToolCall> = new Map();

    this.unlistenFn = await listen<AgentEventType>(eventName, (event) => {
      // Ignore events if cancelled
      if (this.isCancelled) return;

      const payload = event.payload;

      switch (payload.type) {
        case "Content":
          chunks.push(payload.data);
          if (this.pendingResolve) {
            this.pendingResolve({ done: false, value: payload.data });
            this.pendingResolve = null;
          }
          break;

        case "ToolCallStart": {
          const tc: ToolCall = {
            id: payload.data.id,
            name: payload.data.name,
            arguments: "",
          };
          pendingToolCalls.set(payload.data.id, tc);
          onToolCall?.(payload.data.name, "");
          break;
        }

        case "ToolCallDelta": {
          const tc = pendingToolCalls.get(payload.data.id);
          if (tc) {
            tc.arguments += payload.data.arguments;
          }
          break;
        }

        case "ToolResult": {
          const tc = pendingToolCalls.get(payload.data.id);
          if (tc) {
            tc.result = payload.data.result;
            toolCalls.push(tc);
            pendingToolCalls.delete(payload.data.id);
          }
          onToolCall?.(payload.data.name, payload.data.result);
          break;
        }

        case "Done":
          finalContent = payload.data.content;
          isDone = true;
          if (this.pendingResolve) {
            this.pendingResolve({ done: true });
            this.pendingResolve = null;
          }
          break;

        case "Error":
          error = payload.data;
          isDone = true;
          if (this.pendingResolve) {
            this.pendingResolve({ done: true });
            this.pendingResolve = null;
          }
          break;
      }
    });

    // Start the stream
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
    } catch (e) {
      this.cleanup();
      throw e;
    }

    // Yield chunks as they come in
    while (!isDone && !this.isCancelled) {
      if (chunks.length > 0) {
        yield chunks.shift()!;
      } else {
        // Wait for the next chunk
        await new Promise<{ done: boolean; value?: string }>((resolve) => {
          this.pendingResolve = resolve;
        });
        // Check if cancelled while waiting
        if (this.isCancelled) {
          break;
        }
        if (chunks.length > 0) {
          yield chunks.shift()!;
        }
      }
    }

    // Yield any remaining chunks (unless cancelled)
    while (chunks.length > 0 && !this.isCancelled) {
      yield chunks.shift()!;
    }

    this.cleanup();

    // If cancelled, throw a specific error
    if (this.isCancelled) {
      throw new Error("Request cancelled");
    }

    if (error) {
      throw new Error(error);
    }

    // Update message history
    this.messageHistory.push({
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
    });

    this.messageHistory.push({
      id: crypto.randomUUID(),
      role: "assistant",
      content: finalContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    });
  }

  /**
   * Send a message and get a complete response (non-streaming)
   */
  async chat(userMessage: string): Promise<string> {
    const history: AgentMessage[] = this.messageHistory.map(messageToAgentMessage);

    const response = await api.aiChat({
      connection_id: this.connectionId,
      session_id: crypto.randomUUID(),
      message: userMessage,
      model: this.model,
      api_key: this.apiKey,
      db_type: this.dbType,
      history,
    });

    // Update message history
    this.messageHistory.push({
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
    });

    this.messageHistory.push({
      id: crypto.randomUUID(),
      role: "assistant",
      content: response.content,
    });

    return response.content;
  }

  private cleanup(): void {
    if (this.unlistenFn) {
      this.unlistenFn();
      this.unlistenFn = null;
    }
    this.pendingResolve = null;
  }

  /**
   * Cancel the current stream
   */
  cancel(): void {
    this.isCancelled = true;
    // Resolve any pending promise to unblock the generator
    if (this.pendingResolve) {
      this.pendingResolve({ done: true });
      this.pendingResolve = null;
    }
    this.cleanup();
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get available AI models from the backend
 */
export async function getAvailableModels(): Promise<AIModelInfo[]> {
  try {
    return await api.aiGetModels();
  } catch {
    // Fall back to hardcoded models if backend is unavailable
    return AI_MODELS;
  }
}

/**
 * Validate an API key
 */
export async function validateApiKey(apiKey: string, model: ModelId = "gpt-5"): Promise<boolean> {
  try {
    return await api.aiValidateKey(apiKey, model);
  } catch {
    return false;
  }
}
