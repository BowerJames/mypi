import type { SessionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { BUILTIN_TOOLS, getFinalAssistantText, seedCloneSession, selectBtwTools } from "./clone.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type AnyMessage = SessionContext["messages"][number];

/** Minimal fake SessionManager that records appendMessage calls. */
function makeRecordingSm() {
	const appended: AnyMessage[] = [];
	const sm = {
		appendMessage: (m: AnyMessage) => {
			appended.push(m);
			return `id-${appended.length}`;
		},
	};
	return { sm, appended };
}

function user(text: string, timestamp = 1): AnyMessage {
	return { role: "user", content: [{ type: "text", text }], timestamp } as AnyMessage;
}

function assistant(text: string, timestamp = 2): AnyMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		timestamp,
	} as AnyMessage;
}

function assistantToolOnly(timestamp = 2): AnyMessage {
	return {
		role: "assistant",
		content: [{ type: "tool_use", id: "t1", name: "bash", input: { command: "ls" } }],
		timestamp,
	} as unknown as AnyMessage;
}

function toolResult(timestamp = 3): AnyMessage {
	return {
		role: "toolResult",
		content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }],
		timestamp,
	} as unknown as AnyMessage;
}

/** Read the first text part of a message (test fixtures always have content). */
function firstText(msg: AnyMessage): string {
	return (msg as unknown as { content: { text: string }[] }).content[0].text;
}

// ---------------------------------------------------------------------------
// selectBtwTools
// ---------------------------------------------------------------------------

describe("selectBtwTools", () => {
	it("intersects active tools with built-ins, preserving canonical order", () => {
		expect(selectBtwTools(["write", "grep", "bash", "read"])).toEqual([
			"read",
			"bash",
			"write",
			"grep",
		]);
	});

	it("de-duplicates active tools", () => {
		expect(selectBtwTools(["bash", "bash", "read"])).toEqual(["read", "bash"]);
	});

	it("falls back when active set is empty", () => {
		expect(selectBtwTools([])).toEqual(["read", "bash", "edit", "write"]);
	});

	it("falls back when active set is entirely custom", () => {
		expect(selectBtwTools(["my_custom_tool", "another_one"])).toEqual([
			"read",
			"bash",
			"edit",
			"write",
		]);
	});

	it("mirrors a read-only parent exactly", () => {
		expect(selectBtwTools(["read", "grep", "find", "ls"])).toEqual(["read", "grep", "find", "ls"]);
	});

	it("exposes all built-ins in canonical order when all are active", () => {
		expect(selectBtwTools([...BUILTIN_TOOLS])).toEqual([...BUILTIN_TOOLS]);
	});
});

// ---------------------------------------------------------------------------
// seedCloneSession
// ---------------------------------------------------------------------------

describe("seedCloneSession", () => {
	it("appends user/assistant/toolResult messages verbatim in order", () => {
		const { sm, appended } = makeRecordingSm();
		const messages: AnyMessage[] = [user("hi"), assistant("hello"), toolResult()];

		seedCloneSession(sm as never, messages);

		expect(appended).toHaveLength(3);
		expect(appended[0]).toBe(messages[0]);
		expect(appended[1]).toBe(messages[1]);
		expect(appended[2]).toBe(messages[2]);
	});

	it("passes custom and bashExecution messages through unchanged", () => {
		const { sm, appended } = makeRecordingSm();
		const custom: AnyMessage = {
			role: "custom",
			customType: "foo",
			content: "bar",
			display: true,
			timestamp: 5,
		} as AnyMessage;
		const bashExec: AnyMessage = {
			role: "bashExecution",
			command: "ls",
			output: "a\nb",
			exitCode: 0,
			cancelled: false,
			truncated: false,
			timestamp: 6,
		} as AnyMessage;

		seedCloneSession(sm as never, [custom, bashExec]);

		expect(appended).toEqual([custom, bashExec]);
	});

	it("converts a compactionSummary into a user message wrapping the summary", () => {
		const { sm, appended } = makeRecordingSm();
		const compaction: AnyMessage = {
			role: "compactionSummary",
			summary: "we did stuff",
			tokensBefore: 100,
			timestamp: 7,
		} as AnyMessage;

		seedCloneSession(sm as never, [compaction]);

		expect(appended).toHaveLength(1);
		expect(appended[0].role).toBe("user");
		const text = firstText(appended[0]);
		expect(text).toContain("<summary>");
		expect(text).toContain("we did stuff");
		expect(text).toContain("</summary>");
	});

	it("converts a branchSummary into a user message wrapping the summary", () => {
		const { sm, appended } = makeRecordingSm();
		const branch: AnyMessage = {
			role: "branchSummary",
			summary: "abandoned path",
			fromId: "x",
			timestamp: 8,
		} as AnyMessage;

		seedCloneSession(sm as never, [branch]);

		expect(appended).toHaveLength(1);
		expect(appended[0].role).toBe("user");
		const text = firstText(appended[0]);
		expect(text).toContain("<summary>");
		expect(text).toContain("abandoned path");
	});

	it("mixes passthrough and summary-converted messages in order", () => {
		const { sm, appended } = makeRecordingSm();
		const messages: AnyMessage[] = [
			user("start"),
			{
				role: "compactionSummary",
				summary: "mid summary",
				tokensBefore: 50,
				timestamp: 9,
			} as AnyMessage,
			assistant("after"),
		];

		seedCloneSession(sm as never, messages);

		expect(appended).toHaveLength(3);
		expect(appended[0]).toBe(messages[0]);
		expect(appended[1].role).toBe("user");
		expect(firstText(appended[1])).toContain("mid summary");
		expect(appended[2]).toBe(messages[2]);
	});

	it("seeds nothing for an empty conversation", () => {
		const { sm, appended } = makeRecordingSm();
		seedCloneSession(sm as never, []);
		expect(appended).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// getFinalAssistantText
// ---------------------------------------------------------------------------

describe("getFinalAssistantText", () => {
	it("returns the text of the last assistant message", () => {
		const messages = [user("q"), assistant("a1"), user("q2"), assistant("a2")];
		expect(getFinalAssistantText(messages)).toBe("a2");
	});

	it("joins multiple text parts of the last assistant message", () => {
		const messages: AnyMessage[] = [
			{
				role: "assistant",
				content: [
					{ type: "text", text: "part1" },
					{ type: "text", text: "part2" },
				],
				timestamp: 1,
			} as AnyMessage,
		];
		expect(getFinalAssistantText(messages)).toBe("part1\npart2");
	});

	it("skips a trailing tool-only assistant turn", () => {
		const messages = [user("q"), assistant("real answer"), assistantToolOnly(), toolResult()];
		expect(getFinalAssistantText(messages)).toBe("real answer");
	});

	it("returns empty string when no assistant message has text", () => {
		const messages = [user("q"), assistantToolOnly(), toolResult()];
		expect(getFinalAssistantText(messages)).toBe("");
	});

	it("returns empty string for an empty conversation", () => {
		expect(getFinalAssistantText([])).toBe("");
	});

	it("returns empty string when there are only user messages", () => {
		expect(getFinalAssistantText([user("q"), user("q2")])).toBe("");
	});
});
