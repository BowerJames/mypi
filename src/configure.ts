import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import type { UserConfig } from "./cli-config.js";
import { loadUserConfig, saveConfig } from "./cli-config.js";
import type { Profile } from "./profile.js";
import { BUILTIN_DEFAULT, BUILTIN_PROFILES, isBuiltinProfile, mergeProfiles } from "./profile.js";
import { discoverBundles } from "./resources.js";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const PROFILE_NAME_RE = /^[a-zA-Z0-9_-]+$/;
const STALE_SUFFIX = " (stale)";

export function isValidProfileName(name: string): boolean {
	return PROFILE_NAME_RE.test(name);
}

class ConfigureCancelledError extends Error {
	constructor() {
		super("Configure cancelled");
		this.name = "ConfigureCancelledError";
	}
}

// ---------------------------------------------------------------------------
// Prompting helpers
// ---------------------------------------------------------------------------

type Readline = ReturnType<typeof createReadline>;

function createReadline() {
	return createInterface({ input, output });
}

function stripStaleSuffix(value: string): string {
	return value.endsWith(STALE_SUFFIX) ? value.slice(0, -STALE_SUFFIX.length) : value;
}

export function orderMultiSelectResult(
	allOptions: string[],
	currentlySelected: string[],
	selected: Set<string>,
): string[] {
	const result: string[] = [];
	const currentSelectedSet = new Set(currentlySelected);

	for (const name of currentlySelected) {
		const optionName = allOptions.find((option) => stripStaleSuffix(option) === name);
		if (optionName && selected.has(optionName)) {
			result.push(name);
		}
	}

	for (const option of allOptions) {
		const normalized = stripStaleSuffix(option);
		if (currentSelectedSet.has(normalized)) continue;
		if (selected.has(option)) {
			result.push(normalized);
		}
	}

	return result;
}

async function prompt(rl: Readline, question: string, isCancelled: () => boolean): Promise<string> {
	try {
		const answer = await rl.question(question);
		return answer.trim();
	} catch (err) {
		if (isCancelled()) {
			throw new ConfigureCancelledError();
		}
		throw err;
	}
}

async function promptRequired(
	rl: Readline,
	question: string,
	isCancelled: () => boolean,
): Promise<string> {
	while (true) {
		const answer = await prompt(rl, question, isCancelled);
		if (answer) return answer;
		console.log("  Value is required. Please enter something.");
	}
}

async function promptChoice(
	rl: Readline,
	question: string,
	options: string[],
	isCancelled: () => boolean,
): Promise<string> {
	if (options.length === 0) {
		throw new Error("No options available to choose from.");
	}

	while (true) {
		for (let i = 0; i < options.length; i++) {
			console.log(`  ${i + 1}. ${options[i]}`);
		}
		const answer = await prompt(rl, `${question} `, isCancelled);
		const num = parseInt(answer, 10);
		if (num >= 1 && num <= options.length) {
			return options[num - 1];
		}
		console.log("  Invalid selection. Please enter a number from the list.");
	}
}

/**
 * Multi-select with stale entry handling.
 *
 * Stale entries (present in `currentlySelected` but not in `options`) are
 * appended to the list with a "(stale)" suffix and a warning is displayed.
 * Result ordering preserves the existing config order for already-selected
 * items and appends newly selected items in UI order.
 */
async function promptMultiSelect(
	rl: Readline,
	heading: string,
	options: string[],
	currentlySelected: string[],
	isCancelled: () => boolean,
): Promise<string[]> {
	const discoveredSet = new Set(options);
	const staleEntries = currentlySelected.filter((name) => !discoveredSet.has(name));
	const allOptions = [...options, ...staleEntries.map((stale) => `${stale}${STALE_SUFFIX}`)];

	if (allOptions.length === 0) {
		console.log(`  ${heading}: (none available)`);
		return [];
	}

	const selected = new Set<string>();
	for (const name of currentlySelected) {
		selected.add(discoveredSet.has(name) ? name : `${name}${STALE_SUFFIX}`);
	}

	function render(): void {
		console.log(`\n  ${heading} (toggle by number, comma-separated; Enter to confirm):`);
		for (let i = 0; i < allOptions.length; i++) {
			const marker = selected.has(allOptions[i]) ? "x" : " ";
			console.log(`  [${marker}] ${i + 1}. ${allOptions[i]}`);
		}
	}

	if (staleEntries.length > 0) {
		console.log(
			`  ⚠ Stale entries found (no longer available): ${staleEntries.join(", ")}. They are shown at the bottom. Toggle off to remove them.`,
		);
	}

	while (true) {
		render();
		const answer = await prompt(rl, "\n> ", isCancelled);
		if (!answer) break;

		const indices = answer.split(",").map((s) => parseInt(s.trim(), 10));
		let valid = true;
		for (const idx of indices) {
			if (Number.isNaN(idx) || idx < 1 || idx > allOptions.length) {
				console.log(`  Invalid number: ${idx}`);
				valid = false;
			}
		}
		if (!valid) continue;

		for (const idx of indices) {
			const name = allOptions[idx - 1];
			if (selected.has(name)) {
				selected.delete(name);
			} else {
				selected.add(name);
			}
		}
	}

	return orderMultiSelectResult(allOptions, currentlySelected, selected);
}

