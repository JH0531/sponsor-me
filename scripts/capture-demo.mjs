#!/usr/bin/env node
/**
 * capture-demo.mjs — 生成 README 演示素材
 *
 * 用法：
 *   node scripts/capture-demo.mjs --shots all      # 静帧 + 合成图 + 动图 + 视频
 *   node scripts/capture-demo.mjs --shots still    # 仅静帧 / 合成图 / 动图
 *   node scripts/capture-demo.mjs --shots video    # 仅视频与封面
 *
 * 前置：python -m http.server 8000 --bind 127.0.0.1
 *       DEMO_TOOLS（默认 ~/.cache/sponsor-demo-tools）内装 playwright + upng-js
 *       ffmpeg 在 PATH
 */
import { createRequire } from 'node:module';
import {
  existsSync, mkdirSync, writeFileSync, readdirSync, rmSync, mkdtempSync, statSync
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS = process.env.DEMO_TOOLS || join(homedir(), '.cache', 'sponsor-demo-tools');

function loadTool(name) {
  const p = join(TOOLS, 'node_modules', name);
  if (!existsSync(p)) {
    console.error(`[FAIL] 缺少 ${p}\n请先执行： npm install --prefix "${TOOLS}" playwright upng-js`);
    process.exit(1);
  }
  return require(p);
}
const { chromium } = loadTool('playwright');
const UPNG = loadTool('upng-js');

/* ── 参数 ─────────────────────────────────────────────────────────────── */
function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const BASE = arg('--base', 'http://127.0.0.1:8000/index.html');
const OUT = resolve(arg('--out', join(ROOT, 'docs', 'demo')));
const SHOTS = arg('--shots', 'all');
const CNUM = Number(arg('--colors', '256'));

/* ── 统一画幅：420×600，覆盖三屏主体（卡片 129~604 / dock ~711） ───────── */
const W = 420, H = 840;
const CROP = { x: 0, y: 120, width: 420, height: 600 };
const CW = CROP.width, CH = CROP.height;

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = join(homedir(), 'AppData', 'Local', 'ms-playwright');
  if (!existsSync(base)) return undefined;
  for (const d of readdirSync(base).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse()) {
    for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe']) {
      const p = join(base, d, rel);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}
const CHROME = findChrome();

/* ── 编码辅助 ─────────────────────────────────────────────────────────── */
const toArrayBuffer = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const rgbaOf = (buf) => UPNG.toRGBA8(UPNG.decode(toArrayBuffer(buf)))[0];

// GitHub 会剥离 <img style="...">，所以把圆角直接烘焙进图片素材。
// 原图宽 420，README 里统一以 width=200 展示 → 原图 21px ≈ 显示 10px。
const RADIUS = 21;

function roundRGBA(buf, w, h) {
  const px = new Uint8Array(buf);
  const r = RADIUS, rr = r * r;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let cx = -1, cy = -1;
      if (x < r && y < r) { cx = r; cy = r; }
      else if (x >= w - r && y < r) { cx = w - r - 1; cy = r; }
      else if (x < r && y >= h - r) { cx = r; cy = h - r - 1; }
      else if (x >= w - r && y >= h - r) { cx = w - r - 1; cy = h - r - 1; }
      if (cx < 0) continue;
      const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
      const a = (y * w + x) * 4 + 3;
      if (d2 > rr) px[a] = 0;
      else {
        const k = Math.min(1, Math.max(0, r - Math.sqrt(d2) + 0.5));
        px[a] = Math.round(px[a] * k);
      }
    }
  }
  return px.buffer;
}

function apngOf(bufs, dt) {
  const rgba = bufs.map(rgbaOf).map((f) => roundRGBA(f, CW, CH));
  return Buffer.from(UPNG.encode(rgba, CW, CH, CNUM, rgba.map(() => dt)));
}

