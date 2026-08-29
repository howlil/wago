# Contributing

## Scope

Wago is a single-account, self-hosted WhatsApp gateway. Keep changes aligned with that scope. Do not add multi-tenant, campaign, bulk sender, Redis, database, Kubernetes, or anti-detection features unless the project scope explicitly changes.

The distributable core is `backend/` + `frontend/`. The `docs/` site is maintained and hosted separately by the project owner and is not part of the runtime/container artifact.

Repository-wide engineering policy is defined by `AGENTS.md`. When this document and `AGENTS.md` conflict, follow `AGENTS.md`.

## Local Setup

Requirements: Node.js 26 and pnpm 11.21.0.

```bash
pnpm install
pnpm check
pnpm test:core
pnpm build:core
```

When intentionally working on the documentation site, validate it separately:

```bash
pnpm test:docs
pnpm build:docs
```

Run app-specific commands when working in one area:

```bash
pnpm --dir backend test
pnpm --dir frontend test
```

## Testing and Verification

Verification is risk-based. Identify what can realistically break, then choose the cheapest high-signal check that can detect that failure. Run focused checks during development and widen verification when risk or repository gates that apply to the affected scope require it.

TDD is optional. Use it when a deterministic automated test is the clearest and cheapest way to define or protect behavior; do not use it as ceremony.

Prioritize durable automated tests for business/domain invariants, persistence/data integrity, lifecycle or concurrency behavior, migrations, security boundaries, public/provider contracts, and valuable deterministic regressions.

Do not unit-test Baileys internals. Test Wago wrappers, policy decisions, validation, response mapping, caches, stores, and lifecycle behavior.

Do not add a test without a realistic regression it protects. Do not weaken or delete a valid test merely to make CI green.

## Git Workflow

Keep substantive repository changes bounded, short-lived, and easy to review or revert. The normal lifecycle is:

```text
sync main
  -> create one task branch
  -> implement / verify / fix on that branch
  -> open one PR
  -> address review and CI on the same branch
  -> applicable gates
  -> squash merge
  -> cleanup
```

### One task, one branch, one PR

A task, bugfix, documentation update, or coherent feature should normally use at most one working branch and one pull request.

Use short purpose-prefixed names such as:

```text
feat/message-status-retention
fix/reconnect-qr-state
docs/git-workflow-discipline
chore/dependency-refresh
refactor/activity-store
```

Do not create a replacement branch because a test or CI run failed, a typo was found, review requested a small change, additional verification is needed, or `main` moved forward. Keep working on the existing branch and PR.

Avoid branch churn such as:

```text
fix/foo-v2
fix/foo-final
fix/foo-final-2
fix/foo-retry
iteration-3
review-fixes-v4
```

Do not create repository branches or PRs solely for plans, iteration announcements, checkpoints, status updates, or evidence transcripts.

Normal substantive changes should go through a short-lived task branch and PR rather than being developed directly on `main`.

### Commit discipline

Commits on a task branch should be useful engineering checkpoints, not a transcript of every edit.

There is no arbitrary maximum commit count, but every retained commit should have a clear purpose. TDD-specific RED/GREEN checkpoints are allowed when useful but are never required.

When they belong to the same task, avoid standalone commits such as:

```text
lint
typo
retry ci
fix previous commit
formatting
review fix
```

Prefer folding small corrections into the next meaningful checkpoint, or amend/squash them when rewriting the branch is safe.

### Merge policy

Normal Wago pull requests use **squash merge**. This lets the working branch retain useful checkpoints while `main` receives one clean logical commit for the completed task.

Before merge, the current PR head should satisfy the approved scope, relevant risk-based verification, repository/CI gates that apply to the affected change, and have no unresolved material review blocker. If the head changes after verification, rerun only checks materially affected by that change.

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

Keep PR descriptions proportional to the change. Include only context that materially helps review: a concise description of the behavior/policy change, non-obvious risk or verification evidence, screenshots when visual review materially benefits, and linked issues when they add useful context.

Do not duplicate CI output, command transcripts, or routine status reporting in the PR body. Apply CI fixes and review follow-ups to the same branch and PR when they are still part of the same task.

Never attach auth directories, QR payloads, API keys, full phone numbers, full JIDs, message text, or raw production logs.
