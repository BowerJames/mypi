import { describe, expect, test } from "bun:test";
import {
  buildProfileCommand,
  filterPassthroughArgs,
} from "../../src/commands/run.js";
import type { ProfileConfig } from "../../src/commands/run.js";
import type { ResolveResult } from "../../src/resources/resolver.js";

describe("buildProfileCommand", () => {
  const emptyResolved: ResolveResult = {
    extensions: [],
    skills: [],
    prompts: [],
    stale: [],
  };

  test("builds command with just cmd", () => {
    const profile: ProfileConfig = { cmd: "pi" };
    const result = buildProfileCommand(profile, emptyResolved, []);
    expect(result).toEqual(["pi"]);
  });

  test("builds command with cmd flags", () => {
    const profile: ProfileConfig = { cmd: "pi -p" };
    const result = buildProfileCommand(profile, emptyResolved, []);
    expect(result).toEqual(["pi", "-p"]);
  });

  test("adds extension flags", () => {
    const profile: ProfileConfig = { cmd: "pi" };
    const resolved: ResolveResult = {
      extensions: ["/path/to/ext1.ts", "/path/to/ext2.ts"],
      skills: [],
      prompts: [],
      stale: [],
    };
    const result = buildProfileCommand(profile, resolved, []);
    expect(result).toEqual([
      "pi",
      "-e",
      "/path/to/ext1.ts",
      "-e",
      "/path/to/ext2.ts",
    ]);
  });

  test("adds skill flags", () => {
    const profile: ProfileConfig = { cmd: "pi" };
    const resolved: ResolveResult = {
      extensions: [],
      skills: ["/path/to/skill1"],
      prompts: [],
      stale: [],
    };
    const result = buildProfileCommand(profile, resolved, []);
    expect(result).toEqual(["pi", "--skill", "/path/to/skill1"]);
  });

  test("adds prompt template flags", () => {
    const profile: ProfileConfig = { cmd: "pi" };
    const resolved: ResolveResult = {
      extensions: [],
      skills: [],
      prompts: ["/path/to/review.md"],
      stale: [],
    };
    const result = buildProfileCommand(profile, resolved, []);
    expect(result).toEqual(["pi", "--prompt-template", "/path/to/review.md"]);
  });

  test("appends passthrough args", () => {
    const profile: ProfileConfig = { cmd: "pi" };
    const result = buildProfileCommand(profile, emptyResolved, [
      "do something",
      "@file.ts",
    ]);
    expect(result).toEqual(["pi", "do something", "@file.ts"]);
  });

  test("combines cmd flags, resources, and passthrough", () => {
    const profile: ProfileConfig = { cmd: "pi -p" };
    const resolved: ResolveResult = {
      extensions: ["/ext.ts"],
      skills: ["/skill"],
      prompts: ["/prompt.md"],
      stale: [],
    };
    const result = buildProfileCommand(profile, resolved, ["extra arg"]);
    expect(result).toEqual([
      "pi",
      "-p",
      "-e",
      "/ext.ts",
      "--skill",
      "/skill",
      "--prompt-template",
      "/prompt.md",
      "extra arg",
    ]);
  });
});

describe("filterPassthroughArgs", () => {
  test("passes through plain args", () => {
    expect(filterPassthroughArgs(["do", "something"])).toEqual([
      "do",
      "something",
    ]);
  });

  test("filters --profile with separate value", () => {
    expect(
      filterPassthroughArgs(["--profile", "reviewer", "do something"]),
    ).toEqual(["do something"]);
  });

  test("filters -p with separate value", () => {
    expect(filterPassthroughArgs(["-p", "reviewer", "do something"])).toEqual([
      "do something",
    ]);
  });

  test("filters --profile=value form", () => {
    expect(
      filterPassthroughArgs(["--profile=reviewer", "do something"]),
    ).toEqual(["do something"]);
  });

  test("filters -pvalue form", () => {
    expect(filterPassthroughArgs(["-previewer", "do something"])).toEqual([
      "do something",
    ]);
  });

  test("does not filter --prompt (double dash)", () => {
    expect(filterPassthroughArgs(["--prompt", "custom"])).toEqual([
      "--prompt",
      "custom",
    ]);
  });

  test("does not filter --print (double dash)", () => {
    expect(filterPassthroughArgs(["--print", "task"])).toEqual([
      "--print",
      "task",
    ]);
  });

  test("filters --help and -h", () => {
    expect(filterPassthroughArgs(["--help"])).toEqual([]);
    expect(filterPassthroughArgs(["-h"])).toEqual([]);
  });

  test("filters --version and -v", () => {
    expect(filterPassthroughArgs(["--version"])).toEqual([]);
    expect(filterPassthroughArgs(["-v"])).toEqual([]);
  });

  test("filters --profile but keeps other flags for pi", () => {
    expect(
      filterPassthroughArgs(["--profile", "assistant", "--verbose", "task"]),
    ).toEqual(["--verbose", "task"]);
  });

  test("handles empty args", () => {
    expect(filterPassthroughArgs([])).toEqual([]);
  });

  test("does not filter --skill (pi flag)", () => {
    expect(filterPassthroughArgs(["--skill", "my-skill"])).toEqual([
      "--skill",
      "my-skill",
    ]);
  });

  test("does not eat next arg when --profile is last arg", () => {
    expect(filterPassthroughArgs(["--profile"])).toEqual([]);
  });

  test("does not eat next arg when -p is last arg", () => {
    expect(filterPassthroughArgs(["-p"])).toEqual([]);
  });
});