function emit(name, raw) {
  let buf = raw;
  // 单帧 PNG（静帧、封面）：解码 → 圆角 → 无损重编码；APNG 已在 apngOf 内处理
  if (name.endsWith('.png') && !name.endsWith('.anim.png')) {
    const dec = UPNG.decode(toArrayBuffer(raw));
    const f = roundRGBA(UPNG.toRGBA8(dec)[0], dec.width, dec.height);
    buf = Buffer.from(UPNG.encode([f], dec.width, dec.height, 0, [0]));
  }
  const p = join(OUT, name);
  writeFileSync(p, buf);
  console.log(`  + ${name.padEnd(34)} ${(buf.length / 1024).toFixed(0).padStart(5)} KB`);
  return p;
}

/* ── 页面驱动 ─────────────────────────────────────────────────────────── */
async function openCtx(browser, spec, { closePopups = true } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    locale: spec.lang === 'en' ? 'en-US' : 'zh-CN',
    colorScheme: spec.theme,
    reducedMotion: 'no-preference',   // 必须走完整动画，否则光晕/手指不会退场
  });
  await ctx.addInitScript(({ lang, theme }) => {
    localStorage.setItem('sponsor-me:prefs', JSON.stringify({ lang, theme }));
    let s = 0x2f6e2b1;
    Math.random = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }, { lang: spec.lang, theme: spec.theme });

  let main = null;
  if (closePopups) {
    ctx.on('page', (p) => { if (main && p !== main) p.close().catch(() => {}); });
  }
  main = await ctx.newPage();
  return { ctx, page: main };
}

async function boot(page, q = '?c=picker') {
  await page.goto(BASE + q, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const s = document.querySelector('#stage');
    return s && s.dataset.state === 'idle' && s.classList.contains('is-live');
  }, null, { timeout: 12000 });
  await page.waitForTimeout(1600);   // 入场动画结束，首帧完整可读
}

/** 进入渠道页：完整 launching 2000ms + 翻牌落定 + 光晕/手指退场 */
async function toChannel(page, dom) {
  await page.click('#heroHit');
  await page.waitForFunction((sel) => {
    const s = document.querySelector('#stage');
    const card = document.querySelector('#card');
    const halo = document.querySelector('.halo');
    const finger = document.querySelector('.finger');
    if (!s || s.dataset.state !== 'channel') return false;
    if (!document.querySelector(sel)) return false;
    if (card && !card.classList.contains('is-settled')) return false;
    const op = (e) => (e ? parseFloat(getComputedStyle(e).opacity) : 0);
    return op(halo) < 0.02 && op(finger) < 0.02;
  }, dom, { timeout: 20000 });
  await page.waitForTimeout(250);
}

const snap = (page) => page.screenshot({ type: 'png', clip: CROP, animations: 'allow' });

/* ── 静帧 ─────────────────────────────────────────────────────────────── */
const STILLS = [
  { id: 'idle-light-zh-v1', state: 'idle', lang: 'zh-Hans', theme: 'light' },
  { id: 'idle-dark-zh-v1', state: 'idle', lang: 'zh-Hans', theme: 'dark' },
  { id: 'idle-light-en-v1', state: 'idle', lang: 'en', theme: 'light' },
  { id: 'picker-light-zh-v1', q: '?c=picker', dom: '.picker', lang: 'zh-Hans', theme: 'light' },
  { id: 'picker-dark-zh-v1', q: '?c=picker', dom: '.picker', lang: 'zh-Hans', theme: 'dark' },
  { id: 'picker-light-en-v1', q: '?c=picker', dom: '.picker', lang: 'en', theme: 'light' },
  { id: 'wechat-light-zh-v1', q: '?c=wechat', dom: '.qr[src*="wechat"]', lang: 'zh-Hans', theme: 'light' },
  { id: 'alipay-light-zh-v1', q: '?c=alipay', dom: '.qr[src*="alipay"]', lang: 'zh-Hans', theme: 'light' },
  { id: 'paypal-light-zh-v1', q: '?c=paypal', dom: '.paypal', lang: 'zh-Hans', theme: 'light' },
];

async function stills(browser) {
  for (const s of STILLS) {
    const { ctx, page } = await openCtx(browser, s);
    await boot(page, s.q);
    if (s.dom) await toChannel(page, s.dom);
    const buf = await snap(page);
    await ctx.close();
    emit(s.id + '.png', buf);
  }
  // 拼板图不再生成：README 改为用 HTML 把单张图并列展示
}

