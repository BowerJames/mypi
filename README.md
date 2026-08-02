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

mypi works out of the box with **no config** — built-in profiles
(`developer`, `reviewer`, `llm-wiki`) are always available. To add or override profiles,
create a config:

```bash
mypi init
```

This writes a starter `mypi-config.yaml` overlay. Edit it to define your own
profiles (or use `mypi configure` for an interactive editor). A user profile
with the same name as a built-in **replaces** it.

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

# Run pi directly with bundle expansion (no profile/config needed)
mypi run -p --model zai/glm-5.2 --bundle mode "Summarize this repo"
mypi run --help

# Interactive config editor
mypi configure
mypi configure --help
```

## Running pi directly (`mypi run`)

`mypi run` forwards every argument to `pi` with no profile or config required — handy when you just want one of mypi's bundles ad hoc:

```bash
# Expand a bundle's pi-extensions/skills/prompts into pi flags
mypi run -p --model zai/glm-5.2 --bundle mode "Summarize this repo"
# -> pi -p --model zai/glm-5.2 -e <mypi>/extension-bundles/mode/pi-extensions/mode/index.ts "Summarize this repo"

# Multiple bundles, and prompt-only / skill-only bundles, all work the same way
mypi run -p --bundle repo-explorer --bundle code-review-prompt

mypi run --help
```

`--bundle <name>` (and the `--bundle=<name>` form) is expanded into that bundle's pi flags (`-e`/`--skill`/`--prompt-template`). Anything else is passed through untouched:

- Multiple `--bundle` flags are allowed; each expands independently.
- Path-like `-e ./local.ts` and other pi flags are forwarded as-is.
- Everything else after `run` is sent straight to `pi`.

`mypi run` uses no profiles, reads no `mypi-config.yaml`, and interprets no mypi-specific flags other than `--bundle`.

## Configuration

mypi ships built-in profiles and **works with no config file at all**. The
optional `mypi-config.yaml` is an **overlay** that adds new profiles,
overrides built-ins by name (replace), and optionally sets `default`. If you
just want to tweak things, create one:

```bash
mypi init        # writes a starter overlay
```

Example overlay adding a custom `fullstack` profile (the built-ins
`developer`, `reviewer`, and `llm-wiki` remain available alongside it):

```yaml
default: fullstack

profiles:
  fullstack:
    bundles:
      - mode                   # plan/develop mode system + sticky root-branch
      - code-review            # pre-PR review guidance + /code-review-model
      - dynamic-skills         # live shell execution inside skills
      - loop                   # repeat messages until a terminal condition
      - repo-explorer          # explore third-party codebases into a /tmp cache
      - overview               # repo overview and open issues
    cmd: "pi --model claude-sonnet-4-20250514 --tools read,bash,edit,write,grep,find,ls"
