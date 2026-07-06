/**
 * Generic tri-state persistence for the llm-wiki extension's two config values
 * (`wiki-root`, `wiki-spec`).
 *
 * Each value is stored as a custom session entry via `pi.appendEntry()` and
 * retrieved on session restore by scanning entries from the end. This is the
 * same tri-state model used by the `mode` extension's `root-branch` feature,
 * generalised so both keys share one engine:
 *
 * | State      | Entry                  | Meaning                                          |
 * |------------|------------------------|--------------------------------------------------|
 * | "set"      | `{value:"wiki"}`       | Explicitly set (or auto-defaulted on first start)|
 * | "cleared"  | `{value:null}`         | Explicitly cleared; sticky across resume         |
 * | "unset"    | (no entry)             | Never configured; eligible for auto-default      |
 *
 * The tri-state split lets the extension auto-default to the built-in default
 * on first start WITHOUT re-defaulting after an explicit clear (a cleared
 * entry suppresses the default; an absent one triggers it).
 *
 * Pure & unit-testable — takes a minimal `{ getEntries() }` session-manager
 * shape, no pi types required.
 */

/** Custom session-entry types for the two persisted config values. */
export const WIKI_ROOT_CUSTOM_TYPE = "llm-wiki-root";
export const WIKI_SPEC_CUSTOM_TYPE = "llm-wiki-spec";

/** A minimal session-manager shape for pure, unit-testable readers. */
export type WikiSessionManager = {
	getEntries(): readonly unknown[];
};

/** The tri-state result of reading a persisted value. */
export type WikiState =
	| { status: "set"; value: string }
	| { status: "cleared" }
	| { status: "unset" };

/**
 * Read the persisted state for a config value by scanning entries from the end.
 *
 * - Returns `{status:"set", value}` when the most recent entry holds a
 *   non-empty string.
 * - Returns `{status:"cleared"}` when the most recent entry holds `null`, an
 *   empty string, or a non-string value (these all mean "explicitly cleared"
 *   and are sticky across resume).
 * - Returns `{status:"unset"}` when no entry of this custom type exists.
 */
export function readState(sm: WikiSessionManager, customType: string): WikiState {
	const entries = sm.getEntries();

	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i] as {
			type?: string;
			customType?: string;
			data?: { value?: unknown };
		};
		if (entry.type === "custom" && "customType" in entry && entry.customType === customType) {
			const value = entry.data?.value;
			if (typeof value === "string" && value.length > 0) {
				return { status: "set", value };
			}
			return { status: "cleared" };
		}
	}

	return { status: "unset" };
}

/**
 * Retrieve the last set value from session entries.
 *
 * Thin wrapper over `readState`: returns the value string when `set`,
 * otherwise `undefined` (for both `cleared` and `unset`).
 */
export function getValue(sm: WikiSessionManager, customType: string): string | undefined {
	const state = readState(sm, customType);
	return state.status === "set" ? state.value : undefined;
}

/**
 * Decide whether a config change should be persisted as a new entry.
 *
 * Returns `true` when there is no existing entry (always allow, so an explicit
 * clear on an untouched session still persists), and otherwise `true` only
 * when `next` differs from the effective current value. This prevents
 * duplicate entries from repeated identical set/clear commands.
 *
 * @param next the value being written — a string to set, or `null` to clear.
 */
export function shouldWrite(
	sm: WikiSessionManager,
	customType: string,
	next: string | null,
): boolean {
	const state = readState(sm, customType);

	if (state.status === "unset") return true;
	if (state.status === "set") return state.value !== next;
	return next !== null; // "cleared" current state: only write if setting a value
}

/**
 * Pure startup decision: what `value` should be, and whether it needs
 * persisting, given the persisted state and the auto-default.
 *
 * - `set`     → keep the value; no write (sticky).
 * - `cleared` → `null`; no write (sticky; suppresses auto-default).
 * - `unset`   → no default → `null`, no write (silent fallback).
 * - `unset`   → default    → that default, **write once**.
 */
export function planStartup(
	state: WikiState,
	defaultValue: string | undefined,
): { value: string | null; shouldWrite: boolean } {
	switch (state.status) {
		case "set":
			return { value: state.value, shouldWrite: false };
		case "cleared":
			return { value: null, shouldWrite: false };
		default: // "unset"
			if (defaultValue && defaultValue.length > 0) {
				return { value: defaultValue, shouldWrite: true };
			}
			return { value: null, shouldWrite: false };
	}
}
