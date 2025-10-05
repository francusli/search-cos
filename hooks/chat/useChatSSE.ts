import { useCallback, useRef } from "react";
import type {
  AssistantMessage,
  Message,
} from "@/components/Chat/messageTypes/types";
import type { SDKMessage } from "@anthropic-ai/claude-code";

interface UseChatSSEOptions {
  onSDKMessage: (sdkMessage: SDKMessage) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsLoading: (isLoading: boolean) => void;
  currentAssistantMessageRef: React.MutableRefObject<AssistantMessage | null>;
  streamingContentRef: React.MutableRefObject<Map<string, string>>;
}

export function useChatSSE({
  onSDKMessage,
  setMessages,
  setIsLoading,
  currentAssistantMessageRef,
  streamingContentRef,
}: UseChatSSEOptions) {
  const sendMessageSSE = useCallback(
    async (message: string) => {
      try {
        const response = await fetch("/api/claude", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: message,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get response");
        }

        // Handle SSE stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response body");
        }

        const assistantMessage: AssistantMessage = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          type: "assistant",
          content: [],
          metadata: {
            id: "",
            model: "",
          },
        };

        currentAssistantMessageRef.current = assistantMessage;
        streamingContentRef.current.clear();
        setMessages((prev) => [...prev, assistantMessage]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                setIsLoading(false);
                currentAssistantMessageRef.current = null;
                streamingContentRef.current.clear();
              } else {
                try {
                  const sdkMessage: SDKMessage = JSON.parse(data);
                  onSDKMessage(sdkMessage);
                } catch (e) {
                  console.error("Error parsing SSE data:", e);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error sending message:", error);
        const errorMessage: AssistantMessage = {
          id: Date.now().toString(),
          type: "assistant",
          content: [
            {
              type: "text",
              text: "Sorry, I encountered an error. Please try again.",
            },
          ],
          timestamp: new Date().toISOString(),
          metadata: {
            id: "",
            model: "",
          },
        };
        setMessages((prev) => [...prev, errorMessage]);
        setIsLoading(false);
      }
    },
    [
      onSDKMessage,
      setMessages,
      setIsLoading,
      currentAssistantMessageRef,
      streamingContentRef,
    ]
  );

  return { sendMessageSSE };
}
