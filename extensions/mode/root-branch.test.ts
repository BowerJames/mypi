import { describe, expect, it } from "vitest";
import {
	buildRootBranchPromptSuffix,
	getRootBranch,
	ROOT_BRANCH_CUSTOM_TYPE,
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
