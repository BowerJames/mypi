import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import manifest from "../../index.js";

const here = dirname(fileURLToPath(import.meta.url));
const skillsDir = join(here, "..", "..", "skills");

/**
 * Smoke tests for the thirteen wayfinder skills — one `SKILL.md` per
 * `wayfinder:<label>`. The skills carry the phase how-to; the always-injected
 * overview (built by Unit 2) carries the dispatch table + meta-doctrine +
 * taxonomy + tracker-ops. These tests pin the decision-rich facts each skill
 * must state (type name, atomic/composite category, close condition, repo-write
 * stance) on stable anchors, so the prose can evolve without churn.
 */

interface SkillRow {
	label: string;
	category: "atomic" | "composite";
}

const SKILLS: readonly SkillRow[] = [
	{ label: "map", category: "composite" },
	{ label: "plan-map", category: "composite" },
	{ label: "decision", category: "atomic" },
	{ label: "prototype", category: "atomic" },
	{ label: "research", category: "atomic" },
	{ label: "task", category: "atomic" },
	{ label: "spec", category: "atomic" },
	{ label: "implementation-map", category: "composite" },
	{ label: "unit-map", category: "composite" },
	{ label: "development", category: "atomic" },
	{ label: "unit-review", category: "atomic" },
	{ label: "merge", category: "atomic" },
	{ label: "implementation-review", category: "atomic" },
];

const LABELS = SKILLS.map((s) => s.label);

interface Frontmatter {
	name?: unknown;
	description?: unknown;
	"disable-model-invocation"?: unknown;
}

interface LoadedSkill {
	label: string;
	path: string;
	frontmatter: Frontmatter;
	body: string;
}

/** Split a SKILL.md into its YAML frontmatter and the markdown body. */
function loadSkill(label: string): LoadedSkill {
	const path = join(skillsDir, label, "SKILL.md");
	const raw = readFileSync(path, "utf8");
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
	if (!match) throw new Error(`no YAML frontmatter in ${path}`);
	const frontmatter = yaml.load(match[1]) as Frontmatter;
	return { label, path, frontmatter, body: match[2] };
}

const LOADED = Object.fromEntries(SKILLS.map((s) => [s.label, loadSkill(s.label)])) as Record<
	string,
	LoadedSkill
>;

describe("wayfinder skills — payload ships exactly the thirteen labels", () => {
	it("the skills directory contains exactly the thirteen label dirs", () => {
		const dirs = readdirSync(skillsDir, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name)
			.sort();
		expect(dirs).toEqual([...LABELS].sort());
	});
});

describe("wayfinder skills — frontmatter is model-invocable", () => {
	for (const { label } of SKILLS) {
		const skill = LOADED[label];

		it(`${label} — has a name matching its label`, () => {
			expect(typeof skill.frontmatter.name).toBe("string");
			expect(skill.frontmatter.name).toBe(label);
		});

		it(`${label} — has a non-empty description (<= 1024 chars)`, () => {
			expect(typeof skill.frontmatter.description).toBe("string");
			const desc = skill.frontmatter.description as string;
			expect(desc.trim().length).toBeGreaterThan(0);
			expect(desc.length).toBeLessThanOrEqual(1024);
		});

		it(`${label} — is model-invocable (no disable-model-invocation)`, () => {
			expect(skill.frontmatter["disable-model-invocation"]).not.toBe(true);
		});
	}
});

describe("wayfinder skills — decision-rich facts (pinned on stable anchors)", () => {
	for (const { label, category } of SKILLS) {
		const skill = LOADED[label];
		const other = category === "atomic" ? "composite" : "atomic";

		it(`${label} — states its type name (\`wayfinder:${label}\`)`, () => {
			expect(skill.body).toContain(`wayfinder:${label}`);
		});

		it(`${label} — states its category (${category})`, () => {
			expect(skill.body).toContain(`**${category}**`);
			expect(skill.body).not.toContain(`**${other}**`);
		});

		it(`${label} — states a close condition`, () => {
			expect(skill.body).toContain("**Close:**");
		});

		it(`${label} — states a repo-write stance`, () => {
			expect(skill.body).toContain("**Repo write:**");
		});
	}
});

