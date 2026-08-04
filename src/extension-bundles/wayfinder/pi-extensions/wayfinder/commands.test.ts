import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import wayfinderExtension from "./index.js";

/**
 * Handler wiring tests for the single unified command. Drives the real
 * registered handler with a minimal fake `pi` (`registerCommand` captures
 * handlers; `exec` returns a GitHub remote so the autodetected tracker is
 * `github` — the override script is absent at the fake cwd, so no `bash` exec
 * is exercised) + a fake `ExtensionCommandContext` whose `newSession` records
 * calls and forwards the `withSession` callback a fake
 * `ReplacedSessionContext.sendMessage`.
 */

interface DoctrineMessage {
	customType: string;
	content: string;
	display?: boolean;
}
interface SendMessageOptions {
	triggerTurn?: boolean;
	deliverAs?: "steer" | "followUp" | "nextTurn";
}
interface RecordedCalls {
	notify: Array<{ message: string; type?: string }>;
	newSession: Array<{ parentSession?: string }>;
	sendMessage: Array<{ message: DoctrineMessage; options: SendMessageOptions }>;
}

interface CommandOptions {
	description?: string;
	handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
}

/** Fetch a registered command's handler, failing loudly if it is missing. */
function handler(commands: Map<string, CommandOptions>, name: string) {
	const cmd = commands.get(name);
	if (!cmd) throw new Error(`command not registered: ${name}`);
	return cmd.handler;
}

/**
 * Build a fresh extension instance + a recording fake ctx. Each `it` calls
 * this so the per-closure tracker cache never leaks between cases.
 */
function setup(over: { idle?: boolean; sessionFile?: string } = {}) {
	const commands = new Map<string, CommandOptions>();
	const pi = {
		registerCommand: (name: string, options: CommandOptions) => {
			commands.set(name, options);
		},
		// `git remote get-url origin` → a github remote, so tracker === "github".
		exec: async () => ({ code: 0, stdout: "https://github.com/owner/repo.git\n", stderr: "" }),
	} as unknown as ExtensionAPI;
	wayfinderExtension(pi);

	const calls: RecordedCalls = { notify: [], newSession: [], sendMessage: [] };
	const ctx = {
		// A cwd where `.mypi/wayfinder-tracker.sh` does not exist, so the
		// override script branch is skipped and only the git remote is read.
		cwd: "/tmp/wayfinder-commands-test/repo",
		isIdle: () => over.idle ?? true,
		ui: {
			notify: (message: string, type?: string) => {
				calls.notify.push({ message, type });
			},
		},
		sessionManager: {
			getSessionFile: () => over.sessionFile ?? "/sessions/parent.jsonl",
		},
		newSession: async (options: {
			parentSession?: string;
			withSession?: (replaced: {
				sendMessage: (message: DoctrineMessage, options?: SendMessageOptions) => Promise<void>;
			}) => Promise<void>;
		}) => {
			calls.newSession.push({ parentSession: options.parentSession });
			if (options.withSession) {
				await options.withSession({
					sendMessage: async (message: DoctrineMessage, options2: SendMessageOptions = {}) => {
						calls.sendMessage.push({ message, options: options2 });
					},
				});
			}
			return { cancelled: false };
		},
	} as unknown as ExtensionCommandContext;

	return { commands, ctx, calls };
}

describe("registration — exactly one command", () => {
	it("registers only `wayfinder` (to-spec/implement are gone)", () => {
		const { commands } = setup();
		expect(commands.has("wayfinder")).toBe(true);
		expect(commands.has("to-spec")).toBe(false);
		expect(commands.has("implement")).toBe(false);
	});
});

describe("/wayfinder --help / -h", () => {
	for (const flag of ["--help", "-h"]) {
		it(`${flag} emits the dispatch table and does not clear or inject`, async () => {
			const { commands, ctx, calls } = setup();
			await handler(commands, "wayfinder")(flag, ctx);

			// the table is notified (info); the conversation is never cleared and
			// nothing is injected.
			expect(calls.newSession).toHaveLength(0);
			expect(calls.sendMessage).toHaveLength(0);
			expect(calls.notify).toHaveLength(1);
			expect(calls.notify[0]?.type).toBe("info");
			const help = calls.notify[0]?.message ?? "";
			expect(help).toContain("Usage: /wayfinder [<ref>]");
			expect(help).toContain("Dispatch (label + state → skill to read):");
			// a couple of representative rows
			expect(help).toContain("wayfinder:spec");
			expect(help).toContain("implementation-map    (redirect)");
			expect(help).toContain("implementation-review");
			// the four ref forms
			expect(help).toContain("issue number");
			expect(help).toContain("description");
		});
	}
});

