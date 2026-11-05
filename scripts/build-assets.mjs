#!/usr/bin/env node
/**
 * build-assets.mjs
 *
 * 从 `.media/`（本机目录，不进仓库）读取构建输入，产出 `assets/` 下的运行时资源。
 * 纯 Node，不依赖 ffmpeg / ImageMagick 之类的命令行工具。
 *
 * 输入 → 输出：
 *   .media/lottie/*.json           → assets/lottie/<key>.js   包成 window.__LOTTIE__ 注册
 *   .media/static/*.svg            → assets/emoji/<key>.svg   单帧 emoji
 *   .media/vendor/lottie_light.js  → assets/vendor/lottie_light.min.js
 *   .media/修改源材料/*.svg         → assets/brand/*.svg
 *   .media/修改源材料/*收款码*.png   → assets/qr/*.png
 *
 * 为什么 Lottie 要包成 .js 而不是留 .json：
 *   lottie-web 用 XHR 读 path，`file://` 下会被 CORS 拦掉。
 *   包成脚本用 <script> 动态加载，双击 index.html 也能跑。
 *
 * 用法：node scripts/build-assets.mjs
 */

import {
  existsSync, readFileSync, writeFileSync, mkdirSync,
  statSync, rmSync, copyFileSync
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, '.media');
const OUT_LOTTIE = join(ROOT, 'assets/lottie');
const OUT_VENDOR = join(ROOT, 'assets/vendor');
const OUT_BRAND = join(ROOT, 'assets/brand');
const OUT_QR = join(ROOT, 'assets/qr');
const OUT_EMOJI = join(ROOT, 'assets/emoji');

/* ── 读配置 ───────────────────────────────────────────────────────────── */

function loadConfig() {
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(join(ROOT, 'assets/config.js'), 'utf8'), sandbox, {
    filename: 'config.js'
  });
  if (!sandbox.window.SPONSOR_CONFIG) throw new Error('config.js 没有导出 SPONSOR_CONFIG');
  return sandbox.window.SPONSOR_CONFIG;
}

const kb = (p) => statSync(p).size / 1024;

/* ── Lottie ───────────────────────────────────────────────────────────── */

/**
 * 把一份 Lottie JSON 包成脚本。
 * 顺带核对 config 里声明的 loop 与动画自身时长（op-ip）/fr 是否一致 ——
 * 这两个数一旦对不上，"播一轮就停"的边界就是错的。
 */
function buildLottie(key, entry, warnings) {
  const src = join(SRC, 'lottie', entry.file);
  if (!existsSync(src)) {
    warnings.push(`${key}: 缺少源文件 .media/lottie/${entry.file}`);
    return null;
  }

  const raw = readFileSync(src, 'utf8');
  let data;
  try { data = JSON.parse(raw); } catch (e) {
    warnings.push(`${key}: JSON 解析失败 ${e.message}`);
    return null;
  }

  /*
   * rest：Noto 给每个动画都标了「停下来时该停在哪一帧」。
   * 这不是可选的装饰 —— 有些动画第 0 帧是空白（rainbow / ice-cream），
   * 有些是侧视（cookie 的饼干正转到 90°），有些只有很小一点（star / bomb）。
   * 一律停在第 0 帧的话，画面会卡在"看不出来是什么"的位置。
   */
  const restMarker = (data.markers || []).find(m => String(m.cm).toLowerCase() === 'rest');
  let rest = restMarker ? Math.round(restMarker.tm) : 0;

  /*
   * trim：裁掉时间轴尾部的死区。
   *   rocket —— 40 帧其实是两遍完全相同的 20 帧，整段播会看到动作重复一遍，
   *             而且第 40 帧是空白。裁到 20 帧只留一遍。
   *   cookie —— 第 106 帧之后到结尾全是空白，会多出 200ms 的空画面。
   */
  let json = raw;
  if (entry.trim && entry.trim < data.op) {
    data.op = entry.trim;
    // rest 可能落在被裁掉的那一段里（rocket 的 39 在第二遍），取模映射回第一遍
    rest = rest % entry.trim;
    json = JSON.stringify(data);
  }

  const fr = data.fr || 60;
  const frames = Math.round((data.op || 0) - (data.ip || 0));
  const actual = Math.round((frames / fr) * 1000);

  if (!entry.loop) {
    warnings.push(`${key}: config 缺少 loop，实际 ${actual}ms`);
  } else if (Math.abs(entry.loop - actual) > 30) {
    warnings.push(`${key}: config loop=${entry.loop}ms，实际 ${actual}ms`);
  }
  if (rest < 0 || rest >= frames) {
    warnings.push(`${key}: rest=${rest} 超出 0..${frames - 1}，已夹紧`);
    rest = Math.min(Math.max(rest, 0), frames - 1);
  }

  const out = join(OUT_LOTTIE, `${key}.js`);
  writeFileSync(out,
    `/* ${key} — Noto Animated Emoji (CC BY 4.0) */\n` +
    `(window.__LOTTIE__=window.__LOTTIE__||{})[${JSON.stringify(key)}]=${json.trim()};\n` +
    `(window.__LOTTIE_REST__=window.__LOTTIE_REST__||{})[${JSON.stringify(key)}]=${rest};\n`,
    'utf8');

  return { kb: kb(out), frames, fr, ms: actual, rest };
}

