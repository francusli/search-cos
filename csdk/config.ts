/**
 * Centralized configuration for AI Client instances
 * This ensures all AI clients across the application use consistent settings
 */

import type { AIQueryOptions } from "./types";
import { SYSTEM_PROMPT } from "./prompts";
import * as path from "path";

// Tool list available for the AI
export const AI_TOOLS = [
  "Task",
  "Bash",
  "Glob",
  "Grep",
  "LS",
  "ExitPlanMode",
  "Read",
  "Edit",
  "MultiEdit",
  "Write",
  "NotebookEdit",
  "WebFetch",
  "TodoWrite",
  "WebSearch",
  "BashOutput",
  "KillBash",
];

const DEFAULT_MAX_TURNS = "100";
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

// Default AI client configuration
export const DEFAULT_AI_CONFIG: Partial<AIQueryOptions> = {
  maxTurns: parseInt(process.env.AI_MAX_TURNS || DEFAULT_MAX_TURNS),
  model: process.env.AI_MODEL || DEFAULT_MODEL,
  cwd: path.join(process.cwd(), "agent"),
  allowedTools: [...AI_TOOLS],
  appendSystemPrompt: SYSTEM_PROMPT,
};

// WebSocket server specific config (if needed)
export const WS_AI_CONFIG: Partial<AIQueryOptions> = {
  ...DEFAULT_AI_CONFIG,
  // Override any WebSocket-specific settings here if needed
};

// API route specific config (if needed)
export const API_AI_CONFIG: Partial<AIQueryOptions> = {
  ...DEFAULT_AI_CONFIG,
  // Override any API-specific settings here if needed
};
