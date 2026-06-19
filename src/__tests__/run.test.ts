import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EXTENSIONS_DIR, PROMPTS_DIR, SKILLS_DIR } from "../resources.js";
import { resolveResourceArgs } from "../run.js";

// Resolve against the real bundled library (resources.ts computes MYPI_ROOT
// from import.meta.url, identical to what resolveResourceArgs uses).
const MODE_EXT = resolve(EXTENSIONS_DIR, "mode", "index.ts");
const REPO_EXPLORER_SKILL = resolve(SKILLS_DIR, "repo-explorer");
const CODE_REVIEW_PROMPT = resolve(PROMPTS_DIR, "code-review.md");

describe("resolveResourceArgs", () => {
	describe("resolves bare bundled names", () => {
		it("resolves -e <name>", () => {
			expect(resolveResourceArgs(["-e", "mode"])).toEqual(["-e", MODE_EXT]);
		});

		it("resolves --extension <name>", () => {
			expect(resolveResourceArgs(["--extension", "mode"])).toEqual(["--extension", MODE_EXT]);
		});

		it("resolves --skill <name>", () => {
			expect(resolveResourceArgs(["--skill", "repo-explorer"])).toEqual([
				"--skill",
				REPO_EXPLORER_SKILL,
			]);
		});

		it("resolves --prompt-template <name>", () => {
			expect(resolveResourceArgs(["--prompt-template", "code-review"])).toEqual([
				"--prompt-template",
				CODE_REVIEW_PROMPT,
			]);
		});
	});

	describe("path-like values pass through untouched", () => {
		it("./relative paths are not resolved", () => {
			expect(resolveResourceArgs(["-e", "./mode"])).toEqual(["-e", "./mode"]);
		});

		it("nested relative paths are not resolved", () => {
			expect(resolveResourceArgs(["-e", "a/b/mode"])).toEqual(["-e", "a/b/mode"]);
		});

		it("paths with a backslash are not resolved", () => {
			expect(resolveResourceArgs(["-e", "mode\\foo"])).toEqual(["-e", "mode\\foo"]);
		});
	});

	describe("unknown bare names pass through silently", () => {
		it("unknown extension is unchanged", () => {
			expect(resolveResourceArgs(["-e", "does-not-exist"])).toEqual(["-e", "does-not-exist"]);
		});

		it("unknown skill is unchanged", () => {
			expect(resolveResourceArgs(["--skill", "nope"])).toEqual(["--skill", "nope"]);
		});
	});

	describe("= forms pass through untouched (matches pi)", () => {
		it("--extension=mode is not resolved", () => {
			expect(resolveResourceArgs(["--extension=mode"])).toEqual(["--extension=mode"]);
		});

		it("-e=mode is not resolved", () => {
			expect(resolveResourceArgs(["-e=mode"])).toEqual(["-e=mode"]);
		});

		it("--skill=repo-explorer is not resolved", () => {
			expect(resolveResourceArgs(["--skill=repo-explorer"])).toEqual(["--skill=repo-explorer"]);
		});
	});

	describe("non-resource tokens are untouched", () => {
		it("passes through other flags and messages", () => {
			expect(resolveResourceArgs(["-p", "--model", "zai/glm-5.2", "do thing"])).toEqual([
				"-p",
				"--model",
				"zai/glm-5.2",
				"do thing",
			]);
		});

		it("passes through @file args", () => {
			expect(resolveResourceArgs(["@prompt.md", "-p"])).toEqual(["@prompt.md", "-p"]);
		});

		it("a model value containing a slash is not mistaken for a path (non-resource flag)", () => {
			expect(resolveResourceArgs(["--model", "zai/glm-5.2"])).toEqual(["--model", "zai/glm-5.2"]);
		});
	});

	describe("edge cases", () => {
		it("resource flag at tail with no value is left as-is", () => {
			expect(resolveResourceArgs(["-e"])).toEqual(["-e"]);
		});

		it("resource flag at tail followed by another flag keeps the flag", () => {
			// The value position is itself a flag token; pi will report the
			// error, we just forward both tokens verbatim.
			expect(resolveResourceArgs(["-e", "--model"])).toEqual(["-e", "--model"]);
		});

		it("multiple -e flags each resolve independently", () => {
			expect(resolveResourceArgs(["-e", "mode", "-e", "./local.ts"])).toEqual([
				"-e",
				MODE_EXT,
				"-e",
				"./local.ts",
			]);
		});

		it("ordering is preserved for a mixed real command", () => {
			expect(
				resolveResourceArgs([
					"-p",
					"--model",
					"zai/glm-5.2",
					"-e",
					"mode",
					"--skill",
					"repo-explorer",
					"do thing",
				]),
			).toEqual([
				"-p",
				"--model",
				"zai/glm-5.2",
				"-e",
				MODE_EXT,
				"--skill",
				REPO_EXPLORER_SKILL,
				"do thing",
			]);
		});

		it("empty args returns empty", () => {
			expect(resolveResourceArgs([])).toEqual([]);
		});
	});
});
