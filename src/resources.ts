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

// ---------------------------------------------------------------------------
// Dependency resolution (composable bundles)
// ---------------------------------------------------------------------------

/**
 * Returns the bundle names a given bundle depends on (its direct
 * dependencies). Used as the graph edge source for `activationOrder`. The
 * on-disk `manifestDeps` implementation is the production resolver; tests
 * inject a fake one (no filesystem).
 */
export type DependencyResolver = (name: string) => string[] | Promise<string[]>;

/**
 * Pure topological DFS: resolve a single root bundle's full transitive
 * dependency closure, **deps-first**, deduplicated within the closure.
 *
 * Returns `[...transitive deps..., root]` so a dependency is always emitted
 * before the bundle that needs it. The closure is the set of all bundles that
 * must be active for `root` to work; callers deduplicate across multiple
 * roots themselves (see `bundleActivationOrder`).
 *
 * `resolveDeps` supplies the dependency graph, so this function is pure and
 * unit-testable without filesystem fixtures. A dependency that does not
 * resolve is surfaced by `resolveDeps` itself (the production `manifestDeps`
 * calls `loadBundle`, which throws "Bundle not found").
 *
 * Throws on a cycle (e.g. `a -> b -> a`), formatting the full offending path.
 */
export async function activationOrder(
	root: string,
	resolveDeps: DependencyResolver,
): Promise<string[]> {
	const visited = new Set<string>();
	const result: string[] = [];

	async function dfs(name: string, stack: string[]): Promise<void> {
		// Cycle detection: `name` is already on the current DFS path.
		if (stack.includes(name)) {
			throw new Error(`Circular bundle dependency: ${[...stack, name].join(" -> ")}`);
		}
		// Already fully resolved in a prior branch (diamond dedup).
		if (visited.has(name)) return;

		const deps = await resolveDeps(name);
		for (const dep of deps) {
			await dfs(dep, [...stack, name]);
		}

		visited.add(name);
		result.push(name);
	}

	await dfs(root, []);
	return result;
}

/**
 * On-disk manifest resolver — the production `DependencyResolver`. Reads a
 * bundle's manifest via `loadBundle` (which throws "Bundle not found" for a
 * missing name) and returns its declared dependencies (empty for none).
 */
async function manifestDeps(name: string): Promise<string[]> {
	const manifest = await loadBundle(name);
	return manifest.dependencies ?? [];
}

/**
 * Resolve a single bundle's activation order from on-disk manifests: its full
 * transitive dependency closure, deps-first. The shared `expandBundleArgs`
 * expander deduplicates the union across all bundles it processes.
 */
export async function bundleActivationOrder(name: string): Promise<string[]> {
	return activationOrder(name, manifestDeps);
}

// ---------------------------------------------------------------------------
// Shared expansion — the single seam for bundle → pi-flag expansion
// ---------------------------------------------------------------------------

/** pi flags emitted for each bundle facet, in stable per-bundle order. */
const PI_EXTENSION_FLAG = "-e";
const PI_SKILL_FLAG = "--skill";
const PI_PROMPT_FLAG = "--prompt-template";

/**
 * Expand an ordered list of bundle names into deps-first, cross-union-deduped
 * pi-flag parts (`-e` / `--skill` / `--prompt-template`).
 *
 * This is the **single seam** for the bundle-expansion concern. All three
 * input shapes — a profile's `bundles`, CLI `--bundle` flags, or the union of
 * both — feed this one expander; nothing duplicates the dedup or ordering
 * afterwards. A wide implementation (transitive-dependency topological sort +
 * cross-union dedup + per-bundle facet emission) behind a narrow interface.
 *
 * Bundles are processed in the given order. Each bundle's full transitive
 * dependency closure (`bundleActivationOrder`) is emitted **deps-first**, and a
 * bundle (or shared transitive dependency) already emitted is skipped — so a
 * dependency shared across the union is emitted exactly once, at its first
 * occurrence. Within each bundle, facets are emitted in a stable order:
 * pi-extensions (`-e`) → skills (`--skill`) → prompts (`--prompt-template`).
 */
export async function expandBundleArgs(bundleNames: string[]): Promise<string[]> {
	const parts: string[] = [];
	const emitted = new Set<string>();

	for (const name of bundleNames) {
		for (const activationName of await bundleActivationOrder(name)) {
			if (emitted.has(activationName)) continue;
			emitted.add(activationName);

			const resolved = await expandBundle(activationName);

			for (const path of resolved.piExtensions) {
				parts.push(PI_EXTENSION_FLAG, path);
			}
			for (const path of resolved.skills) {
				parts.push(PI_SKILL_FLAG, path);
			}
			for (const path of resolved.prompts) {
				parts.push(PI_PROMPT_FLAG, path);
			}
		}
	}

	return parts;
}
