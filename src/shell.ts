/**
 * Shared shell helpers used by both the profile launcher (cli.ts) and the
 * `mypi run` passthrough (run.ts).
 *
 * Extracted here so run.ts does not need to import from cli.ts (which would
 * create a cli <-> run circular import).
 */

import { spawn } from "node:child_process";

/**
 * Quote a single argument for a POSIX `sh -c` command string.
 *
 * If the argument contains any character outside the safe set
 * `[a-zA-Z0-9_./:=@-]`, it is wrapped in single quotes with any embedded
 * single quotes escaped via the standard `'\''` sequence. Safe tokens are
 * passed through verbatim.
 */
export function shellQuote(a: string): string {
	return /[^a-zA-Z0-9_./:=@-]/.test(a) ? `'${a.replace(/'/g, "'\\''")}'` : a;
}

/**
 * Execute a fully-formed command string via `sh -c`, inheriting stdio and env.
 * Exits the process with the child's exit code (or 1 on spawn error).
 */
export function spawnShell(command: string): void {
	const child = spawn("sh", ["-c", command], {
		stdio: "inherit",
		env: { ...process.env },
	});

	child.on("exit", (code) => {
		process.exit(code ?? 0);
	});

	child.on("error", (err) => {
		console.error(`Failed to execute command: ${err.message}`);
		process.exit(1);
	});
}
