import { describe, expect, it } from "vitest";
import {
	buildRootBranchPromptSuffix,
	getRootBranch,
	planRootBranchStartup,
	ROOT_BRANCH_CUSTOM_TYPE,
	readRootBranchState,
	shouldWriteRootBranch,
} from "./root-branch.js";

function makeEntry(type: string, customType?: string, data?: Record<string, unknown>) {
	return { type, ...(customType ? { customType } : {}), ...(data ? { data } : {}) };
}

function makeSessionManager(entries: ReturnType<typeof makeEntry>[]) {
	return { getEntries: () => entries };
}

describe("getRootBranch", () => {
	it("returns undefined when there are no entries", () => {
		const result = getRootBranch(makeSessionManager([]));
		expect(result).toBeUndefined();
	});

	it("returns undefined when no root-branch entry exists", () => {
		const entries = [
			makeEntry("message"),
			makeEntry("custom", "mode", { mode: "plan" }),
			makeEntry("message"),
		];
		const result = getRootBranch(makeSessionManager(entries));
		expect(result).toBeUndefined();
	});

	it("returns the branch from a single root-branch entry", () => {
		const entries = [
			makeEntry("message"),
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "feature/v2" }),
		];
		const result = getRootBranch(makeSessionManager(entries));
		expect(result).toBe("feature/v2");
	});

	it("returns the last root-branch entry when multiple exist", () => {
		const entries = [
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "main" }),
			makeEntry("message"),
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "develop" }),
			makeEntry("message"),
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "release/1.0" }),
		];
		const result = getRootBranch(makeSessionManager(entries));
		expect(result).toBe("release/1.0");
	});

	it("returns undefined when the last root-branch entry has branch: null", () => {
		const entries = [
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "feature/v2" }),
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: null }),
		];
		const result = getRootBranch(makeSessionManager(entries));
		expect(result).toBeUndefined();
	});

	it("returns undefined when the last root-branch entry has branch: empty string", () => {
		const entries = [
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "develop" }),
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "" }),
		];
		const result = getRootBranch(makeSessionManager(entries));
		expect(result).toBeUndefined();
	});

	it("skips earlier root-branch entries when the last one is cleared", () => {
		const entries = [
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "main" }),
			makeEntry("message"),
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "feature/x" }),
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: null }),
		];
		const result = getRootBranch(makeSessionManager(entries));
		expect(result).toBeUndefined();
	});

	it("finds root-branch among other custom entries", () => {
		const entries = [
			makeEntry("custom", "mode", { mode: "plan" }),
			makeEntry("message"),
			makeEntry("custom", "other-extension", { foo: "bar" }),
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "staging" }),
			makeEntry("custom", "mode", { mode: "develop" }),
		];
		const result = getRootBranch(makeSessionManager(entries));
		expect(result).toBe("staging");
	});
});

describe("readRootBranchState", () => {
	it("returns unset when there are no entries", () => {
		const result = readRootBranchState(makeSessionManager([]));
		expect(result).toEqual({ status: "unset" });
	});

	it("returns unset when no root-branch entry exists", () => {
		const entries = [makeEntry("message"), makeEntry("custom", "mode", { mode: "plan" })];
		const result = readRootBranchState(makeSessionManager(entries));
		expect(result).toEqual({ status: "unset" });
	});

	it("returns set when the last root-branch entry holds a branch", () => {
		const entries = [makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "develop" })];
		const result = readRootBranchState(makeSessionManager(entries));
		expect(result).toEqual({ status: "set", branch: "develop" });
	});

	it("returns cleared when the last root-branch entry holds null", () => {
		const entries = [
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "main" }),
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: null }),
		];
		const result = readRootBranchState(makeSessionManager(entries));
		expect(result).toEqual({ status: "cleared" });
	});

	it("returns cleared when the last root-branch entry holds an empty string", () => {
		const entries = [makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "" })];
		const result = readRootBranchState(makeSessionManager(entries));
		expect(result).toEqual({ status: "cleared" });
	});

	it("returns cleared when the last root-branch entry holds a non-string value", () => {
		const entries = [makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: 123 })];
		const result = readRootBranchState(makeSessionManager(entries));
		expect(result).toEqual({ status: "cleared" });
	});

	it("last-wins: set overrides earlier cleared", () => {
		const entries = [
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: null }),
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "feature/x" }),
		];
		const result = readRootBranchState(makeSessionManager(entries));
		expect(result).toEqual({ status: "set", branch: "feature/x" });
	});

	it("ignores non-root-branch custom entries when scanning", () => {
		const entries = [
			makeEntry("custom", "mode", { mode: "plan" }),
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "staging" }),
			makeEntry("custom", "mode", { mode: "develop" }),
		];
		const result = readRootBranchState(makeSessionManager(entries));
		expect(result).toEqual({ status: "set", branch: "staging" });
	});
});

