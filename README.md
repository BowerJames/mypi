# mypi

A curated library of [pi](https://shittycodingagent.ai) extensions, skills, and prompt templates with profile-based launching.

## Install

```bash
npm install -g @bowerjames/mypi
```

`mypi` shells out to `pi` (resolved from your `$PATH`). The package declares `@earendil-works/pi-coding-agent` — which provides the `pi` binary — as a peer dependency, so a fresh install also installs `pi` automatically. If you already have `pi` installed (any way), npm reuses it and your existing `pi` keeps running.

### Updating the global install

```bash
npm install -g @bowerjames/mypi@latest
```

Verify with `mypi -h` (prints help).

### Dev: installing from a local checkout

For unreleased branches, `dist/` is gitignored, so a local install is done by **rebuilding from a checkout, packing it into a tarball (which carries the built `dist/` via the `files` field), and reinstalling that tarball**:

```bash
git checkout <branch>     # whichever branch you want installed (e.g. main)
git pull
npm install               # dev dependencies (TypeScript) needed to build
npm run install:global    # builds dist/ (via prepack), packs a tarball, reinstalls globally
```

`npm run install:global` is shorthand for:

```bash
npm run build             # compile src/ -> dist/
npm pack                  # bundle bowerjames-mypi-<version>.tgz (ships dist/ via the "files" field)
npm install -g ./bowerjames-mypi-<version>.tgz
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
| `mode` | Plan/develop mode system — `/plan`, `/develop`, `/mode <name>` commands. Root branch auto-defaults to the current git branch on first start and persists (sticky across resume); set/clear via `/root-branch` (clear is sticky and suppresses re-defaulting) |
| `code-review` | Appends a "run an independent review before a PR" system-prompt section and provides `/code-review-model` to set the recommended review model (defaults to the active session model) |
| `review-agent-trajectory` | Session trajectory review command — captures the current conversation and launches a review pass |
| `btw` | Non-blocking one-off side tasks on a throwaway in-memory clone — `/btw <task>` runs in parallel without interrupting the main stream, and its result is shown in the TUI but kept out of the main agent's context. Each task is wrapped in a guardrail so the clone scopes itself to the side task and does not continue the main agent's work |
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

### btw

The `btw` extension registers a single `/btw <task>` command for non-blocking side tasks. When invoked it builds a **throwaway in-memory clone** of the current agent — same context, effective system prompt, model, and built-in tools — runs the task to completion, shows the final assistant message in the TUI, then drops the clone. The intent is to dispatch single tasks that share the main agent's context but run in parallel without interrupting its stream, e.g. while a code-review agent is describing a non-blocking issue:

```
/btw create an issue for that
```

This creates the issue in the background while the main agent continues toward blocking fixes or the PR.

**How it works:**

- The `/btw` command handler snapshots the parent's conversation (`buildSessionContext`), effective system prompt (`getSystemPrompt`), model, model registry, thinking level, and active tools, then returns immediately — the clone runs in the background and never blocks the main agent.
- The clone is built with `createAgentSession` using `SessionManager.inMemory()`, so nothing is persisted. Its system prompt is the parent's effective prompt verbatim (which already encodes contributions from `mode`, `code-review`, `AGENTS.md`, and skills), and it is seeded with the full parent conversation (compaction/branch summaries are converted to user messages so prior context survives).
- The task text is wrapped in a `<btw-task>` guardrail before being sent to the clone. Because the clone inherits the parent's full conversation and effective prompt — which encode the main agent's in-progress work — it could otherwise decide to "help finish" that work rather than just answering the side task. The wrapped message is the most recent instruction in the clone's context, so it dominates steering: it frames the parent conversation as context-only and directs the clone to complete only the side task, then stop. The wrap is model-facing only — the TUI preview/status/error paths still show the raw task text.
- When the clone goes idle, the final assistant text is shown via `ctx.ui.notify(...)` — which writes directly to the chat scrollback but **never touches the session manager**, so the result is visible yet **kept out of the main agent's LLM context**. While running, a `⚙ btw: N running` indicator is shown in the footer.
- Multiple `/btw` tasks may run in parallel (no cap). Every live clone is aborted and disposed automatically when the main session shuts down (`/new`, `/resume`, `/reload`, `/fork`, `/switchSession`, or quit).

**v1 limitations (accepted):**

- The clone reproduces the parent's **built-in tools only** (`read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`), intersected with the parent's active set. Extension-registered custom tools, event handlers, and slash commands are not re-instantiated inside the clone. The built-in `bash` tool covers the primary use case (e.g. `gh issue create`).
- Result display uses `notify`'s info path, which coalesces consecutive status lines: if two btw tasks complete with no other chat activity between them, only the latest result line is shown. The common case (btw running *during* the main stream, where the main agent's messages land between completions) is unaffected.

Enable it by adding `btw` to a profile's `extensions` list.

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
