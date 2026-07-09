/**
 * System-prompt suffix builder for the llm-wiki extension.
 *
 * Each turn the extension appends a "## Wiki Manager" section to the system
 * prompt that (a) declares the agent maintains an OKF v0.1 bundle, (b) directs
 * the agent to read the full OKF spec once per session (stopping to inform the
 * user if it cannot be fetched), (c) gives the generic OKF format essentials,
 * (d) describes the ingest/query/lint operating model, and (e) injects the
 * per-wiki purpose/conventions from the `<wiki-spec>` file (Karpathy's "schema"
 * layer) — supplying the runtime context that makes this a *general* tool for
 * any wiki.
 *
 * Pure & unit-testable — the extension does the filesystem read and passes in
 * whether the spec exists and its contents.
 */

/** Input for {@link buildWikiManagerPromptSuffix}. */
export interface WikiPromptInput {
	/** User-facing relative form of the wiki-root (e.g. `wiki` or a custom value). */
	wikiRootDisplay: string;
	/** Absolute path to the wiki-spec file. `undefined` when no spec is configured (user cleared it). */
	specAbsPath: string | undefined;
	/** Whether the wiki-spec file exists on disk (only meaningful when `specAbsPath` is defined). */
	specExists: boolean;
	/** Raw contents of the wiki-spec file when it exists (may be empty). */
	specContents: string | undefined;
}

/**
 * Human-readable OKF v0.1 spec — the HTML `blob` page, for links a person sees.
 */
export const OKF_SPEC_URL =
	"https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md";

/**
 * Raw OKF v0.1 spec text — the URL the agent should `curl` (no HTML wrapper).
 */
export const OKF_SPEC_RAW_URL =
	"https://raw.githubusercontent.com/GoogleCloudPlatform/knowledge-catalog/main/okf/SPEC.md";

/**
 * Build the system-prompt suffix to append each turn.
 *
 * Returns `undefined` when there is no effective wiki-root (the only case in
 * which the wiki-manager behaviour should not be engaged).
 */
export function buildWikiManagerPromptSuffix(input: WikiPromptInput): string | undefined {
	if (!input.wikiRootDisplay) return undefined;

	const readSpecFirstSection = `### Read the OKF spec first

Before any other wiki work this session, you MUST read the full OKF v0.1 specification so you understand the format in detail. The summary below is a quick reference only — not a substitute for reading the spec.

- Fetch it once per session using bash, e.g. \`curl -fsSL ${OKF_SPEC_RAW_URL}\`. Use this raw URL, not the HTML \`blob\` page at ${OKF_SPEC_URL}.
- This requirement is satisfied once the spec is in your context: if you already fetched it earlier this session (visible in the conversation history), do NOT fetch it again.
- If the fetch fails for any reason — network or HTTP error, empty or garbled body — STOP immediately. Do not fall back to the summary and do not attempt any wiki work. Tell the user you could not retrieve the OKF spec and that wiki work is blocked until it can be read.`;

	const okfSection = `### OKF format (v0.1)

The wiki is an [Open Knowledge Format](${OKF_SPEC_URL}) bundle — a directory tree of UTF-8 markdown files:

- Every concept document has a YAML frontmatter block (\`---\` delimited) with a **required** \`type\` field. \`title\`, \`description\`, \`resource\`, \`tags\`, and \`timestamp\` are optional.
- Reserved filenames: \`index.md\` (a directory listing for progressive disclosure — no frontmatter) and \`log.md\` (a date-grouped, newest-first update history). These MUST NOT be used for concept documents.
- Concept IDs are file paths with the \`.md\` suffix removed (\`tables/users.md\` → \`tables/users\`).
- Cross-links use standard markdown. A leading-slash path (\`/tables/customers.md\`) is **bundle-root-relative** (relative to the wiki-root); other links are relative to the linking document. Broken links are not malformed — they may represent not-yet-written knowledge.
- Conventional body headings: \`# Schema\` (structured columns/fields), \`# Examples\`, \`# Citations\` (numbered external sources backing claims in the body).
- Be permissive on consumption (tolerate unknown \`type\` values, extra frontmatter keys, missing indexes) and disciplined on authoring (always set \`type\`, keep \`index.md\`/\`log.md\` current).`;

	const operatingModel = `### Operating model

You own the wiki layer entirely — you write and maintain all of it; the user sources, directs, and asks. Follow the three operations:

- **Ingest.** When the user adds a source, read it, discuss the key takeaways, then write a summary page (with frontmatter \`type\`), update the relevant entity/concept pages, append an entry to \`log.md\` (ISO 8601 \`## YYYY-MM-DD\` heading, newest first), and refresh \`index.md\`. A single source may touch many pages.
- **Query.** When asked a question, read \`index.md\` first to find relevant pages, drill into them, and synthesise an answer with citations. Valuable answers (a comparison, an analysis, a discovered connection) should be **filed back into the wiki** as new pages so exploration compounds.
- **Lint.** On request, health-check the wiki: contradictions between pages, stale claims superseded by newer sources, orphan pages with no inbound links, important concepts mentioned but lacking their own page, missing cross-references. Suggest new questions to investigate and new sources to look for.

Keep cross-references current, note where new data contradicts old claims, and never leave \`index.md\`/\`log.md\` stale after a change.`;

	const purposeSection = buildPurposeSection(input);

	return (
		`\n\n## Wiki Manager\n\n` +
		`You are managing a personal knowledge wiki at \`${input.wikiRootDisplay}/\`, ` +
		`authored in the Open Knowledge Format (OKF). You write and maintain all ` +
		`of it; the user curates sources, directs analysis, and asks questions.\n\n` +
		`${readSpecFirstSection}\n\n` +
		`${okfSection}\n\n` +
		`${operatingModel}\n\n` +
		`${purposeSection}\n`
	);
}

