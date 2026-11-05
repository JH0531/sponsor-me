# Maintenance guide

> **Other languages** · [中文 → MAINTAINING.md](MAINTAINING.md)

This document is for repository maintainers. It covers branch responsibilities, the release workflow and day-to-day version management. For code contributions, see [CONTRIBUTING-en.md](CONTRIBUTING-en.md).

This file, `CONTRIBUTING.md` and both `-en` versions are repository documents, not web content, and **never enter the `deploy` branch**.

## 1. Branch structure

```
main (source, docs, tooling; default branch)
  │  push triggers .github/workflows/deploy-sync.yml
  ▼
deploy (pure build output: index.html + assets/** + LICENSE)
  │  maintainer runs node scripts/sync-release.mjs --push
  ▼
release (fast-forward pointer to deploy; no commits of its own)
  │  dispatches release-publish → .github/workflows/release.yml runs on main
  ▼
tag V*.*.* + GitHub Release (zip / tar.gz / VERSION / SHA256SUMS)
```

| Branch | Contents | Updated by |
| --- | --- | --- |
| `main` | All source, docs, demo assets, scripts and workflows | Maintainer commits or merged PRs |
| `deploy` | 55 allowlisted files, linear history | `deploy-sync.yml` fast-forward push |
| `release` | The same commit as `deploy` | Manual gate: `sync-release.mjs --push` |

The allowlist is hard-coded in `scripts/sync-deploy.mjs` as `index.html`, `LICENSE` and `assets/**`. It is an allowlist, so any file added to `main` in the future is excluded by default. `release` always fast-forwards from `deploy`, so `git merge-base --is-ancestor release deploy` always holds.

## 2. Types of day-to-day changes

| Change | Effect | Action |
| --- | --- | --- |
| `index.html` / `assets/**` / `LICENSE` | Triggers `deploy-sync.yml`; a new deploy commit is created | Confirm the workflow passed; **no release yet** |
| READMEs, this guide, `docs/demo/**`, `CONTRIBUTING*` | Does not trigger deploy sync (not in the workflow's `paths`) | Nothing further |
| `next-version.mjs` / `sync-release.mjs` / `release.yml` | Affects publishing only | No deploy sync needed |
| `sync-deploy.mjs` / `deploy-sync.yml` | Triggers deploy sync | Check the automatic run |
| Force a sync | — | Run **Sync deploy branch** via `workflow_dispatch` in the Actions tab |

**A code change is not a release.** After `deploy` updates, you decide whether to publish via the manual gate below. `sync-deploy.mjs` compares trees and skips when the content is unchanged, so no empty version is produced.

## 3. Publishing a new version (the only manual gate)

```bash
# 1. Preview: is deploy ahead, and what is the next version?
node scripts/sync-release.mjs --dry-run
node scripts/next-version.mjs

# 2. Publish: fast-forward release + dispatch the publish event
node scripts/sync-release.mjs --push

# 3. Watch the automated publish
gh run list --repo JH0531/sponsor-me --workflow=release.yml --limit 3
gh run watch <run_id> --repo JH0531/sponsor-me --exit-status

# 4. Verify
gh release view <new-version> --repo JH0531/sponsor-me --json tagName,assets
git ls-remote --tags origin
```

`release` contains only allowlisted files — no workflow file and no `scripts/` — and GitHub reads a `push` workflow definition **from the ref that was pushed**. Publishing therefore uses `repository_dispatch` (`event_type=release-publish`) dispatched on the default branch `main` by `sync-release.mjs --push`. `release.yml` runs on `main`, resolves the release HEAD, computes the version, archives the release HEAD with `git archive`, and points the tag at that HEAD.

**No duplicate releases**: the `Idempotency guard` skips when the current release HEAD is already tagged, and `sync-release.mjs` exits immediately when `release === deploy`. To preview without publishing, run `workflow_dispatch` with `dry_run` enabled in the Actions tab.

## 4. Version rules

Format `V<MAJOR>.<MINOR>.<PATCH>` with variable-width segments (`0.000.00` is only a structural illustration). Tags are the single source of truth. `next-version.mjs` picks the largest tag by comparing the three segments **numerically**, not lexicographically — `V0.10.0` sorts before `V0.2.0` as a string.

| Current | Next |
| --- | --- |
| `V0.1.0` | `V0.1.1` |
| `V0.1.9` | `V0.2.0` (third segment carries at 10) |
| `V0.99.9` | `V1.0.0` (second segment carries at 100) |
| `V9.99.9` | `V10.0.0` (no limit on the first segment) |

The initial version is `V0.1.0`, used by the workflow when no tags exist. **Do not create, delete or rewrite `V*.*.*` tags manually** — automatic incrementing would break. Do not write the version back into a committed `VERSION` or `package.json` either: a bot commit would re-trigger the workflow. The `VERSION` inside each archive is generated at build time.

## 5. Verification and troubleshooting

```bash
node scripts/sync-deploy.mjs --dry-run      # allowlist and assertions, no side effects
node scripts/sync-deploy.mjs --verify       # remote deploy cleanliness
node scripts/sync-release.mjs --verify      # release is an ancestor of deploy and clean
git ls-tree -r --name-only origin/deploy | grep -vE '^(index\.html|LICENSE|assets/)'  # must be empty
```

`sync-deploy.mjs --prepare` creates a commit object without pushing or moving any ref, useful for reviewing what would be synced.

Rollbacks never rewrite history: `node scripts/sync-deploy.mjs --push --from <good-sha>` rebuilds from the given `main` commit but still uses the current deploy HEAD as the parent. Then run `sync-release.mjs --push` normally to publish a new version.

## 6. Caveats

- **GitHub homepage banner**: after every `--push` that updates `release`, "release had recent pushes" briefly reappears. It only means the branch was just pushed; it does not mean `release` is ahead of `main` or needs a PR. The 55 files in `release` are always a subset of `main`, and `main` remains the default branch and PR target.
- **`workflow` scope**: pushing `.github/workflows/*` from the command line requires it. If rejected on a new machine, run `gh auth refresh -s workflow`.
- **Demo assets**: filenames carry `-vN`. GitHub caches images, so a content change requires a new `v2` plus updated references in both READMEs **in the same commit**. Never overwrite in place. See [CONTRIBUTING-en.md](CONTRIBUTING-en.md) for regeneration.
- **Video attachment**: inline playback depends on a `user-attachments` URL hosted in a PR #1 comment — do not delete that comment. The source `docs/demo/journey-v2.mp4` stays in git as a backup. GitHub strips `style` attributes; image corners are baked into the assets, while player rounding is controlled by GitHub.
- **Dynamic badges**: the Version badge reads the latest tag and updates after each release; the jsDelivr badge reports hits, so `0 hits/month` is normal for a new package.
- Do not add branch protection to `deploy` that blocks pushes (automatic sync would be rejected), and never develop directly on `deploy` or `release`.
