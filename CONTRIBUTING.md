# 贡献指南

> **其他语言** · [English → CONTRIBUTING-en.md](CONTRIBUTING-en.md)

感谢你愿意改进 sponsor-me。维护与发版流程请看 [MAINTAINING.md](MAINTAINING.md)。

本文件及 `MAINTAINING.md`、两份 `-en` 版本都是仓库文档，不属于网页内容，**不会进入 `deploy` 分支**。

## 1. 项目是什么

一个**无需构建、无路由、无第三方运行时依赖**的单页赞助页。直接双击 `index.html` 就能运行；页面只有 2 个 `<section>`，通过 `#stage` 的 `data-state` 与 `channel` 变量切换出入口 / 渠道选择 / 收款卡三种界面。

因此在动手前请记住三条约束：

- 没有打包器、没有 `package.json`、没有 CDN 请求，新增运行时依赖前请先讨论。
- `index.html` 直接引用的只有 `assets/styles.css` 与 3 个 `defer` 脚本（`vendor/lottie_light.min.js`、`config.js`、`app.js`）。
- `file://` 下 `localStorage` 可能受限，本地预览建议起静态服务：

```bash
python -m http.server 8000 --bind 127.0.0.1
# 打开 http://127.0.0.1:8000/index.html
```

## 2. 仓库结构

```
index.html                唯一入口
assets/
  config.js               唯一配置文件：收款信息、媒体注册表、礼物、弹幕、渠道、文案
  app.js                  主题 / 语言 / 状态机 / Lottie / 礼花 / 弹幕
  styles.css              双主题令牌、布局、动画、无障碍降级
  lottie/ vendor/         动画数据与 lottie-web（构建产物）
  brand/ qr/ emoji/       渠道标识、收款二维码、静态手势
docs/demo/                README 演示素材（不进 deploy）
scripts/                  素材构建、演示录制、deploy 同步、发版脚本
.media/                   本机构建输入，被 .gitignore 排除，不进仓库
.github/workflows/         deploy 同步与发版
```

`.media/` 被 `/.*/` 规则排除（`.github` 是唯一例外）。要重新生成素材，得先按 `.media/sources.md` 补齐这个目录。

## 3. 常见改动

### 改收款信息

只改 `assets/config.js` 的 `meta.paypalUrl`；二维码直接替换 `assets/qr/` 下四个文件（微信 / 支付宝 × 深 / 浅），原图 500×500，保持方形并保留白边。

**不要提交任何密钥、令牌或你不想公开的收款资料。** 仓库里的二维码是公开内容，一旦提交就应视为已公开。

### 加礼物或改文案

`media` 是媒体注册表，key 即文件名、全局唯一；`loop` 是一轮动画毫秒数，构建脚本会与 JSON 自身的 `(op-ip)/fr` 核对；可选 `trim` 裁掉尾部空白。Noto Lottie 自带 `rest` 标记，构建脚本会自动读出停止帧，无需手工指定。

`items` 与 `danmaku` 按语言分组、`i18n` 放按钮与无障碍标签。新增或修改文案时**中英两份都要改**：`zh-Hans` 与 `en` 是独立列表，跨语言靠 `media` 名匹配，缺失项会退回首条。`caption` 里不要写箭头符号，两侧图标由渲染层插入。

### 改主题或语言

主题为 `html[data-theme]` + CSS 变量（`styles.css` 的 `:root` 与 `html[data-theme="dark"]`），切换用 View Transitions 520ms 圆形遮罩；语言为 `zh-Hans` / `en`，字典集中在 `config.js`，偏好存 `localStorage['sponsor-me:prefs']`。改颜色请同时覆盖明暗两套令牌，并检查二维码与品牌标识的深浅版本。

### 改 README 或演示素材

`docs/demo/` 与 `assets/` 物理隔离。演示素材由 `scripts/capture-demo.mjs` 生成（需要仓库外的工具链、ffmpeg 与本地静态服务，详见脚注说明）。文件名带 `-vN`：GitHub 有图片缓存，内容变更要新建 `v2` 并在**同一提交**改 `README.md` 与 `README-en.md` 的引用，绝不原地覆盖。两份 README 结构需保持一致，中文为默认。

