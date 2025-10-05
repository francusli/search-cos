import type {
  SDKMessage,
  SDKAssistantMessage,
  SDKUserMessage,
  SDKUserMessageReplay,
  SDKPartialAssistantMessage,
} from "@anthropic-ai/claude-code";
import type {
  AssistantMessage,
  UserMessage,
  TextBlock,
  ToolUseBlock,
  ThinkingBlock,
  Message,
  ReportMessage,
} from "./messageTypes/types";

/**
 * Handles SDK message processing and returns updated message state
 */
export interface MessageHandlerResult {
  updatedMessage: AssistantMessage;
  updatedStreamingContent: Map<string, string>;
  additionalMessages?: Message[];
}

/**
 * Main handler for SDK messages
 */
export function handleSDKMessage(
  sdkMessage: SDKMessage,
  currentMessage: AssistantMessage,
  streamingContent: Map<string, string>
): MessageHandlerResult {
  switch (sdkMessage.type) {
    case "assistant":
      return handleAssistantMessage(
        sdkMessage,
        currentMessage,
        streamingContent
      );

    case "stream_event":
      return handleStreamEvent(sdkMessage, currentMessage, streamingContent);

    case "user":
      return handleUserMessage(sdkMessage, currentMessage, streamingContent);

    default:
      return {
        updatedMessage: currentMessage,
        updatedStreamingContent: streamingContent,
      };
  }
}

/**
 * Handles assistant-type SDK messages
 */
function handleAssistantMessage(
  sdkMessage: SDKAssistantMessage,
  currentMessage: AssistantMessage,
  streamingContent: Map<string, string>
): MessageHandlerResult {
  const updatedMessage = {
    ...currentMessage,
    timestamp: new Date().toISOString(),
    metadata: {
      ...currentMessage.metadata,
      id: sdkMessage.message.id || currentMessage.metadata?.id || "",
      model: sdkMessage.message.model || currentMessage.metadata?.model || "",
    },
    content: (sdkMessage.message.content || []).map(transformContentBlock),
  };

  return {
    updatedMessage,
    updatedStreamingContent: streamingContent,
  };
}

/**
 * Transforms SDK content blocks to internal format
 */
function transformContentBlock(block: any) {
  switch (block.type) {
    case "thinking":
      return {
        type: "thinking",
        text: block.thinking || "",
      } as ThinkingBlock;

    case "text":
      return {
        type: "text",
        text: block.text || "",
      } as TextBlock;

    case "tool_use":
      return {
        type: "tool_use",
        id: block.id || "",
        name: block.name || "",
        input: block.input || {},
      } as ToolUseBlock;

    default:
      console.warn(`Unknown block type: ${block.type}`);
      return block;
  }
}

/**
 * Handles stream_event-type SDK messages
 */
function handleStreamEvent(
  sdkMessage: SDKPartialAssistantMessage,
  currentMessage: AssistantMessage,
  streamingContent: Map<string, string>
): MessageHandlerResult {
  const event = sdkMessage.event;
  const updatedMessage = {
    ...currentMessage,
    timestamp: new Date().toISOString(),
  };
  const updatedStreamingContent = new Map(streamingContent);

  switch (event.type) {
    case "message_start":
      return handleMessageStart(event, updatedMessage, updatedStreamingContent);

    case "content_block_start":
      return handleContentBlockStart(
        event,
        updatedMessage,
        updatedStreamingContent
      );

    case "content_block_delta":
      return handleContentBlockDelta(
        event,
        updatedMessage,
        updatedStreamingContent
      );

    case "content_block_stop":
      return handleContentBlockStop(
        event,
        updatedMessage,
        updatedStreamingContent
      );

    case "message_delta":
      return {
        updatedMessage,
        updatedStreamingContent,
      };

    default:
      return {
        updatedMessage,
        updatedStreamingContent,
      };
  }
}

/**
 * Handles message_start events
 */
function handleMessageStart(
  event: any,
  currentMessage: AssistantMessage,
  streamingContent: Map<string, string>
): MessageHandlerResult {
  if (!event.message) {
    return {
      updatedMessage: currentMessage,
      updatedStreamingContent: streamingContent,
    };
  }

  return {
    updatedMessage: {
      ...currentMessage,
      metadata: {
        ...currentMessage.metadata,
        id: event.message.id || currentMessage.metadata?.id || "",
        model: event.message.model || currentMessage.metadata?.model || "",
      },
    },
    updatedStreamingContent: streamingContent,
  };
}

