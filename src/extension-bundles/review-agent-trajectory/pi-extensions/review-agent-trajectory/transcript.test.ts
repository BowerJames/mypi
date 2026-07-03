import { describe, expect, it } from "vitest";
import { formatSessionTranscript, type SessionMessage } from "./transcript.js";

describe("formatSessionTranscript", () => {
	it("formats a mixed conversation into markdown", () => {
		const messages: SessionMessage[] = [
			{
				role: "user",
				content: "Please review the work.",
			},
			{
				role: "assistant",
				content: [
					{ type: "text", text: "I will inspect the repository." },
					{
						type: "toolCall",
						id: "call_1",
						name: "bash",
						arguments: { command: "git status --short" },
					},
				],
			},
			{
				role: "toolResult",
				toolCallId: "call_1",
				toolName: "bash",
				content: [{ type: "text", text: " M src/cli.ts" }],
				isError: false,
			},
		];

		expect(formatSessionTranscript(messages)).toBe(
			"# Conversation Transcript\n\n" +
				"## 1. User\n\n" +
				"    Please review the work.\n\n" +
				"## 2. Assistant\n\n" +
				"### Text\n\n" +
				"    I will inspect the repository.\n\n" +
				"### Tool call: bash\n" +
				"    id: call_1\n\n" +
				"    {\n" +
				'      "command": "git status --short"\n' +
				"    }\n\n" +
				"## 3. Tool result: bash\n\n" +
				"    toolCallId: call_1\n\n" +
				"    isError: false\n\n" +
				"     M src/cli.ts",
		);
	});

	it("returns a placeholder when there are no messages", () => {
		expect(formatSessionTranscript([])).toBe("# Conversation Transcript\n\n(no messages)");
	});

	it("formats assistant thinking blocks", () => {
		const messages: SessionMessage[] = [
			{
				role: "assistant",
				content: [
					{ type: "thinking", thinking: "Let me analyze this..." },
					{ type: "text", text: "Here is my analysis." },
				],
			},
		];

		expect(formatSessionTranscript(messages)).toBe(
			"# Conversation Transcript\n\n" +
				"## 1. Assistant\n\n" +
				"### Thinking\n\n" +
				"    Let me analyze this...\n\n" +
				"### Text\n\n" +
				"    Here is my analysis.",
		);
	});

	it("formats user messages with array content", () => {
		const messages: SessionMessage[] = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Look at this image:" },
					{ type: "image", data: "base64...", mimeType: "image/png" },
				],
			},
		];

		expect(formatSessionTranscript(messages)).toBe(
			"# Conversation Transcript\n\n" +
				"## 1. User\n\n" +
				"    Look at this image:\n\n" +
				"    [image omitted: image/png]",
		);
	});

	it("formats tool results with isError: true", () => {
		const messages: SessionMessage[] = [
			{
				role: "toolResult",
				toolCallId: "call_err",
				toolName: "bash",
				content: [{ type: "text", text: "command not found: xyz" }],
				isError: true,
			},
		];

		expect(formatSessionTranscript(messages)).toBe(
			"# Conversation Transcript\n\n" +
				"## 1. Tool result: bash\n\n" +
				"    toolCallId: call_err\n\n" +
				"    isError: true\n\n" +
				"    command not found: xyz",
		);
	});

	it("formats image blocks in assistant content", () => {
		const messages: SessionMessage[] = [
			{
				role: "assistant",
				content: [{ type: "image", data: "abc", mimeType: "image/jpeg" }],
			},
		];

		expect(formatSessionTranscript(messages)).toBe(
			"# Conversation Transcript\n\n" +
				"## 1. Assistant\n\n" +
				"### Image\n\n" +
				"    [image omitted: image/jpeg]",
		);
	});

	it("formats bashExecution messages", () => {
		const messages: SessionMessage[] = [
			{
				role: "bashExecution",
				command: "npm test",
				output: "2 tests passed",
				exitCode: 0,
				cancelled: false,
				timestamp: 1,
			},
		];

		expect(formatSessionTranscript(messages)).toBe(
			"# Conversation Transcript\n\n" +
				"## 1. Bash execution\n\n" +
				"    command: npm test\n\n" +
				"    exitCode: 0\n\n" +
				"    cancelled: false\n\n" +
				"    2 tests passed",
		);
	});

	it("formats bashExecution messages with undefined exitCode", () => {
		const messages: SessionMessage[] = [
			{
				role: "bashExecution",
				command: "sleep 10",
				output: "",
				exitCode: undefined,
				cancelled: true,
				timestamp: 1,
			},
		];

		expect(formatSessionTranscript(messages)).toBe(
			"# Conversation Transcript\n\n" +
				"## 1. Bash execution\n\n" +
				"    command: sleep 10\n\n" +
				"    exitCode: N/A\n\n" +
				"    cancelled: true",
		);
	});

	it("formats custom messages with string content", () => {
		const messages: SessionMessage[] = [
			{
				role: "custom",
				customType: "mode-context",
				content: "Plan mode activated.",
				display: true,
			},
		];

		expect(formatSessionTranscript(messages)).toBe(
			"# Conversation Transcript\n\n" +
				"## 1. Custom (mode-context)\n\n" +
				"    Plan mode activated.",
		);
	});

	it("formats custom messages with array content", () => {
		const messages: SessionMessage[] = [
			{
				role: "custom",
				customType: "my-ext",
				content: [
					{ type: "text", text: "Status update" },
					{ type: "image", data: "xyz", mimeType: "image/png" },
				],
				display: true,
			},
		];

		expect(formatSessionTranscript(messages)).toBe(
			"# Conversation Transcript\n\n" +
				"## 1. Custom (my-ext)\n\n" +
				"    Status update\n\n" +
				"    [image omitted: image/png]",
		);
	});

	it("formats compactionSummary messages", () => {
		const messages: SessionMessage[] = [
			{
				role: "compactionSummary",
				summary: "User discussed X and Y. Key decisions: use temp files.",
				tokensBefore: 50000,
			},
		];

		expect(formatSessionTranscript(messages)).toBe(
			"# Conversation Transcript\n\n" +
				"## 1. Compaction summary\n\n" +
				"    tokensBefore: 50000\n\n" +
				"    User discussed X and Y. Key decisions: use temp files.",
		);
	});

	it("formats branchSummary messages", () => {
		const messages: SessionMessage[] = [
			{
				role: "branchSummary",
				summary: "Explored approach A but abandoned it.",
				fromId: "abc12345",
			},
		];

		expect(formatSessionTranscript(messages)).toBe(
			"# Conversation Transcript\n\n" +
				"## 1. Branch summary (from abc12345)\n\n" +
				"    Explored approach A but abandoned it.",
		);
	});

	it("falls back to JSON for unknown message roles", () => {
		const messages: SessionMessage[] = [
			{
				role: "futureMessage",
				someField: "someValue",
			} as unknown as SessionMessage,
		];

		expect(formatSessionTranscript(messages)).toBe(
			"# Conversation Transcript\n\n" +
				"## 1. futureMessage\n\n" +
				"    {\n" +
				'      "role": "futureMessage",\n' +
				'      "someField": "someValue"\n' +
				"    }",
		);
	});
});
