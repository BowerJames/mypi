import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SkillFrontmatter } from "@earendil-works/pi-coding-agent";
import yaml from "js-yaml";
import { throwError } from "./error.js";

export interface SkillContent {
	frontMatter: SkillFrontmatter;
	body: string;
}

export interface CreateSkillOptions {
	throwIfExists?: boolean;
}

/**
 * Serialise a skill into the on-disk skill file content: YAML
 * frontmatter wrapped in `---` fences, a blank line, then the body.
 *
 * Every frontmatter key is dumped (known fields + arbitrary
 * `[key: string]` entries round-trip). The output matches what pi's
 * `parseFrontmatter` expects (leading `---`, a `\n---` close fence, body
 * trimmed on read). Empty frontmatter serialises to adjacent fences
 * (`---\n---\n`) rather than a flow-style `{}` block.
 */
function serializeSkill(skill: SkillContent): string {
	const frontMatter = skill.frontMatter;
	const frontmatterYaml =
		Object.keys(frontMatter).length > 0 ? yaml.dump(frontMatter, { lineWidth: -1 }) : "";
	const body = skill.body.endsWith("\n") ? skill.body : `${skill.body}\n`;
	return `---\n${frontmatterYaml}---\n\n${body}`;
}

/**
 * Persist a skill to disk as `<baseDir>/<name>.md`, creating `baseDir`
 * recursively if needed. The filename is derived from `skill.frontMatter.name`,
 * which must be present.
 *
 * By default throws if the file already exists (no clobber); pass
 * `{ throwIfExists: false }` to overwrite. Returns the resolved file path.
 */
export function createSkill(
	skill: SkillContent,
	baseDir: string,
	options?: CreateSkillOptions,
): string {
	const name = skill.frontMatter.name ?? throwError("Skill cannot be created with no name.");
	const filePath = resolve(baseDir, `${name}.md`);
	const throwIfExists = options?.throwIfExists ?? true;

	if (throwIfExists && existsSync(filePath)) {
		throwError(`Skill already exists at ${filePath}`);
	}

	mkdirSync(baseDir, { recursive: true });
	writeFileSync(filePath, serializeSkill(skill), "utf-8");

	return filePath;
}
