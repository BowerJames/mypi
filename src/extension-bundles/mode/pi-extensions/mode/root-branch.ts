/**
 * Root branch persistence utilities for the mode extension.
 *
 * The root branch is stored as a custom session entry via `pi.appendEntry()`
 * and can be retrieved on session restore by scanning entries from the end.
 *
 * The persisted value has three distinguishable states:
 *
 * | State      | Entry                   | Meaning                                          |
 * |------------|-------------------------|--------------------------------------------------|
 * | "set"      | `{branch:"develop"}`    | Explicitly or auto-defaulted to a branch         |
 * | "cleared"  | `{branch:null}`         | Explicitly cleared; sticky across resume         |
 * | "unset"    | (no entry)              | Never configured; eligible for auto-default      |
 *
 * The tri-state split is what lets the extension auto-default to the current
 * git branch on first start WITHOUT re-defaulting after an explicit clear
 * (a cleared entry suppresses the default, an absent one triggers it).
 */

export const ROOT_BRANCH_CUSTOM_TYPE = "root-branch";

/** A minimal session-manager shape for pure, unit-testable readers. */
export type RootBranchSessionManager = {
	getEntries(): readonly unknown[];
};

/** The tri-state result of reading the persisted root branch. */
export type RootBranchState =
	| { status: "set"; branch: string }
	| { status: "cleared" }
	| { status: "unset" };

/**
 * Build the system prompt suffix for root branch context.
 *
 * Returns the text to append to the system prompt, or `undefined` if
 * no root branch is set.
 */
export function buildRootBranchPromptSuffix(
	rootBranch: string | null | undefined,
): string | undefined {
	if (!rootBranch) return undefined;

	return `\n\n# Root Branch\n\nThe root branch for the current high level stream of work is ${rootBranch}. You may be required to implement individual sections on issue specific branches but all pull requests must target ${rootBranch} unless expressly told otherwise.`;
}

/**
 * Read the persisted root-branch state by scanning entries from the end.
 *
 * - Returns `{status:"set", branch}` when the most recent root-branch entry
 *   holds a non-empty string.
 * - Returns `{status:"cleared"}` when the most recent root-branch entry
 *   holds `null`, an empty string, or a non-string value (these all mean
 *   "explicitly cleared" and are sticky across resume).
 * - Returns `{status:"unset"}` when no root-branch entry exists at all.
 */
export function readRootBranchState(sm: RootBranchSessionManager): RootBranchState {
	const entries = sm.getEntries();

	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i] as {
			type?: string;
			customType?: string;
			data?: { branch?: unknown };
		};
		if (
			entry.type === "custom" &&
			"customType" in entry &&
			entry.customType === ROOT_BRANCH_CUSTOM_TYPE
		) {
			const branch = entry.data?.branch;
			if (typeof branch === "string" && branch.length > 0) {
				return { status: "set", branch };
			}
			return { status: "cleared" };
		}
	}

	return { status: "unset" };
}

/**
 * Retrieve the last set root branch from session entries.
 *
 * Thin wrapper over `readRootBranchState`: returns the branch string when
 * `set`, otherwise `undefined` (for both `cleared` and `unset`).
 *
 * Kept for callers that only care about the effective value (e.g. display).
 */
export function getRootBranch(sm: RootBranchSessionManager): string | undefined {
	const state = readRootBranchState(sm);
	return state.status === "set" ? state.branch : undefined;
}

/**
 * Decide whether a root-branch change should be persisted as a new entry.
 *
 * Returns `true` when there is no existing root-branch entry (always allow,
 * so an explicit clear on an untouched session still persists), and otherwise
 * `true` only when `next` differs from the effective current value. This
 * prevents duplicate entries from repeated identical set/clear commands.
 *
 * @param next the value being written — a string to set, or `null` to clear.
 */
export function shouldWriteRootBranch(sm: RootBranchSessionManager, next: string | null): boolean {
	const state = readRootBranchState(sm);

	if (state.status === "unset") return true;
	if (state.status === "set") return state.branch !== next;
	return next !== null; // "cleared" current state: only write if setting a branch
}

/**
 * Pure startup decision: what `rootBranch` should be, and whether it needs
 * persisting, given the persisted state and the current git branch.
 *
 * - `set`     → keep the branch; no write (sticky).
 * - `cleared` → `null`; no write (sticky; suppresses auto-default).
 * - `unset`   → no current branch → `null`, no write (silent fallback).
 * - `unset`   → current branch    → that branch, **write once**.
 */
export function planRootBranchStartup(
	state: RootBranchState,
	currentBranch?: string,
): { rootBranch: string | null; shouldWrite: boolean } {
	switch (state.status) {
		case "set":
			return { rootBranch: state.branch, shouldWrite: false };
		case "cleared":
			return { rootBranch: null, shouldWrite: false };
		default: // "unset"
			if (currentBranch && currentBranch.length > 0) {
				return { rootBranch: currentBranch, shouldWrite: true };
			}
			return { rootBranch: null, shouldWrite: false };
	}
}
