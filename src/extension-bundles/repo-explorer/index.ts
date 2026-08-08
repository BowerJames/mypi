import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionBundleManifest } from "../../extension-bundle-manifest.js";

const here = dirname(fileURLToPath(import.meta.url));

export default {
	name: "repo-explorer",
	piExtensions: [],
	skills: [join(here, "skills", "repo-explorer")],
	prompts: [],
	// The repo-explorer skill uses dynamic `!` shell blocks in its SKILL.md,
	// which only the dynamic-skills extension expands at load time.
	dependencies: ["dynamic-skills"],
} satisfies ExtensionBundleManifest;
