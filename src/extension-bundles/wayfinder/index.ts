/**
 * Bundle manifest — `wayfinder`.
 *
 * A thin, stateless, command-driven extension that turns the agent into a
 * **wayfinder**: chart a large, foggy effort as a map of decision tickets on
 * the repo's issue tracker, and resolve them one at a time until the way to
 * the destination is clear.
 *
 * One command — `/wayfinder <ref>` — a one-shot doctrine injector that clears
 * the conversation first, so the doctrine is the agent's entire frame. `<ref>`
 * is a number, URL, *description* (resolved via search), or nothing (chart):
 * the command detects the tracker, then injects a compact **always-injected
 * overview** (dispatch table + meta-doctrine + 13-label taxonomy + tracker-ops)
 * and a directive; the model auto-disambiguates by the ticket's
 * `wayfinder:<type>` label + state and reads the phase how-to from the matching
 * model-invocable skill below. The old `/to-spec` and `/implement` routes are
 * gone — both were absorbed into the single dispatch.
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
	// Thirteen model-invocable skills — one per `wayfinder:<label>` — carrying
	// the phase how-to for each type. The always-injected overview (dispatch
	// table + meta-doctrine + taxonomy + tracker-ops) is composed by the command
	// handler; these skills are pulled on demand by the resolved label, and kept
	// model-invocable (no `disable-model-invocation`) so the agent can read
	// *other* phase skills for foresight.
	skills: [
		join(here, "skills", "map"),
		join(here, "skills", "plan-map"),
		join(here, "skills", "decision"),
		join(here, "skills", "prototype"),
		join(here, "skills", "research"),
		join(here, "skills", "task"),
		join(here, "skills", "spec"),
		join(here, "skills", "implementation-map"),
		join(here, "skills", "unit-map"),
		join(here, "skills", "development"),
		join(here, "skills", "unit-review"),
		join(here, "skills", "merge"),
		join(here, "skills", "implementation-review"),
	],
	prompts: [],
	dependencies: ["terminal-status"],
} satisfies ExtensionBundleManifest;
