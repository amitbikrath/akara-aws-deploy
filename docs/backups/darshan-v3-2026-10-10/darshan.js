// Darśana v2 — a calm room of sacred art. One script for /darshan and every
// /darshan/{facet} page. Filters live in a left rail (a slide-out drawer on
// phones). Data: window.DARSHAN (data.js), window.DARSHAN_SHOP (prints.js),
// /api/catalog. Downloads: /api/darshan/download (fingerprinted, signed-in).
(function(){
  var D = window.DARSHAN, $ = function(s){ return document.querySelector(s); };
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var Q = new URLSearchParams(location.search);
  var PREVIEW = Q.get('preview') === '1';   // staging only: show unapproved AI tags
  var STILL = Q.get('still') === '1';       // screenshots: no reveal animation
  var path = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '');
  var BASE = '/' + (path.split('/')[1] || 'darshan');
  var SLUG = path.split('/')[2] || '';

  function track(name, params){ params = Object.assign({ page: location.pathname }, params || {}); if (window.akTrack) window.akTrack(name, params); else if (window.gtag) window.gtag('event', name, params); }
  function toast(t){ var el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function(){ el.classList.remove('on'); }, 2600); }

  // ── theme (Ivory · Sandal · Indigo night), remembered per visitor ──
  function setTheme(t, how){
    document.documentElement.dataset.theme = t;
    document.querySelectorAll('.themes button').forEach(function(b){ b.setAttribute('aria-pressed', b.dataset.t === t); });
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    try { localStorage.setItem('darshan.theme', t); } catch (e) {}
    if (how) track('darshan_theme', { theme: t });
  }
  var savedTheme = null; try { savedTheme = localStorage.getItem('darshan.theme'); } catch (e) {}
  setTheme(Q.get('theme') || savedTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'indigo' : 'ivory'));
  document.querySelectorAll('.themes button').forEach(function(b){ b.onclick = function(){ setTheme(b.dataset.t, 'tap'); }; });

  // ── auth: the site's one implementation (auth.jsx has no JSX; evaluate it with a hook stub) ──
  var auth = { current: function(){ return null; }, signIn: function(){ location.href = '/'; } };
  fetch('/akara/auth.jsx').then(function(r){ return r.text(); }).then(function(src){
    var api = new Function('React', src + '\n;return { akSignIn: akSignIn, akSignInWithPassword: akSignInWithPassword, akSignOut: akSignOut, akCurrentUser: akCurrentUser, akEnsureImageAccess: akEnsureImageAccess };')({ useState: function(){}, useEffect: function(){}, useCallback: function(){} });
    // akCurrentUser() already returns null for expired tokens (expiresAt is in SECONDS there).
    auth.current = function(){ return api.akCurrentUser(); };
    auth.api = api;
    auth.signIn = function(){ track('darshan_signin_click'); openJoin(); };
    try { api.akEnsureImageAccess(); } catch (e) {}
  }).catch(function(){}).then(paintWho);
  window.addEventListener('akara:auth', paintWho);   // fired when a sign-in renews itself
  function paintWho(){
    var b = $('#who'); if (!b) return; var u = auth.current();
    b.textContent = u ? (String(u.name || 'Signed in').split(' ')[0]) : 'Sign in';
    b.onclick = function(e){ e.preventDefault(); if (u) openAccount(u); else auth.signIn(); };
  }

  // ── join sheet: Google, email + password, create account, forgot password ──
  function sheet(html){
    var el = document.createElement('div'); el.className = 'join'; el.innerHTML = '<div class="bd"></div><div class="jcard" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(el); setTimeout(function(){ el.classList.add("on"); }, 20);
    var close = function(){ el.classList.remove('on'); setTimeout(function(){ el.remove(); }, 400); };
    el.querySelector('.bd').onclick = close; el.querySelectorAll('[data-close]').forEach(function(b){ b.onclick = close; });
    return { el: el, close: close };
  }
  function openJoin(){
    var api = auth.api;
    var sh = sheet('<button class="jx" data-close aria-label="Close">✕</button><div class="k">Akara · free account</div><h3>Join the darśana</h3>' +
      '<p class="sub">Full-size wallpapers without the watermark, free. One account for the gallery, Darśana and the shop.</p>' +
      '<button class="jb g" id="jg"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.5z"/><path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3c1.9 3.8 5.8 6.3 10.2 6.3z"/><path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3z"/><path fill="#EA4335" d="M12 5c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.4 11.4 0 0 0 1.8 6.8l3.8 3C6.5 7.1 9 5 12 5z"/></svg>Continue with Google</button>' +
      '<div class="or"><span>or with email</span></div>' +
      '<form id="jf" autocomplete="on"><input id="je" type="email" inputmode="email" autocomplete="username" placeholder="Email" required><input id="jp" type="password" autocomplete="current-password" placeholder="Password" required>' +
      '<p class="err" id="jerr" hidden></p><button class="jb p" type="submit" id="js">Sign in</button></form>' +
      '<div class="links"><button id="jsu">Create an account</button><button id="jfp">Forgot password?</button></div>');
    track('darshan_join_open');
    sh.el.querySelector('#jg').onclick = function(){ track('darshan_join', { method: 'google' }); api.akSignIn({ identityProvider: 'Google' }); };
    sh.el.querySelector('#jsu').onclick = function(){ track('darshan_join', { method: 'signup' }); api.akSignIn({ signup: true }); };
    sh.el.querySelector('#jfp').onclick = function(){ var c = (window.__AKARA_AUTH || {}); location.href = c.hostedUI + '/forgotPassword?client_id=' + encodeURIComponent(c.clientId) + '&response_type=code&scope=' + encodeURIComponent(c.scope || 'openid email profile') + '&redirect_uri=' + encodeURIComponent(c.redirectUri); };
    sh.el.querySelector('#jf').onsubmit = function(e){
      e.preventDefault(); var btn = sh.el.querySelector('#js'), err = sh.el.querySelector('#jerr');
      btn.disabled = true; btn.textContent = 'Signing in…'; err.hidden = true;
      api.akSignInWithPassword(sh.el.querySelector('#je').value, sh.el.querySelector('#jp').value).then(function(){
        track('darshan_join', { method: 'password' }); sh.close(); paintWho(); if (vw.classList.contains('on')) paintViewer(); toast('Welcome');
      }, function(x){
        var msg = /NotAuthorized|Incorrect/i.test(x.code + x.message) ? 'Email or password is not right.' : /UserNotConfirmed/.test(x.code) ? 'Please confirm your email first (check your inbox).' : /UserNotFound/.test(x.code) ? 'No account with that email — create one below.' : (x.message || 'Could not sign in.');
        err.textContent = msg; err.hidden = false; btn.disabled = false; btn.textContent = 'Sign in';
      });
    };
  }
  function openAccount(u){
    var sh = sheet('<button class="jx" data-close aria-label="Close">✕</button><div class="k">Signed in</div><h3>' + esc(u.name || 'Your account') + '</h3><p class="sub">' + esc(u.email || '') + '</p><button class="jb p" id="jo">Sign out</button>');
    sh.el.querySelector('#jo').onclick = function(){ auth.api.akSignOut().then(function(){ sh.close(); location.reload(); }); };
  }

  // ── rail: open on desktop, slim strip on phone; tap to slide open/closed ──
  var shell = $('#shell'), phone = matchMedia('(max-width:860px)');
  function setOpen(open){ shell.classList.toggle('collapsed', !open); if (phone.matches) document.body.style.overflow = open ? 'hidden' : ''; }
  setOpen(Q.get('rail') === '1' || (!phone.matches && Q.get('rail') !== '0'));
  $('#collapse').onclick = function(){ setOpen(false); };
  $('#scrim').onclick = function(){ setOpen(false); };
  document.querySelectorAll('[data-open]').forEach(function(b){ b.onclick = function(){
    var opening = shell.classList.contains('collapsed'); setOpen(opening);
    if (opening) { track('darshan_rail_open', { from: b.dataset.open }); var g = document.getElementById('g-' + b.dataset.open); if (g) setTimeout(function(){ g.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 140); }
  }; });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && phone.matches && !shell.classList.contains('collapsed')) setOpen(false); });

  // ── catalog ──
  var ALL = [], VIEW = [], shown = 0, PAGE = 24;
  var state = { deity: [], couple: [], bhava: [], shape: [], hue: null };
  var SRCH = null;   // { q, strong: [ids], related: [ids] } while a search is active
  var SID = (function(){ try { var v = localStorage.getItem('darshan.sid'); if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('darshan.sid', v); } return v; } catch (e) { return 'anon'; } })();
  function junk(t){ t = String(t || '').trim(); return t.length < 4 || /^mj\s/i.test(t) || /^(wallpaper( post)?|untitled|image|post|upload)\b/i.test(t) || /^[0-9a-f]{8}-/i.test(t) || /\.(jpe?g|png|webp)$/i.test(t); }
  // Same rule as lib.jsx _akPreviewUrl: originals/ have a watermarked preview; legacy content/ keys are served as-is.
  function src(it){ return keySrc(it.fileKey); }
  var VIDEO = /\.(mp4|mov|m4v|webm)$/i;
  function keySrc(key){ var k = String(key || '').replace(/^\//, ''); return /^originals\//.test(k) ? '/content/previews/' + k.replace(/^originals\//, '').replace(/\.[^.]+$/, '') + '.jpg' : '/content/' + k; }
  // 480px WebP card thumbnail (scripts/darshan_thumbs.py); cards fall back to `src` if missing.
  function thumb(it){ var k = String(it.fileKey || '').replace(/^\//, ''); return '/content/previews-sm/' + k.split('/').pop().replace(/\.[^.]+$/, '') + '.webp'; }
  function orient(r){ var m = String(r || '').match(/^(\d+(?:\.\d+)?)\s*[:x]\s*(\d+(?:\.\d+)?)$/); if (!m) return 'portrait'; var w = +m[1], h = +m[2]; return Math.abs(w - h) / Math.max(w, h) < .08 ? 'square' : w > h ? 'landscape' : 'portrait'; }
  function norm(it){
    var a = PREVIEW ? (it.aiPreview || {}) : {};
    var approved = !!it.organizedAt;
    var full = !junk(it.title) ? it.title : (a.title || '');
    return { id: it.id, src: src(it), th: thumb(it), title: full.split(' — ')[0] || 'Untitled', line: full.split(' — ')[1] || '',
      caption: approved ? (it.caption || '') : '',
      deities: (it.deities && it.deities.length ? it.deities : a.deities) || [],
      couple: it.couple || a.couple || '', bhava: it.bhava || a.bhava || '',
      named: approved || !!a.title, conf: approved ? 'high' : (a.confidence || 'low'),
      orient: orient(it.ratio), colors: it.colors || [], accent: it.accentColor || '', heroFor: it.heroFor || [], free: !!it.freePreview,
      // Multi-image post: cover + slides (videos left out). "strip" = one wide
      // artwork cut into pieces; "carousel" = separate images. Missing = strip.
      slides: [it.fileKey].concat(it.slideKeys || []).filter(function(k){ return k && !VIDEO.test(k); }).map(keySrc),
      layout: it.layout === 'carousel' ? 'carousel' : 'strip' };
  }
  function normItem(it){
    var o = norm(it);
    // A joined strip is one wide artwork: shape (and the Desktop filter) follow the whole.
    if (o.slides.length > 1 && o.layout === 'strip') o.orient = 'landscape';
    return o;
  }
  var CACHE = 'darshan.v4' + (PREVIEW ? '.p' : '');
  function load(){
    try { var c = JSON.parse(sessionStorage.getItem(CACHE) || 'null'); if (c && Date.now() - c.t < 6e4) return Promise.resolve(c.items); } catch (e) {}
    var finish = function(items){
      var out = items.filter(function(i){ return !i.hiddenFromPublic && !i.archived && (i.mediaType || 'image') === 'image' && i.fileKey && ((i.slideKeys || []).length || !/ · strip /.test(i.title || '')); }).map(normItem);
      // Named, high-confidence pieces first; the rest keep newest-first order.
      out.sort(function(a, b){ return (b.named && b.conf === 'high') - (a.named && a.conf === 'high'); });
      try { sessionStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), items: out })); } catch (e) {}
      return out;
    };
    // One edge-cached file, rebuilt every 10 min by the akara-darshan-snapshot Lambda.
    return fetch('/akara/darshan/catalog.json').then(function(r){ if (!r.ok) throw 0; return r.json(); })
      .then(function(d){ return finish(d.items || []); })
      .catch(function(){ return loadApi().then(finish); });
  }
  function loadApi(){
    var all = [];
    function page(k){ return fetch('/api/catalog?type=wallpaper&limit=100' + (k ? '&lastEvaluatedKey=' + k : '')).then(function(r){ return r.json(); }).then(function(d){ all = all.concat(d.items || []); return d.lastEvaluatedKey ? page(d.lastEvaluatedKey) : all; }); }
    return page('');
  }

  // ── colour ──
  function hsl(hex){ var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null; var n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, h = 0, s = 0; if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; } return { h: h, s: s, l: l }; }
  function hueScore(it, hue){ var best = 9; (it.colors.length ? it.colors : [{ hex: it.accent, pct: 1 }]).forEach(function(c){ var x = hsl(c.hex); if (!x || x.s < .12 || x.l < .08 || x.l > .94) return; var dh = Math.abs(x.h - hue); dh = Math.min(dh, 360 - dh) / 180; var sc = dh + (1 - x.s) * .35 + (1 - Math.min(1, c.pct * 4)) * .25; if (sc < best) best = sc; }); return best; }
  var DOTS = [['Kumkum',356],['Saffron',24],['Haldi',46],['Tulsi',105],['Peacock',165],['Krishna blue',212],['Indigo',245],['Lotus pink',330]];
  function hueName(h){ return DOTS.reduce(function(best, d){ var dd = Math.min(Math.abs(d[1] - h), 360 - Math.abs(d[1] - h)); return dd < best[0] ? [dd, d[0]] : best; }, [999, ''])[1]; }

  // ── filters: "any of" inside a group, "all of" across groups ──
  function match(it){
    if (state.deity.length && !state.deity.some(function(n){ return it.deities.indexOf(n) >= 0; })) return false;
    if (state.couple.length && state.couple.indexOf(it.couple) < 0) return false;
    if (state.bhava.length && state.bhava.indexOf(it.bhava) < 0) return false;
    if (state.shape.length && state.shape.indexOf(it.orient) < 0) return false;
    return true;
  }
  function single(){
    if (SRCH) return null;
    var only = function(k){ return ['deity', 'couple', 'bhava', 'shape'].every(function(x){ return x === k ? state[x].length === 1 : state[x].length === 0; }); };
    var pick = function(list, key, val){ return list.filter(function(d){ return d[key] === val; })[0]; };
    var f = null;
    if (only('deity')) f = pick(D.deities, 'name', state.deity[0]) && Object.assign({ kind: 'deity' }, pick(D.deities, 'name', state.deity[0]));
    else if (only('couple')) f = pick(D.couples, 'slug', state.couple[0]) && Object.assign({ kind: 'couple' }, pick(D.couples, 'slug', state.couple[0]));
    else if (only('bhava')) f = pick(D.bhavas, 'slug', state.bhava[0]) && Object.assign({ kind: 'bhava' }, pick(D.bhavas, 'slug', state.bhava[0]));
    return f || null;
  }
  function syncUrl(){
    var f = single(), none = state.deity.length + state.couple.length + state.bhava.length + state.shape.length === 0;
    var want = f ? BASE + '/' + f.slug : (none ? BASE : null);
    if (SRCH) { history.replaceState(null, '', BASE + '?q=' + encodeURIComponent(SRCH.q) + (PREVIEW ? '&preview=1' : '')); document.title = '“' + SRCH.q + '” · Darśana · Akara'; return; }
    var keep = ['preview', 'theme'].filter(function(k){ return Q.get(k); }).map(function(k){ return k + '=' + Q.get(k); }).join('&');
    if (want && want !== location.pathname.replace(/\.html$/, '')) history.replaceState(null, '', want + (keep ? '?' + keep : ''));
    document.title = f ? f.title + ' · Darśana · Akara' : 'Darśana · Akara — devotional art by deity, mood and colour';
  }
  var RELATED = [];
  function apply(){
    if (SRCH) {
      var byId = {}; ALL.forEach(function(it){ byId[it.id] = it; });
      VIEW = SRCH.strong.map(function(id){ return byId[id]; }).filter(function(it){ return it && match(it); });
      RELATED = SRCH.related.map(function(id){ return byId[id]; }).filter(function(it){ return it && match(it); });
    } else { VIEW = ALL.filter(match); RELATED = []; }
    if (state.hue != null) VIEW = VIEW.map(function(it){ return [hueScore(it, state.hue), it]; }).filter(function(p){ return p[0] < .55; }).sort(function(a, b){ return a[0] - b[0]; }).map(function(p){ return p[1]; });
    renderHeader(); renderChips(); renderGrid(true); renderCounts(); renderRelated(); renderExtras(); syncUrl();
  }
  function toggle(key, val){ var a = state[key], i = a.indexOf(val); if (i >= 0) a.splice(i, 1); else a.push(val); track('darshan_filter', { group: key, value: val, on: i < 0 }); apply(); syncRail(); }

  // ── rail ──
  var DEV_SHOW = 8;
  function renderRail(){
    var count = function(f){ return ALL.filter(f).length; };
    var deities = D.deities.map(function(d){ return { d: d, n: count(function(it){ return it.deities.indexOf(d.name) >= 0; }) }; }).filter(function(x){ return x.n; }).sort(function(a, b){ return b.n - a.n; });
    var thumb = function(name){ var it = ALL.filter(function(x){ return x.deities[0] === name; })[0]; return it ? it.th : ''; };
    var h = '<div class="grp" id="g-deity"><h3>Devatā <span>deity</span></h3>' + (deities.length ? deities.map(function(x, i){
      return '<button class="opt" data-k="deity" data-v="' + esc(x.d.name) + '"' + (i >= DEV_SHOW ? ' data-extra hidden' : '') + '><span class="th" style="background-image:url(' + thumb(x.d.name) + ')"></span><span class="nm">' + esc(x.d.title) + '<small>' + esc(x.d.sa) + '</small></span><span class="ct">' + x.n + '</span><span class="ck"></span></button>';
    }).join('') : '<p class="me">Deity tags are being reviewed and will appear here soon.</p>') + (deities.length > DEV_SHOW ? '<button class="opt more" id="devmore">Show all ' + deities.length + '</button>' : '') + '</div>';
    var couples = D.couples.map(function(c){ return [c, count(function(it){ return it.couple === c.slug; })]; }).filter(function(x){ return x[1]; });
    if (couples.length) h += '<div class="grp"><h3>Yugala <span>couples</span></h3>' + couples.map(function(x){ return '<button class="opt" data-k="couple" data-v="' + x[0].slug + '"><span class="nm">' + esc(x[0].title) + '<small>' + esc(x[0].sa) + '</small></span><span class="ct">' + x[1] + '</span><span class="ck"></span></button>'; }).join('') + '</div>';
    h += '<div class="grp" id="g-bhava"><h3>Bhāva <span>mood</span></h3><div class="seg">' + D.bhavas.map(function(b){ return '<button data-k="bhava" data-v="' + b.slug + '">' + esc(b.en) + '<small>' + esc(b.sa) + '</small></button>'; }).join('') + '</div></div>';
    h += '<div class="grp" id="g-colour"><h3>Varṇa <span>colour</span></h3><div class="wheel"><div class="dial" id="dial" role="slider" aria-label="Colour" tabindex="0"><canvas></canvas><span class="hub"></span><span class="knob"></span></div><p><b id="hueName">Every colour</b>Turn the wheel, or tap a colour below.</p></div><div class="dots">' +
      DOTS.map(function(d){ return '<button data-hue="' + d[1] + '" aria-label="' + d[0] + '" title="' + d[0] + '" style="background:hsl(' + d[1] + ',58%,48%)"></button>'; }).join('') + '</div><button class="clear" id="clearHue" hidden>Clear colour</button></div>';
    h += '<div class="grp" id="g-shape"><h3>Ākāra <span>shape</span></h3><div class="seg"><button data-k="shape" data-v="portrait">Phone</button><button data-k="shape" data-v="landscape">Desktop</button><button data-k="shape" data-v="square">Square</button></div></div>';
    h += '<div class="grp"><h3>Editions <span>special</span></h3>' + D.editions.map(function(e){ return '<a class="ed" href="' + e.href + '" data-track="darshan_edition"><img src="' + e.img + '" alt="" loading="lazy"><span>' + esc(e.name) + '<small>' + esc(e.note) + '</small></span></a>'; }).join('') + '</div>';
    h += '<button class="clear" id="clearAll">Clear all filters</button>';
    $('#groups').innerHTML = h;
    document.querySelectorAll('#groups [data-k]').forEach(function(b){ b.onclick = function(){ toggle(b.dataset.k, b.dataset.v); }; });
    var dm = $('#devmore'); if (dm) dm.onclick = function(){ document.querySelectorAll('[data-extra]').forEach(function(x){ x.hidden = false; }); dm.remove(); };
    document.querySelectorAll('.dots button').forEach(function(b){ b.onclick = function(){ pickHue(+b.dataset.hue, 'dot'); }; });
    $('#clearHue').onclick = clearHue;
    $('#clearAll').onclick = function(){ state = { deity: [], couple: [], bhava: [], shape: [], hue: null }; clearHueUi(); apply(); syncRail(); };
    mountDial(); syncRail();
  }
  function clearHueUi(){ var d = $('#dial'); if (d) d.classList.remove('on'); var n = $('#hueName'); if (n) n.textContent = 'Every colour'; }
  function clearHue(){ state.hue = null; clearHueUi(); apply(); syncRail(); }
  function syncRail(){
    document.querySelectorAll('#groups [data-k]').forEach(function(b){ b.setAttribute('aria-pressed', state[b.dataset.k].indexOf(b.dataset.v) >= 0); });
    document.querySelectorAll('.dots button').forEach(function(b){ b.setAttribute('aria-pressed', state.hue != null && Math.abs(+b.dataset.hue - state.hue) < 1); });
    var ch = $('#clearHue'); if (ch) ch.hidden = state.hue == null;
    var n = { deity: state.deity.length + state.couple.length, bhava: state.bhava.length, colour: state.hue != null ? 1 : 0, shape: state.shape.length };
    document.querySelectorAll('.strip .dot').forEach(function(b){ b.dataset.n = n[b.dataset.open] || 0; });
  }
  function pickHue(h, how){
    state.hue = h; var dial = $('#dial'), R = 56, r = R - 12, k = dial.querySelector('.knob');
    k.style.left = (R + Math.sin(h * Math.PI / 180) * r) + 'px'; k.style.top = (R - Math.cos(h * Math.PI / 180) * r) + 'px'; k.style.background = 'hsl(' + h + ',58%,48%)';
    dial.classList.add('on'); $('#hueName').textContent = hueName(h);
    apply(); syncRail();
    if (how) track('darshan_colour', { hue: Math.round(h), name: hueName(h), how: how, results: VIEW.length });
  }
  function mountDial(){
    var dial = $('#dial'), cv = dial.querySelector('canvas'), S = 112, dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = S * dpr; cv.height = S * dpr; var c = cv.getContext('2d'); c.scale(dpr, dpr);
    for (var a = 0; a < 360; a++) { c.beginPath(); c.moveTo(S / 2, S / 2); c.arc(S / 2, S / 2, S / 2, (a - 90.7) * Math.PI / 180, (a - 89.3) * Math.PI / 180); c.closePath(); c.fillStyle = 'hsl(' + a + ',58%,50%)'; c.fill(); }
    var drag = false, t, last = null;
    function at(e){ var r = dial.getBoundingClientRect(); return (Math.atan2(e.clientY - r.top - S / 2, e.clientX - r.left - S / 2) * 180 / Math.PI + 90 + 360) % 360; }
    dial.addEventListener('pointerdown', function(e){ drag = true; dial.setPointerCapture(e.pointerId); last = at(e); pickHue(last); });
    dial.addEventListener('pointermove', function(e){ if (!drag) return; last = at(e); clearTimeout(t); t = setTimeout(function(){ pickHue(last); }, 60); });
    dial.addEventListener('pointerup', function(){ if (drag && last != null) track('darshan_colour', { hue: Math.round(last), name: hueName(last), how: 'wheel', results: VIEW.length }); drag = false; });
    dial.addEventListener('keydown', function(e){ if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); pickHue(((state.hue || 0) + 10) % 360); } if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); pickHue(((state.hue || 0) + 350) % 360); } });
  }

  // ── header: giant gold-leaf word + jharokha arch ──
  var ARCH = 'M0,1 L0,.40 C0,.20 .26,.13 .36,.07 C.43,.03 .47,.02 .5,0 C.53,.02 .57,.03 .64,.07 C.74,.13 1,.20 1,.40 L1,1 Z';
  // The picture is masked to the arch (CSS) and anchored near its top, where faces sit.
  function archHTML(img){
    return '<img class="arch-img" src="' + img + '" alt="" style="object-position:50% 14%">' +
      '<svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"><path d="' + ARCH + '" fill="none" stroke="var(--gold)" stroke-width="1.2" vector-effect="non-scaling-stroke" opacity=".9"/><path d="M.5,-.045 C.47,-.02 .47,0 .5,.012 C.53,0 .53,-.02 .5,-.045 Z" fill="var(--gold)"/></svg>';
  }
  function mandala(){
    var p = '', s = '', i;
    for (i = 0; i < 24; i++) p += '<ellipse cx="500" cy="230" rx="38" ry="120" transform="rotate(' + (i * 15) + ' 500 500)"/>';
    for (i = 0; i < 48; i++) s += '<circle cx="500" cy="70" r="16" transform="rotate(' + (i * 7.5) + ' 500 500)"/>';
    return '<svg class="mandala" viewBox="0 0 1000 1000" aria-hidden="true"><g fill="var(--tint)">' + s + '</g><g fill="var(--tint)">' + p + '</g><circle cx="500" cy="500" r="240" fill="var(--tint)"/></svg>';
  }
  // The display font has no capital Ś; draw our own accent over a plain S.
  function bigWord(t){ return esc(t).replace(/Ś/g, '<span class="ac">S</span>'); }
  function dayPick(pool){ var d = new Date(), k = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate(); return pool.length ? pool[k % pool.length] : null; }
  function heroFor(f){
    var pin = f && ALL.filter(function(it){ return it.heroFor.indexOf(f.slug) >= 0; })[0]; if (pin) return pin;
    var pool = (f ? VIEW : ALL).filter(function(it){ return it.named && it.conf === 'high' && it.orient === 'portrait'; });
    if (!pool.length) pool = (f ? VIEW : ALL).filter(function(it){ return it.orient === 'portrait'; });
    return f ? (pool[0] || VIEW[0]) : (dayPick(pool) || ALL[0]);
  }
  var LOTUS = '<div class="lotus" aria-hidden="true"><svg viewBox="0 0 120 28" fill="currentColor"><path d="M60 2c4 6 4 13 0 20-4-7-4-14 0-20z" opacity=".9"/><path d="M60 22c-6-1-11-5-13-12 6 1 11 5 13 12zM60 22c6-1 11-5 13-12-6 1-11 5-13 12z" opacity=".55"/><rect x="4" y="21" width="36" height="1" opacity=".4"/><rect x="80" y="21" width="36" height="1" opacity=".4"/></svg></div>';
  // Divider under the kicker (line · lotus · line) and two dotted rails beside the word.
  var ORN = '<div class="orn" aria-hidden="true"><svg viewBox="0 0 360 20" fill="none" stroke="currentColor" stroke-width="1"><path d="M0 12h150M210 12h150" opacity=".55"/><path d="M180 3c3 4 3 9 0 13-3-4-3-9 0-13zM180 16c-5-1-9-4-11-9 5 1 9 4 11 9zM180 16c5-1 9-4 11-9-5 1-9 4-11 9zM180 16c-8 0-13-2-17-6M180 16c8 0 13-2 17-6"/></svg></div>';
  var RAIL = '<svg viewBox="0 0 16 220" fill="none" stroke="currentColor" stroke-width="1"><path d="M8 0v84M8 136v84" opacity=".5"/><circle cx="8" cy="4" r="1.6" fill="currentColor"/><circle cx="8" cy="216" r="1.6" fill="currentColor"/><path d="M8 96l6 14-6 14-6-14z"/><path d="M8 103l3 7-3 7-3-7z" fill="currentColor" opacity=".6"/></svg>';
  var RAILS = '<span class="orn-rail l" aria-hidden="true">' + RAIL + '</span><span class="orn-rail r" aria-hidden="true">' + RAIL + '</span>';
  var HERO = null;
  function renderHeader(){
    var f = single(), hero = SRCH ? (VIEW[0] || null) : heroFor(f), kind = f && { deity: 'Devatā', couple: 'Yugala', bhava: 'Bhāva' }[f.kind], h;
    if (SRCH) h = mandala() + '<div class="kick">Darśana <i>·</i> Search</div><h1 class="word' + (SRCH.q.length > 14 ? ' long' : '') + '">' + esc(SRCH.q.replace(/\b\w/g, function(c){ return c.toUpperCase(); })) + '</h1><p class="lede">' + (VIEW.length ? VIEW.length + (VIEW.length === 1 ? ' darśana' : ' darśanas') + ' for your search' + (RELATED.length ? ', and ' + RELATED.length + ' related' : '') + '.' : 'No close match yet. We keep a note of every search, so the art you look for can be made.') + '</p>';
    else if (f) h = mandala() + '<div class="kick">Darśana <i>·</i> ' + kind + '</div><h1 class="word">' + bigWord(f.title) + '</h1><div class="sa-big">' + esc(f.sa) + (f.en ? ' · ' + esc(f.en) : '') + '</div>' + (f.dek ? '<p class="lede">' + esc(f.dek) + '</p>' : '');
    else h = mandala() + '<div class="kick">Akara <i>दर्शन</i></div><h1 class="word">Darśana</h1><p class="lede">A quiet room of sacred art. Choose a devatā, a mood or a colour, and let the image come to you.</p>';
    HERO = hero;
    if (hero) h += '<div class="arch-wrap"><img class="flank l" src="' + WASH_DIR + 'lotus-l.webp" alt="" aria-hidden="true"><img class="flank r" src="' + WASH_DIR + 'lotus-r.webp" alt="" aria-hidden="true"><button class="arch" id="archBtn" aria-label="Open ' + esc(hero.title) + '"><span class="glow"></span>' + archHTML(hero.src) + '</button><div class="arch-cap"><div class="k">' + (SRCH ? 'Closest darśana' : f ? 'Principal darśana' : "Today's darśana") + '</div><div class="t">' + esc(hero.title) + '</div>' + (hero.line ? '<div class="m">' + esc(hero.line) + '</div>' : '') + '</div></div>';
    h = h.replace('</div><h1', '</div>' + ORN + '<h1');
    $('#hdr').innerHTML = RAILS + h + LOTUS;
    var ab = $('#archBtn'); if (ab) ab.onclick = function(){ openViewer(HERO, [HERO].concat(VIEW.filter(function(x){ return x !== HERO; }))); };
  }
  function renderChips(){
    var c = [];
    state.deity.forEach(function(n){ var d = D.deities.filter(function(x){ return x.name === n; })[0]; c.push(['deity', n, d ? d.title : n]); });
    state.couple.forEach(function(s){ var d = D.couples.filter(function(x){ return x.slug === s; })[0]; c.push(['couple', s, d ? d.title : s]); });
    state.bhava.forEach(function(s){ var d = D.bhavas.filter(function(x){ return x.slug === s; })[0]; c.push(['bhava', s, d ? d.en : s]); });
    state.shape.forEach(function(s){ c.push(['shape', s, { portrait: 'Phone', landscape: 'Desktop', square: 'Square' }[s]]); });
    if (state.hue != null) c.push(['hue', '', hueName(state.hue)]);
    if (SRCH) c.unshift(['q', '', '“' + SRCH.q + '”']);
    $('#chips').innerHTML = c.map(function(x){ return '<button class="chip" data-k="' + x[0] + '" data-v="' + esc(x[1]) + '">' + esc(x[2]) + '<i aria-hidden="true">✕</i></button>'; }).join('');
    document.querySelectorAll('#chips .chip').forEach(function(b){ b.onclick = function(){ if (b.dataset.k === 'q') clearSearch(); else if (b.dataset.k === 'hue') clearHue(); else toggle(b.dataset.k, b.dataset.v); }; });
  }
  function renderCounts(){
    var f = single();
    if (SRCH) { $('#rtitle').innerHTML = 'Best <em>matches</em>'; $('#rcount').textContent = VIEW.length + ' of ' + ALL.length + ' works'; return; }
    $('#rtitle').innerHTML = f ? 'All of <em>' + esc(f.title) + '</em>' : (VIEW.length === ALL.length ? 'All <em>darśanas</em>' : 'Your <em>darśana</em>');
    $('#rcount').textContent = VIEW.length + ' of ' + ALL.length + ' works';
  }
  var io = STILL ? null : ('IntersectionObserver' in window ? new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -5% 0px' }) : null);
  function renderGrid(reset){
    var g = $('#grid'); if (reset) { g.innerHTML = ''; shown = 0; }
    var next = VIEW.slice(shown, shown + PAGE), wrap = document.createElement('div');
    wrap.innerHTML = next.map(function(it, k){ return cardHTML(it, shown + k, 'v'); }).join('');
    [].slice.call(wrap.children).forEach(function(el, k){ el.style.transitionDelay = (k % 8) * 70 + 'ms'; g.appendChild(el); if (io) io.observe(el); else el.classList.add('in'); });
    shown += next.length; $('#more').hidden = shown >= VIEW.length; $('#empty').hidden = VIEW.length > 0 || !!SRCH;
  }
  function cardHTML(it, i, list){
      var b = D.bhavas.filter(function(x){ return x.slug === it.bhava; })[0];
      return '<a class="card" href="' + location.pathname + '?a=' + it.id + '" data-i="' + i + '" data-l="' + list + '"><div class="ph' + (it.slides.length > 1 && it.layout === 'strip' ? ' strips' : '') + '">' + cardArt(it) + (it.orient !== 'portrait' ? '<span class="tag">' + (it.orient === 'landscape' ? 'Desktop' : 'Square') + '</span>' : '') + '</div><div class="ti">' + esc(it.title) + '</div><div class="me">' + esc([it.deities.join(' · '), b && b.en].filter(Boolean).join(' · ')) + '</div></a>';
  }
  // Strip: the pieces side by side (they read as the panorama). Carousel: the
  // cover with a "1 / N" mark. Same rule as the main site (lib.jsx AkSlideTile).
  function cardArt(it){
    var one = '<img loading="lazy" decoding="async" src="' + it.th + '" data-full="' + it.src + '" onerror="if(this.dataset.full&&this.src.indexOf(this.dataset.full)<0)this.src=this.dataset.full" alt="' + esc(it.title) + '">';
    if (it.slides.length < 2) return one;
    if (it.layout === 'carousel') return one + '<span class="many" aria-label="' + it.slides.length + ' images">1 / ' + it.slides.length + '</span>';
    return it.slides.map(function(u, k){ return k ? '<img loading="lazy" decoding="async" src="' + u + '" alt="">' : one; }).join('');
  }
  function renderRelated(){
    var box = $('#related');
    if (!SRCH || !RELATED.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="res-h rel"><h2>Also <em>related</em></h2><span class="n">' + RELATED.length + ' works</span></div><div class="grid">' + RELATED.map(function(it, i){ return cardHTML(it, i, 'r'); }).join('') + '</div>';
    box.querySelectorAll('.card').forEach(function(el){ if (io) io.observe(el); else el.classList.add('in'); });
  }
  $('#more').onclick = function(){ renderGrid(false); track('darshan_more', { shown: shown }); };
  document.addEventListener('click', function(e){ var c = e.target.closest && e.target.closest('.card[data-l]'); if (!c) return; e.preventDefault(); var L = c.dataset.l === 'r' ? RELATED : VIEW; openViewer(L[+c.dataset.i], L); });

  // ── ślokas, forms and shop after the grid (single deity/couple only) ──
  function corner(cls){ return '<svg class="c ' + cls + '" viewBox="0 0 46 46" fill="currentColor" aria-hidden="true"><path d="M2 2h20c-2 6-6 9-12 10 0 5-3 8-8 9z" opacity=".55"/><path d="M2 2c10 2 16 8 18 18-6-2-10-6-12-12C6 7 4 4 2 2z" opacity=".35"/></svg>'; }
  function renderExtras(){
    var f = single(), box = $('#extras'), h = '';
    var verses = f && f.shlokas ? f.shlokas.map(function(s){ if (typeof s !== 'string') return s; var p = s.split(':'), d = D.deities.filter(function(x){ return x.slug === p[0]; })[0]; return d && d.shlokas[+p[1]]; }).filter(Boolean) : [];
    if (verses.length) h += LOTUS + '<div class="res-h" style="justify-content:center;text-align:center"><h2><em>Ślokas</em></h2></div>' + verses.map(function(s, k){ return '<div class="sl" style="margin-bottom:18px">' + corner('tl') + corner('tr') + corner('bl') + corner('br') + '<div class="dev" lang="sa">' + esc(s.dev) + '</div><div class="ia">' + esc(s.iast) + '</div><div class="en">' + esc(s.en) + '</div><div class="src"><span>' + esc(s.src) + '</span><button data-k="' + k + '">Copy</button></div></div>'; }).join('');
    var forms = (f && f.forms) || [];
    if (forms.length) h += '<div class="res-h"><h2>The <em>forms</em></h2><span class="n">Each has its own page</span></div><div class="wear">' + forms.map(function(e){ return '<a href="' + e.href + '" data-track="darshan_form"><div class="ph"><img loading="lazy" src="' + e.img + '" alt=""></div><div class="ti">' + esc(e.name) + '</div><div class="me">' + esc(e.note) + '</div></a>'; }).join('') + '</div>';
    var shop = (f && (window.DARSHAN_SHOP || {})[f.slug]) || [];
    if (shop.length) h += '<div class="res-h"><h2>Wear <em>' + esc(f.title) + '</em></h2><a class="n" href="/shop">The shop →</a></div><div class="wear">' + shop.map(function(p){ return '<a href="' + esc(p.url) + '" data-track="darshan_shop"><div class="ph"><img loading="lazy" src="' + esc(p.img) + '&width=600" alt=""></div><div class="ti">' + esc(p.title.split(' — ')[0]) + '</div><div class="me">' + esc(p.title.split(' — ')[1] || '') + '</div></a>'; }).join('') + '</div>';
    box.innerHTML = h;
    box.querySelectorAll('.sl .src button').forEach(function(b){ b.onclick = function(){ var v = verses[+b.dataset.k], txt = v.dev + '\n\n' + v.iast + '\n\n' + v.en + '\n— ' + v.src + '\nakara.studio' + location.pathname; (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function(){ toast('Śloka copied'); }, function(){ prompt('Copy', txt); }); track('shloka_copy', { facet: f.slug, index: +b.dataset.k }); }; });
  }

  // ── viewer: sheet from the bottom on phone, centred panel on desktop ──
  var vw = $('#vw'), cur = null, list = [];
  function openViewer(it, from){
    if (!it) return; list = from || VIEW; cur = it; paintViewer();
    vw.classList.add('on'); vw.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
    track('darshan_open', { item_id: it.id });
    searchEvent(it, 'open');
  }
  function searchEvent(it, type){
    if (!SRCH) return;
    try { fetch('/api/darshan/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid: SID, q: SRCH.q, id: it.id, type: type }), keepalive: true }); } catch (e) {}
  }
  function closeViewer(){ vw.classList.remove('on'); vw.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; history.replaceState(null, '', location.pathname + (PREVIEW ? '?preview=1' : '')); }
  function step(d){ var i = list.indexOf(cur); if (i < 0 || list.length < 2) return; cur = list[(i + d + list.length) % list.length]; paintViewer(); }
  vw.querySelector('.bd').onclick = closeViewer;
  vw.querySelector('.x').onclick = closeViewer;
  vw.querySelector('.nav.p').onclick = function(){ step(-1); };
  vw.querySelector('.nav.n').onclick = function(){ step(1); };
  document.addEventListener('keydown', function(e){ if (!vw.classList.contains('on')) return; if (e.key === 'Escape') closeViewer(); if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); });
  (function(){ // swipe down to close (phone), sideways to step
    var sh = vw.querySelector('.sheet'), y0 = null, x0 = null;
    sh.addEventListener('touchstart', function(e){ if (sh.scrollTop > 0) { y0 = null; return; } y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; }, { passive: true });
    sh.addEventListener('touchend', function(e){ if (y0 == null) return; var dy = e.changedTouches[0].clientY - y0, dx = e.changedTouches[0].clientX - x0; y0 = null; if (dy > 90 && Math.abs(dx) < 60) closeViewer(); else if (Math.abs(dx) > 70 && Math.abs(dy) < 50) step(dx < 0 ? 1 : -1); }, { passive: true });
  })();
  function shopFor(it){ var S = window.DARSHAN_SHOP || {}, keys = [it.couple].concat(it.deities.map(function(n){ var f = D.deities.filter(function(x){ return x.name === n; })[0]; return f && f.slug; })); for (var i = 0; i < keys.length; i++) if (keys[i] && S[keys[i]]) return S[keys[i]][0]; return null; }
  function paintViewer(){
    var it = cur, img = vw.querySelector('.pic > img');
    img.src = it.src; img.alt = it.title;
    paintSlides(it);
    if (it.slides.length < 2) cleanCopy(it, img);
    var u = auth.current(), b = D.bhavas.filter(function(x){ return x.slug === it.bhava; })[0], c = D.couples.filter(function(x){ return x.slug === it.couple; })[0], pr = shopFor(it);
    var links = it.deities.map(function(n){ var f = D.deities.filter(function(x){ return x.name === n; })[0]; return f ? '<a href="' + BASE + '/' + f.slug + '">' + esc(f.title) + '</a>' : esc(n); }).join(', ');
    var share = location.origin + location.pathname + '?a=' + it.id;
    vw.querySelector('.side').innerHTML = '<div class="k">Darśana</div><h3>' + esc(it.title) + '</h3>' + (it.line ? '<div class="line">' + esc(it.line) + '</div>' : '') + (it.caption ? '<p class="cap">' + esc(it.caption) + '</p>' : '') +
      '<dl>' + (links ? '<dt>Devatā</dt><dd>' + links + '</dd>' : '') + (c ? '<dt>Yugala</dt><dd><a href="' + BASE + '/' + c.slug + '">' + esc(c.title) + '</a></dd>' : '') + (b ? '<dt>Bhāva</dt><dd><a href="' + BASE + '/' + b.slug + '">' + esc(b.en) + '</a> · ' + esc(b.sa) + '</dd>' : '') +
      (it.colors.length ? '<dt>Varṇa</dt><dd class="sw">' + it.colors.slice(0, 5).map(function(x){ return '<i style="background:' + x.hex + '"></i>'; }).join('') + '</dd>' : '') +
      '<dt>Shape</dt><dd>' + { portrait: 'Phone', landscape: 'Desktop', square: 'Square' }[it.orient] + '</dd></dl>' +
      '<button class="dl" id="dlb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg><span>' + (!u ? 'Sign in to download' : it.slides.length < 2 ? 'Download full size' : it.layout === 'strip' ? 'Download the full image' : 'Download all ' + it.slides.length + ' images') + '</span></button>' +
      '<p class="note">' + (u ? 'Free, for personal use. Each download carries an invisible mark tied to your account.' : 'Free with an Akara account — full size, no watermark.') + '</p>' +
      (pr ? '<a class="shop" href="' + esc(pr.url) + '" data-track="darshan_shop">In the shop<b>' + esc(pr.title.split(' — ')[0]) + ' →</b></a>' : '') +
      '<div class="share"><a target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(it.title + ' — ' + share) + '">WhatsApp</a><a target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?url=' + encodeURIComponent(share) + '&text=' + encodeURIComponent(it.title + ' — @Akara__1') + '">X</a><button id="cpl">Copy link</button></div>';
    $('#dlb').onclick = function(){ if (auth.current()) download(it, this); else auth.signIn(); };
    $('#cpl').onclick = function(){ (navigator.clipboard ? navigator.clipboard.writeText(share) : Promise.reject()).then(function(){ toast('Link copied'); }, function(){ prompt('Copy this link', share); }); track('share', { method: 'copy_link', content_type: 'darshan' }); };
    history.replaceState(null, '', location.pathname + '?a=' + it.id + (PREVIEW ? '&preview=1' : ''));
  }
  // Signed in: swap the watermarked preview for a clean 1600px copy that carries
  // this person's invisible mark (same mark as their download).
  var CLEAN = {};
  function cleanCopy(it, img, part){
    var u = auth.current(); if (!u || !img) return;
    part = part || 0;
    var ck = it.id + '#' + part;
    var show = function(url){ var pre = new Image(); pre.onload = function(){ if (cur === it) { img.src = url; vw.classList.add('clean'); } }; pre.src = url; };
    if (!part) vw.classList.remove('clean');
    if (CLEAN[ck]) return show(CLEAN[ck]);
    fetch('/api/darshan/download', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + u.idToken }, body: JSON.stringify({ id: it.id, size: 'display', part: part }) })
      .then(function(r){ return r.ok ? r.json() : null; }).then(function(d){ if (d && d.url) { CLEAN[ck] = d.url; show(d.url); } }).catch(function(){});
  }

  // ── multi-image posts in the viewer ──
  // strip    → Strips (pieces with gaps) · Swipe · Full (joined, no gaps)
  // carousel → Swipe only. Same rule as the main site (lib.jsx AkSlideViewer).
  var MS = { id: null, mode: 'strips', i: 0 };
  function paintSlides(it){
    var pic = vw.querySelector('.pic'), box = pic.querySelector('.ms');
    if (it.slides.length < 2) { pic.classList.remove('multi'); if (box) box.remove(); return; }
    if (MS.id !== it.id) MS = { id: it.id, mode: it.layout === 'strip' ? 'strips' : 'swipe', i: 0 };
    pic.classList.add('multi');
    if (!box) { box = document.createElement('div'); box.className = 'ms'; pic.appendChild(box); }
    var n = it.slides.length, modes = it.layout === 'strip' ? ['strips', 'swipe', 'full'] : ['swipe'];
    var names = { strips: 'Strips', swipe: 'Swipe', full: 'Full' };
    var h = '';
    if (modes.length > 1) h += '<div class="ms-modes" role="group" aria-label="How to show this artwork">' + modes.map(function(m){ return '<button data-m="' + m + '" aria-pressed="' + (MS.mode === m) + '">' + names[m] + '</button>'; }).join('') + '</div>';
    if (MS.mode === 'swipe') {
      h += '<div class="ms-sw"><div class="ms-track" style="transform:translate3d(' + (-MS.i * 100) + '%,0,0)">' + it.slides.map(function(u, k){ return '<div class="ms-s"><img src="' + u + '" alt="' + esc(k ? it.title + ', ' + (k + 1) + ' of ' + n : it.title) + '" draggable="false"></div>'; }).join('') + '</div></div>' +
        '<div class="ms-ctl"><button class="ms-a" data-d="-1" aria-label="Previous image"' + (MS.i === 0 ? ' disabled' : '') + '>‹</button><span class="ms-dots">' + it.slides.map(function(_, k){ return '<button data-k="' + k + '" aria-label="Image ' + (k + 1) + ' of ' + n + '" aria-current="' + (k === MS.i) + '"></button>'; }).join('') + '</span><button class="ms-a" data-d="1" aria-label="Next image"' + (MS.i === n - 1 ? ' disabled' : '') + '>›</button></div>';
    } else {
      h += '<div class="ms-row' + (MS.mode === 'full' ? ' joined' : '') + '">' + it.slides.map(function(u, k){ return '<div class="ms-p"><img src="' + u + '" alt="' + (k ? '' : esc(it.title)) + '" draggable="false"></div>'; }).join('') + '</div>';
    }
    box.innerHTML = h;
    // Each piece's width follows its real aspect ratio, so all share one
    // height and "Full" joins them with no seam.
    var row = box.querySelector('.ms-row');
    if (row) {
      var ims = row.querySelectorAll('img'), left = ims.length;
      var fitRow = function(){
        var rs = [].map.call(ims, function(im){ return im.naturalWidth ? im.naturalWidth / im.naturalHeight : 0.8; });
        var sum = rs.reduce(function(a, b){ return a + b; }, 0), gap = row.classList.contains('joined') ? 0 : 6 * (rs.length - 1);
        var H = Math.min(parseFloat(getComputedStyle(row).maxHeight) || 600, (row.clientWidth - gap) / sum);
        [].forEach.call(ims, function(im, k){ im.parentNode.style.flex = '0 0 ' + (rs[k] * H) + 'px'; im.parentNode.style.height = H + 'px'; });
      };
      [].forEach.call(ims, function(im){ if (im.complete) left--; else im.onload = im.onerror = function(){ if (--left === 0) fitRow(); }; });
      fitRow();
    }
    var shown = box.querySelectorAll('.ms-s img, .ms-p img');
    if (MS.mode === 'swipe') cleanCopy(it, shown[MS.i], MS.i);
    else [].forEach.call(shown, function(im, k){ cleanCopy(it, im, k); });
    box.querySelectorAll('.ms-modes button').forEach(function(b){ b.onclick = function(){ MS.mode = b.dataset.m; MS.i = 0; paintSlides(it); track('darshan_view_mode', { item_id: it.id, mode: MS.mode }); }; });
    box.querySelectorAll('.ms-a').forEach(function(b){ b.onclick = function(){ slideTo(it, MS.i + (+b.dataset.d)); }; });
    box.querySelectorAll('.ms-dots button').forEach(function(b){ b.onclick = function(){ slideTo(it, +b.dataset.k); }; });
    var sw = box.querySelector('.ms-sw');
    if (sw) {
      // Sideways swipes move the slides; the sheet's own swipe (next artwork)
      // gets the gesture only when it is not sideways.
      var x0 = null, y0 = null, dx = 0, tr = sw.firstChild;
      sw.addEventListener('touchstart', function(e){ x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; }, { passive: true });
      sw.addEventListener('touchmove', function(e){ if (x0 == null) return; dx = e.touches[0].clientX - x0; if (Math.abs(dx) > Math.abs(e.touches[0].clientY - y0)) { tr.style.transition = 'none'; tr.style.transform = 'translate3d(calc(' + (-MS.i * 100) + '% + ' + dx + 'px),0,0)'; } }, { passive: true });
      sw.addEventListener('touchend', function(e){
        if (x0 == null) return;
        var ddx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null; tr.style.transition = '';
        if (Math.abs(ddx) <= Math.abs(dy)) return;
        e.stopPropagation();
        if (Math.abs(ddx) > sw.clientWidth * 0.18) slideTo(it, MS.i + (ddx < 0 ? 1 : -1));
        else tr.style.transform = 'translate3d(' + (-MS.i * 100) + '%,0,0)';
      });
    }
  }
  // Phone turned / window resized: re-measure the strip row.
  window.addEventListener('resize', function(){ clearTimeout(paintSlides._t); paintSlides._t = setTimeout(function(){ if (cur && vw.classList.contains('on') && cur.slides.length > 1 && MS.mode !== 'swipe') paintSlides(cur); }, 150); });
  function slideTo(it, k){
    var n = it.slides.length; k = Math.max(0, Math.min(n - 1, k)); MS.i = k;
    var box = vw.querySelector('.ms'); if (!box || !box.querySelector('.ms-track')) return;
    box.querySelector('.ms-track').style.transform = 'translate3d(' + (-k * 100) + '%,0,0)';
    box.querySelectorAll('.ms-dots button').forEach(function(b, j){ b.setAttribute('aria-current', j === k); });
    var a = box.querySelectorAll('.ms-a'); a[0].disabled = k === 0; a[1].disabled = k === n - 1;
    cleanCopy(it, box.querySelectorAll('.ms-s img')[k], k);
  }
  function download(it, btn){
    var u = auth.current(); if (!u) { auth.signIn(); return; }
    var label = btn.querySelector('span'), was = label.textContent;
    btn.disabled = true; label.textContent = 'Preparing your copy…';
    track('darshan_download_request', { item_id: it.id });
    // Strip → the full joined image. Carousel → a zip of every image. Each
    // file carries this person's invisible mark.
    var req = { id: it.id };
    if (it.slides.length > 1) { if (it.layout === 'strip') req.part = 'full'; else req.bundle = true; }
    fetch('/api/darshan/download', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + u.idToken }, body: JSON.stringify(req) })
      .then(function(r){ if (r.status === 401) throw new Error('auth'); if (!r.ok) throw new Error('fail'); return r.json(); })
      .then(function(d){ var a = document.createElement('a'); a.href = d.url; a.download = d.filename || 'akara.jpg'; document.body.appendChild(a); a.click(); a.remove(); toast('Downloading'); track('wallpaper_download_darshan', { item_id: it.id }); searchEvent(it, 'download'); })
      .catch(function(e){ if (e.message === 'auth') { toast('Please sign in again'); auth.signIn(); } else toast('Download failed — please try again'); })
      .then(function(){ btn.disabled = false; label.textContent = was; });
  }

  // ── search: instant suggestions on the phone, meaning-based search on Enter ──
  var qIn = $('#q'), sugg = $('#sugg'), qx = $('#qx'), SUG = [], selIdx = -1;
  function plainTxt(t){ return String(t || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  var ALIASES = {
    Shiva: ['shiv', 'mahadev', 'bholenath', 'shankar', 'rudra', 'शिव', 'महादेव'], Krishna: ['krishn', 'kanha', 'shyam', 'gopal', 'murlidhar', 'govinda', 'कृष्ण'],
    Hanuman: ['bajrangbali', 'bajrang', 'anjaneya', 'maruti', 'हनुमान'], Ganesha: ['ganesh', 'ganpati', 'bappa', 'vinayak', 'गणेश'], Rama: ['ram', 'raghav', 'राम'],
    Sita: ['siya', 'janaki'], Radha: ['radhe', 'राधा'], Parvati: ['gauri', 'uma'], Lakshmi: ['laxmi'], Durga: ['ambe', 'sherawali'], Kali: ['mahakali', 'kaali'],
    Vishnu: ['narayan', 'hari'], Narasimha: ['narsimha', 'narsingh'], Murugan: ['kartikeya', 'skanda'], Surya: ['sun god'] };
  function suggestions(v){
    var t = plainTxt(v).trim(); if (!t) return [];
    var out = [], hit = function(names){ return names.some(function(n){ n = plainTxt(n); return n.indexOf(t) === 0 || n.indexOf(' ' + t) >= 0; }); };
    D.deities.forEach(function(d){ if (hit([d.name, d.title, d.sa].concat(ALIASES[d.name] || [])) && ALL.some(function(it){ return it.deities.indexOf(d.name) >= 0; })) out.push({ kind: 'Devatā', label: d.title, deity: d.name }); });
    (D.stories || []).forEach(function(s){ if (hit([s.title, s.en, s.slug.replace(/-/g, ' ')].concat(s.aka))) out.push({ kind: 'Kathā', label: s.title + ' · ' + s.en, q: plainTxt(s.title) }); });
    var seen = {}; ALL.forEach(function(it){ var nm = it.title; if (nm && !seen[nm] && hit([nm])) { seen[nm] = 1; if (out.length < 12) out.push({ kind: 'Work', label: nm, q: plainTxt(nm) }); } });
    return out.slice(0, 8);
  }
  function paintSugg(){
    if (!SUG.length) { sugg.hidden = true; return; }
    sugg.innerHTML = SUG.map(function(x, i){ return '<li role="option" data-i="' + i + '" aria-selected="' + (i === selIdx) + '"><span>' + esc(x.label) + '</span><small>' + x.kind + '</small></li>'; }).join('');
    sugg.hidden = false;
  }
  qIn.addEventListener('input', function(){ qx.hidden = !qIn.value; SUG = suggestions(qIn.value); selIdx = -1; paintSugg(); });
  qIn.addEventListener('keydown', function(e){
    if (e.key === 'ArrowDown' && SUG.length) { e.preventDefault(); selIdx = (selIdx + 1) % SUG.length; paintSugg(); }
    if (e.key === 'ArrowUp' && SUG.length) { e.preventDefault(); selIdx = (selIdx - 1 + SUG.length) % SUG.length; paintSugg(); }
    if (e.key === 'Escape') { sugg.hidden = true; if (!qIn.value) closeQ(); }
  });
  sugg.addEventListener('mousedown', function(e){ var li = e.target.closest('li'); if (!li) return; e.preventDefault(); pickSugg(SUG[+li.dataset.i]); });
  function pickSugg(x){
    sugg.hidden = true; selIdx = -1; track('darshan_suggest_pick', { kind: x.kind, label: x.label });
    if (x.deity) { qIn.value = ''; qx.hidden = true; clearSearch(true); state = { deity: [x.deity], couple: [], bhava: [], shape: [], hue: null }; clearHueUi(); apply(); syncRail(); closeQ(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    qIn.value = x.q; runSearch(x.q);
  }
  $('#srch').addEventListener('submit', function(e){ e.preventDefault(); if (selIdx >= 0 && SUG[selIdx]) return pickSugg(SUG[selIdx]); runSearch(qIn.value); });
  qx.onclick = function(){ qIn.value = ''; qx.hidden = true; sugg.hidden = true; clearSearch(); qIn.focus(); };
  function closeQ(){ document.body.classList.remove('q-open'); }
  $('#qopen').onclick = function(){ document.body.classList.add('q-open'); setTimeout(function(){ qIn.focus(); }, 60); };
  document.addEventListener('click', function(e){ if (!e.target.closest('#srch') && !e.target.closest('#qopen')) { sugg.hidden = true; if (!qIn.value) closeQ(); } });
  function runSearch(q){
    q = String(q || '').trim(); if (q.length < 2) return;
    sugg.hidden = true; qIn.blur();
    $('#hdr').setAttribute('aria-busy', 'true');
    track('search', { search_term: q });
    return fetch('/api/darshan/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: q, sid: SID }) })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (!d.ok) throw 0;
        SRCH = { q: d.q, strong: d.strong || [], related: d.related || [] };
        state.deity = []; state.couple = []; state.bhava = [];   // a search replaces facet picks; shape + colour stay
        apply(); syncRail(); closeQ(); window.scrollTo({ top: 0, behavior: 'smooth' });
        track('search_results', { search_term: d.q, strong: SRCH.strong.length, related: SRCH.related.length });
      })
      .catch(function(){ toast('Search is resting — please try again'); })
      .then(function(){ $('#hdr').removeAttribute('aria-busy'); document.body.dataset.searched = '1'; });
  }
  function clearSearch(silent){ if (!SRCH) return; SRCH = null; if (!silent) { apply(); syncRail(); } }

  // ── boot ──
  if (PREVIEW) { var pf = document.createElement('div'); pf.className = 'preview-flag'; pf.textContent = 'Preview · unapproved AI tags'; document.querySelector('main').prepend(pf); }
  // ── background wash: ink-and-gold side panels down the whole page ──
  // Left and right panels are staggered by half a step so the two sides never mirror.
  var WASH_DIR = '/akara/darshan/wash/', WASH = [['w3l', 'w3r'], ['w1l', 'w2r'], ['w2l', 'w1r']];
  (function(){
    var m = document.querySelector('main'), w = document.createElement('div'), n = 0;
    w.className = 'wash'; w.setAttribute('aria-hidden', 'true'); m.insertBefore(w, m.firstChild);
    // Panels load only when they come near the screen, then fade in once decoded.
    function show(i){ i.onload = function(){ i.classList.add('in'); }; i.src = i.dataset.src; }
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }); }, { rootMargin: '300px 0px' }) : null;
    function add(name, side, top){ var i = new Image(); i.dataset.src = WASH_DIR + name + '.webp'; i.alt = ''; i.className = side; i.style.top = top + 'px'; w.appendChild(i); if (io) io.observe(i); else show(i); }
    function fill(){
      var cs = getComputedStyle(w), ww = parseFloat(cs.getPropertyValue('--ww')) || 400, step = ww * 1.46 * (parseFloat(cs.getPropertyValue('--wgap')) || 1.12), H = m.offsetHeight;
      while (n * step < H) { var set = WASH[n % WASH.length]; add(set[0], 'l', n * step); add(set[1], 'r', n ? n * step + step / 2 : 0); n++; }
    }
    fill(); if ('ResizeObserver' in window) new ResizeObserver(fill).observe(m);
  })();

  load().then(function(items){
    ALL = items;
    var f = SLUG && (D.deities.filter(function(x){ return x.slug === SLUG; })[0] || D.couples.filter(function(x){ return x.slug === SLUG; })[0] || D.bhavas.filter(function(x){ return x.slug === SLUG; })[0] || D.shapes.filter(function(x){ return x.slug === SLUG; })[0]);
    if (SLUG && !f) { location.replace(BASE); return; }
    if (f) {
      if (D.deities.indexOf(f) >= 0) state.deity = [f.name];
      else if (D.couples.indexOf(f) >= 0) state.couple = [f.slug];
      else if (D.bhavas.indexOf(f) >= 0) state.bhava = [f.slug];
      else state.shape = [f.test];
    }
    if (Q.get('deity')) state.deity = [Q.get('deity')];
    renderRail(); apply();
    if (Q.get('q')) { qIn.value = Q.get('q'); qx.hidden = false; runSearch(Q.get('q')); }
    var a = Q.get('a'); if (a) { var hit = ALL.filter(function(x){ return x.id === a; })[0]; if (hit) openViewer(hit, VIEW); }
    document.body.dataset.ready = '1';
  }).catch(function(){ $('#hdr').innerHTML = '<p class="empty">The gallery could not load. Please refresh.</p>'; document.body.dataset.ready = '1'; });
})();
