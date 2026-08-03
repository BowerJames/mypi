import { describe, expect, it } from "vitest";
import {
	buildChartDoctrine,
	buildImplementDoctrine,
	buildSpecDoctrine,
	buildTicketDoctrine,
	implementTrackerOpsSection,
	specTrackerOpsSection,
	trackerOpsSection,
} from "./prompt.js";

const REPO = "mypi";

describe("buildChartDoctrine", () => {
	const doc = buildChartDoctrine({ tracker: "github", repo: REPO });

	it("announces the chart flow", () => {
		expect(doc).toContain("## Wayfinder — chart the map");
	});

	it("lists all five primitives", () => {
		expect(doc).toContain("**Wayfinder Map**");
		expect(doc).toContain("**Decision**");
		expect(doc).toContain("**Prototype**");
		expect(doc).toContain("**Research**");
		expect(doc).toContain("**Task**");
	});

	it("carries the plan/fog/refer-by-name doctrine and grilling", () => {
		expect(doc).toContain("Plan, don't do");
		expect(doc).toContain("Fog of war");
		expect(doc).toContain("Refer by name");
		expect(doc).toContain("### Grilling");
	});

	it("describes the chart flow steps", () => {
		expect(doc).toContain("Grill the destination");
		expect(doc).toContain("breadth-first");
		expect(doc).toContain("wire blocking in a second pass");
	});

	it("embeds the github tracker ops", () => {
		expect(doc).toContain("Tracker operations — GitHub Issues");
		expect(doc).toContain("gh issue create");
	});
});

describe("buildTicketDoctrine", () => {
	const doc = buildTicketDoctrine({ tracker: "github", repo: REPO, ticketRef: "42" });

	it("announces the ticket flow and embeds the ticketRef", () => {
		expect(doc).toContain("## Wayfinder — work a ticket");
		expect(doc).toContain("You are working a specific wayfinder ticket: `42`");
	});

	it("walks the read → detect → claim → resolve → graduate steps", () => {
		expect(doc).toContain("**Read the ticket**");
		expect(doc).toContain("**Detect its type**");
		expect(doc).toContain("**Claim it**");
		expect(doc).toContain("**Resolve it**");
		expect(doc).toContain("**Graduate the fog**");
	});

	it("mentions the worktree convention for prototypes", () => {
		expect(doc).toContain("~/.worktrees/<map-slug>/<ticket-slug>/");
	});

	it("notes research is user-spawned, not auto-launched", () => {
		expect(doc).toContain("auto-launched");
		expect(doc).toContain("the user spawns a session");
	});

	it("carries the full primitives + doctrine + grilling + tracker ops", () => {
		expect(doc).toContain("**Task**");
		expect(doc).toContain("### Grilling");
		expect(doc).toContain("Tracker operations — GitHub Issues");
	});
});

describe("trackerOpsSection", () => {
	it("selects the GitHub ops", () => {
		const ops = trackerOpsSection("github", REPO);
		expect(ops).toContain("GitHub Issues");
		expect(ops).toContain("gh issue");
		expect(ops).not.toContain("/tmp/.wayfinder/");
	});

	it("selects the GitLab ops", () => {
		const ops = trackerOpsSection("gitlab", REPO);
		expect(ops).toContain("GitLab Issues");
		expect(ops).toContain("glab issue");
		expect(ops).not.toContain("gh issue");
	});

	it("selects the local ops and templates in the repo slug", () => {
		const ops = trackerOpsSection("local", REPO);
		expect(ops).toContain("Local Markdown (ephemeral)");
		expect(ops).toContain(`/tmp/.wayfinder/${REPO}/`);
		expect(ops).toContain("Type:");
		expect(ops).toContain("Status:");
	});

	it("does not leak the repo slug into the hosted trackers", () => {
		expect(trackerOpsSection("github", REPO)).not.toContain(`/tmp/.wayfinder/${REPO}/`);
		expect(trackerOpsSection("gitlab", REPO)).not.toContain(`/tmp/.wayfinder/${REPO}/`);
	});
});

