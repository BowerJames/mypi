/**
 * Built-in profiles — always available, requiring no `mypi-config.yaml`.
 *
 * The user config file is an *overlay*: it can add new profiles, override a
 * built-in by name (replace, not merge-fields), and optionally set `default`.
 * When the overlay is absent (no file / empty file), the built-ins are still
 * available and `developer` is the default profile (see `BUILTIN_DEFAULT`).
 *
 * Built-ins intentionally carry **no model id** — they use plain `pi` / `pi -p`
 * so the user's own configured default model applies, rather than coupling mypi
 * to a provider/model that would go stale.
 */

import type { Profile } from "./types.js";

/**
 * The profile used when the user overlay does not set `default`.
 * Mirrors the pre-existing repo `mypi-config.yaml` default.
 */
export const BUILTIN_DEFAULT = "developer";

/**
 * Profiles that ship with mypi and are always resolvable. A user overlay
 * profile with the same name replaces the entry here wholesale.
 */
export const BUILTIN_PROFILES: Record<string, Profile> = {
	developer: {
		cmd: "pi",
		bundles: [
			"mode",
			"code-review",
			"dynamic-skills",
			"btw",
			"loop",
			"render-raw",
			"repo-explorer",
			"overview",
			"terminal-status",
		],
	},
	reviewer: {
		cmd: "pi -p",
		bundles: ["code-review-prompt"],
	},
	"llm-wiki": {
		cmd: "pi",
		bundles: ["llm-wiki", "mode", "repo-explorer"],
	},
};

/** True when `name` is one of the built-in profile names. */
export function isBuiltinProfile(name: string): boolean {
	return name in BUILTIN_PROFILES;
}

/**
 * Clone a profile so a returned entry is never the same object as the
 * built-in constant — callers (e.g. the interactive editor) mutate profiles
 * in place and must not poison `BUILTIN_PROFILES` for the process lifetime.
 */
function cloneProfile(profile: Profile): Profile {
	return profile.bundles
		? { cmd: profile.cmd, bundles: [...profile.bundles] }
		: { cmd: profile.cmd };
}

/**
 * Merge built-in profiles with a user overlay. A user profile whose name
 * matches a built-in **replaces** the built-in wholesale (user wins). Every
 * returned entry is a fresh clone, so callers cannot mutate the built-in
 * constant through the merged result.
 */
export function mergeProfiles(
	userProfiles: Record<string, Profile> | undefined,
): Record<string, Profile> {
	const merged: Record<string, Profile> = {};
	for (const [name, profile] of Object.entries(BUILTIN_PROFILES)) {
		merged[name] = cloneProfile(profile);
	}
	for (const [name, profile] of Object.entries(userProfiles ?? {})) {
		merged[name] = cloneProfile(profile);
	}
	return merged;
}

/**
 * Resolve the effective default profile name. A user-set non-empty `default`
 * wins; an absent or empty-string default falls back to `BUILTIN_DEFAULT`.
 * This does **not** validate that the name resolves to a profile — callers
 * should check the merged set and raise a clear error otherwise (see
 * `loadEffectiveConfig`).
 */
export function effectiveDefault(userDefault: string | undefined): string {
	return userDefault && userDefault.length > 0 ? userDefault : BUILTIN_DEFAULT;
}
