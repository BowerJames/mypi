import { defineCommand, runMain } from "citty";
import { runInit } from "./commands/init.js";
import { runProfile } from "./commands/run.js";
import { runConfigure } from "./commands/configure.js";

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
    force: {
      type: "boolean",
      description: "Overwrite existing mypi.yaml (only for init)",
      alias: "f",
      default: false,
    },
  },
  async run({ args, rawArgs }) {
    const firstNonFlag = rawArgs.find((arg) => !arg.startsWith("-"));

    switch (firstNonFlag) {
      case "init":
        await runInit(process.cwd(), args.force as boolean);
        return;

      case "configure":
        await runConfigure(process.cwd());
        return;
    }

    // Default: launch pi with profile
    // Collect passthrough args (everything after --profile <name>)
    const passthrough: string[] = [];
    let skipping = false;

    for (let i = 0; i < rawArgs.length; i++) {
      const arg = rawArgs[i];
      if (arg === "--profile" || arg === "-p") {
        skipping = true;
        continue;
      }
      if (skipping) {
        skipping = false;
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

runMain(main);
