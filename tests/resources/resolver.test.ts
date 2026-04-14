import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  discoverExtensions,
  discoverSkills,
  discoverPrompts,
  resolveResources,
} from "../../src/resources/resolver.js";

describe("discoverExtensions", () => {
  test("discovers .ts files from bundled extensions", async () => {
    const extensions = await discoverExtensions();
    const names = extensions.map((e) => e.name);
    expect(names).toContain("mode");
    // All paths should be absolute and point to existing files/dirs
    for (const ext of extensions) {
      expect(ext.path).toContain("extensions");
      expect(ext.name).not.toContain(".ts");
    }
  });
});

describe("discoverSkills", () => {
  test("discovers directories with SKILL.md from bundled skills", async () => {
    const skills = await discoverSkills();
    const names = skills.map((s) => s.name);
    expect(names).toContain("deployments");
    // All paths should be absolute and contain the skills dir
    for (const skill of skills) {
      expect(skill.path).toContain("skills");
    }
  });
});

describe("discoverPrompts", () => {
  test("discovers .md files from bundled prompts", async () => {
    const prompts = await discoverPrompts();
    const names = prompts.map((p) => p.name);
    expect(names).toContain("overview");
    expect(names).toContain("review");
    // All paths should be absolute and contain the prompts dir
    for (const prompt of prompts) {
      expect(prompt.path).toContain("prompts");
      expect(prompt.name).not.toContain(".md");
    }
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

  test("resolves existing resources and reports no stale ones", async () => {
    const result = await resolveResources(
      ["mode"],
      ["deployments"],
      ["overview"],
    );

    expect(result.extensions).toHaveLength(1);
    expect(result.extensions[0]).toContain("extensions");
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]).toContain("deployments");
    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]).toContain("overview");
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
    expect(result.stale[0]).toEqual({
      type: "extension",
      name: "nonexistent-ext",
    });
    expect(result.stale[1]).toEqual({
      type: "skill",
      name: "nonexistent-skill",
    });
    expect(result.stale[2]).toEqual({
      type: "prompt",
      name: "nonexistent-prompt",
    });
  });

  test("handles undefined arrays gracefully", async () => {
    const result = await resolveResources(undefined, undefined, undefined);
    expect(result.extensions).toHaveLength(0);
    expect(result.skills).toHaveLength(0);
    expect(result.prompts).toHaveLength(0);
    expect(result.stale).toHaveLength(0);
  });

  test("mixed valid and stale resources", async () => {
    const result = await resolveResources(["mode", "fake-ext"], [], []);

    expect(result.extensions).toHaveLength(1);
    expect(result.extensions[0]).toContain("extensions");
    expect(result.stale).toHaveLength(1);
    expect(result.stale[0]).toEqual({ type: "extension", name: "fake-ext" });
  });

  test("resolves multiple resources of each type", async () => {
    const result = await resolveResources(
      ["mode"],
      ["deployments"],
      ["overview", "review"],
    );

    expect(result.extensions).toHaveLength(1);
    expect(result.skills).toHaveLength(1);
    expect(result.prompts).toHaveLength(2);
    expect(result.stale).toHaveLength(0);
  });
});
