import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	DEFAULT_WIKI_ROOT,
	DEFAULT_WIKI_SPEC,
	displayRoot,
	resolveWikiRoot,
	resolveWikiSpec,
} from "./paths.js";

describe("defaults", () => {
	it("wiki-root default is 'wiki'", () => {
		expect(DEFAULT_WIKI_ROOT).toBe("wiki");
	});

	it("wiki-spec default is '/SPEC.md' (wiki-root-relative)", () => {
		expect(DEFAULT_WIKI_SPEC).toBe("/SPEC.md");
	});
});

describe("resolveWikiRoot", () => {
	it("joins a relative root onto cwd", () => {
		expect(resolveWikiRoot("/proj", "wiki")).toBe(resolve("/proj", "wiki"));
	});

	it("uses an absolute root verbatim", () => {
		expect(resolveWikiRoot("/proj", "/abs/wiki")).toBe("/abs/wiki");
	});

	it("handles nested relative roots", () => {
		expect(resolveWikiRoot("/proj", "docs/wiki")).toBe(resolve("/proj", "docs/wiki"));
	});
});

describe("resolveWikiSpec", () => {
	it("resolves a leading-slash path against the wiki-root (OKF §5.1)", () => {
		// /SPEC.md → <wiki-root>/SPEC.md
		expect(resolveWikiSpec("/proj", "/proj/wiki", "/SPEC.md")).toBe(
			resolve("/proj/wiki", "SPEC.md"),
		);
	});

	it("strips only the single leading slash for nested leading-slash paths", () => {
		expect(resolveWikiSpec("/proj", "/proj/wiki", "/docs/plan.md")).toBe(
			resolve("/proj/wiki", "docs/plan.md"),
		);
	});

	it("resolves a relative (non-leading-slash) path against cwd", () => {
		expect(resolveWikiSpec("/proj", "/proj/wiki", "SPEC.md")).toBe(resolve("/proj", "SPEC.md"));
	});

	it("resolves a nested relative path against cwd", () => {
		expect(resolveWikiSpec("/proj", "/proj/wiki", "docs/plan.md")).toBe(
			resolve("/proj", "docs/plan.md"),
		);
	});

	it("treats a leading-slash path as wiki-root-relative even when it looks absolute (OKF §5.1)", () => {
		// /etc/spec.md → <wiki-root>/etc/spec.md, NOT a filesystem absolute path.
		expect(resolveWikiSpec("/proj", "/proj/wiki", "/etc/spec.md")).toBe(
			resolve("/proj/wiki", "etc/spec.md"),
		);
	});
});

describe("displayRoot", () => {
	it("returns the configured value when set", () => {
		expect(displayRoot("docs")).toBe("docs");
	});

	it("returns the default when the value is null", () => {
		expect(displayRoot(null)).toBe(DEFAULT_WIKI_ROOT);
	});

	it("returns the default when the value is undefined", () => {
		expect(displayRoot(undefined)).toBe(DEFAULT_WIKI_ROOT);
	});

	it("returns the default when the value is empty", () => {
		expect(displayRoot("")).toBe(DEFAULT_WIKI_ROOT);
	});
});
