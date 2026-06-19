/**
 * Read path — transform `read` results for registered SKILL.md files.
 *
 * Gate process (applied in order; first miss → passthrough):
 *   1. toolName === "read"
 *   2. basename(input.path) === "SKILL.md"
 *   3. the resolved absolute path is one of the registered skills
 *      (same pi.getCommands()-based index the command path uses)
 *   4. not an error result, and a single text content part
 *
 * When all gates pass, the shell syntax in the visible text slice is executed
 * and the content is replaced. pi's pagination footers (`[Showing lines …]`)
 * and truncation markers are preserved — we operate on the slice pi already
 * returned. A block split across a page boundary simply won't match the regex
 * and is left verbatim (documented caveat).
 */

import { resolve, sep } from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
	ToolResultEvent,
} from "@earendil-works/pi-coding-agent";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { executeShellInBody, resolveShellTimeoutMs } from "./shell.js";
import { isRegisteredSkillPath } from "./skill-index.js";

interface TextPart {
	type: "text";
	text: string;
}

function isTextPart(part: unknown): part is TextPart {
	return typeof part === "object" && part !== null && (part as { type?: string }).type === "text";
}

/** Expand `~` and resolve a raw read path to an absolute path relative to cwd. */
function resolveReadPath(rawPath: string, cwd: string): string {
	const withHome = rawPath.startsWith("~")
		? `${process.env.HOME ?? ""}${rawPath.slice(1)}`
		: rawPath;
	return resolve(cwd, withHome);
}

export async function handleReadResult(
	event: ToolResultEvent,
	ctx: ExtensionContext,
	pi: ExtensionAPI,
): Promise<{ content: TextPart[] } | undefined> {
	if (event.toolName !== "read") return undefined;

	const rawPath = (event.input.path ?? event.input.file_path) as string | undefined;
	if (!rawPath) return undefined;

	// basename check — cheap gate before touching the skill index.
	const base = rawPath.split(sep).pop();
	if (base !== "SKILL.md") return undefined;

	const absPath = resolveReadPath(rawPath, ctx.cwd);
	if (!isRegisteredSkillPath(pi, absPath)) return undefined;

	if (event.isError) return undefined;

	// Require a single text part — never touch image/mixed/error reads.
	if (!Array.isArray(event.content) || event.content.length !== 1) return undefined;
	const part = event.content[0];
	if (!isTextPart(part)) return undefined;

	// The file body (frontmatter included) reaches the LLM on read; parse the
	// frontmatter for shell-timeout, then execute on the whole visible slice
	// pi returned (its pagination footers and truncation markers are preserved).
	const { frontmatter } = parseFrontmatter<{ "shell-timeout"?: unknown }>(part.text);
	const timeoutMs = resolveShellTimeoutMs(frontmatter);

	const processed = await executeShellInBody(part.text, pi.exec, ctx.cwd, timeoutMs);
	if (processed === part.text) return undefined; // no change

	return { content: [{ type: "text", text: processed }] };
}
