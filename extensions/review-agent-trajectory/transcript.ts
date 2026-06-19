// ---------------------------------------------------------------------------
// Content block types
// ---------------------------------------------------------------------------

type TextBlock = {
	type: "text";
	text: string;
};

type ThinkingBlock = {
	type: "thinking";
	thinking: string;
};

type ToolCallBlock = {
	type: "toolCall";
	id: string;
	name: string;
	arguments: Record<string, unknown>;
};

type ImageBlock = {
	type: "image";
	data: string;
	mimeType: string;
};

// ---------------------------------------------------------------------------
// Message types returned by buildSessionContext()
// ---------------------------------------------------------------------------

type UserMessage = {
	role: "user";
	content: string | Array<TextBlock | ImageBlock>;
};

type AssistantMessage = {
	role: "assistant";
	content: Array<TextBlock | ThinkingBlock | ToolCallBlock | ImageBlock>;
};

type ToolResultMessage = {
	role: "toolResult";
	toolCallId: string;
	toolName: string;
	content: Array<TextBlock | ImageBlock>;
	isError: boolean;
};

type BashExecutionMessage = {
	role: "bashExecution";
	command: string;
	output: string;
	exitCode: number | undefined;
	cancelled: boolean;
	timestamp: number;
};

type CustomMessage = {
	role: "custom";
	customType: string;
	content: string | Array<TextBlock | ImageBlock>;
	display: boolean;
};

type CompactionSummaryMessage = {
	role: "compactionSummary";
	summary: string;
	tokensBefore: number;
};

type BranchSummaryMessage = {
	role: "branchSummary";
	summary: string;
	fromId: string;
};

type UnknownMessage = {
	role: string;
	[key: string]: unknown;
};

export type SessionMessage =
	| UserMessage
	| AssistantMessage
	| ToolResultMessage
	| BashExecutionMessage
	| CustomMessage
	| CompactionSummaryMessage
	| BranchSummaryMessage
	| UnknownMessage;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function indentBlock(text: string): string {
	return text
		.split(/\r?\n/)
		.map((line) => `    ${line}`)
		.join("\n");
}

function formatJson(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

function formatImagePlaceholder(image: ImageBlock): string {
	return `[image omitted: ${image.mimeType}]`;
}

// ---------------------------------------------------------------------------
// Per-role formatters
// ---------------------------------------------------------------------------

function formatAssistantContent(content: AssistantMessage["content"]): string[] {
	const sections: string[] = [];

	for (const block of content) {
		if (block.type === "text") {
			sections.push(`### Text\n\n${indentBlock(block.text)}`);
			continue;
		}

		if (block.type === "thinking") {
			sections.push(`### Thinking\n\n${indentBlock(block.thinking)}`);
			continue;
		}

		if (block.type === "toolCall") {
			sections.push(
				[
					`### Tool call: ${block.name}`,
					indentBlock(`id: ${block.id}`),
					"",
					indentBlock(formatJson(block.arguments)),
				].join("\n"),
			);
			continue;
		}

		sections.push(`### Image\n\n${indentBlock(formatImagePlaceholder(block))}`);
	}

	return sections;
}

function formatUserContent(content: UserMessage["content"]): string[] {
	if (typeof content === "string") {
		return [indentBlock(content)];
	}

	return content.map((block) =>
		block.type === "text" ? indentBlock(block.text) : indentBlock(formatImagePlaceholder(block)),
	);
}

function formatTextContent(content: Array<TextBlock | ImageBlock>): string[] {
	return content.map((block) =>
		block.type === "text" ? indentBlock(block.text) : indentBlock(formatImagePlaceholder(block)),
	);
}

function formatMessage(message: SessionMessage, index: number): string {
	const heading = `## ${index}`;

	switch (message.role) {
		case "user": {
			const m = message as UserMessage;
			return [`${heading}. User`, ...formatUserContent(m.content)].join("\n\n");
		}

		case "assistant": {
			const m = message as AssistantMessage;
			return [`${heading}. Assistant`, ...formatAssistantContent(m.content)].join("\n\n");
		}

		case "toolResult": {
			const m = message as ToolResultMessage;
			return [
				`${heading}. Tool result: ${m.toolName}`,
				indentBlock(`toolCallId: ${m.toolCallId}`),
				indentBlock(`isError: ${m.isError}`),
				...formatTextContent(m.content),
			].join("\n\n");
		}

		case "bashExecution": {
			const m = message as BashExecutionMessage;
			const outputLines = m.output ? formatTextContent([{ type: "text", text: m.output }]) : [];
			return [
				`${heading}. Bash execution`,
				indentBlock(`command: ${m.command}`),
				indentBlock(`exitCode: ${m.exitCode ?? "N/A"}`),
				indentBlock(`cancelled: ${m.cancelled}`),
				...outputLines,
			].join("\n\n");
		}

		case "custom": {
			const m = message as CustomMessage;
			const contentLines =
				typeof m.content === "string"
					? [indentBlock(m.content)]
					: m.content.map((block) =>
							block.type === "text"
								? indentBlock(block.text)
								: indentBlock(formatImagePlaceholder(block)),
						);
			return [`${heading}. Custom (${m.customType})`, ...contentLines].join("\n\n");
		}

		case "compactionSummary": {
			const m = message as CompactionSummaryMessage;
			return [
				`${heading}. Compaction summary`,
				indentBlock(`tokensBefore: ${m.tokensBefore}`),
				indentBlock(m.summary),
			].join("\n\n");
		}

		case "branchSummary": {
			const m = message as BranchSummaryMessage;
			return [`${heading}. Branch summary (from ${m.fromId})`, indentBlock(m.summary)].join("\n\n");
		}

		default:
			return [`${heading}. ${message.role}`, indentBlock(JSON.stringify(message, null, 2))].join(
				"\n\n",
			);
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function formatSessionTranscript(messages: SessionMessage[]): string {
	if (messages.length === 0) {
		return "# Conversation Transcript\n\n(no messages)";
	}

	return [
		"# Conversation Transcript",
		...messages.map((message, index) => formatMessage(message, index + 1)),
	].join("\n\n");
}
