import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  initConfig,
  loadConfig,
  writeConfig,
} from "../../src/config/loader.js";
import type { MypiConfig } from "../../src/config/schema.js";

describe("loadConfig", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mypi-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("errors when no mypi.yaml exists", async () => {
    const { config, errors } = await loadConfig(tempDir);
    expect(config).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("No mypi.yaml found");
  });

  test("loads a valid config", async () => {
    const content = `
default: assistant
profiles:
  assistant:
    cmd: "pi"
    extensions:
      - mode
`;
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(tempDir, "mypi.yaml"), content);

    const { config, errors } = await loadConfig(tempDir);
    expect(errors).toHaveLength(0);
    expect(config).not.toBeNull();
    expect(config?.default).toBe("assistant");
    expect(config?.profiles.assistant.cmd).toBe("pi");
    expect(config?.profiles.assistant.extensions).toEqual(["mode"]);
  });

  test("errors on invalid YAML", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(tempDir, "mypi.yaml"), ": invalid: yaml: [");

    const { config, errors } = await loadConfig(tempDir);
    expect(config).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Failed to parse");
  });

  test("errors on invalid config structure", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(tempDir, "mypi.yaml"), "default: test\nprofiles: []");

    const { config, errors } = await loadConfig(tempDir);
    expect(config).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("initConfig", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mypi-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("creates mypi.yaml in cwd", async () => {
    const filePath = await initConfig(tempDir);
    expect(filePath).toContain("mypi.yaml");

    const content = await readFile(filePath, "utf-8");
    expect(content).toContain("default: assistant");
    expect(content).toContain("profiles:");
  });

  test("throws when mypi.yaml already exists", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(tempDir, "mypi.yaml"), "existing");

    await expect(initConfig(tempDir)).rejects.toThrow("already exists");
  });

  test("overwrites with --force", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(tempDir, "mypi.yaml"), "existing");

    const filePath = await initConfig(tempDir, true);
    const content = await readFile(filePath, "utf-8");
    expect(content).toContain("default: assistant");
  });
});

describe("writeConfig", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mypi-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("writes a valid config", async () => {
    const config: MypiConfig = {
      default: "test",
      profiles: {
        test: {
          cmd: "pi -p",
          extensions: ["mode"],
          skills: [],
          prompts: ["review"],
        },
      },
    };

    const filePath = await writeConfig(tempDir, config);
    const content = await readFile(filePath, "utf-8");
    expect(content).toContain("default: test");
    expect(content).toContain("cmd: pi -p");

    // Verify it round-trips through loadConfig
    const { config: loaded } = await loadConfig(tempDir);
    expect(loaded).not.toBeNull();
    expect(loaded?.default).toBe("test");
    expect(loaded?.profiles.test.cmd).toBe("pi -p");
    expect(loaded?.profiles.test.extensions).toEqual(["mode"]);
    expect(loaded?.profiles.test.prompts).toEqual(["review"]);
  });

  test("omits empty arrays from output", async () => {
    const config: MypiConfig = {
      default: "minimal",
      profiles: {
        minimal: {
          cmd: "pi",
          extensions: [],
          skills: [],
          prompts: [],
        },
      },
    };

    const filePath = await writeConfig(tempDir, config);
    const content = await readFile(filePath, "utf-8");
    expect(content).not.toContain("extensions:");
    expect(content).not.toContain("skills:");
    expect(content).not.toContain("prompts:");
  });
});
