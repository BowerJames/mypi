/**
 * \`/wiki-init\` scaffolding for the llm-wiki extension.
 *
 * Creates the wiki-root directory and the OKF-reserved files (\`index.md\`,
 * \`log.md\`) plus the wiki-spec file — **empty** (0 bytes), with no seeded
 * content. Per the agreed design, \`/wiki-init\` owns only the *creation* of
 * the assets; their contents are left for the user/agent to fill in (the
 * spec carries the per-wiki purpose, and \`index.md\`/\`log.md\` are populated
 * by the operating model during ingest).
 *
 * Idempotent: a second run reports every asset as \`existed\` and creates
 * nothing. Uses \`flag: "wx"\` so an existing file is never overwritten and
 * the existence check is atomic.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Result of {@link bootstrapWiki}: which assets were created vs already present. */
export interface BootstrapResult {
	/** Absolute paths of assets that were created (did not previously exist). */
	created: string[];
	/** Absolute paths of assets that already existed (left untouched). */
	existed: string[];
}

/**
 * Scaffold an OKF wiki: create the wiki-root, then empty \`index.md\`,
 * \`log.md\`, and the wiki-spec file.
 *
 * @param wikiRootAbs  Absolute wiki-root directory (created if missing).
 * @param specAbsPath  Absolute wiki-spec file path (parent dirs created).
 * @returns            \`{ created, existed }\` lists of absolute paths.
 */
export function bootstrapWiki(wikiRootAbs: string, specAbsPath: string): BootstrapResult {
	const created: string[] = [];
	const existed: string[] = [];

	// Ensure the wiki-root exists (mkdir -p; never an error if already present).
	mkdirSync(wikiRootAbs, { recursive: true });

	// The reserved OKF files live at the wiki-root; the spec can be nested
	// anywhere (its parent may differ from the wiki-root).
	const targets = [resolve(wikiRootAbs, "index.md"), resolve(wikiRootAbs, "log.md"), specAbsPath];

	for (const target of targets) {
		// Create parent dirs for the spec if it lives in a nested path.
		mkdirSync(dirname(target), { recursive: true });

		try {
			// flag "wx" fails (EEXIST) if the file exists — atomic existence check.
			writeFileSync(target, "", { flag: "wx" });
			created.push(target);
		} catch (err) {
			const code = (err as NodeJS.ErrnoException).code;
			if (code === "EEXIST") {
				existed.push(target);
				continue;
			}
			throw err;
		}
	}

	return { created, existed };
}