describe("buildSpecDoctrine", () => {
	const doc = buildSpecDoctrine({ tracker: "github", repo: REPO, mapRef: "42" });

	it("announces the spec flow and embeds the mapRef", () => {
		expect(doc).toContain("## Wayfinder — convert a closed map to a spec");
		expect(doc).toContain("You are running `/to-spec 42`");
	});

	it("carries the verbatim 7-section template", () => {
		expect(doc).toContain("## Problem Statement");
		expect(doc).toContain("## Solution");
		expect(doc).toContain("## User Stories");
		expect(doc).toContain("## Implementation Decisions");
		expect(doc).toContain("## Testing Decisions");
		expect(doc).toContain("## Out of Scope");
		expect(doc).toContain("## Further Notes");
	});

	it("carries the seams/deep-module process, not as a template section", () => {
		expect(doc).toContain("### Seams / deep-module (process, not a section)");
		expect(doc).toContain("deep module");
		// the verbatim template's Testing Decisions guidance is left untouched
		expect(doc).toContain("Prior art for the tests");
	});

	it("encodes the seven decisions (durable inputs, one-shot, successor, overwrite, no repo file)", () => {
		expect(doc).toContain("durable");
		expect(doc).toContain("re-runnable from the map alone");
		expect(doc).toContain("No confirm gate");
		expect(doc).toContain("wayfinder:spec");
		expect(doc).toContain("successor");
		expect(doc).toContain("overwrite in place");
		expect(doc).toContain("Never write the repo");
		expect(doc).not.toContain("ready-for-agent");
	});

	it("does not grill or create wayfinder tickets", () => {
		expect(doc).toContain("you do not grill");
		expect(doc).toContain("you do not create wayfinder tickets");
		expect(doc).not.toContain("### Grilling");
	});
});

describe("specTrackerOpsSection", () => {
	it("selects GitHub spec ops (successor, not a child)", () => {
		const ops = specTrackerOpsSection("github", REPO);
		expect(ops).toContain("GitHub Issues (spec synthesis)");
		expect(ops).toContain("wayfinder:spec");
		expect(ops).toContain("successor");
		expect(ops).toContain("**not** a child");
		expect(ops).not.toContain("/tmp/.wayfinder/");
	});

	it("selects GitLab spec ops", () => {
		expect(specTrackerOpsSection("gitlab", REPO)).toContain("GitLab Issues (spec synthesis)");
	});

	it("selects local spec ops and templates the repo slug", () => {
		const ops = specTrackerOpsSection("local", REPO);
		expect(ops).toContain("Local Markdown (spec synthesis)");
		expect(ops).toContain(`/tmp/.wayfinder/${REPO}/`);
		expect(ops).toContain("spec.md");
	});
});

