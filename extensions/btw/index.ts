/**
 * btw extension
 *
 * Registers `/btw <args>`: spawns a throwaway, non-blocking in-memory clone of
 * the current agent — same context, effective system prompt, model, and
 * built-in tools — runs the task to idle, then shows the final assistant text
 * in the TUI and drops the clone.
 *
 * Display uses `ctx.ui.notify(...)` (which writes directly to the chat
 * scrollback and never touches the session manager), so the result is visible
 * but **excluded from the main LLM context**. Live activity is shown in the
 * footer via `ctx.ui.setStatus`.
 *
 * Multiple `/btw` tasks may run in parallel. All live clones are aborted and
 * disposed when the main session shuts down.
 */

import { randomUUID } from "node:crypto";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { buildSessionContext } from "@earendil-works/pi-coding-agent";
import { type BtwRunResult, runBtwClone } from "./clone.js";
import { composeStatus, formatResult, previewArgs } from "./format.js";
import { BTW_STATUS_KEY, type BtwInputs, type BtwTask } from "./types.js";

export default function btwExtension(pi: ExtensionAPI): void {
	/** All known btw tasks (running or finished-but-not-yet-cleared). */
	const tasks = new Map<string, BtwTask>();

	/** Best-effort footer status refresh. */
	function refreshStatus(ctx: ExtensionCommandContext): void {
		try {
			ctx.ui.setStatus(BTW_STATUS_KEY, composeStatus([...tasks.values()]));
		} catch {
			// ctx may be stale after session shutdown; footer is best-effort.
		}
	}

	pi.registerCommand("btw", {
		description: "Run a one-off task on a throwaway in-memory clone of the current context",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) return;

			const taskArgs = args.trim();
			if (!taskArgs) {
				ctx.ui.notify("Usage: /btw <task>", "warning");
				return;
			}

			if (!ctx.model) {
				ctx.ui.notify("btw: no model selected", "error");
				return;
			}

			// Snapshot parent context synchronously (handler runs while idle).
			const context = buildSessionContext(
				ctx.sessionManager.getEntries(),
				ctx.sessionManager.getLeafId(),
			);

			const inputs: BtwInputs = {
				args: taskArgs,
				cwd: ctx.cwd,
				systemPrompt: ctx.getSystemPrompt(),
				activeTools: pi.getActiveTools(),
				messages: context.messages,
				model: ctx.model,
				modelRegistry: ctx.modelRegistry,
				thinkingLevel: pi.getThinkingLevel(),
			};

			const task: BtwTask = {
				id: randomUUID(),
				preview: previewArgs(taskArgs),
				status: "running",
			};
			tasks.set(task.id, task);
			refreshStatus(ctx);

			// Fire and forget — never block the main agent stream.
			void runBtw(inputs, task, ctx);
		},
	});

	/**
	 * Background runner: drive a clone to completion, then surface the result.
	 *
	 * All post-`await` use of `ctx` is guarded by `task.aborted` (set on
	 * `session_shutdown`) and wrapped defensively, since the captured `ctx` is
	 * stale after a session replacement / reload.
	 */
	async function runBtw(
		inputs: BtwInputs,
		task: BtwTask,
		ctx: ExtensionCommandContext,
	): Promise<void> {
		let result: BtwRunResult;
		try {
			result = await runBtwClone(inputs, task);
		} catch (err) {
			if (!task.aborted) {
				task.status = "error";
				task.message = err instanceof Error ? err.message : String(err);
			}
			tasks.delete(task.id);
			refreshStatus(ctx);
			if (!task.aborted) {
				ctx.ui.notify(`btw: failed — ${task.message}`, "error");
			}
			return;
		}

		if (!task.aborted) {
			task.status = result.ok ? "done" : "error";
			task.message = result.text;
		}
		tasks.delete(task.id);
		refreshStatus(ctx);
		if (!task.aborted) {
			ctx.ui.notify(formatResult(result.text), result.ok ? "info" : "error");
		}
	}

	// Abort and dispose every live clone when the main session shuts down
	// (quit, /reload, /new, /resume, /fork, /switchSession). Disposing the
	// clone's session causes any in-flight `prompt()` to reject, which the
	// background runner's catch path handles silently via `task.aborted`.
	pi.on("session_shutdown", () => {
		for (const task of tasks.values()) {
			task.aborted = true;
			try {
				task.clone?.dispose();
			} catch {
				// best-effort
			}
		}
		tasks.clear();
	});
}
