import { homedir } from "node:os";
import { describe, expect, it } from "vitest";
import {
	localEffortDir,
	localMapPath,
	localRoot,
	localTicketPath,
	repoSlug,
	trackerScriptPath,
	worktreeDir,
} from "./paths.js";

describe("repoSlug", () => {
	it("is the basename of the cwd", () => {
		expect(repoSlug("/root/Projects/mypi")).toBe("mypi");
	});

	it("ignores a trailing slash", () => {
		expect(repoSlug("/root/Projects/mypi/")).toBe("mypi");
	});

	it("normalises relative segments", () => {
		expect(repoSlug("/root/Projects/./mypi")).toBe("mypi");
	});

	it("falls back to 'repo' for the filesystem root", () => {
		expect(repoSlug("/")).toBe("repo");
	});
});

describe("local tracker paths", () => {
	it("localRoot is /tmp/.wayfinder/<repo>", () => {
		expect(localRoot("/root/Projects/mypi")).toBe("/tmp/.wayfinder/mypi");
	});

	it("localEffortDir nests an effort slug", () => {
		expect(localEffortDir("/root/Projects/mypi", "auth-migration")).toBe(
			"/tmp/.wayfinder/mypi/auth-migration",
		);
	});

	it("localMapPath is <effort>/map.md", () => {
		expect(localMapPath("/root/Projects/mypi", "auth-migration")).toBe(
			"/tmp/.wayfinder/mypi/auth-migration/map.md",
		);
	});

	it("localTicketPath zero-pads the number to 2 digits under <effort>/issues/", () => {
		expect(localTicketPath("/root/Projects/mypi", "auth-migration", 1, "pick-idp")).toBe(
			"/tmp/.wayfinder/mypi/auth-migration/issues/01-pick-idp.md",
		);
		expect(localTicketPath("/root/Projects/mypi", "auth-migration", 42, "pick-idp")).toBe(
			"/tmp/.wayfinder/mypi/auth-migration/issues/42-pick-idp.md",
		);
	});
});

describe("worktreeDir", () => {
	it("is ~/.worktrees/<map-slug>/<ticket-slug>", () => {
		expect(worktreeDir("auth-migration", "pick-idp")).toBe(
			`${homedir()}/.worktrees/auth-migration/pick-idp`,
		);
	});
});

describe("trackerScriptPath", () => {
	it("is cwd/.mypi/wayfinder-tracker.sh", () => {
		expect(trackerScriptPath("/root/Projects/mypi")).toBe(
			"/root/Projects/mypi/.mypi/wayfinder-tracker.sh",
		);
	});
});
