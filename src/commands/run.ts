import { spawn } from "node:child_process";
import { formatErrors, loadConfig } from "../config/loader.js";
import { resolveResources } from "../resources/resolver.js";
import type { ResolveResult } from "../resources/resolver.js";
import { splitCommand } from "../utils/shell.js";

export interface ProfileConfig {
  cmd: string;
  extensions?: string[];
  skills?: string[];
  prompts?: string[];
}

/**
 * Builds the full command array for spawning pi from a profile configuration.
 */
export function buildProfileCommand(
  profile: ProfileConfig,
  resolved: ResolveResult,
  passthroughArgs: string[],
): string[] {
  const cmdParts: string[] = [...splitCommand(profile.cmd)];

  for (const ext of resolved.extensions) {
    cmdParts.push("-e", ext);
  }

  for (const skill of resolved.skills) {
    cmdParts.push("--skill", skill);
  }

  for (const prompt of resolved.prompts) {
    cmdParts.push("--prompt-template", prompt);
  }

  cmdParts.push(...passthroughArgs);

  return cmdParts;
}

/**
 * Filters passthrough args from raw CLI args, removing mypi-specific flags.
 */
export function filterPassthroughArgs(rawArgs: string[]): string[] {
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

    // Handle --profile=value form
    if (arg.startsWith("--profile=")) {
      continue;
    }

    // Handle -pvalue form (e.g., -passistant), but not --p or -p-
    if (/^-p(?!-)/.test(arg)) {
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

  return passthrough;
}

export async function runProfile(
  cwd: string,
  profileName: string | undefined,
  args: string[],
): Promise<void> {
  const { config, errors } = await loadConfig(cwd);

  if (!config) {
    console.error(`Error: mypi configuration issue:\n${formatErrors(errors)}`);
    process.exit(1);
  }

  const name = profileName ?? config.default;

  if (!config.profiles[name]) {
    const available = Object.keys(config.profiles).join(", ");
    console.error(
      `Error: Profile "${name}" not found. Available profiles: ${available}`,
    );
    process.exit(1);
  }

  const profile = config.profiles[name];

  const resolved = await resolveResources(
    profile.extensions,
    profile.skills,
    profile.prompts,
  );

  // Warn about stale resources
  for (const stale of resolved.stale) {
    console.warn(
      `Warning: ${stale.type} "${stale.name}" not found in bundled resources, skipping.`,
    );
  }

  const cmdParts = buildProfileCommand(profile, resolved, args);
  const [bin, ...binArgs] = cmdParts;

  const child = spawn(bin, binArgs, {
    cwd,
    stdio: "inherit",
    env: { ...process.env },
  });

  child.on("error", (err) => {
    console.error(`Error: Failed to launch "${bin}": ${err.message}`);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}
