/**
 * LLM Wiki Extension
 *
 * Turns the agent into a wiki manager for an [Open Knowledge Format][okf] wiki,
 * following [Karpathy's LLM-wiki pattern][gist]. Two configurable values:
 *
 * - `wiki-root` — the OKF bundle root (default `wiki`, project-relative).
 * - `wiki-spec` — a per-wiki purpose/conventions doc (default `/SPEC.md`,
 *   wiki-root-relative per OKF §5.1). **Auto-injected**: read each turn and
 *   appended to the system prompt so the agent always knows *which* wiki it
 *   is managing.
 *
 * The agent maintains the wiki with its built-in tools (`read`/`write`/
 * `edit`/`bash`); this extension supplies only the operating context and the
 * bootstrap/config commands.
 *
 * Commands:
 *   /wiki-root [<path>]   — set the wiki-root (no arg = clear; re-defaults to `wiki`)
 *   /wiki-spec [<path>]   — set the wiki-spec path (no arg = clear; re-defaults to `/SPEC.md`)
 *   /wiki-init            — scaffold the wiki-root + empty index.md/log.md/<spec>
 *   /wiki-ingest          — inject the ingest workflow guidance (one-off)
 *   /wiki-query           — inject the query workflow guidance (one-off)
 *   /wiki-lint            — inject the lint workflow guidance (one-off)
 *
 * [okf]: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
 * [gist]: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
 */

import { readFileSync } from "node:fs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { bootstrapWiki } from "./bootstrap.js";
import { displayRoot, resolveWikiRoot, resolveWikiSpec } from "./paths.js";
import { buildWikiManagerPromptSuffix } from "./prompt.js";
import {
	planStartup,
	readState,
	shouldWrite,
	WIKI_ROOT_CUSTOM_TYPE,
	WIKI_SPEC_CUSTOM_TYPE,
} from "./state.js";

const INGEST_WORKFLOW_INSTRUCTIONS = `You are now performing a wiki **ingest**. Take the source the user has provided and integrate it into the wiki:

1. Read the source in full and discuss the key takeaways with the user.
2. Write (or update) a summary page for the source under the wiki-root, with OKF frontmatter (\`type\` required) and a \`# Citations\` section linking the source.
3. Update every entity/concept page the source touches — add new facts, revise stale ones, and explicitly note any contradictions with existing pages.
4. Append an entry to \`log.md\` under today's ISO date (\`## YYYY-MM-DD\`, newest first) describing what you ingested and changed.
5. Refresh \`index.md\` so it lists the new/updated pages with one-line descriptions.

Confirm the ingest path with the user before writing if the source is ambiguous.`;

const QUERY_WORKFLOW_INSTRUCTIONS = `You are now answering a **query** against the wiki:

1. Read \`index.md\` first to find candidate pages, then drill into them.
2. Synthesise the answer with citations (links to the wiki pages and, where relevant, their \`# Citations\` sources).
3. If the answer reveals a valuable comparison, analysis, or connection, **file it back into the wiki** as a new page (with frontmatter) and log it — explorations should compound, not vanish into chat.
4. If the wiki does not yet cover what is needed, say so clearly and suggest sources to ingest.`;

const LINT_WORKFLOW_INSTRUCTIONS = `You are now **linting** the wiki — health-check it without ingesting anything new:

1. Contradictions between pages (state both sides and which is better-sourced).
2. Stale claims that newer sources have superseded.
3. Orphan pages with no inbound links.
4. Important concepts mentioned in passing but lacking their own page.
5. Missing cross-references and broken links.
6. \`index.md\`/\`log.md\` out of sync with the actual pages.

Report findings as a prioritised list, then propose fixes (and the new questions/sources to investigate). Apply only low-risk fixes (typos, missing cross-links) immediately; flag anything substantive for the user.`;

/**
 * Resolve the effective wiki-spec to its absolute path + on-disk contents.
 *
 * `spec` is the configured value (or null). `fallback` supplies the value to
 * use when `spec` is null/empty — pass `/SPEC.md` for paths that need a
 * concrete target (e.g. `/wiki-init` creating the file), or `null` to signal
 * "no spec configured" (e.g. the prompt-injection path, which must honour an
 * explicit `/wiki-spec` clear rather than silently reading the default).
 *
 * When `spec` is null/empty AND `fallback` is null, `specAbsPath` is
 * `undefined`. Missing/empty file → `specExists` false, `specContents`
 * undefined. Never throws for a missing file.
 */
