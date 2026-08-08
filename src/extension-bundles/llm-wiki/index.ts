import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionBundleManifest } from "../../extension-bundle-manifest.js";

const here = dirname(fileURLToPath(import.meta.url));

export default {
	name: "llm-wiki",
	piExtensions: [join(here, "pi-extensions", "llm-wiki", "index.ts")],
	skills: [],
	prompts: [],
} satisfies ExtensionBundleManifest;