```

To override a built-in instead of adding a new name, define a profile with a
built-in name (e.g. `developer:`) — your definition replaces it wholesale.

A **bundle** is a single unit that packages related pi-extensions, skills, and prompts together, loaded by one name. See [Bundled Resources](#bundled-resources) for the full list.

### Fields

| Field | Description |
|-------|-------------|
| `default` | Profile to use when none is specified on the CLI. Optional — falls back to the `developer` built-in if unset or if the config file is absent. |
| `profiles.<name>.bundles` | List of bundle names from mypi's library |
| `profiles.<name>.cmd` | Base pi command to execute. Bundle resources are injected automatically. |

Any additional arguments passed on the command line are appended to the command.

### How It Works

`mypi` expands each named bundle to the on-disk paths declared in its manifest and injects the appropriate flags into your `cmd`:

- a bundle's pi-extensions → `-e <path>`
- a bundle's skills → `--skill <path>`
- a bundle's prompts → `--prompt-template <path>`

A bundle may declare `dependencies`; those bundles are auto-activated and their resources are emitted **first** (dependencies before dependents), so a skill whose `SKILL.md` uses dynamic `!` blocks always has the `dynamic-skills` extension loaded by the time it expands. Dependencies are resolved transitively and **deduplicated across the whole command** — listing a dep explicitly, or two bundles sharing a dep, never double-loads an extension (which would double-register its handlers). See [Bundle dependencies](#bundle-dependencies).

You control everything else (model, tools, thinking level, etc.) through the `cmd` field.

Bundles live under `extension-bundles/<name>/` inside the installed package. Each bundle's `index.ts` manifest declares its resources as paths relative to itself, so they resolve wherever npm installs the package. A bundle may also declare `dependencies` (other bundle names); those are auto-activated alongside it — see [Bundle dependencies](#bundle-dependencies). `mypi run` applies the same expansion via `--bundle` (see [Running pi directly](#running-pi-directly-mypi-run)).

## Bundled Resources

mypi ships 11 **bundles**, each under `extension-bundles/<name>/`. Most contain a single resource type; the `code-review` feature splits into an extension bundle and a prompt-only bundle (the prompt must be loadable without the extension for the review subprocess).

| Bundle | Contains | Description |
|--------|----------|-------------|
| `mode` | pi-extension | Plan/develop mode system — `/plan`, `/develop`, `/mode <name>` commands. Root branch auto-defaults to the current git branch on first start and persists (sticky across resume); set/clear via `/root-branch` (clear is sticky and suppresses re-defaulting) |
| `btw` | pi-extension | Non-blocking one-off side tasks on a throwaway in-memory clone — `/btw <task>` runs in parallel without interrupting the main stream, and its result is shown in the TUI but kept out of the main agent's context. Each task is wrapped in a guardrail so the clone scopes itself to the side task and does not continue the main agent's work |
| `loop` | pi-extension | Repeat messages until a terminal condition — `/loop [--terminal-regex <re>] [--max-iter <n>] --loop ["msg",...]` resets the session to the original point after every item (and between iterations) via tree navigation, so each item runs from a clean slate and the session ends back at the anchor |
| `dynamic-skills` | pi-extension | Live shell execution inside skills — inline `!\`cmd\`` and fenced ```!``` blocks are replaced with their output at skill load (covers `/skill:name` and `read` of `SKILL.md`) |
| `render-raw` | pi-extension | Append a raw (unformatted) rendering of the last assistant reply — `/render-raw` injects a custom-typed copy of the reply rendered as plain text (literal markdown), shown in the TUI but kept out of the main agent's context. Additive, not a toggle; a re-run against the same reply is a no-op |
| `code-review` | pi-extension | Appends a "run an independent review before a PR" system-prompt section and provides `/code-review-model` to set the recommended review model (defaults to the active session model) |
| `code-review-prompt` | prompt | Independent code review of an issue's implementation on a branch. Usage: `/code-review <issue_number> <branch_to_review> <target_branch_of_pr>` |
| `repo-explorer` | skill | Explore third-party codebases/libraries/frameworks without cluttering the active workspace — clones into a `/tmp/repos/` cache and reuses existing checkouts. Auto-activates `dynamic-skills` (its `SKILL.md` uses dynamic `!` shell blocks) |
| `overview` | prompt | Overview of the repository, core components, and open issues |
| `terminal-status` | pi-extension | Reflect session state in the terminal tab title — on `agent_start` sets the title to `working`, on `agent_settled` sets it to `idle`. Works in any terminal (TUI mode) by emitting the OSC 1 tab-title escape sequence (`\033]1;<title>\007`) to stdout. Best-effort: a failed write is swallowed. Note: pi's own window-title writes (OSC 0) can momentarily override the tab title on startup/session change |
| `llm-wiki` | pi-extension | Turn the agent into a wiki manager for an [OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) wiki (Karpathy's [LLM-wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)) — `/wiki-root`/`/wiki-spec` configure the bundle root and per-wiki spec doc (defaults `wiki/` and `/SPEC.md`), the spec is **auto-injected** into the system prompt each turn, `/wiki-init` scaffolds empty assets, and `/wiki-ingest`/`/wiki-query`/`/wiki-lint` inject the operating-model guidance |

### Bundle dependencies

Bundles are **composable**: a bundle's manifest may declare a `dependencies` field (a list of other bundle names). When you select a bundle — via a profile's `bundles` list or `mypi run --bundle <name>` — mypi **auto-activates its full transitive dependency closure**, so you only ever name the bundles you actually want.

Resolution rules:

- **Dependencies-first.** A dependency's resources are always emitted before those of the bundle that needs them. For example, selecting `repo-explorer` (a skill whose `SKILL.md` uses dynamic `!` shell blocks) auto-activates `dynamic-skills` (the extension that expands those blocks) and emits its `-e` flag first.
- **Transitive.** If `a` depends on `b` and `b` depends on `c`, selecting `a` activates all three (`c`, then `b`, then `a`).
- **Deduplicated across the whole command.** If two bundles share a dependency, or you list a dependency explicitly alongside a bundle that pulls it in, the shared dependency is loaded exactly once — never double-registering an extension's handlers via duplicate `-e` flags.
- **Silent in `mypi configure`.** The editor only toggles the bundles you name; dependencies are pulled in at launch time, so you do not need to (and should not) select a dep explicitly.
- **Fail-fast on cycles / missing bundles.** A circular dependency raises `Circular bundle dependency: a -> b -> a`; a dependency that names a non-existent bundle surfaces the standard "Bundle not found" error.

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

The `code-review` bundle moves the pre-PR review guidance out of shared `AGENTS.md` files so it only affects agents that opt in by enabling the bundle. When enabled it:

- Appends a "## Code Review" section to the system prompt each turn, instructing the agent to run an independent review before opening a pull request:

  ```
  mypi run -p --model <model> --tools read,grep,find,ls --bundle code-review-prompt "/code-review <issue_number> <branch_to_review> <target_branch_of_pr>"
  ```

  The review runs with read-only tools (`read,grep,find,ls`) for defense-in-depth, even though the `code-review-prompt` prompt itself instructs the reviewer never to apply fixes.
- Provides `/code-review-model [<model>]` to set the recommended review model. With no argument it clears the configured model. The choice is persisted across sessions (restored on `/resume`, `/new`, `/reload`).
- Falls back to the **active session model** (`provider/id`) when no model is configured, so the guidance appears out of the box.
- Shows a `🔍 review:` status indicator in the footer: the explicitly-configured model in the accent color, and the active-fallback model in a warning color (prefixed `(active)`).

Because the review subprocess is launched via `mypi run --bundle code-review-prompt` (the prompt-only bundle, which loads no extension), the reviewer agent does not re-append this section — only the interactive session that enables the `code-review` bundle sees the guidance.

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
- The full result text is persisted to a temp file (`/tmp/btw-<uuid>.md`), and the in-chat notification prepends a `↳ <path>` pointer line above the body. The body is capped at ~50 KB so a runaway clone cannot flood the scrollback, but the full answer is always recoverable from the file (and the pointer line is itself never truncated).
- Multiple `/btw` tasks may run in parallel (no cap). Every live clone is aborted and disposed automatically when the main session shuts down (`/new`, `/resume`, `/reload`, `/fork`, `/switchSession`, or quit).

**v1 limitations (accepted):**

- The clone reproduces the parent's **built-in tools only** (`read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`), intersected with the parent's active set. Extension-registered custom tools, event handlers, and slash commands are not re-instantiated inside the clone. The built-in `bash` tool covers the primary use case (e.g. `gh issue create`).
- Result display uses `notify`'s info path, which coalesces consecutive status lines: if two btw tasks complete with no other chat activity between them, only the latest result line is shown. The common case (btw running *during* the main stream, where the main agent's messages land between completions) is unaffected. (The full text of every result is still persisted to `/tmp/btw-<uuid>.md`, so a coalesced-away line remains recoverable via its pointer file.)

