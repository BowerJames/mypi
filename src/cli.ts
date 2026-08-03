#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ConfigError, loadConfig } from "./config.js";
import { configureConfig } from "./configure.js";
import { hasHelpFlag, printConfigureHelp, printInitHelp, printMainHelp } from "./help.js";
import { writeDefaultConfig } from "./init.js";
import { expandBundleArgs } from "./resources.js";
import { shellQuote, spawnShell } from "./shell.js";
import type { Config, Profile } from "./types.js";

// ---------------------------------------------------------------------------
// Init command
// ---------------------------------------------------------------------------

function initConfig(cwd: string): void {
	try {
		writeDefaultConfig(cwd);
		console.log("Created mypi-config.yaml");
		process.exit(0);
	} catch (err) {
		console.error(`Error: ${(err as Error).message}`);
		process.exit(1);
	}
}

// ---------------------------------------------------------------------------
// Retired-command guard
// ---------------------------------------------------------------------------

/**
 * The merged `mypi` always runs `pi`; the old `mypi run` passthrough is now
 * `mypi --bundle …`. The `run` token is intercepted before any dispatch
 * (including help), so `mypi run …` / `mypi run --help` error with a pointer
 * at the merged form instead of silently forwarding `run` to `pi`. Ordinary
 * bare positionals are not intercepted and continue to `pi`.
 */
const RETIRED_RUN_MESSAGE = `\
Error: "run" is no longer a mypi command.

The \`mypi run\` passthrough has been merged into \`mypi\` (which now always
runs \`pi\`). Use:

  mypi --bundle <name>                       ad-hoc bundle (no profile, no config)
  mypi --profile <name>                      launch a saved bundle-set
  mypi --profile <name> --bundle <name>      augment a profile with a bundle
  mypi                                       launch the default profile

Everything else (-p, --model, -e ./local.ts, @files, messages) forwards to
\`pi\` verbatim. See \`mypi --help\`.
`;

// ---------------------------------------------------------------------------
// Profile flag parsing
// ---------------------------------------------------------------------------

/**
 * Parse --profile flag(s) from an args array.
 *
 * Supports:
 *   --profile <name>
 *   --profile=<name>
 *
 * Removes all --profile occurrences from the array. If multiple are provided,
 * the last one wins.
 *
 * Returns { profileName, args } on success, or a string error message on failure.
 * Returns { error: "NO_PROFILE" } (not a real error) when no --profile is given.
 */
export function parseProfileFlag(
	args: string[],
): { profileName: string; args: string[] } | { error: string } {
	const remaining = [...args];
	let profileName: string | undefined;
	let i = 0;

	while (i < remaining.length) {
		if (remaining[i] === "--profile") {
			if (i + 1 >= remaining.length) {
				return { error: "Error: --profile requires a value." };
			}
			profileName = remaining[i + 1];
			remaining.splice(i, 2);
		} else if (remaining[i].startsWith("--profile=")) {
			const value = remaining[i].slice("--profile=".length);
			if (!value) {
				return { error: "Error: --profile= requires a value." };
			}
			profileName = value;
			remaining.splice(i, 1);
		} else {
			i++;
		}
	}

	if (!profileName) {
		return { error: "NO_PROFILE" };
	}

	return { profileName, args: remaining };
}

// ---------------------------------------------------------------------------
// Bundle flag parsing
// ---------------------------------------------------------------------------

/**
 * Parse --bundle flag(s) from an args array, returning the ordered bundle
 * names plus the args with every --bundle occurrence removed.
 *
 * Supports:
 *   --bundle <name>   (space-separated; consumes the next token)
 *   --bundle=<name>   (equals form)
 *
 * Multiple --bundle flags are collected left-to-right. A bare `--bundle` with
 * no following value (tail) or an empty `--bundle=` is **not** treated as a
 * bundle flag — it is left in the returned args and forwarded verbatim,
 * matching the passthrough's "everything else forwards untouched" contract.
 *
 * Pure (no side effects), safe to unit test.
 */
export function parseBundleFlags(args: string[]): {
	bundleNames: string[];
	args: string[];
} {
	const remaining = [...args];
	const bundleNames: string[] = [];
	let i = 0;

	while (i < remaining.length) {
		const token = remaining[i];

		if (token === "--bundle") {
			const next = remaining[i + 1];
			if (next === undefined) {
				// Bare --bundle at the tail — leave as-is (forwarded verbatim).
				i++;
				continue;
			}
			bundleNames.push(next);
			remaining.splice(i, 2);
		} else if (token.startsWith("--bundle=")) {
			const value = token.slice("--bundle=".length);
			if (value.length === 0) {
				// Empty --bundle= — leave as-is (forwarded verbatim).
				i++;
				continue;
			}
			bundleNames.push(value);
			remaining.splice(i, 1);
		} else {
			i++;
		}
	}

	return { bundleNames, args: remaining };
}

// ---------------------------------------------------------------------------
// argv assembly — one assembler, always `pi`
// ---------------------------------------------------------------------------

/**
 * Assemble the final argv: the expanded bundle-flag parts followed by the
 * forwarded args, with `pi` hardcoded as the target. The single execution
 * seam — both the no-profile and with-profile paths build their ordered
 * bundle-name list, expand it via the shared expander, then hand the parts
 * here. The caller quotes/joins the result and hands the string to
 * `spawnShell`.
 *
 * `pi` is always first; forwarded args keep their relative order, so positional
 * messages stay positional (last).
 */
