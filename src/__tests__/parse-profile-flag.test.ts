import { describe, expect, it } from "vitest";
import { parseProfileFlag } from "../cli.js";

describe("parseProfileFlag", () => {
	it("parses --profile <name> (space-separated)", () => {
		const result = parseProfileFlag(["--profile", "fullstack", "do something"]);
		expect(result).toEqual({
			profileName: "fullstack",
			args: ["do something"],
		});
	});

	it("parses --profile=<name> (equals syntax)", () => {
		const result = parseProfileFlag(["--profile=fullstack", "do something"]);
		expect(result).toEqual({
			profileName: "fullstack",
			args: ["do something"],
		});
	});

	it("returns NO_PROFILE error when --profile is not present", () => {
		const result = parseProfileFlag(["do", "something"]);
		expect(result).toEqual({ error: "NO_PROFILE" });
	});

	it("returns NO_PROFILE error for empty args", () => {
		const result = parseProfileFlag([]);
		expect(result).toEqual({ error: "NO_PROFILE" });
	});

	it("errors when --profile has no value (space-separated, at end)", () => {
		const result = parseProfileFlag(["--profile"]);
		expect(result).toEqual({ error: "Error: --profile requires a value." });
	});

	it("errors when --profile= has no value (empty equals)", () => {
		const result = parseProfileFlag(["--profile="]);
		expect(result).toEqual({ error: "Error: --profile= requires a value." });
	});

	it("last --profile wins when multiple are provided", () => {
		const result = parseProfileFlag(["--profile", "first", "--profile=second", "extra"]);
		expect(result).toEqual({
			profileName: "second",
			args: ["extra"],
		});
	});

	it("removes all --profile flags from args even when duplicated", () => {
		const result = parseProfileFlag(["--profile", "a", "--some-flag", "--profile=b", "remaining"]);
		expect(result).toEqual({
			profileName: "b",
			args: ["--some-flag", "remaining"],
		});
	});

	it("preserves other flags and args", () => {
		const result = parseProfileFlag(["--verbose", "--profile", "dev", "--dry-run", "file.txt"]);
		expect(result).toEqual({
			profileName: "dev",
			args: ["--verbose", "--dry-run", "file.txt"],
		});
	});

	it("handles --profile not at the start", () => {
		const result = parseProfileFlag(["init", "--profile", "setup"]);
		expect(result).toEqual({
			profileName: "setup",
			args: ["init"],
		});
	});
});