describe("shouldWriteRootBranch", () => {
	it("returns true when there is no entry (set)", () => {
		const sm = makeSessionManager([]);
		expect(shouldWriteRootBranch(sm, "develop")).toBe(true);
	});

	it("returns true when there is no entry (clear)", () => {
		const sm = makeSessionManager([]);
		expect(shouldWriteRootBranch(sm, null)).toBe(true);
	});

	it("returns false when setting the same branch that is already set", () => {
		const sm = makeSessionManager([
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "develop" }),
		]);
		expect(shouldWriteRootBranch(sm, "develop")).toBe(false);
	});

	it("returns true when setting a different branch", () => {
		const sm = makeSessionManager([
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "develop" }),
		]);
		expect(shouldWriteRootBranch(sm, "main")).toBe(true);
	});

	it("returns true when clearing a set branch", () => {
		const sm = makeSessionManager([
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "develop" }),
		]);
		expect(shouldWriteRootBranch(sm, null)).toBe(true);
	});

	it("returns false when clearing an already-cleared state", () => {
		const sm = makeSessionManager([makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: null })]);
		expect(shouldWriteRootBranch(sm, null)).toBe(false);
	});

	it("returns true when setting a branch over a cleared state", () => {
		const sm = makeSessionManager([makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: null })]);
		expect(shouldWriteRootBranch(sm, "main")).toBe(true);
	});

	it("evaluates against the most recent entry only", () => {
		const sm = makeSessionManager([
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "develop" }),
			makeEntry("custom", ROOT_BRANCH_CUSTOM_TYPE, { branch: "main" }),
		]);
		// current effective value is "main"; setting "develop" differs → write
		expect(shouldWriteRootBranch(sm, "develop")).toBe(true);
	});
});

describe("planRootBranchStartup", () => {
	it("keeps a set branch without writing (sticky)", () => {
		const result = planRootBranchStartup({ status: "set", branch: "develop" }, "main");
		expect(result).toEqual({ rootBranch: "develop", shouldWrite: false });
	});

	it("stays null and does not write for a cleared state (sticky)", () => {
		const result = planRootBranchStartup({ status: "cleared" }, "main");
		expect(result).toEqual({ rootBranch: null, shouldWrite: false });
	});

	it("auto-defaults to the current branch and writes when unset", () => {
		const result = planRootBranchStartup({ status: "unset" }, "develop");
		expect(result).toEqual({ rootBranch: "develop", shouldWrite: true });
	});

	it("falls back to null without writing when unset and no current branch", () => {
		const result = planRootBranchStartup({ status: "unset" }, undefined);
		expect(result).toEqual({ rootBranch: null, shouldWrite: false });
	});

	it("falls back to null without writing when unset and current branch is empty", () => {
		const result = planRootBranchStartup({ status: "unset" }, "");
		expect(result).toEqual({ rootBranch: null, shouldWrite: false });
	});

	it("ignores the current branch when the state is set", () => {
		const result = planRootBranchStartup({ status: "set", branch: "main" }, "develop");
		expect(result).toEqual({ rootBranch: "main", shouldWrite: false });
	});
});

describe("buildRootBranchPromptSuffix", () => {
	it("returns undefined when rootBranch is null", () => {
		const result = buildRootBranchPromptSuffix(null);
		expect(result).toBeUndefined();
	});

	it("returns undefined when rootBranch is undefined", () => {
		const result = buildRootBranchPromptSuffix(undefined);
		expect(result).toBeUndefined();
	});

	it("returns undefined when rootBranch is empty string", () => {
		const result = buildRootBranchPromptSuffix("");
		expect(result).toBeUndefined();
	});

	it("returns a prompt suffix containing the branch name", () => {
		const result = buildRootBranchPromptSuffix("develop");
		expect(result).toContain("# Root Branch");
		expect(result).toContain("develop");
		expect(result).toContain("all pull requests must target develop");
	});

	it("includes the branch name multiple times in the suffix", () => {
		const result = buildRootBranchPromptSuffix("release/1.0");
		expect(result).toContain("release/1.0");
		// Count occurrences of the branch name
		const matches = result ? result.match(/release\/1\.0/g) : null;
		expect(matches?.length).toBeGreaterThanOrEqual(2);
	});

	it("starts with double newline for clean appending", () => {
		const result = buildRootBranchPromptSuffix("main");
		expect(result?.startsWith("\n\n#")).toBe(true);
	});
});
