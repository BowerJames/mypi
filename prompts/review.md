---
description: Perform an independent code review.
---

Perform a code review on issue $1 implemented on the branch `$2`.

Follow these steps in order:

1. **Read the issue.** Read issue $1 and all of its comments to understand the requirements, acceptance criteria, and any context discussed.
2. **Gather context.** Check out or inspect the branch `$2` and read all changed files. Understand how the changes relate to the issue requirements.
3. **Run checks.** Run the project's test suite, lint checks, and formatting checks. Note any failures.
4. **Review the implementation.** Assess the changes against the issue's acceptance criteria and check for:
   - Completeness and accuracy — does the implementation satisfy all acceptance criteria?
   - Adherence to development guidelines — does the code follow the project's coding standards?
   - Test coverage — are tests present and passing? Do they adequately cover the changes?
   - Lint and formatting — do all checks pass?
   - Bugs and gaps — are there logic errors, edge cases, security issues, or missing error handling?
5. **Post findings.** Add a comment on issue $1 summarizing your findings. Highlight what was done well, along with any gaps, issues, concerns, deviations from the issue spec, and failed checks.
6. **Report.** Respond with the same findings here.

Do NOT make any edits or start work on fixes. Your job is only to review.
