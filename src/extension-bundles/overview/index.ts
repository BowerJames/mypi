import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionBundleManifest } from "../../extension-bundle-manifest.js";

const here = dirname(fileURLToPath(import.meta.url));

export default {
	name: "overview",
	piExtensions: [],
	skills: [],
	prompts: [join(here, "prompts", "overview.md")],
} satisfies ExtensionBundleManifest;