Enable it by adding `btw` to a profile's `bundles` list.

### loop

The `loop` extension registers a single `/loop` command that repeats a sequence of messages to the agent until a terminal condition is met. Within each pass (an iteration over the `--loop` array), **every item runs independently** — the session is reset back to the original point after each item, so item N does not see item N−1's output (not a continuous flow within one conversation). The session is left back at the anchor when the loop exits.

```
/loop [--terminal-regex <source>] [--max-iter <n>] --loop ["msg", ...]
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--loop` | Yes | — | JSON array of strings sent to the agent in order each iteration, each from a clean anchor |
| `--max-iter` | No | `10` | Maximum number of iterations (hard cap; guarantees termination) |
| `--terminal-regex` | No | — | Regex **source** matched against the final assistant text of each iteration; a match stops the loop early |

There is **no goal argument** — the command is flags-only.

Example:

```
/loop --terminal-regex "<\/end>" --max-iter 10 --loop ["/plan","/evaluate-plan"]
```

**How it works:**

- Each iteration sends every `--loop` item in order via `sendUserMessage`, awaiting the agent going idle between items. After EACH item the session is reset back to the anchor, so items run independently — item N does **not** see item N−1's output (e.g. `/evaluate-plan` does not see `/plan`'s output).
- The iteration's final (last) item's assistant text is read; if `--terminal-regex` matches, the loop stops. Otherwise the loop runs again, starting from the anchor.
- The **reset** is a same-session tree navigation back to the entry that was the leaf when the command was invoked (`navigateTree` with branch summary disabled). Because this stays in one session file, each item/iteration becomes a sibling branch off that anchor and the conversation is restored to the original point — a clean slate — without starting a new session.
- The last item's reset serves double duty as the between-iteration reset, so the session always ends back at the anchor when the loop exits (terminal match or max-iter reached). The sole exception is an explicit user cancellation of the tree navigation.
- A `🔄 loop: N/M` indicator is shown in the footer while running, and start / per-iteration / terminal notifications are surfaced in the chat.

