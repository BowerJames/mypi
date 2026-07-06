import { describe, expect, it } from "vitest";
import {
	getValue,
	planStartup,
	readState,
	shouldWrite,
	WIKI_ROOT_CUSTOM_TYPE,
	WIKI_SPEC_CUSTOM_TYPE,
} from "./state.js";

function makeEntry(type: string, customType?: string, data?: Record<string, unknown>) {
	return { type, ...(customType ? { customType } : {}), ...(data ? { data } : {}) };
}

function makeSessionManager(entries: ReturnType<typeof makeEntry>[]) {
	return { getEntries: () => entries };
}

describe("readState", () => {
	it("returns unset when there are no entries", () => {
		expect(readState(makeSessionManager([]), WIKI_ROOT_CUSTOM_TYPE)).toEqual({ status: "unset" });
	});

	it("returns unset when no entry of the given custom type exists", () => {
		const entries = [makeEntry("message"), makeEntry("custom", "other", { value: "x" })];
		expect(readState(makeSessionManager(entries), WIKI_ROOT_CUSTOM_TYPE)).toEqual({
			status: "unset",
		});
	});

	it("returns set when the most recent entry holds a value", () => {
		const entries = [makeEntry("custom", WIKI_ROOT_CUSTOM_TYPE, { value: "wiki" })];
		expect(readState(makeSessionManager(entries), WIKI_ROOT_CUSTOM_TYPE)).toEqual({
			status: "set",
			value: "wiki",
		});
	});

	it("returns cleared when the most recent entry holds null", () => {
		const entries = [
			makeEntry("custom", WIKI_ROOT_CUSTOM_TYPE, { value: "wiki" }),
			makeEntry("custom", WIKI_ROOT_CUSTOM_TYPE, { value: null }),
		];
		expect(readState(makeSessionManager(entries), WIKI_ROOT_CUSTOM_TYPE)).toEqual({
			status: "cleared",
		});
	});

	it("returns cleared when the most recent entry holds an empty string", () => {
		const entries = [makeEntry("custom", WIKI_ROOT_CUSTOM_TYPE, { value: "" })];
		expect(readState(makeSessionManager(entries), WIKI_ROOT_CUSTOM_TYPE)).toEqual({
			status: "cleared",
		});
	});

	it("returns cleared when the most recent entry holds a non-string value", () => {
		const entries = [makeEntry("custom", WIKI_ROOT_CUSTOM_TYPE, { value: 123 })];
		expect(readState(makeSessionManager(entries), WIKI_ROOT_CUSTOM_TYPE)).toEqual({
			status: "cleared",
		});
	});

	it("last-wins: a later set overrides an earlier cleared", () => {
		const entries = [
			makeEntry("custom", WIKI_ROOT_CUSTOM_TYPE, { value: null }),
			makeEntry("custom", WIKI_ROOT_CUSTOM_TYPE, { value: "docs" }),
		];
		expect(readState(makeSessionManager(entries), WIKI_ROOT_CUSTOM_TYPE)).toEqual({
			status: "set",
			value: "docs",
		});
	});

	it("is independent per custom type (root vs spec)", () => {
		const entries = [
			makeEntry("custom", WIKI_ROOT_CUSTOM_TYPE, { value: "wiki" }),
			makeEntry("custom", WIKI_SPEC_CUSTOM_TYPE, { value: "/SPEC.md" }),
		];
		expect(readState(makeSessionManager(entries), WIKI_ROOT_CUSTOM_TYPE)).toEqual({
			status: "set",
			value: "wiki",
		});
		expect(readState(makeSessionManager(entries), WIKI_SPEC_CUSTOM_TYPE)).toEqual({
			status: "set",
			value: "/SPEC.md",
		});
	});

	it("ignores other custom entries when scanning", () => {
		const entries = [
			makeEntry("custom", "mode", { mode: "plan" }),
			makeEntry("custom", WIKI_ROOT_CUSTOM_TYPE, { value: "docs" }),
			makeEntry("custom", "mode", { mode: "develop" }),
		];
		expect(readState(makeSessionManager(entries), WIKI_ROOT_CUSTOM_TYPE)).toEqual({
			status: "set",
			value: "docs",
		});
	});
});