describe("wayfinder skills — repo-write stances (per the spec's policy)", () => {
	it("spec — never writes the repo", () => {
		const body = LOADED.spec.body.toLowerCase();
		expect(body).toContain("never");
		expect(body).toContain("repo");
	});

	it("development + merge — must write the repo", () => {
		for (const label of ["development", "merge"]) {
			expect(LOADED[label].body).toContain("**must**");
		}
	});

	it("unit-review + implementation-review — read the repo, never write", () => {
		for (const label of ["unit-review", "implementation-review"]) {
			const body = LOADED[label].body;
			expect(body).toContain("**read**");
			expect(body).toContain("never write");
		}
	});

	it("prototype — writes a scratch worktree, not the main repo", () => {
		expect(LOADED.prototype.body.toLowerCase()).toContain("worktree");
	});
});

describe("wayfinder skills — the spec skill branches on state", () => {
	it("spec — open synthesises/overwrites; closed hands to kickoff (no regression)", () => {
		const body = LOADED.spec.body;
		// branches on state
		expect(body).toContain("Branches on state");
		expect(body).toContain("Open");
		expect(body).toContain("Closed");
		// open → synthesise
		expect(body).toContain("synthesise");
		expect(body).toContain("overwrite");
		// closed → kickoff reachable
		expect(body).toContain("kickoff");
		// the flagged open risk: must not regress a closed spec to "synthesise again"
		expect(body).toContain("must");
		expect(body.toLowerCase()).toContain("not");
	});
});

describe("wayfinder skills — the new taxonomy", () => {
	it("unit-review is renamed from code-review", () => {
		expect(LOADED["unit-review"].body).toContain("renamed from `code-review`");
	});

	it("implementation-review is renamed from full-review", () => {
		expect(LOADED["implementation-review"].body).toContain("renamed from `full-review`");
	});

	it("development is reclassified composite→atomic and folds rework in", () => {
		const body = LOADED.development.body;
		expect(body).toContain("composite→atomic");
		expect(body.toLowerCase()).toContain("rework");
		// follow-up-development is deleted, not a live primitive
		expect(body).toContain("`follow-up-development` is deleted");
	});

	it("unit-map is the new unit composite owning one shared branch", () => {
		const body = LOADED["unit-map"].body;
		expect(body).toContain("one shared branch");
		expect(body).toContain("dev/<spec-slug>/<n>-<slug>");
	});

	it("implementation-review is one-per-run (successor on rework, self-closes)", () => {
		const body = LOADED["implementation-review"].body;
		expect(body).toContain("one review per run");
		expect(body).toContain("successor");
		expect(body).toContain("self-close");
	});

	it("implementation-map redirect rule (not a work target)", () => {
		const body = LOADED["implementation-map"].body;
		expect(body).toContain("not a work target");
		expect(body).toContain("redirect");
	});
});

describe("wayfinder skills — manifest wires all thirteen", () => {
	it("the manifest skills slot lists exactly the thirteen label dirs", () => {
		expect(manifest.skills).toHaveLength(13);
		const tails = manifest.skills.map((p) => p.split("skills").pop()).sort();
		expect(tails).toEqual(LABELS.map((l) => `/${l}`).sort());
	});

	it("the manifest name is wayfinder and it keeps the terminal-status dependency", () => {
		expect(manifest.name).toBe("wayfinder");
		expect(manifest.dependencies).toContain("terminal-status");
	});
});

describe("wayfinder skills — every skill points back to the overview", () => {
	for (const { label } of SKILLS) {
		it(`${label} — notes the meta-doctrine + tracker-ops ride in the overview`, () => {
			expect(LOADED[label].body).toContain("overview");
		});
	}
});
