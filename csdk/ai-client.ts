import { query } from "@anthropic-ai/claude-code";
import type { HookJSONOutput } from "@anthropic-ai/claude-code";
import * as path from "path";
import type { AIQueryOptions, SDKMessage, SDKUserMessage } from "./types";
import { DEFAULT_AI_CONFIG } from "./config";
import { logger, logToolExecution } from "./logger";

// Tool list is now imported from config.ts
export class AIClient {
  private defaultOptions: AIQueryOptions;

  constructor(options?: Partial<AIQueryOptions>) {
    logger.info("Initializing AIClient", { options });

    this.defaultOptions = {
      ...DEFAULT_AI_CONFIG,
      cwd: path.join(process.cwd(), "agent"),
      hooks: {
        PreToolUse: [
          {
            matcher: "Write|Edit|MultiEdit",
            hooks: [
              async (input: any): Promise<HookJSONOutput> => {
                const toolName = input.tool_name;
                const toolInput = input.tool_input;

                logToolExecution(toolName, "start", { input: toolInput });

                if (!["Write", "Edit", "MultiEdit"].includes(toolName)) {
                  return { continue: true };
                }

                let filePath = "";
                if (toolName === "Write" || toolName === "Edit") {
                  filePath = toolInput.file_path || "";
                } else if (toolName === "MultiEdit") {
                  filePath = toolInput.file_path || "";
                }

                // Agent should only write to custom_scripts directory
                const ext = path.extname(filePath).toLowerCase();
                if (ext === ".js" || ext === ".ts") {
                  const customScriptsPath = path.join(
                    process.cwd(),
                    "agent",
                    "custom_scripts"
                  );

                  // Resolve the file path to absolute if it's relative
                  const resolvedPath = path.isAbsolute(filePath)
                    ? filePath
                    : path.resolve(process.cwd(), "agent", filePath);

                  if (!resolvedPath.startsWith(customScriptsPath)) {
                    const reason = `Script files (.js and .ts) must be written to the custom_scripts directory. Please use the path: ${customScriptsPath}/${path.basename(
                      filePath
                    )}`;
                    logToolExecution(toolName, "blocked", { filePath, reason });
                    return {
                      decision: "block",
                      stopReason: reason,
                      continue: false,
                    };
                  }
                }

                return { continue: true };
              },
            ],
          },
        ],
      },
      ...options,
    };
  }

  async *queryStream(
    prompt: string | AsyncIterable<SDKUserMessage>,
    options?: Partial<AIQueryOptions>
  ): AsyncIterable<SDKMessage> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    logger.info("Query stream started", {
      prompt:
        typeof prompt === "string"
          ? prompt.substring(0, 100)
          : "<async-iterable>",
      model: mergedOptions.model,
    });

    for await (const message of query({
      prompt: prompt,
      options: mergedOptions,
    })) {
      // Log every message in a simple format
      logger.info(`Message: ${message.type}`, {
        type: message.type,
        subtype: (message as any).subtype,
        details: message,
      });
      yield message;
    }
  }

  async querySingle(
    prompt: string,
    options?: Partial<AIQueryOptions>
  ): Promise<{
    messages: SDKMessage[];
    cost: number;
    duration: number;
  }> {
    const messages: SDKMessage[] = [];
    let totalCost = 0;
    let duration = 0;

    try {
      for await (const message of this.queryStream(prompt, options)) {
        messages.push(message);

        if (message.type === "result" && message.subtype === "success") {
          totalCost = message.total_cost_usd;
          duration = message.duration_ms;
        }
      }

      logger.info("Single query completed", {
        messageCount: messages.length,
        cost: totalCost,
        duration,
      });

      return { messages, cost: totalCost, duration };
    } catch (error) {
      logger.error("Single query failed", { error });
      throw error;
    }
  }
}
