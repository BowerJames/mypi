import type { SessionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import {
	composeStatus,
	formatCancelled,
	formatIteration,
	formatMaxIter,
	formatStarted,
	formatTerminalMatch,
	getFinalAssistantText,
	LOOP_STATUS_KEY,
	usageString,
} from "./format.js";

// ---------------------------------------------------------------------------
// Test helpers (message-shape mirrors of extensions/btw/clone.test.ts)
// ---------------------------------------------------------------------------

type AnyMessage = SessionContext["messages"][number];

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

function assistantMultiBlock(timestamp = 2): AnyMessage {
	return {
		role: "assistant",
		content: [
			{ type: "text", text: "part1" },
			{ type: "text", text: "part2" },
		],
		timestamp,
	} as AnyMessage;
}

// ---------------------------------------------------------------------------
// getFinalAssistantText
// ---------------------------------------------------------------------------

describe("getFinalAssistantText", () => {
	it("returns the last assistant message's text", () => {
		expect(getFinalAssistantText([user("q"), assistant("a1"), user("q2"), assistant("a2")])).toBe(
			"a2",
		);
	});

	it("joins multiple text parts of the final assistant message", () => {
		expect(getFinalAssistantText([user("q"), assistantMultiBlock()])).toBe("part1\npart2");
	});

	it("skips a trailing tool-only assistant turn in favour of the preceding text", () => {
		expect(getFinalAssistantText([user("q"), assistant("real answer"), assistantToolOnly()])).toBe(
			"real answer",
		);
	});

	it("returns empty string when no assistant message has text", () => {
		expect(getFinalAssistantText([user("q"), assistantToolOnly()])).toBe("");
	});

	it("returns empty string when there are no assistant messages", () => {
		expect(getFinalAssistantText([user("q"), user("q2")])).toBe("");
	});

	it("returns empty string for an empty message list", () => {
		expect(getFinalAssistantText([])).toBe("");
	});
});

// ---------------------------------------------------------------------------
// composeStatus
// ---------------------------------------------------------------------------

describe("composeStatus", () => {
	it("formats 1-based iteration over max", () => {
		expect(composeStatus(1, 10)).toBe("🔄 loop: 1/10");
	});

	it("formats the final iteration", () => {
		expect(composeStatus(10, 10)).toBe("🔄 loop: 10/10");
	});

	it("formats a single-iteration loop", () => {
		expect(composeStatus(1, 1)).toBe("🔄 loop: 1/1");
	});
});

// ---------------------------------------------------------------------------
// formatStarted
// ---------------------------------------------------------------------------

describe("formatStarted", () => {
	it("mentions the terminal regex clause when one is present", () => {
		expect(formatStarted(10, true)).toBe(
			"loop › started (max 10 iterations until the terminal regex matches or)",
		);
	});

	it("omits the terminal regex clause when none is present", () => {
		expect(formatStarted(5, false)).toBe("loop › started (max 5 iterations)");
	});

	it("uses the singular form for a single iteration", () => {
		expect(formatStarted(1, false)).toBe("loop › started (max 1 iteration)");
	});
});

// ---------------------------------------------------------------------------
// formatIteration
// ---------------------------------------------------------------------------

describe("formatIteration", () => {
	it("formats iteration number, max, and item preview", () => {
		expect(formatIteration(2, 10, "/plan")).toBe("loop › iteration 2/10 — /plan");
	});
});

// ---------------------------------------------------------------------------
// formatTerminalMatch
// ---------------------------------------------------------------------------

describe("formatTerminalMatch", () => {
	it("mentions the iteration the condition was met on", () => {
		expect(formatTerminalMatch(3)).toBe("loop › terminal condition met on iteration 3 — stopping.");
	});
});

// ---------------------------------------------------------------------------
// formatMaxIter
// ---------------------------------------------------------------------------

describe("formatMaxIter", () => {
	it("mentions the max reached", () => {
		expect(formatMaxIter(10)).toBe("loop › reached --max-iter 10 — stopping.");
	});
});

// ---------------------------------------------------------------------------
// formatCancelled
// ---------------------------------------------------------------------------

describe("formatCancelled", () => {
	it("explains the abort reason", () => {
		expect(formatCancelled()).toBe("loop › aborted (tree navigation was cancelled).");
	});
});

// ---------------------------------------------------------------------------
// usageString
// ---------------------------------------------------------------------------

describe("usageString", () => {
	it("documents all three flags", () => {
		const usage = usageString();
		expect(usage).toContain("--loop");
		expect(usage).toContain("--max-iter");
		expect(usage).toContain("--terminal-regex");
	});

	it("marks --loop as required", () => {
		expect(usageString()).toContain("required");
	});

	it("states the default max-iter", () => {
		expect(usageString()).toContain("default 10");
	});
});

// ---------------------------------------------------------------------------
// LOOP_STATUS_KEY
// ---------------------------------------------------------------------------

describe("LOOP_STATUS_KEY", () => {
	it("is the extension name", () => {
		expect(LOOP_STATUS_KEY).toBe("loop");
	});
});
