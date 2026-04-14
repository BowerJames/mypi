// Placeholder extension for the mypi project.
// Replace with your own extension logic.
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Mode extension loaded", "info");
  });
}
