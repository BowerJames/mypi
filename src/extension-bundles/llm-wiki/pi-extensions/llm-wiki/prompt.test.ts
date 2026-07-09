import { describe, expect, it } from "vitest";
import { buildWikiManagerPromptSuffix, OKF_SPEC_RAW_URL } from "./prompt.js";

const baseInput = {
	wikiRootDisplay: "wiki",
	specAbsPath: "/proj/wiki/SPEC.md",
	specExists: false,
	specContents: undefined,
} as const;

describe("buildWikiManagerPromptSuffix — gating", () => {
	it("returns undefined when wikiRootDisplay is empty", () => {
		expect(buildWikiManagerPromptSuffix({ ...baseInput, wikiRootDisplay: "" })).toBeUndefined();
	});
});

describe("buildWikiManagerPromptSuffix — structure", () => {
	it("declares the wiki-manager role and the wiki-root", () => {
		const out = buildWikiManagerPromptSuffix({ ...baseInput, wikiRootDisplay: "docs" });
		expect(out).toContain("## Wiki Manager");
		expect(out).toContain("`docs/`");
	});

	it("includes the OKF format essentials", () => {
		const out = buildWikiManagerPromptSuffix(baseInput);
		expect(out).toContain("OKF format (v0.1)");
		expect(out).toContain("required");
		expect(out).toContain("`type`");
		expect(out).toContain("`index.md`");
		expect(out).toContain("`log.md`");
		expect(out).toContain("bundle-root-relative");
	});

	it("includes the ingest/query/lint operating model", () => {
		const out = buildWikiManagerPromptSuffix(baseInput);
		expect(out).toContain("Operating model");
		expect(out).toContain("**Ingest.**");
		expect(out).toContain("**Query.**");
		expect(out).toContain("**Lint.**");
	});

	it("starts with a double newline for clean appending", () => {
		expect(buildWikiManagerPromptSuffix(baseInput)?.startsWith("\n\n")).toBe(true);
	});
});

describe("buildWikiManagerPromptSuffix — read-the-spec-first directive", () => {
	it("includes a 'Read the OKF spec first' section", () => {
		const out = buildWikiManagerPromptSuffix(baseInput);
		expect(out).toContain("### Read the OKF spec first");
	});

	it("tells the agent to fetch the raw OKF spec once per session via curl", () => {
		const out = buildWikiManagerPromptSuffix(baseInput);
		expect(out).toContain(OKF_SPEC_RAW_URL);
		expect(out).toContain("curl -fsSL");
		expect(out).toContain("once per session");
	});

	it("self-gates: do not re-fetch if the spec is already in context", () => {
		const out = buildWikiManagerPromptSuffix(baseInput);
		expect(out).toContain("do NOT fetch it again");
	});

	it("instructs the agent to stop and inform the user on fetch failure", () => {
		const out = buildWikiManagerPromptSuffix(baseInput);
		expect(out).toContain("STOP");
		expect(out).toContain("blocked");
		expect(out).toContain("Do not fall back to the summary");
	});

	it("places the directive before the OKF format quick-reference summary", () => {
		const out = buildWikiManagerPromptSuffix(baseInput);
		expect(out).toBeDefined();
		const text = out ?? "";
		const directiveIdx = text.indexOf("### Read the OKF spec first");
		const summaryIdx = text.indexOf("### OKF format (v0.1)");
		expect(directiveIdx).toBeGreaterThanOrEqual(0);
		expect(summaryIdx).toBeGreaterThan(directiveIdx);
	});
});

describe("buildWikiManagerPromptSuffix — spec branches", () => {
	it("reports no spec configured when specAbsPath is undefined (spec cleared)", () => {
		const out = buildWikiManagerPromptSuffix({
			...baseInput,
			specAbsPath: undefined,
			specExists: false,
			specContents: undefined,
		});
		expect(out).toContain("Wiki Purpose & Conventions");
		expect(out).toContain("No wiki spec is configured");
		expect(out).toContain("/wiki-spec <path>");
		expect(out).toContain("/wiki-init");
		// Must NOT claim the wiki is uninitialised or reference a path.
		expect(out).not.toContain("not yet initialised");
		expect(out).not.toContain(baseInput.specAbsPath);
	});

	it("guides toward /wiki-init when the spec is missing", () => {
		const out = buildWikiManagerPromptSuffix({
			...baseInput,
			specExists: false,
			specContents: undefined,
		});
		expect(out).toContain("not yet initialised");
		expect(out).toContain("/wiki-init");
		expect(out).toContain(baseInput.specAbsPath);
	});

	it("instructs the agent to fill in an empty spec before any wiki work", () => {
		const out = buildWikiManagerPromptSuffix({
			...baseInput,
			specExists: true,
			specContents: "   \n  \n", // whitespace-only → treated as empty
		});
		expect(out).toContain("empty");
		expect(out).toContain(baseInput.specAbsPath);
		expect(out).toContain("ask the user what the wiki is for");
		// Must NOT have injected the whitespace as if it were content.
		expect(out).not.toContain("Follow it in all wiki work");
	});

	it("injects a populated spec verbatim under the purpose section", () => {
		const spec =
			"# Purpose\n\nThis wiki tracks my reading of the Foundation series.\n\n# Page Types\n\n- character\n- planet";
		const out = buildWikiManagerPromptSuffix({
			...baseInput,
			specExists: true,
			specContents: spec,
		});
		expect(out).toContain("Wiki Purpose & Conventions");
		expect(out).toContain("Follow it in all wiki work");
		expect(out).toContain("Foundation series");
		expect(out).toContain("- character");
	});
});
