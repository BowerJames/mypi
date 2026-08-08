/**
 * A single bundle of pi-extensions, skills, and prompts, identified by one
 * name and loaded as a unit. The paths are resolved on-disk by each bundle's
 * manifest (relative to its own location via `import.meta.url`) so they stay
 * correct wherever npm installs the package.
 */
export interface ExtensionBundleManifest {
	/** Bundle name (matches the on-disk directory under `extension-bundles/`). */
	name: string;
	/** On-disk `.ts` paths of the pi-extensions to load via `-e`. */
	piExtensions: string[];
	/** On-disk skill directory paths to load via `--skill`. */
	skills: string[];
	/** On-disk `.md` paths of the prompt templates to load via `--prompt-template`. */
	prompts: string[];
	/** Names of other bundles that must also be active when this one is. Resolved transitively, deps-first, deduplicated across the whole command. */
	dependencies?: string[];
}
