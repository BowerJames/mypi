import { describe, expect, it } from "vitest";
import { updateTerminal } from "./terminal.js";

describe("updateTerminal", () => {
	it("emits the OSC 1 tab-title sequence for 'working'", () => {
		expect(updateTerminal("working")).toBe("\x1b]1;working\x07");
	});

	it("emits the OSC 1 tab-title sequence for 'idle'", () => {
		expect(updateTerminal("idle")).toBe("\x1b]1;idle\x07");
	});

	it("always produces a BEL-terminated OSC 1 sequence embedding the state", () => {
		for (const state of ["working", "idle"] as const) {
			const seq = updateTerminal(state);
			expect(seq.startsWith("\x1b]1;")).toBe(true);
			expect(seq.endsWith("\x07")).toBe(true);
			expect(seq).toContain(state);
		}
	});
});
