# 维护指南

> **其他语言** · [English → MAINTAINING-en.md](MAINTAINING-en.md)

本文档面向仓库维护者，说明分支职责、发版流程与版本号的日常操作。参与代码贡献请先看 [CONTRIBUTING.md](CONTRIBUTING.md)。

本文件、`CONTRIBUTING.md` 及两份 `-en` 版本都是仓库文档，不属于网页内容，**不会进入 `deploy` 分支**。

## 1. 分支结构

```
main（源码、文档、工具，默认分支）
  │  push 触发 .github/workflows/deploy-sync.yml
  ▼
deploy（纯净部署产物：index.html + assets/** + LICENSE）
  │  人工执行 node scripts/sync-release.mjs --push
  ▼
release（deploy 的快进指针，自身不产生提交）
  │  派发 release-publish → .github/workflows/release.yml 在 main 上运行
  ▼
tag V*.*.* + GitHub Release（zip / tar.gz / VERSION / SHA256SUMS）
```

| 分支 | 内容 | 谁更新 |
| --- | --- | --- |
| `main` | 全部源码、文档、演示素材、脚本、workflow | 维护者提交或合并 PR |
| `deploy` | 55 个白名单文件，线性历史 | `deploy-sync.yml` 自动快进推送 |
| `release` | 与 `deploy` 同一提交 | 人工闸门 `sync-release.mjs --push` |

`deploy` 白名单由 `scripts/sync-deploy.mjs` 硬编码为 `index.html`、`LICENSE`、`assets/**`，采用 allowlist：main 今后新增的任何文件默认被挡在外面。`release` 永远快进自 `deploy`，因此 `git merge-base --is-ancestor release deploy` 恒成立。

## 2. 日常改动分类

| 改动 | 后果 | 需要做什么 |
| --- | --- | --- |
| `index.html` / `assets/**` / `LICENSE` | 触发 `deploy-sync.yml`，自动生成 deploy 新提交 | 确认 workflow 成功；此时**尚未发版** |
| README、本文档、`docs/demo/**`、`CONTRIBUTING*` | 不触发 deploy 同步（不在 workflow 的 `paths` 内） | 无需额外操作 |
| `next-version.mjs` / `sync-release.mjs` / `release.yml` | 只影响发版流程 | 不影响 deploy，无需同步 |
| `sync-deploy.mjs` / `deploy-sync.yml` | 触发 deploy 同步 | 核对自动运行结果 |
| 需要强制同步一次 | — | Actions 页手动 `workflow_dispatch` 运行 **Sync deploy branch** |

**改代码不等于发版**。deploy 更新后，是否发版由你按下述人工闸门决定。`sync-deploy.mjs` 会比对 tree，内容无变化时不产生空提交，因此不会产生空版本。

## 3. 发布新版本（唯一人工闸门）

```bash
# 1. 预览：确认 deploy 已更新、release 落后多少、下一版本号
node scripts/sync-release.mjs --dry-run
node scripts/next-version.mjs

# 2. 发版：快进 release + 派发发版事件
node scripts/sync-release.mjs --push

# 3. 观察自动发布
gh run list --repo JH0531/sponsor-me --workflow=release.yml --limit 3
gh run watch <run_id> --repo JH0531/sponsor-me --exit-status

# 4. 核对
gh release view <新版本号> --repo JH0531/sponsor-me --json tagName,assets
git ls-remote --tags origin
```

`release` 分支只含白名单内容，既没有 workflow 文件也没有 `scripts/`，而 GitHub 的 `push` 事件从**被推送的 ref** 读取 workflow 定义，所以发版改由 `sync-release.mjs --push` 在默认分支 `main` 派发 `repository_dispatch`（`event_type=release-publish`）。`release.yml` 在 `main` 上运行，解析 release HEAD、计算版本号、`git archive <release HEAD>` 打包，并把 tag 指向 release HEAD。

**不会重复发版**：`Idempotency guard` 在当前 release HEAD 已有 tag 时跳过；`release === deploy` 时 `sync-release.mjs` 直接退出。只预览不发布，可在 Actions 页用 `workflow_dispatch` 勾选 `dry_run`。

## 4. 版本号规则

格式 `V<MAJOR>.<MINOR>.<PATCH>`，段宽不固定（`0.000.00` 仅为结构示意）。tag 是唯一事实源，`next-version.mjs` 按三段**数值**取最大 tag，不依赖字典序——因为 `V0.10.0` 的字符串顺序会排在 `V0.2.0` 之前。

| 当前 | 下一个 |
| --- | --- |
| `V0.1.0` | `V0.1.1` |
| `V0.1.9` | `V0.2.0`（第三段逢 10 进 1） |
| `V0.99.9` | `V1.0.0`（第二段逢 100 进 1） |
| `V9.99.9` | `V10.0.0`（首段不设上限） |

初版为 `V0.1.0`，由 workflow 在「无任何 tag」时启用。**不要手动创建、删除或改写 `V*.*.*` tag**，否则自动递增会错乱；也不要把版本号回写进 `VERSION` / `package.json` 并提交到分支——机器人提交会再次触发 workflow 造成循环。包内的 `VERSION` 是打包时动态生成的。

## 5. 验证与排错

```bash
node scripts/sync-deploy.mjs --dry-run      # 白名单清单与断言，零副作用
node scripts/sync-deploy.mjs --verify       # 远端 deploy 是否纯净
node scripts/sync-release.mjs --verify      # release 是否为 deploy 的祖先且内容纯净
git ls-tree -r --name-only origin/deploy | grep -vE '^(index\.html|LICENSE|assets/)'  # 应无输出
```

`sync-deploy.mjs --prepare` 可只生成 commit 对象、不推送、不移动任何引用，用于本地审阅将要同步的内容。

回滚不改写历史：`node scripts/sync-deploy.mjs --push --from <good-sha>` 会从指定 main 提交重建内容，但仍以当前 deploy HEAD 为父提交生成回滚提交；之后照常执行 `sync-release.mjs --push` 发布一个新版本。

## 6. 注意事项

- **GitHub 首页横幅**：每次 `--push` 更新 `release` 后，「release had recent pushes」会短暂重现。它只表示该分支刚被推送，不代表 release 领先 main、也不代表需要 PR。release 的 55 个文件始终是 main 的子集，默认分支与 PR 目标始终是 main。
- **`workflow` scope**：命令行推送 `.github/workflows/*` 需要 `workflow` scope。换机器或重新登录后被拒，执行 `gh auth refresh -s workflow`。
- **演示素材**：文件名带 `-vN`。GitHub 有图片缓存，内容变更要新建 `v2` 并在**同一提交**改两份 README 的引用，绝不原地覆盖。复现方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。
- **视频附件**：内联视频依赖 `user-attachments` URL（挂在 PR #1 的评论里），请勿删除该评论；`docs/demo/journey-v2.mp4` 源片留在 git 中作备份。GitHub 会剥离 `style` 属性，图片圆角已烘焙进素材，播放器圆角由 GitHub 控制。
- **动态徽章**：Version 徽章读最新 tag，发版后自动更新；jsDelivr 徽章读 hits，新包显示 `0 hits/month` 属正常。
- 不要给 `deploy` 加禁止推送的分支保护，否则自动同步会被拒；也不要在 `deploy` / `release` 上直接开发。
