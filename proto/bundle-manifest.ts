/**
 * PART B (wiring) — the unified wayfinder bundle manifest. Prototype stub for
 * #109; mirrors the real `wayfinder/index.ts` shape. The diff vs today's
 * manifest is the *point* of the prototype:
 *
 *   - piExtensions: was [wayfinder/index.ts] (3 commands). NOW one command.
 *   - skills:       was []. NOW 13 (one per label).
 *   - prompts:      unchanged (none).
 *   - dependencies: terminal-status (unchanged).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionBundleManifest } from "../../../../../src/types.js";

const here = dirname(fileURLToPath(import.meta.url));

/** The 13 labels → 13 skill dirs. Order = lifecycle order (matches overview). */
const SKILL_DIRS = [
	"map",
	"plan-map",
	"decision",
	"prototype",
	"research",
	"task",
	"spec",
	"implementation-map",
	"unit-map",
	"development",
	"unit-review",
	"merge",
	"implementation-review",
] as const;

export default {
	name: "wayfinder",
	// One command (was three: /wayfinder, /to-spec, /implement).
	piExtensions: [join(here, "command", "wayfinder.ts")],
	// One thin skill per label (was none) — model-invocable, so the agent can
	// read OTHER phase skills for foresight (#104).
	skills: SKILL_DIRS.map((d) => join(here, "skills", d)),
	prompts: [],
	dependencies: ["terminal-status"],
} satisfies ExtensionBundleManifest;