/**
 * Build the "Wiki Purpose & Conventions" section from the wiki-spec file.
 *
 * Four branches:
 * - **none configured** → no spec path (user cleared `/wiki-spec`); tell the
 *   agent no spec is set and how to configure one.
 * - **missing** → a spec path is set but the file does not exist; tell the
 *   agent the wiki is uninitialised and how to bootstrap.
 * - **empty** (0 bytes / whitespace) → the spec exists but is unpopulated; it
 *   must be filled in before any wiki work is meaningful.
 * - **populated** → inject the spec contents verbatim.
 */
function buildPurposeSection(input: WikiPromptInput): string {
	const header = "### Wiki Purpose & Conventions";

	if (!input.specAbsPath) {
		return (
			`${header}\n\n` +
			`No wiki spec is configured. The spec is the per-wiki purpose & conventions doc ` +
			`that tells you *which* wiki you are managing. Set one with \`/wiki-spec <path>\` ` +
			`(a leading slash is wiki-root-relative), or run \`/wiki-init\` to scaffold an ` +
			`empty spec at the default location (\`/SPEC.md\`).`
		);
	}

	if (!input.specExists) {
		return (
			`${header}\n\n` +
			`The wiki is not yet initialised — there is no spec file at \`${input.specAbsPath}\`. ` +
			`Run \`/wiki-init\` to scaffold the wiki-root and create an empty spec, ` +
			`then open the spec and describe this wiki's purpose (what it covers, the page ` +
			`types and conventions you want) before ingesting any sources. ` +
			`Point the spec elsewhere with \`/wiki-spec <path>\` if needed.`
		);
	}

	const contents = input.specContents ?? "";

	if (contents.trim().length === 0) {
		return (
			`${header}\n\n` +
			`The wiki spec exists at \`${input.specAbsPath}\` but is empty. Open it and describe ` +
			`this wiki's purpose, page types, and conventions before doing any other wiki work — ` +
			`that context is what disciplines you into maintaining *this* wiki rather than a ` +
			`generic one. Until it is filled in, ask the user what the wiki is for.`
		);
	}

	return `${header}\n\nThe following spec describes this specific wiki. Follow it in all wiki work:\n\n${contents}`;
}
