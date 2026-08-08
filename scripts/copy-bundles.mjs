#!/usr/bin/env node
/**
 * Copy bundle payload dirs verbatim from `src/extension-bundles/<name>/` into
 * `dist/extension-bundles/<name>/`.
 *
 * Payload dirs (`pi-extensions/`, `prompts/`) are raw `.ts`/`.md` that pi
 * loads via its own loader — they are excluded from `tsc` (see
 * `tsconfig.build.json`) and so must be copied alongside the compiled
 * `index.js` manifest that `tsc` emits. The manifest `index.ts` itself is
 * NOT copied (tsc compiles it to `index.js`). Skills are NOT payload dirs:
 * they are `.ts` modules defined in code and imported by the manifest, so
 * `tsc` compiles them directly (no raw copy).
 *
 * Run as the second step of `npm run build`, after `tsc`. Idempotent.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");

const SRC = resolve(ROOT, "src", "extension-bundles");
const DIST = resolve(ROOT, "dist", "extension-bundles");

const PAYLOAD_DIRS = ["pi-extensions", "prompts"];

function copyBundles() {
	if (!existsSync(SRC)) {
		process.stderr.write(`copy-bundles: source dir not found: ${SRC}\n`);
		process.exit(1);
	}

	// Start clean per-payload so removed/renamed payloads don't linger — but
	// never touch the tsc-emitted index.js / index.d.ts manifests in each
	// bundle dir, which live alongside the payloads.
	let copied = 0;

	for (const entry of readdirSync(SRC, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;

		const bundleSrc = join(SRC, entry.name);
		const bundleDist = join(DIST, entry.name);

		for (const payload of PAYLOAD_DIRS) {
			const payloadSrc = join(bundleSrc, payload);
			if (!existsSync(payloadSrc)) continue;

			const payloadDist = join(bundleDist, payload);
			if (existsSync(payloadDist)) rmSync(payloadDist, { recursive: true, force: true });

			mkdirSync(bundleDist, { recursive: true });
			cpSync(payloadSrc, payloadDist, { recursive: true });
			copied++;
		}
	}

	process.stdout.write(
		`copy-bundles: copied ${copied} payload dir(s) into dist/extension-bundles\n`,
	);
}

copyBundles();
