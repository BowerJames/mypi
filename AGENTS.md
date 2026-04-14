# mypi

mypi is a CLI tool that manages pi coding agent profiles, bundling extensions, skills, and prompt templates for different workflows.

## Additional Development CLI Tools

- `gh` — GitHub CLI. Used for GitHub operations (creating PRs, viewing issues, etc.). Install via https://cli.github.com/.

## Development Guidelines

- All CLI commands must have a corresponding `--help` flag that describes usage, available options, and examples.
- Use Biome for formatting and linting. Run `bun run format` and `bun run lint` before committing.
- Prefer simple, readable code over clever abstractions.

## Running Tests

```bash
bun test
```

## Running Lint Checks

```bash
bun run lint
```

## Running Code Formatting Checks

```bash
bun run format:check
```
