import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { ConfigValidationError, MypiConfig } from "./schema.js";

const DEFAULT_CONFIG = `default: assistant
profiles:
  assistant:
    cmd: pi
`;

function validateProfile(
  name: string,
  profile: unknown,
  path: string,
): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];

  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    errors.push({ path, message: `Profile "${name}" must be an object` });
    return errors;
  }

  const p = profile as Record<string, unknown>;

  if (p.cmd === undefined || typeof p.cmd !== "string" || p.cmd.trim() === "") {
    errors.push({
      path: `${path}.cmd`,
      message: `Profile "${name}" must have a non-empty "cmd" string`,
    });
  }

  if (p.extensions !== undefined) {
    if (!Array.isArray(p.extensions)) {
      errors.push({
        path: `${path}.extensions`,
        message: `"extensions" in profile "${name}" must be an array of strings`,
      });
    } else if (!p.extensions.every((e: unknown) => typeof e === "string")) {
      errors.push({
        path: `${path}.extensions`,
        message: `All items in "extensions" of profile "${name}" must be strings`,
      });
    }
  }

  if (p.skills !== undefined) {
    if (!Array.isArray(p.skills)) {
      errors.push({
        path: `${path}.skills`,
        message: `"skills" in profile "${name}" must be an array of strings`,
      });
    } else if (!p.skills.every((s: unknown) => typeof s === "string")) {
      errors.push({
        path: `${path}.skills`,
        message: `All items in "skills" of profile "${name}" must be strings`,
      });
    }
  }

  if (p.prompts !== undefined) {
    if (!Array.isArray(p.prompts)) {
      errors.push({
        path: `${path}.prompts`,
        message: `"prompts" in profile "${name}" must be an array of strings`,
      });
    } else if (!p.prompts.every((p2: unknown) => typeof p2 === "string")) {
      errors.push({
        path: `${path}.prompts`,
        message: `All items in "prompts" of profile "${name}" must be strings`,
      });
    }
  }

  return errors;
}

export function validateConfig(data: unknown): {
  config: MypiConfig | null;
  errors: ConfigValidationError[];
} {
  const errors: ConfigValidationError[] = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      config: null,
      errors: [{ path: "", message: "Config must be an object" }],
    };
  }

  const obj = data as Record<string, unknown>;

  if (
    obj.default === undefined ||
    typeof obj.default !== "string" ||
    obj.default.trim() === ""
  ) {
    errors.push({
      path: "default",
      message:
        '"default" must be a non-empty string referencing a profile name',
    });
  }

  if (
    !obj.profiles ||
    typeof obj.profiles !== "object" ||
    Array.isArray(obj.profiles)
  ) {
    errors.push({
      path: "profiles",
      message:
        '"profiles" must be an object mapping profile names to configurations',
    });
    return { config: null, errors };
  }

  const profiles = obj.profiles as Record<string, unknown>;
  const profileNames = Object.keys(profiles);

  if (profileNames.length === 0) {
    errors.push({
      path: "profiles",
      message: '"profiles" must contain at least one profile',
    });
  }

  for (const [name, profile] of Object.entries(profiles)) {
    errors.push(...validateProfile(name, profile, `profiles.${name}`));
  }

  if (errors.length === 0 && typeof obj.default === "string") {
    if (!(obj.default in profiles)) {
      errors.push({
        path: "default",
        message: `Default profile "${obj.default}" does not exist in profiles. Available: ${profileNames.join(", ")}`,
      });
    }
  }

  if (errors.length > 0) {
    return { config: null, errors };
  }

  const config: MypiConfig = {
    default: obj.default as string,
    profiles: {},
  };

  for (const [name, profile] of Object.entries(profiles)) {
    const p = profile as Record<string, unknown>;
    config.profiles[name] = {
      extensions: (p.extensions as string[]) ?? [],
      skills: (p.skills as string[]) ?? [],
      prompts: (p.prompts as string[]) ?? [],
      cmd: p.cmd as string,
    };
  }

  return { config, errors: [] };
}

export function formatErrors(errors: ConfigValidationError[]): string {
  return errors
    .map((e) => `  - ${e.path ? `${e.path}: ` : ""}${e.message}`)
    .join("\n");
}

export async function loadConfig(cwd: string): Promise<{
  config: MypiConfig | null;
  errors: ConfigValidationError[];
  filePath?: string;
}> {
  const filePath = resolve(cwd, "mypi.yaml");

  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    return {
      config: null,
      errors: [{ path: "", message: `No mypi.yaml found in ${cwd}` }],
    };
  }

  let data: unknown;
  try {
    data = parseYaml(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      config: null,
      errors: [{ path: "", message: `Failed to parse mypi.yaml: ${message}` }],
      filePath,
    };
  }

  const result = validateConfig(data);
  return { ...result, filePath };
}

export async function writeConfig(
  cwd: string,
  config: MypiConfig,
): Promise<string> {
  const filePath = resolve(cwd, "mypi.yaml");
  // Build a clean object without empty arrays
  const obj: {
    default: string;
    profiles: Record<string, Record<string, unknown>>;
  } = {
    default: config.default,
    profiles: {},
  };
  for (const [name, profile] of Object.entries(config.profiles)) {
    const clean: Record<string, unknown> = { cmd: profile.cmd };
    if (profile.extensions && profile.extensions.length > 0) {
      clean.extensions = profile.extensions;
    }
    if (profile.skills && profile.skills.length > 0) {
      clean.skills = profile.skills;
    }
    if (profile.prompts && profile.prompts.length > 0) {
      clean.prompts = profile.prompts;
    }
    obj.profiles[name] = clean;
  }
  const content = stringifyYaml(obj, { lineWidth: 0 });
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

export async function initConfig(cwd: string, force = false): Promise<string> {
  const filePath = resolve(cwd, "mypi.yaml");

  if (!force) {
    try {
      await access(filePath);
      throw new Error(
        `mypi.yaml already exists in ${cwd}. Use --force to overwrite.`,
      );
    } catch (err) {
      if (err instanceof Error && err.message.includes("already exists")) {
        throw err;
      }
      // File doesn't exist (ENOENT), proceed
    }
  }

  try {
    await writeFile(filePath, DEFAULT_CONFIG, "utf-8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to write mypi.yaml: ${message}`);
  }
  return filePath;
}