function resolveSpecOnDisk(
	cwd: string,
	wikiRootAbs: string,
	spec: string | null,
	fallback: string | null,
): { specAbsPath: string | undefined; specExists: boolean; specContents: string | undefined } {
	const specValue = spec && spec.length > 0 ? spec : fallback;
	if (specValue === null) {
		return { specAbsPath: undefined, specExists: false, specContents: undefined };
	}
	const specAbsPath = resolveWikiSpec(cwd, wikiRootAbs, specValue);
	try {
		const contents = readFileSync(specAbsPath, "utf-8");
		return { specAbsPath, specExists: true, specContents: contents };
	} catch {
		return { specAbsPath, specExists: false, specContents: undefined };
	}
}

export default function llmWikiExtension(pi: ExtensionAPI): void {
	let wikiRoot: string | null = null;
	let wikiSpec: string | null = null;

	function updateStatus(ctx: ExtensionContext): void {
		if (wikiRoot) {
			ctx.ui.setStatus("llm-wiki", ctx.ui.theme.fg("accent", `📚 wiki: ${displayRoot(wikiRoot)}`));
		} else {
			ctx.ui.setStatus("llm-wiki", undefined);
		}
	}

	// --- Commands ---

	pi.registerCommand("wiki-root", {
		description: "Set or clear the wiki-root directory (no arg clears; defaults to 'wiki')",
		handler: async (args, ctx) => {
			const value = args.trim();

			if (value) {
				wikiRoot = value;
				if (shouldWrite(ctx.sessionManager, WIKI_ROOT_CUSTOM_TYPE, value)) {
					pi.appendEntry(WIKI_ROOT_CUSTOM_TYPE, { value });
				}
				ctx.ui.notify(`Wiki root set to: ${value}`, "info");
			} else {
				wikiRoot = null;
				if (shouldWrite(ctx.sessionManager, WIKI_ROOT_CUSTOM_TYPE, null)) {
					pi.appendEntry(WIKI_ROOT_CUSTOM_TYPE, { value: null });
				}
				ctx.ui.notify("Wiki root cleared (will not auto-default)", "info");
			}

			updateStatus(ctx);
		},
	});

	pi.registerCommand("wiki-spec", {
		description: "Set or clear the wiki-spec path (no arg clears; defaults to '/SPEC.md')",
		handler: async (args, ctx) => {
			const value = args.trim();

			if (value) {
				wikiSpec = value;
				if (shouldWrite(ctx.sessionManager, WIKI_SPEC_CUSTOM_TYPE, value)) {
					pi.appendEntry(WIKI_SPEC_CUSTOM_TYPE, { value });
				}
				ctx.ui.notify(`Wiki spec set to: ${value}`, "info");
			} else {
				wikiSpec = null;
				if (shouldWrite(ctx.sessionManager, WIKI_SPEC_CUSTOM_TYPE, null)) {
					pi.appendEntry(WIKI_SPEC_CUSTOM_TYPE, { value: null });
				}
				ctx.ui.notify("Wiki spec cleared (will not auto-default)", "info");
			}
		},
	});

	pi.registerCommand("wiki-init", {
		description: "Scaffold the wiki-root and create empty index.md, log.md, and the wiki-spec",
		handler: async (_args, ctx) => {
			if (!wikiRoot) {
				ctx.ui.notify(
					"No wiki-root set. Use `/wiki-root <path>` first (a prior clear was sticky).",
					"warning",
				);
				return;
			}

			const rootValue = wikiRoot;
			const wikiRootAbs = resolveWikiRoot(ctx.cwd, rootValue);
			// /wiki-init needs a concrete spec path to create; fall back to the default
			// (unlike the prompt path, an explicit /wiki-spec clear is NOT honoured
			// here — init must have somewhere to write).
			const specValue = wikiSpec && wikiSpec.length > 0 ? wikiSpec : "/SPEC.md";
			const specAbsPath = resolveWikiSpec(ctx.cwd, wikiRootAbs, specValue);

			const result = bootstrapWiki(wikiRootAbs, specAbsPath);

			if (result.created.length > 0) {
				ctx.ui.notify(
					`Wiki initialised at ${rootValue}/ — created: ${result.created
						.map((p) => p.split("/").pop())
						.join(", ")}`,
					"info",
				);
			} else {
				ctx.ui.notify(`Wiki already initialised at ${rootValue}/ (all assets present)`, "info");
			}

			// Re-read the spec after bootstrap so the follow-up reflects its real
			// state (it may have pre-existed with content from a prior session).
			const after = resolveSpecOnDisk(ctx.cwd, wikiRootAbs, wikiSpec, "/SPEC.md");
			const specContents = after.specContents ?? "";
			const specEmpty = specContents.trim().length === 0;

			const content = specEmpty
				? `Wiki initialised at \`${rootValue}/\`. The spec at \`${specAbsPath}\` is empty. ` +
					`Open it and describe what this wiki is for — its purpose, the page types and ` +
					`conventions you want — before ingesting any sources. Then use \`/wiki-ingest\` to begin.`
				: `Wiki initialised at \`${rootValue}/\`. The spec at \`${specAbsPath}\` already has content — ` +
					`review it, then use \`/wiki-ingest\` to begin.`;

			pi.sendMessage({ customType: "wiki-init-context", content, display: true });
		},
	});

	pi.registerCommand("wiki-ingest", {
		description: "Inject the wiki ingest workflow guidance",
		handler: async (_args, _ctx) => {
			pi.sendMessage({
				customType: "wiki-ingest-context",
				content: INGEST_WORKFLOW_INSTRUCTIONS,
				display: true,
			});
		},
	});

	pi.registerCommand("wiki-query", {
		description: "Inject the wiki query workflow guidance",
		handler: async (_args, _ctx) => {
			pi.sendMessage({
				customType: "wiki-query-context",
				content: QUERY_WORKFLOW_INSTRUCTIONS,
				display: true,
			});
		},
	});

	pi.registerCommand("wiki-lint", {
		description: "Inject the wiki lint workflow guidance",
		handler: async (_args, _ctx) => {
			pi.sendMessage({
				customType: "wiki-lint-context",
				content: LINT_WORKFLOW_INSTRUCTIONS,
				display: true,
			});
		},
	});

	// --- Events ---

	// Append the Wiki Manager section to the system prompt each turn, with the
	// wiki-spec contents auto-injected.
	pi.on("before_agent_start", async (event, ctx) => {
		if (!wikiRoot) return; // cleared: do not engage wiki-manager behaviour

		const wikiRootAbs = resolveWikiRoot(ctx.cwd, wikiRoot);
		// No fallback: when wikiSpec is cleared (null), the prompt reports no spec
		// is configured rather than silently reading the default /SPEC.md.
		const { specAbsPath, specExists, specContents } = resolveSpecOnDisk(
			ctx.cwd,
			wikiRootAbs,
			wikiSpec,
			null,
		);

		const suffix = buildWikiManagerPromptSuffix({
			wikiRootDisplay: displayRoot(wikiRoot),
			specAbsPath,
			specExists,
			specContents,
		});

		if (!suffix) return;

		return { systemPrompt: event.systemPrompt + suffix };
	});

	// Restore (or auto-default) both config values on session start/resume.
	pi.on("session_start", async (_event, ctx) => {
		const rootState = readState(ctx.sessionManager, WIKI_ROOT_CUSTOM_TYPE);
		const rootPlan = planStartup(rootState, displayRoot(wikiRoot));
		wikiRoot = rootPlan.value;
		if (rootPlan.shouldWrite && rootPlan.value) {
			pi.appendEntry(WIKI_ROOT_CUSTOM_TYPE, { value: rootPlan.value });
		}

		// The spec defaults to "/SPEC.md" only when a wiki-root is effective;
		// with no root there is nothing for the spec to describe.
		const specState = readState(ctx.sessionManager, WIKI_SPEC_CUSTOM_TYPE);
		const specDefault = wikiRoot ? "/SPEC.md" : undefined;
		const specPlan = planStartup(specState, specDefault);
		wikiSpec = specPlan.value;
		if (specPlan.shouldWrite && specPlan.value) {
			pi.appendEntry(WIKI_SPEC_CUSTOM_TYPE, { value: specPlan.value });
		}

		updateStatus(ctx);
	});

	// Clear the indicator on shutdown.
	pi.on("session_shutdown", async (_event, ctx) => {
		ctx.ui.setStatus("llm-wiki", undefined);
	});
}
