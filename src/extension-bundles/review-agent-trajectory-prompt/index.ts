import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionBundleManifest } from "../../types.js";

const here = dirname(fileURLToPath(import.meta.url));

export default {
	name: "review-agent-trajectory-prompt",
	piExtensions: [],
	skills: [],
	prompts: [join(here, "prompts", "review-agent-trajectory.md")],
} satisfies ExtensionBundleManifest;
