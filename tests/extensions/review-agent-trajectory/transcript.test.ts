import { describe, expect, test } from "bun:test";
import { formatTranscript } from "../../../extensions/review-agent-trajectory/transcript.ts";

describe("formatTranscript", () => {
  test("returns empty string for empty messages array", () => {
    expect(formatTranscript([])).toBe("");
  });

  test("formats a simple user message (string content)", () => {
    const messages = [
      {
        role: "user",
        content: "Hello, can you help me?",
        timestamp: 1_700_000_000_000,
      },
    ];

    const result = formatTranscript(messages);
    expect(result).toContain("## User");
    expect(result).toContain("Hello, can you help me?");
  });

  test("formats a user message with structured content", () => {
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: "Look at this image:" },
          { type: "image", data: "base64...", mimeType: "image/png" },
        ],
        timestamp: 1_700_000_000_000,
      },
    ];

    const result = formatTranscript(messages);
    expect(result).toContain("Look at this image:");
    expect(result).toContain("[image: image/png]");
  });

  test("formats an assistant message with text only", () => {
    const messages = [
      {
        role: "assistant",
        content: [{ type: "text", text: "Sure, I can help!" }],
        api: "anthropic",
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        usage: {
          input: 100,
          output: 20,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 120,
          cost: {
            input: 0.001,
            output: 0.0002,
            cacheRead: 0,
            cacheWrite: 0,
            total: 0.0012,
          },
        },
        stopReason: "stop",
        timestamp: 1_700_000_001_000,
      },
    ];

    const result = formatTranscript(messages);
    expect(result).toContain("## Assistant");
    expect(result).toContain("anthropic/claude-sonnet-4-5");
    expect(result).toContain("stopReason: stop");
    expect(result).toContain("Sure, I can help!");
  });

  test("formats an assistant message with thinking, text, and tool calls", () => {
    const messages = [
      {
        role: "assistant",
        content: [
          {
            type: "thinking",
            thinking: "Let me read the file first",
          },
          { type: "text", text: "I'll check that file." },
          {
            type: "toolCall",
            id: "call_123",
            name: "read",
            arguments: { path: "/src/index.ts" },
          },
        ],
        api: "anthropic",
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        usage: {
          input: 500,
          output: 100,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 600,
          cost: {
            input: 0.005,
            output: 0.001,
            cacheRead: 0,
            cacheWrite: 0,
            total: 0.006,
          },
        },
        stopReason: "toolUse",
        timestamp: 1_700_000_002_000,
      },
    ];

    const result = formatTranscript(messages);
    expect(result).toContain("<thinking>");
    expect(result).toContain("Let me read the file first");
    expect(result).toContain("</thinking>");
    expect(result).toContain("I'll check that file.");
    expect(result).toContain("Tool call: read");
    expect(result).toContain('"/src/index.ts"');
    expect(result).toContain("stopReason: toolUse");
  });

  test("formats a tool result message", () => {
    const messages = [
      {
        role: "toolResult",
        toolCallId: "call_123",
        toolName: "read",
        content: [{ type: "text", text: "const x = 1;\nconst y = 2;" }],
        isError: false,
        timestamp: 1_700_000_003_000,
      },
    ];

    const result = formatTranscript(messages);
    expect(result).toContain("## Tool Result: read");
    expect(result).toContain("const x = 1;");
    expect(result).not.toContain("(ERROR)");
  });

  test("formats an error tool result with ERROR label", () => {
    const messages = [
      {
        role: "toolResult",
        toolCallId: "call_456",
        toolName: "bash",
        content: [{ type: "text", text: "Command failed" }],
        isError: true,
        timestamp: 1_700_000_004_000,
      },
    ];

    const result = formatTranscript(messages);
    expect(result).toContain("## Tool Result: bash (ERROR)");
    expect(result).toContain("Command failed");
  });

  test("formats a compaction summary message", () => {
    const messages = [
      {
        role: "compactionSummary",
        summary: "User discussed auth module. Key decisions: use JWT tokens.",
        tokensBefore: 50000,
        timestamp: 1_700_000_010_000,
      },
    ];

    const result = formatTranscript(messages);
    expect(result).toContain("## Compaction Summary");
    expect(result).toContain("50000 tokens before");
    expect(result).toContain("User discussed auth module");
  });

  test("formats a branch summary message", () => {
    const messages = [
      {
        role: "branchSummary",
        summary: "Explored REST API approach before switching to GraphQL.",
        fromId: "a1b2c3d4",
        timestamp: 1_700_000_011_000,
      },
    ];

    const result = formatTranscript(messages);
    expect(result).toContain("## Branch Summary");
    expect(result).toContain("from a1b2c3d4");
    expect(result).toContain("Explored REST API approach");
  });

  test("formats a custom message", () => {
    const messages = [
      {
        role: "custom",
        customType: "mode-activated",
        content: "Plan mode activated. Follow the planning workflow.",
        display: true,
        timestamp: 1_700_000_012_000,
      },
    ];

    const result = formatTranscript(messages);
    expect(result).toContain("## Custom Message");
    expect(result).toContain("mode-activated");
    expect(result).toContain("Plan mode activated");
  });

  test("formats a custom message with structured content", () => {
    const messages = [
      {
        role: "custom",
        customType: "review-output",
        content: [
          { type: "text", text: "Review findings:" },
          { type: "image", data: "abc", mimeType: "image/jpeg" },
        ],
        display: true,
        timestamp: 1_700_000_013_000,
      },
    ];

    const result = formatTranscript(messages);
    expect(result).toContain("Review findings:");
    expect(result).toContain("[image: image/jpeg]");
  });

  test("formats a bash execution message", () => {
    const messages = [
      {
        role: "bashExecution",
        command: "ls -la",
        output: "total 0\ndrwxr-xr-x  2 root root 4096 Jan  1 00:00 .",
        exitCode: 0,
        cancelled: false,
        truncated: false,
        timestamp: 1_700_000_014_000,
      },
    ];

    const result = formatTranscript(messages);
    expect(result).toContain("## Bash Execution");
    expect(result).toContain("ls -la");
  });

  test("includes unknown message types in transcript", () => {
    const messages = [
      {
        role: "futureMessageType",
        timestamp: 1_700_000_015_000,
      },
    ];

    const result = formatTranscript(messages);
    expect(result).toContain("## Unknown Message (futureMessageType");
  });

  test("formats a mixed conversation with all message types and separator lines", () => {
    const messages = [
      {
        role: "compactionSummary",
        summary: "Earlier work on auth module.",
        tokensBefore: 30000,
        timestamp: 1_700_000_000_000,
      },
      {
        role: "user",
        content: "Continue with the review",
        timestamp: 1_700_000_001_000,
      },
      {
        role: "custom",
        customType: "mode",
        content: "Develop mode activated",
        display: true,
        timestamp: 1_700_000_002_000,
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "Done." }],
        api: "anthropic",
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        usage: {
          input: 50,
          output: 10,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 60,
          cost: {
            input: 0.0005,
            output: 0.0001,
            cacheRead: 0,
            cacheWrite: 0,
            total: 0.0006,
          },
        },
        stopReason: "stop",
        timestamp: 1_700_000_003_000,
      },
    ];

    const result = formatTranscript(messages);
    expect(result).toContain("---");
    expect(result).toContain("## Compaction Summary");
    expect(result).toContain("## User");
    expect(result).toContain("## Custom Message");
    expect(result).toContain("## Assistant");
  });

  test("handles redacted thinking content", () => {
    const messages = [
      {
        role: "assistant",
        content: [
          {
            type: "thinking",
            thinking: "",
            redacted: true,
            thinkingSignature: "sig_abc",
          },
          { type: "text", text: "Done." },
        ],
        api: "anthropic",
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        usage: {
          input: 100,
          output: 20,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 120,
          cost: {
            input: 0.001,
            output: 0.0002,
            cacheRead: 0,
            cacheWrite: 0,
            total: 0.0012,
          },
        },
        stopReason: "stop",
        timestamp: 1_700_000_005_000,
      },
    ];

    const result = formatTranscript(messages);
    expect(result).toContain("[thinking redacted]");
  });

  test("preserves full tool result content without truncation", () => {
    const longContent = "x".repeat(10000);
    const messages = [
      {
        role: "toolResult",
        toolCallId: "call_789",
        toolName: "bash",
        content: [{ type: "text", text: longContent }],
        isError: false,
        timestamp: 1_700_000_006_000,
      },
    ];

    const result = formatTranscript(messages);
    expect(result).toContain(longContent);
  });
});
