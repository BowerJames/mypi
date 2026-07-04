import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	buildEffectiveConfig,
	ConfigError,
	loadEffectiveConfig,
	loadUserConfig,
	saveConfig,
	validateUserConfig,
} from "../config.js";
import { BUILTIN_DEFAULT, BUILTIN_PROFILES } from "../profiles.js";
import type { UserConfig } from "../types.js";

// ---------------------------------------------------------------------------
// validateUserConfig (lenient overlay validation)
// ---------------------------------------------------------------------------

describe("validateUserConfig", () => {
	it("returns an empty overlay for null/undefined input (absent/empty file)", () => {
		expect(validateUserConfig(undefined)).toEqual({});
		expect(validateUserConfig(null)).toEqual({});
	});

	it("accepts a minimal overlay with only a default", () => {
		const overlay = validateUserConfig({ default: "developer" });
		expect(overlay.default).toBe("developer");
		expect(overlay.profiles).toBeUndefined();
	});

	it("accepts an overlay with profiles", () => {
		const overlay = validateUserConfig({
			default: "custom",
			profiles: { custom: { cmd: "pi", bundles: ["mode"] } },
		});
		expect(overlay.default).toBe("custom");
		expect(overlay.profiles?.custom.bundles).toEqual(["mode"]);
	});

	it("accepts an overlay with an empty profiles map", () => {
		const overlay = validateUserConfig({ default: "developer", profiles: {} });
		expect(overlay.profiles).toEqual({});
	});

	it("throws on non-object input", () => {
		expect(() => validateUserConfig("string")).toThrow(ConfigError);
		expect(() => validateUserConfig(42)).toThrow(ConfigError);
	});

	it("throws on array input", () => {
		expect(() => validateUserConfig([])).toThrow(ConfigError);
	});

	it("throws when default is not a string", () => {
		expect(() => validateUserConfig({ default: 123 })).toThrow(ConfigError);
	});

	it("throws when profiles is not an object", () => {
		expect(() => validateUserConfig({ profiles: [] })).toThrow(ConfigError);
	});

	it("throws when a profile is not an object", () => {
		expect(() => validateUserConfig({ profiles: { a: "not-an-object" } })).toThrow(ConfigError);
	});

	it("throws when a profile has no cmd", () => {
		expect(() => validateUserConfig({ profiles: { a: {} } })).toThrow(ConfigError);
	});

	it("throws when a profile cmd is empty string", () => {
		expect(() => validateUserConfig({ profiles: { a: { cmd: "" } } })).toThrow(ConfigError);
	});

	it("throws when a profile cmd is not a string", () => {
		expect(() => validateUserConfig({ profiles: { a: { cmd: 123 } } })).toThrow(ConfigError);
	});

	it("throws when bundles is not an array of strings", () => {
		expect(() => validateUserConfig({ profiles: { a: { cmd: "pi", bundles: "mode" } } })).toThrow(
			ConfigError,
		);
		expect(() => validateUserConfig({ profiles: { a: { cmd: "pi", bundles: [123] } } })).toThrow(
			ConfigError,
		);
	});

	it("omits optional arrays from profiles when not present", () => {
		const overlay = validateUserConfig({ profiles: { a: { cmd: "pi" } } });
		expect(overlay.profiles?.a.bundles).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// buildEffectiveConfig (merge built-ins + overlay)
// ---------------------------------------------------------------------------

describe("buildEffectiveConfig", () => {
	it("uses built-ins only when the overlay is empty", () => {
		const config = buildEffectiveConfig({});
		expect(config.default).toBe(BUILTIN_DEFAULT);
		expect(config.profiles.developer).toEqual(BUILTIN_PROFILES.developer);
		expect(config.profiles.reviewer).toEqual(BUILTIN_PROFILES.reviewer);
	});

	it("falls back to BUILTIN_DEFAULT when the overlay sets no default", () => {
		const config = buildEffectiveConfig({ profiles: { custom: { cmd: "pi" } } });
		expect(config.default).toBe(BUILTIN_DEFAULT);
		expect(config.profiles.custom.cmd).toBe("pi");
	});

	it("honours a user-set default", () => {
		const config = buildEffectiveConfig({ default: "reviewer" });
		expect(config.default).toBe("reviewer");
	});

	it("allows a user default that names a built-in", () => {
		const config = buildEffectiveConfig({ default: "developer" });
		expect(config.default).toBe("developer");
		expect(config.profiles.developer).toBeDefined();
	});

	it("a user profile with a built-in name overrides the built-in wholesale", () => {
		const config = buildEffectiveConfig({
			profiles: { developer: { cmd: "pi --model x" } },
		});
		// User wins: cmd replaced, built-in bundles dropped.
		expect(config.profiles.developer.cmd).toBe("pi --model x");
		expect(config.profiles.developer.bundles).toBeUndefined();
	});

	it("keeps the built-in reviewer alongside a custom developer override", () => {
		const config = buildEffectiveConfig({
			profiles: { developer: { cmd: "pi --model x" } },
		});
		expect(config.profiles.reviewer).toEqual(BUILTIN_PROFILES.reviewer);
	});

	it("throws when a user default does not reference any profile", () => {
		expect(() => buildEffectiveConfig({ default: "missing" })).toThrow(ConfigError);
	});

	it("throws when a user default references a removed-by-override name", () => {
		// If a user override replaces 'developer' but sets default to a name
		// that still does not exist after merge, it must error.
		expect(() =>
			buildEffectiveConfig({
				default: "ghost",
				profiles: { developer: { cmd: "pi" } },
			}),
		).toThrow(ConfigError);
	});
});

// ---------------------------------------------------------------------------
// loadUserConfig / saveConfig (file I/O on the overlay)
// ---------------------------------------------------------------------------

describe("loadUserConfig / saveConfig", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = resolve(
			tmpdir(),
			`mypi-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("returns an empty overlay when the file is absent", () => {
		expect(loadUserConfig(testDir)).toEqual({});
	});

	it("returns an empty overlay for an empty file", () => {
		writeFileSync(resolve(testDir, "mypi-config.yaml"), "");
		expect(loadUserConfig(testDir)).toEqual({});
	});

	it("loads a valid overlay", () => {
		writeFileSync(
			resolve(testDir, "mypi-config.yaml"),
			"default: custom\nprofiles:\n  custom:\n    cmd: pi\n",
		);
		const overlay = loadUserConfig(testDir);
		expect(overlay.default).toBe("custom");
		expect(overlay.profiles?.custom.cmd).toBe("pi");
	});

	it("throws ConfigError for invalid YAML", () => {
		writeFileSync(resolve(testDir, "mypi-config.yaml"), ":\n  invalid: [yaml");
		try {
			loadUserConfig(testDir);
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ConfigError);
			expect((err as Error).message).toContain("Invalid YAML");
		}
	});

	it("throws ConfigError when profiles is the wrong type", () => {
		writeFileSync(resolve(testDir, "mypi-config.yaml"), "profiles: []\n");
		try {
			loadUserConfig(testDir);
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ConfigError);
			expect((err as Error).message).toContain("profiles");
		}
	});

	it("throws ConfigError when a profile has no cmd", () => {
		writeFileSync(
			resolve(testDir, "mypi-config.yaml"),
			"profiles:\n  test:\n    bundles:\n      - mode\n",
		);
		try {
			loadUserConfig(testDir);
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ConfigError);
			expect((err as Error).message).toContain("cmd");
		}
	});

	it("save persists only the overlay (never built-ins)", () => {
		const overlay: UserConfig = {
			default: "custom",
			profiles: { custom: { cmd: "pi --model claude", bundles: ["mode"] } },
		};
		saveConfig(testDir, overlay);

		const reloaded = loadUserConfig(testDir);
		expect(reloaded.default).toBe("custom");
		expect(Object.keys(reloaded.profiles ?? {})).toEqual(["custom"]);
		// Built-ins must NOT be serialised into the user overlay file.
		expect(reloaded.profiles?.developer).toBeUndefined();
		expect(reloaded.profiles?.reviewer).toBeUndefined();
	});

	it("save → load round-trips and the effective config merges built-ins back in", () => {
		const overlay: UserConfig = {
			default: "custom",
			profiles: { custom: { cmd: "pi", bundles: ["mode"] } },
		};
		saveConfig(testDir, overlay);

		const effective = loadEffectiveConfig(testDir);
		expect(effective.default).toBe("custom");
		// Both the user profile and the built-ins are present in the merge.
		expect(Object.keys(effective.profiles).sort()).toEqual(
			["custom", "developer", "reviewer"].sort(),
		);
	});
});

// ---------------------------------------------------------------------------
// loadEffectiveConfig (end-to-end: file → merge)
// ---------------------------------------------------------------------------

describe("loadEffectiveConfig", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = resolve(
			tmpdir(),
			`mypi-config-eff-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("returns built-ins only when no config file exists (default = developer)", () => {
		const config = loadEffectiveConfig(testDir);
		expect(config.default).toBe("developer");
		expect(config.profiles.developer).toEqual(BUILTIN_PROFILES.developer);
		expect(config.profiles.reviewer).toEqual(BUILTIN_PROFILES.reviewer);
	});

	it("throws ConfigError when the user default does not resolve", () => {
		writeFileSync(resolve(testDir, "mypi-config.yaml"), "default: ghost\nprofiles: {}\n");
		try {
			loadEffectiveConfig(testDir);
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ConfigError);
			expect((err as Error).message).toContain("ghost");
		}
	});
});
