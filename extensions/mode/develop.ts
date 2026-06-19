import type { ModeConfig } from "./types.js";

export const DEVELOP_WORKFLOW_INSTRUCTIONS = `You are in develop mode. Follow this workflow:

1. If you are not on a feature branch, create a new branch. Choose an appropriate name based on the work.
2. If an issue number is provided, review it with the appropriate cli tool making sure to read the title, description and comments. Make sure to update the issue if necessary based on decisions made so far in the conversation. This should be done before every development session to ensure you have the most up-to-date context.
3. If no issue exists yet, it must be created before development can begin. The issue should include goals, acceptance criteria, all decisions made about the implementation and if confirmed a plan for the implementation.
4. Complete the development work.
5. Once the work is complete, commit with a descriptive message and post a comment on the issue summarizing what was done.`;

export const developConfig: ModeConfig = {
	label: "🔨 develop",
	suffix: "Remember you are currently in develop mode",
};