The loop always terminates: `--max-iter` is a hard cap (default 10), and `--terminal-regex` provides an early exit.

**Argument parsing:** tokens are whitespace-separated; a token beginning with `"` or `'` is read literally (delimiters stripped, so backslashes/`$`/`&` survive — wrap `--terminal-regex` in quotes if it contains spaces). Bare tokens are bracket-aware, so a JSON array can be typed verbatim even with internal spaces and quoted strings (`--loop ["/plan", "/evaluate-plan"]`). Unknown tokens (e.g. an accidental trailing goal) are an error.

**Accepted limitations:**

- The reset is **conversation-level**: in-memory state of other extensions (e.g. a toggled `/plan`) is not reset, since the loop stays in one session.
- The terminal regex matches the **final assistant text** of the iteration, so the last `--loop` item should be one that produces an assistant response for the regex to be meaningful.

Enable it by adding `loop` to a profile's `bundles` list.

### render-raw

The `render-raw` extension registers a single `/render-raw` command that appends a **raw, unformatted** rendering of the last assistant reply to the chat. The model's markdown is shown literally — `**bold**` keeps its asterisks, headings keep their leading `#`, code fences keep their backticks, etc.

It exists because pi renders every assistant text block through its built-in `Markdown` component and exposes no extension hook to toggle a "raw" mode or swap the assistant message renderer. The only way to control how a message renders is a renderer keyed by message `customType`, which only applies to custom-typed messages — so `render-raw` injects a **copy** of the reply under a custom type and renders that copy with a plain `Text` component.

**How it works:**

- `/render-raw` finds the last `role === "assistant"` message via `ctx.sessionManager.getEntries()` and sends a custom message (`customType: "render-raw"`, `display: true`) whose content is that reply's text, via `pi.sendMessage(...)`.
- A registered `render-raw` message renderer returns a plain `Text` (with a small dim `raw markdown` label) instead of `Markdown`, so the markdown syntax is shown verbatim.
- The injected custom message is **excluded from the LLM context** via a `context` event filter — a `CustomMessageEntry` participates in context by default, so this filter is required to avoid duplicating the reply into the conversation.

**Additive, not a toggle.** The original nicely-formatted assistant message stays in place; `/render-raw` appends a raw copy below it. It cannot replace or hide the original (there is no `SessionManager.removeEntry`).

