import type { SkillContent } from "./skill.js";

/**
 * A single bundle of pi-extensions, skills, and prompts, identified by one
 * name and loaded as a unit. pi-extensions and prompts are declared as
 * on-disk paths resolved relative to each bundle's own location (via
 * `import.meta.url`) so they stay correct wherever npm installs the package.
 * Skills are declared **in code** as `SkillContent[]` — at resolution time
 * mypi materialises each one to `<$MYPI_DIR>/skills/<name>.md` and hands the
 * resulting path to pi via `--skill`.
 */
export interface ExtensionBundleManifest {
	/** Bundle name (matches the on-disk directory under `extension-bundles/`). */
	name: string;
	/** On-disk `.ts` paths of the pi-extensions to load via `-e`. */
	piExtensions: string[];
	/** Skills defined in code; materialised to `$MYPI_DIR/skills/<name>.md` at resolution, then loaded via `--skill`. */
	skills: SkillContent[];
	/** On-disk `.md` paths of the prompt templates to load via `--prompt-template`. */
	prompts: string[];
	/** Names of other bundles that must also be active when this one is. Resolved transitively, deps-first, deduplicated across the whole command. */
	dependencies?: string[];
}
