import { describe, expect, it } from "vitest";
import { buildOverview, trackerOpsSection } from "./overview.js";

const REPO = "mypi";

/**
 * Overview-builder tests. The overview is the always-injected frame (dispatch
 * table + meta-doctrine + taxonomy + tracker-ops); the phase how-to lives in
 * one skill per label (see `skills.test.ts`). These tests pin the frame on
 * stable anchors — section headings, the presence of each label name, the
 * dispatch rows — so the prose can evolve without churn.
 */

describe("buildOverview — preamble + resolution + dispatch", () => {
	const doc = buildOverview({ tracker: "github", repo: REPO });

	it("announces the wayfinder frame", () => {
		expect(doc).toContain("## Wayfinder — chart the fog, resolve one ticket at a time");
		expect(doc).toContain("**wayfinder**");
		expect(doc).toContain("plan, you don't do");
	});

	it("states the one-command collapse (to-spec/implement absorbed)", () => {
		expect(doc).toContain("One command — resolve, then dispatch by label + state");
		expect(doc).toContain("`/to-spec` and `/implement` are gone");
		expect(doc).toContain("absorbed");
	});

	it("lists the four ref forms (resolution is the agent's first turn)", () => {
		expect(doc).toContain("**number**");
		expect(doc).toContain("**URL**");
		expect(doc).toContain("**description**");
		expect(doc).toContain("**nothing**");
		expect(doc).toContain("gh issue list --search");
		expect(doc).toContain("ask the user **one** question to disambiguate");
	});

	it("carries the dispatch table with the decided rows", () => {
		expect(doc).toContain("#### Dispatch table");
		// no-arg → map (chart)
		expect(doc).toContain("*(no arg)*");
		expect(doc).toContain("`map`");
		// open map → map
		expect(doc).toContain("`map` | open");
		// planning primitives → that skill
		expect(doc).toContain("`decision` / `prototype` / `research` / `task`");
		// spec (open or closed) → spec skill
		expect(doc).toContain("`spec` | open **or** closed");
		expect(doc).toContain("synthesise / overwrite the PRD");
		expect(doc).toContain("implementation kickoff");
		// implementation-map → redirect (NOT an error)
		expect(doc).toContain("`implementation-map` | open | *(redirect)*");
		expect(doc).toContain("not a work target");
		expect(doc).toContain("`unit-map` / `development`");
		// the rest
		expect(doc).toContain("`unit-map` | open");
		expect(doc).toContain("`development` | open");
		expect(doc).toContain("`unit-review` | open");
		expect(doc).toContain("`merge` | open");
		expect(doc).toContain("`implementation-review` | open");
	});

	it("notes the dispatch is a fixed (deterministic) map, with foresight allowed", () => {
		expect(doc).toContain("fixed map");
		expect(doc).toContain("deterministic");
		expect(doc).toContain("read other phase skills for foresight");
	});
});

describe("buildOverview — meta-doctrine (plan-don't-do · fog · refer-by-name · grilling)", () => {
	const doc = buildOverview({ tracker: "github", repo: REPO });

	it("carries the four meta-doctrine anchors", () => {
		expect(doc).toContain("### Plan, don't do");
		expect(doc).toContain("### Fog of war");
		expect(doc).toContain("### Refer by name");
		expect(doc).toContain("### Grilling");
	});

	it("fog-of-war describes graduation + out-of-scope", () => {
		expect(doc).toContain("graduates");
		expect(doc).toContain("out of scope");
	});

	it("refer-by-name states the title-not-id rule", () => {
		expect(doc).toContain("**title**");
		expect(doc).toContain("id/URL rides");
	});

	it("grilling lists the one-question / recommended-answer / breadth-first rules", () => {
		expect(doc).toContain("one");
		expect(doc).toContain("recommended answer");
		expect(doc).toContain("breadth-first");
	});
});

