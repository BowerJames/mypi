import { defineCommand, renderUsage, runMain } from "citty";
import { runConfigure } from "./commands/configure.js";
import { runInit } from "./commands/init.js";
import { runProfile } from "./commands/run.js";

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
    const firstNonFlag = rawArgs.find((arg) => !arg.startsWith("-"));

    // Route to subcommands manually (avoids citty's subcommand detection
    // which treats the first non-flag arg as a subcommand name even when
    // it's a value consumed by --profile)
    if (firstNonFlag === "init") {
      const force = rawArgs.includes("--force") || rawArgs.includes("-f");
      await runInit(process.cwd(), force);
      return;
    }

    if (firstNonFlag === "configure") {
      await runConfigure(process.cwd());
      return;
    }

    // Default: launch pi with profile
    const passthrough: string[] = [];
    let skipNext = false;

    for (let i = 0; i < rawArgs.length; i++) {
      const arg = rawArgs[i];

      if (skipNext) {
        skipNext = false;
        continue;
      }

      if (arg === "--profile" || arg === "-p") {
        skipNext = true;
        continue;
      }

      // Handle --profile=value and -pvalue forms
      if (arg.startsWith("--profile=") || arg.startsWith("-p")) {
        continue;
      }

      if (
        arg === "--help" ||
        arg === "-h" ||
        arg === "--version" ||
        arg === "-v"
      ) {
        continue;
      }

      passthrough.push(arg);
    }

    await runProfile(
      process.cwd(),
      args.profile as string | undefined,
      passthrough,
    );
  },
});

// Pre-process raw args to handle subcommand help before citty's runMain
// intercepts --help (since we don't use citty's subCommands mechanism)
const rawArgs = process.argv.slice(2);
const firstNonFlag = rawArgs.find((arg) => !arg.startsWith("-"));

if (
  firstNonFlag === "init" &&
  (rawArgs.includes("--help") || rawArgs.includes("-h"))
) {
  renderUsage(initCmd, main).then((usage) => {
    console.log(usage);
    process.exit(0);
  });
} else if (
  firstNonFlag === "configure" &&
  (rawArgs.includes("--help") || rawArgs.includes("-h"))
) {
  renderUsage(configureCmd, main).then((usage) => {
    console.log(usage);
    process.exit(0);
  });
} else {
  runMain(main);
}
