#!/usr/bin/env node
/**
 * sync-release.mjs — 人工把 deploy 快进同步到 release（发版闸门）
 *
 * release 从 deploy 分叉。版本号只存在 tag、release 上不产生自己的提交，
 * 因此每次同步都应是 fast-forward。本脚本不产生新提交，只推进 release 指针。
 *
 * release 分支只含白名单内容、不含 workflow 文件，push 事件无法触发发版；
 * 因此推送后在默认分支 main 派发 repository_dispatch，由 release.yml 处理。
 *
 * 用法：
 *   node scripts/sync-release.mjs --dry-run    检查可否快进，不推送
 *   node scripts/sync-release.mjs --push       快进推送 release
 *   node scripts/sync-release.mjs --verify     校验 release 与 deploy 的关系及纯净性
 */
import { execFileSync } from 'node:child_process';

const ALLOW = (p) => p === 'index.html' || p === 'LICENSE' || p.startsWith('assets/');

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trimEnd();
}

function remoteHeads() {
  const out = git(['ls-remote', '--heads', 'origin', 'refs/heads/deploy', 'refs/heads/release']);
  const map = {};
  for (const line of out.split('\n').filter(Boolean)) {
    const [sha, ref] = line.split('\t');
    if (ref) map[ref.replace('refs/heads/', '')] = sha.trim();
  }
  return map;
}

function isAncestor(older, newer) {
  try {
    git(['merge-base', '--is-ancestor', older, newer]);
    return true;
  } catch {
    return false;
  }
}

function assertClean(commit, label) {
  const files = git(['ls-tree', '-r', '--name-only', commit]).split('\n').filter(Boolean);
  const bad = files.filter((p) => !ALLOW(p));
  if (bad.length) {
    console.error(`[FAIL] ${label} 存在白名单外文件: ` + bad.join(', '));
    process.exit(1);
  }
  if (!files.includes('LICENSE')) {
    console.error(`[FAIL] ${label} 缺少 LICENSE`);
    process.exit(1);
  }
  return files.length;
}

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const heads = remoteHeads();
const deploy = heads.deploy || null;
const release = heads.release || null;

console.log(`deploy  = ${deploy ? deploy.slice(0, 7) : '(不存在)'}`);
console.log(`release = ${release ? release.slice(0, 7) : '(不存在)'}`);

if (!deploy) {
  console.error('[FAIL] 远端没有 deploy 分支，请先运行 node scripts/sync-deploy.mjs --push');
  process.exit(1);
}

// 拉取对象以便做祖先判断与内容校验；两个 ref 分别 fetch，release 可能尚未创建
git(['fetch', 'origin', 'refs/heads/deploy:refs/remotes/origin/deploy', '--force']);
if (release) {
  try {
    git(['fetch', 'origin', 'refs/heads/release:refs/remotes/origin/release', '--force']);
  } catch { /* release 对象可能尚不可读，后续按 ref 处理 */ }
}

const fileCount = assertClean(deploy, 'deploy');

if (release) {
  if (!isAncestor(release, deploy)) {
    console.error('[FAIL] release 不是 deploy 的祖先（历史分叉或 release 有独立提交），拒绝覆盖。');
    console.error('       请人工检查后处理，不要用 force push 抹掉发版历史。');
    process.exit(1);
  }
  assertClean(release, 'release');
  const behind = git(['rev-list', '--count', `${release}..${deploy}`]);
  console.log(`\nrelease 落后 deploy ${behind} 个提交，可快进（${fileCount} 个白名单文件）。`);
} else {
  console.log(`\nrelease 尚未创建，将指向 deploy 当前提交（${fileCount} 个白名单文件）。`);
}

if (has('--verify')) {
  if (!release) {
    console.error('[FAIL] release 分支尚未初始化');
    process.exit(1);
  }
  console.log(`[OK] release 是 deploy 的祖先，内容纯净（${fileCount} 个文件）。`);
  process.exit(0);
}

if (release === deploy) {
  console.log('\n[OK] release 已与 deploy 一致，无需同步（不会触发发版）。');
  process.exit(0);
}

if (has('--dry-run')) {
  console.log('\ndry-run：未推送、未移动任何引用。');
  console.log(`  执行 --push 将把 release 快进到 ${deploy.slice(0, 7)} 并派发发版事件。`);
  process.exit(0);
}

if (!has('--push')) {
  console.log('\n提示：加 --dry-run / --push / --verify');
  process.exit(0);
}

git(['push', 'origin', `${deploy}:refs/heads/release`]);
console.log(`[OK] ${release ? '快进更新' : '首次创建'} origin/release → ${deploy.slice(0, 7)}`);

// 在默认分支 main 派发事件；release.yml 定义在 main，才能读到 next-version.mjs
try {
  execFileSync('gh', [
    'api', '-X', 'POST', 'repos/{owner}/{repo}/dispatches',
    '-f', 'event_type=release-publish'
  ], { encoding: 'utf8', stdio: 'inherit' });
  console.log('[OK] 已派发 release-publish，main 上的 release.yml 将自动打包并发布。');
} catch (e) {
  console.warn('[WARN] release 分支已更新，但派发失败：' + String(e.message).split('\n')[0]);
  console.warn('       可手动执行 gh workflow run release.yml --ref main 补发');
  process.exitCode = 1;
}
