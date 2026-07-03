import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExecResult, ToolResultEvent } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockCtx, createMockPi, skillCommands } from "./mocks.js";
import { handleReadResult } from "./read-path.js";
import { invalidateSkillIndex } from "./skill-index.js";

let tmpDir: string;

function writeSkill(
	name: string,
	body: string,
	frontmatter?: Record<string, string>,
): {
	name: string;
	filePath: string;
	baseDir: string;
} {
	const dir = join(tmpDir, name);
	mkdirSync(dir, { recursive: true });
	const filePath = join(dir, "SKILL.md");
	const fm = frontmatter
		? `---\n${Object.entries(frontmatter)
				.map(([k, v]) => `${k}: ${v}`)
				.join("\n")}\n---\n`
		: "";
	writeFileSync(filePath, `${fm}${body}`, "utf-8");
	return { name, filePath, baseDir: dir };
}

function execReturning(result: Partial<ExecResult>): ReturnType<typeof vi.fn> {
	return vi.fn(async () => ({ stdout: "", stderr: "", code: 0, killed: false, ...result }));
}

/** Build a synthetic read ToolResultEvent. */
function readEvent(path: string, text: string, opts: { isError?: boolean } = {}): ToolResultEvent {
	return {
		type: "tool_result",
		toolName: "read",
		toolCallId: "call_1",
		input: { path },
		content: [{ type: "text", text }],
		details: undefined,
		isError: opts.isError ?? false,
	} as unknown as ToolResultEvent;
}

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), "dynamic-skills-read-"));
	invalidateSkillIndex();
});
afterEach(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

describe("handleReadResult — gates (passthrough)", () => {
	it("passes through non-read tools", async () => {
		const { pi } = createMockPi({ commands: [] });
		const event = {
			toolName: "bash",
			input: { command: "ls" },
			content: [],
		} as unknown as ToolResultEvent;
		await expect(handleReadResult(event, createMockCtx(), pi)).resolves.toBeUndefined();
	});
	it("passes through when input has no path", async () => {
		const { pi } = createMockPi({ commands: [] });
		const event = { toolName: "read", input: {}, content: [] } as unknown as ToolResultEvent;
		await expect(handleReadResult(event, createMockCtx(), pi)).resolves.toBeUndefined();
	});
	it("passes through files not named SKILL.md", async () => {
		const s = writeSkill("foo", "!`echo hi`");
		const { pi } = createMockPi({ commands: skillCommands([s]) });
		const event = readEvent(join(s.baseDir, "REFERENCE.md"), "body !`echo hi`");
		await expect(
			handleReadResult(event, createMockCtx({ cwd: s.baseDir }), pi),
		).resolves.toBeUndefined();
	});
	it("passes through a SKILL.md that is not a registered skill", async () => {
		const { pi } = createMockPi({ commands: [] }); // no skills registered
		const stray = join(tmpDir, "stray", "SKILL.md");
		mkdirSync(join(tmpDir, "stray"), { recursive: true });
		writeFileSync(stray, "!`echo hi`", "utf-8");
		const event = readEvent(stray, "!`echo hi`");
		await expect(
			handleReadResult(event, createMockCtx({ cwd: join(tmpDir, "stray") }), pi),
		).resolves.toBeUndefined();
	});
	it("passes through error results", async () => {
		const s = writeSkill("foo", "!`echo hi`");
		const { pi } = createMockPi({ commands: skillCommands([s]) });
		const event = readEvent(s.filePath, "!`echo hi`", { isError: true });
		await expect(
			handleReadResult(event, createMockCtx({ cwd: s.baseDir }), pi),
		).resolves.toBeUndefined();
	});
	it("passes through mixed/image content", async () => {
		const s = writeSkill("foo", "!`echo hi`");
		const { pi } = createMockPi({ commands: skillCommands([s]) });
		const event = {
			type: "tool_result",
			toolName: "read",
			toolCallId: "c",
			input: { path: s.filePath },
			content: [
				{ type: "text", text: "Read image file [image/png]" },
				{ type: "image", data: "x", mimeType: "image/png" },
			],
			details: undefined,
			isError: false,
		} as unknown as ToolResultEvent;
		await expect(
			handleReadResult(event, createMockCtx({ cwd: s.baseDir }), pi),
		).resolves.toBeUndefined();
	});
	it("passes through registered SKILL.md with no shell syntax", async () => {
		const s = writeSkill("foo", "plain body, no shell");
		const exec = execReturning({ stdout: "x" });
		const { pi } = createMockPi({ exec, commands: skillCommands([s]) });
		const event = readEvent(s.filePath, "---\nname: foo\n---\nplain body, no shell");
		await expect(
			handleReadResult(event, createMockCtx({ cwd: s.baseDir }), pi),
		).resolves.toBeUndefined();
		expect(exec).not.toHaveBeenCalled();
	});
});

describe("handleReadResult — transformation", () => {
	it("executes inline shell and replaces the text content for a registered SKILL.md", async () => {
		const s = writeSkill("foo", "branch !`git rev-parse HEAD`");
		const exec = execReturning({ stdout: "abc1234" });
		const { pi } = createMockPi({ exec, commands: skillCommands([s]) });
		const text = "---\nname: foo\n---\nbranch !`git rev-parse HEAD`";
		const r = await handleReadResult(
			readEvent(s.filePath, text),
			createMockCtx({ cwd: s.baseDir }),
			pi,
		);
		expect(r).toEqual({ content: [{ type: "text", text: "---\nname: foo\n---\nbranch abc1234" }] });
		expect(exec).toHaveBeenCalledWith(expect.any(String), ["-c", "git rev-parse HEAD"], {
			cwd: s.baseDir,
			timeout: 120_000,
		});
	});

	it("executes a ```! block for a registered SKILL.md", async () => {
		const s = writeSkill("bar", "```!\nmkdir -p ~/.explore/repos\nls ~/.explore/repos\n```");
		const exec = execReturning({ stdout: "repo-a\nrepo-b\n" });
		const { pi } = createMockPi({ exec, commands: skillCommands([s]) });
		const text = "---\nname: bar\n---\n```!\nmkdir -p ~/.explore/repos\nls ~/.explore/repos\n```";
		const r = (await handleReadResult(
			readEvent(s.filePath, text),
			createMockCtx({ cwd: s.baseDir }),
			pi,
		)) as {
			content: Array<{ type: string; text: string }>;
		};
		expect(r.content[0].text).toContain("repo-a\nrepo-b");
		expect(r.content[0].text).not.toContain("```!");
	});

	it("uses ctx.cwd as the shell working directory", async () => {
		const s = writeSkill("cwd", "!`pwd`");
		const exec = execReturning({ stdout: "/home/me" });
		const { pi } = createMockPi({ exec, commands: skillCommands([s]) });
		await handleReadResult(readEvent(s.filePath, "!`pwd`"), createMockCtx({ cwd: "/home/me" }), pi);
		expect(exec).toHaveBeenCalledWith(expect.any(String), expect.any(Array), {
			cwd: "/home/me",
			timeout: 120_000,
		});
	});

	it("honours shell-timeout frontmatter", async () => {
		const s = writeSkill("to", "!`x`", { "shell-timeout": "5" });
		const exec = execReturning({ stdout: "" });
		const { pi } = createMockPi({ exec, commands: skillCommands([s]) });
		const text = "---\nname: to\nshell-timeout: 5\n---\n!`x`";
		await handleReadResult(readEvent(s.filePath, text), createMockCtx({ cwd: s.baseDir }), pi);
		expect(exec).toHaveBeenCalledWith(expect.any(String), expect.any(Array), {
			cwd: s.baseDir,
			timeout: 5000,
		});
	});

	it("inlines an error rather than dropping the content", async () => {
		const s = writeSkill("err", "!`false`");
		const exec = execReturning({ stdout: "", stderr: "boom\n", code: 2 });
		const { pi } = createMockPi({ exec, commands: skillCommands([s]) });
		const text = "---\nname: err\n---\n!`false`";
		const r = (await handleReadResult(
			readEvent(s.filePath, text),
			createMockCtx({ cwd: s.baseDir }),
			pi,
		)) as {
			content: Array<{ type: string; text: string }>;
		};
		expect(r.content[0].text).toContain("[Shell error: exit code 2]\nboom");
	});
});
