/**
 * Argument tokenization & parsing for the `/loop` command.
 *
 * Both functions are pure (no pi imports, no I/O) so they are trivially unit
 * testable.
 *
 * Argument grammar:
 *
 *   /loop [--terminal-regex <source>]
 *         [--max-iter <n>]
 *         --loop <json-array>
 *
 * - Tokens are whitespace-separated. A token beginning with `"` or `'` is read
 *   literally until the matching closing quote (delimiters stripped; no escape
 *   processing inside, so backslashes/`$`/`&` survive verbatim — important for
 *   regex sources like `<\/end>`).
 * - Bare tokens are **bracket-aware**: once an unmatched `[` or `{` is opened,
 *   whitespace and quotes are absorbed verbatim until the bracket closes. This
 *   means a JSON array value can be typed bare, even with internal spaces and
 *   quoted strings: `--loop ["/plan", "/evaluate-plan"]` is a single token.
 * - `--loop` takes a JSON-encoded `string[]`.
 * - `--max-iter` is a positive integer; defaults to 10 when omitted.
 * - `--terminal-regex` takes a regex **source** (compiled via `new RegExp`).
 * - Flags may appear in any order; a repeated flag's last value wins.
 * - Any other token (e.g. an accidental trailing goal) is an error.
 */

import type { LoopParseResult } from "./types.js";

/** Default iteration cap so a never-matching terminal regex still terminates. */
export const DEFAULT_MAX_ITER = 10;

/** Bracket characters that open/close a "raw" region inside a bare token. */
const OPEN_BRACKETS = new Set(["[", "{"]);
const CLOSE_BRACKETS = new Set(["]", "}"]);

/**
 * Split a raw argument string into tokens.
 *
 * Whitespace separates tokens. If a token starts with `"` or `'`, it is read
 * literally (delimiters stripped, internal whitespace preserved) until the
 * matching closing quote — no escape processing inside, so regex sources and
 * JSON survive verbatim.
 *
 * Bare tokens are bracket-aware: once an unmatched `[`/`{` is seen, subsequent
 * whitespace and quote characters are absorbed into the token until the bracket
 * closes. This lets a user type `--loop ["/plan", "/evaluate-plan"]` (with
 * internal spaces and quoted strings) as a single token without quoting it.
 *
 * Examples:
 *   --loop                          -> ["--loop"]
 *   --loop ["/plan","/evaluate-plan"] -> ["--loop", '["/plan","/evaluate-plan"]']
 *   --loop ["/plan", "/evaluate-plan"] -> ["--loop", '["/plan", "/evaluate-plan"]']
 *   --terminal-regex "<\/end>"      -> ["--terminal-regex", "<\\/end>"]
 *   foo "bar baz" qux               -> ["foo", "bar baz", "qux"]
 */
export function tokenize(args: string): string[] {
	const tokens: string[] = [];
	let i = 0;
	const n = args.length;

	while (i < n) {
		// Skip leading whitespace between tokens.
		while (i < n && /\s/.test(args[i])) i++;
		if (i >= n) break;

		const ch = args[i];

		if (ch === '"' || ch === "'") {
			const quote = ch;
			i++; // consume opening quote
			const start = i;
			while (i < n && args[i] !== quote) i++;
			// Unterminated quote is lenient: take the rest verbatim.
			tokens.push(args.slice(start, i));
			if (i < n) i++; // consume closing quote (if present)
			continue;
		}

		// Bare token: read until whitespace at bracket depth 0. While inside an
		// unmatched `[`/`{`, absorb whitespace and quotes verbatim so JSON
		// arrays survive as a single token.
		const start = i;
		let depth = 0;
		while (i < n) {
			const c = args[i];
			if (depth === 0 && /\s/.test(c)) break;
			if (OPEN_BRACKETS.has(c)) depth++;
			else if (CLOSE_BRACKETS.has(c)) depth = Math.max(0, depth - 1);
			i++;
		}
		tokens.push(args.slice(start, i));
	}

	return tokens;
}

/**
 * Parse tokenized `/loop` arguments into validated `LoopOptions`, or return an
 * error message describing the first problem encountered.
 *
 * Walks tokens left-to-right. Unknown tokens produce an error (so accidental
 * trailing "goal" arguments are caught with a helpful message). Duplicate
 * flags take their last value.
 */
export function parseLoopArgs(args: string): LoopParseResult {
	const tokens = tokenize(args);

	let loop: string[] | undefined;
	let maxIter: number | undefined;
	let terminalRegexSource: string | undefined;

	let i = 0;
	while (i < tokens.length) {
		const flag = tokens[i];

		switch (flag) {
			case "--loop": {
				const value = tokens[i + 1];
				if (value === undefined)
					return { ok: false, error: "--loop requires a JSON string array value." };
				const parsed = parseLoopValue(value);
				if ("error" in parsed) return { ok: false, error: parsed.error };
				loop = parsed.value;
				i += 2;
				continue;
			}
			case "--max-iter": {
				const value = tokens[i + 1];
				if (value === undefined)
					return { ok: false, error: "--max-iter requires an integer value." };
				const parsed = Number.parseInt(value, 10);
				if (!Number.isInteger(parsed) || parsed < 1) {
					return { ok: false, error: `--max-iter must be a positive integer (got "${value}").` };
				}
				maxIter = parsed;
				i += 2;
				continue;
			}
			case "--terminal-regex": {
				const value = tokens[i + 1];
				if (value === undefined)
					return { ok: false, error: "--terminal-regex requires a regex source value." };
				try {
					// Compile eagerly to surface invalid regex at parse time.
					new RegExp(value);
				} catch (err) {
					return {
						ok: false,
						error: `invalid regex for --terminal-regex: ${(err as Error).message}`,
					};
				}
				terminalRegexSource = value;
				i += 2;
				continue;
			}
			default:
				return {
					ok: false,
					error: `unexpected argument "${flag}" (/loop is flags-only; no goal is supported).`,
				};
		}
	}

	if (!loop) {
		return { ok: false, error: "--loop is required." };
	}

	return {
		ok: true,
		options: {
			loop,
			maxIter: maxIter ?? DEFAULT_MAX_ITER,
			terminalRegex: terminalRegexSource ? new RegExp(terminalRegexSource) : undefined,
		},
	};
}

/**
 * Parse and validate the `--loop` JSON value into a non-empty `string[]`.
 */
function parseLoopValue(value: string): { value: string[] } | { error: string } {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch (err) {
		return {
			error: `--loop must be a JSON string array (invalid JSON: ${(err as Error).message}).`,
		};
	}

	if (!Array.isArray(parsed)) {
		return { error: "--loop must be a JSON string array (got a non-array value)." };
	}
	if (parsed.length === 0) {
		return { error: "--loop must contain at least one message." };
	}
	for (const item of parsed) {
		if (typeof item !== "string") {
			return { error: "--loop must be a JSON string array (all elements must be strings)." };
		}
	}

	return { value: parsed };
}
