import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionBundleManifest } from "../../types.js";

const here = dirname(fileURLToPath(import.meta.url));

export default {
	name: "render-raw",
	piExtensions: [join(here, "pi-extensions", "render-raw", "index.ts")],
	skills: [],
	prompts: [],
} satisfies ExtensionBundleManifest;
