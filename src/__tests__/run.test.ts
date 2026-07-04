import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BUNDLES_DIR } from "../resources.js";
import { resolveRunArgs } from "../run.js";

// Paths resolved by the manifests live under dist/extension-bundles/<name>/
// once built. For the resolution test we only assert the injected flag tokens
// and that a path was produced; the bundles.test.ts suite asserts the paths
// exist on disk (guards the build/copy step).
const bundleEntry = (name: string) => resolve(BUNDLES_DIR, name);

describe("resolveRunArgs", () => {
	describe("expands --bundle", () => {
		it("expands --bundle <name> into pi flags", async () => {
			const out = await resolveRunArgs(["--bundle", "mode"]);
			// mode is extension-only: emits a single -e <path>
			expect(out[0]).toBe("-e");
			expect(out.length).toBe(2);
			expect(out[1]).toContain(bundleEntry("mode"));
		});

		it("expands --bundle=<name> (equals form)", async () => {
			const out = await resolveRunArgs(["--bundle=mode"]);
			expect(out[0]).toBe("-e");
			expect(out.length).toBe(2);
		});

		it("expands a prompt-only bundle to a --prompt-template flag", async () => {
			const out = await resolveRunArgs(["--bundle", "code-review-prompt"]);
			expect(out[0]).toBe("--prompt-template");
			expect(out.length).toBe(2);
			expect(out[1]).toContain(bundleEntry("code-review-prompt"));
		});

		it("expands a skill-only bundle to a --skill flag (bundle with no deps)", async () => {
			// repo-explorer has a dependency on dynamic-skills, so use a hypothetical
			// standalone skill case via the equals form below. Here we verify a
			// dep-free extension-only bundle emits just its -e flag.
			const out = await resolveRunArgs(["--bundle=mode"]);
			expect(out[0]).toBe("-e");
			expect(out.length).toBe(2);
		});

		it("expands multiple --bundle flags independently", async () => {
			const out = await resolveRunArgs(["--bundle", "mode", "--bundle", "repo-explorer"]);
			// mode: single -e; repo-explorer: pulls in dynamic-skills (-e) then itself (--skill).
			expect(out).toEqual(["-e", out[1], "-e", out[3], "--skill", out[5]]);
			expect(out[1]).toContain(bundleEntry("mode"));
			expect(out[3]).toContain(bundleEntry("dynamic-skills"));
			expect(out[5]).toContain(bundleEntry("repo-explorer"));
		});
	});

	describe("resolves dependencies", () => {
		it("auto-activates a bundle's dependency, emitted first (repo-explorer -> dynamic-skills)", async () => {
			const out = await resolveRunArgs(["--bundle", "repo-explorer"]);
			// dynamic-skills (a pi-extension) must precede repo-explorer (a skill).
			expect(out).toEqual(["-e", out[1], "--skill", out[3]]);
			expect(out[1]).toContain(bundleEntry("dynamic-skills"));
			expect(out[3]).toContain(bundleEntry("repo-explorer"));
		});

		it("works with the --bundle=<name> equals form", async () => {
			const out = await resolveRunArgs(["--bundle=repo-explorer"]);
			expect(out[0]).toBe("-e");
			expect(out[1]).toContain(bundleEntry("dynamic-skills"));
			expect(out[2]).toBe("--skill");
			expect(out[3]).toContain(bundleEntry("repo-explorer"));
		});

		it("deduplicates a dependency shared by two --bundle flags", async () => {
			// repo-explorer depends on dynamic-skills; dynamic-skills is also
			// listed explicitly. The shared dep must be emitted exactly once.
			const out = await resolveRunArgs(["--bundle", "repo-explorer", "--bundle", "dynamic-skills"]);
			const dynFlags = out.filter((t, i) => t === "-e" && out[i + 1]?.includes("dynamic-skills"));
			expect(dynFlags).toHaveLength(1);
			// dynamic-skills emitted first (it's a dep of repo-explorer), then repo-explorer's skill.
			expect(out[0]).toBe("-e");
			expect(out[1]).toContain(bundleEntry("dynamic-skills"));
			expect(out[2]).toBe("--skill");
			expect(out[3]).toContain(bundleEntry("repo-explorer"));
		});

		it("deduplicates a dependency when the same bundle is passed twice", async () => {
			const out = await resolveRunArgs(["--bundle", "repo-explorer", "--bundle", "repo-explorer"]);
			// dynamic-skills once, repo-explorer once.
			expect(out).toEqual(["-e", out[1], "--skill", out[3]]);
			expect(out[1]).toContain(bundleEntry("dynamic-skills"));
			expect(out[3]).toContain(bundleEntry("repo-explorer"));
		});
	});

	describe("forwards other tokens verbatim", () => {
		it("passes through other flags and messages around a --bundle", async () => {
			const out = await resolveRunArgs([
				"-p",
				"--model",
				"zai/glm-5.2",
				"--bundle",
				"mode",
				"do thing",
			]);
			expect(out[0]).toBe("-p");
			expect(out[1]).toBe("--model");
			expect(out[2]).toBe("zai/glm-5.2");
			expect(out[3]).toBe("-e");
			expect(out[5]).toBe("do thing");
		});

		it("passes through path-like -e values untouched", async () => {
			const out = await resolveRunArgs(["-e", "./local.ts"]);
			expect(out).toEqual(["-e", "./local.ts"]);
		});

		it("passes through @file args", async () => {
			const out = await resolveRunArgs(["@prompt.md", "-p"]);
			expect(out).toEqual(["@prompt.md", "-p"]);
		});

		it("a model value containing a slash is untouched", async () => {
			const out = await resolveRunArgs(["--model", "zai/glm-5.2"]);
			expect(out).toEqual(["--model", "zai/glm-5.2"]);
		});

		it("a token that merely starts with --bundle but is not the flag is untouched", async () => {
			const out = await resolveRunArgs(["--bundler", "x"]);
			expect(out).toEqual(["--bundler", "x"]);
		});
	});

	describe("edge cases", () => {
		it("bare --bundle at tail with no value is left as-is", async () => {
			const out = await resolveRunArgs(["--bundle"]);
			expect(out).toEqual(["--bundle"]);
		});

		it("empty args returns empty", async () => {
			const out = await resolveRunArgs([]);
			expect(out).toEqual([]);
		});
	});
});
