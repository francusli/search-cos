export interface BaseMessage {
  id: string;
  timestamp: string;
  type: "user" | "assistant" | "system" | "report";
}

export interface UserMessage extends BaseMessage {
  type: "user";
  content: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ThinkingBlock {
  type: "thinking";
  text: string;
}

export interface ToolResult {
  tool_use_id: string;
  type: "tool_result";
  content: string;
}

export interface AssistantMessage extends BaseMessage {
  type: "assistant";
  content: (TextBlock | ToolUseBlock | ThinkingBlock)[];
  metadata?: {
    id: string;
    model: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      service_tier: string;
    };
  };
}

export interface SystemMessage extends BaseMessage {
  type: "system";
  content: string;
  metadata?: {
    type: string;
    subtype?: string;
    cwd?: string;
    session_id?: string;
    tools?: string[];
    model?: string;
    permissionMode?: string;
    slash_commands?: string[];
    apiKeySource?: string;
  };
}

export interface UserToolResultMessage extends BaseMessage {
  type: "user";
  content: ToolResult[];
  metadata: {
    role: "user";
    content: ToolResult[];
  };
}

export interface CompanyMetadata {
  company: string;
  url: string;
  industry: string;
  location: string;
  size: string;
  analyzed: string;
}

export interface PEFund {
  name: string;
  website?: string;
  investmentFocus: string;
  checkSize?: string;
  fitRationale: string;
  recentInvestments?: string[];
  contact?: string;
}

export interface ReportMessage extends BaseMessage {
  type: "report";
  metadata: CompanyMetadata;
  filePath: string;
  summary: string;
  peFunds?: PEFund[];
}

export type Message =
  | UserMessage
  | AssistantMessage
  | SystemMessage
  | UserToolResultMessage
  | ReportMessage;

export interface QueryData {
  slug: string;
  title: string;
  description: string;
  prompt: string;
  status: string;
  createdAt: string;
  messages: Message[];
}
