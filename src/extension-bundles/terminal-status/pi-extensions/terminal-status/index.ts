/**
 * Terminal Status Extension
 *
 * Reflects the session state in the terminal tab title:
 *
 *   - `agent_start`   -> "working"
 *   - `agent_settled` -> "idle"
 *
 * Emits the OSC 1 icon-name/tab-title escape sequence (`\x1b]1;<title>\x07`),
 * written directly to `process.stdout`. This works in any modern terminal and
 * replaces the earlier WezTerm-specific `wezterm cli set-tab-title` approach.
 *
 * Behaviour notes:
 *
 *   - **Guarded by `ctx.mode === "tui"`** — the OSC bytes must reach the real
 *     terminal. That holds only in interactive (TUI) mode: in `rpc` mode
 *     `process.stdout` is taken over by an output guard and redirected to
 *     stderr, and in `print`/`json` modes there is no terminal to rename.
 *   - **Written to `process.stdout`, not `pi.exec`** — `pi.exec` *captures*
 *     subprocess stdout (returned as `result.stdout`), so the escape sequence
 *     emitted by a `printf` child would never reach the terminal. Writing the
 *     bytes ourselves mirrors how pi-tui's `ProcessTerminal.setTitle` emits its
 *     OSC 0 window title.
 *   - **`agent_settled` is the "truly done" signal** — it fires when Pi will
 *     not auto-continue (`ctx.isIdle()` is true), so "idle" is set only when
 *     the session is genuinely at rest. `agent_start` fires per low-level run,
 *     so retries re-flip to "working", which is the desired behaviour.
 *   - **Silent on every failure** — a thrown `process.stdout.write` is
 *     swallowed. The title is cosmetic and must never interrupt a session.
 *   - **Pi's own window-title writes (OSC 0) can momentarily override the tab
 *     title** on startup / session switch / session-info changes. This is
 *     infrequent and left as-is; re-applying on those events is out of scope.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type TerminalState, updateTerminal } from "./terminal.js";

/**
 * Apply a terminal-status update by writing the escape sequence to stdout,
 * silently no-oping on any failure.
 */
function applyStatus(state: TerminalState): void {
	try {
		process.stdout.write(updateTerminal(state));
	} catch {
		// best-effort: a stdout write failure must never interrupt a session.
	}
}

export default function terminalStatusExtension(pi: ExtensionAPI): void {
	pi.on("agent_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		applyStatus("working");
	});

	pi.on("agent_settled", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		applyStatus("idle");
	});
}
