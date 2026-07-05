/**
 * System-prompt suffix builder for the llm-wiki extension.
 *
 * Each turn the extension appends a "## Wiki Manager" section to the system
 * prompt that (a) declares the agent maintains an OKF v0.1 bundle, (b) gives
 * the generic OKF format essentials, (c) describes the ingest/query/lint
 * operating model, and (d) injects the per-wiki purpose/conventions from the
 * `<wiki-spec>` file (Karpathy's "schema" layer) — supplying the runtime
 * context that makes this a *general* tool for any wiki.
 *
 * Pure & unit-testable — the extension does the filesystem read and passes in
 * whether the spec exists and its contents.
 */

/** Input for {@link buildWikiManagerPromptSuffix}. */
export interface WikiPromptInput {
	/** User-facing relative form of the wiki-root (e.g. `wiki` or a custom value). */
	wikiRootDisplay: string;
	/** Absolute path to the wiki-spec file (for error/guidance messages). */
	specAbsPath: string;
	/** Whether the wiki-spec file exists on disk. */
	specExists: boolean;
	/** Raw contents of the wiki-spec file when it exists (may be empty). */
	specContents: string | undefined;
}

/**
 * Build the system-prompt suffix to append each turn.
 *
 * Returns `undefined` when there is no effective wiki-root (the only case in
 * which the wiki-manager behaviour should not be engaged).
 */
export function buildWikiManagerPromptSuffix(input: WikiPromptInput): string | undefined {
	if (!input.wikiRootDisplay) return undefined;

	const okfSection = `### OKF format (v0.1)

The wiki is an [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) bundle — a directory tree of UTF-8 markdown files:

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
		`${okfSection}\n\n` +
		`${operatingModel}\n\n` +
		`${purposeSection}\n`
	);
}

/**
 * Build the "Wiki Purpose & Conventions" section from the wiki-spec file.
 *
 * Three branches:
 * - **missing** → tell the agent the wiki is uninitialised and how to bootstrap.
 * - **empty** (0 bytes) → tell the agent the spec exists but is unpopulated; it
 *   must be filled in before any wiki work is meaningful.
 * - **populated** → inject the spec contents verbatim.
 */
function buildPurposeSection(input: WikiPromptInput): string {
	const header = "### Wiki Purpose & Conventions";

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
