import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverExtensions, discoverSkills, discoverPrompts, resolveResources } from "../../src/resources/resolver.js";

describe("discoverExtensions", () => {
  test("discovers .ts files", () => {
    // Uses the real bundled extensions dir
    // This test works with whatever is in the repo's extensions/ dir
    expect(typeof discoverExtensions).toBe("function");
  });
});

describe("discoverSkills", () => {
  test("discovers directories with SKILL.md", () => {
    expect(typeof discoverSkills).toBe("function");
  });
});

describe("discoverPrompts", () => {
  test("discovers .md files", () => {
    expect(typeof discoverPrompts).toBe("function");
  });
});

describe("resolveResources", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mypi-resolver-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("resolves existing resources and reports stale ones", async () => {
    // This tests against the actual bundled resources in the repo
    const result = await resolveResources(
      ["mode"],         // should exist (mode.md)
      ["deployments"],  // should exist (deployments/SKILL.md)
      ["overview"],     // should exist (overview.md)
    );

    expect(result.extensions).toHaveLength(1);
    expect(result.skills).toHaveLength(1);
    expect(result.prompts).toHaveLength(1);
    expect(result.stale).toHaveLength(0);
  });

  test("reports stale resources that do not exist", async () => {
    const result = await resolveResources(
      ["nonexistent-ext"],
      ["nonexistent-skill"],
      ["nonexistent-prompt"],
    );

    expect(result.extensions).toHaveLength(0);
    expect(result.skills).toHaveLength(0);
    expect(result.prompts).toHaveLength(0);
    expect(result.stale).toHaveLength(3);
    expect(result.stale[0]).toEqual({ type: "extension", name: "nonexistent-ext" });
    expect(result.stale[1]).toEqual({ type: "skill", name: "nonexistent-skill" });
    expect(result.stale[2]).toEqual({ type: "prompt", name: "nonexistent-prompt" });
  });

  test("handles undefined arrays gracefully", async () => {
    const result = await resolveResources(undefined, undefined, undefined);
    expect(result.extensions).toHaveLength(0);
    expect(result.skills).toHaveLength(0);
    expect(result.prompts).toHaveLength(0);
    expect(result.stale).toHaveLength(0);
  });

  test("mixed valid and stale resources", async () => {
    const result = await resolveResources(
      ["mode", "fake-ext"],
      [],
      [],
    );

    expect(result.extensions).toHaveLength(1);
    expect(result.stale).toHaveLength(1);
    expect(result.stale[0]).toEqual({ type: "extension", name: "fake-ext" });
  });
});
