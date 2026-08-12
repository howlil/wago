# Git Workflow Discipline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Wago's Git workflow explicit so one task normally uses one branch and one PR, `main` stays clean through squash merges, and finished/abandoned branches and worktrees are cleaned up.

**Architecture:** Keep the policy documentation-only. `AGENTS.md` is the normative execution contract for automated workers; `CONTRIBUTING.md` is the concise human-facing workflow. Both describe the same lifecycle and deliberately avoid adding Git hooks, CI enforcement, bots, or runtime behavior.

**Tech Stack:** Markdown, Git/GitHub pull-request workflow.

## Global Constraints

- One task, bugfix, documentation update, or coherent feature gets at most one working branch.
- One normal task uses one pull request.
- Test failures, CI failures, small review follow-ups, retries, and TDD iterations stay on the same task branch and PR.
- Working commits must represent useful engineering checkpoints; formatting, typo, lint cleanup, CI retry, and `fix previous commit` noise should not become separate retained commits.
- Default normal merge method is squash merge so `main` receives one clean logical commit per task.
- After merge or abandonment, task branches and worktrees must be cleaned up when tooling permits.
- Do not introduce long-lived `develop`, iteration, experiment, or personal branches by default.
- Do not change GitHub Actions, hooks, repository runtime, product code, or deployment behavior for this task.

---

### Task 1: Add normative agent Git lifecycle rules

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: existing `Testing and Change Discipline`, `Documentation and Planning`, and verification rules.
- Produces: one authoritative `Git Workflow Discipline` section for agents.

- [ ] **Step 1: Add a dedicated Git workflow section**

Add rules that explicitly require:

```text
main -> one task branch -> work/test/review/fix on same branch -> one PR -> verify -> squash merge -> cleanup
```

Include branch prefixes `feat/`, `fix/`, `docs/`, `chore/`, and `refactor/` and reject suffix churn such as `-v2`, `-final`, `-retry`, and iteration branches.

- [ ] **Step 2: Define commit discipline**

State that meaningful TDD/checkpoint commits are allowed, but formatting, typo, lint-only cleanup, CI retry, tiny same-task review fixes, and `fix previous commit` changes should be folded into meaningful checkpoints when safe.

- [ ] **Step 3: Define merge and cleanup discipline**

Require current-head verification, mandatory green gates, no unresolved blockers, squash merge by default, and post-merge/abandonment branch/worktree cleanup. If tooling cannot perform cleanup, require the worker to report exactly what remains rather than claiming completion.

- [ ] **Step 4: Preserve existing engineering rules**

Do not weaken TDD, testing, security, documentation, or architecture requirements already present in `AGENTS.md`.

### Task 2: Add contributor-facing workflow

**Files:**
- Modify: `CONTRIBUTING.md`

**Interfaces:**
- Consumes: Task 1's lifecycle and terminology.
- Produces: concise contributor instructions matching the agent rules.

- [ ] **Step 1: Add a Git workflow section**

Document this contributor flow:

```text
sync main
  -> create one task branch
  -> implement/test/fix on that branch
  -> open one PR
  -> address review/CI on the same branch
  -> squash merge
  -> delete branch/worktree
```

- [ ] **Step 2: Add naming and anti-spam examples**

Show valid names such as `fix/reconnect-qr-state` and `docs/git-workflow-discipline`, and explicitly reject `fix/foo-v2`, `fix/foo-final`, `iteration-3`, and similar branch churn.

Explain that useful RED/GREEN checkpoints are acceptable while standalone `lint`, `typo`, `retry ci`, or `fix previous commit` commits are noise when they belong to the same task.

- [ ] **Step 3: Add cleanup guidance**

Include conceptual local cleanup commands:

```bash
git worktree remove <task-worktree>
git branch -d <task-branch>
git worktree prune
git fetch --prune
```

State that the remote task branch should also be deleted after merge unless it has an explicit continuing purpose.

### Task 3: Verify policy consistency and integrate

**Files:**
- Verify: `AGENTS.md`
- Verify: `CONTRIBUTING.md`
- Verify: `.agent/specs/2026-08-12-git-workflow-discipline-design.md`

**Interfaces:**
- Consumes: Tasks 1-2.
- Produces: one coherent repository policy ready for merge.

- [ ] **Step 1: Review both files against the approved spec**

Confirm both documents agree on:

```text
one task -> one branch -> one PR -> squash merge -> cleanup
```

Confirm neither document creates an artificial maximum commit count and neither requires a new branch for test/CI/review follow-ups.

- [ ] **Step 2: Check scope**

Confirm only documentation/internal planning files changed and no workflow, hook, product, runtime, or deployment files were modified.

- [ ] **Step 3: Open one PR from the existing task branch**

Use branch `docs/git-workflow-discipline` targeting `main`. Do not create a second branch or PR for corrections; apply all follow-ups to this same branch/PR.

- [ ] **Step 4: Verify the current PR head**

Wait for repository-required checks relevant to the documentation-only change. If the head changes after a correction, verify the new head again.

- [ ] **Step 5: Squash merge when gates are green**

Merge without another user confirmation because the task has already been authorized, provided mandatory checks are green and there are no unresolved blockers or review threads.

- [ ] **Step 6: Clean temporary Git state**

Delete the remote task branch and task worktree when available tooling supports it. If deletion is not exposed by available tooling, report that remaining cleanup explicitly.
