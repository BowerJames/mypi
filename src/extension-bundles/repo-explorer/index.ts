import type { ExtensionBundleManifest } from "../../extension-bundle-manifest.js";
import repoExplorerSkill from "./skills/repo-explorer.js";

export default {
	name: "repo-explorer",
	piExtensions: [],
	skills: [repoExplorerSkill],
	prompts: [],
	// The repo-explorer skill uses dynamic `!` shell blocks in its body, which
	// only the dynamic-skills extension expands at load time.
	dependencies: ["dynamic-skills"],
} satisfies ExtensionBundleManifest;
