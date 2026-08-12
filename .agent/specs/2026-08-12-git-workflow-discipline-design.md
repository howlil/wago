# Git Workflow Discipline Design

## Status

Proposed design for repository-wide Git workflow discipline. This document defines the intended rules before `AGENTS.md` and `CONTRIBUTING.md` are changed.

## Goal

Keep Wago's Git history and branch lifecycle small, intentional, and easy to audit.

The workflow must prevent three recurring forms of repository noise:

1. creating a new branch for every small follow-up, failed test, or retry;
2. creating commits for formatting, typo fixes, CI retries, or "fix previous commit" changes that belong to the same task;
3. leaving merged, abandoned, experimental, or worktree branches behind after they are no longer useful.

The desired end state is simple:

```text
main
  -> one task branch
  -> work / test / review / fix on the same branch
  -> one PR
  -> mandatory checks green + no unresolved blocker
  -> squash merge
  -> delete task branch
  -> remove task worktree
```

`main` should therefore receive one clean logical commit for a normal completed task.

## Scope

This design covers:

- task branch creation and reuse;
- branch naming;
- commit discipline;
- pull request lifecycle;
- merge policy;
- branch cleanup;
- Git worktree cleanup;
- abandoned/stale work;
- agent behavior in `AGENTS.md`;
- contributor-facing guidance in `CONTRIBUTING.md`.

This design does not add automation scripts, Git hooks, branch-protection settings, or new CI jobs. Those can be introduced later only if manual/documented discipline proves insufficient.

## Design Decision

Use the same workflow model for agents and human contributors, documented at two levels:

- `AGENTS.md` contains mandatory execution rules for coding agents and automated contributors.
- `CONTRIBUTING.md` contains the human-readable contributor workflow and examples.

The rules must describe the same lifecycle and must not contradict each other.

This is preferred over keeping the policy in only one file because agents and human contributors enter the repository through different surfaces. It is also preferred over relying only on GitHub repository settings because GitHub settings cannot fully govern local worktrees, unnecessary checkpoint commits, branch reuse, or abandoned local state.

## Core Workflow

### 1. One task, one working branch

A task, bugfix, documentation update, or coherent feature gets at most one working branch.

A new branch is justified when the work is independently reviewable and can be merged or abandoned independently.

The following are **not** reasons to create another branch:

- a test fails;
- CI fails;
- formatting needs correction;
- a typo is found;
- review requests a small follow-up;
- implementation needs another RED/GREEN cycle;
- the task needs another attempt;
- documentation for the same task needs correction;
- the base branch moved while the task is still active.

Those changes remain on the existing task branch.

Before creating a branch, the worker must check whether an active branch already represents the same task. If it does, continue that branch.

### 2. Branch naming

Use short, descriptive branch names with a purpose prefix:

```text
feat/<task-slug>
fix/<task-slug>
docs/<task-slug>
chore/<task-slug>
refactor/<task-slug>
```

Examples:

```text
fix/reconnect-qr-state
docs/git-workflow-discipline
feat/message-status-retention
```

Do not create branch-name sequences such as:

```text
fix/foo-v2
fix/foo-final
fix/foo-final-2
fix/foo-retry
iteration-3
review-fixes-v4
```

If the work is still the same task, keep using the original task branch.

### 3. Do not use `main` as a normal working branch

Normal product, bugfix, refactor, documentation, and maintenance changes should be developed on a task branch and merged through a PR.

Direct changes to `main` should be exceptional and explicitly requested, such as a repository emergency where the normal PR workflow is unsuitable.

### 4. Working commits must represent useful checkpoints

Commits on a task branch may exist when they provide a real engineering checkpoint, for example:

- a meaningful TDD RED checkpoint when preserving evidence is useful;
- the corresponding coherent GREEN implementation;
- a substantial independently understandable change within a larger task;
- a checkpoint required to trigger CI or review when that feedback is genuinely needed.

Do **not** create a separate commit merely for:

- formatting;
- lint cleanup;
- a typo;
- CI retry;
- renaming a variable immediately after the previous commit;
- "fix previous commit";
- tiny review feedback that belongs to the same logical change;
- regenerating an artifact caused by the same task;
- another attempt after a failed test.

Prefer folding those edits into the next meaningful checkpoint. When history rewriting is safe and local tooling supports it, small corrections may be amended or squashed before final review.