describe("/wayfinder (bare — chart)", () => {
	it("notifies the autodetected tracker, then injects the overview + chart directive on a clean slate", async () => {
		const { commands, ctx, calls } = setup();
		await handler(commands, "wayfinder")("", ctx);

		expect(calls.notify[0]).toEqual({ message: "Wayfinder tracker: github", type: "info" });
		expect(calls.newSession).toEqual([{ parentSession: "/sessions/parent.jsonl" }]);
		expect(calls.sendMessage).toHaveLength(1);
		expect(calls.sendMessage[0]?.message.customType).toBe("wayfinder");
		expect(calls.sendMessage[0]?.message.display).toBe(true);
		expect(calls.sendMessage[0]?.options).toEqual({ triggerTurn: true });

		// the injected body is the overview (dispatch table) + the chart directive
		const body = calls.sendMessage[0]?.message.content ?? "";
		expect(body).toContain("chart the fog, resolve one ticket at a time");
		expect(body).toContain("#### Dispatch table");
		expect(body).toContain("**Chart.**");
	});

	it("detects the tracker BEFORE injecting (notify precedes the clear)", async () => {
		const { commands, ctx, calls } = setup();
		await handler(commands, "wayfinder")("", ctx);

		// notify is the first recorded side effect, before newSession
		expect(calls.notify[0]?.message).toBe("Wayfinder tracker: github");
		// exactly one tracker notify (no per-command duplication now that there
		// is one command)
		const trackerNotifies = calls.notify.filter((n) => n.message.startsWith("Wayfinder tracker"));
		expect(trackerNotifies).toHaveLength(1);
	});
});

describe("/wayfinder <ref>", () => {
	it("injects the overview + a resolution directive embedding the ref", async () => {
		const { commands, ctx, calls } = setup();
		await handler(commands, "wayfinder")("42", ctx);

		expect(calls.sendMessage).toHaveLength(1);
		expect(calls.sendMessage[0]?.message.customType).toBe("wayfinder");
		const body = calls.sendMessage[0]?.message.content ?? "";
		// overview rides in the body
		expect(body).toContain("#### Dispatch table");
		// resolution directive embeds the ref and tells the agent to resolve it
		expect(body).toContain("You are working `42`");
		expect(body).toContain("Resolve it first");
		expect(body).toContain("gh issue view");
	});

	it("supports a URL ref (resolution is the agent's turn — command does not read the issue)", async () => {
		const { commands, ctx, calls } = setup();
		const url = "https://github.com/owner/repo/issues/42";
		await handler(commands, "wayfinder")(url, ctx);

		expect(calls.sendMessage).toHaveLength(1);
		expect(calls.sendMessage[0]?.message.content).toContain(`You are working \`${url}\``);
	});

	it("supports a description ref (the directive points at gh issue list --search)", async () => {
		const { commands, ctx, calls } = setup();
		await handler(commands, "wayfinder")("the unified wayfinder overview", ctx);

		const body = calls.sendMessage[0]?.message.content ?? "";
		expect(body).toContain("You are working `the unified wayfinder overview`");
		expect(body).toContain("gh issue list --search");
	});
});

describe("/wayfinder — busy guard", () => {
	it("refuses while busy (no clear, no inject) for the bare command", async () => {
		const { commands, ctx, calls } = setup({ idle: false });
		await handler(commands, "wayfinder")("", ctx);

		expect(calls.newSession).toHaveLength(0);
		expect(calls.sendMessage).toHaveLength(0);
		expect(calls.notify).toContainEqual({
			message: "Agent is busy — wait for it to finish, then re-run.",
			type: "warning",
		});
	});

	it("refuses while busy for /wayfinder <ref>", async () => {
		const { commands, ctx, calls } = setup({ idle: false });
		await handler(commands, "wayfinder")("42", ctx);

		expect(calls.newSession).toHaveLength(0);
		expect(calls.sendMessage).toHaveLength(0);
		expect(calls.notify).toContainEqual({
			message: "Agent is busy — wait for it to finish, then re-run.",
			type: "warning",
		});
	});
});
