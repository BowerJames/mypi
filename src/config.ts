import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
import { effectiveDefault, mergeProfiles } from "./profiles.js";
import type { Config, Profile, UserConfig } from "./types.js";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Validate a single profile's shape. A profile must be a mapping with a
 * non-empty string `cmd`; `bundles`, if present, must be a string array.
 * Used for both user-overlay profiles and (defensively) any profile shape.
 */
function validateProfile(name: string, value: unknown): Profile {
	if (!isObject(value)) {
		throw new ConfigError(`Profile "${name}" must be a mapping.`);
	}

	if (typeof value.cmd !== "string" || value.cmd.length === 0) {
		throw new ConfigError(`Profile "${name}" must have a non-empty "cmd" string.`);
	}

	const profile: Profile = { cmd: value.cmd as string };

	if ("bundles" in value) {
		if (!isStringArray(value.bundles)) {
			throw new ConfigError(`Profile "${name}": "bundles" must be an array of strings.`);
		}
		profile.bundles = value.bundles;
	}

	return profile;
}

/**
 * Validate the *overlay* (`UserConfig`) shape.
 *
 * Lenient by design: the overlay may omit `default`, omit `profiles`, and/or
 * have an empty `profiles` map — the effective config (built-ins merged in) is
 * always non-empty. The only structural errors raised here are malformed
 * shapes (non-object, bad profile, wrong types). Cross-field invariants such
 * as "default must reference an existing profile" are checked in
 * `loadEffectiveConfig`, where the built-ins are visible.
 */
export function validateUserConfig(raw: unknown): UserConfig {
	if (raw === undefined || raw === null) {
		// Absent/empty overlay — equivalent to "no config".
		return {};
	}

	if (!isObject(raw)) {
		throw new ConfigError("mypi-config.yaml must contain a YAML mapping at the top level.");
	}

	const overlay: UserConfig = {};

	if ("default" in raw) {
		if (typeof raw.default !== "string") {
			throw new ConfigError('The "default" field must be a string.');
		}
		overlay.default = raw.default;
	}

	if ("profiles" in raw) {
		// A bare `profiles:` key (e.g. written by `mypi init` as a placeholder
		// under commented examples) parses to `null`. Treat that as "no
		// profiles" (absent) rather than malformed — only a non-null,
		// non-object value is a real shape error.
		if (raw.profiles === null) {
			return overlay;
		}
		if (!isObject(raw.profiles)) {
			throw new ConfigError('mypi-config.yaml "profiles" must be a mapping.');
		}

		const validatedProfiles: Record<string, Profile> = {};
		for (const [name, value] of Object.entries(raw.profiles)) {
			validatedProfiles[name] = validateProfile(name, value);
		}
		overlay.profiles = validatedProfiles;
	}

	return overlay;
}

// ---------------------------------------------------------------------------
// Effective config (built-ins merged with the user overlay)
// ---------------------------------------------------------------------------

/**
 * Build the effective `Config` from a user overlay, by merging built-in
 * profiles (always present) with the overlay's profiles (user wins on name
 * collision) and resolving the default (overlay `default` wins, else
 * `BUILTIN_DEFAULT`).
 *
 * Throws `ConfigError` if the resolved default does not reference an existing
 * (merged) profile — this is the one invariant that can only be checked once
 * the merge has happened. Because the built-ins are always present and
 * `BUILTIN_DEFAULT` always names one of them, the no-overlay path can never
 * throw here.
 */
export function buildEffectiveConfig(overlay: UserConfig): Config {
	const profiles = mergeProfiles(overlay.profiles);
	const defaultName = effectiveDefault(overlay.default);

	if (!(defaultName in profiles)) {
		throw new ConfigError(
			`Default profile "${defaultName}" does not exist. Available profiles:\n` +
				Object.keys(profiles)
					.map((n) => `  ${n}`)
					.join("\n"),
		);
	}

	return { default: defaultName, profiles };
}

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

/**
 * Read & validate the on-disk user overlay (`mypi-config.yaml`).
 *
 * Returns an empty `UserConfig` (`{}`) when the file is absent **or** empty
 * (`yaml.load` returns `undefined` for an empty file) — both are equivalent to
 * "no overlay", so the built-ins alone apply. A present-but-malformed file
 * (invalid YAML, bad shape) still throws `ConfigError`.
 *
 * Never throws ConfigError for a *missing* file — that is now a non-event.
 */
export function loadUserConfig(cwd: string): UserConfig {
	const configPath = resolve(cwd, "mypi-config.yaml");

	if (!existsSync(configPath)) {
		return {};
	}

	const raw = readFileSync(configPath, "utf-8");

	let parsed: unknown;
	try {
		parsed = yaml.load(raw);
	} catch (err) {
		throw new ConfigError(`Invalid YAML in mypi-config.yaml: ${(err as Error).message}`);
	}

	// An empty file parses to `undefined` — treat as an absent overlay rather
	// than a malformed one.
	return validateUserConfig(parsed);
}

/**
 * Load the effective config: the user overlay merged with the built-in
 * profiles. Always returns a valid `Config` with a resolvable default, even
 * when no `mypi-config.yaml` is present (built-ins only, default
 * `BUILTIN_DEFAULT`). Re-exported as `loadConfig` for the launcher/editor.
 */
export function loadEffectiveConfig(cwd: string): Config {
	return buildEffectiveConfig(loadUserConfig(cwd));
}

/** Alias kept for the launcher/editor call sites that consume the effective config. */
export const loadConfig = loadEffectiveConfig;

/**
 * Persist *only* the user overlay — never the built-ins. The overlay may omit
 * `profiles` (and even `default`); a minimal overlay is written as-is.
 */
export function saveConfig(cwd: string, overlay: UserConfig): void {
	const configPath = resolve(cwd, "mypi-config.yaml");
	const raw = yaml.dump(overlay, { lineWidth: -1, quotingType: "'", indent: 2 });
	writeFileSync(configPath, raw, "utf-8");
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConfigError";
	}
}
