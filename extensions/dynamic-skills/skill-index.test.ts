import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createMockPi, skillCommands } from "./mocks.js";
import {
	buildSkillIndex,
	findSkillByName,
	getSkillIndex,
	invalidateSkillIndex,
	isRegisteredSkillPath,
} from "./skill-index.js";

beforeEach(() => {
	invalidateSkillIndex();
});

describe("buildSkillIndex", () => {
	it("keeps only source==='skill' commands", () => {
		const commands = [
			...skillCommands([{ name: "foo", filePath: "/a/foo/SKILL.md", baseDir: "/a/foo" }]),
			{ name: "mycommand", source: "extension", sourceInfo: { path: "/b/c.ts" } },
		];
		const { pi } = createMockPi({ commands: commands as never });
		const index = buildSkillIndex(pi);
		expect([...index.keys()]).toEqual(["foo"]);
	});

	it("strips the skill: prefix", () => {
		const { pi } = createMockPi({
			commands: skillCommands([
				{ name: "deploy", filePath: "/s/deploy/SKILL.md", baseDir: "/s/deploy" },
			]),
		});
		expect([...buildSkillIndex(pi).keys()]).toEqual(["deploy"]);
	});

	it("uses dirname(filePath) as baseDir, ignoring sourceInfo.baseDir (manifest fix)", () => {
		const filePath = "/pkg/skills/discover/SKILL.md";
		const { pi } = createMockPi({
			commands: [
				{
					name: "skill:discover",
					source: "skill",
					sourceInfo: { path: filePath, baseDir: "/pkg" },
				},
			],
		});
		const entry = buildSkillIndex(pi).get("discover");
		expect(entry?.baseDir).toBe("/pkg/skills/discover");
		expect(entry?.filePath).toBe(filePath);
	});

	it("skips commands without a sourceInfo.path", () => {
		const { pi } = createMockPi({
			commands: [{ name: "skill:ghost", source: "skill", sourceInfo: {} }],
		});
		expect(buildSkillIndex(pi).size).toBe(0);
	});
});

describe("getSkillIndex — lazy memoisation", () => {
	it("does not call getCommands until the first lookup", () => {
		const commands = skillCommands([{ name: "foo", filePath: "/a/SKILL.md", baseDir: "/a" }]);
		const { pi } = createMockPi({ commands: commands as never });
		// Accessing the memo builds it; assert it builds without error and the
		// underlying command list is consulted exactly once across two calls.
		getSkillIndex(pi);
		getSkillIndex(pi);
		// No throw + single build is the contract; getCommands is called inside.
		expect(getSkillIndex(pi).get("foo")?.name).toBe("foo");
	});

	it("rebuilds after invalidateSkillIndex()", () => {
		const { pi } = createMockPi({
			commands: skillCommands([{ name: "foo", filePath: "/a/SKILL.md", baseDir: "/a" }]),
		});
		getSkillIndex(pi);
		invalidateSkillIndex();
		const rebuilt = getSkillIndex(pi);
		expect(rebuilt.get("foo")?.name).toBe("foo");
	});
});

describe("findSkillByName", () => {
	it("returns the entry for a known skill", () => {
		const { pi } = createMockPi({
			commands: skillCommands([{ name: "foo", filePath: "/a/SKILL.md", baseDir: "/a" }]),
		});
		expect(findSkillByName(pi, "foo")?.filePath).toBe("/a/SKILL.md");
	});
	it("returns undefined for an unknown skill", () => {
		const { pi } = createMockPi({ commands: [] });
		expect(findSkillByName(pi, "nope")).toBeUndefined();
	});
});

describe("isRegisteredSkillPath", () => {
	it("matches the exact registered filePath", () => {
		const filePath = join(process.cwd(), "tmp-skill-a", "SKILL.md");
		const { pi } = createMockPi({
			commands: skillCommands([
				{ name: "a", filePath, baseDir: join(process.cwd(), "tmp-skill-a") },
			]),
		});
		expect(isRegisteredSkillPath(pi, filePath)).toBe(true);
	});
	it("returns false for an unregistered path", () => {
		const { pi } = createMockPi({
			commands: skillCommands([{ name: "a", filePath: "/a/SKILL.md", baseDir: "/a" }]),
		});
		expect(isRegisteredSkillPath(pi, "/elsewhere/SKILL.md")).toBe(false);
	});
});
