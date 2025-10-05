/// <reference types="bun" />
import { AIClient } from "../csdk/ai-client";
import { WS_AI_CONFIG } from "../csdk/config";
import type {
  SDKMessage,
  SDKUserMessage,
  SDKAssistantMessage,
} from "@anthropic-ai/claude-code";

const aiClient = new AIClient(WS_AI_CONFIG);

interface WSMessage {
  type: "sdk_message" | "error" | "stream_start" | "stream_end";
  data?: SDKMessage;
  error?: string;
  messageId?: string;
}

interface WSIncomingMessage {
  type: "chat";
  content: string;
  userId?: string;
  userEmail?: string;
}

// Store conversation history per WebSocket connection
const conversationHistory = new WeakMap<
  any,
  (SDKUserMessage | SDKAssistantMessage)[]
>();

const port = parseInt(Bun.env.PORT || Bun.env.WS_PORT || "8000");

const server = Bun.serve({
  port,
  hostname: "0.0.0.0",

  fetch(req, server) {
    const url = new URL(req.url);
    console.log(
      `[WS-Server] ${req.method} ${url.pathname} from ${
        req.headers.get("x-forwarded-for") || "unknown"
      }`
    );

    // Handle WebSocket upgrade
    if (server.upgrade(req)) {
      console.log("[WS-Server] WebSocket upgrade successful");
      return; // Connection upgraded to WebSocket
    }

    // Handle regular HTTP requests (health check for Render)
    console.log("[WS-Server] Handling as HTTP request (not WebSocket upgrade)");

    // Health check endpoint
    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "WebSocket AI Chat Server",
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Default response for other paths
    return new Response("WebSocket server for AI chat", {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  },

  websocket: {
    async message(ws, message) {
      try {
        const data = JSON.parse(message.toString());
        console.log("[WS-Server] Received message:", data.type);

        if (data.type === "chat" && data.content) {
          const messageId = Date.now().toString();
          console.log("[WS-Server] Processing chat message:", messageId);

          // Get or initialize conversation history for this connection
          let history = conversationHistory.get(ws);
          if (!history) {
            history = [];
            conversationHistory.set(ws, history);
          }

          // Add user message to history
          const userMessage: SDKUserMessage = {
            type: "user",
            message: {
              role: "user",
              content: data.content,
            },
            parent_tool_use_id: null,
            session_id: messageId,
          };
          history.push(userMessage);

          // Send stream start
          ws.send(
            JSON.stringify({
              type: "stream_start",
              messageId,
            } as WSMessage)
          );

          // Create an async generator that yields only user messages from history
          const conversationGenerator =
            async function* (): AsyncGenerator<SDKUserMessage> {
              for (const msg of history!) {
                if (msg.type === "user") {
                  yield msg as SDKUserMessage;
                }
              }
            };

          // Collect assistant messages during streaming
          const assistantMessages: SDKAssistantMessage[] = [];

          // Stream all SDK messages with full conversation history
          for await (const sdkMessage of aiClient.queryStream(
            conversationGenerator(),
            {
              userId: data.userId,
              userEmail: data.userEmail,
            }
          )) {
            // Collect assistant messages
            if (sdkMessage.type === "assistant") {
              assistantMessages.push(sdkMessage as SDKAssistantMessage);
            }

            // Send each SDK message as-is for the client to handle
            ws.send(
              JSON.stringify({
                type: "sdk_message",
                data: sdkMessage,
                messageId,
              } as WSMessage)
            );
          }

          // Add assistant messages to conversation history
          for (const assistantMessage of assistantMessages) {
            history.push(assistantMessage);
          }

          // Send stream end
          ws.send(
            JSON.stringify({
              type: "stream_end",
              messageId,
            } as WSMessage)
          );
        }
      } catch (error) {
        console.error("WebSocket error:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          } as WSMessage)
        );
      }
    },

    open(ws) {
      console.log("[WS-Server] WebSocket connection opened");
      console.log("[WS-Server] Active connections:", server.pendingWebSockets);
      // Initialize empty conversation history
      conversationHistory.set(ws, []);
    },

    close(ws, code, message) {
      console.log(`[WS-Server] WebSocket closed with code ${code}: ${message}`);
      console.log(
        "[WS-Server] Remaining connections:",
        server.pendingWebSockets
      );
      // WeakMap automatically cleans up, but we can explicitly delete
      conversationHistory.delete(ws);
    },
  },
});

console.log(`WebSocket server running on ws://localhost:${server.port}`);

// Note: Bun handles SIGINT automatically, but we can add custom cleanup if needed
// The server will stop gracefully when the process exits
