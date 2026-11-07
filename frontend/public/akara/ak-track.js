/* Akara tracker (2026-10-04) — ONE file for every surface.
   Loaded by: lib.jsx (main app, runtime inject), /ganpati.html, and the
   Times pages (akara-times-daily Lambda template). Plain JS, no React.
   Sends Google Analytics 4 events:
     ui_click       every click on a link / button / clickable thing
     section_view   a section came to the middle of the screen
     section_time   seconds spent in that section (visible tab only)
     scroll_depth   25 / 50 / 75 / 100 percent of a page
   Also loads the Meta pixel (2026-11-07) so Instagram ads learn from visits:
     PageView on load; view_item / add_to_cart / begin_checkout become
     ViewContent / AddToCart / InitiateCheckout. NO Purchase here — the
     Shopify checkout sends it and a second copy double-counts.
   Ad click ids (utm_*, fbclid) are kept for the session; window.akAdParams()
   returns them so the shop can append them to the Shopify checkoutUrl.
   Feature events (music_play, view_item, add_to_cart, artwork_view ...)
   are sent by the jsx files through window.akTrack(name, params).
   Never send typed text or e-mail addresses (GA terms forbid personal data). */
(function(){
  if (typeof window === "undefined" || window.__akTrackOn) return;
  window.__akTrackOn = true;
  var GA_ID = "G-BQEB260FD7";
  var META_PIXEL = "2223955191883160";

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

  // Bootstrap the Meta pixel only if the page has not done it already.
  if (!window.fbq){
    var fbq = window.fbq = function(){
      fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq; fbq.loaded = true; fbq.version = "2.0"; fbq.queue = [];
    // autoConfig off: Meta would otherwise read button text and page fields itself.
    window.fbq("set", "autoConfig", false, META_PIXEL);
    window.fbq("init", META_PIXEL);
    window.fbq("track", "PageView");
  }
  if (!document.getElementById("ak-meta") && !document.querySelector('script[src*="connect.facebook.net"]')){
    var m = document.createElement("script");
    m.id = "ak-meta"; m.async = true;
    m.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(m);
  }

  // Ad click ids from the landing URL, kept for this tab's session.
  var AD_KEYS = /^(utm_[a-z]+|fbclid)$/;
  function adParams(){
    var got = {};
    try{ got = JSON.parse(sessionStorage.getItem("ak-ad-params") || "{}") || {}; }catch(e){}
    try{
      var fresh = {}, any = false;
      new URLSearchParams(location.search).forEach(function(v, k){
        if (AD_KEYS.test(k) && v){ fresh[k] = v.slice(0, 200); any = true; }
      });
      if (any){ got = fresh; try{ sessionStorage.setItem("ak-ad-params", JSON.stringify(got)); }catch(e){} }
    }catch(e){}
    return got;
  }
  adParams();
  window.akAdParams = adParams;

  // GA4 ecommerce event -> Meta standard event. Only ids, prices, counts.
  var META_EVENTS = { view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout" };
  function toMeta(name, params){
    var ev = META_EVENTS[name];
    if (!ev) return;
    try{
      var items = (params && params.items) || [];
      var p = {
        content_ids: items.map(function(i){ return String(i.item_id); }),
        content_type: "product",
        contents: items.map(function(i){ return { id: String(i.item_id), quantity: i.quantity || 1, item_price: Number(i.price) || 0 }; }),
        currency: "INR",
        value: Number(params && params.value) || 0
      };
      if (ev === "InitiateCheckout") p.num_items = items.reduce(function(n, i){ return n + (i.quantity || 1); }, 0);
      window.fbq("track", ev, p);
    }catch(e){}
  }

  function clean(v){
    v = String(v == null ? "" : v).replace(/\s+/g, " ").trim();
    if (/@/.test(v)) return "[redacted]";
    return v.slice(0, 80);
  }
  function track(name, params){
    try{ window.gtag("event", name, params || {}); }catch(e){}
    toMeta(name, params);
  }
  window.akTrack = track;
  // Shop events sent by lib.jsx's stand-in akTrack before this file loaded
  // already reached GA; send them on to Meta now.
  (window.__akMetaQ || []).splice(0).forEach(function(a){ toMeta(a[0], a[1]); });

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
