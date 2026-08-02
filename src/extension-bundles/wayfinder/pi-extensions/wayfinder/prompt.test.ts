import { describe, expect, it } from "vitest";
import { buildChartDoctrine, buildTicketDoctrine, trackerOpsSection } from "./prompt.js";

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
	}
});
