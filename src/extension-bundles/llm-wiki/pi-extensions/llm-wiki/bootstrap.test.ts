import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bootstrapWiki } from "./bootstrap.js";

describe("bootstrapWiki", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "mypi-wiki-bootstrap-"));
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("creates the wiki-root, empty index.md, log.md, and the spec", () => {
		const wikiRoot = join(testDir, "wiki");
		const spec = resolve(wikiRoot, "SPEC.md");
		const result = bootstrapWiki(wikiRoot, spec);

		expect(result.created.map((p) => p.split("/").pop()).sort()).toEqual([
			"SPEC.md",
			"index.md",
			"log.md",
		]);
		expect(result.existed).toEqual([]);

		expect(existsSync(wikiRoot)).toBe(true);
		expect(existsSync(join(wikiRoot, "index.md"))).toBe(true);
		expect(existsSync(join(wikiRoot, "log.md"))).toBe(true);
		expect(existsSync(spec)).toBe(true);
	});

	it("creates every asset as an empty file (no seeded content)", () => {
		const wikiRoot = join(testDir, "wiki");
		const spec = resolve(wikiRoot, "SPEC.md");
		bootstrapWiki(wikiRoot, spec);

		expect(statSync(join(wikiRoot, "index.md")).size).toBe(0);
		expect(statSync(join(wikiRoot, "log.md")).size).toBe(0);
		expect(statSync(spec).size).toBe(0);
	});

	it("is idempotent — a second run creates nothing and reports all as existed", () => {
		const wikiRoot = join(testDir, "wiki");
		const spec = resolve(wikiRoot, "SPEC.md");

		bootstrapWiki(wikiRoot, spec);
		const result = bootstrapWiki(wikiRoot, spec);

		expect(result.created).toEqual([]);
		expect(result.existed.map((p) => p.split("/").pop()).sort()).toEqual([
			"SPEC.md",
			"index.md",
			"log.md",
		]);
	});

	it("never overwrites an existing file (content is preserved)", () => {
		const wikiRoot = join(testDir, "wiki");
		const spec = resolve(wikiRoot, "SPEC.md");

		// Pre-create the wiki-root with a hand-written index.md.
		mkdirSync(wikiRoot, { recursive: true });
		writeFileSync(join(wikiRoot, "index.md"), "# My Index\n");

		const result = bootstrapWiki(wikiRoot, spec);

		expect(result.existed.map((p) => p.split("/").pop())).toContain("index.md");
		expect(result.created.map((p) => p.split("/").pop()).sort()).toEqual(["SPEC.md", "log.md"]);
		// The pre-existing index.md content survives.
		expect(statSync(join(wikiRoot, "index.md")).size).toBeGreaterThan(0);
	});

	it("creates nested parent dirs for a spec outside the wiki-root", () => {
		const wikiRoot = join(testDir, "wiki");
		const spec = resolve(testDir, "config", "deep", "my-spec.md");

		const result = bootstrapWiki(wikiRoot, spec);

		expect(result.created).toContain(spec);
		expect(existsSync(spec)).toBe(true);
		expect(statSync(spec).size).toBe(0);
	});

	it("creates the wiki-root when it does not already exist", () => {
		const wikiRoot = join(testDir, "nested", "wiki"); // parent doesn't exist
		const spec = resolve(wikiRoot, "SPEC.md");

		expect(() => bootstrapWiki(wikiRoot, spec)).not.toThrow();
		expect(existsSync(wikiRoot)).toBe(true);
		expect(existsSync(spec)).toBe(true);
	});
});
