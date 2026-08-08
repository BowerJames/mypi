import type { SkillContent } from "../../../skill.js";

/**
 * The `repo-explorer` skill, defined in code.
 *
 * Explore third-party codebases/libraries/frameworks without cluttering the
 * active workspace — clones into a `/tmp/repos/` cache and reuses existing
 * checkouts. The body uses dynamic `!` shell blocks, so the bundle declares a
 * `dynamic-skills` dependency (see the manifest) to expand them at load time.
 *
 * Materialised to `<$MYPI_DIR>/skills/repo-explorer.md` at resolution. The
 * body references only absolute `/tmp/repos` paths (no co-located assets), so
 * relocating it out of the bundle dir is safe.
 */
const repoExplorer: SkillContent = {
	frontMatter: {
		name: "repo-explorer",
		description:
			"Use this skill whenever you need to explore third party codebases, libraries, or frameworks. ",
	},
	body: `Use this skill to explore codebases without cluttering the active workspace.

## Repository Cache

Use the \`/tmp/repos/\` directory to store cloned repositories. This allows you to explore codebases without cluttering your active workspace.

## Current Cache Contents

\`\`\`!
mkdir -p /tmp/repos
ls -la /tmp/repos
\`\`\`

## Flow

1. Check whether the target repository is already present in \`/tmp/repos/\`.
  - Prefer a stable directory name based on the repository owner and name such as \`owner__repo\`.
  - If the repository is already there use that local checkout for exploration.
2. If the repository is not present, clone it into \`/tmp/repos/\`, then explore it there.
  - Clone with a clear destination path.
\`\`\`bash
git clone <repo_url> /tmp/repos/<owner>__<repo>
\`\`\``,
};

export default repoExplorer;
