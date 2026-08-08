import { existsSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidProfileName, orderMultiSelectResult } from "../configure.js";
import { getMypiSkillsDir } from "../mypi-dir.js";
import { bundleExists, discoverBundles, expandBundle, loadBundle } from "../resources.js";
import { createSkill } from "../skill.js";

// `expandBundle` materialises code-defined skills via `createSkill`, which
// writes to disk. The writer itself is unit-tested in skill.test.ts with
// `node:fs` mocked; here we mock `createSkill` so these expansion tests verify
// wiring (content → baseDir → overwrite option → returned path) without any OS
// writes.
vi.mock("../skill.js", () => ({
	createSkill: vi.fn(),
}));

const mockedCreateSkill = vi.mocked(createSkill);

beforeEach(() => {
	mockedCreateSkill.mockReset();
});

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

	it("expands repo-explorer by materialising its skill via createSkill (no OS write)", async () => {
		mockedCreateSkill.mockReturnValue("/mocked/repo-explorer.md");
		const resolved = await expandBundle("repo-explorer");

		expect(resolved.skills).toEqual(["/mocked/repo-explorer.md"]);
		expect(mockedCreateSkill).toHaveBeenCalledTimes(1);
		expect(mockedCreateSkill).toHaveBeenCalledWith(
			expect.objectContaining({
				frontMatter: expect.objectContaining({
					name: "repo-explorer",
					description: expect.stringContaining("explore third party codebases"),
				}),
				body: expect.stringContaining("## Repository Cache"),
			}),
			getMypiSkillsDir(),
			{ throwIfExists: false },
		);
	});

	it("expands wayfinder to a single pi-extension file that exists on disk", async () => {
		const resolved = await expandBundle("wayfinder");
		expect(resolved.piExtensions.length).toBe(1);
		expect(resolved.skills).toEqual([]);
		expect(resolved.prompts).toEqual([]);
		expect(existsSync(resolved.piExtensions[0])).toBe(true);
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
