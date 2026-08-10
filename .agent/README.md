# Wago Agent Workspace

`.agent/` is the repository-local workspace for agent planning and execution artifacts.

## Boundary

Use `.agent/` for internal engineering work products that are useful to contributors or coding agents but are **not public product documentation**:

- design specs
- implementation plans
- audit notes
- execution/checkpoint notes
- temporary engineering decisions that should stay versioned

Use `docs/` only for the public Astro documentation site that Wago users read.

Do not place agent plans/specs under `docs/`, because everything under `docs/` belongs to the public documentation product boundary.

## Structure

```text
.agent/
  README.md
  specs/
    YYYY-MM-DD-<topic>-design.md
  plans/
    YYYY-MM-DD-<topic>.md
```

Add another subdirectory only when a real recurring artifact type appears. Do not mirror source-code architecture inside `.agent/`.

## Source-of-truth hierarchy

1. Runtime/backend/frontend code defines actual product behavior.
2. Root `plan.md` is the concise engineering roadmap and milestone ledger.
3. `.agent/specs/` holds approved designs.
4. `.agent/plans/` holds detailed task-by-task implementation plans.
5. `docs/` explains released/current Wago behavior to public users.

If a public document and code disagree, fix the public document. If an agent plan and current code disagree because the implementation has advanced, update the plan/ledger before continuing.

## Public documentation rule

Never publish agent workflow language, internal checkpoints, speculative implementation details, or unfinished requirements in the Astro docs unless they are intentionally rewritten as user-facing documentation.
