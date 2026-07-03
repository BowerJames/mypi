import { describe, expect, it } from "vitest";
import {
	contentToText,
	isRenderRawMessage,
	lastAssistantText,
	lastRenderedSource,
	RENDER_RAW_CUSTOM_TYPE,
} from "./last-assistant.js";

// ---------------------------------------------------------------------------
// Entry fixtures
// ---------------------------------------------------------------------------

function messageEntry(role: string, content: unknown) {
	return { type: "message", message: { role, content } };
}

function customMessageEntry(customType: string, content: unknown) {
	return { type: "custom_message", customType, content };
}

// ---------------------------------------------------------------------------
// contentToText
// ---------------------------------------------------------------------------

describe("contentToText", () => {
	it("returns string content verbatim", () => {
		expect(contentToText("hello **world**")).toBe("hello **world**");
	});

	it("joins text blocks from a content array, ignoring non-text blocks", () => {
		const content = [
			{ type: "text", text: "# Heading" },
			{ type: "thinking", thinking: "internal reasoning" },
			{ type: "text", text: "body with `code`" },
		];
		expect(contentToText(content)).toBe("# Heading\nbody with `code`");
	});

	it("returns an empty string for an array with no text blocks", () => {
		const content = [{ type: "thinking", thinking: "only thinking" }];
		expect(contentToText(content)).toBe("");
	});

	it("returns an empty string for non-string, non-array content", () => {
		expect(contentToText(undefined)).toBe("");
		expect(contentToText(null)).toBe("");
		expect(contentToText(42)).toBe("");
		expect(contentToText({ foo: "bar" })).toBe("");
	});

	it("ignores text blocks whose text is not a string", () => {
		const content = [
			{ type: "text", text: 123 },
			{ type: "text", text: "real" },
		];
		expect(contentToText(content)).toBe("real");
	});
});

// ---------------------------------------------------------------------------
// lastAssistantText
// ---------------------------------------------------------------------------

describe("lastAssistantText", () => {
	it("returns null when there are no entries", () => {
		expect(lastAssistantText([])).toBeNull();
	});

	it("returns null when there is no assistant message", () => {
		const entries = [
			messageEntry("user", "hi"),
			customMessageEntry("other", "x"),
			messageEntry("toolResult", [{ type: "text", text: "r" }]),
		];
		expect(lastAssistantText(entries)).toBeNull();
	});

	it("returns the trimmed text of the only assistant message", () => {
		const entries = [messageEntry("user", "hi"), messageEntry("assistant", "# Title\n\nbody  ")];
		expect(lastAssistantText(entries)).toBe("# Title\n\nbody");
	});

	it("returns the last assistant message when several exist", () => {
		const entries = [
			messageEntry("assistant", "first"),
			messageEntry("user", "again"),
			messageEntry("assistant", "**second**"),
		];
		expect(lastAssistantText(entries)).toBe("**second**");
	});

	it("skips an assistant message with no text blocks (e.g. tool-call only)", () => {
		const entries = [
			messageEntry("assistant", [{ type: "text", text: "earlier" }]),
			messageEntry("assistant", [{ type: "toolCall", id: "tc1" }]),
		];
		// The last assistant message has no text -> null (does not fall back to the earlier one).
		expect(lastAssistantText(entries)).toBeNull();
	});

	it("skips a whitespace-only assistant message", () => {
		const entries = [messageEntry("assistant", "   \n  "), messageEntry("assistant", "real reply")];
		expect(lastAssistantText(entries)).toBe("real reply");
	});

	it("uses string content directly", () => {
		const entries = [messageEntry("assistant", "plain string reply")];
		expect(lastAssistantText(entries)).toBe("plain string reply");
	});

	it("extracts text from an assistant content array", () => {
		const entries = [
			messageEntry("assistant", [
				{ type: "thinking", thinking: "hidden" },
				{ type: "text", text: "visible **raw**" },
			]),
		];
		expect(lastAssistantText(entries)).toBe("visible **raw**");
	});
});

// ---------------------------------------------------------------------------
// lastRenderedSource
// ---------------------------------------------------------------------------

describe("lastRenderedSource", () => {
	it("returns null when there are no entries", () => {
		expect(lastRenderedSource([])).toBeNull();
	});

	it("returns null when no render-raw custom message exists", () => {
		const entries = [messageEntry("assistant", "x"), customMessageEntry("other-extension", "y")];
		expect(lastRenderedSource(entries)).toBeNull();
	});

	it("returns the content of the only render-raw entry", () => {
		const entries = [
			messageEntry("assistant", "# Heading"),
			customMessageEntry(RENDER_RAW_CUSTOM_TYPE, "# Heading"),
		];
		expect(lastRenderedSource(entries)).toBe("# Heading");
	});

	it("returns the last render-raw entry when several exist", () => {
		const entries = [
			messageEntry("assistant", "first"),
			customMessageEntry(RENDER_RAW_CUSTOM_TYPE, "first"),
			messageEntry("assistant", "second"),
			customMessageEntry(RENDER_RAW_CUSTOM_TYPE, "second"),
		];
		expect(lastRenderedSource(entries)).toBe("second");
	});

	it("ignores render-raw entries with non-string content", () => {
		const entries = [
			customMessageEntry(RENDER_RAW_CUSTOM_TYPE, [{ type: "text", text: "x" }]),
			customMessageEntry(RENDER_RAW_CUSTOM_TYPE, "real"),
		];
		expect(lastRenderedSource(entries)).toBe("real");
	});

	it("does not match other custom types", () => {
		const entries = [customMessageEntry("render-raw-something-else", "nope")];
		expect(lastRenderedSource(entries)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// isRenderRawMessage
// ---------------------------------------------------------------------------

describe("isRenderRawMessage", () => {
	it("returns true for a custom message with the render-raw type", () => {
		expect(isRenderRawMessage({ role: "custom", customType: RENDER_RAW_CUSTOM_TYPE })).toBe(true);
	});

	it("returns false for a custom message with a different type", () => {
		expect(isRenderRawMessage({ role: "custom", customType: "other" })).toBe(false);
	});

	it("returns false for a non-custom message", () => {
		expect(isRenderRawMessage({ role: "assistant", customType: RENDER_RAW_CUSTOM_TYPE })).toBe(
			false,
		);
		expect(isRenderRawMessage({ role: "user" })).toBe(false);
	});

	it("returns false for a message with no customType", () => {
		expect(isRenderRawMessage({ role: "custom" })).toBe(false);
	});
});
