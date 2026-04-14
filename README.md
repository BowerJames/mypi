# mypi

CLI tool that manages [pi](https://github.com/nicosql/pi) coding agent profiles, bundling extensions, skills, and prompt templates for different workflows.

## Installation

```bash
bun install
```

## Usage

### Initialize a configuration

```bash
mypi init          # Create mypi.yaml in the current directory
mypi init --force  # Overwrite existing mypi.yaml
```

### Configure profiles

```bash
mypi configure     # Interactive wizard to manage profiles
```

The wizard lets you:
- Set the default profile
- Add new profiles
- Edit existing profiles
- Remove profiles (except the default)

### Launch pi with a profile

```bash
mypi                           # Uses the default profile
mypi --profile reviewer        # Uses the "reviewer" profile
mypi --profile reviewer @file  # Profile + passthrough args to pi
```

All arguments after `--profile <name>` are forwarded to the pi command.

### Help

```bash
mypi --help           # Main help
mypi init --help      # Init help
mypi configure --help # Configure help
```

## Configuration

Configuration is stored in `mypi.yaml` in your project root. See [`mypi.yaml.example`](./mypi.yaml.example) for a reference.

```yaml
default: assistant

profiles:
  assistant:
    extensions:
      - mode
    skills:
      - deployments
    prompts:
      - overview
    cmd: "pi"
  reviewer:
    prompts:
      - review
    cmd: "pi -p"
```

### Fields

| Field | Description |
|-------|-------------|
| `default` | Profile name to use when `--profile` is not specified |
| `profiles.<name>.cmd` | The pi command to run (e.g., `"pi"`, `"pi -p"`) |
| `profiles.<name>.extensions` | Bundled extension names to load (`-e` flag) |
| `profiles.<name>.skills` | Bundled skill names to load (`--skill` flag) |
| `profiles.<name>.prompts` | Bundled prompt template names to load (`--prompt-template` flag) |

## Bundled Resources

- **Extensions**: TypeScript files (`.ts`) or directories with `index.ts` in `extensions/`
- **Skills**: Directories containing `SKILL.md` in `skills/`
- **Prompts**: Markdown files (`.md`) in `prompts/` (name = filename without extension)

## Development

```bash
bun run dev          # Run CLI directly
bun run build        # Build to dist/
bun test             # Run tests
bun run lint         # Lint check
bun run format       # Auto-format code
bun run format:check # Check formatting and imports
```