/**
 * Handles content_block_start events
 */
function handleContentBlockStart(
  event: any,
  currentMessage: AssistantMessage,
  streamingContent: Map<string, string>
): MessageHandlerResult {
  if (!event.content_block) {
    return {
      updatedMessage: currentMessage,
      updatedStreamingContent: streamingContent,
    };
  }

  const blockIndex = event.index?.toString() || "0";
  const updatedStreamingContent = new Map(streamingContent);
  updatedStreamingContent.set(blockIndex, "");

  let newBlock;
  switch (event.content_block.type) {
    case "text":
      newBlock = {
        type: "text",
        text: event.content_block.text || "",
      } as TextBlock;
      break;

    case "thinking":
      newBlock = {
        type: "thinking",
        text: event.content_block.thinking || "",
      } as ThinkingBlock;
      break;

    case "tool_use":
      newBlock = {
        type: "tool_use",
        id: event.content_block.id || "",
        name: event.content_block.name || "",
        input: {},
      } as ToolUseBlock;
      break;

    default:
      return {
        updatedMessage: currentMessage,
        updatedStreamingContent,
      };
  }

  return {
    updatedMessage: {
      ...currentMessage,
      content: [...currentMessage.content, newBlock],
    },
    updatedStreamingContent,
  };
}

/**
 * Handles content_block_delta events
 */
function handleContentBlockDelta(
  event: any,
  currentMessage: AssistantMessage,
  streamingContent: Map<string, string>
): MessageHandlerResult {
  if (!event.delta || event.index === undefined) {
    return {
      updatedMessage: currentMessage,
      updatedStreamingContent: streamingContent,
    };
  }

  const blockIndex = event.index;
  if (blockIndex >= currentMessage.content.length) {
    return {
      updatedMessage: currentMessage,
      updatedStreamingContent: streamingContent,
    };
  }

  const block = currentMessage.content[blockIndex];
  const updatedStreamingContent = new Map(streamingContent);

  // Handle text delta (for text and thinking blocks)
  if (event.delta.type === "text_delta") {
    if (block.type === "text" || block.type === "thinking") {
      const accumulated =
        (streamingContent.get(blockIndex.toString()) || "") + event.delta.text;
      updatedStreamingContent.set(blockIndex.toString(), accumulated);

      const updatedContent = [...currentMessage.content];
      updatedContent[blockIndex] = {
        ...block,
        text: accumulated,
      };

      return {
        updatedMessage: {
          ...currentMessage,
          content: updatedContent,
        },
        updatedStreamingContent,
      };
    }
  }

  // Handle input_json_delta (for tool_use blocks)
  if (event.delta.type === "input_json_delta" && block.type === "tool_use") {
    const accumulated =
      (streamingContent.get(blockIndex.toString()) || "") +
      event.delta.partial_json;
    updatedStreamingContent.set(blockIndex.toString(), accumulated);

    // Try to parse accumulated JSON
    try {
      const input = JSON.parse(accumulated);
      const updatedContent = [...currentMessage.content];
      updatedContent[blockIndex] = {
        ...block,
        input,
      };

      return {
        updatedMessage: {
          ...currentMessage,
          content: updatedContent,
        },
        updatedStreamingContent,
      };
    } catch {
      // Keep accumulating if JSON is incomplete
      return {
        updatedMessage: currentMessage,
        updatedStreamingContent,
      };
    }
  }

  return {
    updatedMessage: currentMessage,
    updatedStreamingContent,
  };
}

/**
 * Handles content_block_stop events
 */
function handleContentBlockStop(
  event: any,
  currentMessage: AssistantMessage,
  streamingContent: Map<string, string>
): MessageHandlerResult {
  const updatedStreamingContent = new Map(streamingContent);
  if (event.index !== undefined) {
    updatedStreamingContent.delete(event.index.toString());
  }

  return {
    updatedMessage: currentMessage,
    updatedStreamingContent,
  };
}

/**
 * Handles user-type SDK messages (tool results)
 */
