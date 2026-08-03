// ---------------------------------------------------------------------------
// Help flag detection
// ---------------------------------------------------------------------------

/**
 * Check whether an args array contains a help flag (--help or -h).
 */
export function hasHelpFlag(args: string[]): boolean {
	return args.some((a) => a === "--help" || a === "-h");
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

const MAIN_HELP_TEXT = `\
mypi - Profile-based launcher for pi (always runs pi)

USAGE
  mypi [--profile <name>] [--bundle <name>]... [pi options...] [messages...]
  mypi init
  mypi configure

mypi always runs pi. Use --profile to launch a saved bundle-set, --bundle to add
bundles ad hoc, or both to augment a profile. Everything else - -p, --model,
-e ./local.ts, @files, positional messages - forwards to pi verbatim.

EXAMPLES
  mypi                                                launch the default profile
  mypi --profile reviewer                             launch a saved bundle-set
  mypi --bundle code-review-prompt                    ad-hoc bundle (no profile, no config)
  mypi --profile developer --bundle btw               augment a profile with a bundle
  mypi -p --model <m> --bundle code-review-prompt "<msg>"   full passthrough form

COMMANDS
  init          Create a default mypi-config.yaml
  configure     Interactive config editor

OPTIONS
  --profile <name>   Use the named profile (default from config, else 'developer')
  --bundle <name>    Expand a bundle's pi flags (-e/--skill/--prompt-template).
                     Repeatable. With no --profile, loads no config (ad-hoc).
  -h, --help         Show help

Built-in profiles (developer, reviewer, llm-wiki, wayfinder) are always
available with no mypi-config.yaml; each is a named bundle-set. The config file
is an optional overlay: add/override profiles and optionally set 'default'.
Run 'mypi configure' to edit it.
`;

/** The main help text (exported so its surface can be asserted in tests). */
export const MAIN_HELP = MAIN_HELP_TEXT;

const INIT_HELP = `\
mypi init - Create a default mypi-config.yaml

USAGE
  mypi init

Creates a mypi-config.yaml in the current directory with a minimal
default profile. Aborts if the file already exists.

OPTIONS
  -h, --help         Show help
`;

const CONFIGURE_HELP = `\
mypi configure - Interactive config editor

USAGE
  mypi configure

Opens an interactive editor for mypi-config.yaml. Allows setting the
default profile, adding/removing/editing profiles, and selecting
bundles (each a packaged unit of pi-extensions, skills, and prompts).

Built-in profiles (developer, reviewer, llm-wiki, wayfinder) are shown but cannot be removed;
editing one copies it into the overlay as an override. If no config file
exists it is created on save.

OPTIONS
  -h, --help         Show help
`;

// ---------------------------------------------------------------------------
// Print & exit helpers
// ---------------------------------------------------------------------------

export function printMainHelp(): never {
	console.log(MAIN_HELP_TEXT);
	process.exit(0);
}

export function printInitHelp(): never {
	console.log(INIT_HELP);
	process.exit(0);
}

export function printConfigureHelp(): never {
	console.log(CONFIGURE_HELP);
	process.exit(0);
}
