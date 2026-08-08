import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { UserConfig } from "../cli-config.js";
import {
	buildEffectiveConfig,
	ConfigError,
	loadEffectiveConfig,
	loadUserConfig,
	saveConfig,
	validateUserConfig,
} from "../cli-config.js";
import { BUILTIN_DEFAULT, BUILTIN_PROFILES } from "../profile.js";

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

	it("accepts an overlay with a bundles-only profile", () => {
		const overlay = validateUserConfig({
			default: "custom",
			profiles: { custom: { bundles: ["mode"] } },
		});
		expect(overlay.default).toBe("custom");
		expect(overlay.profiles?.custom.bundles).toEqual(["mode"]);
	});

	it("accepts an overlay with an empty profiles map", () => {
		const overlay = validateUserConfig({ default: "developer", profiles: {} });
		expect(overlay.profiles).toEqual({});
	});

	it("accepts a profile with no bundles (empty profile)", () => {
		// A profile is a named bundle-set; bundles is optional, so an empty
		// mapping is structurally valid (it runs bare `pi`).
		const overlay = validateUserConfig({ profiles: { a: {} } });
		expect(overlay.profiles?.a).toEqual({});
	});

	it("silently ignores a legacy `cmd:` key (no breakage on upgrade)", () => {
		const overlay = validateUserConfig({
			profiles: { a: { cmd: "pi --model x", bundles: ["mode"] } },
		});
		// cmd is dropped; bundles are kept.
		expect(overlay.profiles?.a).toEqual({ bundles: ["mode"] });
		expect((overlay.profiles?.a as Record<string, unknown>).cmd).toBeUndefined();
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

	it("throws when bundles is not an array of strings", () => {
		expect(() => validateUserConfig({ profiles: { a: { bundles: "mode" } } })).toThrow(ConfigError);
		expect(() => validateUserConfig({ profiles: { a: { bundles: [123] } } })).toThrow(ConfigError);
	});

	it("omits bundles when the profile has none", () => {
		const overlay = validateUserConfig({ profiles: { a: {} } });
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
		const config = buildEffectiveConfig({ profiles: { custom: { bundles: ["mode"] } } });
		expect(config.default).toBe(BUILTIN_DEFAULT);
		expect(config.profiles.custom.bundles).toEqual(["mode"]);
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
			profiles: { developer: { bundles: ["btw"] } },
		});
		// User wins: the built-in's bundles are replaced wholesale.
		expect(config.profiles.developer.bundles).toEqual(["btw"]);
	});

	it("keeps the built-in reviewer alongside a custom developer override", () => {
		const config = buildEffectiveConfig({
			profiles: { developer: { bundles: ["btw"] } },
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
				profiles: { developer: { bundles: ["mode"] } },
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

	it("treats a bare `profiles:` key (parses to null) as absent — regression for mypi init output", () => {
		// `mypi init` writes `profiles:` with only comments beneath, which YAML
		// parses to null. Reading that back must NOT throw.
		writeFileSync(
			resolve(testDir, "mypi-config.yaml"),
			"default: developer\nprofiles:\n  # custom:\n",
		);
		expect(loadUserConfig(testDir)).toEqual({ default: "developer" });
	});

	it("loads a valid overlay", () => {
		writeFileSync(
			resolve(testDir, "mypi-config.yaml"),
			"default: custom\nprofiles:\n  custom:\n    bundles:\n      - mode\n",
		);
		const overlay = loadUserConfig(testDir);
		expect(overlay.default).toBe("custom");
		expect(overlay.profiles?.custom.bundles).toEqual(["mode"]);
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

	it("throws ConfigError when a profile has malformed bundles", () => {
		writeFileSync(
			resolve(testDir, "mypi-config.yaml"),
			"profiles:\n  test:\n    bundles: not-an-array\n",
		);
		try {
			loadUserConfig(testDir);
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ConfigError);
			expect((err as Error).message).toContain("bundles");
		}
	});

	it("save persists only the overlay (never built-ins)", () => {
		const overlay: UserConfig = {
			default: "custom",
			profiles: { custom: { bundles: ["mode"] } },
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
			profiles: { custom: { bundles: ["mode"] } },
		};
		saveConfig(testDir, overlay);

		const effective = loadEffectiveConfig(testDir);
		expect(effective.default).toBe("custom");
		// Both the user profile and the built-ins are present in the merge.
		expect(Object.keys(effective.profiles).sort()).toEqual(
			["custom", "developer", "llm-wiki", "reviewer", "wayfinder"].sort(),
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
