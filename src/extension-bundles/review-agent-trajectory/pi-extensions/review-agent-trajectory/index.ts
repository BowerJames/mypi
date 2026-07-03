import { randomUUID } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	BorderedLoader,
	type ExtensionAPI,
	type SessionManager,
} from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";
import { formatSessionTranscript, type SessionMessage } from "./transcript.js";

type ExecResult = Awaited<ReturnType<ExtensionAPI["exec"]>>;

const RESPONSE_MESSAGE_TYPE = "review-agent-trajectory-response";
const SUBPROCESS_TIMEOUT = 1_000_000;

export default function reviewAgentTrajectoryExtension(pi: ExtensionAPI): void {
	pi.registerMessageRenderer(RESPONSE_MESSAGE_TYPE, (message, { expanded }, theme) => {
		const content =
			typeof message.content === "string"
				? message.content
				: JSON.stringify(message.content, null, 2);
		const label = expanded ? "review-agent-trajectory" : "trajectory review";
		const rendered = `${theme.fg("accent", label)}\n${content}`;
		const box = new Box(1, 1, (t) => theme.bg("customMessageBg", t));
		box.addChild(new Text(rendered, 0, 0));
		return box;
	});

	pi.registerCommand("review-agent-trajectory", {
		description: "Review the current agent trajectory for skill gaps and improvements",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("review-agent-trajectory requires interactive mode", "error");
				return;
			}

			const context = (ctx.sessionManager as unknown as SessionManager).buildSessionContext();
			const messages = context.messages as SessionMessage[];

			if (messages.length === 0) {
				ctx.ui.notify("No conversation available to review.", "warning");
				return;
			}

			const transcript = formatSessionTranscript(messages);
			const tmpFile = join(tmpdir(), `mypi-transcript-${randomUUID()}.md`);

			try {
				writeFileSync(tmpFile, transcript, "utf-8");

				const result = await ctx.ui.custom<ExecResult | string | null>((tui, theme, _kb, done) => {
					const loader = new BorderedLoader(tui, theme, "Running trajectory review...");
					loader.onAbort = () => done(null);

					pi.exec(
						"mypi",
						["--profile", "review-agent-trajectory", `/review-agent-trajectory ${tmpFile}`],
						{ signal: loader.signal, timeout: SUBPROCESS_TIMEOUT },
					)
						.then((execResult) => done(execResult))
						.catch((err) => done((err as Error).message));

					return loader;
				});

				if (result === null) {
					ctx.ui.notify("Review subprocess cancelled.", "info");
					return;
				}

				if (typeof result === "string") {
					ctx.ui.notify(`Failed to launch review subprocess: ${result}`, "error");
					return;
				}

				if (result.code !== 0) {
					const stderr = result.stderr.trim();
					ctx.ui.notify(
						`Review subprocess failed (exit ${result.code})${stderr ? `: ${stderr}` : ""}`,
						"error",
					);
					return;
				}

				const output = result.stdout.trim();
				if (!output) {
					ctx.ui.notify("Review subprocess produced no output.", "warning");
					return;
				}

				pi.sendMessage({
					customType: RESPONSE_MESSAGE_TYPE,
					content: output,
					display: true,
				});
			} finally {
				try {
					unlinkSync(tmpFile);
				} catch {
					// temp file cleanup is best-effort
				}
			}
		},
	});
}
