import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExecResult, InputEvent } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSkillBlock, handleSkillInput } from "./command-path.js";
import { createMockCtx, createMockPi, skillCommands } from "./mocks.js";
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

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), "dynamic-skills-cmd-"));
	invalidateSkillIndex();
});
afterEach(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

function ev(text: string): InputEvent {
	return { text } as InputEvent;
}

describe("buildSkillBlock — byte-exact wrapper", () => {
	it("matches Pi's _expandSkillCommand output shape", () => {
		const block = buildSkillBlock(
			{ name: "foo", filePath: "/p/foo/SKILL.md", baseDir: "/p/foo" },
			"hello world",
		);
		expect(block).toBe(
			'<skill name="foo" location="/p/foo/SKILL.md">\n' +
				"References are relative to /p/foo.\n\n" +
				"hello world\n" +
				"</skill>",
		);
	});
});

describe("handleSkillInput — gates", () => {
	it("passes through text not starting with /skill:", async () => {
		const { pi } = createMockPi({ commands: [] });
		await expect(handleSkillInput(ev("hello"), createMockCtx(), pi)).resolves.toEqual({
			action: "continue",
		});
	});
	it("passes through already-wrapped <skill ...> re-entry", async () => {
		const { pi } = createMockPi({ commands: [] });
		const wrapped = '<skill name="x" location="y">body</skill>';
		await expect(handleSkillInput(ev(wrapped), createMockCtx(), pi)).resolves.toEqual({
			action: "continue",
		});
	});
	it("passes through unknown skill names", async () => {
		const { pi } = createMockPi({ commands: [] });
		await expect(handleSkillInput(ev("/skill:nope"), createMockCtx(), pi)).resolves.toEqual({
			action: "continue",
		});
	});
	it("passes through when the skill file cannot be read", async () => {
		const { pi } = createMockPi({
			commands: skillCommands([
				{ name: "ghost", filePath: join(tmpDir, "missing.md"), baseDir: tmpDir },
			]),
		});
		await expect(handleSkillInput(ev("/skill:ghost"), createMockCtx(), pi)).resolves.toEqual({
			action: "continue",
		});
	});
});

describe("handleSkillInput — emit paths", () => {
	it("emits a byte-identical wrapper for a no-shell skill with trailing args", async () => {
		const s = writeSkill("regress", "plain body line 1\nplain body line 2");
		const exec = execReturning({ stdout: "should-not-run" });
		const { pi } = createMockPi({ exec, commands: skillCommands([s]) });
		const r = await handleSkillInput(ev("/skill:regress some trailing args"), createMockCtx(), pi);
		expect(r).toEqual({
			action: "transform",
			text:
				`<skill name="regress" location="${s.filePath}">\n` +
				`References are relative to ${s.baseDir}.\n\n` +
				`plain body line 1\nplain body line 2\n` +
				`</skill>\n\n` +
				`some trailing args`,
		});
		expect(exec).not.toHaveBeenCalled();
	});

	it("appends no trailing block when there are no args", async () => {
		const s = writeSkill("foo", "x");
		const { pi } = createMockPi({ commands: skillCommands([s]) });
		const r = (await handleSkillInput(ev("/skill:foo"), createMockCtx(), pi)) as {
			action: string;
			text: string;
		};
		expect(r.action).toBe("transform");
		expect(r.text.endsWith("</skill>")).toBe(true);
	});

	it("strips frontmatter before wrapping", async () => {
		const s = writeSkill("baz", "body", { "argument-hint": "thing" });
		const { pi } = createMockPi({ commands: skillCommands([s]) });
		const r = (await handleSkillInput(ev("/skill:baz"), createMockCtx(), pi)) as {
			text: string;
		};
		expect(r.text).toContain("body");
		expect(r.text).not.toContain("argument-hint");
	});
});

describe("handleSkillInput — shell execution", () => {
	it("executes inline !`cmd` and inlines stdout", async () => {
		const s = writeSkill("sh1", "branch !`git rev-parse HEAD`");
		const exec = execReturning({ stdout: "abc1234" });
		const { pi } = createMockPi({ exec, commands: skillCommands([s]) });
		const r = (await handleSkillInput(ev("/skill:sh1"), createMockCtx(), pi)) as { text: string };
		expect(r.text).toContain("branch abc1234");
	});

	it("executes a ```! block and inlines stdout", async () => {
		const s = writeSkill(
			"sh2",
			"```\nnope\n```\n```!\nmkdir -p ~/.explore/repos\nls ~/.explore/repos\n```",
		);
		const exec = execReturning({ stdout: "repo-a\nrepo-b\n" });
		const { pi } = createMockPi({ exec, commands: skillCommands([s]) });
		const r = (await handleSkillInput(ev("/skill:sh2"), createMockCtx(), pi)) as { text: string };
		expect(r.text).toContain("repo-a\nrepo-b");
		expect(r.text).not.toContain("```!");
		expect(r.text).toContain("```\nnope\n```"); // unrelated code fence untouched
	});

	it("runs two blocks sequentially via the (mocked) exec, never in parallel (FR11)", async () => {
		const s = writeSkill(
			"seq",
			"```!\nmkdir -p ~/.explore/repos\n```\n```!\nls ~/.explore/repos\n```",
		);
		const exec = execReturning({ stdout: "ok" });
		const { pi } = createMockPi({ exec, commands: skillCommands([s]) });
		await handleSkillInput(ev("/skill:seq"), createMockCtx(), pi);
		expect(exec).toHaveBeenCalledTimes(2);
	});

	it("honours shell-timeout frontmatter (seconds → ms)", async () => {
		const s = writeSkill("t1", "!`x`", { "shell-timeout": "5" });
		const exec = execReturning({ stdout: "" });
		const { pi } = createMockPi({ exec, commands: skillCommands([s]) });
		await handleSkillInput(ev("/skill:t1"), createMockCtx(), pi);
		expect(exec).toHaveBeenCalledWith(expect.any(String), expect.any(Array), {
			cwd: process.cwd(),
			timeout: 5000,
		});
	});

	it("uses the default 120s timeout when frontmatter omits shell-timeout", async () => {
		const s = writeSkill("t2", "!`x`");
		const exec = execReturning({ stdout: "" });
		const { pi } = createMockPi({ exec, commands: skillCommands([s]) });
		await handleSkillInput(ev("/skill:t2"), createMockCtx(), pi);
		expect(exec).toHaveBeenCalledWith(expect.any(String), expect.any(Array), {
			cwd: process.cwd(),
			timeout: 120_000,
		});
	});

	it("inlines a non-zero-exit error rather than failing the whole skill", async () => {
		const s = writeSkill("err", "before !`false` after");
		const exec = execReturning({ stdout: "", stderr: "boom\n", code: 2 });
		const { pi } = createMockPi({ exec, commands: skillCommands([s]) });
		const r = (await handleSkillInput(ev("/skill:err"), createMockCtx(), pi)) as { text: string };
		expect(r.text).toContain("[Shell error: exit code 2]\nboom");
		expect(r.text).toContain("before");
		expect(r.text).toContain("after");
	});
});
