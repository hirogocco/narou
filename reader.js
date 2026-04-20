/* ======================================================================
   縦書きリーダー bookmarklet loader target  (なろう / カクヨム)
   v2 — GitHub Pages 配信版
   ---------------------------------------------------------------------- */

(function () {
  'use strict';

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

  if (document.getElementById('vreader-root')) { location.reload(); return; }

  const sourceBody = document.querySelector(sel.body);
  if (!sourceBody) {
    alert('縦書きリーダー：\n本文要素が見つかりませんでした。\nセレクタの更新が必要です。');
    return;
  }

  const sourceTitleEl = document.querySelector(sel.title);
  const title = sourceTitleEl ? sourceTitleEl.textContent.trim() : '';
  const nextEl = document.querySelector(sel.next);
  const prevEl = document.querySelector(sel.prev);
  const nextHref = (nextEl && nextEl.href) ? nextEl.href : null;
  const prevHref = (prevEl && prevEl.href) ? prevEl.href : null;
  const adNodes = Array.from(document.querySelectorAll(sel.ads));

  const SK = 'vreader-settings-v1';
  let cfg = { font: 18, theme: 'light' };
  try {
    const s = localStorage.getItem(SK);
    if (s) Object.assign(cfg, JSON.parse(s));
  } catch (e) {}
  const saveCfg = () => {
    try { localStorage.setItem(SK, JSON.stringify(cfg)); } catch (e) {}
  };

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

  function escapeHtml(s) {
    return String(s).replace(/[<>&"']/g,
      c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
  }

  const root = document.createElement('div');
  root.id = 'vreader-root';
  root.dataset.theme = cfg.theme;
  root.innerHTML = `
    <div id="vreader-track">
      <div id="vreader-body-wrap"><div id="vreader-body"></div></div>
      <div id="vreader-end">
        <div class="vr-end-title">${ title ? '― ' + escapeHtml(title) + ' 終わり ―' : '― このエピソードはここまで ―' }</div>
        <div class="vr-end-ads"></div>
        <nav class="vr-end-nav">
          ${ prevHref ? `<a href="${escapeHtml(prevHref)}">← 前話</a>`
                      : '<span class="vr-disabled">← 前話</span>' }
          <a href="javascript:history.back()">目次</a>
          ${ nextHref ? `<a href="${escapeHtml(nextHref)}" class="vr-next">次話 →</a>`
                      : '<span class="vr-disabled">完結／未投稿</span>' }
        </nav>
        <div class="vr-end-tip">${ nextHref ? '中央タップでも次話へ進めます' : '' }</div>
      </div>
    </div>
    <div id="vreader-bar">
      <button data-act="font-s">小</button>
      <button data-act="font-m">中</button>
      <button data-act="font-l">大</button>
      <button data-act="theme">配色</button>
      <button data-act="exit">×</button>
    </div>
    <div id="vreader-info"></div>
  `;

  const bodyContainer = root.querySelector('#vreader-body');
  bodyContainer.appendChild(sourceBody.cloneNode(true));
  applyTcy(bodyContainer);

  const adsContainer = root.querySelector('.vr-end-ads');
  if (adNodes.length > 0) {
    adNodes.forEach(ad => adsContainer.appendChild(ad));
  } else {
    adsContainer.innerHTML = '<div style="opacity:.4;font-size:.85em">（広告なし）</div>';
  }

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
    #vreader-track {
      position: absolute; top: 4vh; right: 14vw; bottom: 6vh; left: 14vw;
      display: flex; flex-direction: row-reverse; align-items: stretch;
      transition: transform .28s ease;
      will-change: transform;
    }
    #vreader-body-wrap {
      flex-shrink: 0;
      height: 100%;
      writing-mode: vertical-rl;
      box-sizing: border-box;
      font-size: ${cfg.font}px;
      line-height: 1.9;
      letter-spacing: .05em;
    }
    #vreader-body { height: 100%; }
    #vreader-body p { margin: 0 0 1em 0; text-indent: 1em; }
    #vreader-body ruby rt { font-size: .5em; }
    #vreader-body img { max-width: 80vh; max-height: 80vw; height: auto; }
    .vr-tcy { text-combine-upright: all; -webkit-text-combine: horizontal; }
    #vreader-end {
      flex-shrink: 0;
      height: 100%;
      writing-mode: horizontal-tb;
      padding: 4vh 4vw 6vh 4vw; box-sizing: border-box;
      display: flex; flex-direction: column;
      font-family: sans-serif;
    }
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
    }
  `;

  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.head.appendChild(style);
  document.body.appendChild(root);

  const track    = root.querySelector('#vreader-track');
  const bodyWrap = root.querySelector('#vreader-body-wrap');
  const endPage  = root.querySelector('#vreader-end');
  const bar      = root.querySelector('#vreader-bar');
  const info     = root.querySelector('#vreader-info');

  let curPage = 0;
  let totalPages = 0;
  let bodyPages = 0;
  let pageWidth = 0;

  function measure() {
    pageWidth = track.clientWidth;
    bodyWrap.style.minWidth = '';
    bodyWrap.style.width = pageWidth + 'px';
    endPage.style.width  = pageWidth + 'px';
    const w = bodyWrap.scrollWidth;
    bodyPages = Math.max(1, Math.ceil(w / pageWidth));
    bodyWrap.style.minWidth = (bodyPages * pageWidth) + 'px';
    totalPages = bodyPages + 1;
    updateInfo();
  }

  function updateInfo() {
    info.textContent = `${curPage + 1} / ${totalPages}`;
  }

  function goTo(n) {
    n = Math.max(0, Math.min(totalPages - 1, n));
    curPage = n;
    track.style.transform = `translateX(${n * pageWidth}px)`;
    updateInfo();
  }

  const isOnEndPage = () => curPage === totalPages - 1;

  function onTap(e) {
    if (e.target.closest('a, button')) return;
    const x = e.clientX, y = e.clientY;
    const w = window.innerWidth, h = window.innerHeight;
    if (y < h * 0.12) { bar.classList.toggle('show'); return; }
    if (isOnEndPage() && nextHref && x > w * 0.2 && x < w * 0.8) {
      location.href = nextHref;
      return;
    }
    if (x < w / 3) goTo(curPage + 1);
    else if (x > w * 2 / 3) goTo(curPage - 1);
  }
  root.addEventListener('click', onTap);

  bar.addEventListener('click', e => {
    const act = e.target.dataset.act;
    if (!act) return;
    e.stopPropagation();
    if      (act === 'font-s') cfg.font = 16;
    else if (act === 'font-m') cfg.font = 18;
    else if (act === 'font-l') cfg.font = 22;
    else if (act === 'theme')  cfg.theme = (cfg.theme === 'light' ? 'dark' : 'light');
    else if (act === 'exit')   { location.reload(); return; }
    bodyWrap.style.fontSize = cfg.font + 'px';
    root.dataset.theme = cfg.theme;
    saveCfg();
    setTimeout(() => { measure(); goTo(curPage); }, 50);
  });

  if (nextHref) {
    const link = document.createElement('link');
    link.rel  = 'prefetch';
    link.href = nextHref;
    document.head.appendChild(link);
  }

  setTimeout(() => { measure(); goTo(0); }, 100);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const ratio = totalPages > 0 ? curPage / totalPages : 0;
      measure();
      goTo(Math.round(ratio * totalPages));
    }, 200);
  });
})();
