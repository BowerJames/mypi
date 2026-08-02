/**
 * Terminal status resolution — the pure, terminal-agnostic decision layer.
 *
 * The extension factory ({@link ./index.ts}) reacts to the `agent_start` /
 * `agent_settled` session states and asks {@link updateTerminal} for the bytes
 * to write. This module knows nothing about `process.stdout` or failure
 * handling — it only maps a state -> escape sequence.
 *
 * We use OSC 1, the icon-name / tab-title sequence (`\x1b]1;<title>\x07`),
 * which is the standard, terminal-agnostic way to rename the current tab and
 * is honoured by virtually every modern terminal (WezTerm, iTerm2, Ghostty,
 * Alacritty, Kitty, Apple Terminal, …). It replaces the earlier WezTerm-only
 * `wezterm cli set-tab-title` subprocess approach, whose output never reached
 * the terminal because `pi.exec` captures subprocess stdout.
 */

/** The session states reflected into the terminal tab title. */
export type TerminalState = "working" | "idle";

/**
 * Resolve the escape sequence that reflects `state` in the terminal tab title.
 *
 * The returned bytes are meant to be written directly to `process.stdout` (OSC
 * sequences are processed by the terminal emulator and never render as text).
 * The caller owns the write and is responsible for swallowing failures.
 *
 * @param state The session state to reflect.
 */
export function updateTerminal(state: TerminalState): string {
	// OSC 1;title BEL — set the tab title (icon name).
	return `\x1b]1;${state}\x07`;
}
