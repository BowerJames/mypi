/**
 * Clone construction & seeding for the btw extension.
 *
 * A btw clone is a fully independent in-process `AgentSession` built via
 * `createAgentSession` with `SessionManager.inMemory()` — the parent's session
 * manager is swapped for a non-persisting one. It reproduces the parent's
 * effective system prompt, model, model registry, and built-in tools, and is
 * seeded with the full parent conversation. Custom extension tools / event
 * handlers are NOT re-instantiated (v1 scope — accepted limitation).
 */

import type { ResourceLoader, SessionContext } from "@earendil-works/pi-coding-agent";
import {
	createAgentSession,
	createExtensionRuntime,
	SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { wrapBtwPrompt } from "./format.js";
import type { BtwInputs, BtwTask } from "./types.js";

/** Built-in pi tools the clone may use (parent's custom/extension tools excluded). */
export const BUILTIN_TOOLS = ["read", "bash", "edit", "write", "grep", "find", "ls"] as const;

/** Fallback tool set when the parent's active set contains no built-ins. */
const FALLBACK_TOOLS = ["read", "bash", "edit", "write"];

/**
 * Select the clone's tool allowlist: the parent's active set intersected with
 * the built-in tools, preserving canonical order and de-duplicating. Falls back
 * to a sensible default if the parent's active set is empty or entirely custom.
 */
export function selectBtwTools(activeTools: string[]): string[] {
	if (activeTools.length === 0) return [...FALLBACK_TOOLS];
	const active = new Set(activeTools);
	const selected = BUILTIN_TOOLS.filter((t) => active.has(t));
	return selected.length > 0 ? [...selected] : [...FALLBACK_TOOLS];
}

/**
 * Build a minimal `ResourceLoader` that reproduces the parent's effective
 * system prompt but loads NO extensions, skills, prompts, or themes.
 *
 * This (a) avoids re-running every extension's factory inside the clone,
 * (b) prevents the btw extension itself from being re-registered (recursion),
 * and (c) matches the accepted v1 scope ("no custom extension tools").
 */
function minimalResourceLoader(systemPrompt: string): ResourceLoader {
	return {
		getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
		getSkills: () => ({ skills: [], diagnostics: [] }),
		getPrompts: () => ({ prompts: [], diagnostics: [] }),
		getThemes: () => ({ themes: [], diagnostics: [] }),
		getAgentsFiles: () => ({ agentsFiles: [] }),
		getSystemPrompt: () => systemPrompt,
		getAppendSystemPrompt: () => [],
		extendResources: () => {},
		reload: async () => {},
	};
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

// Mirror pi's internal messages.ts constants (not publicly exported) so that
// compaction/branch summaries seeded into the clone carry the same framing the
// main agent would have seen.
const COMPACTION_SUMMARY_PREFIX =
	"The conversation history before this point was compacted into the following summary:\n\n<summary>\n";
const COMPACTION_SUMMARY_SUFFIX = "\n</summary>";
const BRANCH_SUMMARY_PREFIX =
	"The following is a summary of a branch that this conversation came back from:\n\n<summary>\n";
const BRANCH_SUMMARY_SUFFIX = "</summary>";

type SeedableMessage = Parameters<SessionManager["appendMessage"]>[0];

/**
 * Seed a clone's session manager with the parent conversation.
 *
 * `appendMessage` only accepts user/assistant/toolResult/custom/bashExecution
 * messages, so compaction/branch summaries are converted into user messages
 * that wrap the summary text with pi's standard framing markers.
 *
 * Everything else is appended verbatim, preserving order and the tool-use ↔
 * tool-result id chain.
 */
export function seedCloneSession(
	sessionManager: SessionManager,
	messages: SessionContext["messages"],
): void {
	for (const msg of messages) {
		switch (msg.role) {
			case "compactionSummary": {
				sessionManager.appendMessage({
					role: "user",
					content: [
						{
							type: "text",
							text: `${COMPACTION_SUMMARY_PREFIX}${msg.summary}${COMPACTION_SUMMARY_SUFFIX}`,
						},
					],
					timestamp: msg.timestamp,
				});
				break;
			}
			case "branchSummary": {
				sessionManager.appendMessage({
					role: "user",
					content: [
						{
							type: "text",
							text: `${BRANCH_SUMMARY_PREFIX}${msg.summary}${BRANCH_SUMMARY_SUFFIX}`,
						},
					],
					timestamp: msg.timestamp,
				});
				break;
			}
			default:
				sessionManager.appendMessage(msg as SeedableMessage);
		}
	}
}

// ---------------------------------------------------------------------------
// Final-answer extraction
// ---------------------------------------------------------------------------

/**
 * Extract the text of the final assistant message that actually has text.
 *
 * Walks backwards so a trailing tool-only assistant turn (no text) is skipped
 * in favour of the preceding turn that produced an answer. Returns "" when no
 * assistant text is present.
 */
export function getFinalAssistantText(messages: SessionContext["messages"]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role !== "assistant") continue;
		const texts: string[] = [];
		for (const part of msg.content) {
			if (part.type === "text") texts.push(part.text);
		}
		if (texts.length > 0) return texts.join("\n");
	}
	return "";
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export interface BtwRunResult {
	ok: boolean;
	/** Final assistant text on success, or an error message on failure. */
	text: string;
}

/**
 * Build, seed, and run a single btw clone to completion.
 *
 * - Creates an in-memory clone reproducing the parent's prompt/model/tools.
 * - Seeds it with the full parent conversation.
 * - `await session.prompt(wrapBtwPrompt(args))` resolves when the clone goes
 *   idle. The task text is wrapped in a `<btw-task>` guardrail so the clone
 *   scopes itself to the side task rather than continuing the main agent's
 *   work.
 * - Extracts the final assistant text.
 * - Always disposes the clone session in `finally`.
 *
 * The live `AgentSession` is exposed via `task.clone` for the duration of the
 * run so the `session_shutdown` handler can dispose it on abort. Throws on
 * failure (caller is responsible for error display).
 */
export async function runBtwClone(inputs: BtwInputs, task: BtwTask): Promise<BtwRunResult> {
	if (task.aborted) return { ok: false, text: "" };

	const { session } = await createAgentSession({
		cwd: inputs.cwd,
		model: inputs.model,
		modelRegistry: inputs.modelRegistry,
		thinkingLevel: inputs.thinkingLevel,
		sessionManager: SessionManager.inMemory(inputs.cwd),
		resourceLoader: minimalResourceLoader(inputs.systemPrompt),
		tools: selectBtwTools(inputs.activeTools),
		settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
	});
	task.clone = session;

	seedCloneSession(session.sessionManager, inputs.messages);

	try {
		await session.prompt(wrapBtwPrompt(inputs.args));
		const text = getFinalAssistantText(session.sessionManager.buildSessionContext().messages);
		return { ok: true, text };
	} finally {
		task.clone = undefined;
		try {
			session.dispose();
		} catch {
			// best-effort; clone may already be disposed via session_shutdown
		}
	}
}
