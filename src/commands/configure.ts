import { checkbox, confirm, input, select } from "@inquirer/prompts";
import { formatErrors, loadConfig, writeConfig } from "../config/loader.js";
import type { MypiConfig, Profile } from "../config/schema.js";
import { discoverAll } from "../resources/resolver.js";

async function mainMenu(): Promise<string> {
  return select({
    message: "What would you like to do?",
    choices: [
      { name: "Set default profile", value: "set-default" },
      { name: "Add new profile", value: "add" },
      { name: "Edit existing profile", value: "edit" },
      { name: "Remove profile", value: "remove" },
      { name: "Done", value: "done" },
    ],
  });
}

async function editProfile(
  profile: Profile,
  resources: Awaited<ReturnType<typeof discoverAll>>,
  isExisting: boolean,
): Promise<Profile> {
  const updated = { ...profile };

  // Edit cmd
  const cmdValue = await input({
    message: "Command (e.g. 'pi' or 'pi -p'):",
    default: profile.cmd,
  });
  updated.cmd = cmdValue.trim();

  // Check for stale resources and warn
  const staleNames: string[] = [];
  for (const name of profile.extensions ?? []) {
    if (!resources.extensions.find((r) => r.name === name)) {
      staleNames.push(`extension "${name}"`);
    }
  }
  for (const name of profile.skills ?? []) {
    if (!resources.skills.find((r) => r.name === name)) {
      staleNames.push(`skill "${name}"`);
    }
  }
  for (const name of profile.prompts ?? []) {
    if (!resources.prompts.find((r) => r.name === name)) {
      staleNames.push(`prompt "${name}"`);
    }
  }

  if (staleNames.length > 0) {
    console.warn(
      `\nWarning: The following configured resources no longer exist in the bundled set:\n${staleNames.map((s) => `  - ${s}`).join("\n")}\nThey have been preserved in the config. You may want to remove them manually.\n`,
    );
  }

  // Select extensions
  if (resources.extensions.length > 0) {
    const currentExts = (profile.extensions ?? []).filter((n) =>
      resources.extensions.find((r) => r.name === n),
    );
    const selectedExts = await checkbox({
      message: "Select extensions:",
      choices: resources.extensions.map((r) => ({
        name: r.name,
        value: r.name,
        checked: currentExts.includes(r.name),
      })),
    });
    updated.extensions = selectedExts;
  } else {
    console.log("No bundled extensions available.");
    updated.extensions = [];
  }

  // Select skills
  if (resources.skills.length > 0) {
    const currentSkills = (profile.skills ?? []).filter((n) =>
      resources.skills.find((r) => r.name === n),
    );
    const selectedSkills = await checkbox({
      message: "Select skills:",
      choices: resources.skills.map((r) => ({
        name: r.name,
        value: r.name,
        checked: currentSkills.includes(r.name),
      })),
    });
    updated.skills = selectedSkills;
  } else {
    console.log("No bundled skills available.");
    updated.skills = [];
  }

  // Select prompts
  if (resources.prompts.length > 0) {
    const currentPrompts = (profile.prompts ?? []).filter((n) =>
      resources.prompts.find((r) => r.name === n),
    );
    const selectedPrompts = await checkbox({
      message: "Select prompts:",
      choices: resources.prompts.map((r) => ({
        name: r.name,
        value: r.name,
        checked: currentPrompts.includes(r.name),
      })),
    });
    updated.prompts = selectedPrompts;
  } else {
    console.log("No bundled prompts available.");
    updated.prompts = [];
  }

  return updated;
}

export async function runConfigure(cwd: string): Promise<void> {
  const { config, errors } = await loadConfig(cwd);

  if (!config) {
    console.error(
      `Error: Cannot open configure wizard — mypi configuration issue:\n${formatErrors(errors)}`,
    );
    console.error("Run 'mypi init' to create a configuration file first.");
    process.exit(1);
  }

  const resources = await discoverAll();
  const workingConfig: MypiConfig = JSON.parse(JSON.stringify(config));

  console.log(
    `Loaded config with profiles: ${Object.keys(workingConfig.profiles).join(", ")}`,
  );
  console.log(`Default profile: ${workingConfig.default}\n`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const action = await mainMenu();

    switch (action) {
      case "set-default": {
        const profileNames = Object.keys(workingConfig.profiles);
        const newDefault = await select({
          message: "Select default profile:",
          choices: profileNames.map((n) => ({
            name: n,
            value: n,
          })),
        });
        workingConfig.default = newDefault;
        console.log(`Default profile set to "${newDefault}".`);
        break;
      }

      case "add": {
        const name = await input({
          message: "Profile name:",
          validate: (value) => {
            if (!value.trim()) return "Profile name is required.";
            if (workingConfig.profiles[value.trim()]) {
              return `Profile "${value.trim()}" already exists.`;
            }
            return true;
          },
        });

        const newProfile = await editProfile(
          { cmd: "pi", extensions: [], skills: [], prompts: [] },
          resources,
          false,
        );
        workingConfig.profiles[name.trim()] = newProfile;
        console.log(`Profile "${name.trim()}" added.`);
        break;
      }

      case "edit": {
        const profileNames = Object.keys(workingConfig.profiles);
        const selected = await select({
          message: "Select profile to edit:",
          choices: profileNames.map((n) => ({
            name: n,
            value: n,
          })),
        });

        const updated = await editProfile(
          workingConfig.profiles[selected],
          resources,
          true,
        );
        workingConfig.profiles[selected] = updated;
        console.log(`Profile "${selected}" updated.`);
        break;
      }

      case "remove": {
        const profileNames = Object.keys(workingConfig.profiles);
        const selected = await select({
          message: "Select profile to remove:",
          choices: profileNames.map((n) => ({
            name: n,
            value: n,
          })),
        });

        if (selected === workingConfig.default) {
          console.error(
            `Error: Cannot remove the default profile "${selected}". Set a different default first.`,
          );
          break;
        }

        const confirmed = await confirm({
          message: `Are you sure you want to remove profile "${selected}"?`,
          default: false,
        });

        if (confirmed) {
          delete workingConfig.profiles[selected];
          console.log(`Profile "${selected}" removed.`);
        } else {
          console.log("Cancelled.");
        }
        break;
      }

      case "done": {
        const filePath = await writeConfig(cwd, workingConfig);
        console.log(`\nConfiguration saved to ${filePath}`);
        return;
      }
    }

    console.log("");
  }
}
