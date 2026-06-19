/**
 * `mypi run` — pi passthrough with bundled resource name resolution.
 *
 * Forwards every argument to `pi` verbatim, with one transformation: for the
 * resource flags `-e`/`--extension`, `--skill`, `--prompt-template`, if the
 * following value is a *bare name* (no path separator) of a bundled resource,
 * it is replaced with that resource's on-disk path. Everything else passes
 * through untouched.
 *
 * Flag handling mirrors pi's own parser (cli/args.js): these flags are only
 * recognised in the space-separated exact-token form, and are repeatable. The
 * `=` form (e.g. `-e=mode`, `--extension=mode`) is NOT recognised by pi for
 * these flags and is passed through untouched here to match.
 *
 * `mypi run` requires no config file and uses no profiles.
 */

import { resolveExtension, resolvePrompt, resolveSkill } from "./resources.js";
import { shellQuote, spawnShell } from "./shell.js";

/** The flag tokens pi treats as resource loaders (exact match, space form). */
const EXTENSION_FLAGS = new Set(["-e", "--extension"]);
const SKILL_FLAGS = new Set(["--skill"]);
const PROMPT_FLAGS = new Set(["--prompt-template"]);

/**
 * Map a resource flag token to its resolver, or `undefined` if it is not a
 * resource flag.
 */
function resolverForFlag(flag: string): ((name: string) => string) | undefined {
	if (EXTENSION_FLAGS.has(flag)) return resolveExtension;
	if (SKILL_FLAGS.has(flag)) return resolveSkill;
	if (PROMPT_FLAGS.has(flag)) return resolvePrompt;
	return undefined;
}

/**
 * Resolve a single resource value, applying the name-vs-path gate.
 *
 * - Values containing a path separator (`/` or `\`) are path-like and pass
 *   through untouched (no resolution attempted).
 * - Bare names are resolved against the bundled library; a miss falls back to
 *   the original value (silent passthrough so pi reports the missing file).
 */
function maybeResolveResource(value: string, resolve: (name: string) => string): string {
	if (value.includes("/") || value.includes("\\")) return value;
	try {
		return resolve(value);
	} catch {
		return value;
	}
}

/**
 * Transform an argv array, resolving bundled resource names for the resource
 * flags. Pure function — no side effects, safe to unit test.
 *
 * Walks left-to-right. When a token is exactly a resource flag AND a following
 * token exists, the flag is emitted and the following value is passed through
 * `maybeResolveResource`. All other tokens (including `=`-forms, unknown bare
 * flags, `@files`, and positional messages) are copied verbatim.
 */
export function resolveResourceArgs(args: string[]): string[] {
	const out: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const flag = args[i];
		const resolve = resolverForFlag(flag);

		if (resolve !== undefined && i + 1 < args.length) {
			const value = args[i + 1];
			out.push(flag);
			out.push(maybeResolveResource(value, resolve));
			i++; // consume the value
			continue;
		}

		out.push(flag);
	}

	return out;
}

/**
 * Resolve bundled resource names in `args`, then run `pi` with the resulting
 * argv via `sh -c` (inheriting stdio/env), consistent with the profile
 * launcher.
 */
export function runPiPassthrough(args: string[]): void {
	const resolved = resolveResourceArgs(args);
	const commandStr = ["pi", ...resolved].map(shellQuote).join(" ");
	spawnShell(commandStr);
}
