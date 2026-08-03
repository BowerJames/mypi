/**
 * Path helpers for the wayfinder extension.
 *
 * The **local** tracker is ephemeral scratch under `/tmp/.wayfinder/<repo>/`,
 * where `<repo>` is the cwd's directory name. The **prototype worktree**
 * convention is `~/.worktrees/<map-slug>/<ticket-slug>/`.
 *
 * Pure & unit-testable — no filesystem access.
 */

import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

/**
 * The repo identifier used in the local tracker path: the directory name of
 * `cwd`. Two repos with the same directory name collide in `/tmp/.wayfinder/`,
 * which is acceptable for ephemeral local scratch (the local tracker is a
 * fallback for repos without a GitHub/GitLab remote).
 */
export function repoSlug(cwd: string): string {
	// `resolve` normalises `.` / `..` / trailing slashes before taking the base.
	return basename(resolve(cwd)) || "repo";
}

/** Ephemeral local root for a repo: `/tmp/.wayfinder/<repo>/`. */
export function localRoot(cwd: string): string {
	return join("/tmp", ".wayfinder", repoSlug(cwd));
}

/** A single effort's directory: `/tmp/.wayfinder/<repo>/<effort-slug>/`. */
export function localEffortDir(cwd: string, effortSlug: string): string {
	return join(localRoot(cwd), effortSlug);
}

/** The map file for an effort: `<effort>/map.md`. */
export function localMapPath(cwd: string, effortSlug: string): string {
	return join(localEffortDir(cwd, effortSlug), "map.md");
}

/**
 * A child ticket file: `<effort>/issues/NN-<slug>.md`, zero-padded to 2 digits
 * from `01`.
 */
export function localTicketPath(cwd: string, effortSlug: string, n: number, slug: string): string {
	const nn = String(n).padStart(2, "0");
	return join(localEffortDir(cwd, effortSlug), "issues", `${nn}-${slug}.md`);
}

/**
 * A prototype worktree: `~/.worktrees/<map-slug>/<ticket-slug>/`. Global
 * (under the user's home), not repo-local, so worktrees survive a `cd` and are
 * gathered in one place. The agent scaffolds it via `git worktree add`.
 */
export function worktreeDir(mapSlug: string, ticketSlug: string): string {
	return join(homedir(), ".worktrees", mapSlug, ticketSlug);
}

// ---------------------------------------------------------------------------
// /implement — implementation-namespace paths (spec #74)
// ---------------------------------------------------------------------------
//
// The implementation phase cuts a per-effort integration trunk plus per-unit
// dev branches and worktrees, all keyed on the **spec slug** — the stable,
// human-named kickoff anchor (not the Implementation-Map slug). The trunk is
// cut from the current branch at kickoff (recorded in the Implementation Map
// body as the effort's base), not hardcoded to any branch. Branch names use a
// literal `/` (git ref syntax), not `path.join` (which is platform-dependent).

/**
 * The integration trunk for an effort: `implement/<spec-slug>`. Cut from the
 * current branch at kickoff (after the user confirms the proposal) and recorded
 * in the Implementation Map body as the effort's durable anchor. All dev units
 * of one effort integrate against this one stable branch.
 */
export function implementTrunkBranch(specSlug: string): string {
	return `implement/${specSlug}`;
}

/**
 * A dev-unit branch: `dev/<spec-slug>/<n>-<slug>`. `<n>` is the tracker ticket
 * number, **raw (no zero-padding)** — ticket numbers climb into the
 * hundreds/thousands, so fixed-width padding would be inconsistent past its
 * width. `git branch | grep <spec-slug>` still groups the trunk and every unit.
 */
export function implementDevBranch(specSlug: string, n: number, slug: string): string {
	return `dev/${specSlug}/${n}-${slug}`;
}

/**
 * A dev-unit worktree: `~/.worktrees/<spec-slug>/<n>-<slug>`. The path mirrors
 * the dev branch name under `~/.worktrees/`, so the unit's isolated checkout
 * lives alongside its branch. Each unit is a worktree-on-a-branch so multiple
 * units run in parallel without contending for one working tree.
 */
export function implementWorktreeDir(specSlug: string, n: number, slug: string): string {
	return join(homedir(), ".worktrees", specSlug, `${n}-${slug}`);
}

/** The optional override script: `cwd/.mypi/wayfinder-tracker.sh`. */
export function trackerScriptPath(cwd: string): string {
	return join(cwd, ".mypi", "wayfinder-tracker.sh");
}
