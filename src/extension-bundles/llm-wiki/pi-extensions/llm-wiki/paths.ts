/**
 * Path resolution for the llm-wiki extension.
 *
 * Two configurable values, both resolved against the project `cwd`:
 *
 * - `wiki-root` — the OKF bundle root (a directory of markdown files with
 *   YAML frontmatter, `index.md`/`log.md`, cross-links). Project-relative.
 *   Default `wiki`.
 * - `wiki-spec` — Karpathy's "schema" layer: a per-wiki purpose/conventions
 *   doc that gives the agent runtime context about *which* wiki it manages.
 *   Default `/SPEC.md`, interpreted per OKF §5.1: a leading-slash path is
 *   **bundle-root-relative** (`<wiki-root>/SPEC.md`); other forms are
 *   project-relative.
 *
 * Pure & unit-testable — no filesystem access.
 */

import { isAbsolute, join, resolve } from "node:path";

/** Default wiki root, project-relative. */
export const DEFAULT_WIKI_ROOT = "wiki";

/** Default wiki spec path, leading-slash ⇒ wiki-root-relative (OKF §5.1). */
export const DEFAULT_WIKI_SPEC = "/SPEC.md";

/**
 * Resolve the wiki-root directory to an absolute path.
 *
 * `root` is treated as project-relative (joined onto `cwd`), mirroring how a
 * user thinks of a local directory. An absolute `root` is used verbatim.
 */
export function resolveWikiRoot(cwd: string, root: string): string {
	return isAbsolute(root) ? root : resolve(cwd, root);
}

/**
 * Resolve the wiki-spec file to an absolute path.
 *
 * Per OKF §5.1, a leading-slash path is **bundle-root-relative** — the slash
 * is stripped and the remainder joined onto the wiki-root (so `/SPEC.md`
 * resolves to `<wiki-root>/SPEC.md`). Any other form is resolved against
 * the project `cwd`, matching how a user would point at a file outside the
 * wiki. (A leading-slash path is intentionally NOT treated as a filesystem
 * absolute — that is the OKF link convention this default relies on.)
 */
export function resolveWikiSpec(cwd: string, wikiRootAbs: string, spec: string): string {
	if (spec.startsWith("/")) {
		return join(wikiRootAbs, spec.slice(1));
	}
	return resolve(cwd, spec);
}

/**
 * User-facing form of the wiki-root for the status indicator / prompts.
 *
 * Returns the configured value when set (so the user sees exactly what they
 * typed), otherwise the default. Never absolute — the configured value is
 * already the relative form the user understands.
 */
export function displayRoot(root: string | null | undefined): string {
	return root && root.length > 0 ? root : DEFAULT_WIKI_ROOT;
}
