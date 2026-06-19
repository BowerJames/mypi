import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigError, loadConfig, saveConfig, validateConfig } from "../config.js";
import type { Config } from "../types.js";

describe("validateConfig", () => {
	it("accepts a minimal valid config", () => {
		const raw = { default: "default", profiles: { default: { cmd: "pi" } } };
		const config = validateConfig(raw);
		expect(config.default).toBe("default");
		expect(config.profiles.default.cmd).toBe("pi");
	});

	it("accepts a config with all fields", () => {
		const raw = {
			default: "fullstack",
			profiles: {
				fullstack: {
					cmd: "pi --model claude",
					extensions: ["mode"],
					skills: [],
					prompts: ["code-review"],
				},
			},
		};
		const config = validateConfig(raw);
		expect(config.default).toBe("fullstack");
		expect(config.profiles.fullstack.extensions).toEqual(["mode"]);
	});

	it("throws on null input", () => {
		expect(() => validateConfig(null)).toThrow(ConfigError);
	});

	it("throws on non-object input", () => {
		expect(() => validateConfig("string")).toThrow(ConfigError);
		expect(() => validateConfig(42)).toThrow(ConfigError);
	});

	it("throws on array input", () => {
		expect(() => validateConfig([])).toThrow(ConfigError);
	});

	it("throws when default is missing", () => {
		expect(() => validateConfig({ profiles: { a: { cmd: "pi" } } })).toThrow(ConfigError);
	});

	it("throws when default is not a string", () => {
		expect(() => validateConfig({ default: 123, profiles: { a: { cmd: "pi" } } })).toThrow(
			ConfigError,
		);
	});

	it("throws when default does not reference an existing profile", () => {
		expect(() => validateConfig({ default: "missing", profiles: { a: { cmd: "pi" } } })).toThrow(
			ConfigError,
		);
	});

	it("throws when profiles is missing", () => {
		expect(() => validateConfig({ default: "a" })).toThrow(ConfigError);
	});

	it("throws when profiles is not an object", () => {
		expect(() => validateConfig({ default: "a", profiles: [] })).toThrow(ConfigError);
	});

	it("throws when profiles is empty", () => {
		expect(() => validateConfig({ default: "a", profiles: {} })).toThrow(ConfigError);
	});

	it("throws when a profile is not an object", () => {
		expect(() => validateConfig({ default: "a", profiles: { a: "not-an-object" } })).toThrow(
			ConfigError,
		);
	});

	it("throws when a profile has no cmd", () => {
		expect(() => validateConfig({ default: "a", profiles: { a: {} } })).toThrow(ConfigError);
	});

	it("throws when a profile cmd is empty string", () => {
		expect(() => validateConfig({ default: "a", profiles: { a: { cmd: "" } } })).toThrow(
			ConfigError,
		);
	});

	it("throws when a profile cmd is not a string", () => {
		expect(() => validateConfig({ default: "a", profiles: { a: { cmd: 123 } } })).toThrow(
			ConfigError,
		);
	});

	it("throws when extensions is not an array of strings", () => {
		expect(() =>
			validateConfig({ default: "a", profiles: { a: { cmd: "pi", extensions: "mode" } } }),
		).toThrow(ConfigError);

		expect(() =>
			validateConfig({ default: "a", profiles: { a: { cmd: "pi", extensions: [123] } } }),
		).toThrow(ConfigError);
	});

	it("throws when skills is not an array of strings", () => {
		expect(() =>
			validateConfig({ default: "a", profiles: { a: { cmd: "pi", skills: [true] } } }),
		).toThrow(ConfigError);
	});

	it("throws when prompts is not an array of strings", () => {
		expect(() =>
			validateConfig({ default: "a", profiles: { a: { cmd: "pi", prompts: [1, 2] } } }),
		).toThrow(ConfigError);
	});

	it("omits optional arrays from profiles when not present", () => {
		const config = validateConfig({ default: "a", profiles: { a: { cmd: "pi" } } });
		expect(config.profiles.a.extensions).toBeUndefined();
		expect(config.profiles.a.skills).toBeUndefined();
		expect(config.profiles.a.prompts).toBeUndefined();
	});
});

describe("loadConfig / saveConfig", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = resolve(
			tmpdir(),
			`mypi-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("loads a valid config file", () => {
		writeFileSync(
			resolve(testDir, "mypi-config.yaml"),
			"default: my-profile\nprofiles:\n  my-profile:\n    cmd: pi\n",
		);
		const config = loadConfig(testDir);
		expect(config.default).toBe("my-profile");
		expect(config.profiles["my-profile"].cmd).toBe("pi");
	});

	it("throws ConfigError when file not found", () => {
		try {
			loadConfig(testDir);
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ConfigError);
			expect((err as ConfigError).message).toContain("not found");
			expect((err as ConfigError).message).toContain("mypi init");
		}
	});

	it("throws ConfigError for invalid YAML", () => {
		writeFileSync(resolve(testDir, "mypi-config.yaml"), ":\n  invalid: [yaml");
		try {
			loadConfig(testDir);
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ConfigError);
			expect((err as ConfigError).message).toContain("Invalid YAML");
		}
	});

	it("throws ConfigError when default is missing", () => {
		writeFileSync(resolve(testDir, "mypi-config.yaml"), "profiles:\n  test:\n    cmd: pi\n");
		try {
			loadConfig(testDir);
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ConfigError);
			expect((err as ConfigError).message).toContain("default");
		}
	});

	it("throws ConfigError when profiles is empty", () => {
		writeFileSync(resolve(testDir, "mypi-config.yaml"), "default: test\nprofiles: {}\n");
		try {
			loadConfig(testDir);
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ConfigError);
			expect((err as ConfigError).message).toContain("No profiles defined");
		}
	});

	it("throws ConfigError when profile has no cmd", () => {
		writeFileSync(
			resolve(testDir, "mypi-config.yaml"),
			"default: test\nprofiles:\n  test:\n    extensions:\n      - mode\n",
		);
		try {
			loadConfig(testDir);
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ConfigError);
			expect((err as ConfigError).message).toContain("cmd");
		}
	});

	it("throws ConfigError when extensions contains non-string", () => {
		writeFileSync(
			resolve(testDir, "mypi-config.yaml"),
			"default: test\nprofiles:\n  test:\n    cmd: pi\n    extensions:\n      - 123\n",
		);
		try {
			loadConfig(testDir);
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ConfigError);
			expect((err as ConfigError).message).toContain("extensions");
		}
	});

	it("save and load round-trip preserves config", () => {
		const config: Config = {
			default: "dev",
			profiles: {
				dev: {
					cmd: "pi --model claude",
					extensions: ["mode"],
					prompts: ["code-review"],
				},
			},
		};
		saveConfig(testDir, config);

		const loaded = loadConfig(testDir);
		expect(loaded.default).toBe("dev");
		expect(Object.keys(loaded.profiles)).toEqual(["dev"]);
		expect(loaded.profiles.dev.cmd).toBe("pi --model claude");
		expect(loaded.profiles.dev.extensions).toEqual(["mode"]);
		expect(loaded.profiles.dev.prompts).toEqual(["code-review"]);
	});
});
