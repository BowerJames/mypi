import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SkillFrontmatter } from "@earendil-works/pi-coding-agent";
import yaml from "js-yaml";

export interface SkillContent {
	frontMatter: SkillFrontmatter;
	body: string;
}

export interface Skill {
	baseDir: string;
	content: SkillContent;
}

export interface CreateSkillOptions {
	throwIfExists?: boolean;
}

/**
 * Serialise a skill into the on-disk `SKILL.md` file content: YAML
 * frontmatter wrapped in `---` fences, a blank line, then the body.
 *
 * Every frontmatter key is dumped (known fields + arbitrary
 * `[key: string]` entries round-trip). The output matches what pi's
 * `parseFrontmatter` expects (leading `---`, a `\n---` close fence, body
 * trimmed on read). Empty frontmatter serialises to adjacent fences
 * (`---\n---\n`) rather than a flow-style `{}` block.
 */
function serializeSkill(skill: Skill): string {
	const frontMatter = skill.content.frontMatter;
	const frontmatterYaml =
		Object.keys(frontMatter).length > 0 ? yaml.dump(frontMatter, { lineWidth: -1 }) : "";
	const body = skill.content.body.endsWith("\n") ? skill.content.body : `${skill.content.body}\n`;
	return `---\n${frontmatterYaml}---\n\n${body}`;
}

/**
 * Persist a skill to disk as `<baseDir>/SKILL.md`, creating `baseDir`
 * recursively if needed.
 *
 * By default throws if the file already exists (no clobber); pass
 * `{ throwIfExists: false }` to overwrite. Returns the resolved file path.
 */
export function createSkill(skill: Skill, options?: CreateSkillOptions): string {
	const throwIfExists = options?.throwIfExists ?? true;
	const filePath = resolve(skill.baseDir, "SKILL.md");

	if (throwIfExists && existsSync(filePath)) {
		throw new Error(`Skill already exists at ${filePath}`);
	}

	mkdirSync(skill.baseDir, { recursive: true });
	writeFileSync(filePath, serializeSkill(skill), "utf-8");

	return filePath;
}
