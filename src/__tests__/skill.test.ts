import { resolve } from "node:path";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSkill, type Skill } from "../skill.js";

// The OS is an external source — mock `node:fs` so nothing is persisted.
// `resolve` (node:path) and `yaml.dump` (js-yaml) are pure / library calls
// with no OS side-effects, so they run for real. pi's `parseFrontmatter` is a
// pure string-in/string-out function (no OS access), used to verify output.
vi.mock("node:fs");

// Re-import the mocked fs functions so we can configure/observe them.
const { existsSync, mkdirSync, writeFileSync } = await import("node:fs");

function makeSkill(overrides: Partial<Skill> = {}): Skill {
	return {
		baseDir: "skills/my-skill",
		content: {
			frontMatter: {
				name: "my-skill",
				description: "Does a useful thing.",
			},
			body: "## Instructions\n\nDo the thing.",
		},
		...overrides,
	};
}

describe("createSkill", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(existsSync).mockReturnValue(false);
	});

	it("writes SKILL.md in the resolved baseDir and returns its path", () => {
		const skill = makeSkill({ baseDir: "skills/my-skill" });
		const expectedPath = resolve("skills/my-skill", "SKILL.md");

		const result = createSkill(skill);

		expect(result).toBe(expectedPath);
		expect(writeFileSync).toHaveBeenCalledWith(expectedPath, expect.any(String), "utf-8");
	});

	it("creates baseDir recursively before writing", () => {
		const skill = makeSkill({ baseDir: "skills/nested/deep/skill" });

		createSkill(skill);

		expect(mkdirSync).toHaveBeenCalledWith("skills/nested/deep/skill", { recursive: true });
	});

	it("serialises frontmatter + body in the on-disk format and round-trips through parseFrontmatter", () => {
		const skill = makeSkill();

		createSkill(skill);

		const written = vi.mocked(writeFileSync).mock.calls[0]?.[1] as string;
		// Fence structure: leading `---\n`, close fence, blank line, then body.
		expect(written.startsWith("---\n")).toBe(true);
		expect(written).toContain("\n---\n\n");

		const parsed = parseFrontmatter(written);
		expect(parsed.frontmatter).toEqual(skill.content.frontMatter);
		expect(parsed.body).toBe(skill.content.body);
	});

	it("preserves all frontmatter keys (known + arbitrary)", () => {
		const skill = makeSkill({
			content: {
				frontMatter: {
					name: "my-skill",
					description: "Does a useful thing.",
					"disable-model-invocation": true,
					"shell-timeout": 60,
					customField: "extra",
				},
				body: "body text",
			},
		});

		createSkill(skill);

		const written = vi.mocked(writeFileSync).mock.calls[0]?.[1] as string;
		const parsed = parseFrontmatter(written);
		expect(parsed.frontmatter).toEqual(skill.content.frontMatter);
		expect(parsed.frontmatter["disable-model-invocation"]).toBe(true);
		expect(parsed.frontmatter["shell-timeout"]).toBe(60);
		expect(parsed.frontmatter.customField).toBe("extra");
	});

	it("throws by default when SKILL.md already exists and performs no filesystem mutation", () => {
		const skill = makeSkill();
		vi.mocked(existsSync).mockReturnValue(true);
		const expectedPath = resolve("skills/my-skill", "SKILL.md");

		expect(() => createSkill(skill)).toThrow(`Skill already exists at ${expectedPath}`);
		expect(mkdirSync).not.toHaveBeenCalled();
		expect(writeFileSync).not.toHaveBeenCalled();
	});

	it("overwrites without throwing when throwIfExists is false", () => {
		const skill = makeSkill();
		vi.mocked(existsSync).mockReturnValue(true);

		expect(() => createSkill(skill, { throwIfExists: false })).not.toThrow();
		expect(writeFileSync).toHaveBeenCalledWith(
			resolve("skills/my-skill", "SKILL.md"),
			expect.any(String),
			"utf-8",
		);
	});

	it("round-trips an empty body cleanly", () => {
		const skill = makeSkill({
			content: { frontMatter: { name: "x", description: "y" }, body: "" },
		});

		createSkill(skill);

		const written = vi.mocked(writeFileSync).mock.calls[0]?.[1] as string;
		expect(written.startsWith("---\n")).toBe(true);
		expect(written).toContain("\n---\n\n");
		const parsed = parseFrontmatter(written);
		expect(parsed.body).toBe("");
	});

	it("serialises empty frontmatter to adjacent fences (---\n---\n) and round-trips to {}", () => {
		const skill = makeSkill({
			content: { frontMatter: {}, body: "do stuff" },
		});

		createSkill(skill);

		const written = vi.mocked(writeFileSync).mock.calls[0]?.[1] as string;
		expect(written).toBe("---\n---\n\ndo stuff\n");
		const parsed = parseFrontmatter(written);
		expect(parsed.frontmatter).toEqual({});
		expect(parsed.body).toBe("do stuff");
	});
});
