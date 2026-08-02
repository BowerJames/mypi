import { describe, expect, it } from "vitest";
import {
	detectTracker,
	normaliseScriptOutput,
	parseTrackerFromRemoteUrl,
	type TrackerEnv,
} from "./tracker.js";

/** A fake env builder so each case only overrides the resolver it cares about. */
function env(over: Partial<TrackerEnv>): TrackerEnv {
	return {
		scriptExists: () => false,
		runScript: async () => undefined,
		remoteUrl: async () => undefined,
		...over,
	};
}

describe("parseTrackerFromRemoteUrl", () => {
	it("detects github over HTTPS", () => {
		expect(parseTrackerFromRemoteUrl("https://github.com/owner/repo.git")).toBe("github");
	});

	it("detects github over SSH", () => {
		expect(parseTrackerFromRemoteUrl("git@github.com:owner/repo.git")).toBe("github");
	});

	it("detects gitlab", () => {
		expect(parseTrackerFromRemoteUrl("https://gitlab.com/owner/repo.git")).toBe("gitlab");
		expect(parseTrackerFromRemoteUrl("git@gitlab.com:owner/repo.git")).toBe("gitlab");
	});

	it("falls back to local for an unknown / self-hosted host", () => {
		expect(parseTrackerFromRemoteUrl("https://gitea.example/owner/repo.git")).toBe("local");
		expect(parseTrackerFromRemoteUrl("git@gitlab.corp.example:owner/repo.git")).toBe("local");
	});

	it("does not match look-alike hosts (host-anchored)", () => {
		expect(parseTrackerFromRemoteUrl("https://notgithub.com/owner/repo.git")).toBe("local");
		expect(parseTrackerFromRemoteUrl("https://github.com.evil.example/owner/repo.git")).toBe(
			"local",
		);
		expect(parseTrackerFromRemoteUrl("git@fakegitlab.com:owner/repo.git")).toBe("local");
	});

	it("falls back to local for an empty string", () => {
		expect(parseTrackerFromRemoteUrl("")).toBe("local");
	});
});

describe("normaliseScriptOutput", () => {
	it("accepts each known kind exactly", () => {
		expect(normaliseScriptOutput("local")).toBe("local");
		expect(normaliseScriptOutput("github")).toBe("github");
		expect(normaliseScriptOutput("gitlab")).toBe("gitlab");
	});

	it("trims and lowercases", () => {
		expect(normaliseScriptOutput("  GitHub\n")).toBe("github");
		expect(normaliseScriptOutput("\tGITLAB ")).toBe("gitlab");
	});

	it("rejects anything else", () => {
		expect(normaliseScriptOutput("bitbucket")).toBeUndefined();
		expect(normaliseScriptOutput("gitlab.corp.example")).toBeUndefined();
		expect(normaliseScriptOutput("")).toBeUndefined();
		expect(normaliseScriptOutput("yes")).toBeUndefined();
	});
});

describe("detectTracker", () => {
	it("uses a valid override script output first", async () => {
		const kind = await detectTracker(
			env({
				scriptExists: () => true,
				runScript: async () => "gitlab",
				remoteUrl: async () => "https://github.com/owner/repo.git",
			}),
		);
		// Script wins even though the remote says github.
		expect(kind).toBe("gitlab");
	});

	it("falls through to autodetection when the script output is unrecognised", async () => {
		const kind = await detectTracker(
			env({
				scriptExists: () => true,
				runScript: async () => "bitbucket",
				remoteUrl: async () => "https://github.com/owner/repo.git",
			}),
		);
		expect(kind).toBe("github");
	});

	it("falls through when the script exits non-zero", async () => {
		const kind = await detectTracker(
			env({
				scriptExists: () => true,
				runScript: async () => undefined,
				remoteUrl: async () => "https://gitlab.com/owner/repo.git",
			}),
		);
		expect(kind).toBe("gitlab");
	});

	it("autodetects when no override script exists", async () => {
		const kind = await detectTracker(
			env({
				scriptExists: () => false,
				remoteUrl: async () => "git@github.com:owner/repo.git",
			}),
		);
		expect(kind).toBe("github");
	});

	it("defaults to local when there is no remote", async () => {
		const kind = await detectTracker(env({ remoteUrl: async () => undefined }));
		expect(kind).toBe("local");
	});

	it("defaults to local when everything is absent", async () => {
		const kind = await detectTracker(env({}));
		expect(kind).toBe("local");
	});
});
