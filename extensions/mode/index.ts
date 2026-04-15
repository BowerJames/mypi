/**
 * Mode Extension
 *
 * Lightweight, mutually exclusive mode system for project-specific agent modes.
 * Only one mode can be active at a time. Modes can provide a prompt suffix,
 * an activation message, or both.
 *
 * Commands:
 *   /mode               — clear active mode
 *   /mode <name>        — activate mode (toggle off if already active)
 *   /plan               — shorthand for /mode plan
 *   /develop            — toggle develop mode
 *
 * Adding a new mode: create a config file and add an entry to the MODES registry below.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { DEVELOP_WORKFLOW_INSTRUCTIONS, developConfig } from "./develop.js";
import { PLAN_WORKFLOW_INSTRUCTIONS, planConfig } from "./plan.js";
import type { ModeConfig } from "./types.js";

const PLAN_DEACTIVATED_MESSAGE =
  "Plan mode has been deactivated. You may now make file writes, edits, and other changes as needed.";

const DEVELOP_DEACTIVATED_MESSAGE = "Develop mode has been deactivated.";

const MODES: Record<string, ModeConfig> = {
  plan: planConfig,
  develop: developConfig,
};

export default function modeExtension(pi: ExtensionAPI): void {
  let activeMode: string | null = null;

  const availableModes = Object.keys(MODES).join(", ");

  function updateStatus(ctx: ExtensionContext): void {
    if (!activeMode || !(activeMode in MODES)) {
      ctx.ui.setStatus("active-mode", undefined);
      return;
    }

    const label = MODES[activeMode].label;
    const color = activeMode === "develop" ? "accent" : "warning";
    ctx.ui.setStatus("active-mode", ctx.ui.theme.fg(color, label));
  }

  async function setMode(
    mode: string | null,
    ctx: ExtensionContext,
  ): Promise<void> {
    const previousMode = activeMode;

    // Toggle off if same mode already active
    let effectiveMode = mode;
    if (effectiveMode !== null && activeMode === effectiveMode) {
      effectiveMode = null;
    }

    activeMode = effectiveMode;
    pi.appendEntry("mode", { mode: activeMode });
    updateStatus(ctx);

    // Send deactivation messages
    if (previousMode === "plan" && activeMode !== "plan") {
      pi.sendMessage({
        customType: "plan-deactivated",
        content: PLAN_DEACTIVATED_MESSAGE,
        display: true,
      });
    }
    if (previousMode === "develop" && activeMode !== "develop") {
      pi.sendMessage({
        customType: "develop-deactivated",
        content: DEVELOP_DEACTIVATED_MESSAGE,
        display: true,
      });
    }

    if (activeMode) {
      ctx.ui.notify(`Mode: ${MODES[activeMode].label}`, "info");

      if (activeMode === "plan") {
        pi.sendMessage({
          customType: "plan-context",
          content: PLAN_WORKFLOW_INSTRUCTIONS,
          display: true,
        });
      } else if (activeMode === "develop") {
        pi.sendMessage({
          customType: "develop-context",
          content: DEVELOP_WORKFLOW_INSTRUCTIONS,
          display: true,
        });
      }
    } else {
      ctx.ui.notify("Mode cleared", "info");
    }
  }

  // --- Commands ---

  pi.registerCommand("mode", {
    description: "Set or clear agent mode",
    handler: async (args, ctx) => {
      const name = args.trim();

      if (!name) {
        if (activeMode) {
          await setMode(null, ctx);
        }
        return;
      }

      if (!(name in MODES)) {
        ctx.ui.notify(
          `Unknown mode: ${name}. Available: ${availableModes}`,
          "error",
        );
        return;
      }

      await setMode(name, ctx);
    },
  });

  pi.registerCommand("plan", {
    description: "Toggle plan mode",
    handler: async (_args, ctx) => {
      if (activeMode === "plan") {
        await setMode(null, ctx);
      } else {
        await setMode("plan", ctx);
      }
    },
  });

  pi.registerCommand("develop", {
    description: "Toggle develop mode",
    handler: async (_args, ctx) => {
      if (activeMode === "develop") {
        await setMode(null, ctx);
      } else {
        await setMode("develop", ctx);
      }
    },
  });

  // --- Events ---

  // Append suffix to user messages for modes that have one
  pi.on("input", async (event) => {
    if (!activeMode || !(activeMode in MODES)) return;
    if (event.source === "extension") return;

    const config = MODES[activeMode];
    if (!config.suffix) return;

    return {
      action: "transform",
      text: `${event.text}\n\n${config.suffix}`,
    };
  });

  // Restore mode on session start/resume
  pi.on("session_start", async (_event, ctx) => {
    const entries = ctx.sessionManager.getEntries();
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.type === "custom" && entry.customType === "mode") {
        const data = entry.data;
        if (data?.mode && typeof data.mode === "string" && data.mode in MODES) {
          activeMode = data.mode;
        }
        break;
      }
    }

    updateStatus(ctx);
  });
}
