/**
 * Minimal test doubles for dynamic-skills — avoids an external test-utils
 * dependency. Mirrors the rpiv-args mock pattern: capture registered event
 * handlers so tests can drive them directly.
 */

import type { ExecResult, ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { vi } from "vitest";

interface CommandLike {
	name: string;
	description?: string;
	source: string;
	sourceInfo: { path?: string; source?: string; scope?: string; origin?: string; baseDir?: string };
}

interface MockCtxOptions {
	cwd?: string;
	sessionId?: string;
}

/** A minimal ExtensionContext for the handlers we exercise. */
export function createMockCtx(opts: MockCtxOptions = {}): ExtensionContext {
	return {
		cwd: opts.cwd ?? "/tmp",
		sessionManager: { getSessionId: () => opts.sessionId ?? "test-session" },
	} as unknown as ExtensionContext;
}

interface MockPiOptions {
	exec?: ReturnType<typeof vi.fn>;
	commands?: CommandLike[];
}

/** Build a fake ExtensionAPI that records event handlers and stubs the action
 *  methods dynamic-skills touches (`exec`, `getCommands`). */
export function createMockPi(opts: MockPiOptions = {}): {
	pi: ExtensionAPI;
	captured: { events: Map<string, Array<(...args: unknown[]) => unknown>> };
} {
	const captured = { events: new Map<string, Array<(...args: unknown[]) => unknown>>() };

	const defaultExec = vi.fn(
		async (): Promise<ExecResult> => ({
			stdout: "",
			stderr: "",
			code: 0,
			killed: false,
		}),
	);

	const exec = opts.exec ?? defaultExec;
	const commands = opts.commands ?? [];

	const pi = {
		on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
			const list = captured.events.get(event) ?? [];
			list.push(handler);
			captured.events.set(event, list);
		}),
		exec,
		getCommands: () => commands,
	} as unknown as ExtensionAPI;

	return { pi, captured };
}

/** Build the command-list shape `buildSkillIndex` consumes from skill entries. */
export function skillCommands(
	entries: Array<{ name: string; filePath: string; baseDir: string }>,
): CommandLike[] {
	return entries.map((e) => ({
		name: `skill:${e.name}`,
		description: "",
		source: "skill",
		sourceInfo: {
			path: e.filePath,
			source: "test",
			scope: "user",
			origin: "package",
			baseDir: e.baseDir,
		},
	}));
}
