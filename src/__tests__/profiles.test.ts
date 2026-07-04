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
	it("ships exactly the developer and reviewer profiles", () => {
		expect(Object.keys(BUILTIN_PROFILES).sort()).toEqual(["developer", "reviewer"]);
	});

	it("developer matches the repo's prior default profile (model-less)", () => {
		expect(BUILTIN_PROFILES.developer.cmd).toBe("pi");
		expect(BUILTIN_PROFILES.developer.bundles).toEqual([
			"mode",
			"code-review",
			"dynamic-skills",
			"btw",
			"loop",
			"render-raw",
			"repo-explorer",
			"overview",
		]);
	});

	it("reviewer matches the repo's prior reviewer profile (model-less)", () => {
		expect(BUILTIN_PROFILES.reviewer.cmd).toBe("pi -p");
		expect(BUILTIN_PROFILES.reviewer.bundles).toEqual(["code-review-prompt"]);
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
	});

	it("returns false for user-only names", () => {
		expect(isBuiltinProfile("custom")).toBe(false);
		expect(isBuiltinProfile("")).toBe(false);
	});
});

describe("mergeProfiles", () => {
	it("returns the built-ins when no overlay is provided", () => {
		const merged = mergeProfiles(undefined);
		expect(Object.keys(merged).sort()).toEqual(["developer", "reviewer"]);
		expect(merged.developer).toEqual(BUILTIN_PROFILES.developer);
	});

	it("adds user profiles alongside the built-ins", () => {
		const custom: Profile = { cmd: "pi --model x", bundles: ["mode"] };
		const merged = mergeProfiles({ custom });
		expect(merged.custom).toEqual(custom);
		expect(merged.developer).toEqual(BUILTIN_PROFILES.developer);
	});

	it("a user profile with a built-in name replaces it wholesale", () => {
		const override: Profile = { cmd: "pi --model y" }; // no bundles — replaces entirely
		const merged = mergeProfiles({ developer: override });
		// User wins; built-in cmd/bundles are NOT merged field-by-field.
		expect(merged.developer.cmd).toBe("pi --model y");
		expect(merged.developer.bundles).toBeUndefined();
	});

	it("does not mutate the BUILTIN_PROFILES constant", () => {
		mergeProfiles({ developer: { cmd: "pi --model z" } });
		// Original built-in must be untouched after a merge with an override.
		expect(BUILTIN_PROFILES.developer.cmd).toBe("pi");
		expect(BUILTIN_PROFILES.developer.bundles).toBeDefined();
	});

	it("returns a fresh object each call (caller cannot poison built-ins)", () => {
		const a = mergeProfiles(undefined);
		a.developer.cmd = "mutated";
		const b = mergeProfiles(undefined);
		expect(b.developer.cmd).toBe("pi"); // unaffected by the previous mutation
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
