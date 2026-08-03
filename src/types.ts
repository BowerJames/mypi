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

/** A bundle expanded to its resolved on-disk resource paths. */
export interface ResolvedBundle {
	piExtensions: string[];
	skills: string[];
	prompts: string[];
}

/**
 * A profile is a **named bundle-set**: an optional list of bundle names that
 * mypi expands and runs under `pi`. The merged `mypi` always runs `pi`, so the
 * per-profile `cmd` field is gone — a profile only selects which bundles are
 * active. A profile with no bundles runs bare `pi`.
 */
export interface Profile {
	/** Bundles to load, by name (deps-first, cross-union-deduped at expand time). */
	bundles?: string[];
}

/**
 * The strict, *effective* configuration shape: a required default that must
 * reference an existing profile, and a non-empty profiles map. This is what
 * the launcher and editor operate on after merging built-ins + the user
 * overlay (see `loadEffectiveConfig`).
 */
export interface Config {
	default: string;
	profiles: Record<string, Profile>;
}

/**
 * The on-disk user overlay (`mypi-config.yaml`). Both fields are optional —
 * the file itself is optional, and a user need only set the bits they want to
 * add or override on top of the built-in profiles (see `BUILTIN_PROFILES`).
 * A user profile with the same name as a built-in replaces it wholesale.
 */
export interface UserConfig {
	/** Profile to use when none is specified on the CLI. Falls back to `BUILTIN_DEFAULT` if unset. */
	default?: string;
	/** User-defined profiles, merged on top of the built-ins (user wins on name collision). */
	profiles?: Record<string, Profile>;
}
