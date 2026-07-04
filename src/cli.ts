#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ConfigError, loadConfig } from "./config.js";
import { configureConfig } from "./configure.js";
import {
	hasHelpFlag,
	printConfigureHelp,
	printInitHelp,
	printMainHelp,
	printRunHelp,
} from "./help.js";
import { writeDefaultConfig } from "./init.js";
import { bundleActivationOrder, expandBundle } from "./resources.js";
import { runPiPassthrough } from "./run.js";
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
// Build & spawn command
// ---------------------------------------------------------------------------

/**
 * Build the pi argv parts (resource flags) for a profile's bundles.
 *
 * Each bundle is expanded to its on-disk resource paths and emitted as
 * `-e`/`--skill`/`--prompt-template` flags, in a stable order
 * (pi-extensions → skills → prompts). Bundles are expanded in config order.
 */
async function buildResourceParts(profile: Profile): Promise<string[]> {
	const parts: string[] = [];
	// Deduplicate across the whole profile: a shared dependency (or a dep
	// listed explicitly alongside a bundle that pulls it in transitively) is
	// emitted exactly once. Activation order is deps-first, so a dependency's
	// resources are always emitted before those of the bundle that needs them.
	const emitted = new Set<string>();

	for (const name of profile.bundles ?? []) {
		for (const activationName of await bundleActivationOrder(name)) {
			if (emitted.has(activationName)) continue;
			emitted.add(activationName);

			const resolved = await expandBundle(activationName);

			for (const path of resolved.piExtensions) {
				parts.push("-e", path);
			}

			for (const path of resolved.skills) {
				parts.push("--skill", path);
			}

			for (const path of resolved.prompts) {
				parts.push("--prompt-template", path);
			}
		}
	}

	return parts;
}

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
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	// Global help — works even without a config file
	if (hasHelpFlag(args)) {
		if (args[0] === "init") {
			printInitHelp();
		} else if (args[0] === "configure") {
			printConfigureHelp();
		} else if (args[0] === "run") {
			printRunHelp();
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

	if (args[0] === "run") {
		await runPiPassthrough(args.slice(1));
		return;
	}

	let config: Config;
	try {
		config = loadConfig(process.cwd());
	} catch (err) {
		if (err instanceof ConfigError) {
			console.error(`Error: ${err.message}`);
		} else {
			console.error(`Error: ${(err as Error).message}`);
		}
		process.exit(1);
	}

	// Parse --profile flag from args
	const parsed = parseProfileFlag(args);

	if ("error" in parsed) {
		if (parsed.error !== "NO_PROFILE") {
			console.error(parsed.error);
			process.exit(1);
		}
	}

	const profileName = ("profileName" in parsed ? parsed.profileName : undefined) ?? config.default;
	const userArgs = "args" in parsed ? parsed.args : args;

	if (!config.profiles[profileName]) {
		console.error(`Profile "${profileName}" not found. Available profiles:`);
		for (const name of Object.keys(config.profiles)) {
			console.error(`  ${name}`);
		}
		process.exit(1);
	}

	const profile = config.profiles[profileName];

	if (!profile.cmd) {
		console.error(`Profile "${profileName}" is missing a "cmd" field.`);
		process.exit(1);
	}

	let fullCommand: string[];
	try {
		const parts = await buildResourceParts(profile);
		// Combine: user's cmd + resource flags + user args. We shell-exec the
		// whole thing so the user's cmd string is interpreted naturally.
		const allArgs = [...parts, ...userArgs].map(shellQuote);
		fullCommand = [profile.cmd, ...allArgs];
	} catch (err) {
		console.error(`Error resolving resources: ${(err as Error).message}`);
		process.exit(1);
	}

	const commandStr = fullCommand.join(" ");

	spawnShell(commandStr);
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
