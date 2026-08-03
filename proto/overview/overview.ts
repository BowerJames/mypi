/**
 * PART B builder — returns the compact overview string, templated with the
 * tracker-ops section for the detected tracker. Prototype stub for #109.
 *
 * In the real build this reads `overview.md` (the canonical, human-readable
 * text) and swaps the tracker-ops section via today's `trackerOpsSection`
 * machinery (github → `gh`, gitlab → `glab`, local → `/tmp/.wayfinder/<repo>/`
 * files). Here it returns the github rendering (this repo's tracker) and notes
 * the other two mirror today's selectors — enough to show the build shape.
 */
export interface OverviewInput {
	tracker: "github" | "gitlab" | "local";
	repo: string;
}

/**
 * Build the overview. The full prose lives in `overview.md` (the source of
 * truth); this stub shows that the *only* templated part is the tracker-ops
 * section, selected by the detected tracker. The command injects the result +
 * a one-line resolution directive (see `command/wayfinder.ts`).
 */
export function buildOverview(_input: OverviewInput): string {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const _ = _input;
	// Real build: read overview.md, splice in trackerOpsSection(input.tracker,
	// input.repo). For the prototype, overview.md IS the github rendering and
	// is read directly; gitlab/local differ only in the tracker-ops bullets.
	return "[overview.md — injected verbatim; tracker-ops section selected per detected tracker]";
}
