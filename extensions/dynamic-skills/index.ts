/**
 * dynamic-skills — pi extension entry point.
 *
 * Makes skills live: executes embedded shell commands (inline `!`cmd`` and
 * fenced ```! blocks) at skill load time and replaces them with their output.
 *
 * Two interception points share one shell core and one skill index:
 *   - `input` event        → /skill:<name> <args> command expansion
 *   - `tool_result` event  → read of a registered SKILL.md
 *
 * The skill index is rebuilt lazily and invalidated on session_start
 * (startup/reload) so newly added/removed skills are picked up.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { handleSkillInput } from "./command-path.js";
import { handleReadResult } from "./read-path.js";
import { invalidateSkillIndex } from "./skill-index.js";

export default function dynamicSkillsExtension(pi: ExtensionAPI): void {
	pi.on("input", async (event, ctx) => handleSkillInput(event, ctx, pi));
	pi.on("tool_result", async (event, ctx) => handleReadResult(event, ctx, pi));
	pi.on("session_start", (event) => {
		if (event.reason === "startup" || event.reason === "reload") {
			invalidateSkillIndex();
		}
	});
}
