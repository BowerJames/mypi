import type {
	AgentSession,
	ExtensionAPI,
	ExtensionContext,
	SessionContext,
} from "@earendil-works/pi-coding-agent";

/** Footer status key used via `ctx.ui.setStatus`. */
export const BTW_STATUS_KEY = "btw";

/**
 * Immutable snapshot of the parent agent's context, captured synchronously
 * inside the `/btw` command handler (which only runs while the main agent is
 * idle) and later used to seed the throwaway in-memory clone.
 */
export interface BtwInputs {
	/** The task text to run on the clone (`/btw <args>`). */
	args: string;
	/** Working directory of the parent session. */
	cwd: string;
	/** The parent's effective system prompt (encodes mode/code-review/AGENTS.md/skills). */
	systemPrompt: string;
	/** Tool names active in the parent session. */
	activeTools: string[];
	/** Full parent conversation used to seed the clone. */
	messages: SessionContext["messages"];
	/** Parent model (non-null; guarded before capture). */
	model: NonNullable<ExtensionContext["model"]>;
	/** Parent model registry (carries resolved auth/API keys). */
	modelRegistry: ExtensionContext["modelRegistry"];
	/** Parent thinking level. */
	thinkingLevel: ReturnType<ExtensionAPI["getThinkingLevel"]>;
}

/** A running or finished btw task. */
export interface BtwTask {
	id: string;
	/** Short preview of the args, for status display. */
	preview: string;
	status: "running" | "done" | "error";
	/** Final assistant text (done) or error message (error). */
	message?: string;
	/** Set by the `session_shutdown` handler to abort a running clone. */
	aborted?: boolean;
	/** Live clone session while running; disposed on completion or shutdown. */
	clone?: AgentSession;
}
