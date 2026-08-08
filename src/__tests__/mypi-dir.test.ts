import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMypiDir, getMypiSkillsDir } from "../mypi-dir.js";

describe("getMypiDir", () => {
	const original = process.env.MYPI_DIR;

	beforeEach(() => {
		delete process.env.MYPI_DIR;
	});

	afterEach(() => {
		if (original === undefined) delete process.env.MYPI_DIR;
		else process.env.MYPI_DIR = original;
	});

	it("defaults to ~/.mypi when MYPI_DIR is unset", () => {
		expect(getMypiDir()).toBe(join(homedir(), ".mypi"));
	});

	it("honours MYPI_DIR when set", () => {
		process.env.MYPI_DIR = "/custom/mypi";
		expect(getMypiDir()).toBe("/custom/mypi");
	});

	it("honours a relative MYPI_DIR verbatim (no implicit resolution)", () => {
		process.env.MYPI_DIR = "relative/mypi";
		expect(getMypiDir()).toBe("relative/mypi");
	});
});

describe("getMypiSkillsDir", () => {
	const original = process.env.MYPI_DIR;

	beforeEach(() => {
		delete process.env.MYPI_DIR;
	});

	afterEach(() => {
		if (original === undefined) delete process.env.MYPI_DIR;
		else process.env.MYPI_DIR = original;
	});

	it("is <mypiDir>/skills by default", () => {
		expect(getMypiSkillsDir()).toBe(join(homedir(), ".mypi", "skills"));
	});

	it("tracks MYPI_DIR", () => {
		process.env.MYPI_DIR = "/custom/mypi";
		expect(getMypiSkillsDir()).toBe(join("/custom/mypi", "skills"));
	});
});
