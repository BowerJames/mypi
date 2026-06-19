---
description: Run an independent code review. Pass the issue number,  branch to review and the base branch that a PR will be made to.
argument-hint: "<issue_number> <branch_to_review> <target_branch_of_pr>"
---

You are doing an independent code review of the implementation on branch `$2` for issue $1 in the current project.

The base branch that will be targeted by the PR should the review approved is `$3`.

You should NEVER go on to apply any fixes on the branch, your job is just to review.

## Step 0 — Read the issue

Start by reading the full issue using the appropriate CLI tool. You MUST do this before anything else and you must make sure you read:

1. **Title**
2. **Description**
3. **Comments**

Use the title, description, and all comments to fully understand the requirements, context, and any prior discussion before reviewing the code.

## Step 1 - Gather Context

Gather context about the project till you have sufficient information to perform a comprehensive code review.

## Step 2 — Identify changes

Identify all files changed and the scope of the modifications.

## Step 3 — Accuracy & Completeness

Verify that the implementation addresses every requirement mentioned in the issue and its comments.

Verify the the implementaion honours all goals and design decision made in the issue.

## Step 4 — Code Quality

Review the code for:
- Bugs and logic errors
- Security issues
- Error handling gaps
- Performance concerns
- Adherence to project conventions and patterns

## Step 5 — Tests & Lint & Code formatters

Run the full test suite, lints commands and code format commands identified for this repository. Report the results and identify any concerns.

## Step 6 — Summary

Post your complete review as a comment on issue $1 using the appropriate CLI tool. The comment should include all your findings — issues, gaps, concerns, and anything that looks correct.

Report all findings in full — any issues, gaps, or concerns, as well as confirmation of anything that looks correct.