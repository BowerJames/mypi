/**
 * Shared shell-execution core for dynamic-skills.
 *
 * Adapts the proven machinery from @juicesharp/rpiv-args:
 *   - mask-and-restore so block output containing literal !`...` is never
 *     re-executed by the inline pass (R2)
 *   - empty backticks (`` !`` ``) left verbatim so pi.exec is never called
 *     with an empty `-c` argument (R3)
 *   - sequential execution, never Promise.all (FR11)
 *   - errors inlined (not fatal): timeout / non-zero exit
 *   - output truncated on BOTH success and error paths so a failing
 *     `npm test` cannot blow the LLM context budget (R1)
 *   - `pi.exec` never rejects (every termination path in dist/core/exec.js
 *     resolves) — no try/catch needed around it
 *
 * The shell-execution dependency is injected as `exec` (structurally identical
 * to `pi.exec`) so this module is pure and fully unit-testable.
 */

import type { ExecResult } from "@earendil-works/pi-coding-agent";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	type TruncationResult,
	truncateTail,
} from "@earendil-works/pi-coding-agent";

// ---------------------------------------------------------------------------
// Constants & patterns
// ---------------------------------------------------------------------------

/** Default ceiling for shell execution: 2 minutes. Overridable per skill via
 *  the `shell-timeout` frontmatter (seconds). */
export const DEFAULT_SHELL_TIMEOUT_MS = 120_000;

/** Inline shell: `!`command` — non-greedy single-line, no newline crossing.
 *  Capture is `[^`\n]+` (at least one char) so a literal `` !`` `` in prose
 *  does NOT run the shell with an empty `-c` argument.
 *  Global (/g) so matchAll() can iterate; callers MUST reset lastIndex to 0
 *  before each pass (see executeShellInBody) — matchAll respects lastIndex
 *  rather than cloning, so shared state would otherwise skip matches. */
