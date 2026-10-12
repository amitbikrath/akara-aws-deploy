/* Akara tracker (2026-10-04) — ONE file for every surface.
   Loaded by: lib.jsx (main app, runtime inject), /ganpati.html, and the
   Times pages (akara-times-daily Lambda template). Plain JS, no React.
   Sends Google Analytics 4 events:
     ui_click       every click on a link / button / clickable thing
     section_view   a section came to the middle of the screen
     section_time   seconds spent in that section (visible tab only)
     scroll_depth   25 / 50 / 75 / 100 percent of a page
   Feature events (music_play, view_item, add_to_cart, artwork_view ...)
   are sent by the jsx files through window.akTrack(name, params).
   Never send typed text or e-mail addresses (GA terms forbid personal data). */
(function(){
  if (typeof window === "undefined" || window.__akTrackOn) return;
  window.__akTrackOn = true;
  var GA_ID = "G-BQEB260FD7";

  // Bootstrap GA only if the page has not done it already.
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag){
    window.gtag = function(){ window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);
  }
  if (!document.getElementById("ak-ga4") && !document.querySelector('script[src*="googletagmanager.com/gtag/js"]')){
    var s = document.createElement("script");
    s.id = "ak-ga4"; s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
  }

  function clean(v){
    v = String(v == null ? "" : v).replace(/\s+/g, " ").trim();
    if (/@/.test(v)) return "[redacted]";
    return v.slice(0, 80);
  }
  function track(name, params){
    try{ window.gtag("event", name, params || {}); }catch(e){}
  }
  window.akTrack = track;

  // Which part of the site is this element / the screen centre in?
  function sectionOf(el){
    var n = el && el.closest ? el.closest("section[id],[data-ak-section]") : null;
    if (n) return n.getAttribute("data-ak-section") || n.id;
    if (el && el.closest && el.closest(".shop-root")){
      return /^\/shop\/[^/]+/.test(location.pathname) ? "shop-product" : "shop-page";
    }
    if (location.hash && location.hash.length > 1) return clean(location.hash.slice(1));
    if (/^\/times(\/|\.html|$)/.test(location.pathname)) return "times";
    if (/^\/ganpati/.test(location.pathname)) return "ganpati";
    if (el && el.closest){
      if (el.closest("nav,header")) return "nav";
      if (el.closest("footer")) return "footer";
    }
    return "other";
  }

  // ── clicks ───────────────────────────────────────────────────────────────
  function clickable(el){
    var hit = el.closest ? el.closest('a,button,[role="button"],[data-track],summary,label') : null;
    if (hit) return hit;
    var n = el, i = 0;                       // React onClick on a plain div
    while (n && n.nodeType === 1 && i < 5){
      try{ if (getComputedStyle(n).cursor === "pointer") hit = n; else if (hit) break; }catch(e){}
      n = n.parentElement; i++;
    }
    return hit;
  }
  function labelOf(el){
    var t = el.getAttribute("data-track") || el.getAttribute("aria-label") || el.getAttribute("title");
    if (!t){
      // innerText, not textContent: textContent also returns the text of
      // <style>/<script> children and of hidden nodes.
      var inForm = el.closest && el.closest("form,[contenteditable]");
      if (!inForm || el.tagName.toLowerCase() === "button"){
        t = String(el.innerText || "").split("\n").map(function(x){ return x.trim(); })
          .filter(function(x){ return x.length > 1 && /[A-Za-z0-9\u0900-\u097F]/.test(x); }).slice(0, 3).join(" · ");
      }
    }
    if (!clean(t)){
      var img = el.querySelector && el.querySelector("img[alt]");
      if (img) t = img.getAttribute("alt");
    }
    return clean(t) || "(no label)";
  }
  document.addEventListener("click", function(ev){
    try{
      var t = ev.target;
      if (!t || t.nodeType !== 1) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      var el = clickable(t);
      if (!el) return;
      var p = { click_label: labelOf(el), section: sectionOf(el), click_tag: el.tagName.toLowerCase() };
      var href = el.getAttribute && el.getAttribute("href");
      if (href && href !== "#"){
        p.link_url = href.split("?")[0].slice(0, 120);
        try{ p.outbound = new URL(href, location.href).hostname !== location.hostname; }catch(e){}
      }
      track("ui_click", p);
    }catch(e){}
  }, true);

  // ── sections seen + seconds in each ──────────────────────────────────────
  var cur = null, curSecs = 0;
  function flushSection(){
    if (cur && curSecs >= 2) track("section_time", { section: cur, seconds: curSecs });
    curSecs = 0;
  }
  setInterval(function(){
    if (document.hidden) return;
    var el = null;
    try{ el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2); }catch(e){}
    var name = sectionOf(el);
    if (name !== cur){
      flushSection();
      cur = name;
      track("section_view", { section: name });
    }
    curSecs++;
  }, 1000);
  document.addEventListener("visibilitychange", function(){ if (document.hidden) flushSection(); });
  window.addEventListener("pagehide", flushSection);

  // ── scroll depth, once per mark per page ─────────────────────────────────
  var marks = {}, ticking = false;
  function pageKey(){ return location.pathname + location.hash; }
  function checkScroll(){
    ticking = false;
    var d = document.documentElement;
    var max = d.scrollHeight - window.innerHeight;
    if (max < 200) return;
    var pct = Math.min(100, Math.round((window.scrollY / max) * 100));
    var key = pageKey(), got = marks[key] || (marks[key] = {});
    [25, 50, 75, 100].forEach(function(m){
      if (pct >= (m === 100 ? 98 : m) && !got[m]){
        got[m] = true;
        track("scroll_depth", { percent: m, page: key.slice(0, 100) });
      }
    });
  }
  window.addEventListener("scroll", function(){
    if (!ticking){ ticking = true; requestAnimationFrame(checkScroll); }
  }, { passive: true });
})();
