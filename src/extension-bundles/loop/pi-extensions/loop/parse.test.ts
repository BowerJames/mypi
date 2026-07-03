import { describe, expect, it } from "vitest";
import { DEFAULT_MAX_ITER, parseLoopArgs, tokenize } from "./parse.js";

// ---------------------------------------------------------------------------
// tokenize
// ---------------------------------------------------------------------------

describe("tokenize", () => {
	it("splits bare whitespace-separated tokens", () => {
		expect(tokenize('--loop ["a","b"]')).toEqual(["--loop", '["a","b"]']);
	});

	it("keeps a quoted JSON array without inner spaces as one bare token", () => {
		// No whitespace inside, so bare-reader reads the whole thing; quotes still optional.
		expect(tokenize('["/plan","/evaluate-plan"]')).toEqual(['["/plan","/evaluate-plan"]']);
	});

	it("splits a quoted JSON array that has inner spaces into one token", () => {
		expect(tokenize('--loop \'["a b", "c"]\'')).toEqual(["--loop", '["a b", "c"]']);
	});

	it("strips double-quote delimiters and preserves internal content", () => {
		expect(tokenize('--terminal-regex "<\\/end>"')).toEqual(["--terminal-regex", "<\\/end>"]);
	});

	it("strips single-quote delimiters and preserves internal content", () => {
		expect(tokenize('--loop \'["/plan","/evaluate-plan"]\'')).toEqual([
			"--loop",
			'["/plan","/evaluate-plan"]',
		]);
	});

	it("preserves backslashes, $, & verbatim inside quotes", () => {
		expect(tokenize('"\\$&\\\\done"')).toEqual(["\\$&\\\\done"]);
	});

	it("treats internal quotes as inert inside a bare token", () => {
		expect(tokenize('["a","b"]')).toEqual(['["a","b"]']);
	});

	it("collapses multiple spaces and trims surrounding whitespace", () => {
		expect(tokenize("   foo    bar   ")).toEqual(["foo", "bar"]);
	});

	it("returns an empty array for empty / whitespace-only input", () => {
		expect(tokenize("")).toEqual([]);
		expect(tokenize("   \n\t ")).toEqual([]);
	});

	it("takes the rest verbatim on an unterminated quote (lenient)", () => {
		expect(tokenize('"unterminated')).toEqual(["unterminated"]);
	});
});

// ---------------------------------------------------------------------------
// parseLoopArgs — happy paths
// ---------------------------------------------------------------------------

describe("parseLoopArgs (valid)", () => {
	it("requires only --loop, defaulting max-iter and omitting the regex", () => {
		const result = parseLoopArgs('--loop ["/plan","/evaluate-plan"]');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.options.loop).toEqual(["/plan", "/evaluate-plan"]);
		expect(result.options.maxIter).toBe(DEFAULT_MAX_ITER);
		expect(result.options.terminalRegex).toBeUndefined();
	});

	it("accepts an explicit --max-iter", () => {
		const result = parseLoopArgs('--loop ["a"] --max-iter 3');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.options.maxIter).toBe(3);
	});

	it("accepts a --terminal-regex and compiles it", () => {
		// The tokeniser preserves the backslash verbatim, so the regex source is `<\/end>`
		// (an escaped slash), which matches a literal `</end>` and not `<end>`.
		const result = parseLoopArgs('--loop ["a"] --terminal-regex "<\\/end>"');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.options.terminalRegex).toBeInstanceOf(RegExp);
		expect(result.options.terminalRegex?.test("</end>")).toBe(true);
		expect(result.options.terminalRegex?.test("<end>")).toBe(false);
	});

	it("compiles a terminal-regex that actually matches", () => {
		const result = parseLoopArgs('--loop ["a"] --terminal-regex "<DONE>"');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.options.terminalRegex?.test("work is <DONE> now")).toBe(true);
	});

	it("accepts flags in any order", () => {
		const result = parseLoopArgs('--max-iter 5 --terminal-regex "<DONE>" --loop ["a","b"]');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.options.maxIter).toBe(5);
		expect(result.options.terminalRegex?.test("<DONE>")).toBe(true);
		expect(result.options.loop).toEqual(["a", "b"]);
	});

	it("allows a single-message --loop array", () => {
		const result = parseLoopArgs('--loop ["only one"]');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.options.loop).toEqual(["only one"]);
	});

	it("allows quoted strings with spaces inside the JSON array", () => {
		const result = parseLoopArgs('--loop \'["plan this thing","evaluate it"]\'');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.options.loop).toEqual(["plan this thing", "evaluate it"]);
	});

	it("takes the last value when a flag is duplicated", () => {
		const result = parseLoopArgs('--loop ["a"] --max-iter 2 --max-iter 7');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.options.maxIter).toBe(7);
	});

	it("greedily joins a spaced JSON array into one value (no outer quotes)", () => {
		// Real users type the array with spaces after commas; the parser re-joins
		// tokens until brackets balance.
		const result = parseLoopArgs('--loop ["/plan", "/evaluate-plan"]');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.options.loop).toEqual(["/plan", "/evaluate-plan"]);
	});

	it("leaves subsequent flags intact after a spaced --loop array", () => {
		const result = parseLoopArgs('--loop ["a", "b"] --max-iter 4');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.options.loop).toEqual(["a", "b"]);
		expect(result.options.maxIter).toBe(4);
	});
});

