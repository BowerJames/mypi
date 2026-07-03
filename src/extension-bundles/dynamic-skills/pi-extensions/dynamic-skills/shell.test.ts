/* biome-ignore-all lint/suspicious/noTemplateCurlyInString: tests may contain literal placeholder text */

import type { ExecResult } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPi } from "./mocks.js";
import {
	DEFAULT_SHELL_TIMEOUT_MS,
	executeShellInBody,
	formatShellOutput,
	resolveShellTimeoutMs,
	runOneShellCommand,
} from "./shell.js";

/** Captured at module load, before any test mutates it. */
const ORIGINAL_PLATFORM = process.platform;

function execReturning(result: Partial<ExecResult>): ReturnType<typeof vi.fn> {
	return vi.fn(async () => ({ stdout: "", stderr: "", code: 0, killed: false, ...result }));
}

describe("resolveShellTimeoutMs", () => {
	it("returns the default when absent", () => {
		expect(resolveShellTimeoutMs({})).toBe(DEFAULT_SHELL_TIMEOUT_MS);
	});
	it("converts positive seconds to ms", () => {
		expect(resolveShellTimeoutMs({ "shell-timeout": 5 })).toBe(5_000);
		expect(resolveShellTimeoutMs({ "shell-timeout": 0.5 })).toBe(500);
	});
	it("honours 0 as explicit disable", () => {
		expect(resolveShellTimeoutMs({ "shell-timeout": 0 })).toBe(0);
	});
	it("falls back to default for negative values", () => {
		expect(resolveShellTimeoutMs({ "shell-timeout": -1 })).toBe(DEFAULT_SHELL_TIMEOUT_MS);
	});
	it("falls back to default for NaN (would silently disable the timer)", () => {
		expect(resolveShellTimeoutMs({ "shell-timeout": Number.NaN })).toBe(DEFAULT_SHELL_TIMEOUT_MS);
	});
	it("falls back to default for Infinity (Node clamps setTimeout(Infinity) to 1ms)", () => {
		expect(resolveShellTimeoutMs({ "shell-timeout": Number.POSITIVE_INFINITY })).toBe(
			DEFAULT_SHELL_TIMEOUT_MS,
		);
	});
	it("falls back to default for non-number values", () => {
		expect(resolveShellTimeoutMs({ "shell-timeout": "5" })).toBe(DEFAULT_SHELL_TIMEOUT_MS);
		expect(resolveShellTimeoutMs({ "shell-timeout": true })).toBe(DEFAULT_SHELL_TIMEOUT_MS);
	});
});

describe("formatShellOutput", () => {
	it("returns stdout unchanged when stderr is empty", () => {
		expect(formatShellOutput({ stdout: "ok\n", stderr: "", code: 0, killed: false })).toBe("ok\n");
	});
	it("appends a [stderr] block when both streams have content", () => {
		expect(formatShellOutput({ stdout: "ok\n", stderr: "warn\n", code: 0, killed: false })).toBe(
			"ok\n[stderr]\nwarn\n",
		);
	});
	it("promotes stderr-only output under a [stderr] header", () => {
		expect(formatShellOutput({ stdout: "", stderr: "diagnostic\n", code: 0, killed: false })).toBe(
			"[stderr]\ndiagnostic\n",
		);
	});
	it("returns an empty string when both streams are empty", () => {
		expect(formatShellOutput({ stdout: "", stderr: "", code: 0, killed: false })).toBe("");
	});
	it("truncates output beyond the 50KB / 2000-line budget", () => {
		const big = `${"x".repeat(60_000)}\n`;
		const out = formatShellOutput({ stdout: big, stderr: "", code: 0, killed: false });
		expect(out.length).toBeLessThan(big.length);
		expect(out).toMatch(/\[truncated: hit .+\]$/);
	});
	it("truncates tall output by the 2000-line limit", () => {
		const tall = `${"line\n".repeat(2500)}`;
		const out = formatShellOutput({ stdout: tall, stderr: "", code: 0, killed: false });
		expect(out).toMatch(/\[truncated: hit 2000 lines\]$/);
	});
});

