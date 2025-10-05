"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, FileText } from "lucide-react";
import { MessageRenderer } from "./messageTypes/MessageRenderer";
import type {
  Message,
  AssistantMessage,
  UserMessage,
  ReportMessage,
} from "./messageTypes/types";
import type { SDKMessage } from "@anthropic-ai/claude-code";
import { handleSDKMessage as processSDKMessage } from "./messageHandlers";
import { useChatSSE } from "../../hooks/chat/useChatSSE";
import { useWebSocket as useWebSocketHook } from "../../hooks/chat/useWebSocket";

interface ChatInterfaceProps {
  useWebSocket?: boolean;
  wsUrl?: string;
}

export default function ChatInterface({
  useWebSocket = true,
  wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000",
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentAssistantMessageRef = useRef<AssistantMessage | null>(null);
  const streamingContentRef = useRef<Map<string, string>>(new Map());
  const reportGeneratedRef = useRef<boolean>(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSDKMessage = (sdkMessage: SDKMessage) => {
    if (!currentAssistantMessageRef.current) return;

    // If a report has been generated, stop processing further streaming events
    if (reportGeneratedRef.current) return;

    setMessages((prev) => {
      const result = processSDKMessage(
        sdkMessage,
        currentAssistantMessageRef.current!,
        streamingContentRef.current
      );

      // Update refs
      currentAssistantMessageRef.current = result.updatedMessage;
      streamingContentRef.current = result.updatedStreamingContent;

      // Update messages array
      const newMessages = [...prev];
      const lastIndex = newMessages.length - 1;
      newMessages[lastIndex] = result.updatedMessage;

      // Add any additional messages (e.g., tool results, report)
      if (result.additionalMessages) {
        newMessages.push(...result.additionalMessages);

        // Check if a ReportMessage was generated - if so, stop further updates
        const hasReportMessage = result.additionalMessages.some(
          (msg) => msg.type === "report"
        );
        if (hasReportMessage) {
          reportGeneratedRef.current = true;
        }
      }

      return newMessages;
    });
  };

  const { sendMessageSSE } = useChatSSE({
    onSDKMessage: handleSDKMessage,
    setMessages,
    setIsLoading,
    currentAssistantMessageRef,
    streamingContentRef,
  });

  const { wsRef } = useWebSocketHook({
    enabled: useWebSocket,
    wsUrl,
    onSDKMessage: handleSDKMessage,
    setMessages,
    setIsLoading,
    currentAssistantMessageRef,
    streamingContentRef,
  });

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: UserMessage = {
      id: Date.now().toString(),
      type: "user",
      content: inputMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);
    reportGeneratedRef.current = false; // Reset for new query

    if (useWebSocket && wsRef.current?.readyState === WebSocket.OPEN) {
      // Use WebSocket for streaming
      wsRef.current.send(
        JSON.stringify({
          type: "chat",
          content: inputMessage,
        })
      );
    } else {
      // Use HTTP endpoint with SSE
      await sendMessageSSE(inputMessage);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full w-[80%] min-w-[400px] rounded-lg m-auto">
      <div className="p-4 border-gray-200 bg-white flex-shrink-0">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          Search A Company
          {useWebSocket && (
            <span className="text-xs text-gray-500">
              (
              {wsRef.current?.readyState === WebSocket.OPEN
                ? "Connected"
                : "Disconnected"}
              )
            </span>
          )}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 rounded-xl">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <h1>Note: It will take 5-20 minutes to generate a report.</h1>
            <p className="text-sm mt-2">
              Provide a company URL to get a comprehensive PE-level analysis
            </p>
          </div>
        ) : (
          messages.map((message, i) => (
            <MessageRenderer key={i} message={message} />
          ))
        )}
        {isLoading &&
          !useWebSocket &&
          messages[messages.length - 1]?.type !== "assistant" && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="px-4 py-2 rounded-lg bg-white border border-gray-200">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></span>
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></span>
                </div>
              </div>
            </div>
          )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Insert a URL (5-20 mins to generate a report)"
            disabled={isLoading}
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