// ---------------------------------------------------------------------------
// parseLoopArgs — error paths
// ---------------------------------------------------------------------------

describe("parseLoopArgs (invalid)", () => {
	it("errors when --loop is missing", () => {
		const result = parseLoopArgs("--max-iter 5");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain("--loop is required");
	});

	it("errors when --loop is not valid JSON", () => {
		const result = parseLoopArgs("--loop not-json");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain("--loop must be a JSON string array");
	});

	it("errors when --loop is valid JSON but not an array", () => {
		// `{}` is valid JSON (an object) but not an array.
		const result = parseLoopArgs("--loop {}");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain("non-array");
	});

	it("errors when --loop is an empty array", () => {
		const result = parseLoopArgs("--loop []");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain("at least one message");
	});

	it("errors when --loop contains non-strings", () => {
		// Bracket-aware tokenisation keeps the spaced array as one token.
		const result = parseLoopArgs('--loop ["a", 1]');
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain("must be strings");
	});

	it("errors when --max-iter is not an integer", () => {
		const result = parseLoopArgs('--loop ["a"] --max-iter two');
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain("positive integer");
	});

	it("errors when --max-iter is less than 1", () => {
		const result = parseLoopArgs('--loop ["a"] --max-iter 0');
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain("positive integer");
	});

	it("errors when --terminal-regex is invalid", () => {
		const result = parseLoopArgs('--loop ["a"] --terminal-regex [unclosed');
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain("invalid regex");
	});

	it("errors on an unexpected positional (goal) argument", () => {
		const result = parseLoopArgs('--loop ["a"] do the thing');
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain('unexpected argument "do');
		expect(result.error).toContain("goal is supported");
	});

	it("errors on an unknown flag", () => {
		const result = parseLoopArgs('--loop ["a"] --unknown x');
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain('unexpected argument "--unknown"');
	});

	it("errors when --loop has no value", () => {
		const result = parseLoopArgs("--loop");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain("--loop requires a JSON string array value");
	});

	it("errors when --max-iter has no value", () => {
		const result = parseLoopArgs('--loop ["a"] --max-iter');
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain("--max-iter requires an integer value");
	});

	it("errors when --terminal-regex has no value", () => {
		const result = parseLoopArgs('--loop ["a"] --terminal-regex');
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain("--terminal-regex requires a regex source value");
	});

	it("errors on empty input (no --loop)", () => {
		const result = parseLoopArgs("   ");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain("--loop is required");
	});
});
