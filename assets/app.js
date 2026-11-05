/* ==========================================================================
   sponsor-me · app
   单页状态机：boot → idle ⇄ rolling / idle → launching → channel ⇄ idle

   代码分块（从上到下）：
     prefs / theme / i18n / media / confetti / state / roll / launch
     sniff / channel / danmaku / dock / boot

   改文案和素材请去 assets/config.js，这个文件只负责行为。
   ========================================================================== */

(function () {
  'use strict';

  var C = window.SPONSOR_CONFIG;
  if (!C) { console.error('[sponsor] 缺少 config.js'); return; }

  var PREF_KEY = 'sponsor-me:prefs';

  /* ══════════════════════════════════════════════════════════════════════
     一、工具
     ══════════════════════════════════════════════════════════════════════ */

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(hover: none)').matches;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function readPrefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }

  function savePref(key, val) {
    try {
      var p = readPrefs();
      p[key] = val;
      localStorage.setItem(PREF_KEY, JSON.stringify(p));
    } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════════════════
     二、DOM 引用
     ══════════════════════════════════════════════════════════════════════ */

  var stage      = $('#stage');
  var sceneIdle  = $('#sceneIdle');
  var sceneCh    = $('#sceneChannel');

  var hero       = $('#hero');
  var halo       = $('.halo');
  var heroHit    = $('#heroHit');
  var heroStage  = $('#heroStage');
  var fingerArt  = $('#fingerArt');
  var heroLift   = $('.hero__lift');
  var heroDrop   = $('.hero__drop');
  var heroPop    = $('.hero__pop');
  var popRing    = $('#popRing');
  var finger     = $('#finger');

  var caption     = $('#caption');
  var captionText = $('#captionText');
  var blurb       = $('#blurb');

  var card       = $('#card');
  var cardFace   = $('#cardFace');
  var repoLink   = $('#repoLink');
  var repoText   = $('#repoText');

  var dmBack     = $('#dmBack');
  var dmFront    = $('#dmFront');

  var mainBtn    = $('#mainBtn');
  var mainLabel  = $('#mainBtnLabel');
  var themeBtn   = $('#themeBtn');
  var langBtn    = $('#langBtn');
  var langMenu   = $('#langMenu');

  var canvas     = $('#fx');
  var ctx        = canvas.getContext('2d');
  var metaTheme  = document.querySelector('meta[name="theme-color"]');

  /* ══════════════════════════════════════════════════════════════════════
     三、运行时状态
     ══════════════════════════════════════════════════════════════════════ */

  var state = 'boot';
  var busy = false;
  var flipping = false;
  var cardRendered = false;
  var lastRoll = 0;
  var channel = 'picker';

  var theme = 'light';
  var lang = 'zh-Hans';

  var current = null;          // 当前条目（config.items[lang] 里的一项）
  var launchAnims = [];        // 发射期间创建的 WAAPI 动画，回退时需要 cancel
  var bag = [];

  var T = {
    launchTotal: 2000,
    flipIn: 1050,
    flipOut: 400,
    popOut: 420,
    dropIn: 900,
    rollThrottle: 700,
    dmStart: 900,
    dmGapMin: 520,
    dmGapMax: 1100
  };

  /* ══════════════════════════════════════════════════════════════════════
     四、主题

     自动路由：能读到系统偏好就用系统的，读不到 fallback 到 light。
     手动切换后写进 localStorage，下次优先用用户的选择。
     ══════════════════════════════════════════════════════════════════════ */

  function detectTheme() {
    try {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch (e) {}
    return 'light';
  }

  function paintTheme(t) {
    theme = t;
    document.documentElement.dataset.theme = t;
    if (metaTheme) metaTheme.setAttribute('content', t === 'dark' ? '#1c1611' : '#fff5e2');
    var label = t === 'dark' ? C.i18n[lang].themeToLight : C.i18n[lang].themeToDark;
    themeBtn.setAttribute('aria-label', label);
    themeBtn.title = label;
  }

  /**
   * 切换主题。支持 View Transitions 时用「以按钮为圆心的圆形遮罩」展开；
   * 不支持时直接换 —— 不做假遮罩，因为遮罩颜色和真实渐变背景对不上会露馅。
   */
  function setTheme(next, opts) {
    opts = opts || {};
    if (next === theme) return;

    var swap = function () {
      paintTheme(next);
      refreshChannelFace();
      savePref('theme', next);
    };

    if (!opts.animate || reduceMotion || !document.startViewTransition) {
      swap();
      return;
    }

    var x = opts.x || window.innerWidth / 2;
    var y = opts.y || window.innerHeight - 60;
    var r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    var vt = document.startViewTransition(swap);
    vt.ready.then(function () {
      document.documentElement.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)',
                     'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 520, easing: 'cubic-bezier(.4,0,.2,1)',
          pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(function () {});
  }

  /* ══════════════════════════════════════════════════════════════════════
     五、语言

     规则：所有 zh-*（简体、繁体、台湾、香港……）统一走简体，
     其他一律英文。手动切换后记住。
     ══════════════════════════════════════════════════════════════════════ */

  function detectLang() {
    var list = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i]).toLowerCase().indexOf('zh') === 0) return 'zh-Hans';
    }
    return 'en';
  }

  function itemsOf(l) { return C.items[l] || C.items.en; }

  function findItem(l, mediaKey) {
    var list = itemsOf(l);
    for (var i = 0; i < list.length; i++) {
      if (list[i].media === mediaKey) return list[i];
    }
    return null;
  }

  function applyStrings() {
    var t = C.i18n[lang];
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hans';
    repoText.textContent = t.repo;
    repoLink.href = C.meta.repo;
    repoLink.setAttribute('aria-label', t.repo);
    langBtn.setAttribute('aria-label', t.langLabel);
    langBtn.title = t.langLabel;
    themeBtn.setAttribute('aria-label', theme === 'dark' ? t.themeToLight : t.themeToDark);
    themeBtn.title = themeBtn.getAttribute('aria-label');

    var opts = langMenu.querySelectorAll('.lang-menu__item');
    for (var i = 0; i < opts.length; i++) {
      opts[i].setAttribute('aria-selected',
        opts[i].getAttribute('data-lang') === lang ? 'true' : 'false');
    }
    updateDock();
  }

  function setLang(next, opts) {
    opts = opts || {};
    if (next === lang && !opts.force) return;
    lang = next;

    applyStrings();

    // 换物品：按 media 名匹配。新语言里没有同名条目就退到第一条。
    if (current) {
      var same = findItem(lang, current.media);
      if (same) {
        current = same;
        renderCaption();
      } else {
        setItem(itemsOf(lang)[0]);
      }
    }

    dmBag = [];
    if (state === 'channel') refreshChannelFace();
    savePref('lang', next);
  }

  function renderCaption() {
    if (!current) return;
    captionText.textContent = current.caption;
    blurb.textContent = current.blurb || '';
  }

  /* ══════════════════════════════════════════════════════════════════════
     六、媒体

     两条后端：
       video —— WebM VP9 + alpha，Chrome / Edge / Firefox / Android
       webp  —— 动图 WebP，Safari / iOS（WebKit 不支持 WebM 的 alpha 平面）

     用运行时探针决定走哪条，不靠 UA 猜。
     两条后端共用同一套语义：poster 打底 → 播放时藏起 poster → 停止。
     ══════════════════════════════════════════════════════════════════════ */

  var LOTTIE_REG = window.__LOTTIE__ || (window.__LOTTIE__ = {});
  var hasLottie = typeof window.lottie !== 'undefined';

  /**
   * 这件动画"停下来"应该停在哪一帧。
   *
   * 由构建脚本从 Noto 的 `rest` 标记里读出来，和动画一起下发。
   * 不能一律用第 0 帧：rainbow / ice-cream 的第 0 帧是空白，
   * cookie 的第 0 帧是饼干转到 90° 的侧视，star 的第 0 帧只有一粒小火星。
   */
  function restFrame(key) {
    var reg = window.__LOTTIE_REST__;
    return (reg && reg[key]) || 0;
  }

  var media = {
    anim: null,
    item: null,
    playing: false,
    stopAtLoopEnd: false,
    pending: null,      // 动画还没就绪时挂起的播放请求
    token: 0
  };

  /**
   * 动态加载一份 Lottie。
   * 文件是包成脚本的（assets/lottie/<key>.js），不是 .json ——
   * lottie-web 用 XHR 读 path，`file://` 下会被 CORS 拦掉，包成脚本就能双击运行。
   */
  function loadLottieData(key) {
    return new Promise(function (resolve, reject) {
      if (LOTTIE_REG[key]) { resolve(LOTTIE_REG[key]); return; }
      var s = document.createElement('script');
      s.src = 'assets/lottie/' + key + '.js';
      s.async = true;
      s.onload = function () {
        if (LOTTIE_REG[key]) resolve(LOTTIE_REG[key]);
        else reject(new Error('lottie not registered: ' + key));
      };
      s.onerror = function () { reject(new Error('lottie load failed: ' + key)); };
      document.head.appendChild(s);
    });
  }

  function destroyAnim() {
    if (media.anim) {
      try { media.anim.destroy(); } catch (e) {}
      media.anim = null;
    }
    media.playing = false;
    media.stopAtLoopEnd = false;
    media.pending = null;
    if (heroStage) heroStage.innerHTML = '';
  }

  /** 把一个 Lottie 挂到容器上，返回实例 */
  function mountLottie(container, data, key, onReady) {
    var anim = lottie.loadAnimation({
      container: container,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      animationData: data,
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet', progressiveLoad: true }
    });
    anim.addEventListener('DOMLoaded', function () {
      anim.goToAndStop(restFrame(key), true);   // 静止在作者标记的那一帧
      if (onReady) onReady(anim);
    });
    return anim;
  }

  function setItem(item) {
    current = item;
    media.item = item;
    destroyAnim();
    renderCaption();

    var def = C.media[item.media];
    if (!def || def.kind !== 'lottie' || !hasLottie) return;

    var token = ++media.token;
    loadLottieData(item.media).then(function (data) {
      if (token !== media.token) return;

      var anim = mountLottie(heroStage, data, item.media, function (a) {
        if (token !== media.token) return;
        if (media.pending) {
          var p = media.pending;
          media.pending = null;
          playMedia(p);
        }
      });
      media.anim = anim;

      // 一轮播完：落到作者的静止姿态，而不是第 0 帧
      anim.addEventListener('complete', function () {
        media.playing = false;
        try { anim.goToAndStop(restFrame(item.media), true); } catch (e) {}
      });

      // loop=true 时用它实现"等这一轮放完再停"，避免停在动作半截
      anim.addEventListener('loopComplete', function () {
        if (!media.stopAtLoopEnd) return;
        media.stopAtLoopEnd = false;
        media.playing = false;
        try { anim.goToAndStop(restFrame(item.media), true); } catch (e) {}
      });
    }, function () {
      /* 加载失败就留空，不阻塞其它交互 */
    });
  }

  function playMedia(opts) {
    opts = opts || {};
    if (!media.anim) {
      media.pending = { once: !!opts.once };
      return;
    }
    media.stopAtLoopEnd = false;
    media.playing = true;
    media.anim.loop = !opts.once;
    if (opts.once) media.anim.goToAndPlay(0, true);
    else media.anim.play();
  }

  function stopMedia() {
    if (!media.anim || !media.playing) return;
    if (media.anim.loop) {
      // 还在循环里：等到本轮结束再停，不要停在动作中间
      media.stopAtLoopEnd = true;
    } else {
      media.playing = false;
      media.anim.pause();
    }
  }

  /** 退回"刚进入页面"的状态：停在第一帧 */
  function resetMedia() {
    media.stopAtLoopEnd = false;
    media.playing = false;
    media.pending = null;
    if (media.anim) {
      try { media.anim.goToAndStop(restFrame(media.item ? media.item.media : ''), true); } catch (e) {}
    }
  }

  /** 手指是静止的，用单张 SVG 就够（4KB vs 动画的 43KB），位移交给 CSS */
  function mountFinger() {
    var def = C.media.finger;
    if (!def || def.kind !== 'still' || !fingerArt) return;
    var img = document.createElement('img');
    img.src = 'assets/emoji/finger.svg';
    img.alt = '';
    img.draggable = false;
    fingerArt.appendChild(img);
  }

  /* ══════════════════════════════════════════════════════════════════════
     七、礼花
     ══════════════════════════════════════════════════════════════════════ */

  var COLORS = ['#FFD886', '#FFC24D', '#FFE7B4', '#FF9E5E', '#FFF7E8', '#F2B33D'];
  var parts = [];
  var rafId = 0, lastT = 0, cw = 0, ch = 0;

  function sizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = canvas.clientWidth;
    ch = canvas.clientHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function burst(x, y, n, opts) {
    if (reduceMotion) return;
    opts = opts || {};
    var power = opts.power || 1;

    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = rand(160, 660) * power;
      parts.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 150,
        g: rand(1200, 1600),
        w: rand(4, 10),
        h: rand(6, 15),
        rot: Math.random() * Math.PI,
        vr: rand(-14, 14),
        color: pick(COLORS),
        ttl: rand(1100, 1800),
        age: 0
      });
    }
    if (parts.length > 340) parts.splice(0, parts.length - 340);
    if (!rafId) { lastT = performance.now(); rafId = requestAnimationFrame(tick); }
  }

  function tick(t) {
    var dt = Math.min((t - lastT) / 1000, 0.05);
    lastT = t;
    ctx.clearRect(0, 0, cw, ch);

    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.age += dt * 1000;
      if (p.age >= p.ttl) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.vx *= 1 - 1.1 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;

      var k = p.age / p.ttl;
      ctx.save();
      ctx.globalAlpha = Math.max(k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1, 0);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (parts.length) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = 0;
      ctx.clearRect(0, 0, cw, ch);
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     八、状态机
     ══════════════════════════════════════════════════════════════════════ */

  var ALLOWED = {
    boot:      ['idle'],
    idle:      ['rolling', 'launching'],
    rolling:   ['idle'],
    launching: ['channel'],
    channel:   ['channel', 'idle']
  };

  function setState(next) {
    var ok = ALLOWED[state] || [];
    if (ok.indexOf(next) === -1 && next !== state) {
      console.warn('[sponsor] 非法状态迁移：' + state + ' → ' + next);
      return false;
    }
    state = next;
    stage.dataset.state = next;
    sceneCh.setAttribute('aria-hidden', next === 'channel' ? 'false' : 'true');
    sceneIdle.setAttribute('aria-hidden', next === 'channel' ? 'true' : 'false');
    updateDock();
    return true;
  }

  function setBusy(v) {
    busy = v;
    stage.dataset.busy = v ? '1' : '0';
  }

  /* ══════════════════════════════════════════════════════════════════════
     九、底部主按钮：三个状态共用一颗，标签和行为随状态变
     ══════════════════════════════════════════════════════════════════════ */

  function updateDock() {
    var t = C.i18n[lang];
    if (state === 'channel' && channel !== 'picker') {
      mainLabel.textContent = t.backToPicker;
      mainBtn.dataset.action = 'toPicker';
    } else if (state === 'channel') {
      mainLabel.textContent = t.backToLanding;
      mainBtn.dataset.action = 'toLanding';
    } else {
      mainLabel.textContent = t.roll;
      mainBtn.dataset.action = 'roll';
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     十、Roll
     ══════════════════════════════════════════════════════════════════════ */

  function refillBag() {
    var cur = current ? current.media : '';
    var keys = [];
    for (var k in C.media) {
      if (!Object.prototype.hasOwnProperty.call(C.media, k)) continue;
      if (k === 'hero' || k === cur) continue;
      if (!findItem(lang, k)) continue;      // 当前语言里没有的条目不参与
      keys.push(k);
    }
    bag = shuffle(keys);
  }

  function nextItem() {
    if (!bag.length) refillBag();
    var key = bag.shift();
    return findItem(lang, key) || itemsOf(lang)[0];
  }

  var DROP_KF = [
    { transform: 'translate3d(0,-72vh,0) scale(.94) rotate(-7deg)', offset: 0,
      easing: 'cubic-bezier(.55,0,.95,.45)' },
    { transform: 'translate3d(0,10px,0) scale(1.02) rotate(1.5deg)', offset: 0.6,
      easing: 'ease-out' },
    { transform: 'translate3d(0,0,0) scale(1.16,.84)', offset: 0.66 },
    { transform: 'translate3d(0,-8px,0) scale(.95,1.07)', offset: 0.78 },
    { transform: 'translate3d(0,0,0) scale(1.04,.97)', offset: 0.9 },
    { transform: 'translate3d(0,0,0) scale(1,1)', offset: 1 }
  ];

  var POP_KF = [
    { transform: 'scale(1)', opacity: 1, filter: 'blur(0px)', offset: 0 },
    { transform: 'scale(1.14)', opacity: 1, filter: 'blur(0px)', offset: 0.22 },
    { transform: 'scale(.62)', opacity: 1, filter: 'blur(1.5px)', offset: 0.58,
      easing: 'cubic-bezier(.4,0,.9,.4)' },
    { transform: 'scale(0)', opacity: 0, filter: 'blur(3px)', offset: 1 }
  ];

  function doRoll() {
    if (state !== 'idle' || busy) return;
    var now = performance.now();
    if (now - lastRoll < T.rollThrottle) return;
    lastRoll = now;

    setBusy(true);
    if (!setState('rolling')) { setBusy(false); return; }

    var next = nextItem();
    // 预取下一件的 Lottie：破裂 + 掉落共 1.3 秒，够下完
    loadLottieData(next.media).catch(function () {});

    var rect = hero.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;

    if (!reduceMotion) {
      popRing.animate([
        { opacity: 0, transform: 'scale(.25)', borderWidth: '8px' },
        { opacity: 0.9, transform: 'scale(1.35)', borderWidth: '5px', offset: 0.45 },
        { opacity: 0, transform: 'scale(2.4)', borderWidth: '0px' }
      ], { duration: 520, delay: 110, easing: 'cubic-bezier(.2,.8,.3,1)' });

      hero.classList.add('is-popping');
      heroPop.animate(POP_KF, {
        duration: T.popOut,
        easing: 'cubic-bezier(.3,0,.7,.4)',
        fill: 'forwards'
      });
      burst(cx, cy, 10, { power: 0.45 });
    }

    setTimeout(function () {
      setItem(next);
      hero.classList.remove('is-popping');

      if (reduceMotion) { finishRoll(); return; }

      hero.classList.add('is-dropping');
      var drop = heroDrop.animate(DROP_KF, {
        duration: T.dropIn, easing: 'linear', fill: 'forwards'
      });
      heroPop.getAnimations().forEach(function (a) { a.cancel(); });

      var done = function () {
        heroDrop.getAnimations().forEach(function (a) { a.cancel(); });
        hero.classList.remove('is-dropping');
        finishRoll();
      };
      drop.finished.then(done, done);
    }, reduceMotion ? 0 : T.popOut);
  }

  function finishRoll() {
    playMedia({ once: true });
    var r = hero.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height * 0.78, 12, { power: 0.5 });
    setBusy(false);
    setState('idle');
  }

  /* ══════════════════════════════════════════════════════════════════════
     十一、发射

     ⚠ 总时长硬上限 2000ms：礼花 / 放大 / 摇摆 / 缩小全部并行，不留空等段。
       各段按 launchTotal 的比例算，改总时长只要改一个数。
     ══════════════════════════════════════════════════════════════════════ */

  var LIFT_KF = [
    { transform: 'scale(1)', opacity: 1, offset: 0, easing: 'ease-out' },
    { transform: 'scale(.92)', opacity: 1, offset: 0.055, easing: 'cubic-bezier(.2,1.35,.35,1)' },
    { transform: 'scale(1.52)', opacity: 1, offset: 0.21, easing: 'ease-out' },
    { transform: 'scale(1.46)', opacity: 1, offset: 0.28, easing: 'ease-in-out' },
    { transform: 'scale(1.475)', opacity: 1, offset: 0.38, easing: 'ease-in-out' },
    { transform: 'scale(1.452)', opacity: 1, offset: 0.48, easing: 'ease-in-out' },
    { transform: 'scale(1.468)', opacity: 1, offset: 0.56, easing: 'cubic-bezier(.4,0,.9,.4)' },
    { transform: 'scale(1.44) rotate(-16deg)', opacity: 1, offset: 0.62, easing: 'ease-in' },
    { transform: 'scale(1.02) rotate(12deg)', opacity: 1, offset: 0.68, easing: 'cubic-bezier(.4,0,.9,.4)' },
    { transform: 'scale(.52) rotate(-8deg)', opacity: 0.92, offset: 0.72 },
    { transform: 'scale(.13) rotate(4deg)', opacity: 0.45, offset: 0.745 },
    { transform: 'scale(.02) rotate(0deg)', opacity: 0, offset: 0.76 },
    { transform: 'scale(.02) rotate(0deg)', opacity: 0, offset: 1 }
  ];

  function shrinkOut(el, delay, dur) {
    if (!el || reduceMotion) return null;
    var a = el.animate([
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(0)', opacity: 0 }
    ], { duration: dur, delay: delay, easing: 'cubic-bezier(.4,0,.9,.4)', fill: 'forwards' });
    launchAnims.push(a);
    return a;
  }

  function launch() {
    if (state !== 'idle' || busy) return;
    setBusy(true);
    if (!setState('launching')) { setBusy(false); return; }

    var D = T.launchTotal;
    launchAnims = [];

    // 已在播就让它继续；没在播（触屏）就从第 0 帧起
    if (!media.playing) playMedia();

    var rect = hero.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;

    if (!reduceMotion) {
      var lift = heroLift.animate(LIFT_KF, { duration: D, easing: 'linear', fill: 'forwards' });
      launchAnims.push(lift);

      var hal = halo.animate([
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(1.5)', opacity: 0 }
      ], { duration: D * 0.30, delay: D * 0.72, easing: 'ease-out', fill: 'forwards' });
      launchAnims.push(hal);

      shrinkOut(finger, D * 0.14, D * 0.16);
      shrinkOut(caption, D * 0.15, D * 0.15);
      shrinkOut(blurb, D * 0.16, D * 0.15);
    }

    burst(cx, cy, 110, { power: 1 });
    setTimeout(function () {
      burst(cx, cy - rect.height * 0.2, 150, { power: 1.3 });
    }, D * 0.45);

    // 提前到 90% 交棒：杯子在 76% 就缩没了，再等到 100% 才出卡片会留出一段
    // 纯背景的空档，看起来像"闪了一下"。让光晕的收束和卡片入场重叠起来。
    setTimeout(commitChannel, reduceMotion ? 200 : D * 0.9);
  }

  function commitChannel() {
    setBusy(false);
    resetMedia();
    channel = detectChannel().channel;
    setState('channel');
    renderChannel(channel, { animate: !reduceMotion });
    startDanmaku();
  }

  /** 从打赏页退回着陆页：取消发射动画，重播一次入场，物品保持不变 */
  function returnToLanding() {
    launchAnims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
    launchAnims = [];
    heroLift.getAnimations().forEach(function (a) { a.cancel(); });
    halo.getAnimations().forEach(function (a) { a.cancel(); });
    heroPop.getAnimations().forEach(function (a) { a.cancel(); });
    hero.classList.remove('is-popping', 'is-dropping');

    stopDanmaku();
    // 回退后要像"刚进入页面"一样：停在第一帧，等 hover / 点击再播
    resetMedia();
    setState('idle');

    // 关键：把卡片状态清干净。否则下次进打赏页会被当成"已有卡片"，
    // 先播一遍退场动画再入场 —— 视觉上就是"先加载完再重新加载"。
    cardRendered = false;
    flipping = false;
    cardFace.innerHTML = '';
    card.classList.remove('is-settled');
    card.getAnimations().forEach(function (a) { try { a.cancel(); } catch (e) {} });

    // 重播入场：去掉 is-live 再强制回流加回来
    stage.classList.remove('is-live');
    void stage.offsetWidth;
    stage.classList.add('is-live');
  }

  /* ══════════════════════════════════════════════════════════════════════
     十二、载体嗅探
     ══════════════════════════════════════════════════════════════════════ */

  function detectChannel() {
    var q = null;
    try { q = new URLSearchParams(location.search); } catch (e) {}

    var forced = q ? (q.get('c') || '').toLowerCase() : '';
    if (forced === 'picker' || C.channels[forced]) return { channel: forced, why: 'url' };

    var ua = navigator.userAgent || '';
    if (/MicroMessenger/i.test(ua)) return { channel: 'wechat', why: 'ua' };
    if (/(AlipayClient|AlipayDefined|AliApp\(AP)/i.test(ua)) return { channel: 'alipay', why: 'ua' };
    if (/(PayPal|PPSDK)/i.test(ua)) return { channel: 'paypal', why: 'ua' };

    var ref = document.referrer || '';
    if (ref) {
      if (/weixin\.qq\.com|service\.wechat\.com/i.test(ref)) return { channel: 'wechat', why: 'referrer' };
      if (/alipay\.com/i.test(ref)) return { channel: 'alipay', why: 'referrer' };
      if (/paypal\.com/i.test(ref)) return { channel: 'paypal', why: 'referrer' };
    }

    return { channel: 'picker', why: 'unknown' };
  }

  /* ══════════════════════════════════════════════════════════════════════
     十三、打赏页

     翻转沿用 Docker-Sponsor-Page 的阻尼振荡：90 → -60 → +40 → -28 → +18
     → -12 → +9 → -5 → +2 → 0，振幅每轮 ×0.67。改成 rotateY 横向甩牌。
     ══════════════════════════════════════════════════════════════════════ */

  /*
   * 甩牌式翻入。原来一路 90→-60→+40→-28→+18→-12→+9→-5→+2→0，
   * 八次往复，收敛尾巴拖得很长，观感是"抖"而不是"落定"。
   * 现在只留三次：翻过头 -40 → 弹回 +22 → 再压 -10 → 归零。
   */
  var FLIP_IN = [
    { transform: 'rotateY(90deg) scale(.93)', opacity: 0, offset: 0,
      easing: 'cubic-bezier(.18,.72,.3,1)' },
    { transform: 'rotateY(-40deg) scale(.985)', opacity: 1, offset: 0.17,
      easing: 'cubic-bezier(.35,0,.3,1)' },
    { transform: 'rotateY(22deg) scale(1.005)', offset: 0.46,
      easing: 'cubic-bezier(.35,0,.3,1)' },
    { transform: 'rotateY(-10deg)', offset: 0.72, easing: 'ease-out' },
    { transform: 'rotateY(0deg)', offset: 1 }
  ];

  var FLIP_OUT = [
    { transform: 'rotateY(0deg) scale(1)', opacity: 1, offset: 0 },
    { transform: 'rotateY(0deg) scale(1.08)', opacity: 1, offset: 0.5 },
    { transform: 'rotateY(-42deg) scale(.62)', opacity: 0, offset: 1 }
  ];

  function enabledChannels() {
    return ['wechat', 'alipay', 'paypal'].filter(function (k) {
      return C.channels[k] && C.channels[k].enabled;
    });
  }

  function markSrc(k) {
    var ch = C.channels[k];
    if (k === 'paypal') return theme === 'dark' ? ch.symbol.dark : ch.symbol.light;
    if (k === 'wechat') return 'assets/brand/wechat-pay-mono.svg';
    return 'assets/brand/alipay-mono.svg';
  }

  function faceHTML(ch) {
    var t = C.i18n[lang];
    var c = C.channels[ch];

    if (ch === 'picker') {
      var list = enabledChannels().map(function (k) {
        return '' +
          '<button class="picker__item" type="button" data-ch="' + k + '">' +
            '<span class="picker__mark picker__mark--' + k + '">' +
              '<img src="' + markSrc(k) + '" alt="" width="22" height="22">' +
            '</span>' +
            '<span class="picker__text">' +
              '<span class="picker__name">' + t[k + 'Name'] + '</span>' +
              '<span class="picker__note">' + t[k + 'Note'] + '</span>' +
            '</span>' +
            '<span class="picker__arrow">›</span>' +
          '</button>';
      }).join('');

      return '' +
        '<div class="picker">' +
          '<p class="picker__title">' + t.pickerTitle + '</p>' +
          '<p class="picker__sub">' + t.pickerSub + '</p>' +
          list +
        '</div>';
    }

    if (ch === 'paypal') {
      return '' +
        '<div class="paypal">' +
          '<img class="paypal__symbol" src="' + (theme === 'dark' ? c.symbol.dark : c.symbol.light) + '" alt="PayPal" width="54" height="54">' +
          '<img class="paypal__word" src="' + (theme === 'dark' ? c.wordmark.dark : c.wordmark.light) + '" alt="PayPal">' +
          '<p class="paypal__hint">' + t.paypalHint + '</p>' +
          '<a class="paypal__btn" href="' + C.meta.paypalUrl + '" target="_blank" rel="noopener noreferrer">' +
            t.paypalBtn + ' ↗' +
          '</a>' +
          '<p class="paypal__note">' + t.paypalBack + '</p>' +
        '</div>';
    }

    // 微信 / 支付宝
    var logo = c.logo[lang] || c.logo;
    var logoSrc = logo && logo[theme] ? logo[theme] : '';

    return '' +
      '<div class="face__brand face__brand--' + ch + (lang === 'en' && ch === 'wechat' ? ' face__brand--en' : '') + '">' +
        '<img src="' + logoSrc + '" alt="' + t[ch + 'Name'] + '">' +
      '</div>' +
      '<img class="qr" src="' + c.qr[theme] + '" alt="' + t[ch + 'Name'] + '" ' +
        'width="500" height="500" draggable="false">' +
      '<p class="qr-hint">' + t[ch + 'Hint'] + '</p>';
  }

  function bindFace() {
    var items = cardFace.querySelectorAll('.picker__item');
    for (var i = 0; i < items.length; i++) {
      items[i].addEventListener('click', function () {
        renderChannel(this.getAttribute('data-ch'), { animate: true });
      });
    }
  }

  /** 只换内容不翻转，用于主题/语言切换 */
  function refreshChannelFace() {
    if (state !== 'channel' || !cardRendered) return;
    cardFace.innerHTML = faceHTML(channel);
    bindFace();
  }

  function renderChannel(ch, opts) {
    opts = opts || {};
    if (flipping) return;
    if (ch !== 'picker' && !C.channels[ch]) ch = 'picker';

    function applyFace() {
      cardFace.innerHTML = faceHTML(ch);
      bindFace();
      cardRendered = true;
      channel = ch;
      updateDock();
    }

    function playIn() {
      var inn = card.animate(FLIP_IN, {
        duration: T.flipIn, easing: 'linear', fill: 'forwards'
      });
      inn.finished.then(function () {
        inn.cancel();
        card.classList.add('is-settled');
        flipping = false;
      }, function () {
        card.classList.add('is-settled');
        flipping = false;
      });
    }

    if (ch === 'paypal') {
      // 选中 PayPal 就直接开新窗口；当前卡同时充当「没自动打开」和
      // 「从 PayPal 返回」的承接页，所以无论成功失败都照常渲染。
      try {
        var w = window.open(C.meta.paypalUrl, '_blank');
        if (w) { try { w.opener = null; } catch (e) {} }
      } catch (e) {}
    }

    if (!(opts.animate && !reduceMotion)) { applyFace(); return; }

    flipping = true;
    card.classList.remove('is-settled');

    // 第一次进入没有旧卡片可甩，直接落内容再入场，别让用户看 400ms 空白
    if (!cardRendered) { applyFace(); playIn(); return; }

    var out = card.animate(FLIP_OUT, {
      duration: T.flipOut, easing: 'ease-in-out', fill: 'forwards'
    });

    out.finished.then(function () {
      out.cancel();
      applyFace();
      playIn();
    }, function () { flipping = false; });
  }

  /* ══════════════════════════════════════════════════════════════════════
     十四、弹幕
     ══════════════════════════════════════════════════════════════════════ */

  var TRACK_H = 44;
  var dmBag = [];
  var dmTimer = 0;
  var dmOn = false;
  var dmQuiet = null;
  var dmQuietTimer = 0;

  function dmPool() {
    return (C.danmaku[lang] && C.danmaku[lang].length) ? C.danmaku[lang] : C.danmaku.en;
  }

  function trackY(isFront) {
    var h = sceneCh.clientHeight;
    var count = Math.floor((h * 0.74) / TRACK_H);
    var box = isFront ? card.getBoundingClientRect() : null;
    var out = [];
    for (var i = 0; i < count; i++) {
      var y = 44 + i * TRACK_H;
      if (isFront && box) {
        if (y + 34 > box.top - 10 && y < box.bottom + 10) continue;
      }
      out.push(y);
    }
    return out;
  }

  function spawnDm() {
    if (!dmOn) return;

    var front = Math.random() < 0.2;
    var layer = front ? dmFront : dmBack;
    var cap = front ? 4 : 12;
    if (layer.childElementCount >= cap) { scheduleDm(); return; }

    var ys = trackY(front);
    if (!ys.length) { scheduleDm(); return; }

    var y = ys[randInt(0, ys.length - 1)];
    var el = document.createElement('span');
    el.className = 'dm__item' + (front ? ' dm__item--front' : '');
    if (!dmBag.length) dmBag = shuffle(dmPool().slice());
    el.textContent = dmBag.shift();
    layer.appendChild(el);

    var w = el.offsetWidth || 200;
    var vw = sceneCh.clientWidth;
    var speed = front ? rand(190, 250) : rand(148, 196);
    var dur = ((vw + w + 60) / speed) * 1000;

    var a = el.animate([
      { transform: 'translate3d(' + (vw + 20) + 'px,' + y + 'px,0)' },
      { transform: 'translate3d(' + (-w - 40) + 'px,' + y + 'px,0)' }
    ], { duration: dur, easing: 'linear' });

    a.finished.then(function () { el.remove(); }, function () { el.remove(); });
    scheduleDm();
  }

  function scheduleDm() {
    clearTimeout(dmTimer);
    if (!dmOn) return;
    dmTimer = setTimeout(spawnDm, rand(T.dmGapMin, T.dmGapMax));
  }

  function startDanmaku() {
    if (reduceMotion) {
      dmQuiet = document.createElement('span');
      dmQuiet.className = 'dm__quiet';
      dmQuiet.textContent = pick(dmPool());
      dmBack.classList.add('dm--static');
      dmBack.appendChild(dmQuiet);
      requestAnimationFrame(function () { dmQuiet.classList.add('is-on'); });
      dmQuietTimer = setInterval(function () {
        if (!dmQuiet) return;
        dmQuiet.classList.remove('is-on');
        setTimeout(function () {
          if (!dmQuiet) return;
          dmQuiet.textContent = pick(dmPool());
          dmQuiet.classList.add('is-on');
        }, 420);
      }, 6000);
      return;
    }

    setTimeout(function () {
      if (state !== 'channel') return;
      dmOn = true;
      scheduleDm();
    }, T.dmStart);
  }

  function stopDanmaku() {
    dmOn = false;
    clearTimeout(dmTimer);
    clearInterval(dmQuietTimer);
    if (dmQuiet) { dmQuiet.remove(); dmQuiet = null; }
    dmBack.classList.remove('dm--static');
    dmBack.textContent = '';
    dmFront.textContent = '';
  }

  /* ══════════════════════════════════════════════════════════════════════
     十五、事件
     ══════════════════════════════════════════════════════════════════════ */

  heroHit.addEventListener('click', function () {
    this.blur();
    launch();
  });

  heroHit.addEventListener('pointerenter', function (e) {
    if (e.pointerType === 'touch') return;
    if (state !== 'idle' || media.playing) return;
    playMedia();
  });

  heroHit.addEventListener('pointerleave', function () {
    if (state !== 'idle') return;
    stopMedia();
  });

  mainBtn.addEventListener('click', function () {
    this.blur();
    var action = this.dataset.action;

    if (action === 'roll') {
      if (!reduceMotion) {
        var press = this.animate([
          { transform: 'scale(1)' },
          { transform: 'scale(.94)', offset: 0.25 },
          { transform: 'scale(1.07)', offset: 0.55 },
          { transform: 'scale(.985)', offset: 0.82 },
          { transform: 'scale(1)' }
        ], { duration: 420, easing: 'cubic-bezier(.22,1.2,.3,1)' });
        press.onfinish = function () { press.cancel(); };
      }
      doRoll();
      return;
    }

    if (action === 'toPicker') { renderChannel('picker', { animate: true }); return; }
    if (action === 'toLanding') { returnToLanding(); }
  });

  themeBtn.addEventListener('click', function () {
    var r = this.getBoundingClientRect();
    setTheme(theme === 'dark' ? 'light' : 'dark', {
      animate: true,
      x: r.left + r.width / 2,
      y: r.top + r.height / 2
    });
  });

  function closeLangMenu() {
    langMenu.classList.remove('is-open');
    langMenu.setAttribute('aria-hidden', 'true');
    langBtn.setAttribute('aria-expanded', 'false');
  }

  langBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = !langMenu.classList.contains('is-open');
    langMenu.classList.toggle('is-open', open);
    langMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
    langBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  langMenu.addEventListener('click', function (e) {
    var btn = e.target.closest('.lang-menu__item');
    if (!btn) return;
    setLang(btn.getAttribute('data-lang'));
    closeLangMenu();
  });

  document.addEventListener('click', function (e) {
    if (!langMenu.classList.contains('is-open')) return;
    if (langMenu.contains(e.target) || langBtn.contains(e.target)) return;
    closeLangMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLangMenu();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      parts.length = 0;
      dmOn = false;
      clearTimeout(dmTimer);
      if (media.anim) { try { media.anim.pause(); } catch (e) {} }
    } else if (state === 'channel' && !reduceMotion) {
      dmOn = true;
      scheduleDm();
    }
  });

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(sizeCanvas, 120);
  });

  /* ══════════════════════════════════════════════════════════════════════
     十六、启动
     ══════════════════════════════════════════════════════════════════════ */

  function boot() {
    sizeCanvas();

    var saved = readPrefs();
    lang = (saved.lang && C.i18n[saved.lang]) ? saved.lang : detectLang();
    theme = (saved.theme === 'dark' || saved.theme === 'light') ? saved.theme : detectTheme();
    paintTheme(theme);
    applyStrings();

    if (!enabledChannels().length) {
      captionText.textContent = C.i18n[lang].noChannel;
      blurb.textContent = C.i18n[lang].noChannelSub;
    }

    setItem(itemsOf(lang)[0]);
    updateDock();

    mountFinger();
    start();
  }

  function start() {
    var done = function () {
      stage.classList.add('is-live');
      setState('idle');

      // 触屏没有 hover：每 6 秒自己播一轮
      if (coarse && !reduceMotion) {
        setInterval(function () {
          if (state === 'idle' && !media.playing) playMedia({ once: true });
        }, 6000);
      }
    };

    // 等首帧渲染完再淡入，避免入场时先看到空容器
    if (media.anim) {
      media.anim.addEventListener('DOMLoaded', function () { setTimeout(done, 40); });
      setTimeout(done, 700);            // 兜底：动画加载失败也要能进页面
    } else {
      setTimeout(done, 60);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