describe("getValue", () => {
	it("returns the value when set", () => {
		const sm = makeSessionManager([makeEntry("custom", WIKI_SPEC_CUSTOM_TYPE, { value: "/x.md" })]);
		expect(getValue(sm, WIKI_SPEC_CUSTOM_TYPE)).toBe("/x.md");
	});

	it("returns undefined when cleared", () => {
		const sm = makeSessionManager([makeEntry("custom", WIKI_SPEC_CUSTOM_TYPE, { value: null })]);
		expect(getValue(sm, WIKI_SPEC_CUSTOM_TYPE)).toBeUndefined();
	});

	it("returns undefined when unset", () => {
		expect(getValue(makeSessionManager([]), WIKI_SPEC_CUSTOM_TYPE)).toBeUndefined();
	});
});

describe("shouldWrite", () => {
	it("returns true when there is no entry (set)", () => {
		expect(shouldWrite(makeSessionManager([]), WIKI_ROOT_CUSTOM_TYPE, "wiki")).toBe(true);
	});

	it("returns true when there is no entry (clear)", () => {
		expect(shouldWrite(makeSessionManager([]), WIKI_ROOT_CUSTOM_TYPE, null)).toBe(true);
	});

	it("returns false when setting the same value", () => {
		const sm = makeSessionManager([makeEntry("custom", WIKI_ROOT_CUSTOM_TYPE, { value: "wiki" })]);
		expect(shouldWrite(sm, WIKI_ROOT_CUSTOM_TYPE, "wiki")).toBe(false);
	});

	it("returns true when setting a different value", () => {
		const sm = makeSessionManager([makeEntry("custom", WIKI_ROOT_CUSTOM_TYPE, { value: "wiki" })]);
		expect(shouldWrite(sm, WIKI_ROOT_CUSTOM_TYPE, "docs")).toBe(true);
	});

	it("returns true when clearing a set value", () => {
		const sm = makeSessionManager([makeEntry("custom", WIKI_ROOT_CUSTOM_TYPE, { value: "wiki" })]);
		expect(shouldWrite(sm, WIKI_ROOT_CUSTOM_TYPE, null)).toBe(true);
	});

	it("returns false when clearing an already-cleared state", () => {
		const sm = makeSessionManager([makeEntry("custom", WIKI_ROOT_CUSTOM_TYPE, { value: null })]);
		expect(shouldWrite(sm, WIKI_ROOT_CUSTOM_TYPE, null)).toBe(false);
	});

	it("returns true when setting a value over a cleared state", () => {
		const sm = makeSessionManager([makeEntry("custom", WIKI_ROOT_CUSTOM_TYPE, { value: null })]);
		expect(shouldWrite(sm, WIKI_ROOT_CUSTOM_TYPE, "wiki")).toBe(true);
	});
});

describe("planStartup", () => {
	it("keeps a set value without writing (sticky)", () => {
		expect(planStartup({ status: "set", value: "wiki" }, "wiki")).toEqual({
			value: "wiki",
			shouldWrite: false,
		});
	});

	it("stays null and does not write for a cleared state (sticky)", () => {
		expect(planStartup({ status: "cleared" }, "wiki")).toEqual({
			value: null,
			shouldWrite: false,
		});
	});

	it("auto-defaults to the default and writes when unset", () => {
		expect(planStartup({ status: "unset" }, "wiki")).toEqual({
			value: "wiki",
			shouldWrite: true,
		});
	});

	it("falls back to null without writing when unset and no default", () => {
		expect(planStartup({ status: "unset" }, undefined)).toEqual({
			value: null,
			shouldWrite: false,
		});
	});

	it("falls back to null without writing when unset and default is empty", () => {
		expect(planStartup({ status: "unset" }, "")).toEqual({ value: null, shouldWrite: false });
	});
});
