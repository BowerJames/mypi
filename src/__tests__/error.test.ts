import { describe, expect, it } from "vitest";
import { throwError } from "../error.js";

describe("throwError", () => {
	it("throws an Error with the given message", () => {
		expect(() => throwError("boom")).toThrow("boom");
		expect(() => throwError("boom")).toThrow(Error);
	});
});
