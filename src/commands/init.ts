import { initConfig } from "../config/loader.js";

export async function runInit(cwd: string, force: boolean): Promise<void> {
  try {
    const filePath = await initConfig(cwd, force);
    console.log(`Created ${filePath}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}
