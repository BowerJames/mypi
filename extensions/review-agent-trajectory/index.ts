/**
 * Review Agent Trajectory Extension
 *
 * Registers a /review-agent-trajectory command that:
 * 1. Extracts the full session transcript (what the agent saw)
 * 2. Writes it to a temp file
 * 3. Spawns a mypi --profile review-agent-trajectory subprocess to review it
 * 4. Shows a spinner while running
 * 5. Injects the review output as a custom message visible to the main agent
 */

import { execSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { BorderedLoader } from "@mariozechner/pi-coding-agent";
import { formatTranscript } from "./transcript.js";

/** Resolve the mypi binary path, falling back to "mypi" if not found. */
function resolveMypiBinary(): string {
  try {
    return execSync("which mypi", { encoding: "utf-8" }).trim();
  } catch {
    return "mypi";
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("review-agent-trajectory", {
    description:
      "Review the agent's trajectory and skill usage via a separate agent process",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify(
          "review-agent-trajectory requires interactive mode",
          "error",
        );
        return;
      }

      // 1. Build the session context — exactly what the agent saw
      const { messages } = ctx.sessionManager.buildSessionContext();

      if (messages.length === 0) {
        ctx.ui.notify("No conversation to review", "error");
        return;
      }

      // 2. Format the full transcript
      const transcript = formatTranscript(messages);

      // 3. Write transcript to a temp file
      let tmpDir: string;
      let tmpFilePath: string;
      try {
        tmpDir = await fs.promises.mkdtemp(
          path.join(os.tmpdir(), "mypi-trajectory-"),
        );
        tmpFilePath = path.join(tmpDir, "transcript.txt");
        await fs.promises.writeFile(tmpFilePath, transcript, "utf-8");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Failed to write transcript: ${message}`, "error");
        return;
      }

      // 4. Show spinner and spawn the subprocess
      const result = await ctx.ui.custom<string | null>(
        (tui, theme, _kb, done) => {
          const loader = new BorderedLoader(
            tui,
            theme,
            "Reviewing agent trajectory...",
          );
          loader.onAbort = async () => {
            await cleanup();
            done(null);
          };

          const cleanup = async () => {
            try {
              await fs.promises.unlink(tmpFilePath);
              await fs.promises.rmdir(tmpDir);
            } catch {
              // Best effort cleanup
            }
          };

          const doReview = async () => {
            const args = [
              "--profile",
              "review-agent-trajectory",
              `/review-agent-trajectory "${tmpFilePath}"`,
            ];

            const result = await new Promise<{
              code: number;
              stdout: string;
              stderr: string;
            }>((resolve) => {
              const mypiBin = resolveMypiBinary();
              const proc = spawn(mypiBin, args, {
                cwd: ctx.cwd,
                shell: false,
                stdio: ["ignore", "pipe", "pipe"],
              });

              let stdout = "";
              let stderr = "";

              proc.stdout.on("data", (data: Buffer) => {
                stdout += data.toString();
              });

              proc.stderr.on("data", (data: Buffer) => {
                stderr += data.toString();
              });

              proc.on("close", (code) => {
                resolve({ code: code ?? 0, stdout, stderr });
              });

              proc.on("error", () => {
                resolve({ code: 1, stdout, stderr });
              });

              if (loader.signal) {
                const killProc = () => {
                  proc.kill("SIGTERM");
                  setTimeout(() => {
                    if (!proc.killed) proc.kill("SIGKILL");
                  }, 5000);
                };
                if (loader.signal.aborted) killProc();
                else
                  loader.signal.addEventListener("abort", killProc, {
                    once: true,
                  });
              }
            });

            // Clean up temp file
            try {
              await fs.promises.unlink(tmpFilePath);
              await fs.promises.rmdir(tmpDir);
            } catch {
              // Best effort cleanup
            }

            if (result.code !== 0) {
              const detail = result.stderr.trim() || `exit code ${result.code}`;
              throw new Error(`mypi failed: ${detail}`);
            }

            return result.stdout.trim();
          };

          doReview()
            .then((output) => done(output ?? null))
            .catch((err) => {
              const message = err instanceof Error ? err.message : String(err);
              console.error("Trajectory review failed:", message);
              done(null);
            });

          return loader;
        },
      );

      if (result === null) {
        ctx.ui.notify("Review cancelled", "info");
        return;
      }

      if (!result) {
        ctx.ui.notify("Review produced no output", "warning");
        return;
      }

      // 5. Inject the review as a custom message visible to the main agent
      pi.sendMessage({
        customType: "review-agent-trajectory",
        content: result,
        display: true,
      });

      ctx.ui.notify("Trajectory review complete", "success");
    },
  });
}
