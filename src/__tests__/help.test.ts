import { describe, expect, it } from "vitest";
import { hasHelpFlag } from "../help.js";

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