/* ── 三个「真实切换过程」动图 ──────────────────────────────────────────── */
async function animations(browser) {
  const spec = { lang: 'zh-Hans', theme: 'light' };

  // 礼物切换：rolling 900ms，每次点击留足动画时间
  {
    const { ctx, page } = await openCtx(browser, spec);
    await boot(page);
    const bufs = [await snap(page)];
    await page.click('#mainBtn');
    for (let i = 0; i < 14; i++) { bufs.push(await snap(page)); await page.waitForTimeout(90); }
    await ctx.close();
    emit('gift-roll-v1.anim.png', apngOf(bufs, 100));
  }

  // 主题切换：点按钮触发 520ms 圆形遮罩，预留 800ms
  {
    const { ctx, page } = await openCtx(browser, spec);
    await boot(page);
    const vt = await page.evaluate(() => !!document.startViewTransition);
    console.log(`  View Transitions: ${vt ? '支持' : '不支持（退化为直接换色）'}`);
    const bufs = [await snap(page)];
    await page.waitForTimeout(80);
    bufs.push(await snap(page));
    await page.click('#themeBtn');
    for (let i = 0; i < 10; i++) { bufs.push(await snap(page)); await page.waitForTimeout(80); }
    await ctx.close();
    emit('theme-toggle-v1.anim.png', apngOf(bufs, 80));
  }

  // 语言切换：展开菜单 → 选 English
  {
    const { ctx, page } = await openCtx(browser, spec);
    await boot(page);
    const bufs = [await snap(page)];
    await page.click('#langBtn');
    for (let i = 0; i < 4; i++) { bufs.push(await snap(page)); await page.waitForTimeout(100); }
    await page.locator('.lang-menu__item[data-lang="en"]').click();
    for (let i = 0; i < 7; i++) { bufs.push(await snap(page)); await page.waitForTimeout(100); }
    await ctx.close();
    emit('lang-toggle-v1.anim.png', apngOf(bufs, 100));
  }
}

