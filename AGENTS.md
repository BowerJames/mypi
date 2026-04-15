# mypi

mypi is a CLI tool that manages pi coding agent profiles, bundling extensions, skills, and prompt templates for different workflows.

## Additional Development CLI Tools

- `gh` - GitHub CLI. Used for GitHub operations (creating PRs, viewing issues, etc.).
- `tmux` - tmux is a terminal multiplexer: it enables a number of terminals to be created, accessed, and controlled from a single screen. tmux may be detached from a screen and continue running in the background, then later reattached. 

## Development Guidelines

- All CLI commands must have a corresponding `--help` flag that describes usage, available options, and examples.
- Use Biome for formatting and linting. Run `bun run format` and `bun run lint` before committing.
- Prefer simple, readable code over clever abstractions.
- No any types unless absolutely necessary.
- Maintain type safety wherever possible.

## Running Tests

```bash
bun test
```

## Running Lint Checks

```bash
bun run lint
```

## Code Review
To launch an independent code review run:

```bash
mypi --profile reviewer "/review <issue_number> <target_branch>"
```

Where <issue_number> is the number of the issue being reviewed and <target_branch> is the name of the branch the work has been done on.

The code review can take a long time so provide a timeout of 1000 seconds.

## Running Code Formatting Checks

```bash
bun run format:check
```
