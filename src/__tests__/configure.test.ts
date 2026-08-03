import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isValidProfileName, orderMultiSelectResult } from "../configure.js";
import {
	BUNDLES_DIR,
	bundleExists,
	discoverBundles,
	expandBundle,
	loadBundle,
} from "../resources.js";

describe("isValidProfileName", () => {
	it("accepts simple names", () => {
		expect(isValidProfileName("foo")).toBe(true);
		expect(isValidProfileName("fullstack")).toBe(true);
	});

	it("accepts hyphens", () => {
		expect(isValidProfileName("my-profile")).toBe(true);
	});

	it("accepts underscores", () => {
		expect(isValidProfileName("my_profile")).toBe(true);
	});

	it("accepts numbers", () => {
		expect(isValidProfileName("profile1")).toBe(true);
	});

	it("rejects spaces", () => {
		expect(isValidProfileName("my profile")).toBe(false);
	});

	it("rejects special characters", () => {
		expect(isValidProfileName("foo@bar")).toBe(false);
		expect(isValidProfileName("foo.bar")).toBe(false);
	});

	it("rejects empty string", () => {
		expect(isValidProfileName("")).toBe(false);
	});
});

describe("discoverBundles", () => {
	it("discovers the bundled extension bundles", () => {
		const bundles = discoverBundles();
		expect(bundles).toContain("mode");
		expect(bundles).toContain("btw");
		expect(bundles).toContain("loop");
		expect(bundles).toContain("dynamic-skills");
		expect(bundles).toContain("render-raw");
		expect(bundles).toContain("code-review");
		expect(bundles).toContain("code-review-prompt");
		expect(bundles).toContain("repo-explorer");
		expect(bundles).toContain("overview");
		expect(bundles).toContain("llm-wiki");
		expect(bundles).toContain("terminal-status");
		expect(bundles).toContain("wayfinder");
	});

	it("returns a sorted array", () => {
		const bundles = discoverBundles();
		expect(bundles).toEqual([...bundles].sort());
	});
});

describe("bundleExists", () => {
	it("returns true for a known bundle", () => {
		expect(bundleExists("mode")).toBe(true);
	});

	it("returns false for an unknown bundle", () => {
		expect(bundleExists("does-not-exist")).toBe(false);
	});
});

describe("loadBundle / expandBundle", () => {
	it("loads the mode manifest and reports its name", async () => {
		const manifest = await loadBundle("mode");
		expect(manifest.name).toBe("mode");
	});

	it("expands mode to a single pi-extension path that exists on disk", async () => {
		const resolved = await expandBundle("mode");
		expect(resolved.piExtensions.length).toBe(1);
		expect(resolved.skills).toEqual([]);
		expect(resolved.prompts).toEqual([]);
		expect(existsSync(resolved.piExtensions[0])).toBe(true);
	});

	it("expands code-review-prompt to a single prompt path that exists on disk", async () => {
		const resolved = await expandBundle("code-review-prompt");
		expect(resolved.prompts.length).toBe(1);
		expect(resolved.piExtensions).toEqual([]);
		expect(resolved.skills).toEqual([]);
		expect(existsSync(resolved.prompts[0])).toBe(true);
	});

	it("expands repo-explorer to a single skill path that exists on disk", async () => {
		const resolved = await expandBundle("repo-explorer");
		expect(resolved.skills.length).toBe(1);
		expect(existsSync(resolve(BUNDLES_DIR, "repo-explorer", "skills", "repo-explorer"))).toBe(true);
	});

	it("expands wayfinder to its pi-extension plus thirteen skills that exist on disk", async () => {
		const resolved = await expandBundle("wayfinder");
		expect(resolved.piExtensions.length).toBe(1);
		expect(existsSync(resolved.piExtensions[0])).toBe(true);
		expect(resolved.prompts).toEqual([]);
		// wayfinder ships thirteen model-invocable skills (one per label).
		expect(resolved.skills.length).toBe(13);
		for (const skill of resolved.skills) {
			expect(existsSync(skill)).toBe(true);
		}
	});

	it("throws on an unknown bundle", async () => {
		await expect(loadBundle("nope")).rejects.toThrow(/not found/);
	});
});

describe("orderMultiSelectResult", () => {
	it("preserves existing config order and appends new selections in UI order", () => {
		const allOptions = ["a", "b", "c"];
		const currentlySelected = ["b", "a"];
		const selected = new Set(["a", "b", "c"]);

		expect(orderMultiSelectResult(allOptions, currentlySelected, selected)).toEqual([
			"b",
			"a",
			"c",
		]);
	});

	it("preserves stale entries in their existing order", () => {
		const allOptions = ["a", "c", "old (stale)"];
		const currentlySelected = ["old", "a"];
		const selected = new Set(["a", "old (stale)", "c"]);

		expect(orderMultiSelectResult(allOptions, currentlySelected, selected)).toEqual([
			"old",
			"a",
			"c",
		]);
	});

	it("omits deselected existing items", () => {
		const allOptions = ["a", "b", "c"];
		const currentlySelected = ["b", "a"];
		const selected = new Set(["a"]);

		expect(orderMultiSelectResult(allOptions, currentlySelected, selected)).toEqual(["a"]);
	});
});
