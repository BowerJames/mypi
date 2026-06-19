/**
 * Root branch persistence utilities for the mode extension.
 *
 * The root branch is stored as a custom session entry via `pi.appendEntry()`
 * and can be retrieved on session restore by scanning entries from the end.
 */

export const ROOT_BRANCH_CUSTOM_TYPE = "root-branch";

/**
 * Build the system prompt suffix for root branch context.
 *
 * Returns the text to append to the system prompt, or `undefined` if
 * no root branch is set.
 */
export function buildRootBranchPromptSuffix(
	rootBranch: string | null | undefined,
): string | undefined {
	if (!rootBranch) return undefined;

	return `\n\n# Root Branch\n\nThe root branch for the current high level stream of work is ${rootBranch}. You may be required to implement individual sections on issue specific branches but all pull requests must target ${rootBranch} unless expressly told otherwise.`;
}

/**
 * Retrieve the last set root branch from session entries.
 *
 * Scans entries from the end of the array and returns the `branch` value
 * from the most recent custom entry with `customType === "root-branch"`.
 *
 * Returns `undefined` if no root-branch entry exists, or if the last entry
 * has a falsy `branch` value (cleared).
 */
export function getRootBranch(sessionManager: {
	getEntries(): readonly unknown[];
}): string | undefined {
	const entries = sessionManager.getEntries();

	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i] as {
			type?: string;
			customType?: string;
			data?: { branch?: unknown };
		};
		if (
			entry.type === "custom" &&
			"customType" in entry &&
			entry.customType === ROOT_BRANCH_CUSTOM_TYPE
		) {
			const branch = entry.data?.branch;
			return typeof branch === "string" && branch.length > 0 ? branch : undefined;
		}
	}

	return undefined;
}
