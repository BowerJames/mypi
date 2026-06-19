/**
 * Code review model persistence utilities for the code-review extension.
 *
 * The recommended review model is stored as a custom session entry via
 * `pi.appendEntry()` and can be retrieved on session restore by scanning
 * entries from the end. When no model is explicitly set, the extension falls
 * back to the active session model.
 */

/** Custom session entry type used to persist the configured review model. */
export const CODE_REVIEW_MODEL_CUSTOM_TYPE = "code-review-model";

/**
 * Narrow shape of a pi `Model` used to format the active-session fallback.
 * Kept minimal so this module stays unit-testable without the full Model type.
 */
export type ModelLike = {
	provider: string;
	id: string;
};

/**
 * Resolve the effective code review model.
 *
 * - Returns the configured model verbatim when one is set.
 * - Otherwise falls back to the active session model, formatted `provider/id`.
 * - Returns `undefined` when neither is available.
 */
export function resolveCodeReviewModel(
	configured: string | null | undefined,
	activeModel: ModelLike | undefined,
): string | undefined {
	if (configured && configured.length > 0) return configured;
	if (activeModel) return `${activeModel.provider}/${activeModel.id}`;
	return undefined;
}

/**
 * Build the system prompt suffix for the code review guidance.
 *
 * Returns the "## Code Review" section to append to the system prompt, with
 * the model substituted into the review command. If no model can be resolved
 * (no configured model and no active session model), the literal placeholder
 * `$codeReviewModel` is used so the section stays well-formed.
 */
export function buildCodeReviewPromptSuffix(model: string | undefined): string {
	const modelArg = model ?? "$codeReviewModel";

	return (
		`\n\n## Code Review\n` +
		"Before opening a pull request, an independent review must be run using:\n\n" +
		"`mypi run -p --model " +
		modelArg +
		' --prompt-template code-review "/code-review <issue_number> <branch_to_review> <target_branch_of_pr>"`\n\n' +
		"Review the findings with the user before proceeding with further development or the pull request. Reviews can take a while so make sure you set the bash timeout to 1000 seconds.\n"
	);
}

/**
 * Retrieve the last configured code review model from session entries.
 *
 * Scans entries from the end of the array and returns the `model` value from
 * the most recent custom entry with `customType === "code-review-model"`.
 *
 * Returns `undefined` if no entry exists, or if the last entry has a falsy
 * `model` value (cleared).
 */
export function getCodeReviewModel(sessionManager: {
	getEntries(): readonly unknown[];
}): string | undefined {
	const entries = sessionManager.getEntries();

	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i] as {
			type?: string;
			customType?: string;
			data?: { model?: unknown };
		};
		if (
			entry.type === "custom" &&
			"customType" in entry &&
			entry.customType === CODE_REVIEW_MODEL_CUSTOM_TYPE
		) {
			const model = entry.data?.model;
			return typeof model === "string" && model.length > 0 ? model : undefined;
		}
	}

	return undefined;
}
