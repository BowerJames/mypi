import { defineConfig } from "vitest/config";

/**
 * Vitest configuration.
 *
 * Excludes `dist/` — `scripts/copy-bundles.mjs` copies bundle payload dirs
 * (including their `*.test.ts`) into `dist/extension-bundles/`, so without an
 * explicit exclude vitest discovers and runs those copied copies as well as
 * the source originals.
 */
export default defineConfig({
	test: {
		exclude: ["**/node_modules/**", "**/dist/**"],
	},
});
