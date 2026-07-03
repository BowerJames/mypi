import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionBundleManifest } from "../../types.js";

const here = dirname(fileURLToPath(import.meta.url));

export default {
	name: "btw",
	piExtensions: [join(here, "pi-extensions", "btw", "index.ts")],
	skills: [],
	prompts: [],
} satisfies ExtensionBundleManifest;
