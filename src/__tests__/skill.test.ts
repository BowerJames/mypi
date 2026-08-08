import { resolve } from "node:path";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSkill, type SkillContent } from "../skill.js";

// The OS is an external source — mock `node:fs` so nothing is persisted.
// `resolve` (node:path) and `yaml.dump` (js-yaml) are pure / library calls
// with no OS side-effects, so they run for real. pi's `parseFrontmatter` is a
// pure string-in/string-out function (no OS access), used to verify output.
vi.mock("node:fs");

// Re-import the mocked fs functions so we can configure/observe them.
const { existsSync, mkdirSync, writeFileSync } = await import("node:fs");

const DEFAULT_BASE_DIR = "skills/my-skill";

function makeSkillContent(overrides: Partial<SkillContent> = {}): SkillContent {
	return {
		frontMatter: {
			name: "my-skill",
			description: "Does a useful thing.",
		},
		body: "## Instructions\n\nDo the thing.",
		...overrides,
	};
}

describe("createSkill", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(existsSync).mockReturnValue(false);
	});

	it("writes <name>.md in the resolved baseDir and returns its path", () => {
		const content = makeSkillContent();
		const expectedPath = resolve(DEFAULT_BASE_DIR, "my-skill.md");

		const result = createSkill(content, DEFAULT_BASE_DIR);

		expect(result).toBe(expectedPath);
		expect(writeFileSync).toHaveBeenCalledWith(expectedPath, expect.any(String), "utf-8");
	});

	it("creates baseDir recursively before writing", () => {
		const content = makeSkillContent();

		createSkill(content, "skills/nested/deep/skill");

		expect(mkdirSync).toHaveBeenCalledWith("skills/nested/deep/skill", { recursive: true });
	});

	it("serialises frontmatter + body in the on-disk format and round-trips through parseFrontmatter", () => {
		const content = makeSkillContent();

		createSkill(content, DEFAULT_BASE_DIR);

		const written = vi.mocked(writeFileSync).mock.calls[0]?.[1] as string;
		// Fence structure: leading `---\n`, close fence, blank line, then body.
		expect(written.startsWith("---\n")).toBe(true);
		expect(written).toContain("\n---\n\n");

		const parsed = parseFrontmatter(written);
		expect(parsed.frontmatter).toEqual(content.frontMatter);
		expect(parsed.body).toBe(content.body);
	});

	it("preserves all frontmatter keys (known + arbitrary)", () => {
		const content = makeSkillContent({
			frontMatter: {
				name: "my-skill",
				description: "Does a useful thing.",
				"disable-model-invocation": true,
				"shell-timeout": 60,
				customField: "extra",
			},
			body: "body text",
		});

		createSkill(content, DEFAULT_BASE_DIR);

		const written = vi.mocked(writeFileSync).mock.calls[0]?.[1] as string;
		const parsed = parseFrontmatter(written);
		expect(parsed.frontmatter).toEqual(content.frontMatter);
		expect(parsed.frontmatter["disable-model-invocation"]).toBe(true);
		expect(parsed.frontmatter["shell-timeout"]).toBe(60);
		expect(parsed.frontmatter.customField).toBe("extra");
	});

	it("throws by default when <name>.md already exists and performs no filesystem mutation", () => {
		const content = makeSkillContent();
		vi.mocked(existsSync).mockReturnValue(true);
		const expectedPath = resolve(DEFAULT_BASE_DIR, "my-skill.md");

		expect(() => createSkill(content, DEFAULT_BASE_DIR)).toThrow(
			`Skill already exists at ${expectedPath}`,
		);
		expect(mkdirSync).not.toHaveBeenCalled();
		expect(writeFileSync).not.toHaveBeenCalled();
	});

	it("throws when frontMatter.name is missing and performs no filesystem mutation", () => {
		const content = makeSkillContent({ frontMatter: { description: "no name" } });

		expect(() => createSkill(content, DEFAULT_BASE_DIR)).toThrow(
			"Skill cannot be created with no name.",
		);
		expect(mkdirSync).not.toHaveBeenCalled();
		expect(writeFileSync).not.toHaveBeenCalled();
	});

	it("overwrites without throwing when throwIfExists is false", () => {
		const content = makeSkillContent();
		vi.mocked(existsSync).mockReturnValue(true);

		expect(() => createSkill(content, DEFAULT_BASE_DIR, { throwIfExists: false })).not.toThrow();
		expect(writeFileSync).toHaveBeenCalledWith(
			resolve(DEFAULT_BASE_DIR, "my-skill.md"),
			expect.any(String),
			"utf-8",
		);
	});

	it("round-trips an empty body cleanly", () => {
		const content = makeSkillContent({
			frontMatter: { name: "x", description: "y" },
			body: "",
		});

		createSkill(content, DEFAULT_BASE_DIR);

		const written = vi.mocked(writeFileSync).mock.calls[0]?.[1] as string;
		expect(written.startsWith("---\n")).toBe(true);
		expect(written).toContain("\n---\n\n");
		const parsed = parseFrontmatter(written);
		expect(parsed.body).toBe("");
	});
});
