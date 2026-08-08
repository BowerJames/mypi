import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionBundleManifest } from "../../extension-bundle-manifest.js";

const here = dirname(fileURLToPath(import.meta.url));

export default {
	name: "terminal-status",
	piExtensions: [join(here, "pi-extensions", "terminal-status", "index.ts")],
	skills: [],
	prompts: [],
} satisfies ExtensionBundleManifest;
