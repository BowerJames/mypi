import { describe, expect, it } from "vitest";
import {
	BUILTIN_DEFAULT,
	BUILTIN_PROFILES,
	effectiveDefault,
	isBuiltinProfile,
	mergeProfiles,
} from "../profiles.js";
import type { Profile } from "../types.js";

describe("BUILTIN_PROFILES", () => {
	it("ships exactly the developer, llm-wiki, reviewer, and wayfinder profiles", () => {
		expect(Object.keys(BUILTIN_PROFILES).sort()).toEqual([
			"developer",
			"llm-wiki",
			"reviewer",
			"wayfinder",
		]);
	});

	it("developer is a bundle-set (no cmd)", () => {
		expect(BUILTIN_PROFILES.developer).toEqual({
			bundles: [
				"mode",
				"code-review",
				"dynamic-skills",
				"btw",
				"loop",
				"render-raw",
				"repo-explorer",
				"overview",
				"terminal-status",
			],
		});
	});

	it("reviewer is a bundle-set for the code-review prompt (no cmd)", () => {
		expect(BUILTIN_PROFILES.reviewer).toEqual({ bundles: ["code-review-prompt"] });
	});

	it("llm-wiki is a bundle-set", () => {
		expect(BUILTIN_PROFILES["llm-wiki"]).toEqual({
			bundles: ["llm-wiki", "mode", "repo-explorer"],
		});
	});

	it("wayfinder is a bundle-set that activates the wayfinder bundle", () => {
		expect(BUILTIN_PROFILES.wayfinder).toEqual({
			bundles: ["wayfinder", "mode", "repo-explorer"],
		});
	});
});

describe("BUILTIN_DEFAULT", () => {
	it("defaults to developer", () => {
		expect(BUILTIN_DEFAULT).toBe("developer");
		expect(BUILTIN_DEFAULT in BUILTIN_PROFILES).toBe(true);
	});
});

describe("isBuiltinProfile", () => {
	it("returns true for built-in names", () => {
		expect(isBuiltinProfile("developer")).toBe(true);
		expect(isBuiltinProfile("reviewer")).toBe(true);
		expect(isBuiltinProfile("llm-wiki")).toBe(true);
		expect(isBuiltinProfile("wayfinder")).toBe(true);
	});

	it("returns false for user-only names", () => {
		expect(isBuiltinProfile("custom")).toBe(false);
		expect(isBuiltinProfile("")).toBe(false);
	});
});

describe("mergeProfiles", () => {
	it("returns the built-ins when no overlay is provided", () => {
		const merged = mergeProfiles(undefined);
		expect(Object.keys(merged).sort()).toEqual(["developer", "llm-wiki", "reviewer", "wayfinder"]);
		expect(merged.developer).toEqual(BUILTIN_PROFILES.developer);
	});

	it("adds user profiles alongside the built-ins", () => {
		const custom: Profile = { bundles: ["mode"] };
		const merged = mergeProfiles({ custom });
		expect(merged.custom).toEqual(custom);
		expect(merged.developer).toEqual(BUILTIN_PROFILES.developer);
	});

	it("a user profile with a built-in name replaces it wholesale", () => {
		const override: Profile = { bundles: ["btw"] }; // replaces the built-in bundles
		const merged = mergeProfiles({ developer: override });
		// User wins; built-in bundles are NOT merged field-by-field.
		expect(merged.developer).toEqual({ bundles: ["btw"] });
	});

	it("does not mutate the BUILTIN_PROFILES constant", () => {
		mergeProfiles({ developer: { bundles: ["x"] } });
		// Original built-in must be untouched after a merge with an override.
		expect(BUILTIN_PROFILES.developer).toEqual({
			bundles: [
				"mode",
				"code-review",
				"dynamic-skills",
				"btw",
				"loop",
				"render-raw",
				"repo-explorer",
				"overview",
				"terminal-status",
			],
		});
	});

	it("returns a fresh object each call (caller cannot poison built-ins)", () => {
		const a = mergeProfiles(undefined);
		a.developer.bundles = ["mutated"];
		const b = mergeProfiles(undefined);
		expect(b.developer.bundles).toEqual([
			"mode",
			"code-review",
			"dynamic-skills",
			"btw",
			"loop",
			"render-raw",
			"repo-explorer",
			"overview",
			"terminal-status",
		]); // unaffected by the previous mutation
	});
});

describe("effectiveDefault", () => {
	it("returns the user default when set", () => {
		expect(effectiveDefault("reviewer")).toBe("reviewer");
		expect(effectiveDefault("custom")).toBe("custom");
	});

	it("falls back to BUILTIN_DEFAULT when undefined", () => {
		expect(effectiveDefault(undefined)).toBe(BUILTIN_DEFAULT);
		expect(effectiveDefault(undefined)).toBe("developer");
	});

	it("falls back to BUILTIN_DEFAULT when an empty string is given", () => {
		// An empty string is not a usable default; fall back rather than return "".
		expect(effectiveDefault("")).toBe(BUILTIN_DEFAULT);
	});
});
