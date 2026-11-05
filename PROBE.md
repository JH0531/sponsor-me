# Markdown compatibility probe (draft, do not merge)

This page verifies how GitHub renders APNG, theme-scoped images, `<picture>`, and
inline `<video>` **inside a committed `.md` file**. It lives only on the
`probe/demo-media` branch; `main` is untouched.

## 1. APNG animation

![APNG probe](probe/idle-light-zh-v1.apng)

Static first-frame fallback: ![PNG probe](probe/idle-light-zh-v1.png)

## 2. Theme fragments (`#gh-*-mode-only`)

![light only](probe/idle-light-zh-v1.png#gh-light-mode-only)
![dark only](probe/idle-dark-zh-v1.png#gh-dark-mode-only)

## 3. `<picture>` with `prefers-color-scheme`

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="probe/idle-dark-zh-v1.png">
  <img src="probe/idle-light-zh-v1.png" alt="theme probe" width="240">
</picture>

## 4. Explicit `<video>` (is the tag kept or sanitized?)

<video src="https://example.invalid/none.mp4" controls width="240"></video>

## 5. Side-by-side table fallback (works everywhere)

| light | dark |
|---|---|
| ![light](probe/idle-light-zh-v1.png) | ![dark](probe/idle-dark-zh-v1.png) |

## 6. APNG served with a `.png` extension (workaround)

GitHub raw returns `application/octet-stream` + `nosniff` for `.apng`,
but `image/png` for `.png`. An APNG is a PNG, so renaming the extension should
make the browser play the animation.

![APNG as PNG](probe/idle-light-zh-v1.anim.png)

---

Probe assets: `probe/idle-light-zh-v1.apng` (16 frames), `probe/idle-light-zh-v1.png`,
`probe/idle-dark-zh-v1.png`.
