/**
 * `mypi run` — pi passthrough with bundle expansion.
 *
 * Forwards every argument to `pi` verbatim, with one transformation: a mypi
 * `--bundle <name>` (or `--bundle=<name>`) flag is expanded to that bundle's
 * pi resource flags (`-e`/`--skill`/`--prompt-template`), in pi-extensions →
 * skills → prompts order. Everything else passes through untouched —
 * including path-like `-e ./local.ts`, other pi flags, and positional
 * messages — so power-user passthrough still works.
 *
 * Multiple `--bundle` flags are allowed; each expands independently.
 *
 * `mypi run` requires no config file and uses no profiles.
 */

import { expandBundle } from "./resources.js";
import { shellQuote, spawnShell } from "./shell.js";

/** The pi flags emitted for each bundle facet, in order. */
const PI_EXTENSION_FLAG = "-e";
const PI_SKILL_FLAG = "--skill";
const PI_PROMPT_FLAG = "--prompt-template";

/**
 * Transform an argv array, expanding `--bundle <name>` into pi flags. Pure
 * (no side effects) aside from the awaited bundle loads, safe to unit test.
 *
 * Walks left-to-right. When a token is exactly a bundle flag AND a following
 * token exists, the bundle is resolved and its facets are emitted as pi
 * flags. All other tokens (including unknown bare flags, `@files`, and
 * positional messages) are copied verbatim.
 *
 * `--bundle=` (equals form) is also recognised and handled the same way.
 */
export async function resolveRunArgs(args: string[]): Promise<string[]> {
	const out: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const token = args[i];
		const bundleName = bundleNameFor(token, args[i + 1]);

		if (bundleName !== undefined) {
			const resolved = await expandBundle(bundleName);

			for (const path of resolved.piExtensions) {
				out.push(PI_EXTENSION_FLAG, path);
			}
			for (const path of resolved.skills) {
				out.push(PI_SKILL_FLAG, path);
			}
			for (const path of resolved.prompts) {
				out.push(PI_PROMPT_FLAG, path);
			}

			// Consume the value token too when we used the space-separated form.
			if (token === "--bundle") i++;
			continue;
		}

		out.push(token);
	}

	return out;
}

/**
 * If `token` is a bundle flag (or the next token follows a `--bundle`), return
 * the bundle name to expand. Returns `undefined` for any non-bundle token.
 */
function bundleNameFor(token: string, next: string | undefined): string | undefined {
	if (token === "--bundle") {
		// Need a following value; bare `--bundle` at the tail is left as-is.
		if (next === undefined) return undefined;
		return next;
	}

	if (token.startsWith("--bundle=")) {
		const value = token.slice("--bundle=".length);
		return value.length > 0 ? value : undefined;
	}

	return undefined;
}

/**
 * Resolve `--bundle` flags in `args`, then run `pi` with the resulting argv
 * via `sh -c` (inheriting stdio/env), consistent with the profile launcher.
 */
export async function runPiPassthrough(args: string[]): Promise<void> {
	const resolved = await resolveRunArgs(args);
	const commandStr = ["pi", ...resolved].map(shellQuote).join(" ");
	spawnShell(commandStr);
}
