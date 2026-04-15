import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { Message } from "@mariozechner/pi-ai";
import type {
  BashExecutionMessage,
  BranchSummaryMessage,
  CompactionSummaryMessage,
  CustomMessage,
} from "@mariozechner/pi-coding-agent";

/**
 * Extract text from a content block (TextContent or ImageContent).
 * Image content is represented as a placeholder note.
 */
function extractContentText(
  content:
    | string
    | { type: string; text?: string; data?: string; mimeType?: string }[],
): string {
  if (typeof content === "string") return content;

  return content
    .map((block) => {
      if (block.type === "text" && block.text) return block.text;
      if (block.type === "image")
        return `[image: ${block.mimeType ?? "unknown"}]`;
      return "";
    })
    .join("\n");
}

/**
 * Format a UserMessage into a transcript section.
 */
function formatUserMessage(msg: Message & { role: "user" }): string {
  const text = extractContentText(msg.content);
  const time = new Date(msg.timestamp).toISOString();
  return `## User (${time})\n\n${text}`;
}

/**
 * Format an AssistantMessage into a transcript section.
 */
function formatAssistantMessage(msg: Message & { role: "assistant" }): string {
  const time = new Date(msg.timestamp).toISOString();
  const parts: string[] = [];

  for (const block of msg.content) {
    if (block.type === "thinking") {
      const thinking = block.redacted ? "[thinking redacted]" : block.thinking;
      parts.push(`<thinking>\n${thinking}\n</thinking>`);
    } else if (block.type === "text" && block.text) {
      parts.push(block.text);
    } else if (block.type === "toolCall") {
      parts.push(
        `Tool call: ${block.name}(${JSON.stringify(block.arguments, null, 2)})`,
      );
    }
  }

  const modelInfo = `${msg.provider}/${msg.model}`;
  const header = `## Assistant (${time}, ${modelInfo}, stopReason: ${msg.stopReason})`;

  return `${header}\n\n${parts.join("\n\n")}`;
}

/**
 * Format a ToolResultMessage into a transcript section.
 */
function formatToolResultMessage(
  msg: Message & { role: "toolResult" },
): string {
  const time = new Date(msg.timestamp).toISOString();
  const text = extractContentText(msg.content);
  const errorLabel = msg.isError ? " (ERROR)" : "";
  const header = `## Tool Result: ${msg.toolName}${errorLabel} (${time})`;

  return `${header}\n\n${text}`;
}

/**
 * Format a CompactionSummaryMessage into a transcript section.
 */
function formatCompactionSummary(msg: CompactionSummaryMessage): string {
  const time = new Date(msg.timestamp).toISOString();
  const header = `## Compaction Summary (${time}, ${msg.tokensBefore} tokens before)`;

  return `${header}\n\n${msg.summary}`;
}

/**
 * Format a BranchSummaryMessage into a transcript section.
 */
function formatBranchSummary(msg: BranchSummaryMessage): string {
  const time = new Date(msg.timestamp).toISOString();
  const header = `## Branch Summary (from ${msg.fromId}, ${time})`;

  return `${header}\n\n${msg.summary}`;
}

/**
 * Format a BashExecutionMessage into a transcript section.
 */
function formatBashExecution(msg: BashExecutionMessage): string {
  const time = new Date(msg.timestamp).toISOString();
  const parts: string[] = [];
  parts.push(`$ ${msg.command}`);
  if (msg.output) parts.push(msg.output);
  if (msg.exitCode !== undefined) parts.push(`exit code: ${msg.exitCode}`);
  if (msg.cancelled) parts.push("(cancelled)");
  if (msg.truncated) parts.push("(output truncated)");
  const header = `## Bash Execution (${time})`;

  return `${header}\n\n${parts.join("\n")}`;
}

/**
 * Format a CustomMessage into a transcript section.
 */
function formatCustomMessage(msg: CustomMessage): string {
  const time = new Date(msg.timestamp).toISOString();
  const text = extractContentText(msg.content);
  const header = `## Custom Message (${msg.customType}, ${time})`;

  return `${header}\n\n${text}`;
}

/**
 * Format a list of agent messages into a readable transcript string.
 *
 * This preserves full content including tool call arguments and tool
 * result content (no truncation), so the reviewer sees exactly what
 * the agent saw. Handles all message types returned by
 * buildSessionContext(): user, assistant, toolResult, custom,
 * compactionSummary, branchSummary, and bashExecution.
 */
export function formatTranscript(messages: AgentMessage[]): string {
  const sections: string[] = [];

  for (const msg of messages) {
    switch (msg.role) {
      case "user":
        sections.push(formatUserMessage(msg));
        break;
      case "assistant":
        sections.push(formatAssistantMessage(msg));
        break;
      case "toolResult":
        sections.push(formatToolResultMessage(msg));
        break;
      case "compactionSummary":
        sections.push(formatCompactionSummary(msg));
        break;
      case "branchSummary":
        sections.push(formatBranchSummary(msg));
        break;
      case "bashExecution":
        sections.push(formatBashExecution(msg));
        break;
      case "custom":
        sections.push(formatCustomMessage(msg));
        break;
      default: {
        // Warn about unknown message types to catch future regressions
        const unknown = msg as { role: string; timestamp?: number };
        const time = unknown.timestamp
          ? new Date(unknown.timestamp).toISOString()
          : "unknown time";
        sections.push(`## Unknown Message (${unknown.role}, ${time})`);
        break;
      }
    }
  }

  return sections.join("\n\n---\n\n");
}
