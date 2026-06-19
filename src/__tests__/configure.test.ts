import { describe, expect, it } from "vitest";
import { isValidProfileName, orderMultiSelectResult } from "../configure.js";
import { discoverExtensions, discoverPrompts, discoverSkills } from "../resources.js";

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

describe("discoverExtensions", () => {
	it("discovers the bundled extensions", () => {
		const exts = discoverExtensions();
		expect(exts).toContain("code-review");
		expect(exts).toContain("mode");
		expect(exts).toContain("review-agent-trajectory");
	});

	it("returns a sorted array", () => {
		const exts = discoverExtensions();
		expect(exts).toEqual([...exts].sort());
	});
});

describe("discoverPrompts", () => {
	it("discovers the bundled prompt templates", () => {
		const prompts = discoverPrompts();
		expect(prompts).toContain("overview");
		expect(prompts).toContain("code-review");
		expect(prompts).toContain("review-agent-trajectory");
	});

	it("returns a sorted array", () => {
		const prompts = discoverPrompts();
		expect(prompts).toEqual([...prompts].sort());
	});
});

describe("discoverSkills", () => {
	it("discovers the bundled skills", () => {
		const skills = discoverSkills();
		expect(skills).toContain("repo-explorer");
	});

	it("returns a sorted array", () => {
		const skills = discoverSkills();
		expect(skills).toEqual([...skills].sort());
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
