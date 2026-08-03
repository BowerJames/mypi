/**
 * Bundle manifest — `wayfinder`.
 *
 * A thin, stateless, command-driven extension that turns the agent into a
 * **wayfinder**: chart a large, foggy effort as a map of decision tickets on
 * the repo's issue tracker, and resolve them one at a time until the way to
 * the destination is clear.
 *
 * Four commands (each a one-shot doctrine injector that clears the
 * conversation first, so the doctrine is the agent's entire frame):
 *   /wayfinder              — grill the destination, then create the map and
 *                             the primitive tickets for the frontier.
 *   /wayfinder <ticket-ref> — point this session at a ticket; the model
 *                             auto-detects its primitive type and acts.
 *   /to-spec <map-ref>      — convert a *closed* wayfinder map into a
 *                             `wayfinder:spec` successor issue (PRD hand-off).
 *   /implement <ref>        — turn a *closed* `wayfinder:spec` into merged,
 *                             reviewed code. Auto-disambiguates: a closed spec
 *                             → kickoff (slice + cut the trunk + create the
 *                             Implementation Map); an open implementation
 *                             ticket → work it through its lifecycle.
 *
 * The extension detects the tracker at runtime (GitHub / GitLab / local
 * markdown) and composes the doctrine with the correct tracker operations,
 * so it ships no tracker adapter documents. Grilling is folded into the
 * injected doctrine.
 *
 * Bundle dependency: `terminal-status` (declared below) keeps the terminal
 * tab reflecting the wayfinder session's state whenever wayfinder is active,
 * regardless of which profile pulled it in — built-in or user-overridden.
 * Declared on the bundle, not duplicated in profiles, matching the
 * `repo-explorer` → `dynamic-skills` convention so transitive activation
 * guarantees it survives any profile override.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionBundleManifest } from "../../types.js";

const here = dirname(fileURLToPath(import.meta.url));

export default {
	name: "wayfinder",
	piExtensions: [join(here, "pi-extensions", "wayfinder", "index.ts")],
	skills: [],
	prompts: [],
	dependencies: ["terminal-status"],
} satisfies ExtensionBundleManifest;
