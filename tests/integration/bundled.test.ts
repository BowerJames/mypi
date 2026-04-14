import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..", "..");
const DIST_DIR = resolve(PROJECT_ROOT, "dist");

describe("bundled resource discovery", () => {
  test("dist/index.js exists", () => {
    expect(existsSync(resolve(DIST_DIR, "index.js"))).toBe(true);
  });

  test("resource directories are copied into dist/", () => {
    expect(existsSync(resolve(DIST_DIR, "extensions"))).toBe(true);
    expect(existsSync(resolve(DIST_DIR, "skills"))).toBe(true);
    expect(existsSync(resolve(DIST_DIR, "prompts"))).toBe(true);
  });

  test("dist contains expected extension resources", () => {
    const { readdirSync, statSync } = require("node:fs");
    const extDir = resolve(DIST_DIR, "extensions");
    const entries = readdirSync(extDir);
    expect(entries).toContain("mode");

    const modePath = resolve(extDir, "mode");
    expect(statSync(modePath).isDirectory()).toBe(true);
    expect(existsSync(resolve(modePath, "index.ts"))).toBe(true);
  });

  test("dist contains expected skill resources", () => {
    const { readdirSync, statSync } = require("node:fs");
    const skillsDir = resolve(DIST_DIR, "skills");
    const entries = readdirSync(skillsDir);
    expect(entries).toContain("deployments");

    const deploymentsPath = resolve(skillsDir, "deployments");
    expect(statSync(deploymentsPath).isDirectory()).toBe(true);
    expect(existsSync(resolve(deploymentsPath, "SKILL.md"))).toBe(true);
  });

  test("dist contains expected prompt resources", () => {
    const { readdirSync } = require("node:fs");
    const promptsDir = resolve(DIST_DIR, "prompts");
    const entries = readdirSync(promptsDir);
    expect(entries).toContain("overview.md");
    expect(entries).toContain("review.md");
  });
});
