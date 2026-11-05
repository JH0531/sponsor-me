/* ==========================================================================
   sponsor-me · config
   这是唯一需要改的文件。运行时（app.js）与构建期（scripts/build-assets.mjs）
   读的是同一份配置，所以新增一个礼物只需要在这里加一条，然后跑一次构建。

   结构总览：
     meta      —— 仓库地址、PayPal 收款链接
     media     —— 媒体注册表。key 就是文件名（不含扩展名），全局唯一。
     items     —— 每种语言一份条目列表，靠 media 名跨语言匹配
     danmaku   —— 每种语言一份弹幕
     channels  —— 渠道定义（二维码路径按主题区分）
     i18n      —— 界面文案
   ========================================================================== */

window.SPONSOR_CONFIG = {

  meta: {
    // 开源后换成你自己的仓库
    repo: 'https://github.com/yourname/sponsor-me',
    // 换成你的 paypal.me
    paypalUrl: 'https://paypal.me/Jasperhjx'
  },

  /* ────────────────────────────────────────────────────────────────────
     媒体注册表

     key      : 文件名，决定 assets/lottie/<key>.js
                **不允许重名**，跨语言匹配就靠它
     file     : .media/lottie/ 下的原始 Lottie JSON（不进仓库）
     kind     : 'lottie' 有动画；'still' 是单张 SVG
     loop     : 一轮动画的毫秒数，构建时与 JSON 自身的 op/fr 核对
     trim     : 可选。裁到第几帧为止，用于去掉尾部的空白或重复循环
     ──────────────────────────────────────────────────────────────────── */
  media: {
    // 全部是 Noto Animated Emoji 的 Lottie 动画（CC BY 4.0）。
    // file 指向 .media/lottie/ 下的原始文件，构建时转成 assets/lottie/<key>.js。
    // loop 是构建期的校验值：必须等于动画自身时长，构建脚本会逐个核对。
    hero:         { file: 'coffee.json',      kind: 'lottie', loop: 2017 },
    finger:       { file: 'finger.svg',       kind: 'still' },   // 只是静止指向，不需要动画

    gift:         { file: 'gift.json',         kind: 'lottie', loop: 4767 },
    kiss:         { file: 'kiss.json',         kind: 'lottie', loop: 2000 },
    bomb:         { file: 'bomb.json',         kind: 'lottie', loop: 2333 },
    hundred:      { file: 'hundred.json',      kind: 'lottie', loop: 2250 },
    rocket:       { file: 'rocket.json',       kind: 'lottie', loop: 333, trim: 20 },
    call:         { file: 'call.json',         kind: 'lottie', loop: 1933 },
    ghost:        { file: 'ghost.json',        kind: 'lottie', loop: 2400 },
    bulb:         { file: 'bulb.json',         kind: 'lottie', loop: 2400 },
    beer:         { file: 'beer.json',         kind: 'lottie', loop: 1767 },
    socks:        { file: 'socks.json',        kind: 'lottie', loop: 2200 },

    'bubble-tea': { file: 'bubble-tea.json',   kind: 'lottie', loop: 3200 },
    tropical:     { file: 'tropical.json',     kind: 'lottie', loop: 3600 },
    trophy:       { file: 'trophy.json',       kind: 'lottie', loop: 2267 },
    'crystal-ball': { file: 'crystal-ball.json', kind: 'lottie', loop: 2400 },
    'money-wings': { file: 'money-wings.json', kind: 'lottie', loop: 800 },
    coin:         { file: 'coin.json',         kind: 'lottie', loop: 3150 },
    gem:          { file: 'gem.json',          kind: 'lottie', loop: 1333 },
    wand:         { file: 'wand.json',         kind: 'lottie', loop: 1700 },
    slot:         { file: 'slot.json',         kind: 'lottie', loop: 2000 },
    balloon:      { file: 'balloon.json',      kind: 'lottie', loop: 1600 },
    medal:        { file: 'medal.json',        kind: 'lottie', loop: 2000 },
    ufo:          { file: 'ufo.json',          kind: 'lottie', loop: 4633 },
    house:        { file: 'house.json',        kind: 'lottie', loop: 3583 },
    cookie:       { file: 'cookie.json',       kind: 'lottie', loop: 1767, trim: 106 },
    'ice-cream':  { file: 'ice-cream.json',    kind: 'lottie', loop: 3933 },
    'chicken-leg': { file: 'chicken-leg.json', kind: 'lottie', loop: 2500 },
    rainbow:      { file: 'rainbow.json',      kind: 'lottie', loop: 2000 },
    clover:       { file: 'clover.json',       kind: 'lottie', loop: 1800 },
    bouquet:      { file: 'bouquet.json',      kind: 'lottie', loop: 2233 },
    star:         { file: 'star.json',         kind: 'lottie', loop: 1783 },
    fire:         { file: 'fire.json',         kind: 'lottie', loop: 1083 }
  },

  /* ────────────────────────────────────────────────────────────────────
     条目（按语言分组）

     每种语言独立维护，互不依赖。切换语言时按 media 名匹配：
       · 新语言里有同名条目 → 保留当前物品，只换文案
       · 没有 → 自动换到新语言里的第一个可用条目
     所以如果某个礼物只想在中文里出现，直接不写进 en 列表即可。
     ──────────────────────────────────────────────────────────────────── */
  items: {
    'zh-Hans': [
      { media: 'hero',    caption: '点击赞助作者一杯咖啡', blurb: '' },
      { media: 'gift',    caption: '点击赞助作者一份礼物', blurb: '包得有点草率，心意到了' },
      { media: 'kiss',    caption: '点击给作者一个飞吻', blurb: '作者正在害羞，别看他' },
      { media: 'bomb',    caption: '点击赞助作者一颗炸弹', blurb: '倒计时 3 秒，跑' },
      { media: 'hundred', caption: '点击给作者打个一百分', blurb: '这周没白干' },
      { media: 'rocket',  caption: '点击为作者刷一个火箭', blurb: '老铁，666' },
      { media: 'call',    caption: '点击给作者打个 call', blurb: '喊到嗓子哑，也要把气氛拉满' },
      { media: 'ghost',   caption: '点击放一只幽灵出来', blurb: '负责吓跑 bug，它说只是路过' },
      { media: 'bulb',    caption: '点击赞助作者一个灵感', blurb: '灯亮了，别打断他' },
      { media: 'beer',    caption: '点击和作者碰一杯', blurb: '干杯，代码明天再写' },
      { media: 'socks',   caption: '点击赞助作者一只袜子', blurb: '另一只不存在' },

      { media: 'bubble-tea',   caption: '点击请作者喝杯珍珠奶茶', blurb: '三分糖去冰，他记得比代码还清楚' },
      { media: 'tropical',     caption: '点击请作者喝杯热带特调', blurb: '假装在三亚，实际上还在改 bug' },
      { media: 'trophy',       caption: '点击给作者颁一座奖杯', blurb: '年度最佳熬夜选手，连续三年' },
      { media: 'crystal-ball', caption: '点击让作者看看你的未来', blurb: '水晶球说：你还会再来一次的' },
      { media: 'money-wings',  caption: '点击让钱包长出翅膀', blurb: '飞走了，别追' },
      { media: 'coin',         caption: '点击给作者投一枚金币', blurb: '叮的一声，是梦想落袋的声音' },
      { media: 'gem',          caption: '点击赞助作者一颗宝石', blurb: '无价，但标个价也不是不行' },
      { media: 'wand',         caption: '点击挥一下魔法棒', blurb: '许愿：让这个项目火起来' },
      { media: 'slot',         caption: '点击拉一次老虎机', blurb: '三个 7 没中，但作者中了你' },
      { media: 'balloon',      caption: '点击放一只气球', blurb: '一松手就飞，跟这个项目一样' },
      { media: 'medal',        caption: '点击给作者挂一块金牌', blurb: '含金量待检测，含泪量很高' },
      { media: 'ufo',          caption: '点击召唤一架飞碟', blurb: '外星人也在用这个库，真的' },
      { media: 'house',        caption: '点击给作者刷个大别墅', blurb: '首付你出，房贷他来' },
      { media: 'cookie',       caption: '点击投喂作者一块饼干', blurb: '最后一块，他犹豫了很久' },
      { media: 'ice-cream',    caption: '点击请作者吃个冰淇淋', blurb: '化得比工资还快' },
      { media: 'chicken-leg',  caption: '点击给作者加个鸡腿', blurb: '加鸡腿，是程序员之间的最高礼遇' },
      { media: 'rainbow',      caption: '点击给作者画一道彩虹', blurb: '风雨过后还是风雨，但这次有彩虹' },
      { media: 'clover',       caption: '点击送作者一片四叶草', blurb: '好运分你一半，bug 全归他' },
      { media: 'bouquet',      caption: '点击给作者献一束花', blurb: '不用说话，他懂' },
      { media: 'star',         caption: '点击给作者点亮一颗星', blurb: 'star 数 +1，星光也 +1' },
      { media: 'fire',         caption: '点击给作者添一把火', blurb: '越烧越旺，别烧到服务器' }
    ],

    'en': [
      { media: 'hero',    caption: 'Tap to buy the author a coffee', blurb: '' },
      { media: 'gift',    caption: 'Tap to send the author a gift',   blurb: 'Wrapped sloppily. It is the thought that counts.' },
      { media: 'kiss',    caption: 'Tap to blow the author a kiss',    blurb: 'He is blushing. Do not look at him.' },
      { media: 'bomb',    caption: 'Tap to hand the author a bomb',    blurb: 'Three second fuse. Run.' },
      { media: 'hundred', caption: 'Tap to give the author 100 points', blurb: 'A week well spent.' },
      { media: 'rocket',  caption: 'Tap to send the author a rocket',  blurb: 'Straight to the moon.' },
      { media: 'call',    caption: 'Tap to cheer the author on',           blurb: 'Cheering until the voice gives out.' },
      { media: 'ghost',   caption: 'Tap to release a ghost',           blurb: 'It scares off bugs. It says it is just passing by.' },
      { media: 'bulb',    caption: 'Tap to give the author an idea',   blurb: 'The light is on. Do not interrupt.' },
      { media: 'beer',    caption: 'Tap to clink glasses with the author', blurb: 'Cheers. The code can wait until tomorrow.' },
      { media: 'socks',   caption: 'Tap to send the author one sock',  blurb: 'The other one does not exist.' },

      { media: 'bubble-tea',   caption: 'Tap to buy the author bubble tea',        blurb: 'Half sugar, no ice. He knows his order better than his own code.' },
      { media: 'tropical',     caption: 'Tap to buy the author a tropical drink',  blurb: 'Pretending to be on a beach. Still debugging.' },
      { media: 'trophy',       caption: 'Tap to hand the author a trophy',         blurb: 'Best Overtime Performance, three years running.' },
      { media: 'crystal-ball', caption: 'Tap to see what the future holds',        blurb: 'The ball says you will be back.' },
      { media: 'money-wings',  caption: 'Tap to give the author money with wings', blurb: 'It flew away. Do not chase it.' },
      { media: 'coin',         caption: 'Tap to drop a coin in the jar',           blurb: 'That little clink is a dream landing.' },
      { media: 'gem',          caption: 'Tap to send the author a gem',            blurb: 'Priceless. A price tag works too.' },
      { media: 'wand',         caption: 'Tap to wave the magic wand',              blurb: 'Wish: make this project take off.' },
      { media: 'slot',         caption: 'Tap to pull the lever',                   blurb: 'No triple sevens. But the author hit the jackpot with you.' },
      { media: 'balloon',      caption: 'Tap to release a balloon',                blurb: 'Let go and it flies. Same as this project.' },
      { media: 'medal',        caption: 'Tap to pin a gold medal on the author',   blurb: 'Gold content unverified. Tears content very high.' },
      { media: 'ufo',          caption: 'Tap to summon a flying saucer',           blurb: 'Even the aliens use this library.' },
      { media: 'house',        caption: 'Tap to buy the author a mansion',         blurb: 'You cover the down payment. He covers the next thirty years.' },
      { media: 'cookie',       caption: 'Tap to feed the author a cookie',         blurb: 'The last one. He hesitated for a while.' },
      { media: 'ice-cream',    caption: 'Tap to buy the author ice cream',         blurb: 'Melts faster than a paycheck.' },
      { media: 'chicken-leg',  caption: 'Tap to add a drumstick',                  blurb: 'In engineering culture, this is the highest honor.' },
      { media: 'rainbow',      caption: 'Tap to paint the author a rainbow',       blurb: 'After the storm comes another storm. But with a rainbow.' },
      { media: 'clover',       caption: 'Tap to send a four-leaf clover',          blurb: 'You get half the luck. He gets all the bugs.' },
      { media: 'bouquet',      caption: 'Tap to hand the author flowers',          blurb: 'No words needed. He gets it.' },
      { media: 'star',         caption: 'Tap to light up a star for the author',   blurb: 'One more star. One more bit of light.' },
      { media: 'fire',         caption: 'Tap to add fuel to the fire',             blurb: 'Burn bright. Just not the servers.' }
    ]
  },

  /* ────────────────────────────────────────────────────────────────────
     弹幕（按语言分组）
     ──────────────────────────────────────────────────────────────────── */
  danmaku: {
    'zh-Hans': [
      '这位金主，您的咖啡已到账',
      '老板大气，代码都香了',
      '一杯咖啡，续命三小时',
      '已投喂，作者又能写两行',
      '此处应有掌声',
      '打赏的不是钱，是精神股东',
      '你这一下，服务器都抖了三抖',
      '确认过眼神，是会赞助的人',
      '今日份的赛博香油钱',
      '作者：收到，马上加班（不是）',
      '小额赞助，大额感动',
      '这位朋友，你的手速很快',
      '咖啡因 +1，bug −1',
      '你的头像已在功德榜上闪烁',
      '感谢投喂，产品经理已被劝退',
      '赞助成功，作者原地满血'
    ],
    'en': [
      'The coffee has landed.',
      'Absolute legend.',
      'One coffee, three more hours of code.',
      'Fed. The author can write two more lines.',
      'Somebody give this person a round of applause.',
      'Not a donation — a shareholder position.',
      'The server felt that one.',
      'Confirmed: this person sponsors.',
      'Today\u2019s digital offering.',
      'Author: received. Overtime commencing. (jk)',
      'Small amount, big feelings.',
      'Fast hands, kind heart.',
      'Caffeine +1, bugs −1.',
      'Your name is now glowing on the wall of honor.',
      'Thanks. The PM has been escorted out.',
      'Sponsorship received. Author restored to full HP.'
    ]
  },

  /* ────────────────────────────────────────────────────────────────────
     渠道
     qr 按主题给两份；PayPal 没有二维码，用 paypalUrl 跳转。
     ──────────────────────────────────────────────────────────────────── */
  channels: {
    wechat: {
      enabled: true,
      mark: 'wechat',
      qr: { light: 'assets/qr/wechat-light.png', dark: 'assets/qr/wechat-dark.png' },
      // 卡片顶部品牌标识（按语言 + 主题）
      logo: {
        'zh-Hans': { light: 'assets/brand/wechat-zh-light.svg', dark: 'assets/brand/wechat-zh-dark.svg' },
        'en':      { light: 'assets/brand/wechat-en-light.svg', dark: 'assets/brand/wechat-en-dark.svg' }
      }
    },
    alipay: {
      enabled: true,
      mark: 'alipay',
      qr: { light: 'assets/qr/alipay-light.png', dark: 'assets/qr/alipay-dark.png' },
      // 支付宝的标识不区分语言
      logo: {
        light: 'assets/brand/alipay-plus-light.svg',
        dark: 'assets/brand/alipay-plus-dark.svg'
      }
    },
    paypal: {
      enabled: true,
      mark: 'paypal',
      symbol: { light: 'assets/brand/paypal-symbol.svg', dark: 'assets/brand/paypal-symbol-alt.svg' },
      wordmark: { light: 'assets/brand/paypal-text-light.svg', dark: 'assets/brand/paypal-text-dark.svg' }
    }
  },

  /* ────────────────────────────────────────────────────────────────────
     界面文案
     ──────────────────────────────────────────────────────────────────── */
  i18n: {
    'zh-Hans': {
      pickerTitle: '选一个你顺手的',
      pickerSub: '三个入口都在这里，扫码或转账都行',
      roll: '赞助点别的？',
      backToPicker: '← 换个方式',
      backToLanding: '← 更换礼物',
      repo: '本库 GitHub',
      themeToDark: '切换到深色模式',
      themeToLight: '切换到浅色模式',
      langLabel: '切换语言',
      wechatName: '微信支付',
      alipayName: '支付宝',
      paypalName: 'PayPal',
      wechatNote: '扫码付款',
      alipayNote: '扫码付款',
      paypalNote: '跳转外部',
      wechatHint: '长按二维码，或保存图片后用<strong>微信</strong>扫一扫',
      alipayHint: '长按二维码，或保存图片后用<strong>支付宝</strong>扫一扫',
      paypalHint: '已尝试在新标签页打开 paypal.me',
      paypalBtn: '前往 paypal.me',
      paypalBack: '没有自动跳转？点上面的按钮。没有账号？返回换个方式',
      noChannel: '作者还没配置收款方式 :(',
      noChannelSub: '先别急着赞助，等他配好'
    },
    'en': {
      pickerTitle: 'Pick one',
      pickerSub: 'All three are here. Scan or jump, your call.',
      roll: 'Sponsor something else?',
      backToPicker: '← Change method',
      backToLanding: '← Change gift',
      repo: 'View source on GitHub',
      themeToDark: 'Switch to dark mode',
      themeToLight: 'Switch to light mode',
      langLabel: 'Change language',
      wechatName: 'WeChat Pay',
      alipayName: 'Alipay',
      paypalName: 'PayPal',
      wechatNote: 'Scan to pay',
      alipayNote: 'Scan to pay',
      paypalNote: 'Opens externally',
      wechatHint: 'Long-press to scan, or save the code and use <strong>WeChat</strong>',
      alipayHint: 'Long-press to scan, or save the code and use <strong>Alipay</strong>',
      paypalHint: 'Tried to open paypal.me in a new tab.',
      paypalBtn: 'Go to paypal.me',
      paypalBack: 'Did not open? Tap the button above. No account? Go back.',
      noChannel: 'No payment method configured yet :(',
      noChannelSub: 'Hold off on the sponsorship for now.'
    }
  }
};
