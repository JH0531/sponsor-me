#!/usr/bin/env node
/**
 * sync-deploy.mjs — 从 main 的提交树按白名单生成纯净的 deploy 分支
 *
 * 设计要点：
 *   - allowlist（白名单）而非 .gitignore 黑名单：main 新增的任何文件默认一律不进 deploy。
 *   - 只读 `git ls-tree -r HEAD`（提交树，不读工作区）→ 未跟踪文件、.media/、stash 完全不在视野。
 *   - 用 GIT_INDEX_FILE 指向仓库外的临时 index 组装 tree，不创建本地 deploy 分支、
 *     不 checkout / reset / clean / stash，因此不会破坏任何本地状态。
 *   - deploy 保持线性历史：首次创建 root 提交，之后每次都以当前 deploy HEAD 为父提交，
 *     用普通快进推送（不 force）。这样 release 可以从 deploy 分叉并持续快进合并。
 *   - 内容与当前 deploy 相同时不产生空提交，避免触发空版本。
 *   - LICENSE 为硬性必含项，缺失即断言失败。
 *
 * 用法：
 *   node scripts/sync-deploy.mjs --dry-run                 打印清单 + 断言，不写任何对象/引用
 *   node scripts/sync-deploy.mjs --prepare                生成 commit 对象但不推送（本地审阅）
 *   node scripts/sync-deploy.mjs --push                   生成并快进推送到 origin/deploy
 *   node scripts/sync-deploy.mjs --push --from <ref>      从指定 main 提交重建（回滚用，仍保持线性历史）
 *   node scripts/sync-deploy.mjs --verify                 校验 origin/deploy 是否纯净
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* ── 白名单：deploy 分支唯一允许出现的路径 ─────────────────────────────── */
const ALLOW = (p) => p === 'index.html' || p === 'LICENSE' || p.startsWith('assets/');
const ALLOW_DESC = ['index.html', 'LICENSE', 'assets/**'];

/* ── 参数 ─────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const from = (() => { const i = argv.indexOf('--from'); return i >= 0 ? argv[i + 1] : 'HEAD'; })();

function git(args, opts = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    env: { ...process.env, ...(opts.index ? { GIT_INDEX_FILE: opts.index } : {}) },
    maxBuffer: 64 * 1024 * 1024,
  }).trimEnd();
}

/** 只读查询远端 deploy HEAD；不存在返回 null */
function remoteDeploy() {
  const out = git(['ls-remote', '--heads', 'origin', 'refs/heads/deploy']);
  if (!out) return null;
  return out.split('\n')[0].split('\t')[0].trim() || null;
}

/* ── 1. 从提交树枚举（不读工作区） ─────────────────────────────────────── */
let entries;
try {
  entries = git(['ls-tree', '-r', '-z', from]).split('\0').filter(Boolean).map((line) => {
    const tab = line.indexOf('\t');
    const [mode, type, sha] = line.slice(0, tab).split(' ');
    return { mode, type, sha, path: line.slice(tab + 1) };
  });
} catch (e) {
  console.error(`[FAIL] 无法读取 ${from} 的提交树：${e.message}`);
  process.exit(1);
}

const allowed = entries.filter((e) => ALLOW(e.path));
const rejected = entries.filter((e) => !ALLOW(e.path));

/* ── 2. 提交前打印完整清单 + 断言 ──────────────────────────────────────── */
console.log(`源提交 : ${git(['rev-parse', '--short', from])}`);
console.log(`白名单 : ${ALLOW_DESC.join(' , ')}`);
console.log(`\n将进入 deploy 的 ${allowed.length} 个文件：`);
for (const e of allowed) console.log('  + ' + e.path);
console.log(`\n被白名单挡下的 ${rejected.length} 个文件（预期全部不进 deploy）：`);
for (const e of rejected) console.log('  - ' + e.path);

