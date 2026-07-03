/**
 * Registered-skill registry for dynamic-skills.
 *
 * Built from `pi.getCommands()` — the authoritative source of skills Pi knows
 * about (filesystem-walked defaults + skills sourced from extension package
 * manifests via `pi.skills`). Adapted from @juicesharp/rpiv-args.
 *
 * Manifest fix: for skills declared via an extension's `pi.skills` manifest,
 * Pi overrides `cmd.sourceInfo.baseDir` with the *extension package* root, not
 * the skill folder. Pi's own internal expander uses `skill.baseDir =
 * dirname(filePath)`, which is what the byte-identical `<skill>` wrapper and
 * any "References are relative to" semantics expect — so we ignore
 * `sourceInfo.baseDir` and compute `dirname(filePath)` ourselves.
 */

import { realpathSync } from "node:fs";
import { dirname } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export interface SkillIndexEntry {
	readonly name: string;
	readonly filePath: string;
	readonly baseDir: string;
}

/** Prefix Pi uses for skill commands. */
export const SKILL_PREFIX = "/skill:";

/** Re-entrancy guard — text our own (or another extension's) transform produced. */
export const WRAPPED_PREFIX = "<skill ";

let skillIndex: Map<string, SkillIndexEntry> | null = null;

/** Structural view of a slash command as returned by `pi.getCommands()`. */
interface CommandLike {
	name: string;
	source?: string;
	sourceInfo?: { path?: string; baseDir?: string };
}

/** Build the name→entry index from Pi's command registry. */
export function buildSkillIndex(pi: ExtensionAPI): Map<string, SkillIndexEntry> {
	const index = new Map<string, SkillIndexEntry>();
	for (const cmd of pi.getCommands() as CommandLike[]) {
		if (cmd.source !== "skill") continue;
		// Pi prefixes skill-source commands with "skill:".
		const name = cmd.name.startsWith("skill:") ? cmd.name.slice("skill:".length) : cmd.name;
		const filePath = cmd.sourceInfo?.path;
		if (!filePath) continue;
		index.set(name, { name, filePath, baseDir: dirname(filePath) });
	}
	return index;
}

/** Lazily memoized skill index. Pass `pi` so the extension owns no captured
 *  singleton state beyond the cache itself. */
export function getSkillIndex(pi: ExtensionAPI): Map<string, SkillIndexEntry> {
	if (!skillIndex) skillIndex = buildSkillIndex(pi);
	return skillIndex;
}

/** Drop the cached index. Called on session_start (startup/reload). */
export function invalidateSkillIndex(): void {
	skillIndex = null;
}

/** Look up a skill by its invocation name. */
export function findSkillByName(pi: ExtensionAPI, name: string): SkillIndexEntry | undefined {
	return getSkillIndex(pi).get(name);
}

/** Resolve an absolute file path to a real path, tolerating non-existent files
 *  (returns the input unchanged on any error). */
function resolveRealPath(p: string): string {
	try {
		return realpathSync(p);
	} catch {
		return p;
	}
}

/** True if `absPath` is the file path of a registered skill. Uses realpath
 *  comparison so symlinks resolve consistently; falls back to a string
 *  compare when realpath fails. Used by the read-path gate. */
export function isRegisteredSkillPath(pi: ExtensionAPI, absPath: string): boolean {
	const index = getSkillIndex(pi);
	const target = resolveRealPath(absPath);
	for (const entry of index.values()) {
		if (entry.filePath === absPath) return true;
		if (resolveRealPath(entry.filePath) === target) return true;
	}
	return false;
}