### 重新生成运行时素材

```bash
node scripts/build-assets.mjs
```

纯 Node、只用内置模块，不需要 ffmpeg / ImageMagick。它会清空并重建 `assets/lottie/`，并覆盖 `brand/` / `qr/` / `vendor/` 下的同名文件——**提交前请确认没有把本地临时文件带进去**。

## 4. 代码约定

- 现有运行时代码是 ES5 风格（`var` / `function`），无框架、无转译；保持风格一致，不要为小改动引入构建链。
- 样式集中在 `styles.css`，用主题令牌而非硬编码颜色。
- 保持无第三方运行时依赖与无 CDN 请求；确需引入请先开 issue 讨论。
- 提交保持聚焦：一个 PR 解决一件事，避免混入格式化、无关重构或自动生成的大块差异。
- commit message 用简短明确的主题说明「改了什么、为什么」；仓库历史中文与英文均有，两者都可以。

## 5. 无障碍与兼容性红线

- `prefers-reduced-motion` 必须仍然可用；触屏无 hover 时热饮每 6 秒自播一轮。
- 覆盖层保持 `pointer-events: none`，二维码可长按识别。
- **`assets/styles.css:721` 明确禁止给二维码加 `filter` / `opacity` / `mix-blend-mode`**——会糊掉模块、降低识别率。
- Lottie 数据以 `<script>` 动态加载（包成 `.js` 而非 `.json`），才能在 `file://` 下工作；不要改回 XHR 加载。
- 改动后请在浅色 / 深色、中文 / English、桌面窄视口下各看一遍。

## 6. 分支与 PR

1. fork 仓库，从 `main` 建自己的分支（`main` 是默认分支，也是唯一 PR 目标）。
2. 本地验证后提交，push 到你的 fork。
3. 开 PR 到 `main`，说明改动动机、影响范围与验证方式；涉及界面的请附截图或动图。
4. **不要在 `deploy` / `release` 分支上开发**：前者由 workflow 自动生成，后者是发版闸门。
5. **不要手动创建或删除 `V*.*.*` tag**，版本号由发版流程自动递增。
6. 讨论请聚焦问题本身；维护者的评审意见会写在 PR 里，修改后直接追加提交即可，不必强制改写历史。

## 7. 提交前自检

- [ ] `python -m http.server 8000` 下三屏都能走通，无控制台报错
- [ ] 明暗主题、中英双语切换正常
- [ ] `node scripts/build-assets.mjs` 未被误触发导致 `assets/lottie/` 出现非预期差异（若改过素材，确认差异是预期的）
- [ ] 未提交 `.media/`、`node_modules/`、`.DS_Store`、`Thumbs.db` 或本地临时文件
- [ ] 涉及演示素材时，两份 README 的 `-vN` 引用一致
- [ ] 未改 `deploy` / `release`，未新增 `V*` tag

## 8. 许可与素材出处

项目代码为 **GNU GPL v3.0**（见 [LICENSE](LICENSE)）。提交即表示你同意在该许可下发布你的贡献。

- emoji 动画来自 [Noto Animated Emoji](https://googlefonts.github.io/noto-emoji-animation/)（Google），**CC BY 4.0**；`assets/lottie/` 为构建产物，原始出处在 `.media/sources.md`。
- `assets/vendor/lottie_light.min.js` 为 [lottie-web](https://github.com/airbnb/lottie-web) 官方构建，**MIT**。
- `assets/brand/` 下渠道标识的商标权归各自权利人，仅用于标识支付渠道。

新增素材请在 PR 中注明来源与许可，确保与 GPL-3.0 兼容。

## 9. 报告问题

开 issue 时请附上：复现步骤、浏览器与系统、`data-state` 或所处界面、期望与实际行为、控制台报错，以及截图或动图。涉及收款信息的安全问题请**不要公开粘贴二维码或链接**，私下联系维护者。
