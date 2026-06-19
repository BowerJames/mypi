import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
import type { Config, Profile } from "./types.js";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function validateConfig(raw: unknown): Config {
	if (!isObject(raw)) {
		throw new ConfigError("mypi-config.yaml must contain a YAML mapping at the top level.");
	}

	// Validate "default" field
	if (!("default" in raw)) {
		throw new ConfigError('mypi-config.yaml must contain a "default" profile name.');
	}

	if (typeof raw.default !== "string") {
		throw new ConfigError('The "default" field must be a string.');
	}

	// Validate "profiles" field
	if (!("profiles" in raw) || !isObject(raw.profiles)) {
		throw new ConfigError('mypi-config.yaml must contain a "profiles" object.');
	}

	const profileEntries = Object.entries(raw.profiles);

	if (profileEntries.length === 0) {
		throw new ConfigError("No profiles defined in mypi-config.yaml.");
	}

	const validatedProfiles: Record<string, Profile> = {};

	for (const [name, value] of profileEntries) {
		if (!isObject(value)) {
			throw new ConfigError(`Profile "${name}" must be a mapping.`);
		}

		if (typeof value.cmd !== "string" || value.cmd.length === 0) {
			throw new ConfigError(`Profile "${name}" must have a non-empty "cmd" string.`);
		}

		const profile: Profile = { cmd: value.cmd as string };

		if ("extensions" in value) {
			if (!isStringArray(value.extensions)) {
				throw new ConfigError(`Profile "${name}": "extensions" must be an array of strings.`);
			}
			profile.extensions = value.extensions;
		}

		if ("skills" in value) {
			if (!isStringArray(value.skills)) {
				throw new ConfigError(`Profile "${name}": "skills" must be an array of strings.`);
			}
			profile.skills = value.skills;
		}

		if ("prompts" in value) {
			if (!isStringArray(value.prompts)) {
				throw new ConfigError(`Profile "${name}": "prompts" must be an array of strings.`);
			}
			profile.prompts = value.prompts;
		}

		validatedProfiles[name] = profile;
	}

	if (!(raw.default in validatedProfiles)) {
		throw new ConfigError(`Default profile "${raw.default}" does not exist in profiles.`);
	}

	return {
		default: raw.default,
		profiles: validatedProfiles,
	};
}

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

export function loadConfig(cwd: string): Config {
	const configPath = resolve(cwd, "mypi-config.yaml");

	if (!existsSync(configPath)) {
		throw new ConfigError(
			"mypi-config.yaml not found in current directory.\n" + "Run `mypi init` to create one.",
		);
	}

	const raw = readFileSync(configPath, "utf-8");

	let parsed: unknown;
	try {
		parsed = yaml.load(raw);
	} catch (err) {
		throw new ConfigError(`Invalid YAML in mypi-config.yaml: ${(err as Error).message}`);
	}

	return validateConfig(parsed);
}

export function saveConfig(cwd: string, config: Config): void {
	const configPath = resolve(cwd, "mypi-config.yaml");
	const raw = yaml.dump(config, { lineWidth: -1, quotingType: "'", indent: 2 });
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
