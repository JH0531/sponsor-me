# Contributing guide

> **Other languages** · [中文 → CONTRIBUTING.md](CONTRIBUTING.md)

Thanks for helping improve sponsor-me. For maintenance and release procedures, see [MAINTAINING-en.md](MAINTAINING-en.md).

This file, `MAINTAINING.md` and both `-en` versions are repository documents, not web content, and **never enter the `deploy` branch**.

## 1. What this project is

A **build-free, router-free, dependency-free** single-page sponsor page. Double-clicking `index.html` works. The document has only two `<section>` elements; `#stage`'s `data-state` plus a `channel` variable switch between the landing, channel picker and payment card views.

Keep three constraints in mind before editing:

- No bundler, no `package.json`, no CDN requests. Discuss before adding a runtime dependency.
- `index.html` references only `assets/styles.css` and three `defer` scripts (`vendor/lottie_light.min.js`, `config.js`, `app.js`).
- `localStorage` may be restricted under `file://`, so preview through a static server:

```bash
python -m http.server 8000 --bind 127.0.0.1
# open http://127.0.0.1:8000/index.html
```

## 2. Repository layout

```
index.html                Single entry point
assets/
  config.js               Single config file: payout info, media registry, gifts, danmaku, channels, strings
  app.js                  Theme / language / state machine / Lottie / confetti / danmaku
  styles.css              Dual-theme tokens, layout, animations, a11y fallbacks
  lottie/ vendor/         Animation data and lottie-web (build output)
  brand/ qr/ emoji/       Channel marks, QR codes, static pointing hand
docs/demo/                README demo assets (not in deploy)
scripts/                  Asset build, demo capture, deploy sync, release scripts
.media/                   Local build inputs, excluded by .gitignore
.github/workflows/        Deploy sync and release publishing
```

`.media/` is excluded by the `/.*/` rule (`.github` is the only exception). To regenerate assets, restore that directory from `.media/sources.md` first.

## 3. Common changes

### Payout information

Edit only `meta.paypalUrl` in `assets/config.js`; replace the four files in `assets/qr/` (WeChat / Alipay × light / dark). Originals are 500×500 — keep them square with a white margin.

**Never commit secrets, tokens or payout details you do not want public.** QR codes in the repository are public content once committed.

### Gifts and strings

`media` is the media registry: keys are filenames and must be globally unique; `loop` is one cycle in milliseconds and is checked against the JSON's own `(op-ip)/fr`; optional `trim` removes trailing blank frames. Noto Lottie files carry a `rest` marker that the build script reads automatically — no manual rest frame needed.

`items` and `danmaku` are grouped by language; `i18n` holds button labels and accessibility text. **Update both languages for every string change**: `zh-Hans` and `en` are independent lists matched by `media` name, and a missing entry falls back to the first item. Do not put arrow glyphs in `caption`; the icons are inserted by the renderer.

### Theme or language

Themes use `html[data-theme]` and CSS variables (`:root` and `html[data-theme="dark"]` in `styles.css`); switching uses a 520ms View Transitions circular mask. Languages are `zh-Hans` / `en`, dictionaries live in `config.js`, and preferences are stored in `localStorage['sponsor-me:prefs']`. When changing colours, cover both token sets and check the light/dark variants of QR codes and channel marks.

### README or demo assets

`docs/demo/` is physically separate from `assets/`. Demo assets are produced by `scripts/capture-demo.mjs` (requires an out-of-repo toolchain, ffmpeg and the local static server; see the script header). Filenames carry `-vN`: GitHub caches images, so a content change requires a new `v2` plus updated references in `README.md` and `README-en.md` **in the same commit**. Never overwrite in place. Keep both READMEs structurally aligned; Chinese is the default.

### Regenerating runtime assets

```bash
node scripts/build-assets.mjs
```

Pure Node with built-ins only — no ffmpeg or ImageMagick. It clears and rebuilds `assets/lottie/` and overwrites same-named files in `brand/`, `qr/` and `vendor/`. **Check the diff before committing** so no local temporary files slip in.

## 4. Coding conventions

- Runtime code is ES5-style (`var` / `function`), framework-free and untranspiled. Match it; do not introduce a build chain for a small change.
- Keep styles in `styles.css` using theme tokens rather than hard-coded colours.
- Preserve the absence of runtime dependencies and CDN requests; open an issue first if a dependency is genuinely needed.
- Keep commits focused: one PR addresses one thing, without unrelated formatting, refactors or large generated diffs.
- Write a short, clear commit subject covering what changed and why. Repository history uses both Chinese and English; either is fine.

## 5. Accessibility and compatibility red lines

- `prefers-reduced-motion` must keep working; on touch devices without hover the coffee animation replays every 6 seconds.
- Overlays stay `pointer-events: none` so QR codes remain long-pressable.
- **`assets/styles.css:721` explicitly forbids `filter` / `opacity` / `mix-blend-mode` on QR codes** — they blur modules and hurt scanning.
- Lottie data is loaded via dynamically injected `<script>` tags (packaged as `.js`, not `.json`) so `file://` works. Do not switch it back to XHR.
- After changes, check light / dark, 简体中文 / English, and a narrow desktop viewport.

## 6. Branches and pull requests

1. Fork the repository and branch from `main` (the default branch and the only PR target).
2. Verify locally, commit, and push to your fork.
3. Open a PR against `main` describing the motivation, scope and how you verified it; attach a screenshot or animation for UI changes.
4. **Do not develop on `deploy` or `release`**: the former is generated by a workflow, the latter is the release gate.
5. **Do not create or delete `V*.*.*` tags manually** — version numbers are incremented by the release workflow.
6. Keep discussion focused on the issue; append new commits for review feedback rather than rewriting history.

## 7. Pre-commit checklist

- [ ] All three views work under `python -m http.server 8000`, with no console errors
- [ ] Light/dark themes and both languages switch correctly
- [ ] No unexpected diff in `assets/lottie/` from an accidental `build-assets.mjs` run (or the diff is intentional)
- [ ] No `.media/`, `node_modules/`, `.DS_Store`, `Thumbs.db` or local temporary files committed
- [ ] If demo assets changed, `-vN` references match in both READMEs
- [ ] `deploy` / `release` untouched and no new `V*` tag

## 8. Licensing and attribution

Project code is **GNU GPL v3.0** (see [LICENSE](LICENSE)). By submitting a contribution you agree to release it under that license.

- Emoji animations come from [Noto Animated Emoji](https://googlefonts.github.io/noto-emoji-animation/) (Google), **CC BY 4.0**; `assets/lottie/` holds build output and original sources are recorded in `.media/sources.md`.
- `assets/vendor/lottie_light.min.js` is the official [lottie-web](https://github.com/airbnb/lottie-web) build, **MIT**.
- Channel marks in `assets/brand/` remain the property of their respective rights holders and are used only to identify payment channels.

State the source and license of any new asset in your PR, and make sure it is GPL-3.0 compatible.

## 9. Reporting issues

When opening an issue, include reproduction steps, browser and OS, the current `data-state` or view, expected vs actual behaviour, console errors, and a screenshot or animation. For security issues involving payout details, **do not paste QR codes or links publicly** — contact the maintainer privately.
