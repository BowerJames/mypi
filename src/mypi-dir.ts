import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Resolve mypi's per-user state directory.
 *
 * `$MYPI_DIR` if set, otherwise `~/.mypi/`. mypi materialises code-defined
 * bundle skills (see `ExtensionBundleManifest.skills`) under `<dir>/skills/`
 * at resolution time, so the on-disk skill files have a stable home wherever
 * npm installs this package.
 */
export function getMypiDir(): string {
	// `||` (not `??`) so an explicitly-empty MYPI_DIR falls back to the default
	// instead of resolving to "" and silently writing into cwd.
	return process.env.MYPI_DIR || join(homedir(), ".mypi");
}

/**
 * The skills materialisation directory: `<getMypiDir()>/skills/`. Skills
 * declared in code by a bundle manifest are written here as `<name>.md` during
 * `expandBundle`, then handed to pi via `--skill`.
 */
export function getMypiSkillsDir(): string {
	return join(getMypiDir(), "skills");
}
