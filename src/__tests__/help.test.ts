import { describe, expect, it } from "vitest";
import { hasHelpFlag, MAIN_HELP } from "../help.js";

describe("hasHelpFlag", () => {
	it("detects --help at the start", () => {
		expect(hasHelpFlag(["--help"])).toBe(true);
	});

	it("detects --help in the middle", () => {
		expect(hasHelpFlag(["--profile", "fullstack", "--help"])).toBe(true);
	});

	it("detects --help at the end", () => {
		expect(hasHelpFlag(["init", "--help"])).toBe(true);
	});

	it("detects -h at the start", () => {
		expect(hasHelpFlag(["-h"])).toBe(true);
	});

	it("detects -h in the middle", () => {
		expect(hasHelpFlag(["--profile", "fullstack", "-h"])).toBe(true);
	});

	it("detects -h at the end", () => {
		expect(hasHelpFlag(["configure", "-h"])).toBe(true);
	});

	it("returns false when no help flag is present", () => {
		expect(hasHelpFlag([])).toBe(false);
		expect(hasHelpFlag(["init"])).toBe(false);
		expect(hasHelpFlag(["--profile", "fullstack", "do something"])).toBe(false);
	});

	it("does not match partial strings like --helper", () => {
		expect(hasHelpFlag(["--helper"])).toBe(false);
		expect(hasHelpFlag(["-hidden"])).toBe(false);
	});
});

describe("MAIN_HELP (merged command surface)", () => {
	it("documents both --profile and --bundle", () => {
		expect(MAIN_HELP).toContain("--profile");
		expect(MAIN_HELP).toContain("--bundle");
	});

	it("does not advertise a retired `run` command", () => {
		// `run` is hard-removed; the COMMANDS list must not include it, and no
		// USAGE/example line should offer `mypi run`.
		expect(MAIN_HELP).not.toContain("Run pi with bundle expansion");
		expect(MAIN_HELP).not.toMatch(/mypi run\b/);
	});

	it("notes that mypi always runs pi", () => {
		expect(MAIN_HELP.toLowerCase()).toContain("always runs pi");
	});
});
