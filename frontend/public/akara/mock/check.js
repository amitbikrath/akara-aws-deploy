// Layout check: finds text that overlaps other text or is cut off.
// Loaded by a page when the URL has ?check=1; writes JSON into <pre id="layout-check">.
(function(){
  function visible(el){
    for (var e = el; e && e !== document.documentElement; e = e.parentElement) {
      var cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0 && !e.classList.contains('card')) return false;
      if (e.hidden) return false;
    }
    return true;
  }
  function scopeRoot(){
    var vw = document.getElementById('vw');
    if (vw && vw.classList.contains('on')) return vw.querySelector('.sheet');
    var shell = document.getElementById('shell');
    var mobile = matchMedia('(max-width:860px)').matches;
    if (mobile && shell && !shell.classList.contains('collapsed')) return document.getElementById('railIn');
    return document.body;
  }
  function skip(el){
    if (el.closest('.mock, #layout-check')) return true;
    var shell = document.getElementById('shell');
    var mobile = matchMedia('(max-width:860px)').matches;
    if (shell && shell.classList.contains('collapsed') && el.closest('.rail-in')) return true;
    if (shell && !shell.classList.contains('collapsed') && !mobile && el.closest('.strip')) return true;
    return false;
  }
  function label(el){ var t = (el.textContent || '').trim().slice(0, 40); return (el.className ? el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] : el.tagName.toLowerCase()) + ' "' + t + '"'; }
  function run(){
    var root = scopeRoot(), boxes = [], problems = [], W = window.innerWidth;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function(n){ return /\S/.test(n.nodeValue) ? 1 : 2; } });
    var n, id = 0;
    while ((n = walker.nextNode())) {
      var el = n.parentElement; if (!el || skip(el) || !visible(el)) continue;
      if (/^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) continue;
      var r = document.createRange(); r.selectNodeContents(n);
      var rects = [].slice.call(r.getClientRects()).filter(function(q){ return q.width > 0.5 && q.height > 0.5; });
      id++;
      rects.forEach(function(q){
        boxes.push({ id: id, el: el, x: q.left, y: q.top, r: q.right, b: q.bottom });
        if (q.left < -0.5 || q.right > W + 0.5) problems.push({ type: 'off-screen', what: label(el), x: Math.round(q.left), right: Math.round(q.right), width: W });
      });
      // Clipped by an ancestor that hides overflow.
      for (var a = el; a && a !== document.body; a = a.parentElement) {
        var cs = getComputedStyle(a);
        var ox = cs.overflowX, oy = cs.overflowY;
        if (ox === 'visible' && oy === 'visible') continue;
        var ar = a.getBoundingClientRect();
        rects.forEach(function(q){
          var cutX = (ox !== 'visible') && (q.left < ar.left - 0.5 || q.right > ar.right + 0.5);
          var cutY = (oy === 'hidden' || oy === 'clip') && (q.top < ar.top - 0.5 || q.bottom > ar.bottom + 0.5);
          if (cutX || cutY) problems.push({ type: 'clipped', what: label(el), by: label(a) });
        });
        break;
      }
      if (getComputedStyle(el).textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) problems.push({ type: 'ellipsis', what: label(el) });
    }
    // Text on text.
    for (var i = 0; i < boxes.length; i++) for (var j = i + 1; j < boxes.length; j++) {
      var A = boxes[i], B = boxes[j]; if (A.id === B.id) continue;
      var w = Math.min(A.r, B.r) - Math.max(A.x, B.x), h = Math.min(A.b, B.b) - Math.max(A.y, B.y);
      if (w > 1 && h > 1) problems.push({ type: 'overlap', a: label(A.el), b: label(B.el), area: Math.round(w * h) });
    }
    // Dedupe.
    var seen = {}, out = problems.filter(function(p){ var k = JSON.stringify(p); if (seen[k]) return false; seen[k] = 1; return true; });
    var pre = document.createElement('pre'); pre.id = 'layout-check'; pre.style.display = 'none';
    pre.textContent = JSON.stringify({ width: W, textBoxes: boxes.length, problems: out });
    document.body.appendChild(pre);
  }
  function ready(){ return document.body.dataset.ready === '1' && (!/[?&]q=/.test(location.search) || document.body.dataset.searched === '1'); }
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(function(){
    var t = setInterval(function(){ if (ready()) { clearInterval(t); setTimeout(run, 900); } }, 100);
  });
})();
