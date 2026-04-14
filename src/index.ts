import { defineCommand, renderUsage, runMain } from "citty";
import { runConfigure } from "./commands/configure.js";
import { runInit } from "./commands/init.js";
import { filterPassthroughArgs, runProfile } from "./commands/run.js";

const SUBCOMMAND_NAMES = new Set(["init", "configure"]);

const initCmd = defineCommand({
  meta: {
    name: "init",
    description:
      "Create a mypi.yaml configuration file in the current directory.",
  },
  args: {
    force: {
      type: "boolean",
      description: "Overwrite existing mypi.yaml",
      alias: "f",
      default: false,
    },
  },
  async run({ args }) {
    await runInit(process.cwd(), args.force as boolean);
  },
});

const configureCmd = defineCommand({
  meta: {
    name: "configure",
    description:
      "Launch an interactive wizard to manage profiles in mypi.yaml.",
  },
  async run() {
    await runConfigure(process.cwd());
  },
});

const main = defineCommand({
  meta: {
    name: "mypi",
    description:
      "CLI tool that manages pi coding agent profiles, bundling extensions, skills, and prompt templates.",
    version: "0.1.0",
  },
  args: {
    profile: {
      type: "string",
      description:
        "Profile name to use (defaults to the default profile in mypi.yaml)",
      alias: "p",
    },
  },
  async run({ args, rawArgs }) {
    const { subcommand } = resolveRouting(rawArgs);

    if (subcommand === "init") {
      const force = rawArgs.includes("--force") || rawArgs.includes("-f");
      await runInit(process.cwd(), force);
      return;
    }

    if (subcommand === "configure") {
      await runConfigure(process.cwd());
      return;
    }

    // Default: launch pi with profile
    const passthrough = filterPassthroughArgs(rawArgs);

    await runProfile(
      process.cwd(),
      args.profile as string | undefined,
      passthrough,
    );
  },
});

/**
 * Determines routing: whether the user is invoking a subcommand.
 * Handles the edge case where `--profile init` should NOT be treated
 * as a subcommand invocation.
 */
function resolveRouting(rawArgs: string[]): {
  subcommand: string | null;
} {
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (arg === "--profile" || arg === "-p") {
      // User typed --profile/-p, so this is a profile invocation
      // regardless of whether a value follows
      return { subcommand: null };
    }

    if (arg.startsWith("--profile=")) {
      // Profile value is embedded — not a subcommand
      return { subcommand: null };
    }

    // -pvalue form: profile value is embedded
    if (/^-p(?!-)/.test(arg)) {
      return { subcommand: null };
    }

    // First non-flag arg is the subcommand (if it matches)
    if (!arg.startsWith("-")) {
      if (SUBCOMMAND_NAMES.has(arg)) {
        return { subcommand: arg };
      }
      // First non-flag arg is not a subcommand — no routing
      return { subcommand: null };
    }
  }

  return { subcommand: null };
}

// Pre-process raw args to handle subcommand help before citty's runMain
// intercepts --help (since we don't use citty's subCommands mechanism)
const rawArgs = process.argv.slice(2);
const hasHelpFlag = rawArgs.includes("--help") || rawArgs.includes("-h");
const { subcommand } = resolveRouting(rawArgs);

// Only show subcommand help if the help flag comes after the subcommand name
if (subcommand && hasHelpFlag) {
  const subcommandIndex = rawArgs.indexOf(subcommand);
  const helpIndex = rawArgs.findIndex((a) => a === "--help" || a === "-h");

  // Only treat as subcommand help if help flag appears after subcommand name
  if (helpIndex > subcommandIndex) {
    const cmd = subcommand === "init" ? initCmd : configureCmd;
    renderUsage(cmd as typeof main, main).then((usage) => {
      console.log(usage);
      process.exit(0);
    });
  } else {
    // --help before subcommand name → show main help (citty handles this)
    runMain(main);
  }
} else {
  runMain(main);
}
