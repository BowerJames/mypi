import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import wayfinderExtension from "./index.js";

/**
 * Handler wiring tests. Drives the real registered handlers with a minimal
 * fake `pi` (`registerCommand` captures handlers; `exec` returns a GitHub
 * remote so the autodetected tracker is `github` — the override script is
 * absent at the fake cwd, so no `bash` exec is exercised) + a fake
 * `ExtensionCommandContext` whose `newSession` records calls and forwards the
 * `withSession` callback a fake `ReplacedSessionContext.sendMessage`.
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

describe("/wayfinder", () => {
	it("notifies the autodetected tracker, then injects the chart doctrine on a clean slate", async () => {
		const { commands, ctx, calls } = setup();
		await handler(commands, "wayfinder")("", ctx);

		expect(calls.notify[0]).toEqual({ message: "Wayfinder tracker: github", type: "info" });
		expect(calls.newSession).toEqual([{ parentSession: "/sessions/parent.jsonl" }]);
		expect(calls.sendMessage).toHaveLength(1);
		expect(calls.sendMessage[0]?.message.customType).toBe("wayfinder-chart");
		expect(calls.sendMessage[0]?.message.display).toBe(true);
		expect(calls.sendMessage[0]?.options).toEqual({ triggerTurn: true });
	});

	it("with a ticket-ref injects the ticket doctrine embedding the ref", async () => {
		const { commands, ctx, calls } = setup();
		await handler(commands, "wayfinder")("42", ctx);

		expect(calls.sendMessage).toHaveLength(1);
		expect(calls.sendMessage[0]?.message.customType).toBe("wayfinder-ticket");
		expect(calls.sendMessage[0]?.message.content).toContain("`42`");
		expect(calls.sendMessage[0]?.options).toEqual({ triggerTurn: true });
	});

	it("refuses while busy (no clear, no inject)", async () => {
		const { commands, ctx, calls } = setup({ idle: false });
		await handler(commands, "wayfinder")("", ctx);

		expect(calls.newSession).toHaveLength(0);
		expect(calls.sendMessage).toHaveLength(0);
		expect(calls.notify).toContainEqual({
			message: "Agent is busy — wait for it to finish, then re-run.",
			type: "warning",
		});
	});
});

describe("/to-spec", () => {
	it("injects the spec doctrine on a clean slate", async () => {
		const { commands, ctx, calls } = setup();
		await handler(commands, "to-spec")("42", ctx);

		expect(calls.notify[0]).toEqual({ message: "Wayfinder to-spec tracker: github", type: "info" });
		expect(calls.newSession).toEqual([{ parentSession: "/sessions/parent.jsonl" }]);
		expect(calls.sendMessage).toHaveLength(1);
		expect(calls.sendMessage[0]?.message.customType).toBe("wayfinder-spec");
		expect(calls.sendMessage[0]?.options).toEqual({ triggerTurn: true });
	});

	it("with no map-ref shows the usage error and does not clear", async () => {
		const { commands, ctx, calls } = setup();
		await handler(commands, "to-spec")("   ", ctx);

		expect(calls.newSession).toHaveLength(0);
		expect(calls.sendMessage).toHaveLength(0);
		expect(calls.notify).toContainEqual({
			message:
				"Usage: /to-spec <map-ref> — pass the closed map's issue number/URL (or local effort slug/path).",
			type: "error",
		});
	});
});
