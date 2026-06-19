import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_CONFIG_YAML =
	"default: default\n" + "\n" + "profiles:\n" + "  default:\n" + '    cmd: "pi"\n';

export function writeDefaultConfig(cwd: string): void {
	const configPath = resolve(cwd, "mypi-config.yaml");

	if (existsSync(configPath)) {
		throw new Error("mypi-config.yaml already exists.");
	}

	writeFileSync(configPath, DEFAULT_CONFIG_YAML, "utf-8");
}