export const SHELL_INLINE_PATTERN = /!`([^`\n]+)`/g;

/** Block shell: ```!\n…\n``` — multiline non-greedy. Captured content is
 *  handed to the shell as a single program (newlines preserved).
 *  Global (/g); see SHELL_INLINE_PATTERN for the lastIndex caveat. */
export const SHELL_BLOCK_PATTERN = /```!\n([\s\S]*?)\n```/g;

/** Shell-execution dependency — structurally identical to `pi.exec`. */
export type ShellExec = (
	command: string,
	args: string[],
	options?: { cwd?: string; timeout?: number; signal?: AbortSignal },
) => Promise<ExecResult>;

// ---------------------------------------------------------------------------
// shell-timeout resolution
//
// YAML scalar coercion at frontmatter parse time can produce number, string,
// boolean, null, NaN (`.nan`), or Infinity (`.inf`). Silent fallback to the
// default on any non-finite or non-positive value matches pi's graceful
// degradation posture.
//
// Number.isFinite is load-bearing — both NaN and Infinity must be rejected:
//   - NaN     → would silently bypass exec.js's `options.timeout > 0`
//               short-circuit and disable the timer.
//   - Infinity → Node's setTimeout(fn, Infinity) clamps to 1ms → an
//                immediate kill (the opposite of "no timeout").
// `0` is honored as explicit disable.
// ---------------------------------------------------------------------------

export function resolveShellTimeoutMs(frontmatter: { "shell-timeout"?: unknown }): number {
	const raw = frontmatter["shell-timeout"];
	if (raw === undefined) return DEFAULT_SHELL_TIMEOUT_MS;
	if (typeof raw !== "number" || !Number.isFinite(raw)) return DEFAULT_SHELL_TIMEOUT_MS;
	if (raw < 0) return DEFAULT_SHELL_TIMEOUT_MS;
	if (raw === 0) return 0;
	return raw * 1000;
}

// ---------------------------------------------------------------------------
// Output formatting / truncation
// ---------------------------------------------------------------------------

/** Truncate a string for LLM consumption: 50KB / 2000-line tail budget, with
 *  a `[truncated: hit ...]` footer when truncation occurred. Shared by the
 *  success path and the non-zero exit path so a multi-MB stderr cannot bypass
 *  the budget (R1). */
export function truncateForLLM(content: string): string {
	const trunc: TruncationResult = truncateTail(content, {
		maxLines: DEFAULT_MAX_LINES,
		maxBytes: DEFAULT_MAX_BYTES,
	});
	let out = trunc.content;
	if (trunc.truncated) {
		const limit =
			trunc.truncatedBy === "lines" ? `${trunc.maxLines} lines` : formatSize(trunc.maxBytes);
		out += `\n[truncated: hit ${limit}]`;
	}
	return out;
}

/** Combine stdout and stderr (stderr promoted under a `[stderr]` header when
 *  present) and apply the LLM output budget. */
export function formatShellOutput(res: ExecResult): string {
	let combined = res.stdout;
	if (res.stderr && res.stderr.length > 0) {
		const sep = combined.length === 0 || combined.endsWith("\n") ? "" : "\n";
		combined = `${combined}${sep}[stderr]\n${res.stderr}`;
	}
	return truncateForLLM(combined);
}

/** Run a single shell command and return the text to substitute in its place.
 *
 *  FR5 branch order: killed → code !== 0 → success. `killed` is checked first
 *  because a timed-out child may also report a non-zero code; the timeout
 *  message wins. The sub-second timeout floor (1s) avoids a contradictory
 *  "timed out after 0s" display. */
export async function runOneShellCommand(
	exec: ShellExec,
	command: string,
	cwd: string,
	timeoutMs: number,
): Promise<string> {
	const [shCmd, shFlag] =
		process.platform === "win32" ? ["powershell.exe", "-Command"] : ["sh", "-c"];
	const res: ExecResult = await exec(shCmd, [shFlag, command], { cwd, timeout: timeoutMs });
	if (res.killed) {
		const sec = Math.max(1, Math.round(timeoutMs / 1000));
		return `[Shell error: timed out after ${sec}s]`;
	}
	if (res.code !== 0) {
		return `[Shell error: exit code ${res.code}]\n${truncateForLLM(res.stderr)}`;
	}
	return formatShellOutput(res);
}

// ---------------------------------------------------------------------------
// Body processing — mask-and-restore (blocks → sentinels → inlines → restore)
//
// Block-before-inline is load-bearing: the block pattern's `[\s\S]*?` content
// group legitimately matches `!`` inside the fence; running inline first would
// eat backticks from block content and produce malformed bodies. Sentinels
// carry no backticks, so the inline regex cannot match against them — block
// outputs are protected from re-execution (R2).
// ---------------------------------------------------------------------------

export async function executeShellInBody(
	body: string,
	exec: ShellExec,
	cwd: string,
	timeoutMs: number,
): Promise<string> {
	// Pass 1: blocks → sentinels (outputs stashed in blockOutputs).
	const blockOutputs: string[] = [];
	let withSentinels = "";
	{
		SHELL_BLOCK_PATTERN.lastIndex = 0;
		const matches = [...body.matchAll(SHELL_BLOCK_PATTERN)];
		let last = 0;
		for (const m of matches) {
			const idx = m.index ?? 0;
			withSentinels += body.slice(last, idx);
			withSentinels += `\x00BLOCK${blockOutputs.length}\x00`;
			blockOutputs.push(await runOneShellCommand(exec, m[1] ?? "", cwd, timeoutMs));
			last = idx + m[0].length;
		}
		withSentinels += body.slice(last);
	}

	// Pass 2: inlines on the sentinel-bearing string.
	let withInlines = "";
	{
		SHELL_INLINE_PATTERN.lastIndex = 0;
		const matches = [...withSentinels.matchAll(SHELL_INLINE_PATTERN)];
		let last = 0;
		for (const m of matches) {
			const idx = m.index ?? 0;
			withInlines += withSentinels.slice(last, idx);
			withInlines += await runOneShellCommand(exec, m[1] ?? "", cwd, timeoutMs);
			last = idx + m[0].length;
		}
		withInlines += withSentinels.slice(last);
	}

	// Pass 3: restore block sentinels to their actual outputs.
	// biome-ignore lint/suspicious/noControlCharactersInRegex: NUL sentinels are intentional — shell output never contains literal NUL bytes, which is what makes them safe delimiters.
	return withInlines.replace(/\x00BLOCK(\d+)\x00/g, (_, n) => blockOutputs[Number(n)] ?? "");
}
