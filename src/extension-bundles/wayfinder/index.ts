/**
 * Bundle manifest — `wayfinder`.
 *
 * A thin, stateless, command-driven extension that turns the agent into a
 * **wayfinder**: chart a large, foggy effort as a map of decision tickets on
 * the repo's issue tracker, and resolve them one at a time until the way to
 * the destination is clear.
 *
 * Two commands (both one-shot doctrine injectors):
 *   /wayfinder              — grill the destination, then create the map and
 *                             the primitive tickets for the frontier.
 *   /wayfinder <ticket-ref> — point this session at a ticket; the model
 *                             auto-detects its primitive type and acts.
 *
 * The extension detects the tracker at runtime (GitHub / GitLab / local
 * markdown) and composes the doctrine with the correct tracker operations,
 * so it ships no tracker adapter documents and has no bundle dependencies.
 * Grilling is folded into the injected doctrine.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionBundleManifest } from "../../types.js";

const here = dirname(fileURLToPath(import.meta.url));

export default {
	name: "wayfinder",
	piExtensions: [join(here, "pi-extensions", "wayfinder")],
	skills: [],
	prompts: [],
} satisfies ExtensionBundleManifest;
