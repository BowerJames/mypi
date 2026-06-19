import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import yaml from "js-yaml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG_YAML, writeDefaultConfig } from "../init.js";

describe("writeDefaultConfig", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = resolve(tmpdir(), `mypi-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("creates mypi-config.yaml in the target directory", () => {
		writeDefaultConfig(testDir);
		expect(existsSync(resolve(testDir, "mypi-config.yaml"))).toBe(true);
	});

	it("writes valid YAML with the expected structure", () => {
		writeDefaultConfig(testDir);
		const raw = readFileSync(resolve(testDir, "mypi-config.yaml"), "utf-8");
		const config = yaml.load(raw) as Record<string, unknown>;

		expect(config.default).toBe("default");
		expect(config.profiles).toEqual({
			default: { cmd: "pi" },
		});
	});

	it("writes the exact expected content", () => {
		writeDefaultConfig(testDir);
		const raw = readFileSync(resolve(testDir, "mypi-config.yaml"), "utf-8");
		expect(raw).toBe(DEFAULT_CONFIG_YAML);
	});

	it("throws if mypi-config.yaml already exists", () => {
		writeDefaultConfig(testDir);
		expect(() => writeDefaultConfig(testDir)).toThrow("mypi-config.yaml already exists.");
	});

	it("does not overwrite an existing file", () => {
		writeDefaultConfig(testDir);
		const original = readFileSync(resolve(testDir, "mypi-config.yaml"), "utf-8");
		try {
			writeDefaultConfig(testDir);
		} catch {
			// expected
		}
		const after = readFileSync(resolve(testDir, "mypi-config.yaml"), "utf-8");
		expect(after).toBe(original);
	});
});
