/**
 * Tests for the merged `mypi` expansion pipeline — the **single seam** that
 * replaces the old `mypi run` passthrough (`resolveRunArgs`).
 *
 * Three narrow, composable units feed each other:
 *   • `expandBundleArgs` (resources.ts) — the shared expander / deep module:
 *     ordered bundle names in → deps-first, cross-union-deduped pi-flag parts.
 *   • `parseBundleFlags` (cli.ts) — pulls `--bundle` names out of an argv,
 *     leaving everything else verbatim.
 *   • `assemblePiArgv` (cli.ts) — the single assembler, always targeting `pi`.
 *
 * The assertion style is ported from the deleted `run.test.ts`.
 */
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { assemblePiArgv, parseBundleFlags } from "../cli.js";
import { BUNDLES_DIR, expandBundleArgs } from "../resources.js";
import { createSkill } from "../skill.js";

// Paths resolved by the manifests live under dist/extension-bundles/<name>/
// once built. For the expansion tests we assert the injected flag tokens and
// that a path was produced; the on-disk-path assertions live in configure.test.ts
// (which guards the build/copy step).
const bundleEntry = (name: string) => resolve(BUNDLES_DIR, name);

// Code-defined skills are materialised via `createSkill`, which writes to
// disk. Mock it so expansion tests assert flag wiring without any OS writes;
// the writer itself is unit-tested in skill.test.ts. The mock derives a
// stable path from the skill name so assertions stay predictable.
vi.mock("../skill.js", () => ({
	createSkill: vi.fn(),
}));

const mockedCreateSkill = vi.mocked(createSkill);
// Default: return a deterministic path per skill name (matches real createSkill
// shape: <baseDir>/<name>.md) so no real file is touched.
mockedCreateSkill.mockImplementation((skill) => `/mocked/${skill.frontMatter.name}.md`);
const mockedSkillPath = (name: string) => `/mocked/${name}.md`;

describe("expandBundleArgs — shared expander (deep module)", () => {
	describe("expands a single bundle", () => {
		it("expands an extension-only bundle to a single -e <path>", async () => {
			const out = await expandBundleArgs(["mode"]);
			expect(out).toEqual(["-e", out[1]]);
			expect(out[1]).toContain(bundleEntry("mode"));
		});

		it("expands a prompt-only bundle to a --prompt-template flag", async () => {
			const out = await expandBundleArgs(["code-review-prompt"]);
			expect(out).toEqual(["--prompt-template", out[1]]);
			expect(out[1]).toContain(bundleEntry("code-review-prompt"));
		});
	});

	describe("resolves dependencies deps-first", () => {
		it("auto-activates a bundle's dependency, emitted first (repo-explorer -> dynamic-skills)", async () => {
			const out = await expandBundleArgs(["repo-explorer"]);
			// dynamic-skills (a pi-extension) must precede repo-explorer (a materialised skill).
			expect(out).toEqual(["-e", out[1], "--skill", out[3]]);
			expect(out[1]).toContain(bundleEntry("dynamic-skills"));
			expect(out[3]).toBe(mockedSkillPath("repo-explorer"));
		});

		it("auto-activates wayfinder's terminal-status dependency, emitted first", async () => {
			const out = await expandBundleArgs(["wayfinder"]);
			// terminal-status (pi-extension) must precede wayfinder (pi-extension).
			expect(out).toEqual(["-e", out[1], "-e", out[3]]);
			expect(out[1]).toContain(bundleEntry("terminal-status"));
			expect(out[3]).toContain(bundleEntry("wayfinder"));
		});
	});

	describe("deduplicates across the union", () => {
		it("expands multiple bundles independently (deps-first across the union)", async () => {
			const out = await expandBundleArgs(["mode", "repo-explorer"]);
			// mode: single -e; repo-explorer: pulls in dynamic-skills (-e) then itself (--skill).
			expect(out).toEqual(["-e", out[1], "-e", out[3], "--skill", out[5]]);
			expect(out[1]).toContain(bundleEntry("mode"));
			expect(out[3]).toContain(bundleEntry("dynamic-skills"));
			expect(out[5]).toBe(mockedSkillPath("repo-explorer"));
		});

		it("emits a shared transitive dependency exactly once, at its first occurrence", async () => {
			// repo-explorer depends on dynamic-skills; dynamic-skills is also
			// listed explicitly. The shared dep is emitted once.
			const out = await expandBundleArgs(["repo-explorer", "dynamic-skills"]);
			const dynFlags = out.filter((t, i) => t === "-e" && out[i + 1]?.includes("dynamic-skills"));
			expect(dynFlags).toHaveLength(1);
			// dynamic-skills emitted first (dep of repo-explorer), then repo-explorer's skill.
			expect(out[0]).toBe("-e");
			expect(out[1]).toContain(bundleEntry("dynamic-skills"));
			expect(out[2]).toBe("--skill");
			expect(out[3]).toBe(mockedSkillPath("repo-explorer"));
		});

		it("emits a duplicated bundle exactly once", async () => {
			const out = await expandBundleArgs(["repo-explorer", "repo-explorer"]);
			// dynamic-skills once, repo-explorer once.
			expect(out).toEqual(["-e", out[1], "--skill", out[3]]);
			expect(out[1]).toContain(bundleEntry("dynamic-skills"));
			expect(out[3]).toBe(mockedSkillPath("repo-explorer"));
		});
	});

	describe("edge cases", () => {
		it("returns [] for an empty bundle list", async () => {
			expect(await expandBundleArgs([])).toEqual([]);
		});

		it("throws on an unknown bundle", async () => {
			await expect(expandBundleArgs(["nope"])).rejects.toThrow(/not found/);
		});
	});
});