/* ── 品牌标识与二维码 ─────────────────────────────────────────────────── */

const BRAND_FILES = [
  ['微信支付-mono-main.svg', 'wechat-pay-mono.svg'],
  ['支付宝-mono-universal.svg', 'alipay-mono.svg'],
  ['PayPal_Symbol_0.svg', 'paypal-symbol.svg'],
  ['PayPal_Symbol_Alternative_0.svg', 'paypal-symbol-alt.svg'],
  ['PayPal_text_Logo_light.svg', 'paypal-text-light.svg'],
  ['PayPal_text_Logo_dark.svg', 'paypal-text-dark.svg'],
  ['微信支付-zh-light.svg', 'wechat-zh-light.svg'],
  ['微信支付-zh-dark.svg', 'wechat-zh-dark.svg'],
  ['微信支付-en-light.svg', 'wechat-en-light.svg'],
  ['微信支付-en-dark.svg', 'wechat-en-dark.svg'],
  ['alipay-plus-light.svg', 'alipay-plus-light.svg'],
  ['alipay-plus-dark.svg', 'alipay-plus-dark.svg']
];

const QR_FILES = [
  ['微信收款码-主要-logo-light.png', 'wechat-light.png'],
  ['微信收款码-主要-logo-dark.png', 'wechat-dark.png'],
  ['支付宝收款码-new-logo-light.png', 'alipay-light.png'],
  ['支付宝收款码-个人-new-logo-dark.png', 'alipay-dark.png']
];

function copySet(files, from, to, warnings) {
  const rows = [];
  for (const [src, out] of files) {
    const s = join(from, src);
    const d = join(to, out);
    if (!existsSync(s)) { warnings.push(`缺少源文件 ${src}`); continue; }
    copyFileSync(s, d);
    rows.push([out, kb(d).toFixed(1)]);
  }
  return rows;
}

/* ── 主流程 ───────────────────────────────────────────────────────────── */

if (!existsSync(SRC)) {
  console.error('\n  找不到 .media/ 目录。');
  console.error('  它是构建输入（Lottie 原始 JSON、品牌 SVG、二维码原图），不进仓库。');
  console.error('  重建方式见 .media/sources.md。\n');
  process.exit(1);
}

for (const d of [OUT_VENDOR, OUT_BRAND, OUT_QR, OUT_EMOJI]) mkdirSync(d, { recursive: true });
rmSync(OUT_LOTTIE, { recursive: true, force: true });
mkdirSync(OUT_LOTTIE, { recursive: true });

const config = loadConfig();
const warnings = [];
const lottieRows = [];
let totalLottie = 0;

for (const [key, entry] of Object.entries(config.media)) {
  if (entry.kind === 'still') {
    const src = join(SRC, 'static', entry.file);
    if (!existsSync(src)) { warnings.push(`${key}: 缺少 .media/static/${entry.file}`); continue; }
    const out = join(OUT_EMOJI, `${key}.svg`);
    copyFileSync(src, out);
    lottieRows.push([key, kb(out).toFixed(1), '—', '—', '静态', '—']);
    totalLottie += kb(out);
    continue;
  }
  if (entry.kind !== 'lottie') continue;
  const r = buildLottie(key, entry, warnings);
  if (!r) continue;
  totalLottie += r.kb;
  lottieRows.push([key, r.kb.toFixed(1), String(r.frames), String(r.fr), String(r.ms), String(r.rest)]);
}

let vendorKb = 0;
const vendorSrc = join(SRC, 'vendor/lottie_light.min.js');
if (existsSync(vendorSrc)) {
  copyFileSync(vendorSrc, join(OUT_VENDOR, 'lottie_light.min.js'));
  vendorKb = kb(join(OUT_VENDOR, 'lottie_light.min.js'));
} else {
  warnings.push('缺少 .media/vendor/lottie_light.min.js');
}

const brandRows = copySet(BRAND_FILES, join(SRC, '修改源材料'), OUT_BRAND, warnings);
const qrRows = copySet(QR_FILES, join(SRC, '修改源材料'), OUT_QR, warnings);

/* ── 报告 ─────────────────────────────────────────────────────────────── */

const COLW = [20, 10, 9, 7, 9, 7];

function table(title, head, rows) {
  console.log(`\n  ${title}`);
  console.log('  ' + '─'.repeat(66));
  console.log('  ' + head.map((h, i) => h.padEnd(COLW[i])).join(''));
  for (const r of rows) console.log('  ' + r.map((c, i) => String(c).padEnd(COLW[i])).join(''));
}

table('动画与静态 emoji', ['key', 'KB', 'frames', 'fps', '时长ms', 'rest'], lottieRows);
table('品牌标识', ['file', 'KB'], brandRows);
table('收款二维码', ['file', 'KB'], qrRows);

console.log(`\n  动画合计 ${totalLottie.toFixed(0)}KB，lottie-web ${vendorKb.toFixed(0)}KB`);
console.log('  运行时只加载当前礼物 + 手指这一份，其余按需取。');

if (warnings.length) {
  console.log('\n  ⚠ 需要注意：');
  for (const w of warnings) console.log('    ' + w);
}
console.log('');