describe("buildImplementDoctrine", () => {
	const doc = buildImplementDoctrine({ tracker: "github", repo: REPO, ref: "74" });

	it("announces the implement flow and embeds the ref", () => {
		expect(doc).toContain("## Wayfinder — implement a closed spec");
		expect(doc).toContain("You are running `/implement 74`");
	});

	it("lists all six implementation primitives and their labels", () => {
		expect(doc).toContain("**Implementation Map**");
		expect(doc).toContain("**Development**");
		expect(doc).toContain("**Code Review**");
		expect(doc).toContain("**Follow-Up Development**");
		expect(doc).toContain("**Merge**");
		expect(doc).toContain("**Full Review**");
		expect(doc).toContain("wayfinder:implementation-map");
		expect(doc).toContain("wayfinder:development");
		expect(doc).toContain("wayfinder:code-review");
		expect(doc).toContain("wayfinder:follow-up-development");
		expect(doc).toContain("wayfinder:merge");
		expect(doc).toContain("wayfinder:full-review");
	});

	it("keeps the implementation map distinct from the planning map", () => {
		expect(doc).toContain("from the planning `wayfinder:map`");
	});

	it("encodes the disambiguation + implementation-map redirect error", () => {
		expect(doc).toContain("auto-disambiguates");
		expect(doc).toContain("closed");
		expect(doc).toContain("kickoff");
		expect(doc).toContain("redirect to the frontier Development ticket");
	});

	it("encodes the kickoff propose-then-create flow", () => {
		expect(doc).toContain("Propose-then-create");
		expect(doc).toContain("wait for a yes/no");
		expect(doc).toContain("Nothing is created until confirmed");
		expect(doc).toContain("Eligibility gate");
		expect(doc).toContain("refuse-and-name");
	});

	it("slices coarse-by-default and avoids inter-unit blocking", () => {
		expect(doc).toContain("Coarse-by-default slicing");
		expect(doc).toContain("genuine file/seam independence");
		expect(doc).toContain("no inter-unit blocking dependencies are wired");
	});

	it("encodes the transition table's per-primitive rules", () => {
		// each primitive's complete / spins-off / closes row
		expect(doc).toContain("switch to its worktree+branch, do the work, commit");
		expect(doc).toContain("approve → Merge");
		expect(doc).toContain("rework → Follow-Up Development");
		expect(doc).toContain("reuse the parent Dev's branch + worktree");
		expect(doc).toContain("merge unit branch → root");
		expect(doc).toContain("close map + self");
	});

	it("states the closure rules (single-owner, no orphans)", () => {
		expect(doc).toContain("Closure rules");
		expect(doc).toContain("self-closes at its gate");
		expect(doc).toContain("stays open until Merge");
		expect(doc).toContain("closes only at Full Review");
	});

	it("uses soft-doctrine eligibility guards, never native blocked_by in the lifecycle", () => {
		expect(doc).toContain("no native `blocked_by` inside the lifecycle");
		expect(doc).toContain("Blocked by: all other implementation tickets closed");
		expect(doc).toContain("Blocked by: commits on <dev-branch>");
	});

	it("encodes the branching namespace keyed on the spec slug", () => {
		expect(doc).toContain("implement/<spec-slug>");
		expect(doc).toContain("dev/<spec-slug>/<n>-<slug>");
		expect(doc).toContain("~/.worktrees/<spec-slug>/<n>-<slug>");
		expect(doc).toContain("git branch | grep <spec-slug>");
	});

	it("cuts the trunk from the CURRENT branch at kickoff, recorded in the map (not mode's root-branch)", () => {
		expect(doc).toContain("cut from the current branch at kickoff");
		expect(doc).toContain("Base branch:");
		expect(doc).toContain("persisted `/root-branch`");
	});

	it("uses a raw ticket number (no zero-padding) in the namespace", () => {
		expect(doc).toContain("raw (no zero-padding)");
	});

	it("materialises dev branches/worktrees lazily", () => {
		expect(doc).toContain("Lazy materialisation");
		expect(doc).toContain("materialised only when");
		expect(doc).toContain("git worktree add");
	});

	it("encodes the merge rules (non-fast-forward, guarded delete, push, conflict policy)", () => {
		expect(doc).toContain("git merge --no-ff");
		expect(doc).toContain("git branch -d");
		expect(doc).toContain("git worktree remove");
		expect(doc).toContain("push the trunk");
		expect(doc).toContain("halt and ask, never guess");
		expect(doc).toContain("leave the merge in-progress");
		expect(doc).toContain("git merge --abort");
		expect(doc).toContain("--ours");
		expect(doc).toContain("--theirs");
		expect(doc).toContain("commit while conflict markers remain");
	});

	it("encodes the in-band review mechanism (no subprocess, active-session model, user gate)", () => {
		expect(doc).toContain("in-band doctrine injection");
		expect(doc).toContain("No subprocess is spawned");
		expect(doc).toContain("code-review-prompt");
		expect(doc).toContain("are not reused");
		expect(doc).toContain("active session model");
		expect(doc).toContain("non-binding recommendation");
		expect(doc).toContain("approve or rework");
	});

	it("encodes the Full Review eligibility, pass-action, and rework loop", () => {
		expect(doc).toContain("leave the root→base merge to the user");
		expect(doc).toContain("fresh Development children");
		expect(doc).toContain("Full Review");
		expect(doc).toContain("Trunk: implement/<spec-slug>");
	});

	it("encodes the local-tracker split and the repo-writing inversion vs /to-spec", () => {
		expect(doc).toContain("Two stores: ephemeral tickets, real repo");
		expect(doc).toContain("merged branch in cwd");
		expect(doc).toContain("must write the repo");
		expect(doc).toContain("INVERSION vs `/to-spec`");
	});

	it("carries the refer-by-name rule", () => {
		expect(doc).toContain("Refer by name");
		expect(doc).toContain("title");
	});

	it("does not leak the repo slug into the hosted trackers", () => {
		expect(doc).not.toContain(`/tmp/.wayfinder/${REPO}/`);
	});
});

