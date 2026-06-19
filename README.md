# mypi

A curated library of [pi](https://shittycodingagent.ai) extensions, skills, and prompt templates with profile-based launching.

## Install

```bash
npm install -g mypi
```

> **Note:** `mypi` is not published to the public npm registry, so the command above only works inside environments where it has been published (e.g. a private registry). Otherwise install it from a local checkout — see [Updating the global install](#updating-the-global-install).

### Updating the global install

Because `dist/` is gitignored and the package isn't on a registry, the global install is updated by **rebuilding from a local checkout, packing it into a tarball (which carries the built `dist/` via the `files` field), and reinstalling that tarball**. From your local checkout:

```bash
git checkout <branch>     # whichever branch you want installed (e.g. main)
git pull
npm install               # dev dependencies (TypeScript) needed to build
npm run install:global    # builds dist/ (via prepack), packs a tarball, reinstalls globally
```

`npm run install:global` is shorthand for:

```bash
npm run build             # compile src/ -> dist/
npm pack                  # bundle mypi-<version>.tgz (ships dist/ via the "files" field)
npm install -g ./mypi-<version>.tgz
```

Notes:

- `prepack` runs `npm run build` automatically during `npm pack`, so the tarball always carries a fresh `dist/` even though `dist/` is gitignored.
- The global reinstall runs only `postinstall` (which `chmod +x`s `dist/cli.js`); the dev-only `prepare` (husky) does **not** run when installing a tarball, so the install does not require `node_modules/` to be present.
- Verify with `mypi -h` (prints help) and `ls -l $(which mypi)`, which should resolve to the freshly reinstalled `dist/cli.js`.

## Setup

1. Create a default config:

```bash
mypi init
```

Or copy the example config:

```bash
cp node_modules/mypi/mypi-config.example.yaml mypi-config.yaml
```

2. Edit `mypi-config.yaml` to define your profiles (or use `mypi configure` for an interactive editor).

## Usage

```bash
# Show help
mypi --help
mypi -h

# Initialize a new config file
mypi init
mypi init --help

# Launch with a named profile
mypi --profile fullstack

# Launch with a profile and pass a prompt
mypi --profile fullstack "Fix the auth bug"

# Uses the default profile if none specified
mypi

# Run pi directly with bundled resource name resolution (no profile/config needed)
mypi run -p --model zai/glm-5.2 -e mode "Summarize this repo"
mypi run --help

# Interactive config editor
mypi configure
mypi configure --help
```

## Running pi directly (`mypi run`)

`mypi run` forwards every argument to `pi` with no profile or config required — handy when you just want one of mypi's bundled extensions, skills, or prompts ad hoc:

```bash
# Resolve bundled extension/skill/prompt names to their paths automatically
mypi run -p --model zai/glm-5.2 -e mode "Summarize this repo"
# -> pi -p --model zai/glm-5.2 -e <mypi>/extensions/mode/index.ts "Summarize this repo"

# Skills and prompts work the same way
mypi run --skill repo-explorer --prompt-template code-review

mypi run --help
```

For `-e`/`--extension`, `--skill`, and `--prompt-template`, a **bare name** matching a bundled resource is replaced with its on-disk path. Anything else is passed through untouched:

- Path-like values (e.g. `./mode`, `a/b/mode`) are forwarded as-is.
- Unknown names are forwarded as-is (`pi` reports the missing file).
- The `=` form (e.g. `-e=mode`, `--extension=mode`) is forwarded as-is, matching `pi`'s own parser.

`mypi run` uses no profiles, reads no `mypi-config.yaml`, and interprets no mypi-specific flags — everything after `run` is sent to `pi`.

## Configuration

Create a `mypi-config.yaml` in your project root:

```yaml
default: fullstack

profiles:
  fullstack:
    extensions:
      - mode                   # from mypi's bundled library
      - code-review            # from mypi's bundled library
    skills:
      - my-skill              # from mypi's bundled library
    prompts:
      - code-review           # from mypi's bundled library
    cmd: "pi --model claude-sonnet-4-20250514 --tools read,bash,edit,write,grep,find,ls"

  reviewer:
    extensions: []
    skills: []
    prompts:
      - code-review
    cmd: "pi --model claude-sonnet-4-20250514 --tools read,grep,find,ls"
```

### Fields

| Field | Description |
|-------|-------------|
| `default` | Required profile to use when none is specified |
| `profiles.<name>.extensions` | List of extension names from mypi's library |
| `profiles.<name>.skills` | List of skill names from mypi's library |
| `profiles.<name>.prompts` | List of prompt template names from mypi's library |
| `profiles.<name>.cmd` | Base pi command to execute. Resources are injected automatically. |

Any additional arguments passed on the command line are appended to the command.

### How It Works

`mypi` resolves each named resource to its path inside the installed package and injects the appropriate flags into your `cmd`:

- `extensions` → `-e <path>` (or `-e <path>/index.ts` for directories)
- `skills` → `--skill <path>`
- `prompts` → `--prompt-template <path>`

You control everything else (model, tools, thinking level, etc.) through the `cmd` field.

`mypi run` applies the same resource name → path resolution, but without a profile: it forwards your arguments straight to `pi`, resolving bundled `-e`/`--skill`/`--prompt-template` names inline (see [Running pi directly](#running-pi-directly-mypi-run)).

Some resources are designed to work together. For example, the `review-agent-trajectory` extension shells out to `mypi --profile review-agent-trajectory "/review-agent-trajectory <transcript>"`, so the target profile should load the prompt template but not the extension itself.

## Bundled Resources

### Extensions

| Name | Description |
|------|-------------|
| `mode` | Plan/develop mode system — `/plan`, `/develop`, `/mode <name>` commands |
| `code-review` | Appends a "run an independent review before a PR" system-prompt section and provides `/code-review-model` to set the recommended review model (defaults to the active session model) |
| `review-agent-trajectory` | Session trajectory review command — captures the current conversation and launches a review pass |
| `dynamic-skills` | Live shell execution inside skills — inline `!\`cmd\`` and fenced ```!``` blocks are replaced with their output at skill load (covers `/skill:name` and `read` of `SKILL.md`) |

### Skills

| Name | Description |
|------|-------------|
| `repo-explorer` | Explore third-party codebases/libraries/frameworks without cluttering the active workspace — clones into a `/tmp/repos/` cache and reuses existing checkouts |

### Prompt Templates

| Name | Description |
|------|-------------|
| `overview` | Overview of the repository, core components, and open issues |
| `code-review` | Independent code review of an issue's implementation on a branch. Usage: `/code-review <issue_number> <branch_to_review> <target_branch_of_pr>` |
| `review-agent-trajectory` | Review a full agent session transcript for skill gaps, improvements, and missing guidance |

### Dynamic Skills

The `dynamic-skills` extension makes skills *live*: shell commands embedded in a `SKILL.md` body are executed at load time and replaced with their output. Two syntaxes are supported:

| Syntax | Scope | Example |
|--------|-------|---------|
| `` !`command` `` | Inline — single line, no newline crossing | `` branch !`git rev-parse HEAD` `` |
| ```` ```! ```` fence | Block — multi-line program (newlines preserved) | see below |

````markdown
```!
mkdir -p ~/.explore/repos
ls ~/.explore/repos
```
````

Expansion runs on **both** skill-entry paths: the `/skill:<name>` command (intercepted before pi's built-in expansion) and the model `read`ing a registered `SKILL.md` (intercepted via the `read` tool result).

**Execution semantics:**

- Commands run in `process.cwd()` (`/skill:name` path) or the session `cwd` (`read` path), via `sh -c` (POSIX) or `powershell.exe -Command` (Windows).
- The full block body runs as one shell program, so multi-line state persists within a block (the `mkdir` then `ls` example works). Multiple blocks run sequentially, in source order.
- Default timeout is **120 s**, overridable per skill via the `shell-timeout` frontmatter field (in seconds; `0` disables it; non-numeric/negative/`NaN`/`Infinity` values fall back to the default).
- Combined stdout + stderr is truncated to **50 KB / 2000 lines** (tail-kept) so a failing `npm test` cannot blow the context budget.
- Failures are **inlined, not fatal** — a non-zero exit becomes `[Shell error: exit code N]\n<stderr>` and a timeout becomes `[Shell error: timed out after Ns]`; the rest of the body still reaches the model.
- Block output that happens to contain literal `` !`...` `` is never re-executed (mask-and-restore).
- Skills are trusted local content; there is no prompt-injection sanitisation of `$ARGUMENTS`-style input (none is supported here anyway).

When a skill body has no shell syntax, output is byte-identical to pi's built-in expansion, so the extension is safe to enable for any existing skill collection.

### Code Review

The `code-review` extension moves the pre-PR review guidance out of shared `AGENTS.md` files so it only affects agents that opt in by enabling the extension. When enabled it:

- Appends a "## Code Review" section to the system prompt each turn, instructing the agent to run an independent review before opening a pull request:

  ```
  mypi run -p --model <model> --tools read,grep,find,ls --prompt-template code-review "/code-review <issue_number> <branch_to_review> <target_branch_of_pr>"
  ```

  The review runs with read-only tools (`read,grep,find,ls`) for defense-in-depth, even though the `code-review` prompt itself instructs the reviewer never to apply fixes.
- Provides `/code-review-model [<model>]` to set the recommended review model. With no argument it clears the configured model. The choice is persisted across sessions (restored on `/resume`, `/new`, `/reload`).
- Falls back to the **active session model** (`provider/id`) when no model is configured, so the guidance appears out of the box.
- Shows a `🔍 review:` status indicator in the footer: the explicitly-configured model in the accent color, and the active-fallback model in a warning color (prefixed `(active)`).

Because the review subprocess is launched via `mypi run` (which loads no extensions and no profiles), the reviewer agent does not re-append this section — only the interactive session that enables `code-review` sees the guidance.

## Development

```bash
npm install          # installs pi packages + tooling as devDependencies
npm run typecheck    # tsc --noEmit over src/ and extensions/
npm run lint         # biome check (lint + format + import sorting)
npm run lint:fix     # biome check --write (applies auto-fixes)
npm test             # vitest run
npm run build        # compile src/ to dist/ (extensions ship as raw .ts)
npm link             # test locally
```

### Git hooks

Pre-commit hooks (via [husky](https://typicode.github.io/husky/)) run before
every `git commit`:

1. **Biome** via [lint-staged](https://github.com/lint-staged/lint-staged) —
   runs `biome check --write` on staged JS/TS/JSON files and **re-stages** the
   fixed files, so formatting / import-sort / safe-fix violations land in the
   same commit. Unfixable lint errors exit non-zero and block the commit.
   Staged files Biome doesn't handle (e.g. `.md`) are skipped automatically.
2. **`tsc`** — whole-project typecheck (`tsc -p tsconfig.check.json`) over
   `src/` and `extensions/`.

Hooks are installed automatically by the `prepare` script when you run
`npm install`. To bypass the hooks for a single commit:

```bash
git commit --no-verify
```

The pi packages (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`)
are declared as `devDependencies` so that `tsc`, Biome, and vitest can resolve
them locally. At runtime pi loads them from its own bundled copies via its
loader alias map.
