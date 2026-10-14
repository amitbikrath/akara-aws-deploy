// ak-save.js — on a phone, save pictures to Photos instead of Files.
// A website cannot write to the iPhone photo library. The share sheet can:
// it has "Save Image" (or "Save N Images"), which puts the files in Photos.
// Used by /darshan (darshan.js), /vishwaroopa and /anantashayana.
//
//   akSave.ok()                         true on a touch phone that can share files
//   akSave.save(getFiles, opts) → Promise<boolean>
//     getFiles()     → Promise<[{url, name}]>   what to save
//     opts.label(t)  shows a status on the caller's button ('' = restore it)
//     opts.btn       the button to arm for a second tap if the share is refused
//   Resolves false when the caller should fall back to a normal download.
(function(){
  if (window.akSave) return;
  var coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches;
  function ok(){ return !!(coarse && navigator.share && navigator.canShare && window.File); }
  function toFile(x){
    return fetch(x.url).then(function(r){ if (!r.ok) throw new Error('fetch ' + r.status); return r.blob(); })
      .then(function(b){
        var type = /\.png$/i.test(x.name) ? 'image/png' : 'image/jpeg';
        return new File([b], x.name, { type: b.type && b.type.indexOf('image/') === 0 ? b.type : type });
      });
  }
  // Share the files. Safari only opens the sheet close to a tap, so when the
  // files took long to prepare it refuses (NotAllowedError): then the caller's
  // button becomes "Save to Photos" and the next tap opens the sheet.
  function share(files, opts){
    return navigator.share({ files: files }).then(function(){ return 'done'; }, function(e){
      if (e && e.name === 'AbortError') return 'cancel';
      if (e && e.name === 'NotAllowedError' && opts.btn) return 'arm';
      throw e;
    });
  }
  function arm(files, opts){
    var btn = opts.btn, n = files.length;
    opts.label(n > 1 ? 'Save ' + n + ' photos to Photos' : 'Save to Photos');
    btn.disabled = false; btn.setAttribute('data-ak-save', '');
    function once(e){
      e.preventDefault(); e.stopImmediatePropagation();
      btn.removeEventListener('click', once, true); btn.removeAttribute('data-ak-save');
      opts.label('');
      navigator.share({ files: files }).catch(function(){});
      if (opts.done) opts.done();
    }
    btn.addEventListener('click', once, true);
  }
  function save(getFiles, opts){
    opts = opts || {}; opts.label = opts.label || function(){};
    if (!ok()) return Promise.resolve(false);
    opts.label('Preparing your copy\u2026');
    return Promise.resolve(getFiles())
      .then(function(list){ return Promise.all(list.map(toFile)); })
      .then(function(files){
        if (!navigator.canShare({ files: files })) { opts.label(''); return false; }
        return share(files, opts).then(function(r){
          if (r === 'arm') { arm(files, opts); return true; }
          opts.label(''); if (opts.done) opts.done(); return true;
        });
      }, function(e){ opts.label(''); throw e; });
  }
  window.akSave = { ok: ok, save: save };
})();
