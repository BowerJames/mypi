/**
 * Terminal Status Extension
 *
 * Reflects the session state in the terminal tab title:
 *
 *   - `agent_start`   -> "working"
 *   - `agent_settled` -> "idle"
 *
 * Only WezTerm is supported today, via `wezterm cli set-tab-title`, keyed off
 * `$TERM_PROGRAM === "WezTerm"`. Other terminals are a silent no-op. To add a
 * terminal, extend {@link updateTerminal} in `terminal.ts` — no change here.
 *
 * Behaviour notes:
 *
 *   - **Guarded by `ctx.hasUI`** — only runs in TUI/RPC modes; a tab title is
 *     pointless in `-p` (print) / JSON modes.
 *   - **`agent_settled` is the "truly done" signal** — it fires when Pi will
 *     not auto-continue (`ctx.isIdle()` is true), so "idle" is set only when
 *     the session is genuinely at rest. `agent_start` fires per low-level run,
 *     so retries re-flip to "working", which is the desired behaviour.
 *   - **Silent on every failure** — a missing `wezterm` binary, a non-zero
 *     exit, or a thrown `pi.exec` are all swallowed. The title is cosmetic and
 *     must never interrupt a session.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type TerminalState, updateTerminal } from "./terminal.js";

/**
 * Apply a terminal-status update, silently no-oping on any failure or
 * unsupported terminal.
 */
async function applyStatus(pi: ExtensionAPI, state: TerminalState): Promise<void> {
	const cmd = updateTerminal(process.env.TERM_PROGRAM, state);
	if (!cmd) return; // unsupported terminal / TERM_PROGRAM unset

	try {
		await pi.exec(cmd.command, cmd.args);
	} catch {
		// best-effort: binary missing or exec failure — stay silent.
	}
}

export default function terminalStatusExtension(pi: ExtensionAPI): void {
	pi.on("agent_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		await applyStatus(pi, "working");
	});

	pi.on("agent_settled", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		await applyStatus(pi, "idle");
	});
}
