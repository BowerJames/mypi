import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionBundleManifest } from "../../types.js";

const here = dirname(fileURLToPath(import.meta.url));

export default {
	name: "overview",
	piExtensions: [],
	skills: [],
	prompts: [join(here, "prompts", "overview.md")],
} satisfies ExtensionBundleManifest;
