/**
 * Code Review Extension
 *
 * Appends a "Code Review" section to the system prompt that instructs the
 * agent to run an independent review (via `mypi run -p ... --prompt-template
 * code-review`) before opening a pull request. The recommended review model is
 * configurable via `/code-review-model` and persisted across sessions; when no
 * model is configured, the active session model is used as a fallback.
 *
 * This moves the code-review guidance out of shared `AGENTS.md` files so it
 * only affects agents that opt in by enabling this extension.
 *
 * Commands:
 *   /code-review-model           — clear the configured model (fall back to active)
 *   /code-review-model <model>   — set the recommended review model
 *
 * Persistence mirrors the `root-branch` feature in the `mode` extension.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	buildCodeReviewPromptSuffix,
	CODE_REVIEW_MODEL_CUSTOM_TYPE,
	getCodeReviewModel,
	type ModelLike,
	resolveCodeReviewModel,
} from "./model-state.js";

export default function codeReviewExtension(pi: ExtensionAPI): void {
	let configuredModel: string | null = null;

	/**
	 * Render the code-review status indicator.
	 *
	 * Shows the effective review model, distinguishing between an explicitly
	 * configured model (accent) and the active-session fallback (warning).
	 */
	function updateStatus(ctx: ExtensionContext, modelOverride?: ModelLike): void {
		const active =
			modelOverride ?? (ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : undefined);
		const effective = resolveCodeReviewModel(configuredModel, active);

		if (!effective) {
			ctx.ui.setStatus("code-review", undefined);
			return;
		}

		if (configuredModel) {
			ctx.ui.setStatus("code-review", ctx.ui.theme.fg("accent", `🔍 review: ${effective}`));
		} else {
			ctx.ui.setStatus(
				"code-review",
				ctx.ui.theme.fg("warning", `🔍 review: (active) ${effective}`),
			);
		}
	}

	// --- Commands ---

	pi.registerCommand("code-review-model", {
		description: "Set or clear the recommended code review model",
		handler: async (args, ctx) => {
			const model = args.trim();

			if (model) {
				configuredModel = model;
				pi.appendEntry(CODE_REVIEW_MODEL_CUSTOM_TYPE, { model });
				ctx.ui.notify(`Code review model set to: ${model}`, "info");
			} else {
				configuredModel = null;
				pi.appendEntry(CODE_REVIEW_MODEL_CUSTOM_TYPE, { model: null });
				ctx.ui.notify("Code review model cleared (will use active session model)", "info");
			}

			updateStatus(ctx);
		},
	});

	// --- Events ---

	// Append the Code Review section to the system prompt each turn.
	pi.on("before_agent_start", async (event, ctx) => {
		const active = ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : undefined;
		const model = resolveCodeReviewModel(configuredModel, active);
		return {
			systemPrompt: event.systemPrompt + buildCodeReviewPromptSuffix(model),
		};
	});

	// Keep the indicator in sync when the active model changes (affects fallback).
	pi.on("model_select", async (event, ctx) => {
		updateStatus(ctx, { provider: event.model.provider, id: event.model.id });
	});

	// Restore the configured model on session start/resume/reload.
	pi.on("session_start", async (_event, ctx) => {
		configuredModel = getCodeReviewModel(ctx.sessionManager) ?? null;
		updateStatus(ctx);
	});

	// Clear the indicator on shutdown.
	pi.on("session_shutdown", async (_event, ctx) => {
		ctx.ui.setStatus("code-review", undefined);
	});
}
