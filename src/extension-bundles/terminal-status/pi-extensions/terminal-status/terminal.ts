/**
 * Terminal status resolution — the pure, terminal-agnostic decision layer.
 *
 * The extension factory ({@link ./index.ts}) reads `$TERM_PROGRAM` and a
 * session state ("working" | "idle"), then asks {@link updateTerminal} what
 * command (if any) to run. This module knows nothing about `pi.exec`, env
 * vars, or failure handling — it only maps (terminal, state) -> command.
 *
 * Today only WezTerm is supported (`wezterm cli set-tab-title <state>`). To
 * add a new terminal, add an `if` branch here; the factory and tests need no
 * other changes.
 */

/** A status update as a program + argv, ready for `pi.exec`. */
export interface TerminalCommand {
	command: string;
	args: string[];
}

/** The session states reflected into the terminal tab title. */
export type TerminalState = "working" | "idle";

/**
 * Resolve the terminal-status update command for a given terminal program and
 * session state, or `undefined` when the terminal is unsupported / unknown
 * (the caller treats `undefined` as a silent no-op).
 *
 * @param termProgram The raw value of `$TERM_PROGRAM` (`undefined` if unset).
 * @param state The session state to reflect.
 */
export function updateTerminal(
	termProgram: string | undefined,
	state: TerminalState,
): TerminalCommand | undefined {
	if (termProgram === "WezTerm") {
		return { command: "wezterm", args: ["cli", "set-tab-title", state] };
	}
	return undefined;
}