describe("parseBundleFlags", () => {
	describe("extracts --bundle names", () => {
		it("parses --bundle <name> (space-separated)", () => {
			const { bundleNames, args } = parseBundleFlags(["--bundle", "mode", "msg"]);
			expect(bundleNames).toEqual(["mode"]);
			expect(args).toEqual(["msg"]);
		});

		it("parses --bundle=<name> (equals form)", () => {
			const { bundleNames, args } = parseBundleFlags(["--bundle=mode", "msg"]);
			expect(bundleNames).toEqual(["mode"]);
			expect(args).toEqual(["msg"]);
		});

		it("collects multiple --bundle flags left-to-right", () => {
			const { bundleNames, args } = parseBundleFlags([
				"--bundle",
				"mode",
				"--bundle=repo-explorer",
				"x",
			]);
			expect(bundleNames).toEqual(["mode", "repo-explorer"]);
			expect(args).toEqual(["x"]);
		});
	});

	describe("forwards everything else verbatim", () => {
		it("passes through pi flags, path-like -e, @files, and positionals around a --bundle", () => {
			const { bundleNames, args } = parseBundleFlags([
				"-p",
				"--model",
				"zai/glm-5.2",
				"--bundle",
				"mode",
				"-e",
				"./local.ts",
				"@prompt.md",
				"do thing",
			]);
			expect(bundleNames).toEqual(["mode"]);
			expect(args).toEqual([
				"-p",
				"--model",
				"zai/glm-5.2",
				"-e",
				"./local.ts",
				"@prompt.md",
				"do thing",
			]);
		});

		it("a model value containing a slash is untouched", () => {
			const { bundleNames, args } = parseBundleFlags(["--model", "zai/glm-5.2"]);
			expect(bundleNames).toEqual([]);
			expect(args).toEqual(["--model", "zai/glm-5.2"]);
		});

		it("a token that merely starts with --bundle but is not the flag is untouched", () => {
			const { bundleNames, args } = parseBundleFlags(["--bundler", "x"]);
			expect(bundleNames).toEqual([]);
			expect(args).toEqual(["--bundler", "x"]);
		});
	});

	describe("edge cases", () => {
		it("bare --bundle at tail with no value is left as-is", () => {
			const { bundleNames, args } = parseBundleFlags(["--bundle"]);
			expect(bundleNames).toEqual([]);
			expect(args).toEqual(["--bundle"]);
		});

		it("empty --bundle= is left as-is", () => {
			const { bundleNames, args } = parseBundleFlags(["--bundle="]);
			expect(bundleNames).toEqual([]);
			expect(args).toEqual(["--bundle="]);
		});

		it("empty args returns no bundles and empty args", () => {
			const { bundleNames, args } = parseBundleFlags([]);
			expect(bundleNames).toEqual([]);
			expect(args).toEqual([]);
		});
	});
});

describe("assemblePiArgv — one assembler, always `pi`", () => {
	it("always targets pi as the first argv element", () => {
		expect(assemblePiArgv([], [])).toEqual(["pi"]);
	});

	it("places expanded bundle parts before the forwarded args", () => {
		expect(assemblePiArgv(["-e", "/x", "--skill", "/y"], ["-p", "msg"])).toEqual([
			"pi",
			"-e",
			"/x",
			"--skill",
			"/y",
			"-p",
			"msg",
		]);
	});

	it("forwards args keep their relative order (positionals stay last)", () => {
		expect(assemblePiArgv([], ["-p", "--model", "m", "hello world"])).toEqual([
			"pi",
			"-p",
			"--model",
			"m",
			"hello world",
		]);
	});

	it("with no bundles and no forwarded args targets bare pi", () => {
		expect(assemblePiArgv([], [])).toEqual(["pi"]);
	});
});

describe("no-profile path (≡ old `mypi run`) — end-to-end shape", () => {
	it("yields a `pi` argv with the prompt flag, -p, --model, and the positional message", async () => {
		// Mirrors the shipped code-review subprocess contract:
		//   mypi -p --model <m> --bundle code-review-prompt "<msg>"
		const { bundleNames, args } = parseBundleFlags([
			"-p",
			"--model",
			"claude-sonnet-4",
			"--bundle",
			"code-review-prompt",
			"review this",
		]);
		const parts = await expandBundleArgs(bundleNames);
		const argv = assemblePiArgv(parts, args);

		expect(argv[0]).toBe("pi");
		expect(argv).toEqual([
			"pi",
			"--prompt-template",
			expect.any(String),
			"-p",
			"--model",
			"claude-sonnet-4",
			"review this",
		]);
		// The positional message stays positional (last).
		expect(argv[argv.length - 1]).toBe("review this");
		// The prompt flag targets the code-review-prompt bundle's prompt on disk.
		expect(argv[1]).toBe("--prompt-template");
		expect(argv[2]).toContain(bundleEntry("code-review-prompt"));
	});
});
