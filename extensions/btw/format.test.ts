import { describe, expect, it } from "vitest";
import { composeStatus, formatError, formatResult, formatStarted, previewArgs } from "./format.js";

describe("previewArgs", () => {
	it("collapses internal whitespace", () => {
		expect(previewArgs("create   an\n  issue")).toBe("create an issue");
	});

	it("trims surrounding whitespace", () => {
		expect(previewArgs("   hello world   ")).toBe("hello world");
	});

	it("truncates with an ellipsis when over the cap", () => {
		const long = "x".repeat(100);
		const result = previewArgs(long);
		expect(result.endsWith("…")).toBe(true);
		expect(result.length).toBeLessThan(long.length);
	});

	it("respects a custom max", () => {
		expect(previewArgs("abcdefghij", 5)).toBe("abcde…");
	});

	it("leaves short input unchanged", () => {
		expect(previewArgs("create an issue for that", 60)).toBe("create an issue for that");
	});
});

describe("composeStatus", () => {
	it("returns undefined when there are no tasks", () => {
		expect(composeStatus([])).toBeUndefined();
	});

	it("returns undefined when none are running", () => {
		expect(composeStatus([{ status: "done" }, { status: "error" }])).toBeUndefined();
	});

	it("counts only running tasks", () => {
		expect(
			composeStatus([
				{ status: "running" },
				{ status: "done" },
				{ status: "running" },
				{ status: "error" },
			]),
		).toBe("⚙ btw: 2 running");
	});

	it("reports a single running task", () => {
		expect(composeStatus([{ status: "running" }])).toBe("⚙ btw: 1 running");
	});
});

describe("formatResult", () => {
	it("prefixes with btw ›", () => {
		expect(formatResult("all good")).toBe("btw › all good");
	});

	it("returns a placeholder when text is empty", () => {
		expect(formatResult("")).toBe("btw › (no output)");
	});

	it("returns a placeholder when text is only whitespace", () => {
		expect(formatResult("   \n\t ")).toBe("btw › (no output)");
	});

	it("trims surrounding whitespace before prefixing", () => {
		expect(formatResult("  done  ")).toBe("btw › done");
	});

	it("truncates long output with a marker (line cap)", () => {
		const manyLines = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
		const result = formatResult(manyLines);
		expect(result.endsWith("… (truncated)")).toBe(true);
		expect(result.split("\n").length).toBeLessThan(100);
	});

	it("truncates long output with a marker (char cap)", () => {
		const long = "y".repeat(5000);
		const result = formatResult(long);
		expect(result.endsWith("… (truncated)")).toBe(true);
		expect(result.length).toBeLessThan(long.length);
	});

	it("leaves short multi-line output intact", () => {
		const text = "first\nsecond";
		expect(formatResult(text)).toBe("btw › first\nsecond");
	});

	describe("with preview", () => {
		it("shows the preview on the first line followed by the answer", () => {
			expect(formatResult("created issue #8", "create an issue")).toBe(
				"btw › create an issue\ncreated issue #8",
			);
		});

		it("uses the (no output) body when text is empty", () => {
			expect(formatResult("", "some task")).toBe("btw › some task\n(no output)");
		});

		it("ignores an empty preview", () => {
			expect(formatResult("done", "")).toBe("btw › done");
		});

		it("truncates long output with a marker even with a preview", () => {
			const long = "y".repeat(5000);
			const result = formatResult(long, "preview task");
			expect(result.startsWith("btw › preview task\n")).toBe(true);
			expect(result.endsWith("… (truncated)")).toBe(true);
		});
	});
});

describe("formatStarted", () => {
	it("formats a started notification with the preview", () => {
		expect(formatStarted("create an issue")).toBe("btw › started: create an issue");
	});

	it("includes the prefix even for an empty preview", () => {
		expect(formatStarted("")).toBe("btw › started: ");
	});
});

describe("formatError", () => {
	it("formats an error with the preview when provided", () => {
		expect(formatError("boom", "create an issue")).toBe("btw: failed (create an issue) — boom");
	});

	it("formats an error without a preview", () => {
		expect(formatError("boom")).toBe("btw: failed — boom");
	});

	it("omits the preview clause for an empty preview", () => {
		expect(formatError("boom", "")).toBe("btw: failed — boom");
	});
});
