import type { ModeConfig } from "./types.js";

export const DEVELOP_WORKFLOW_INSTRUCTIONS = `You are in develop mode. Follow this workflow:

1. If you are on the main branch, create a new branch. Choose an appropriate name based on the work.
2. Complete the development work.
3. Once the work is complete, commit with a descriptive message.`;

export const developConfig: ModeConfig = {
  label: "🔨 develop",
  suffix: "Remember you are currently in develop mode",
};
