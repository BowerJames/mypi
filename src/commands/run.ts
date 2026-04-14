import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { loadConfig, formatErrors } from "../config/loader.js";
import { resolveResources } from "../resources/resolver.js";
import type { MypiConfig } from "../config/schema.js";

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

  // Build the command
  const cmdParts: string[] = [...profile.cmd.split(" ")];

  for (const ext of resolved.extensions) {
    cmdParts.push("-e", ext);
  }

  for (const skill of resolved.skills) {
    cmdParts.push("--skill", skill);
  }

  for (const prompt of resolved.prompts) {
    cmdParts.push("--prompt-template", prompt);
  }

  cmdParts.push(...args);

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
