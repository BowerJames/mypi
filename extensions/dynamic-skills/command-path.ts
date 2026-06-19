/**
 * Command path — `/skill:<name> <args>` expansion.
 *
 * Intercepts the `input` event (fires before Pi's built-in skill expansion).
 * Pipeline: strip frontmatter → execute shell → rewrap in a `<skill>` block
 * byte-identical to Pi's `_expandSkillCommand` → append trailing args.
 *
 * When no shell syntax is present the output is byte-identical to Pi's built-in
 * expansion, so installing this extension is safe for any existing skill.
 */

import { readFileSync } from "node:fs";
import type {
	ExtensionAPI,
	ExtensionContext,
	InputEvent,
	InputEventResult,
} from "@earendil-works/pi-coding-agent";
import { parseFrontmatter, stripFrontmatter } from "@earendil-works/pi-coding-agent";
import { executeShellInBody, resolveShellTimeoutMs } from "./shell.js";
import {
	findSkillByName,
	SKILL_PREFIX,
	type SkillIndexEntry,
	WRAPPED_PREFIX,
} from "./skill-index.js";

/** Byte-exact wrapper — consumed by Pi's parseSkillBlock regex. Do not reformat. */
export function buildSkillBlock(entry: SkillIndexEntry, body: string): string {
	return `<skill name="${entry.name}" location="${entry.filePath}">\nReferences are relative to ${entry.baseDir}.\n\n${body}\n</skill>`;
}

export async function handleSkillInput(
	event: InputEvent,
	_ctx: ExtensionContext,
	pi: ExtensionAPI,
): Promise<InputEventResult> {
	const text = event.text;

	// Re-entrancy: already-wrapped text passes through untouched.
	if (text.startsWith(WRAPPED_PREFIX)) return { action: "continue" };
	if (!text.startsWith(SKILL_PREFIX)) return { action: "continue" };

	// Single-space tokenisation — byte-match Pi's indexOf(" ").
	const spaceIndex = text.indexOf(" ");
	const skillName =
		spaceIndex === -1
			? text.slice(SKILL_PREFIX.length)
			: text.slice(SKILL_PREFIX.length, spaceIndex);
	const argsString = spaceIndex === -1 ? "" : text.slice(spaceIndex + 1).trim();

	const entry = findSkillByName(pi, skillName);
	if (!entry) return { action: "continue" }; // unknown skill — let Pi handle it

	let content: string;
	try {
		content = readFileSync(entry.filePath, "utf-8");
	} catch {
		return { action: "continue" }; // let Pi emit its own error via _expandSkillCommand
	}

	const { frontmatter } = parseFrontmatter<{ "shell-timeout"?: unknown }>(content);
	const body = stripFrontmatter(content).trim();
	const timeoutMs = resolveShellTimeoutMs(frontmatter);

	// No $1/$ARGUMENTS substitution in this extension — args are always appended
	// after </skill>, exactly like Pi's built-in expander.
	const processed = await executeShellInBody(body, pi.exec, process.cwd(), timeoutMs);

	const block = buildSkillBlock(entry, processed);
	return { action: "transform", text: argsString ? `${block}\n\n${argsString}` : block };
}
