# Contributing

## Scope

Wago is a single-account, self-hosted WhatsApp gateway. Keep changes aligned with that scope. Do not add multi-tenant, campaign, bulk sender, Redis, database, Kubernetes, or anti-detection features unless the project scope explicitly changes.

The distributable core is `backend/` + `frontend/`. The `docs/` site is maintained and hosted separately by the project owner and is not part of the runtime/container artifact.

## Local Setup

Requirements: Node.js 26 and pnpm 11.21.0.

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

`pnpm build` verifies the distributable core only. When intentionally working on the documentation site, validate it separately:

```bash
pnpm build:docs
```

Run app-specific commands when working in one area:

```bash
pnpm --dir backend test
pnpm --dir frontend test
```

## TDD Expectations

When using TDD here, drive behavior with unit tests. Write or update the relevant unit test first, verify the failure when practical, implement the smallest change, then rerun the targeted test.

Do not unit-test Baileys internals. Test Wago wrappers, policy decisions, validation, response mapping, caches, stores, and lifecycle behavior.

## Git Workflow

Keep each change easy to review and clean up. The normal lifecycle is:

```text
sync main
  -> create one task branch
  -> implement / test / fix on that branch
  -> open one PR
  -> address review and CI on the same branch
  -> squash merge
  -> delete branch and worktree
```

### One task, one branch, one PR

A task, bugfix, documentation update, or coherent feature should use at most one working branch and one pull request.

Use short purpose-prefixed names such as:

```text
feat/message-status-retention
fix/reconnect-qr-state
docs/git-workflow-discipline
chore/dependency-refresh
refactor/activity-store
```

Do not create a replacement branch because a test or CI run failed, a typo was found, review requested a small change, another TDD cycle is needed, or `main` moved forward. Keep working on the existing branch and PR.

Avoid branch churn such as:

```text
fix/foo-v2
fix/foo-final
fix/foo-final-2
fix/foo-retry
iteration-3
review-fixes-v4
```

Normal changes should go through a task branch and PR rather than being developed directly on `main`.

### Commit discipline

Commits on a task branch should be useful engineering checkpoints, not a transcript of every edit.

Useful RED/GREEN TDD checkpoints are fine when they improve diagnosis or review. There is no arbitrary maximum commit count, but every retained commit should have a clear purpose.

When they belong to the same task, avoid standalone commits such as:

```text
lint
typo
retry ci
fix previous commit
formatting
review fix
```

Prefer folding those small corrections into the next meaningful checkpoint, or amend/squash them when rewriting the branch is safe.

### Merge policy

Normal Wago pull requests use **squash merge**. This lets the working branch keep a small number of useful checkpoints while `main` receives one clean logical commit for the completed task.

Before merge, the current PR head should have the required tests/checks green and no unresolved review blocker. If the head changes after verification, verify the relevant checks again.

Merge commits or rebase merges should be used only when there is a concrete reason.

### Cleanup after merge or abandonment

After a PR is merged, delete its remote task branch unless it has an explicit continuing purpose. If you created a local worktree, remove it and then delete the local task branch.

Typical local cleanup is:

```bash
git worktree remove <task-worktree>
git branch -d <task-branch>
git worktree prune
git fetch --prune
```

For abandoned work, first preserve anything valuable intentionally, then close the unused PR when appropriate and remove the stale remote branch, local branch, and worktree.

Do not keep merged or abandoned `experiment-*`, `iteration-*`, `retry-*`, or old task branches as an archive. Git history, pull requests, tags, or explicit patches are better archives than stale branches.

Git worktrees provide isolation; they do not create a new task identity. A task worktree should normally use the same single task branch and should be removed when that task is merged or abandoned.

## Pull Requests

Pull requests should include:

- a concise description of the behavior change
- tests or a clear reason tests are not applicable
- local verification commands run
- screenshots for frontend UI changes
- linked issues when relevant

Apply CI fixes and review follow-ups to the same branch and PR when they are still part of the same task.

Never attach auth directories, QR payloads, API keys, full phone numbers, full JIDs, message text, or raw production logs.