describe("implementTrackerOpsSection", () => {
	it("selects GitHub implement ops", () => {
		const ops = implementTrackerOpsSection("github", REPO);
		expect(ops).toContain("GitHub Issues (implement)");
		expect(ops).toContain("gh issue create --label wayfinder:implementation-map");
		expect(ops).toContain("gh issue create --label wayfinder:development");
		expect(ops).toContain("gh issue create --label wayfinder:full-review");
		expect(ops).not.toContain("/tmp/.wayfinder/");
	});

	it("selects GitLab implement ops", () => {
		const ops = implementTrackerOpsSection("gitlab", REPO);
		expect(ops).toContain("GitLab Issues (implement)");
		expect(ops).toContain("glab issue create --label wayfinder:implementation-map");
		expect(ops).toContain("glab issue create --label wayfinder:development");
		expect(ops).not.toContain("gh issue");
	});

	it("selects local implement ops and templates in the repo slug", () => {
		const ops = implementTrackerOpsSection("local", REPO);
		expect(ops).toContain("Local Markdown (implement)");
		expect(ops).toContain(`/tmp/.wayfinder/${REPO}/`);
		expect(ops).toContain("implement-map.md");
		expect(ops).toContain("Type: implementation-map");
	});
});

describe("doctrine round-trips per tracker", () => {
	for (const tracker of ["local", "github", "gitlab"] as const) {
		it(`chart doctrine selects ${tracker} ops`, () => {
			const doc = buildChartDoctrine({ tracker, repo: REPO });
			if (tracker === "github") expect(doc).toContain("GitHub Issues");
			if (tracker === "gitlab") expect(doc).toContain("GitLab Issues");
			if (tracker === "local") expect(doc).toContain(`/tmp/.wayfinder/${REPO}/`);
		});

		it(`ticket doctrine selects ${tracker} ops`, () => {
			const doc = buildTicketDoctrine({ tracker, repo: REPO, ticketRef: "7" });
			if (tracker === "github") expect(doc).toContain("GitHub Issues");
			if (tracker === "gitlab") expect(doc).toContain("GitLab Issues");
			if (tracker === "local") expect(doc).toContain(`/tmp/.wayfinder/${REPO}/`);
		});

		it(`spec doctrine selects ${tracker} spec ops`, () => {
			const doc = buildSpecDoctrine({ tracker, repo: REPO, mapRef: "42" });
			if (tracker === "github") expect(doc).toContain("spec synthesis");
			if (tracker === "gitlab") expect(doc).toContain("spec synthesis");
			if (tracker === "local") expect(doc).toContain(`/tmp/.wayfinder/${REPO}/`);
		});

		it(`implement doctrine selects ${tracker} ops`, () => {
			const doc = buildImplementDoctrine({ tracker, repo: REPO, ref: "74" });
			if (tracker === "github") expect(doc).toContain("GitHub Issues (implement)");
			if (tracker === "gitlab") expect(doc).toContain("GitLab Issues (implement)");
			if (tracker === "local") expect(doc).toContain(`/tmp/.wayfinder/${REPO}/`);
		});
	}
});