There is no artificial hard maximum number of working commits. The rule is semantic: every retained working commit must earn its existence.

### 5. TDD does not justify branch or commit spam

TDD may produce multiple RED/GREEN cycles inside one task, but those cycles stay on the same branch.

Intermediate RED/GREEN commits are optional, not mandatory. Preserve them only when they are useful for diagnosis, review, or evidence. Do not create a commit for every individual test run.

A failed test is feedback within the current task, not a new task identity.

### 6. One task, one pull request

A normal task uses one PR from its task branch to `main`.

Do not open a new PR because:

- the first review requested changes;
- CI failed;
- another test was added;
- a small follow-up was required;
- the PR moved from draft to ready;
- the implementation was revised.

Push the revisions to the existing branch and keep the existing PR.

A draft PR should be used only when early CI or review is materially useful. Do not create draft PRs automatically for every task.

### 7. Keep task scope coherent

A branch may contain all changes necessary to complete its task, including tests and documentation directly associated with that task.

Do not mix unrelated opportunistic cleanup into the task merely because the files are already open. Unrelated work should be deferred or handled as a separate future task.

Conversely, do not split one coherent task into artificial micro-branches merely to make each diff smaller.

### 8. Update the existing branch when `main` advances

If `main` changes while a task is active, update or rebase the existing task branch when necessary. Do not create a replacement branch only to get a newer base.

Avoid force-pushing shared branches unless rewriting is necessary and safe. Never rewrite another contributor's active history casually.

## Merge Policy

### Default: squash merge

Normal Wago tasks use **squash merge**.

This intentionally separates two histories:

- the task branch may contain a small number of useful engineering checkpoints;
- `main` receives one clean logical commit for the completed task.

The squash commit title should describe the completed behavior or repository change, not the sequence of intermediate attempts.

### Merge gate

A previously authorized task can be merged without requesting an additional confirmation when all of the following are true:

1. required acceptance/focused tests pass;
2. mandatory CI checks are green;
3. required build/security checks for the scope are green;
4. there are no unresolved review threads or known blockers;
5. the PR still points to the reviewed/verified head revision;
6. the task remains within the originally authorized scope.

If the PR head changes after verification, re-check the relevant gates before merge.

Do not merge simply to hide failing tests or unresolved review feedback.

### Non-default merge methods

Merge commits or rebase merges require an explicit reason. They should not be used for normal task completion merely because the repository permits them.

## Cleanup Policy

A task is not operationally complete at merge time until its temporary Git state is cleaned up.

### After a successful merge

When tooling permits:

1. delete the remote task branch;
2. remove the local task worktree, if one was created;
3. delete the local task branch after the worktree no longer uses it;
4. prune stale worktree metadata when necessary.

Typical local cleanup is conceptually equivalent to:

```bash
git worktree remove <task-worktree>
git branch -d <task-branch>
git worktree prune
git fetch --prune
```

Remote branch deletion should also occur after the PR is merged unless the branch has a documented continuing purpose.

If the current tool cannot delete a remote branch or worktree, the worker must report that cleanup remains instead of pretending it was completed. The branch must not be reused as an unrelated permanent branch.

### Abandoned work

When a task is abandoned:

- close its PR if one exists and it will not be resumed;
- delete the abandoned remote branch when safe;
- remove its local worktree;
- delete the local branch after any valuable work has been intentionally preserved elsewhere.

Do not keep `experiment-*`, `iteration-*`, `retry-*`, or old task branches indefinitely as an informal archive. Git history, PRs, tags, or explicit patches are the archive; stale branches are not.

### Long-lived branches

Do not introduce long-lived `develop`, iteration, staging-code, personal, or experiment branches by default.

`main` is the integration branch. Any additional long-lived branch requires a demonstrated repository need and an explicit policy change.

## Worktree Rules

Git worktrees are an isolation mechanism, not a second branch-management system.

When a worktree is useful:

- create at most one task worktree for the active task branch unless there is a concrete need for another;
- the worktree and branch share the same task identity;
- do not create a new branch merely because a new worktree was created;
- do not keep task worktrees after merge or abandonment;
- never delete a worktree that contains uncommitted work without intentionally preserving or discarding that work first.

A task branch that has been merged must not remain checked out in an unused worktree.

