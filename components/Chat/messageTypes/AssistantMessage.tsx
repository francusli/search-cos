import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AssistantMessage as AssistantMessageType,
  TextBlock,
  ThinkingBlock,
} from "./types";
import { formatTimestamp } from "../../../utils/utils";
import { ToolUseComponent } from "./ToolUseComponent";
import { Brain } from "lucide-react";

interface AssistantMessageProps {
  message: AssistantMessageType;
}

function LoadingDots() {
  return (
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
  );
}

function TextComponent({ text }: { text: TextBlock }) {
  // Show loading dots if text is empty
  if (!text.text || text.text.trim() === "") {
    return (
      <div className="text-sm text-gray-900">
        <LoadingDots />
      </div>
    );
  }

  // Hide text that contains "Analysis complete" with "Key Findings" - this will be shown in ReportMessage
  if (text.text.includes("Analysis complete") && text.text.includes("Key Findings:")) {
    return null;
  }

  // Parse the text to replace [email:ID] with EmailDisplay components
  const processContent = (content: string) => {
    // Split by email references - now supports message IDs like <abc123@example.com>
    const parts = content.split(/\[email:([^\]]+)\]/g);
    const result: React.ReactNode[] = [];

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // Regular text part - render with markdown
        if (parts[i]) {
          result.push(
            <div key={i} className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Customize link rendering
                  a: ({ node, ...props }) => (
                    <a
                      {...props}
                      className="text-gray-900 hover:text-gray-600 underline"
                    />
                  ),
                  // Customize code rendering
                  code: ({ children, ...props }) => {
                    // Check if it's inline code by looking at the props
                    const isInline = !props.className?.includes("language-");
                    return isInline ? (
                      <code
                        className="bg-gray-100 px-1 py-0.5 text-xs font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <code
                        className="block bg-gray-100 p-2 text-xs font-mono overflow-x-auto border border-gray-200"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  // Customize list rendering
                  ul: ({ node, ...props }) => (
                    <ul className="list-disc pl-5 space-y-1" {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol className="list-decimal pl-5 space-y-1" {...props} />
                  ),
                  // Customize paragraph spacing
                  p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                }}
              >
                {parts[i]}
              </ReactMarkdown>
            </div>
          );
        }
      }
    }

    return <>{result}</>;
  };

  return (
    <div className="text-sm text-gray-900">{processContent(text.text)}</div>
  );
}

function ThinkingComponent({ thinking }: { thinking: ThinkingBlock }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-purple-200 bg-purple-50 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-purple-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-600" />
          <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">
            Extended Thinking
          </span>
        </div>
        <span className="text-xs text-purple-600">
          {isExpanded ? "Hide" : "Show"}
        </span>
      </button>
      {isExpanded && (
        <div className="p-3 border-t border-purple-200 bg-white">
          <div className="text-sm text-gray-700 prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {thinking.text}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  // Check if this message only contains the "Analysis complete" summary text
  // If so, don't render it - the ReportMessage will show it instead
  const hasOnlySummaryText = message.content.length > 0 &&
    message.content.every(block => {
      if (block.type === "text") {
        return block.text.includes("Analysis complete") && block.text.includes("Key Findings:");
      }
      // Allow tool_use blocks (they should still be visible)
      return block.type === "tool_use" || block.type === "thinking";
    });

  // Check if message has any visible text content
  const hasVisibleContent = message.content.some(block => {
    if (block.type === "text") {
      return !(block.text.includes("Analysis complete") && block.text.includes("Key Findings:"));
    }
    return true; // tool_use and thinking are always visible
  });

  // Don't render if no visible content
  if (message.content.length > 0 && !hasVisibleContent) {
    return null;
  }

  return (
    <div className="mb-3 p-3 bg-gray-50 border border-gray-200">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            ASSISTANT
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {formatTimestamp(message.timestamp)}
        </span>
      </div>

      <div className="space-y-2">
        {message.content.length === 0 ? (
          <LoadingDots />
        ) : (
          message.content.map((block, index) => {
            if (block.type === "text") {
              return <TextComponent key={index} text={block} />;
            } else if (block.type === "thinking") {
              return <ThinkingComponent key={index} thinking={block} />;
            } else if (block.type === "tool_use") {
              return <ToolUseComponent key={index} toolUse={block} />;
            }
            return null;
          })
        )}
      </div>
    </div>
  );
}
