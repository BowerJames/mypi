import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionBundleManifest } from "../../types.js";

const here = dirname(fileURLToPath(import.meta.url));

export default {
	name: "repo-explorer",
	piExtensions: [],
	skills: [join(here, "skills", "repo-explorer")],
	prompts: [],
} satisfies ExtensionBundleManifest;