## Agent-Specific Rules

`AGENTS.md` should make the following requirements explicit for automated workers:

1. Search for an existing active branch/PR representing the current task before creating another one.
2. Use at most one working branch for the task.
3. Continue the same branch after test failures, CI failures, or review follow-ups.
4. Avoid commits that only represent mechanical cleanup or retries.
5. Keep one PR for the task.
6. Verify the current PR head and mandatory gates immediately before merge.
7. Use squash merge by default.
8. After merge, clean the branch/worktree when the available tooling supports deletion.
9. If cleanup cannot be performed with available tooling, state exactly what remains.
10. Never claim a branch/worktree was deleted without evidence.
11. Do not create permanent iteration or experiment branches.
12. Do not ask for another merge confirmation when the user already authorized completion and the documented merge gate is satisfied.

## Contributor-Facing Rules

`CONTRIBUTING.md` should explain the same workflow more compactly:

```text
sync main
  -> create one task branch
  -> implement/test/fix on that branch
  -> open one PR
  -> address review/CI on same branch
  -> squash merge
  -> delete branch/worktree
```

It should include:

- branch naming examples;
- examples of valid vs noisy commits;
- the default squash-merge policy;
- branch/worktree cleanup commands;
- a warning against keeping stale experiment branches.

The contributor documentation should explain the reason for the policy: reviewability and repository hygiene, not cosmetic commit-count targets.

## Examples

### Correct bugfix lifecycle

```text
main
  -> fix/reconnect-qr-state
      -> regression test
      -> implementation
      -> CI reveals lint issue
      -> lint corrected on same branch
      -> review asks for one edge-case test
      -> test added on same branch
  -> same PR
  -> squash merge
  -> delete branch/worktree
```

### Incorrect bugfix lifecycle

```text
main
  -> fix/reconnect-qr
  -> fix/reconnect-qr-v2
  -> fix/reconnect-qr-ci
  -> fix/reconnect-qr-final
  -> four PRs
  -> commits: "lint", "typo", "retry ci", "fix previous"
  -> merged branches left behind
```

### Correct TDD lifecycle

```text
fix/message-idempotency
  -> optional RED checkpoint
  -> GREEN implementation
  -> refactor/test cleanup folded coherently
  -> squash merge to one main commit
```

### Correct documentation follow-up

If review finds a typo in documentation added by the current task, fix it on the same task branch and PR. Do not create `docs/typo-fix` for a typo that is still part of an unmerged PR.

## Failure and Exception Handling

A workflow rule may be bypassed only when there is a concrete reason, such as:

- an emergency production repair explicitly requiring direct handling;
- a branch is corrupted or inaccessible and cannot reasonably be recovered;
- a security-sensitive correction requires a different disclosure workflow;
- another contributor owns the active branch and rewriting it would be unsafe.

When an exception is used, document why. Do not silently turn exceptions into the normal workflow.

## Acceptance Criteria for Implementation

The eventual implementation of this design is complete when:

1. `AGENTS.md` has a dedicated Git workflow/branch lifecycle section containing the mandatory agent rules.
2. `CONTRIBUTING.md` has a concise contributor workflow with branch, commit, PR, squash-merge, and cleanup guidance.
3. Both files agree that one task normally uses one branch and one PR.
4. Both files explicitly reject new branches for CI failures, small review follow-ups, retries, or TDD iterations.
5. Both files distinguish useful intermediate commits from commit spam.
6. Squash merge is documented as the default normal merge method.
7. Post-merge branch and worktree cleanup is explicit.
8. Abandoned/stale branches and worktrees are explicitly cleaned up rather than retained indefinitely.
9. No automation, hook, CI, or runtime behavior is changed as part of this documentation-only task.
10. The documentation remains consistent with Wago's existing testing/change-discipline rules.

## Deliberate Non-Goals

Do not add the following in the first implementation:

- automated branch deletion workflows;
- scheduled stale-branch deletion;
- pre-commit hooks solely for enforcing commit count;
- commit-count CI checks;
- branch-name CI enforcement;
- semantic-release changes;
- GitFlow or a permanent `develop` branch;
- stacked-PR infrastructure;
- bots that rewrite contributor history.

The initial solution should solve the observed problem with a clear repository policy before adding enforcement machinery.