function handleUserMessage(
  sdkMessage: SDKUserMessage | SDKUserMessageReplay,
  currentMessage: AssistantMessage,
  streamingContent: Map<string, string>
): MessageHandlerResult {
  // Extract human-readable content from tool results
  const messageContent = sdkMessage.message.content;
  let displayContent: string;

  if (Array.isArray(messageContent)) {
    // Extract just the content field from tool results
    displayContent = messageContent
      .map((item: any) => {
        if (item.type === "tool_result" && item.content) {
          return typeof item.content === "string" ? item.content : JSON.stringify(item.content);
        }
        return typeof item === "string" ? item : JSON.stringify(item);
      })
      .join("\n");
  } else {
    displayContent = typeof messageContent === "string" ? messageContent : JSON.stringify(messageContent);
  }

  const toolResultMessage: UserMessage = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    type: "user",
    content: displayContent,
  };

  // Check if this is a Write tool result for an analysis report
  const reportMessage = detectAnalysisReport(currentMessage, sdkMessage);
  const additionalMessages: Message[] = reportMessage
    ? [toolResultMessage, reportMessage]
    : [toolResultMessage];

  return {
    updatedMessage: currentMessage,
    updatedStreamingContent: streamingContent,
    additionalMessages,
  };
}

/**
 * Detects if the current assistant message contains a Write tool use for an analysis report
 * Returns a ReportMessage if detected, otherwise null
 */
function detectAnalysisReport(
  assistantMessage: AssistantMessage,
  userMessage: SDKUserMessage | SDKUserMessageReplay
): ReportMessage | null {
  // Find Write tool use in assistant message
  const writeToolUse = assistantMessage.content.find(
    (block) => block.type === "tool_use" && block.name === "Write"
  ) as ToolUseBlock | undefined;

  if (!writeToolUse) return null;

  const filePath = writeToolUse.input?.file_path;
  if (!filePath || typeof filePath !== "string") return null;

  // Check if it's an analysis report file in logs/
  if (!filePath.includes("logs/") || !filePath.endsWith("-analysis.md")) {
    return null;
  }

  // Extract content from Write tool
  const fileContent = writeToolUse.input?.content;
  if (!fileContent || typeof fileContent !== "string") return null;

  // Parse metadata from YAML front matter
  const metadata = parseReportMetadata(fileContent);
  if (!metadata) return null;

  // Extract summary from assistant's text blocks
  const summary = extractSummary(assistantMessage, fileContent);

  // Extract PE funds from the file content
  const peFunds = extractPEFunds(fileContent);

  const reportMessage: ReportMessage = {
    id: Date.now().toString() + "-report",
    timestamp: new Date().toISOString(),
    type: "report",
    metadata,
    filePath,
    summary,
    peFunds,
  };

  return reportMessage;
}

/**
 * Parses YAML metadata from markdown file content
 */
function parseReportMetadata(content: string) {
  const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!yamlMatch) return null;

  const yamlContent = yamlMatch[1];
  const metadata: any = {};

  const lines = yamlContent.split("\n");
  for (const line of lines) {
    const [key, ...valueParts] = line.split(":");
    if (key && valueParts.length > 0) {
      const value = valueParts.join(":").trim();
      metadata[key.trim()] = value;
    }
  }

  if (
    !metadata.company ||
    !metadata.url ||
    !metadata.industry ||
    !metadata.location ||
    !metadata.size ||
    !metadata.analyzed
  ) {
    return null;
  }

  return metadata;
}

/**
 * Extracts a summary from the assistant's text or from the report content
 */
function extractSummary(
  assistantMessage: AssistantMessage,
  fileContent: string
): string {
  // Try to find "Key Findings:" section in assistant's text blocks
  const textBlocks = assistantMessage.content.filter(
    (block) => block.type === "text"
  ) as TextBlock[];

  for (const block of textBlocks) {
    if (block.text.includes("Key Findings:")) {
      // Extract key findings section (between "Key Findings:" and "Shortlist of P.E Buyers:")
      const findingsMatch = block.text.match(
        /Key Findings:\s*\n([\s\S]*?)(?=\n\s*Shortlist of P\.E Buyers:|$)/i
      );
      if (findingsMatch) {
        return findingsMatch[1].trim();
      }
    }
  }

  // Fallback: extract executive summary from file content
  const execSummaryMatch = fileContent.match(
    /##\s*Executive Summary\s*\n+([\s\S]*?)(?=\n##|$)/i
  );
  if (execSummaryMatch) {
    return execSummaryMatch[1].trim().substring(0, 500) + "...";
  }

  return "Company analysis report generated.";
}

/**
 * Extracts PE fund information from the report content
 */
