import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { deliverDoctrine } from "./deliver.js";

/**
 * The slice of a doctrine message + send options that `deliverDoctrine`
 * touches. The full `ExtensionCommandContext` is large; this lets the fake
 * stay minimal while staying typed.
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
interface NewSessionOptions {
	parentSession?: string;
	withSession?: (ctx: {
		sendMessage: (message: DoctrineMessage, options?: SendMessageOptions) => Promise<void>;
	}) => Promise<void>;
}

interface RecordedCalls {
	notify: Array<{ message: string; type?: string }>;
	newSession: NewSessionOptions[];
	sendMessage: Array<{ message: DoctrineMessage; options: SendMessageOptions }>;
}

/**
 * Hand-rolled fake `ExtensionCommandContext` (the `env(over)`-style builder
 * from `tracker.test.ts`), recording only what `deliverDoctrine` touches.
 * Built as a literal then cast — the real interface has ~30 members we don't
 * exercise here.
 */
function fakeCtx(over: { idle?: boolean; sessionFile?: string } = {}): {
	ctx: ExtensionCommandContext;
	calls: RecordedCalls;
} {
	const calls: RecordedCalls = { notify: [], newSession: [], sendMessage: [] };
	// Distinguish "not provided" (use the default) from an explicit `undefined`
	// (an in-memory / non-persisted session → getSessionFile() returns undefined).
	const sessionFile = "sessionFile" in over ? over.sessionFile : "/sessions/parent.jsonl";
	const ctx = {
		isIdle: () => over.idle ?? true,
		ui: {
			notify: (message: string, type?: string) => {
				calls.notify.push({ message, type });
			},
		},
		sessionManager: {
			getSessionFile: () => sessionFile,
		},
		newSession: async (options: NewSessionOptions) => {
			calls.newSession.push(options);
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
	return { ctx, calls };
}

describe("deliverDoctrine — busy (mid-stream)", () => {
	it("refuses: no clear, no inject", async () => {
		const { ctx, calls } = fakeCtx({ idle: false });

		await deliverDoctrine(ctx, "wayfinder", "doctrine body");

		expect(calls.newSession).toHaveLength(0);
		expect(calls.sendMessage).toHaveLength(0);
	});

	it("warns the user to wait and re-run", async () => {
		const { ctx, calls } = fakeCtx({ idle: false });

		await deliverDoctrine(ctx, "wayfinder", "doctrine body");

		expect(calls.notify).toEqual([
			{ message: "Agent is busy — wait for it to finish, then re-run.", type: "warning" },
		]);
	});
});

describe("deliverDoctrine — idle (clean slate)", () => {
	it("starts exactly one new session and fires exactly one doctrine message", async () => {
		const { ctx, calls } = fakeCtx();

		await deliverDoctrine(ctx, "wayfinder", "doctrine body");

		expect(calls.newSession).toHaveLength(1);
		expect(calls.sendMessage).toHaveLength(1);
	});

	it("links the fresh session back to the current session file via parentSession", async () => {
		const { ctx, calls } = fakeCtx({ sessionFile: "/sessions/abc.jsonl" });

		await deliverDoctrine(ctx, "wayfinder", "x");

		expect(calls.newSession[0]?.parentSession).toBe("/sessions/abc.jsonl");
	});

	it("fires the doctrine as the sole message with display:true + triggerTurn:true", async () => {
		const { ctx, calls } = fakeCtx();

		await deliverDoctrine(ctx, "wayfinder", "doctrine body");

		expect(calls.sendMessage[0]?.message).toEqual({
			customType: "wayfinder",
			content: "doctrine body",
			display: true,
		});
		expect(calls.sendMessage[0]?.options).toEqual({ triggerTurn: true });
	});

	it("omits parentSession when there is no session file (in-memory session)", async () => {
		const { ctx, calls } = fakeCtx({ sessionFile: undefined });

		await deliverDoctrine(ctx, "wayfinder", "x");

		expect(calls.newSession[0]?.parentSession).toBeUndefined();
	});

	it("forwards the single wayfinder customType + content verbatim, display + triggerTurn always on", async () => {
		// the unified command injects only the overview, carried by the single
		// `wayfinder` customType (the old chart/ticket/spec/implement types are gone).
		const { ctx, calls } = fakeCtx();
		await deliverDoctrine(ctx, "wayfinder", "overview body");

		expect(calls.sendMessage).toHaveLength(1);
		expect(calls.sendMessage[0]?.message).toEqual({
			customType: "wayfinder",
			content: "overview body",
			display: true,
		});
		expect(calls.sendMessage[0]?.options).toEqual({ triggerTurn: true });
	});
});
