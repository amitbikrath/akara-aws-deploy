// Inlined at the top of every homepage shell (layout.tsx reads this file;
// public/akara/index.html and akara.html carry a copy — check-site.mjs keeps
// them identical). Never a separate file: it must not depend on the cache.
//
// Some browsers (seen: Chrome on iOS, 2026-10-14) revalidate a cached script,
// get a correct 304, then hand the page an EMPTY body. The script errors with
// no console message and the site never starts. This records every app script
// that fails to load and loads it again from a fresh URL (?r=…), in order.
// app.jsx waits for that before it mounts.
window.__akRescue = (function(){
  var failed = [], running = null;
  window.addEventListener('error', function(e){
    var t = e.target;
    if (t && t.tagName === 'SCRIPT' && /\/akara\/(js|vendor)\//.test(t.src || '')) failed.push(t.src);
  }, true);
  function load(src){
    return new Promise(function(done){
      var s = document.createElement('script');
      s.src = src + (src.indexOf('?') < 0 ? '?' : '&') + 'r=' + Date.now();
      s.onload = s.onerror = function(){ done(); };
      document.head.appendChild(s);
    });
  }
  function run(){
    if (running) return running;
    var list = failed.splice(0);
    running = list.reduce(function(p, src){ return p.then(function(){ return load(src); }); }, Promise.resolve());
    return running;
  }
  // app.js itself failed: nothing else will call run(), so start it here.
  document.addEventListener('DOMContentLoaded', function(){ if (failed.length) run(); });
  return { failed: failed, run: run };
})();