**Dedupe.** `SessionManager` exposes no entry removal, so a naive toggle would stack duplicate raw copies. Instead, `/render-raw` only appends a new copy when the last assistant reply's text differs from the one already rendered (tracked in memory and reconstructed from the session on `/reload`, `/resume`, `/new`). Re-running `/render-raw` for the same reply notifies "last reply is already rendered raw" instead of duplicating; after a new reply it renders again.

Enable it by adding `render-raw` to a profile's `bundles` list.

### LLM Wiki

The `llm-wiki` extension turns the agent into a **wiki manager** for an
[Open Knowledge Format (OKF) v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
wiki, following Karpathy's [LLM-wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f):
the agent incrementally builds and maintains a persistent, interlinked
markdown knowledge base — you curate sources and ask questions; it does all
the summarising, cross-referencing, and bookkeeping that makes a knowledge
base compound over time.

A built-in `llm-wiki` profile ships with the wiki bundle enabled, plus the
`mode` and `repo-explorer` bundles (the latter pulls in `dynamic-skills`
automatically as a dependency):

```bash
mypi --profile llm-wiki
mypi run --bundle llm-wiki   # ad hoc, no profile/config needed
```

**Two configurable values** (set via slash commands, persisted across
sessions, restored on resume):

| Value | Default | Meaning |
|-------|---------|---------|
| `wiki-root` | `wiki` (project-relative) | The OKF bundle root — a directory tree of markdown concept files with YAML frontmatter, `index.md`/`log.md`, and cross-links |
| `wiki-spec` | `/SPEC.md` (wiki-root-relative, OKF §5.1) | A per-wiki **purpose & conventions** doc — the runtime context that tells the agent *which* wiki it is managing (Karpathy's "schema" layer) |

Both auto-default on the first session start (write-once, sticky across
resume); an explicit clear is also sticky and suppresses the default.

**Auto-injection.** Each turn the extension reads `<wiki-spec>` and appends a
`## Wiki Manager` section to the system prompt that first directs the agent to
**read the full [OKF v0.1 spec](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)**
once per session (fetching it via `curl` before any other wiki work, and
**stopping to inform the user** if it cannot be retrieved — wiki work is
blocked until the spec can be read). The section then carries: the OKF format
essentials (required `type` frontmatter, reserved filenames, leading-`/`
bundle-relative links, `# Schema`/`# Examples`/`# Citations` conventions),
the ingest/query/lint operating model, and the spec's contents verbatim. So
the agent always knows the format *and* the specific wiki's purpose.

**Commands:**

| Command | Purpose |
|---------|---------|
| `/wiki-root [<path>]` | Set the wiki-root (no arg clears; re-defaults to `wiki`) |
| `/wiki-spec [<path>]` | Set the wiki-spec path (no arg clears; re-defaults to `/SPEC.md`) |
| `/wiki-init` | Scaffold the wiki-root and create **empty** `index.md`, `log.md`, and the spec (idempotent; creates assets only — no seeded content) |
| `/wiki-ingest` | Inject the ingest workflow guidance (one-off message) |
| `/wiki-query` | Inject the query workflow guidance (one-off message) |
| `/wiki-lint` | Inject the lint workflow guidance (one-off message) |

A typical first run: `mypi --profile llm-wiki`, then `/wiki-init`, open the
empty spec and describe what the wiki is for, then `/wiki-ingest` and start
adding sources. A `📚 wiki: <root>` indicator is shown in the footer while a
wiki-root is active.

The agent maintains the wiki with its **built-in** tools (`read`/`write`/
`edit`/`bash`); the extension supplies only the operating context and the
bootstrap/config commands. It has no bundle dependencies.

## Development

```bash
npm install          # installs pi packages + tooling as devDependencies
npm run typecheck    # tsc --noEmit over src/ (including extension bundles)
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
   `src/` (including the extension bundles).

Hooks are installed automatically by the `prepare` script when you run
`npm install`. To bypass the hooks for a single commit:

```bash
git commit --no-verify
```

The pi packages (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`)
are declared as `devDependencies` so that `tsc`, Biome, and vitest can resolve
them locally. At runtime pi loads them from its own bundled copies via its
loader alias map.
