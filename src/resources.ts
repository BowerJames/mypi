import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const MYPI_ROOT = resolve(dirname(__filename), "..");

export const EXTENSIONS_DIR = resolve(MYPI_ROOT, "extensions");
export const SKILLS_DIR = resolve(MYPI_ROOT, "skills");
export const PROMPTS_DIR = resolve(MYPI_ROOT, "prompts");

// ---------------------------------------------------------------------------
// Resource discovery
// ---------------------------------------------------------------------------

export function discoverExtensions(): string[] {
	if (!existsSync(EXTENSIONS_DIR)) return [];

	const names: string[] = [];

	for (const entry of readdirSync(EXTENSIONS_DIR, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			// Directory with index.ts or index.js
			if (
				existsSync(resolve(EXTENSIONS_DIR, entry.name, "index.ts")) ||
				existsSync(resolve(EXTENSIONS_DIR, entry.name, "index.js"))
			) {
				names.push(entry.name);
			}
		} else if (entry.isFile()) {
			const ext = entry.name.endsWith(".ts") ? ".ts" : entry.name.endsWith(".js") ? ".js" : "";
			if (ext) {
				names.push(entry.name.slice(0, -ext.length));
			}
		}
	}

	return names.sort();
}

export function discoverSkills(): string[] {
	if (!existsSync(SKILLS_DIR)) return [];

	const names: string[] = [];

	for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
		if (entry.isDirectory() && existsSync(resolve(SKILLS_DIR, entry.name, "SKILL.md"))) {
			names.push(entry.name);
		}
	}

	return names.sort();
}

export function discoverPrompts(): string[] {
	if (!existsSync(PROMPTS_DIR)) return [];

	const names: string[] = [];

	for (const entry of readdirSync(PROMPTS_DIR, { withFileTypes: true })) {
		if (entry.isFile() && entry.name.endsWith(".md")) {
			names.push(entry.name.slice(0, -".md".length));
		}
	}

	return names.sort();
}

// ---------------------------------------------------------------------------
// Resource resolution
// ---------------------------------------------------------------------------

export function resolveExtension(name: string): string {
	const asFileTs = resolve(EXTENSIONS_DIR, `${name}.ts`);
	if (existsSync(asFileTs)) return asFileTs;

	const asFileJs = resolve(EXTENSIONS_DIR, `${name}.js`);
	if (existsSync(asFileJs)) return asFileJs;

	const asDirTs = resolve(EXTENSIONS_DIR, name, "index.ts");
	if (existsSync(asDirTs)) return asDirTs;

	const asDirJs = resolve(EXTENSIONS_DIR, name, "index.js");
	if (existsSync(asDirJs)) return asDirJs;

	throw new Error(
		`Extension "${name}" not found. Searched:\n` +
			`  ${asFileTs}\n  ${asFileJs}\n  ${asDirTs}\n  ${asDirJs}`,
	);
}

export function resolveSkill(name: string): string {
	const dir = resolve(SKILLS_DIR, name);
	if (existsSync(resolve(dir, "SKILL.md"))) return dir;

	throw new Error(`Skill "${name}" not found. Expected directory at:\n  ${dir}/SKILL.md`);
}

export function resolvePrompt(name: string): string {
	const asMd = resolve(PROMPTS_DIR, `${name}.md`);
	if (existsSync(asMd)) return asMd;

	throw new Error(`Prompt "${name}" not found. Expected file at:\n  ${asMd}`);
}
