import winston from "winston";
import * as path from "path";

// Create a custom format that includes timestamps and proper formatting
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      // Filter out stack traces from general metadata display
      const { stack, ...cleanMetadata } = metadata;
      if (Object.keys(cleanMetadata).length > 0) {
        msg += ` | ${JSON.stringify(cleanMetadata)}`;
      }
      // Add stack trace on new line if present
      if (stack) {
        msg += `\n${stack}`;
      }
    }

    return msg;
  })
);

// Create the logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: customFormat,
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), customFormat),
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(process.cwd(), "logs", "ccsdk.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Separate file for errors
    new winston.transports.File({
      filename: path.join(process.cwd(), "logs", "ccsdk-error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Helper function to log AI query details
export function logAIQuery(
  action: string,
  details: {
    prompt?: string;
    options?: any;
    error?: Error;
    duration?: number;
    cost?: number;
    model?: string;
    turns?: number;
  }
) {
  const logData: any = {
    action,
    ...details,
  };

  // Truncate long prompts for logging
  if (logData.prompt && logData.prompt.length > 200) {
    logData.prompt = logData.prompt.substring(0, 200) + "...";
  }

  if (details.error) {
    logger.error(`AI Query ${action} failed`, logData);
  } else {
    logger.info(`AI Query ${action}`, logData);
  }
}

// Helper function to log tool executions
export function logToolExecution(
  toolName: string,
  action: "start" | "complete" | "error" | "blocked",
  details?: any
) {
  const logData = {
    tool: toolName,
    action,
    ...details,
  };

  switch (action) {
    case "error":
      logger.error(`Tool execution error: ${toolName}`, logData);
      break;
    case "blocked":
      logger.warn(`Tool execution blocked: ${toolName}`, logData);
      break;
    default:
      logger.debug(`Tool ${action}: ${toolName}`, logData);
  }
}

// Export log levels for easy reference
export const LogLevel = {
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  DEBUG: "debug",
} as const;
