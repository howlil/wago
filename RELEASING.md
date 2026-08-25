# Releasing Wago

Wago uses continuous integration on `main` and explicit stable releases.

## Channels

| Channel | Source | Container tags | Purpose |
| --- | --- | --- | --- |
| Edge | green `main` commit | `edge`, `sha-<commit>` | integration / pre-release verification |
| Stable | SemVer tag on `main` | `vX.Y.Z`, `X.Y.Z`, `X.Y`, `latest` | production release |

A merge to `main` is not automatically a stable release. `latest` must never point at an arbitrary `main` commit.

## Stable release rule

A stable release tag must:

1. use `vMAJOR.MINOR.PATCH`;
2. point to a commit already on `main`;
3. have green repository CI and security checks;
4. contain the intended tests/docs for user-visible changes;
5. have no known blocker that would require an immediate hotfix;
6. preserve released migration history.

Tags are immutable. Never move or reuse a published release tag.

## Version decisions before 1.0

Wago is currently pre-1.0:

- **patch**: compatible bug fix, reliability improvement, docs/tooling change;
- **minor**: new behavior or an intentional compatibility break/removal;
- **major**: reserved for the eventual stable contract or an exceptional project reset.

Removing a released compatibility path must be called out in `CHANGELOG.md` and requires at least a minor release while Wago is pre-1.0.

## Release flow

```text
small PR -> main green -> observe edge -> update changelog/version decision -> tag vX.Y.Z -> release workflow -> verify multi-arch image
```

Do not create a release branch for normal releases. Fix release problems on a normal task branch, merge to `main`, then create a new version tag. Never repair a bad release by retagging the old version.

## Rollback

Before a production upgrade that changes durable state, back up the entire `/app/data` volume.

A code rollback is safe only when the previous version can open the current durable state. If not, restore the matching backup instead of forcing an old binary onto newer state.