describe("buildOverview — taxonomy (all 13 labels, atomic/composite)", () => {
	const doc = buildOverview({ tracker: "github", repo: REPO });

	const LABELS = [
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

	it("carries the taxonomy section heading", () => {
		expect(doc).toContain("### Taxonomy — atomic / composite (13 labels)");
	});

	it("names all 13 labels", () => {
		for (const label of LABELS) {
			expect(doc).toContain(label);
		}
	});

	it("states the derivable naming rules (*-map ⇒ composite; *-review ⇒ review child)", () => {
		expect(doc).toContain("`*-map`");
		expect(doc).toContain("composite");
		expect(doc).toContain("`*-review`");
		expect(doc).toContain("review child");
	});

	it("notes map/plan-map have no review child (planning resolves by grilling)", () => {
		expect(doc).toContain("`map` / `plan-map`");
		expect(doc).toContain("no");
		expect(doc).toContain("grilling");
	});

	it("carries the lifecycle tree", () => {
		expect(doc).toContain("whole lifecycle umbrella");
		expect(doc).toContain("bridge; synthesise PRD; never writes repo");
		expect(doc).toContain("one mergeable unit");
		expect(doc).toContain("one coding round");
		expect(doc).toContain("one review per run");
	});

	it("states the composite close = dynamic re-scan, never static blocked_by", () => {
		expect(doc).toContain("dynamic");
		expect(doc).toContain("runtime re-scan");
		expect(doc).toContain("never static");
	});

	it("keeps blocked_by for concrete deps, concept gates as doctrine (not blockers)", () => {
		expect(doc).toContain("concrete issue-to-issue dependencies");
		expect(doc).toContain("Concept gates");
		expect(doc).toContain("never");
		expect(doc).toContain("runtime doctrine");
	});

	it("states atomic = fire-and-forget", () => {
		expect(doc).toContain("fire-and-forget");
		expect(doc).toContain("never waits on what it spawns");
	});
});

describe("trackerOpsSection", () => {
	it("selects the GitHub ops (gh)", () => {
		const ops = trackerOpsSection("github", REPO);
		expect(ops).toContain("### Tracker operations — GitHub Issues");
		expect(ops).toContain("gh issue");
		expect(ops).toContain("gh issue list --search");
		expect(ops).not.toContain("/tmp/.wayfinder/");
	});

	it("selects the GitLab ops (glab)", () => {
		const ops = trackerOpsSection("gitlab", REPO);
		expect(ops).toContain("### Tracker operations — GitLab Issues");
		expect(ops).toContain("glab issue");
		expect(ops).toContain("glab issue list --search");
		expect(ops).not.toContain("gh issue");
	});

	it("selects the local ops and templates in the repo slug", () => {
		const ops = trackerOpsSection("local", REPO);
		expect(ops).toContain("### Tracker operations — Local Markdown (ephemeral)");
		expect(ops).toContain(`/tmp/.wayfinder/${REPO}/`);
		expect(ops).toContain("Type:");
		expect(ops).toContain("Status:");
	});

	it("names all 13 labels in the local Type: line", () => {
		const ops = trackerOpsSection("local", REPO);
		expect(ops).toContain("implementation-review");
		expect(ops).toContain("unit-review");
		expect(ops).toContain("plan-map");
		expect(ops).toContain("unit-map");
	});

	it("the consolidated section carries the lifecycle mechanics (read / search / create / block / claim / resolve / frontier)", () => {
		for (const tracker of ["github", "gitlab", "local"] as const) {
			const ops = trackerOpsSection(tracker, REPO);
			expect(ops).toContain("Read a ref");
			expect(ops).toContain("Resolve by description");
			expect(ops).toContain("Create");
			expect(ops).toContain("Blocking");
			expect(ops).toContain("Claim");
			expect(ops).toContain("Resolve");
			expect(ops).toContain("Frontier");
		}
	});

	it("notes a spec successor is produced, not a child (github + gitlab)", () => {
		expect(trackerOpsSection("github", REPO)).toContain("produced, not a child");
		expect(trackerOpsSection("gitlab", REPO)).toContain("produced, not a child");
	});

	it("notes concept gates are never Blocked by: lines (all three)", () => {
		for (const tracker of ["github", "gitlab", "local"] as const) {
			expect(trackerOpsSection(tracker, REPO).toLowerCase()).toContain("concept gates");
		}
	});

	it("does not leak the repo slug into the hosted trackers", () => {
		expect(trackerOpsSection("github", REPO)).not.toContain(`/tmp/.wayfinder/${REPO}/`);
		expect(trackerOpsSection("gitlab", REPO)).not.toContain(`/tmp/.wayfinder/${REPO}/`);
	});

	it("the local section records the durable-record caveat (merged branch in cwd)", () => {
		expect(trackerOpsSection("local", REPO)).toContain("Durable record");
		expect(trackerOpsSection("local", REPO)).toContain("merged branch in cwd");
	});
});

describe("buildOverview — per-tracker round-trip", () => {
	for (const tracker of ["local", "github", "gitlab"] as const) {
		it(`selects ${tracker} ops inside the overview`, () => {
			const doc = buildOverview({ tracker, repo: REPO });
			if (tracker === "github") expect(doc).toContain("GitHub Issues");
			if (tracker === "gitlab") expect(doc).toContain("GitLab Issues");
			if (tracker === "local") expect(doc).toContain(`/tmp/.wayfinder/${REPO}/`);
		});
	}
});