async function promptYesNo(
	rl: Readline,
	question: string,
	isCancelled: () => boolean,
): Promise<boolean> {
	while (true) {
		const answer = (await prompt(rl, `${question} (y/n) `, isCancelled)).toLowerCase();
		if (answer === "y" || answer === "yes") return true;
		if (answer === "n" || answer === "no") return false;
		console.log('  Please enter "y" or "n".');
	}
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function formatList(items: string[]): string {
	if (items.length === 0) return "(none)";
	return items.join(", ");
}

/**
 * Human-friendly annotation for a profile in the merged set.
 * - built-in with no user override → "[built-in]"
 * - built-in that the user has overridden → "[built-in, overridden]"
 * - pure user profile → "(custom)"
 */
function profileAnnotation(name: string, overlay: UserConfig): string {
	if (isBuiltinProfile(name)) {
		return overlay.profiles && name in overlay.profiles ? "[built-in, overridden]" : "[built-in]";
	}
	return "(custom)";
}

function displayConfig(overlay: UserConfig): void {
	const merged = mergeProfiles(overlay.profiles);
	console.log(
		`\n  default: ${overlay.default ?? BUILTIN_DEFAULT} (set in overlay: ${overlay.default ?? "—"})`,
	);
	const profileNames = Object.keys(merged);
	console.log(
		`  profiles: ${formatList(profileNames.map((n) => `${n} ${profileAnnotation(n, overlay)}`))}\n`,
	);
}

function displayProfile(profile: Profile): void {
	console.log(`  bundles: ${formatList(profile.bundles ?? [])}`);
}

// ---------------------------------------------------------------------------
// Configure command
// ---------------------------------------------------------------------------

export async function configureConfig(cwd: string): Promise<void> {
	const overlay: UserConfig = loadUserConfig(cwd);
	const rl = createReadline();
	let cancelled = false;
	let cleanedUp = false;

	const cleanup = () => {
		if (cleanedUp) return;
		cleanedUp = true;
		process.removeListener("SIGINT", onSigInt);
		rl.close();
	};

	const isCancelled = () => cancelled;

	const onSigInt = () => {
		cancelled = true;
		cleanup();
	};

	process.on("SIGINT", onSigInt);

	try {
		while (true) {
			console.log("\n╭── mypi configure ──────────────────────────────╮");
			displayConfig(overlay);
			console.log("  1. Set default profile");
			console.log("  2. Add profile");
			console.log("  3. Remove profile");
			console.log("  4. Edit profile");
			console.log("  5. Save & exit");
			console.log("  6. Discard & exit");
			console.log("╰──────────────────────────────────────────────────╯\n");

			const choice = await promptRequired(rl, "Choose an option: ", isCancelled);

			switch (choice) {
				case "1":
					await setDefault(rl, overlay, isCancelled);
					break;
				case "2":
					await addProfile(rl, overlay, isCancelled);
					break;
				case "3":
					await removeProfile(rl, overlay, isCancelled);
					break;
				case "4":
					await editProfile(rl, overlay, isCancelled);
					break;
				case "5":
					saveConfig(cwd, overlay);
					console.log("\n  Config saved to mypi-config.yaml\n");
					return;
				case "6":
					return;
				default:
					console.log("  Invalid option. Please enter a number 1-6.");
			}
		}
	} catch (err) {
		if (err instanceof ConfigureCancelledError) {
			return;
		}
		throw err;
	} finally {
		cleanup();
	}
}

// ---------------------------------------------------------------------------
// Sub-flows (operate on the user overlay only; built-ins are visible but not removable)
// ---------------------------------------------------------------------------

async function setDefault(
	rl: Readline,
	overlay: UserConfig,
	isCancelled: () => boolean,
): Promise<void> {
	const merged = mergeProfiles(overlay.profiles);
	const profileNames = Object.keys(merged);
	if (profileNames.length === 0) {
		console.log("  No profiles available.");
		return;
	}

	const name = await promptChoice(rl, "Select default profile:", profileNames, isCancelled);
	overlay.default = name;
	console.log(`\n  Default profile set to: ${name}`);
}

async function addProfile(
	rl: Readline,
	overlay: UserConfig,
	isCancelled: () => boolean,
): Promise<void> {
	const name = await promptRequired(rl, "Profile name: ", isCancelled);

	if (!isValidProfileName(name)) {
		console.log("  Invalid name. Use only letters, numbers, hyphens, and underscores.");
		return;
	}

	// Collisions with a *user* overlay profile are an error. Collisions with a
	// built-in are allowed (the new entry overrides it), but we warn so the
	// user knows they are replacing a shipped profile.
	if (overlay.profiles && name in overlay.profiles) {
		console.log(`  Profile "${name}" already exists in your config.`);
		return;
	}

	const overridesBuiltin = isBuiltinProfile(name);
	if (overridesBuiltin) {
		const proceed = await promptYesNo(
			rl,
			`"${name}" is a built-in profile. Add a user override that replaces it?`,
			isCancelled,
		);
		if (!proceed) {
			console.log("  Aborted.");
			return;
		}
	}

	const bundles = await promptMultiSelect(rl, "Bundles", discoverBundles(), [], isCancelled);

	if (!overlay.profiles) overlay.profiles = {};
	overlay.profiles[name] = bundles.length > 0 ? { bundles } : {};

	const setDefault = await promptYesNo(rl, `Set "${name}" as the default profile?`, isCancelled);
	if (setDefault) {
		overlay.default = name;
	}

	console.log(`\n  Profile "${name}" added${overridesBuiltin ? " (overrides built-in)" : ""}.`);
}

async function removeProfile(
	rl: Readline,
	overlay: UserConfig,
	isCancelled: () => boolean,
): Promise<void> {
	// Removable = anything present in the user overlay (incl. built-in overrides).
	const removable = Object.keys(overlay.profiles ?? {});
	if (removable.length === 0) {
		console.log(
			"  No removable profiles. (Built-ins cannot be removed; override one to change it.)",
		);
		return;
	}

	const name = await promptChoice(rl, "Select profile to remove:", removable, isCancelled);

	// Removing a user override of a built-in restores the built-in; removing a
	// pure-user profile deletes it. Either way the effective `default` must keep
	// resolving. Compute the post-removal effective default against the merged set.
	const wasDefault = (overlay.default ?? BUILTIN_DEFAULT) === name || overlay.default === name;
	if (wasDefault) {
		// After removal, does the current default still resolve? If the default
		// *was* this profile, it must be re-pointed first.
		const currentUserProfiles = overlay.profiles as Record<string, Profile>;
		const remainingProfiles = { ...currentUserProfiles };
		delete remainingProfiles[name];
		const mergedAfter = mergeProfiles(remainingProfiles);
		const defAfter = overlay.default ?? BUILTIN_DEFAULT;
		if (!(defAfter in mergedAfter)) {
			console.log(
				`  Cannot remove "${name}": it is the effective default. Set a different default first.`,
			);
			return;
		}
	}

	if (overlay.profiles) delete overlay.profiles[name];
	console.log(
		`\n  Profile "${name}" removed.${isBuiltinProfile(name) ? " Built-in restored." : ""}`,
	);
}

async function editProfile(
	rl: Readline,
	overlay: UserConfig,
	isCancelled: () => boolean,
): Promise<void> {
	const merged = mergeProfiles(overlay.profiles);
	const profileNames = Object.keys(merged);
	if (profileNames.length === 0) {
		console.log("  No profiles available.");
		return;
	}

	const name = await promptChoice(rl, "Select profile to edit:", profileNames, isCancelled);

	// Resolve the profile to edit. A pure-user profile is edited in place. A
	// built-in *not* yet overridden is copy-on-write: clone into the overlay,
	// then edit the clone (so the original built-in is untouched until save).
	if (!overlay.profiles || !(name in overlay.profiles)) {
		// Built-in, not yet overridden → materialise an override copy.
		const builtin = BUILTIN_PROFILES[name];
		if (!overlay.profiles) overlay.profiles = {};
		overlay.profiles[name] = builtin.bundles ? { bundles: [...builtin.bundles] } : {};
		console.log(`\n  Materialised a user override of built-in "${name}" for editing.`);
	}

	const profiles = overlay.profiles as Record<string, Profile>;
	const profile = profiles[name];

	while (true) {
		const annotation = profileAnnotation(name, overlay);
		console.log(`\n  Editing profile: ${name} ${annotation}`);
		displayProfile(profile);
		console.log("\n  1. Edit bundles");
		console.log("  2. Back\n");

		const choice = await promptRequired(rl, "Choose an option: ", isCancelled);

		switch (choice) {
			case "1": {
				const newBundles = await promptMultiSelect(
					rl,
					"Bundles",
					discoverBundles(),
					profile.bundles ?? [],
					isCancelled,
				);
				profile.bundles = newBundles.length > 0 ? newBundles : undefined;
				console.log("  bundles updated.");
				break;
			}
			case "2":
				return;
			default:
				console.log("  Invalid option. Please enter a number 1-2.");
		}
	}
}
