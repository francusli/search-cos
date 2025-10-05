import { useEffect, useRef } from "react";
import type { SDKMessage } from "@anthropic-ai/claude-code";
import type { AssistantMessage } from "@/components/Chat/messageTypes/types";

interface UseWebSocketProps {
  enabled: boolean;
  wsUrl: string;
  onSDKMessage: (sdkMessage: SDKMessage) => void;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  currentAssistantMessageRef: React.MutableRefObject<AssistantMessage | null>;
  streamingContentRef: React.MutableRefObject<Map<string, string>>;
}

const RECONNECT_DELAY = 3000; // 3 seconds

export function useWebSocket({
  enabled,
  wsUrl,
  onSDKMessage,
  setMessages,
  setIsLoading,
  currentAssistantMessageRef,
  streamingContentRef,
}: UseWebSocketProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const onSDKMessageRef = useRef(onSDKMessage);

  // Keep the callback ref up to date
  useEffect(() => {
    onSDKMessageRef.current = onSDKMessage;
  }, [onSDKMessage]);

  useEffect(() => {
    if (!enabled) return;

    const connectWebSocket = () => {
      try {
        console.log(
          "[ChatInterface] Attempting WebSocket connection to:",
          wsUrl
        );
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("[ChatInterface] WebSocket connected successfully");
        };

        ws.onmessage = (event) => {
          try {
            const wsMessage = JSON.parse(event.data);

            switch (wsMessage.type) {
              case "stream_start":
                // Initialize a new assistant message
                const newAssistantMessage: AssistantMessage = {
                  id: wsMessage.messageId || Date.now().toString(),
                  timestamp: new Date().toISOString(),
                  type: "assistant",
                  content: [],
                  metadata: {
                    id: wsMessage.messageId || "",
                    model: "",
                  },
                };
                currentAssistantMessageRef.current = newAssistantMessage;
                streamingContentRef.current.clear();
                setMessages((prev) => [...prev, newAssistantMessage]);
                break;

              case "sdk_message":
                const sdkMessage: SDKMessage = wsMessage.data;

                if (!currentAssistantMessageRef.current) {
                  // Create a new assistant message if we don't have one
                  currentAssistantMessageRef.current = {
                    id: wsMessage.messageId || Date.now().toString(),
                    timestamp: new Date().toISOString(),
                    type: "assistant",
                    content: [],
                    metadata: {
                      id: wsMessage.messageId || "",
                      model: "",
                    },
                  };
                  setMessages((prev) => [
                    ...prev,
                    currentAssistantMessageRef.current!,
                  ]);
                } else {
                  // Update timestamp for ongoing message to reflect current time
                  currentAssistantMessageRef.current.timestamp =
                    new Date().toISOString();
                }

                onSDKMessageRef.current(sdkMessage);
                break;

              case "stream_end":
                setIsLoading(false);
                currentAssistantMessageRef.current = null;
                streamingContentRef.current.clear();
                break;

              case "error":
                console.error("WebSocket error:", wsMessage.error);
                setIsLoading(false);
                break;
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("[ChatInterface] WebSocket error:", error);
          console.error("[ChatInterface] WS URL was:", wsUrl);
          setIsLoading(false);
        };

        ws.onclose = (event) => {
          console.log(
            "[ChatInterface] WebSocket disconnected. Code:",
            event.code,
            "Reason:",
            event.reason
          );
          setTimeout(connectWebSocket, RECONNECT_DELAY);
        };

        wsRef.current = ws;
      } catch (error) {
        console.error("[ChatInterface] Failed to connect WebSocket:", error);
        console.error("[ChatInterface] WS URL was:", wsUrl);
      }
    };

    console.log("[ChatInterface] Initializing WebSocket connection on mount");
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [enabled, wsUrl]);

  return { wsRef };
}
