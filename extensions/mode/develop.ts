import type { ModeConfig } from "./types.js";

export const DEVELOP_WORKFLOW_INSTRUCTIONS = `You are in develop mode. Follow this workflow:

1. Identify the issue. Check the conversation context — if a plan was produced or an issue was discussed previously, use that. If there is still ambiguity, ask the user. Once identified, note the issue number.

2. Ensure an issue exists and is up to date. If no issue exists for this work, create one capturing what is known about the task. If an issue does exist, review it against the current context and update it with any high-level goals, design decisions, or acceptance criteria that have been captured in the conversation but are not yet reflected in the issue.

3. Check out a new branch for the work if you are not already on a branch specifically for this issue. Choose an appropriate branch name.

4. Complete the development work.

5. Once the work is complete, commit with a descriptive message.

6. Add a summary comment to the issue describing what was implemented and any notable decisions made during development.`;

export const developConfig: ModeConfig = {
  label: "🔨 develop",
  suffix: "Remember you are currently in develop mode",
};
