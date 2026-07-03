/**
 * Bundle discovery & resolution.
 *
 * Bundles live alongside this module: at runtime under
 * `dist/extension-bundles/<name>/` (compiled from `src/extension-bundles/`),
 * and under source/test as `src/extension-bundles/<name>/`. Each bundle's
 * manifest declares the on-disk paths to its pi-extensions, skills, and
 * prompts, computed relative to itself via `import.meta.url`, so they resolve
 * wherever npm installs the package.
 *
 * `BUNDLES_DIR` is a *sibling* of this file (`dirname(import.meta.url)` +
 * `extension-bundles`), which holds in both layouts: `dist/extension-bundles`
 * at runtime and `src/extension-bundles` under vitest.
 *
 * mypi never imports the pi-extension/skill/prompt *code* — it only resolves
 * their paths and hands them to `pi` as `-e`/`--skill`/`--prompt-template`
 * flags. Manifests are loaded via dynamic `import()`, so resolution is async.
 *
 * Manifests are `.js` when compiled (runtime) and `.ts` under source (vitest);
 * both extensions are tolerated.
 */

import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ExtensionBundleManifest, ResolvedBundle } from "./types.js";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);

/** Sibling `extension-bundles/` dir — `dist/extension-bundles` or `src/extension-bundles`. */
export const BUNDLES_DIR = resolve(dirname(__filename), "extension-bundles");

/** Candidate manifest entry files, in preference order (.js compiled, .ts source). */
const MANIFEST_FILES = ["index.js", "index.ts"] as const;

// ---------------------------------------------------------------------------
// Manifest path resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the on-disk manifest file for a bundle, tolerating both the compiled
 * `.js` (runtime) and source `.ts` (vitest) forms.
 *
 * Returns the absolute path to the manifest, or `undefined` if none exists.
 */
function manifestFile(name: string): string | undefined {
	for (const file of MANIFEST_FILES) {
		const candidate = resolve(BUNDLES_DIR, name, file);
		if (existsSync(candidate)) return candidate;
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Discovery (sync)
// ---------------------------------------------------------------------------

/**
 * List every bundle by name (sorted). A bundle is a directory under
 * `extension-bundles/` containing a manifest (`index.js` or `index.ts`).
 */
export function discoverBundles(): string[] {
	if (!existsSync(BUNDLES_DIR)) return [];

	const names: string[] = [];

	for (const entry of readdirSync(BUNDLES_DIR, { withFileTypes: true })) {
		if (entry.isDirectory() && manifestFile(entry.name)) {
			names.push(entry.name);
		}
	}

	return names.sort();
}

/**
 * Quick sync existence check for a bundle (directory + manifest present).
 * Used for validation and error messages without the cost of a dynamic import.
 */
export function bundleExists(name: string): boolean {
	return manifestFile(name) !== undefined;
}

// ---------------------------------------------------------------------------
// Resolution (async — manifests are loaded via dynamic import)
// ---------------------------------------------------------------------------

/**
 * Load a bundle's manifest via dynamic `import()`.
 *
 * Throws a clear error if the bundle is missing or its manifest cannot be
 * loaded / lacks a default export.
 */
export async function loadBundle(name: string): Promise<ExtensionBundleManifest> {
	const path = manifestFile(name);
	if (!path) {
		throw new Error(
			`Bundle "${name}" not found. Expected a manifest at:\n` +
				`  ${resolve(BUNDLES_DIR, name, "index.js")}`,
		);
	}

	let mod: { default?: unknown };
	try {
		mod = (await import(pathToFileURL(path).href)) as { default?: unknown };
	} catch (err) {
		throw new Error(`Failed to load bundle "${name}": ${(err as Error).message}`);
	}

	const manifest = mod.default;
	if (!manifest || typeof manifest !== "object") {
		throw new Error(`Bundle "${name}" manifest has no valid default export.`);
	}

	return manifest as ExtensionBundleManifest;
}

/**
 * Resolve a bundle to its on-disk resource paths (all facets).
 */
export async function expandBundle(name: string): Promise<ResolvedBundle> {
	const manifest = await loadBundle(name);
	return {
		piExtensions: [...manifest.piExtensions],
		skills: [...manifest.skills],
		prompts: [...manifest.prompts],
	};
}
