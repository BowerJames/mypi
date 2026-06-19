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
  run           Run pi with bundled resource name resolution
  init          Create a default mypi-config.yaml
  configure     Interactive config editor

OPTIONS
  --profile <name>   Use the named profile (default from config)
  -h, --help         Show help

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
bundled extensions, skills, and prompt templates.

Requires an existing mypi-config.yaml. Run 'mypi init' to create one.

OPTIONS
  -h, --help         Show help
`;

const RUN_HELP = `\
mypi run - Run pi with bundled resource name resolution

USAGE
  mypi run [pi options...] [messages...]

Forwards every argument to pi. For the resource flags -e/--extension,
--skill, and --prompt-template, a bare value that matches a name in mypi's
bundled library is replaced with that resource's on-disk path:

  mypi run -p --model zai/glm-5.2 -e mode
  -> pi -p --model zai/glm-5.2 -e <mypi>/extensions/mode/index.ts

Resolution rules:
  - Bare names matching a bundled extension, skill, or prompt are resolved.
  - Path-like values (containing a slash or backslash) are passed through.
  - Unknown names are passed through (pi reports the error).
  - The equals form (e.g. -e=mode, --extension=mode) is passed through,
    matching pi's own parser which does not recognise it for these flags.

No mypi-config.yaml is required. mypi run uses no profiles and interprets no
mypi-specific flags; everything after 'run' is forwarded to pi.

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