/* ── 完整流程视频 ─────────────────────────────────────────────────────── */
async function journey(browser) {
  const { ctx, page } = await openCtx(browser, { lang: 'zh-Hans', theme: 'light' }, { closePopups: false });

  // 不依赖 popup 事件时序：进入外部页区间时直接从 ctx.pages() 取已打开的页面，
  // 并等它 load 完成；若弹窗被拦则手动打开同一个真实链接作为兜底。
  let extPage = null;

  await boot(page);
  const FPS = 12, SECONDS = 33, N = FPS * SECONDS, STEP = 1000 / FPS;

  // 时间轴：礼物切换每次 2.0s；主题切换每次 800ms；支付顺序 微信→支付宝→PayPal
  const actions = [
    { t: 2.0, name: '礼物切换①', fn: () => page.click('#mainBtn') },
    { t: 4.0, name: '礼物切换②', fn: () => page.click('#mainBtn') },
    { t: 6.0, name: '展开语言菜单', fn: () => page.click('#langBtn') },
    { t: 6.5, name: '切到 English', fn: () => page.locator('.lang-menu__item[data-lang="en"]').click() },
    { t: 7.2, name: '展开语言菜单', fn: () => page.click('#langBtn') },
    { t: 7.7, name: '切回中文', fn: () => page.locator('.lang-menu__item[data-lang="zh-Hans"]').click() },
    { t: 8.4, name: '主题切换①', fn: () => page.click('#themeBtn') },
    { t: 10.0, name: '主题切换②', fn: () => page.click('#themeBtn') },
    { t: 12.0, name: '点热饮（礼花）', fn: () => page.click('#heroHit') },
    { t: 15.8, name: '微信支付', fn: () => page.locator('.picker__item[data-ch="wechat"]').click() },
    { t: 18.3, name: '返回选择页', fn: () => page.click('#mainBtn') },
    { t: 19.8, name: '支付宝', fn: () => page.locator('.picker__item[data-ch="alipay"]').click() },
    { t: 22.3, name: '返回选择页', fn: () => page.click('#mainBtn') },
    { t: 23.8, name: 'PayPal（外部链接）', fn: () => page.locator('.picker__item[data-ch="paypal"]').click() },
    { t: 26.2, name: '从外部链接返回', fn: () => page.bringToFront() },
    { t: 28.2, name: '返回选择页', fn: () => page.click('#mainBtn') },
    { t: 29.7, name: '回入口', fn: () => page.click('#mainBtn') },
  ];
  let ai = 0;
  const framesDir = mkdtempSync(join(tmpdir(), 'sponsor-journey-'));
  const t0 = Date.now();

  try {
    for (let i = 0; i < N; i++) {
      const t = i / FPS;
      while (ai < actions.length && t >= actions[ai].t - 0.001) {
        const a = actions[ai++];
        try { await a.fn(); } catch (e) { console.warn(`  [WARN] ${a.name} @${a.t}s: ${e.message.split('\n')[0].slice(0, 90)}`); }
      }

      let buf;
      if (t >= 24.2 && t < 26.2) {
        if (!extPage) {
          const others = ctx.pages().filter((p) => p !== page);
          if (others.length) {
            extPage = others[0];
            await extPage.setViewportSize({ width: 420, height: 600 }).catch(() => {});
            await extPage.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
          } else {
            extPage = await ctx.newPage();
            await extPage.setViewportSize({ width: 420, height: 600 });
            await extPage.goto('https://paypal.me/Jasperhjx', { waitUntil: 'load', timeout: 15000 }).catch(() => {});
          }
          console.log(`  外部页面加载完毕: ${extPage.url().slice(0, 90)}`);
        }
        buf = await extPage.screenshot({ type: 'png' });
      } else {
        buf = await snap(page);
      }
      writeFileSync(join(framesDir, `j-${String(i).padStart(3, '0')}.png`), buf);
      const wait = t0 + (i + 1) * STEP - Date.now();
      if (wait > 0) await page.waitForTimeout(wait);
    }
    await ctx.close();

    const mp4 = join(OUT, 'journey-v2.mp4');
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-framerate', String(FPS),
      '-i', join(framesDir, 'j-%03d.png'),
      '-vf', `scale=${CW}:${CH}`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '24',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4
    ], { stdio: 'inherit' });
    console.log(`  + ${'journey-v2.mp4'.padEnd(34)} ${(statSync(mp4).size / 1024).toFixed(0).padStart(5)} KB`);
  } finally {
    rmSync(framesDir, { recursive: true, force: true });
  }
}

/* ── 主流程 ───────────────────────────────────────────────────────────── */
async function main() {
  mkdirSync(OUT, { recursive: true });
  console.log(`BASE    = ${BASE}`);
  console.log(`OUT     = ${OUT}`);
  console.log(`CROP    = ${CROP.width}x${CROP.height} @ y=${CROP.y}`);
  console.log(`CHROME  = ${CHROME || '(Playwright 自带)'}`);

  const launchOpts = { headless: true, ...(CHROME ? { executablePath: CHROME } : {}) };
  // 外部链接（paypal.me）需要显式代理；bypass 保证本地静态服务直连
  if (process.env.DEMO_PROXY !== 'none') {
    const server = process.env.DEMO_PROXY_SERVER || process.env.HTTPS_PROXY ||
                   process.env.HTTP_PROXY || 'http://127.0.0.1:57247';
    launchOpts.proxy = { server, bypass: '127.0.0.1,localhost' };
    console.log(`PROXY   = ${server}`);
  }
  const browser = await chromium.launch(launchOpts);

  try {
    if (SHOTS === 'video') { await journey(browser); return; }
    if (SHOTS === 'all' || SHOTS === 'still') {
      console.log('\n── 静帧 ──');
      await stills(browser);
      console.log('\n── 切换动图 ──');
      await animations(browser);
    }
    if (SHOTS === 'all') { console.log('\n── 完整流程视频 ──'); await journey(browser); }
  } finally {
    await browser.close();
  }
  console.log('\n完成。');
}

main().catch((e) => { console.error(e); process.exit(1); });
