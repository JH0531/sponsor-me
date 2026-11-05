#!/usr/bin/env node
/**
 * next-version.mjs — 计算下一个版本号
 *
 * 规则：V<MAJOR>.<MINOR>.<PATCH>，段宽不固定（`0.000.00` 仅为结构示意）。
 *   - 初版 V0.1.0
 *   - 每次发版 PATCH + 1
 *   - PATCH 逢 10 进 1 到 MINOR（PATCH 归 0）
 *   - MINOR 逢 100 进 1 到 MAJOR（MINOR 归 0）
 *   - MAJOR 不设进位上限
 *   例：V0.1.0 → V0.1.9 → V0.2.0 → V0.99.9 → V1.0.0
 *
 * 段宽不固定，字典序不等于版本序（V0.10.0 字符串上排在 V0.2.0 之前），
 * 因此按三段数值比较取最大 tag，而不是靠 tag 名称排序。
 *
 * 用法：
 *   node scripts/next-version.mjs                 读取本地 V*.*.* tag，输出下一个版本号
 *   node scripts/next-version.mjs --from V0.1.9  从指定版本计算（自测 / 指定起点）
 *   node scripts/next-version.mjs --current      输出当前最大版本（无 tag 时输出空行）
 *   node scripts/next-version.mjs --json         输出 { current, next, tags }
 */
import { execFileSync } from 'node:child_process';

const VERSION_RE = /^[Vv]?(\d+)\.(\d+)\.(\d+)$/;
const INITIAL = { major: 0, minor: 1, patch: 0 };

function parse(tag) {
  const m = VERSION_RE.exec(String(tag).trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function compare(a, b) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

function format(v) {
  return `V${v.major}.${v.minor}.${v.patch}`;
}

function next(v) {
  let { major, minor, patch } = v;
  patch += 1;
  if (patch >= 10) { patch = 0; minor += 1; }
  if (minor >= 100) { minor = 0; major += 1; }
  return { major, minor, patch };
}

function tags() {
  try {
    return execFileSync('git', ['tag', '-l', 'V*.*.*'], { encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function latest() {
  let best = null;
  for (const t of tags()) {
    const v = parse(t);
    if (v && (!best || compare(v, best) > 0)) best = v;
  }
  return best;
}

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const fromIdx = argv.indexOf('--from');
const current = fromIdx >= 0 ? parse(argv[fromIdx + 1]) : latest();

if (fromIdx >= 0 && !current) {
  console.error(`[FAIL] --from 版本格式不合法：${argv[fromIdx + 1]}`);
  process.exit(1);
}

const nextVersion = current ? next(current) : INITIAL;

if (has('--json')) {
  console.log(JSON.stringify({
    current: current ? format(current) : null,
    next: format(nextVersion),
    tags: tags()
  }, null, 2));
} else if (has('--current')) {
  console.log(current ? format(current) : '');
} else {
  console.log(format(nextVersion));
}
