import type { SDKUserMessage, SDKMessage } from "@anthropic-ai/claude-code";

export interface AIQueryOptions {
  maxTurns?: number;
  cwd?: string;
  model?: string;
  allowedTools?: string[];
  appendSystemPrompt?: string;
  mcpServers?: any;
  hooks?: any;
  userId?: string;
  userEmail?: string;
}

// Message types for WebSocket communication
export interface ChatMessage {
  type: "chat";
  content: string;
  sessionId?: string;
  newConversation?: boolean;
}

export interface SubscribeMessage {
  type: "subscribe";
  sessionId: string;
}

export interface UnsubscribeMessage {
  type: "unsubscribe";
  sessionId: string;
}

export interface RequestInboxMessage {
  type: "request_inbox";
}

export type IncomingMessage =
  | ChatMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | RequestInboxMessage;

// Re-export SDK types for convenience
export type { SDKUserMessage, SDKMessage };