describe("shared Research bullet — sourcing enrichment", () => {
	// the shared bullet feeds both chart and ticket doctrines
	it("chart doctrine carries the sourcing clause + external/internal carve-outs", () => {
		const chart = buildChartDoctrine({ tracker: "github", repo: REPO });
		expect(chart).toContain("grills for its starting sources");
		expect(chart).toContain("external/credentialled");
		expect(chart).toContain("reads **directly**");
	});

	it("ticket doctrine inherits the enriched shared bullet", () => {
		const ticket = buildTicketDoctrine({ tracker: "github", repo: REPO, ticketRef: "42" });
		expect(ticket).toContain("grills for its starting sources");
		expect(ticket).toContain("external/credentialled");
	});

	it("chart doctrine does NOT gain the ticket-only research workflow section", () => {
		const chart = buildChartDoctrine({ tracker: "github", repo: REPO });
		expect(chart).not.toContain("### Research workflow");
	});

	it("spec doctrine gets no new research section", () => {
		const spec = buildSpecDoctrine({ tracker: "github", repo: REPO, mapRef: "42" });
		expect(spec).not.toContain("### Research workflow");
	});

	it("implement doctrine gets no new research section", () => {
		const impl = buildImplementDoctrine({ tracker: "github", repo: REPO, ref: "74" });
		expect(impl).not.toContain("### Research workflow");
	});
});

describe("buildTicketDoctrine — research workflow", () => {
	const doc = buildTicketDoctrine({ tracker: "github", repo: REPO, ticketRef: "42" });

	it("carries the ticket-only ### Research workflow section", () => {
		expect(doc).toContain("### Research workflow");
	});

	it("step 1 — checks for an existing ## Sources before grilling (confirm-once)", () => {
		expect(doc).toContain("Check for an existing `## Sources`");
		expect(doc).toContain("confirm once");
		// confirm-once: the check for an existing ## Sources precedes the grill
		expect(doc.indexOf("Check for an existing `## Sources`")).toBeLessThan(
			doc.indexOf("Grill for external/credentialled"),
		);
	});

	it("step 2 — grills external/credentialled sources one at a time with a recommended answer", () => {
		expect(doc).toContain("Grill for external/credentialled");
		expect(doc).toContain("one at a time");
		expect(doc).toContain("recommended answer");
	});

	it("step 2 — pins sources only (doc URLs, external files, API endpoints, version/date bounds; no sub-questions, no output shape)", () => {
		expect(doc).toContain("documentation URLs");
		expect(doc).toContain("external repo/file paths");
		expect(doc).toContain("API endpoints");
		expect(doc).toContain("version/date bounds");
		expect(doc).toContain("no sub-questions");
		expect(doc).toContain("output shape");
	});

	it("step 2 — internal-sources carve-out (read directly, not grilled)", () => {
		expect(doc).toContain("Repo-internal sources");
		expect(doc).toContain("directly");
	});

	it("step 3 — records ## Sources before investigating", () => {
		expect(doc).toContain("Record `## Sources`");
		// the record step precedes the investigate step
		expect(doc.indexOf("Record `## Sources`")).toBeLessThan(doc.indexOf("Investigate against"));
	});

	it("step 4 — hard gate refuses to investigate on an empty source set, via existing seams", () => {
		expect(doc).toContain("Hard gate");
		expect(doc).toContain("do not investigate");
		// routes through the existing Blocked / Task / Not yet specified seams
		expect(doc).toContain("Task");
		expect(doc).toContain("Not yet specified");
		expect(doc).toContain("No new state");
	});

	it("steps 5–6 — investigate against recorded sources, then resolve and graduate as normal", () => {
		expect(doc).toContain("Investigate against");
		expect(doc).toContain("Resolve and graduate");
		expect(doc).toContain("## Answer");
	});
});
