/**
 * Tracker detection for the wayfinder extension.
 *
 * The tracker is **environment-derived**, not user-configured via a slash
 * command: it is autodetected from the `origin` git remote, with an escape
 * hatch for self-hosted setups via an executable `cwd/.mypi/wayfinder-tracker.sh`
 * script that prints one of `local` / `github` / `gitlab`.
 *
 * Selection order:
 *   1. If `wayfinder-tracker.sh` exists, run it; if its stdout normalises to a
 *      known kind, that wins (self-hosted override).
 *   2. Otherwise autodetect from the `origin` remote URL host:
 *      `github.com` → github, `gitlab.com` → gitlab, anything else → local.
 *   3. No remote / failure → local.
 *
 * The I/O (script existence, script exec, git exec) is injected via
 * `TrackerEnv`, mirroring `resources.ts`'s `DependencyResolver` pattern, so the
 * selection logic is pure and fully unit-testable without a filesystem.
 */

/** The supported issue trackers. */
export type TrackerKind = "local" | "github" | "gitlab";

/** All supported kinds, in canonical order. */
export const TRACKER_KINDS: readonly TrackerKind[] = ["local", "github", "gitlab"];

/**
 * Injected environment so `detectTracker` stays pure & unit-testable. Each
 * resolver is async (script/git exec are async in production) and returns
 * `undefined` on any failure — the detector falls through rather than throws.
 */
export interface TrackerEnv {
	/** Whether the override script exists at `cwd/.mypi/wayfinder-tracker.sh`. */
	scriptExists: () => boolean;
	/** Run the override script; return its stdout, or `undefined` on failure. */
	runScript: () => Promise<string | undefined>;
	/** Resolve the `origin` remote URL, or `undefined` if there is none. */
	remoteUrl: () => Promise<string | undefined>;
}

/**
 * Classify a remote URL by host.
 *
 * `github.com` (HTTPS or SSH) → github; `gitlab.com` → gitlab; anything else
 * (including self-hosted GitLab like `gitlab.corp.example`) → local. Self-hosted
 * setups should use the `wayfinder-tracker.sh` override rather than relying on
 * host heuristics.
 */
export function parseTrackerFromRemoteUrl(url: string): TrackerKind {
	if (/github\.com/.test(url)) return "github";
	if (/gitlab\.com/.test(url)) return "gitlab";
	return "local";
}

/**
 * Normalise an override script's stdout into a known kind.
 *
 * Trims and lowercases; returns the kind only when the result is exactly one of
 * `local` / `github` / `gitlab`. Any other output (empty, garbled, a hostname)
 * yields `undefined`, so the detector falls through to autodetection rather than
 * silently misclassifying.
 */
export function normaliseScriptOutput(out: string): TrackerKind | undefined {
	const value = out.trim().toLowerCase();
	if (value === "local" || value === "github" || value === "gitlab") {
		return value as TrackerKind;
	}
	return undefined;
}

/**
 * Resolve the effective tracker from the injected environment.
 *
 * Script-first: a valid override script output wins. An invalid/failed script
 * falls through to autodetection (never throws). A missing script or no remote
 * resolves to `local`.
 */
export async function detectTracker(env: TrackerEnv): Promise<TrackerKind> {
	if (env.scriptExists()) {
		const out = await env.runScript();
		if (out !== undefined) {
			const fromScript = normaliseScriptOutput(out);
			if (fromScript) return fromScript;
		}
	}

	const url = await env.remoteUrl();
	if (url) return parseTrackerFromRemoteUrl(url);

	return "local";
}