describe("runOneShellCommand", () => {
	beforeEach(() => {
		// Force POSIX shell selection deterministically.
		Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
	});
	afterEach(() => {
		Object.defineProperty(process, "platform", { value: ORIGINAL_PLATFORM, configurable: true });
	});

	it("returns stdout on success", async () => {
		const exec = execReturning({ stdout: "hello\n", code: 0 });
		const { pi } = createMockPi({ exec });
		await expect(runOneShellCommand(pi.exec, "echo hi", "/tmp", 1000)).resolves.toBe("hello\n");
		expect(exec).toHaveBeenCalledWith("sh", ["-c", "echo hi"], { cwd: "/tmp", timeout: 1000 });
	});
	it("killed → [Shell error: timed out after Ns] (killed wins over non-zero code)", async () => {
		const exec = execReturning({ stdout: "", code: 1, killed: true });
		const { pi } = createMockPi({ exec });
		await expect(runOneShellCommand(pi.exec, "sleep 60", "/tmp", 3000)).resolves.toBe(
			"[Shell error: timed out after 3s]",
		);
	});
	it("sub-second timeout floors the display at 1s", async () => {
		const exec = execReturning({ stdout: "", code: 0, killed: true });
		const { pi } = createMockPi({ exec });
		await expect(runOneShellCommand(pi.exec, "x", "/tmp", 500)).resolves.toBe(
			"[Shell error: timed out after 1s]",
		);
	});
	it("non-zero exit → [Shell error: exit code N]\\n<stderr>", async () => {
		const exec = execReturning({ stdout: "", stderr: "oh no\n", code: 2 });
		const { pi } = createMockPi({ exec });
		await expect(runOneShellCommand(pi.exec, "false", "/tmp", 1000)).resolves.toBe(
			"[Shell error: exit code 2]\noh no\n",
		);
	});
	it("truncates huge stderr on the error path through the same budget", async () => {
		const bigStderr = `${"ERR\n".repeat(20_000)}`; // ~80KB / 20k lines
		const exec = execReturning({ stdout: "", stderr: bigStderr, code: 2 });
		const { pi } = createMockPi({ exec });
		const out = await runOneShellCommand(pi.exec, "failingcmd", "/tmp", 1000);
		expect(out.startsWith("[Shell error: exit code 2]\n")).toBe(true);
		expect(out.length).toBeLessThan(bigStderr.length);
		expect(out).toMatch(/\[truncated: hit .+\]$/);
	});
});

describe("executeShellInBody", () => {
	it("returns body unchanged when no shell syntax is present", async () => {
		const exec = execReturning({ stdout: "x" });
		const { pi } = createMockPi({ exec });
		await expect(executeShellInBody("plain body", pi.exec, "/tmp", 1000)).resolves.toBe(
			"plain body",
		);
		expect(exec).not.toHaveBeenCalled();
	});

	it("replaces inline !`cmd` with stdout on success", async () => {
		const exec = execReturning({ stdout: "hello\n" });
		const { pi } = createMockPi({ exec });
		await expect(
			executeShellInBody("before !`echo hi` after", pi.exec, "/tmp", 1000),
		).resolves.toBe("before hello\n after");
	});

	it("replaces a ```! block with stdout on success", async () => {
		const exec = execReturning({ stdout: "line1\nline2\n" });
		const { pi } = createMockPi({ exec });
		const out = await executeShellInBody(
			"before\n```!\ngit status\n```\nafter",
			pi.exec,
			"/tmp",
			1000,
		);
		expect(out).toContain("line1\nline2");
		expect(out).not.toContain("```!");
	});

	it("runs commands sequentially, never in parallel (FR11)", async () => {
		const order: string[] = [];
		const exec = vi.fn(async (_cmd: string, args: string[]) => {
			const cmd = args[1] ?? "";
			order.push(`start:${cmd}`);
			await new Promise((r) => setTimeout(r, 10));
			order.push(`end:${cmd}`);
			return { stdout: cmd, stderr: "", code: 0, killed: false };
		});
		const { pi } = createMockPi({ exec });
		await executeShellInBody("!`a` !`b` !`c`", pi.exec, "/tmp", 1000);
		expect(order).toEqual(["start:a", "end:a", "start:b", "end:b", "start:c", "end:c"]);
	});

	it("mask-and-restore: block output containing literal !`evil` is not re-executed (R2)", async () => {
		const exec = execReturning({ stdout: "echo result !`evil cmd`" });
		const { pi } = createMockPi({ exec });
		const out = await executeShellInBody(
			"X\n```!\ngenerate-something\n```\nY",
			pi.exec,
			"/tmp",
			1000,
		);
		expect(exec).toHaveBeenCalledTimes(1); // only the block ran
		expect(out).toContain("!`evil cmd`"); // inline syntax preserved literally
		expect(out).toContain("X\n");
		expect(out).toContain("\nY");
	});

	it("empty backticks (`` !`` ``) are left verbatim (R3)", async () => {
		const exec = execReturning({ stdout: "x" });
		const { pi } = createMockPi({ exec });
		const out = await executeShellInBody("prose with !`` empty backticks", pi.exec, "/tmp", 1000);
		expect(exec).not.toHaveBeenCalled();
		expect(out).toBe("prose with !`` empty backticks");
	});

	it("inline pattern does not match across newlines", async () => {
		const exec = execReturning({ stdout: "x" });
		const { pi } = createMockPi({ exec });
		const out = await executeShellInBody("!`echo a\necho b`", pi.exec, "/tmp", 1000);
		expect(exec).not.toHaveBeenCalled();
		expect(out).toBe("!`echo a\necho b`");
	});

	it("forwards cwd and timeout through to exec", async () => {
		const exec = execReturning({ stdout: "" });
		const { pi } = createMockPi({ exec });
		await executeShellInBody("!`x`", pi.exec, "/some/cwd", 7777);
		expect(exec).toHaveBeenCalledWith(expect.any(String), expect.any(Array), {
			cwd: "/some/cwd",
			timeout: 7777,
		});
	});
});