const problems = [];
if (!allowed.some((e) => e.path === 'index.html')) problems.push('缺少 index.html');
if (!allowed.some((e) => e.path === 'LICENSE')) problems.push('缺少 LICENSE（决策要求必含）');
if (!allowed.some((e) => e.path.startsWith('assets/'))) problems.push('缺少 assets/');
const illegal = allowed.filter((e) => !ALLOW(e.path));
if (illegal.length) problems.push('白名单外文件竟被纳入: ' + illegal.map((e) => e.path).join(', '));
if (problems.length) {
  console.error('\n[FAIL] 断言失败:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('\n[OK] 断言通过：白名单外文件 = 0，LICENSE 必含。');

/* ── 3. --verify：校验远端 deploy 是否纯净 ─────────────────────────────── */
if (has('--verify')) {
  let remote;
  try {
    remote = git(['ls-tree', '-r', '--name-only', 'origin/deploy']).split('\n').filter(Boolean);
  } catch {
    console.error('[FAIL] 读不到 origin/deploy，请先执行 git fetch origin');
    process.exit(1);
  }
  const bad = remote.filter((p) => !ALLOW(p));
  const missing = ['index.html', 'LICENSE'].filter((p) => !remote.includes(p));
  console.log(`${remote.length} 个文件`);
  if (bad.length) console.error('[FAIL] 远端 deploy 越界: ' + bad.join(', '));
  if (missing.length) console.error('[FAIL] 远端 deploy 缺失: ' + missing.join(', '));
  if (bad.length || missing.length) process.exit(1);
  console.log('[OK] 远端 deploy 纯净');
  process.exit(0);
}

const oldSha = remoteDeploy();
console.log(`\ndeploy 当前 HEAD : ${oldSha ? oldSha.slice(0, 7) + '（将作为父提交）' : '不存在（首次创建 root 提交）'}`);

if (has('--dry-run')) { console.log('\ndry-run：未创建提交、未推送、未移动任何引用。'); process.exit(0); }
if (!has('--push') && !has('--prepare')) {
  console.log('\n提示：加 --dry-run / --prepare / --push / --verify');
  process.exit(0);
}

/* ── 4. 临时暂存区组装 tree ────────────────────────────────────────────── */
const tmp = mkdtempSync(join(tmpdir(), 'sponsor-deploy-'));
const idx = join(tmp, 'index');
try {
  git(['read-tree', '--empty'], { index: idx });
  for (const e of allowed) {
    // 直接复用 HEAD 树里的 blob sha，不读工作区文件
    git(['update-index', '--add', '--cacheinfo', `${e.mode},${e.sha},${e.path}`], { index: idx });
  }
  const tree = git(['write-tree'], { index: idx });

  // 无变化检测：tree 相同就不产生空提交
  let unchanged = false;
  if (oldSha) {
    git(['fetch', 'origin', 'refs/heads/deploy:refs/remotes/origin/deploy', '--force']);
    try {
      if (git(['rev-parse', `${oldSha}^{tree}`]) === tree) unchanged = true;
    } catch { /* 对象不可读时按有变化处理 */ }
  }

  if (unchanged) {
    console.log('\n[OK] deploy 内容无变化：跳过，不产生空提交、不推送。');
  } else {
    /* ── 5. 带父提交的普通提交（线性历史） ──────────────────────────── */
    const srcSha = git(['rev-parse', from]);
    const args = ['commit-tree', tree];
    if (oldSha) args.push('-p', oldSha);
    args.push('-m', `deploy: sync from main @ ${srcSha.slice(0, 7)}`);
    const commit = git(args);

    console.log(`\n  commit = ${commit}`);
    console.log(`  tree   = ${tree}`);
    console.log(`  parent = ${oldSha || '(root)'}`);

    if (has('--prepare')) {
      console.log('\n[OK] 已生成 commit 对象：未推送、未移动任何引用（可用 git show <commit> 审阅）。');
    } else {
      /* ── 6. 普通快进推送（不 force） ──────────────────────────────── */
      git(['push', 'origin', `${commit}:refs/heads/deploy`]);
      console.log(`[OK] ${oldSha ? '快进更新' : '首次创建'} origin/deploy`);
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
