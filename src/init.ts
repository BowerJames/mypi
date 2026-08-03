import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The starter overlay written by `mypi init`.
 *
 * This is NOT the full configuration — built-in profiles (`developer`,
 * `reviewer`) ship with mypi and are always available without this file. The
 * overlay exists only to (a) pick a `default` and (b) add or override
 * profiles (named bundle-sets). A user profile with the same name as a
 * built-in replaces it wholesale.
 *
 * Written with comments so a fresh `mypi init` is self-documenting.
 */
export const DEFAULT_CONFIG_YAML = [
	"# mypi-config.yaml — user overlay (built-in profiles ship with mypi and are always available).",
	"# mypi always runs `pi`; a profile is just a named bundle-set. Built-ins:",
	"#   developer  — full dev agent (mode, code-review, dynamic-skills, btw, loop, render-raw, repo-explorer, overview, terminal-status)",
	"#   reviewer   — read-only code reviewer (code-review-prompt)",
	"#   llm-wiki   — LLM wiki manager in OKF format (llm-wiki, mode, repo-explorer)",
	"#   wayfinder  — chart a big effort as a map of decision tickets (wayfinder, mode, repo-explorer)",
	"#",
	"# Add/override profiles under 'profiles' below (a user profile with the same",
	"# name as a built-in replaces it). Set 'default' to choose the profile used by",
	"# bare 'mypi' (defaults to 'developer' if unset or if this file is absent).",
	"# A legacy `cmd:` key is silently ignored.",
	"",
	"default: developer",
	"",
	"profiles:",
	"  # custom:",
	"  #   bundles:",
	"  #     - mode",
	"  #     - repo-explorer",
	"",
].join("\n");

export function writeDefaultConfig(cwd: string): void {
	const configPath = resolve(cwd, "mypi-config.yaml");

	if (existsSync(configPath)) {
		throw new Error("mypi-config.yaml already exists.");
	}

	writeFileSync(configPath, DEFAULT_CONFIG_YAML, "utf-8");
}
