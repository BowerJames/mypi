import { describe, expect, test } from "bun:test";
import { formatErrors, validateConfig } from "../../src/config/loader.js";

describe("validateConfig", () => {
  test("validates a correct config", () => {
    const data = {
      default: "assistant",
      profiles: {
        assistant: {
          extensions: ["mode"],
          skills: ["deployments"],
          prompts: ["overview"],
          cmd: "pi",
        },
      },
    };

    const { config, errors } = validateConfig(data);
    expect(errors).toHaveLength(0);
    expect(config).not.toBeNull();
    expect(config?.default).toBe("assistant");
    expect(config?.profiles.assistant.cmd).toBe("pi");
    expect(config?.profiles.assistant.extensions).toEqual(["mode"]);
    expect(config?.profiles.assistant.skills).toEqual(["deployments"]);
    expect(config?.profiles.assistant.prompts).toEqual(["overview"]);
  });

  test("validates config with empty optional arrays", () => {
    const data = {
      default: "reviewer",
      profiles: {
        reviewer: {
          cmd: "pi -p",
        },
      },
    };

    const { config, errors } = validateConfig(data);
    expect(errors).toHaveLength(0);
    expect(config?.profiles.reviewer.extensions).toEqual([]);
    expect(config?.profiles.reviewer.skills).toEqual([]);
    expect(config?.profiles.reviewer.prompts).toEqual([]);
  });

  test("errors when config is not an object", () => {
    const { config, errors } = validateConfig("not an object");
    expect(config).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("must be an object");
  });

  test("errors when default is missing", () => {
    const { config, errors } = validateConfig({
      profiles: { assistant: { cmd: "pi" } },
    });
    expect(config).toBeNull();
    expect(errors.some((e) => e.path === "default")).toBe(true);
  });

  test("errors when default is empty string", () => {
    const { config, errors } = validateConfig({
      default: "",
      profiles: { assistant: { cmd: "pi" } },
    });
    expect(config).toBeNull();
    expect(errors.some((e) => e.path === "default")).toBe(true);
  });

  test("errors when profiles is missing", () => {
    const { config, errors } = validateConfig({ default: "assistant" });
    expect(config).toBeNull();
    expect(errors.some((e) => e.path === "profiles")).toBe(true);
  });

  test("errors when profiles is empty", () => {
    const { config, errors } = validateConfig({
      default: "assistant",
      profiles: {},
    });
    expect(config).toBeNull();
    expect(errors.some((e) => e.message.includes("at least one"))).toBe(true);
  });

  test("errors when default profile does not exist", () => {
    const { config, errors } = validateConfig({
      default: "nonexistent",
      profiles: { assistant: { cmd: "pi" } },
    });
    expect(config).toBeNull();
    expect(errors.some((e) => e.path === "default")).toBe(true);
  });

  test("errors when profile is missing cmd", () => {
    const { config, errors } = validateConfig({
      default: "assistant",
      profiles: { assistant: { extensions: ["mode"] } },
    });
    expect(config).toBeNull();
    expect(errors.some((e) => e.path.includes("cmd"))).toBe(true);
  });

  test("errors when profile cmd is empty", () => {
    const { config, errors } = validateConfig({
      default: "assistant",
      profiles: { assistant: { cmd: "" } },
    });
    expect(config).toBeNull();
    expect(errors.some((e) => e.path.includes("cmd"))).toBe(true);
  });

  test("errors when extensions is not an array", () => {
    const { config, errors } = validateConfig({
      default: "assistant",
      profiles: { assistant: { cmd: "pi", extensions: "mode" } },
    });
    expect(config).toBeNull();
    expect(errors.some((e) => e.path.includes("extensions"))).toBe(true);
  });

  test("errors when extensions contains non-strings", () => {
    const { config, errors } = validateConfig({
      default: "assistant",
      profiles: { assistant: { cmd: "pi", extensions: [1, 2] } },
    });
    expect(config).toBeNull();
    expect(errors.some((e) => e.path.includes("extensions"))).toBe(true);
  });

  test("errors when skills is not an array", () => {
    const { config, errors } = validateConfig({
      default: "assistant",
      profiles: { assistant: { cmd: "pi", skills: "bad" } },
    });
    expect(config).toBeNull();
    expect(errors.some((e) => e.path.includes("skills"))).toBe(true);
  });

  test("errors when prompts is not an array", () => {
    const { config, errors } = validateConfig({
      default: "assistant",
      profiles: { assistant: { cmd: "pi", prompts: "bad" } },
    });
    expect(config).toBeNull();
    expect(errors.some((e) => e.path.includes("prompts"))).toBe(true);
  });
});

describe("formatErrors", () => {
  test("formats errors with paths", () => {
    const errors = [
      { path: "default", message: "must be a string" },
      { path: "profiles.assistant.cmd", message: "is required" },
    ];
    const formatted = formatErrors(errors);
    expect(formatted).toContain("default: must be a string");
    expect(formatted).toContain("profiles.assistant.cmd: is required");
  });

  test("formats errors without paths", () => {
    const errors = [{ path: "", message: "Config must be an object" }];
    const formatted = formatErrors(errors);
    expect(formatted).toContain("Config must be an object");
  });
});
