import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..", "..");
const DIST_DIR = resolve(PROJECT_ROOT, "dist");

const distExists = existsSync(DIST_DIR);

describe("bundled resource discovery", () => {
  test.skipIf(!distExists)("dist/index.js exists", () => {
    expect(existsSync(resolve(DIST_DIR, "index.js"))).toBe(true);
  });

  test.skipIf(!distExists)("resource directories are copied into dist/", () => {
    expect(existsSync(resolve(DIST_DIR, "extensions"))).toBe(true);
    expect(existsSync(resolve(DIST_DIR, "skills"))).toBe(true);
    expect(existsSync(resolve(DIST_DIR, "prompts"))).toBe(true);
  });

  test.skipIf(!distExists)("dist contains expected extension resources", () => {
    const extDir = resolve(DIST_DIR, "extensions");
    const entries = readdirSync(extDir);
    expect(entries).toContain("mode");

    const modePath = resolve(extDir, "mode");
    expect(statSync(modePath).isDirectory()).toBe(true);
    expect(existsSync(resolve(modePath, "index.ts"))).toBe(true);
  });

  test.skipIf(!distExists)("dist contains expected skill resources", () => {
    const skillsDir = resolve(DIST_DIR, "skills");
    const entries = readdirSync(skillsDir);
    expect(entries).toContain("deployments");

    const deploymentsPath = resolve(skillsDir, "deployments");
    expect(statSync(deploymentsPath).isDirectory()).toBe(true);
    expect(existsSync(resolve(deploymentsPath, "SKILL.md"))).toBe(true);
  });

  test.skipIf(!distExists)("dist contains expected prompt resources", () => {
    const promptsDir = resolve(DIST_DIR, "prompts");
    const entries = readdirSync(promptsDir);
    expect(entries).toContain("overview.md");
    expect(entries).toContain("review.md");
  });
});