export function assemblePiArgv(bundleParts: string[], forwardedArgs: string[]): string[] {
	return ["pi", ...bundleParts, ...forwardedArgs];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	// Retired-command guard — intercept `run` before any other dispatch
	// (including help), so `mypi run …` and `mypi run --help` error rather than
	// silently forward `run` to `pi`. Ordinary bare positionals are not
	// intercepted and continue to `pi`.
	if (args[0] === "run") {
		console.error(RETIRED_RUN_MESSAGE);
		process.exit(1);
	}

	// Global help — works even without a config file.
	if (hasHelpFlag(args)) {
		if (args[0] === "init") {
			printInitHelp();
		} else if (args[0] === "configure") {
			printConfigureHelp();
		} else {
			printMainHelp();
		}
	}

	if (args[0] === "init") {
		initConfig(process.cwd());
		return;
	}

	if (args[0] === "configure") {
		try {
			await configureConfig(process.cwd());
		} catch (err) {
			if (err instanceof ConfigError) {
				console.error(`Error: ${err.message}`);
			} else {
				console.error(`Error: ${(err as Error).message}`);
			}
			process.exit(1);
		}
		return;
	}

	// --- Everything below runs `pi`. ---
	//
	// Two input-collection strategies feed the same shared expander + assembler:
	//   • no --profile + a --bundle present  → no-profile path (≡ old `mypi run`):
	//     load NO config, expand the CLI bundles, forward the rest verbatim.
	//   • --profile <name>                   → with-profile path: load the config,
	//     resolve the profile's bundles, and append CLI --bundle flags (profile-first).
	//   • neither --profile nor --bundle     → the default profile applies (load config).

	// 1. Pull --profile out of the args (last wins; everything else stays).
	const parsedProfile = parseProfileFlag(args);
	if ("error" in parsedProfile && parsedProfile.error !== "NO_PROFILE") {
		console.error(parsedProfile.error);
		process.exit(1);
	}
	const hasProfile = !("error" in parsedProfile);
	const profileName = hasProfile ? parsedProfile.profileName : undefined;
	const argsAfterProfile = hasProfile ? parsedProfile.args : args;

	// 2. Pull --bundle out of the remaining args; everything else forwards verbatim.
	const { bundleNames: cliBundles, args: forwardedArgs } = parseBundleFlags(argsAfterProfile);

	// 3. Decide the path and collect the ordered bundle-name list.
	let bundleNames: string[];
	if (hasProfile) {
		// With-profile path: resolve the profile, then union its bundles with the
		// CLI bundles (profile-first, CLI appended left-to-right).
		const config = loadConfigOrExit();
		const profile = resolveProfileOrExit(config, profileName as string);
		bundleNames = [...(profile.bundles ?? []), ...cliBundles];
	} else if (cliBundles.length > 0) {
		// No-profile path (≡ old `mypi run`): load NO config; expand CLI bundles only.
		bundleNames = cliBundles;
	} else {
		// Bare invocation (no --profile, no --bundle) — the default profile applies.
		const config = loadConfigOrExit();
		const profile = resolveProfileOrExit(config, config.default);
		bundleNames = [...(profile.bundles ?? [])];
	}

	// 4. Expand + assemble, always targeting `pi`.
	let commandStr: string;
	try {
		const parts = await expandBundleArgs(bundleNames);
		commandStr = assemblePiArgv(parts, forwardedArgs).map(shellQuote).join(" ");
	} catch (err) {
		console.error(`Error resolving resources: ${(err as Error).message}`);
		process.exit(1);
	}

	spawnShell(commandStr);
}

/**
 * Load the effective config (built-ins + overlay), exiting with a clear error
 * on failure. Used by both the with-profile and bare-default paths.
 */
function loadConfigOrExit(): Config {
	try {
		return loadConfig(process.cwd());
	} catch (err) {
		if (err instanceof ConfigError) {
			console.error(`Error: ${err.message}`);
		} else {
			console.error(`Error: ${(err as Error).message}`);
		}
		process.exit(1);
	}
}

/**
 * Resolve a named profile from the effective config, exiting with the
 * available-profiles list if it does not exist.
 */
function resolveProfileOrExit(config: Config, profileName: string): Profile {
	const profile = config.profiles[profileName];
	if (!profile) {
		console.error(`Profile "${profileName}" not found. Available profiles:`);
		for (const name of Object.keys(config.profiles)) {
			console.error(`  ${name}`);
		}
		process.exit(1);
	}
	return profile;
}

/**
 * True only when this module is the process entry point (i.e. invoked as
 * `mypi ...`), not when imported (e.g. by unit tests importing
 * `parseProfileFlag`). Guards the top-level `main()` call so importing
 * `cli.js` does not launch a profile / spawn `pi` as a side effect.
 */
function isMainModule(): boolean {
	const entry = process.argv[1];
	if (!entry) return false;
	try {
		return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
	} catch {
		return false;
	}
}

if (isMainModule()) {
	main().catch((err) => {
		console.error(`Error: ${(err as Error).message}`);
		process.exit(1);
	});
}
