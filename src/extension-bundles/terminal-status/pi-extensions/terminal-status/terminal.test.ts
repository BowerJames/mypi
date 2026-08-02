import { describe, expect, it } from "vitest";
import { updateTerminal } from "./terminal.js";

describe("updateTerminal", () => {
	it("returns the wezterm set-tab-title command for WezTerm working", () => {
		expect(updateTerminal("WezTerm", "working")).toEqual({
			command: "wezterm",
			args: ["cli", "set-tab-title", "working"],
		});
	});

	it("returns the wezterm set-tab-title command for WezTerm idle", () => {
		expect(updateTerminal("WezTerm", "idle")).toEqual({
			command: "wezterm",
			args: ["cli", "set-tab-title", "idle"],
		});
	});

	it("returns undefined for an unsupported terminal program", () => {
		// Other terminals are not (yet) supported — silent no-op.
		expect(updateTerminal("Apple_Terminal", "idle")).toBeUndefined();
		expect(updateTerminal("iTerm.app", "working")).toBeUndefined();
		expect(updateTerminal("ghostty", "idle")).toBeUndefined();
	});

	it("returns undefined when TERM_PROGRAM is unset", () => {
		expect(updateTerminal(undefined, "working")).toBeUndefined();
		expect(updateTerminal(undefined, "idle")).toBeUndefined();
	});
});
