/* ======================================================================
   縦書きリーダー bookmarklet loader target  (なろう / カクヨム)
   v10 — scroll-based pagination (ネイティブスクロール方式)
   ---------------------------------------------------------------------- */

(function () {
  'use strict';

  /* ===================================================================
     サイト判定 & セレクタ定義
     =================================================================== */
  const host = location.hostname;
  let SITE = null;
  if (host.indexOf('syosetu.com') >= 0) SITE = 'narou';
  else if (host.indexOf('kakuyomu.jp') >= 0) SITE = 'kakuyomu';

  if (!SITE) {
    alert('縦書きリーダー：\nなろう／カクヨムのエピソードページで使ってください');
    return;
  }

  const SEL = {
    narou: {
      body:  '.p-novel__body, #novel_honbun',
      title: '.p-novel__title, .novel_subtitle',
      next:  'a.c-pager__item--next, a[rel="next"]',
      prev:  'a.c-pager__item--prev, a[rel="prev"]',
      ads:   '[id^="ad_"], .p-novel__ad, iframe[src*="googlesyndication"], iframe[src*="doubleclick"]'
    },
    kakuyomu: {
      body:  '.widget-episodeBody',
      title: '.widget-episodeTitle',
      next:  '#contentMain-readNextEpisode, [data-type="next-page-link"], a[rel="next"]',
      prev:  '[data-type="prev-page-link"], a[rel="prev"]',
      ads:   '[id*="ad-"], iframe[src*="googlesyndication"], iframe[src*="doubleclick"]'
    }
  };
  const sel = SEL[SITE];

  /* ===================================================================
     既存起動チェック & ソース本文取得
     =================================================================== */
  if (document.getElementById('vreader-root')) { location.reload(); return; }

  const sourceBody = document.querySelector(sel.body);
  if (!sourceBody) {
    alert('縦書きリーダー：\n本文要素が見つかりませんでした。\nセレクタの更新が必要です。');
    return;
  }

  /* ===================================================================
     設定（localStorage）
     =================================================================== */
  const SK = 'vreader-settings-v2';
  let cfg = { font: 18, theme: 'light' };
  try {
    const s = localStorage.getItem(SK);
    if (s) Object.assign(cfg, JSON.parse(s));
  } catch (e) {}
  const saveCfg = () => {
    try { localStorage.setItem(SK, JSON.stringify(cfg)); } catch (e) {}
  };

  /* ===================================================================
     ユーティリティ
     =================================================================== */
  function extractMeta(doc) {
    const titleEl = doc.querySelector(sel.title);
    const nextEl  = doc.querySelector(sel.next);
    const prevEl  = doc.querySelector(sel.prev);
    return {
      title:    titleEl ? titleEl.textContent.trim() : '',
      nextHref: (nextEl && nextEl.href) ? nextEl.href : null,
      prevHref: (prevEl && prevEl.href) ? prevEl.href : null,
      adNodes:  Array.from(doc.querySelectorAll(sel.ads))
    };
  }

  function escapeHtml(s) {
    return String(s).replace(/[<>&"']/g,
      c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
  }

  /* -------- 本文サニタイズ（v9から踏襲） -------- */
  function sanitizeBody(src) {
    const out = document.createElement('div');

    function appendConverted(node, container) {
      if (node.nodeType === Node.TEXT_NODE) {
        container.appendChild(document.createTextNode(node.nodeValue));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName;

      if (tag === 'BR') {
        container.appendChild(document.createElement('br'));
      } else if (tag === 'RUBY') {
        const ruby = document.createElement('ruby');
        Array.from(node.childNodes).forEach(c => {
          if (c.nodeType === Node.ELEMENT_NODE && (c.tagName === 'RT' || c.tagName === 'RP')) {
            const rt = document.createElement(c.tagName.toLowerCase());
            rt.textContent = c.textContent;
            ruby.appendChild(rt);
          } else if (c.nodeType === Node.TEXT_NODE) {
            ruby.appendChild(document.createTextNode(c.nodeValue));
          }
        });
        container.appendChild(ruby);
      } else if (tag === 'P' || tag === 'DIV') {
        const p = document.createElement('p');
        Array.from(node.childNodes).forEach(c => appendConverted(c, p));
        if (p.childNodes.length > 0) out.appendChild(p);
      } else {
        Array.from(node.childNodes).forEach(c => appendConverted(c, container));
      }
    }

    let currentP = null;
    Array.from(src.childNodes).forEach(c => {
      if (c.nodeType === Node.ELEMENT_NODE && (c.tagName === 'P' || c.tagName === 'DIV')) {
        appendConverted(c, out);
        currentP = null;
      } else {
        if (!currentP) {
          currentP = document.createElement('p');
          out.appendChild(currentP);
        }
        appendConverted(c, currentP);
      }
    });

    if (out.children.length === 0) {
      const p = document.createElement('p');
      Array.from(src.childNodes).forEach(c => appendConverted(c, p));
      out.appendChild(p);
    }

    return out;
  }

  function applyTcy(node) {
    const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode: n => /\d/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const targets = [];
    while (walk.nextNode()) {
      const n = walk.currentNode;
      if (n.parentElement && !n.parentElement.closest('.vr-tcy')) targets.push(n);
    }
    targets.forEach(n => {
      const html = n.nodeValue.replace(/(\d{1,2})(?!\d)/g, '<span class="vr-tcy">$1</span>');
      if (html === n.nodeValue) return;
      const tmp = document.createElement('span');
      tmp.innerHTML = html;
      n.replaceWith(...tmp.childNodes);
    });
  }

  function replaceBody(srcElement, bodyContainer) {
    bodyContainer.innerHTML = '';
    const sanitized = sanitizeBody(srcElement);
    Array.from(sanitized.childNodes).forEach(n => bodyContainer.appendChild(n));
    applyTcy(bodyContainer);
  }

  let currentMeta = extractMeta(document);

  /* ===================================================================
     DOM 構築
     =================================================================== */
  const root = document.createElement('div');
  root.id = 'vreader-root';
  root.dataset.theme = cfg.theme;
  root.innerHTML = `
    <div id="vreader-scroller">
      <div id="vreader-body"></div>
    </div>
    <div id="vreader-end">
      <div class="vr-end-title"></div>
      <div class="vr-end-ads"></div>
      <nav class="vr-end-nav"></nav>
      <div class="vr-end-tip"></div>
    </div>
    <div id="vreader-bar">
      <button data-act="font-dec">a−</button>
      <button data-act="font-inc">A＋</button>
      <button data-act="theme">配色</button>
      <button data-act="exit">×</button>
    </div>
    <div id="vreader-info"></div>
    <div id="vreader-loading">読み込み中…</div>
  `;

  const bodyContainer = root.querySelector('#vreader-body');
  replaceBody(sourceBody, bodyContainer);

  /* ===================================================================
     スタイル注入
     =================================================================== */
  const style = document.createElement('style');
  style.id = 'vreader-style';
  style.textContent = `
    #vreader-root {
      position: fixed !important; inset: 0 !important;
      z-index: 2147483647 !important; overflow: hidden !important;
      font-family: "Hiragino Mincho ProN", "YuMincho", "Yu Mincho", serif;
      transition: background .2s, color .2s;
    }
    #vreader-root[data-theme="light"] { background: #f5efe2; color: #2a2620; }
    #vreader-root[data-theme="dark"]  { background: #181614; color: #d4cfc6; }

   #vreader-scroller {
      position: absolute;
      top: 4vh; bottom: 6vh; left: 10vw; right: 10vw;
      overflow-x: auto;
      overflow-y: hidden;
      direction: rtl;
      scroll-behavior: smooth;
      -webkit-overflow-scrolling: auto;
      touch-action: pan-x;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    #vreader-scroller::-webkit-scrollbar { display: none; }

   #vreader-body {
      height: 100%;
      writing-mode: vertical-rl;
      direction: ltr;
      letter-spacing: 0.1em;
      -webkit-text-size-adjust: none;
      text-size-adjust: none;
    }

    #vreader-body p { margin: 0; text-indent: 1em; }
    #vreader-body br { display: block; content: ""; }
    .vr-tcy { text-combine-upright: all; -webkit-text-combine: horizontal; }

    #vreader-end {
      position: absolute;
      top: 4vh; bottom: 6vh; left: 10vw; right: 10vw;
      writing-mode: horizontal-tb;
      box-sizing: border-box;
      display: none;
      flex-direction: column;
      font-family: sans-serif;
      padding: 2vh 4vw;
    }
    #vreader-end.show { display: flex; }
    .vr-end-title { text-align: center; font-size: 1.1em; margin-bottom: 4vh; opacity: .85; }
    .vr-end-ads {
      flex: 1; display: flex; align-items: center; justify-content: center;
      min-height: 0; overflow: hidden; margin-bottom: 4vh;
    }
    .vr-end-ads > * { max-width: 100% !important; max-height: 100% !important; }
    .vr-end-nav { display: flex; gap: 3vw; margin-bottom: 2vh; }
    .vr-end-nav a, .vr-end-nav span {
      flex: 1; padding: 1em 0; text-align: center;
      border: 1px solid currentColor; border-radius: 6px;
      text-decoration: none; color: inherit; font-size: .95em;
    }
    .vr-end-nav .vr-disabled { opacity: .3; }
    .vr-end-nav .vr-next { font-weight: bold; }
    .vr-end-tip { text-align: center; font-size: .8em; opacity: .5; }

    #vreader-bar {
      position: fixed; top: 0; left: 0; right: 0;
      background: rgba(0,0,0,.78); color: #fff;
      padding: 10px; text-align: center;
      z-index: 10;
      transform: translateY(-100%); transition: transform .2s;
      font-family: sans-serif;
    }
    #vreader-bar.show { transform: translateY(0); }
    #vreader-bar button {
      background: transparent; border: 1px solid #fff; color: #fff;
      padding: 8px 14px; margin: 0 4px;
      border-radius: 4px; font-size: 14px;
    }
    #vreader-info {
      position: fixed; bottom: 6px; left: 50%;
      transform: translateX(-50%);
      font-size: 11px; opacity: .45; pointer-events: none;
      font-family: sans-serif;
      writing-mode: horizontal-tb;
      z-index: 6;
    }
    #vreader-loading {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,.75); color: #fff;
      padding: 12px 24px; border-radius: 6px;
      font-family: sans-serif; font-size: 14px;
      z-index: 20;
      display: none;
    }
    #vreader-loading.show { display: block; }
  `;

  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.head.appendChild(style);
  document.body.appendChild(root);

  /* ===================================================================
     要素参照
     =================================================================== */
  const scroller = root.querySelector('#vreader-scroller');
  const endPage  = root.querySelector('#vreader-end');
  const bar      = root.querySelector('#vreader-bar');
  const info     = root.querySelector('#vreader-info');
  const loading  = root.querySelector('#vreader-loading');

  /* ===================================================================
     状態変数
     =================================================================== */
  let curPage = 0;
  let totalPages = 0;
  let bodyPages = 0;
  let pageWidth = 0;

  /* ===================================================================
     フォント適用
     =================================================================== */
  function applyFontStyles() {
    const fs = cfg.font + 'px';
    const lh = (cfg.font + 14) + 'px';
    bodyContainer.style.setProperty('font-size', fs, 'important');
    bodyContainer.style.setProperty('line-height', lh, 'important');
    bodyContainer.querySelectorAll('*').forEach(el => {
      if (el.tagName === 'RT' || el.tagName === 'RP') {
        el.style.setProperty('font-size', (cfg.font * 0.5) + 'px', 'important');
        el.style.setProperty('line-height', '1', 'important');
      } else {
        el.style.setProperty('font-size', fs, 'important');
        el.style.setProperty('line-height', lh, 'important');
      }
    });
  }

  /* ===================================================================
     ページ計測：ブラウザに任せる
     =================================================================== */
  function measure() {
    pageWidth = scroller.clientWidth;
    void scroller.offsetWidth;
    const sw = scroller.scrollWidth;
    bodyPages = Math.max(1, Math.ceil(sw / pageWidth));
    totalPages = bodyPages + 1;
    updateInfo();
  }

  function updateInfo() {
    info.textContent = `${curPage + 1} / ${totalPages}`;
  }

  /* ===================================================================
     ページ移動：scroll で
     =================================================================== */
  function goTo(n) {
    n = Math.max(0, Math.min(totalPages - 1, n));
    curPage = n;
    if (n < bodyPages) {
      endPage.classList.remove('show');
      scroller.style.display = 'block';
      const target = n * pageWidth;
      scroller.scrollTo({ left: target, behavior: 'smooth' });
    } else {
      endPage.classList.add('show');
    }
    updateInfo();
  }

  function goToInstant(n) {
    // アニメーション無しで瞬時に移動（初期化用）
    n = Math.max(0, Math.min(totalPages - 1, n));
    curPage = n;
    if (n < bodyPages) {
      endPage.classList.remove('show');
      scroller.style.display = 'block';
      scroller.scrollLeft = n * pageWidth;
    } else {
      endPage.classList.add('show');
    }
    updateInfo();
  }

  const isOnEndPage = () => curPage === totalPages - 1;

  function deferredMeasure(afterFn) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void bodyContainer.offsetWidth;
        measure();
        if (afterFn) afterFn();
      });
    });
  }

  /* ===================================================================
     章末ページの更新
     =================================================================== */
  function updateEndPage() {
    const { title, nextHref, prevHref, adNodes } = currentMeta;

    root.querySelector('.vr-end-title').textContent =
      title ? '― ' + title + ' 終わり ―' : '― このエピソードはここまで ―';

    const nav = root.querySelector('.vr-end-nav');
    nav.innerHTML = `
      ${ nextHref ? `<a href="${escapeHtml(nextHref)}" class="vr-next" data-nav="next">次話 →</a>`
                  : '<span class="vr-disabled">完結／未投稿</span>' }
      <a href="#" data-nav="index">目次</a>
      ${ prevHref ? `<a href="${escapeHtml(prevHref)}" data-nav="prev">← 前話</a>`
                  : '<span class="vr-disabled">← 前話</span>' }
    `;

    root.querySelector('.vr-end-tip').textContent =
      nextHref ? '左端タップでも次話へ進めます' : '';

    const adsContainer = root.querySelector('.vr-end-ads');
    adsContainer.innerHTML = '';
    if (adNodes && adNodes.length > 0) {
      adNodes.forEach(ad => adsContainer.appendChild(ad));
    } else {
      adsContainer.innerHTML = '<div style="opacity:.4;font-size:.85em">（広告なし）</div>';
    }

    let prefetch = document.head.querySelector('link[data-vreader-prefetch]');
    if (nextHref) {
      if (!prefetch) {
        prefetch = document.createElement('link');
        prefetch.rel = 'prefetch';
        prefetch.dataset.vreaderPrefetch = '1';
        document.head.appendChild(prefetch);
      }
      prefetch.href = nextHref;
    } else if (prefetch) {
      prefetch.remove();
    }
  }

  updateEndPage();

  /* ===================================================================
     エピソード遷移
     =================================================================== */
  let loadingEpisode = false;
  async function loadEpisode(url) {
    if (loadingEpisode) return;
    loadingEpisode = true;
    loading.classList.add('show');

    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const html = await res.text();
      const doc  = new DOMParser().parseFromString(html, 'text/html');

      const newBody = doc.querySelector(sel.body);
      if (!newBody) throw new Error('body not found');

      replaceBody(newBody, bodyContainer);
      applyFontStyles();

      currentMeta = extractMeta(doc);
      updateEndPage();

      history.pushState({ vreader: true }, '', url);
      if (currentMeta.title) document.title = currentMeta.title;

      deferredMeasure(() => {
        goToInstant(0);
        loading.classList.remove('show');
        loadingEpisode = false;
      });

    } catch (err) {
      console.error('[vreader] loadEpisode error:', err);
      loading.classList.remove('show');
      loadingEpisode = false;
      location.href = url;
    }
  }

  /* ===================================================================
     タップ処理
     =================================================================== */
  function onTap(e) {
    const navLink = e.target.closest('[data-nav]');
    if (navLink) {
      e.preventDefault();
      const type = navLink.dataset.nav;
      if (type === 'next' && currentMeta.nextHref) {
        loadEpisode(currentMeta.nextHref);
      } else if (type === 'prev' && currentMeta.prevHref) {
        loadEpisode(currentMeta.prevHref);
      } else if (type === 'index') {
        history.back();
      }
      return;
    }

    if (e.target.closest('a, button')) return;

    const x = e.clientX, y = e.clientY;
    const w = window.innerWidth, h = window.innerHeight;

    if (y < h * 0.12) { bar.classList.toggle('show'); return; }

    if (isOnEndPage() && currentMeta.nextHref && x < w / 3) {
      loadEpisode(currentMeta.nextHref);
      return;
    }

    if (x < w / 3)          goTo(curPage + 1);
    else if (x > w * 2 / 3) goTo(curPage - 1);
  }
  root.addEventListener('click', onTap);

  /* ===================================================================
     設定バー
     =================================================================== */
  bar.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    e.stopPropagation();

    if      (act === 'font-dec') cfg.font = Math.max(12, cfg.font - 1);
    else if (act === 'font-inc') cfg.font = Math.min(40, cfg.font + 1);
    else if (act === 'theme')    cfg.theme = (cfg.theme === 'light' ? 'dark' : 'light');
    else if (act === 'exit')     { location.reload(); return; }

    applyFontStyles();
    root.dataset.theme = cfg.theme;
    saveCfg();
    // フォント変更後は、現在のページ割合を保持して再位置
    const prevRatio = totalPages > 0 ? curPage / totalPages : 0;
    deferredMeasure(() => {
      goToInstant(Math.round(prevRatio * totalPages));
    });
  });

  /* ===================================================================
     ブラウザ戻る/進む
     =================================================================== */
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.vreader) {
      loadEpisode(location.href);
    } else {
      location.reload();
    }
  });

  /* ===================================================================
     スクロール位置からcurPageを逆算（スワイプされた場合の対応）
     =================================================================== */
  let scrollTimer;
  scroller.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (pageWidth > 0 && !isOnEndPage()) {
        const newPage = Math.round(scroller.scrollLeft / pageWidth);
        if (newPage !== curPage && newPage >= 0 && newPage < bodyPages) {
          curPage = newPage;
          updateInfo();
        }
      }
    }, 120);
  });

  /* ===================================================================
     起動 & リサイズ
     =================================================================== */
  applyFontStyles();
  deferredMeasure(() => goToInstant(0));

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const ratio = totalPages > 0 ? curPage / totalPages : 0;
      deferredMeasure(() => goToInstant(Math.round(ratio * totalPages)));
    }, 200);
  });
})();
