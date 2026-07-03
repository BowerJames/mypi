import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionBundleManifest } from "../../types.js";

const here = dirname(fileURLToPath(import.meta.url));

export default {
	name: "review-agent-trajectory",
	piExtensions: [join(here, "pi-extensions", "review-agent-trajectory", "index.ts")],
	skills: [],
	prompts: [],
} satisfies ExtensionBundleManifest;
