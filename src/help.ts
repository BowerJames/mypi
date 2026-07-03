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

const MAIN_HELP = `\
mypi - Profile-based launcher for pi

USAGE
  mypi [options] [--profile <name>] [args...]
  mypi run [pi options...] [messages...]
  mypi init [options]
  mypi configure [options]

COMMANDS
  run           Run pi with bundle expansion
  init          Create a default mypi-config.yaml
  configure     Interactive config editor

OPTIONS
  --profile <name>   Use the named profile (default from config)
  -h, --help         Show help

Profiles reference bundles by name rather than configuring individual
extensions/skills/prompts. Run 'mypi configure' to edit bundles.

Run 'mypi <command> --help' for more information on a command.
`;

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

Requires an existing mypi-config.yaml. Run 'mypi init' to create one.

OPTIONS
  -h, --help         Show help
`;

const RUN_HELP = `\
mypi run - Run pi with bundle expansion

USAGE
  mypi run [pi options...] [--bundle <name>]... [messages...]

Forwards every argument to pi. mypi's --bundle <name> flag is expanded to
that bundle's pi resource flags (-e/--skill/--prompt-template):

  mypi run -p --bundle code-review-prompt
  -> pi -p --prompt-template <mypi>/extension-bundles/code-review-prompt/prompts/code-review.md

Multiple --bundle flags are allowed; each expands independently.
--bundle=<name> (equals form) is also recognised.

Everything else is forwarded verbatim — including path-like -e ./local.ts,
other pi flags, and positional messages.

No mypi-config.yaml is required. mypi run uses no profiles and interprets no
mypi-specific flags other than --bundle; everything after 'run' is forwarded
to pi.

OPTIONS
  -h, --help         Show help

Run 'pi --help' for pi's options.
`;

// ---------------------------------------------------------------------------
// Print & exit helpers
// ---------------------------------------------------------------------------

export function printMainHelp(): never {
	console.log(MAIN_HELP);
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

export function printRunHelp(): never {
	console.log(RUN_HELP);
	process.exit(0);
}
