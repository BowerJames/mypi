import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { loadConfig, saveConfig } from "./config.js";
import { discoverExtensions, discoverPrompts, discoverSkills } from "./resources.js";
import type { Config, Profile } from "./types.js";

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

function displayConfig(config: Config): void {
	console.log(`\n  default: ${config.default ?? "(none)"}`);
	const profileNames = Object.keys(config.profiles);
	console.log(`  profiles: ${formatList(profileNames)}\n`);
}

function displayProfile(profile: Profile): void {
	console.log(`  cmd: "${profile.cmd}"`);
	console.log(`  extensions: ${formatList(profile.extensions ?? [])}`);
	console.log(`  skills: ${formatList(profile.skills ?? [])}`);
	console.log(`  prompts: ${formatList(profile.prompts ?? [])}`);
}

// ---------------------------------------------------------------------------
// Configure command
// ---------------------------------------------------------------------------

export async function configureConfig(cwd: string): Promise<void> {
	const config = loadConfig(cwd);
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
			displayConfig(config);
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
					await setDefault(rl, config, isCancelled);
					break;
				case "2":
					await addProfile(rl, config, isCancelled);
					break;
				case "3":
					await removeProfile(rl, config, isCancelled);
					break;
				case "4":
					await editProfile(rl, config, isCancelled);
					break;
				case "5":
					saveConfig(cwd, config);
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
// Sub-flows
// ---------------------------------------------------------------------------

async function setDefault(rl: Readline, config: Config, isCancelled: () => boolean): Promise<void> {
	const profileNames = Object.keys(config.profiles);
	if (profileNames.length === 0) {
		console.log("  No profiles available.");
		return;
	}

	const name = await promptChoice(rl, "Select default profile:", profileNames, isCancelled);
	config.default = name;
	console.log(`\n  Default profile set to: ${name}`);
}

async function addProfile(rl: Readline, config: Config, isCancelled: () => boolean): Promise<void> {
	const name = await promptRequired(rl, "Profile name: ", isCancelled);

	if (!isValidProfileName(name)) {
		console.log("  Invalid name. Use only letters, numbers, hyphens, and underscores.");
		return;
	}

	if (config.profiles[name]) {
		console.log(`  Profile "${name}" already exists.`);
		return;
	}

	const cmd = await promptRequired(rl, "cmd: ", isCancelled);
	const extensions = await promptMultiSelect(
		rl,
		"Extensions",
		discoverExtensions(),
		[],
		isCancelled,
	);
	const skills = await promptMultiSelect(rl, "Skills", discoverSkills(), [], isCancelled);
	const prompts = await promptMultiSelect(rl, "Prompts", discoverPrompts(), [], isCancelled);

	config.profiles[name] = {
		cmd,
		...(extensions.length > 0 && { extensions }),
		...(skills.length > 0 && { skills }),
		...(prompts.length > 0 && { prompts }),
	};

	const setDefault = await promptYesNo(rl, `Set "${name}" as the default profile?`, isCancelled);
	if (setDefault) {
		config.default = name;
	}

	console.log(`\n  Profile "${name}" added.`);
}

async function removeProfile(
	rl: Readline,
	config: Config,
	isCancelled: () => boolean,
): Promise<void> {
	const profileNames = Object.keys(config.profiles);
	if (profileNames.length === 0) {
		console.log("  No profiles available.");
		return;
	}

	const name = await promptChoice(rl, "Select profile to remove:", profileNames, isCancelled);

	if (name === config.default) {
		console.log(`  Cannot remove the default profile "${name}". Set a different default first.`);
		return;
	}

	delete config.profiles[name];
	console.log(`\n  Profile "${name}" removed.`);
}

async function editProfile(
	rl: Readline,
	config: Config,
	isCancelled: () => boolean,
): Promise<void> {
	const profileNames = Object.keys(config.profiles);
	if (profileNames.length === 0) {
		console.log("  No profiles available.");
		return;
	}

	const name = await promptChoice(rl, "Select profile to edit:", profileNames, isCancelled);
	const profile = config.profiles[name];

	while (true) {
		console.log(`\n  Editing profile: ${name}`);
		displayProfile(profile);
		console.log("\n  1. Edit cmd");
		console.log("  2. Edit extensions");
		console.log("  3. Edit skills");
		console.log("  4. Edit prompts");
		console.log("  5. Back\n");

		const choice = await promptRequired(rl, "Choose an option: ", isCancelled);

		switch (choice) {
			case "1": {
				console.log(`  Current cmd: "${profile.cmd}"`);
				const newCmd = await prompt(rl, "New cmd (press Enter to keep current): ", isCancelled);
				if (!newCmd) {
					console.log("  cmd unchanged.");
					break;
				}
				profile.cmd = newCmd;
				console.log("  cmd updated.");
				break;
			}
			case "2": {
				const newExts = await promptMultiSelect(
					rl,
					"Extensions",
					discoverExtensions(),
					profile.extensions ?? [],
					isCancelled,
				);
				profile.extensions = newExts.length > 0 ? newExts : undefined;
				console.log("  extensions updated.");
				break;
			}
			case "3": {
				const newSkills = await promptMultiSelect(
					rl,
					"Skills",
					discoverSkills(),
					profile.skills ?? [],
					isCancelled,
				);
				profile.skills = newSkills.length > 0 ? newSkills : undefined;
				console.log("  skills updated.");
				break;
			}
			case "4": {
				const newPrompts = await promptMultiSelect(
					rl,
					"Prompts",
					discoverPrompts(),
					profile.prompts ?? [],
					isCancelled,
				);
				profile.prompts = newPrompts.length > 0 ? newPrompts : undefined;
				console.log("  prompts updated.");
				break;
			}
			case "5":
				return;
			default:
				console.log("  Invalid option. Please enter a number 1-5.");
		}
	}
}