function extractPEFunds(content: string) {
  // Look for PE Fund Shortlist section - capture until next ### or ## heading
  // Handles both "## PE Fund Shortlist" and "## 9. PE Fund Shortlist" formats
  const peFundsMatch = content.match(
    /##\s*(?:\d+\.\s*)?PE Fund Shortlist[^\n]*\n+([\s\S]*?)(?=\n###|\n##|$)/i
  );
  if (!peFundsMatch) return undefined;

  const peFundsSection = peFundsMatch[1];

  // Extract table: from first | to last line that contains |
  const lines = peFundsSection.split('\n');
  const tableLines: string[] = [];
  let inTable = false;

  for (const line of lines) {
    if (line.includes('|')) {
      inTable = true;
      tableLines.push(line);
    } else if (inTable && line.trim() === '') {
      // Empty line after table starts - check if there are more table lines
      continue;
    } else if (inTable && !line.includes('|')) {
      // Non-table content after table started, stop
      break;
    }
  }

  if (tableLines.length >= 3) {
    return parsePEFundsTable(tableLines.join('\n'));
  }

  // Fallback: return empty array if section exists but couldn't parse
  return [];
}

/**
 * Parses PE funds from a markdown table
 */
function parsePEFundsTable(tableContent: string) {
  const lines = tableContent.split("\n").filter((line) => line.trim());
  if (lines.length < 3) return [];

  // Parse header to check if first column is "#" (row number)
  const headerLine = lines[0];
  const headerCells = headerLine
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);

  // Check if first column is "#" or similar (row number indicator)
  const hasRowNumberColumn = headerCells[0] === "#" || headerCells[0] === "No" || /^\d+$/.test(headerCells[0]);
  const columnOffset = hasRowNumberColumn ? 1 : 0; // Skip first column if it's row numbers

  // Skip header and separator lines
  const dataLines = lines.slice(2);

  return dataLines
    .map((line) => {
      const cells = line
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);
      if (cells.length < 3) return null;

      // Extract fund name, removing markdown bold syntax (**text**)
      const rawName = cells[columnOffset] || "";
      const name = rawName.replace(/\*\*/g, "").trim();

      // Detect table structure dynamically based on actual columns
      // Common format: | PE Firm / Platform | Investment Focus | Why They're a Good Fit | Recent Activity | Contact |
      // OR:            | # | Fund/Platform | Headquarters | Investment Focus | Check Size | Recent Activity | Fit Rationale | Contact |

      // For the simpler 5-column format (without row numbers):
      if (cells.length <= 5 && !hasRowNumberColumn) {
        const contact = cells[4] || undefined;
        let website = undefined;
        if (contact) {
          const urlMatch = contact.match(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/);
          if (urlMatch) {
            website = urlMatch[0].startsWith("www.") ? "https://" + urlMatch[0] : urlMatch[0];
          }
        }
        return {
          name,
          website,
          investmentFocus: cells[1] || "", // Investment Focus
          checkSize: undefined,
          fitRationale: cells[2] || "", // Why They're a Good Fit
          recentInvestments: cells[3] ? cells[3].split(";").map((s) => s.trim()) : undefined, // Recent Activity
          contact, // Contact
        };
      }

      // For the 5-column format with row numbers:
      if (cells.length <= 6 && hasRowNumberColumn) {
        const contact = cells[5] || undefined;
        let website = undefined;
        if (contact) {
          const urlMatch = contact.match(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/);
          if (urlMatch) {
            website = urlMatch[0].startsWith("www.") ? "https://" + urlMatch[0] : urlMatch[0];
          }
        }
        return {
          name,
          website,
          investmentFocus: cells[2] || "", // Investment Focus
          checkSize: undefined,
          fitRationale: cells[3] || "", // Why They're a Good Fit
          recentInvestments: cells[4] ? cells[4].split(";").map((s) => s.trim()) : undefined, // Recent Activity
          contact, // Contact
        };
      }

      // For the full 8-column format: # | Fund/Platform | Headquarters | Investment Focus | Check Size | Recent Activity | Fit Rationale | Contact
      const contact = cells[columnOffset + 6] || undefined;
      let website = undefined;
      if (contact) {
        const urlMatch = contact.match(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/);
        if (urlMatch) {
          website = urlMatch[0].startsWith("www.") ? "https://" + urlMatch[0] : urlMatch[0];
        }
      }
      return {
        name,
        website,
        investmentFocus: cells[columnOffset + 2] || "", // Investment Focus
        checkSize: cells[columnOffset + 3] || undefined, // Check Size
        fitRationale: cells[columnOffset + 5] || "", // Fit Rationale
        recentInvestments: cells[columnOffset + 4] ? cells[columnOffset + 4].split(";").map((s) => s.trim()) : undefined, // Recent Activity
        contact, // Contact
      };
    })
    .filter((fund) => fund !== null);
}
