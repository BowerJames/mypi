import { readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// When running from source: __dirname = src/resources/ → go up 2 levels
// When running bundled:  __dirname = dist/           → go up 0 levels (resources are copied into dist/)
const PACKAGE_ROOT = __dirname.endsWith("dist")
  ? __dirname
  : resolve(__dirname, "..", "..");

const EXTENSIONS_DIR = resolve(PACKAGE_ROOT, "extensions");
const SKILLS_DIR = resolve(PACKAGE_ROOT, "skills");
const PROMPTS_DIR = resolve(PACKAGE_ROOT, "prompts");

export interface ResourceInfo {
  name: string;
  path: string;
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

export async function discoverExtensions(): Promise<ResourceInfo[]> {
  const entries = await safeReaddir(EXTENSIONS_DIR);
  const results: ResourceInfo[] = [];

  for (const entry of entries) {
    const fullPath = join(EXTENSIONS_DIR, entry);

    if (entry.endsWith(".ts")) {
      results.push({ name: entry.replace(/\.ts$/, ""), path: fullPath });
    } else if (await isDirectory(fullPath)) {
      // Check for index.ts
      if (await fileExists(join(fullPath, "index.ts"))) {
        results.push({ name: entry, path: fullPath });
      }
    }
  }

  return results;
}

export async function discoverSkills(): Promise<ResourceInfo[]> {
  const entries = await safeReaddir(SKILLS_DIR);
  const results: ResourceInfo[] = [];

  for (const entry of entries) {
    const fullPath = join(SKILLS_DIR, entry);

    if (await isDirectory(fullPath)) {
      if (await fileExists(join(fullPath, "SKILL.md"))) {
        results.push({ name: entry, path: fullPath });
      }
    }
  }

  return results;
}

export async function discoverPrompts(): Promise<ResourceInfo[]> {
  const entries = await safeReaddir(PROMPTS_DIR);
  const results: ResourceInfo[] = [];

  for (const entry of entries) {
    const fullPath = join(PROMPTS_DIR, entry);

    if (entry.endsWith(".md")) {
      results.push({ name: entry.replace(/\.md$/, ""), path: fullPath });
    }
  }

  return results;
}

export async function discoverAll(): Promise<{
  extensions: ResourceInfo[];
  skills: ResourceInfo[];
  prompts: ResourceInfo[];
}> {
  const [extensions, skills, prompts] = await Promise.all([
    discoverExtensions(),
    discoverSkills(),
    discoverPrompts(),
  ]);

  return { extensions, skills, prompts };
}

export interface ResolveResult {
  extensions: string[]; // resolved absolute paths
  skills: string[];
  prompts: string[];
  stale: { type: "extension" | "skill" | "prompt"; name: string }[];
}

export async function resolveResources(
  extensions?: string[],
  skills?: string[],
  prompts?: string[],
): Promise<ResolveResult> {
  const [allExtensions, allSkills, allPrompts] = await Promise.all([
    discoverExtensions(),
    discoverSkills(),
    discoverPrompts(),
  ]);

  const extMap = new Map(allExtensions.map((e) => [e.name, e.path]));
  const skillMap = new Map(allSkills.map((s) => [s.name, s.path]));
  const promptMap = new Map(allPrompts.map((p) => [p.name, p.path]));

  const result: ResolveResult = {
    extensions: [],
    skills: [],
    prompts: [],
    stale: [],
  };

  for (const name of extensions ?? []) {
    const path = extMap.get(name);
    if (path) {
      result.extensions.push(path);
    } else {
      result.stale.push({ type: "extension", name });
    }
  }

  for (const name of skills ?? []) {
    const path = skillMap.get(name);
    if (path) {
      result.skills.push(path);
    } else {
      result.stale.push({ type: "skill", name });
    }
  }

  for (const name of prompts ?? []) {
    const path = promptMap.get(name);
    if (path) {
      result.prompts.push(path);
    } else {
      result.stale.push({ type: "prompt", name });
    }
  }

  return result;
}
