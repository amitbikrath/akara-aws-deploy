// Shared Lightbox — used by both the landing-page wallpapers section and the
// dedicated wallpaper gallery page. Single source of truth: edit here, both
// surfaces update.
//
// Behavior: image fills the entire viewport at its native aspect ratio
// (object-fit: contain). All chrome (counter, deity·style, close, prev/next,
// caption, dots, hint) is overlaid on top and fades in only on hover/focus.
// Touch devices keep chrome visible (no hover concept).

const { useState: lbS, useEffect: lbE, useRef: lbR, useMemo: lbM } = React;

function Lightbox({ items, index, onIndex, onClose }){
  const w = items[index];
  lbE(()=>{ if(w && window.akTrack) window.akTrack("artwork_view", { art_id:w.id, art_title:w.title, deity:w.deity }); },[w && w.id]);
  const [drag, setDrag] = lbS({ x:0, y:0, active:false });
  const startRef = lbR({ x:0, y:0, t:0 });

  // Disintegrate → embers (image-shaped) → reassemble transition.
  //
  // Inspired by ascii-studio's image→character grid technique: each image is
  // sampled into a low-res dot grid (cells of ~5–6px) where every cell stores
  // its sampled RGB plus pre-randomised drift/phase/wobble factors. The
  // transition draws those dots as glowing radial-gradient pinpoints, then
  // peels them off the canvas with staggered delays + upward drift + lateral
  // wobble + scale-down + alpha fade — embers that briefly hold the shape
  // and colour of the source image.
  //
  // Sampling is cached per item and warmed for current/prev/next whenever
  // index changes. By the time the user swipes, the dot grid + mean colour
  // for both endpoints is already in memory and the canvas animation starts
  // on the same frame as the swipe — no decode/sample lag.
  //
  // Same-origin assets (`/content/...`) so no crossOrigin/CORS dance is
  // needed. CSS lbExitFade on the prev <img> is a graceful fallback if
  // sampling ever fails (canvas stays empty, image fades).
  const directionRef = lbR(1);
  const lastIndexRef = lbR(index);
  const [prevItem, setPrevItem] = lbS(null);
  const dotCanvasRef = lbR(null);
  const rafRef = lbR(null);

  // Sample cache: itemId → { cols, rows, imgAR, dots, mean }. Bounded LRU
  // (~5 entries) so we don't blow up memory on a 100-image gallery. Dots
  // store grid coords (cx, cy) rather than pixel positions, so the same
  // sample is reusable across viewport resizes.
  const sampleCacheRef = lbR(null);
  if(sampleCacheRef.current === null) sampleCacheRef.current = new Map();

  const isCoarsePointer = ()=> (typeof window !== "undefined") &&
    (window.matchMedia ? window.matchMedia("(pointer: coarse)").matches : false);

  // Build a sample from a fully-loaded HTMLImageElement. Pure function — no
  // viewport/stage dependence so the result is cache-safe.
  const buildSample = (img)=>{
    const imgAR = img.naturalWidth / Math.max(1, img.naturalHeight);
    // Coarse pointer = mobile-class GPU. Lower grid keeps the per-frame fill
    // count manageable so the ember animation doesn't smear into a single
    // glow under load.
    const cols = isCoarsePointer() ? 90 : 160;
    const rows = Math.max(34, Math.round(cols / imgAR));
    const samp = document.createElement("canvas");
    samp.width = cols; samp.height = rows;
    const sctx = samp.getContext("2d", { willReadFrequently: true });
    sctx.drawImage(img, 0, 0, cols, rows);
    const { data } = sctx.getImageData(0, 0, cols, rows);
    const dots = [];
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    for(let cy=0; cy<rows; cy++){
      for(let cx=0; cx<cols; cx++){
        const i = (cy*cols + cx) * 4;
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        if(a < 8) continue;
        sumR += r; sumG += g; sumB += b; count++;
        const L = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
        if(L < 0.04) continue;
        // Radial outward drift — embers explode in every direction (up,
        // down, left, right) instead of only rising. Random angle on the
        // unit circle, random speed within the same range as before so the
        // overall reach is preserved.
        const angle = Math.random() * Math.PI * 2;
        const speed = 120 + Math.random() * 220;
        dots.push({
          cx, cy, r, g, b,
          phase: Math.random(),
          driftX: Math.cos(angle) * speed,
          driftY: Math.sin(angle) * speed,
          wobble: (Math.random() - 0.5) * 70,
        });
      }
    }
    const mean = count > 0
      ? { r: Math.round(sumR/count), g: Math.round(sumG/count), b: Math.round(sumB/count) }
      : { r: 220, g: 170, b: 110 };
    return { cols, rows, imgAR, dots, mean };
  };

  const ensureSample = (item, cb)=>{
    if(!item || !item.id){ cb && cb(null); return; }
    const cache = sampleCacheRef.current;
    if(cache.has(item.id)){
      // Touch LRU: move to most-recent by re-inserting.
      const existing = cache.get(item.id);
      cache.delete(item.id);
      cache.set(item.id, existing);
      cb && cb(existing);
      return;
    }
    // Prefer the thumbnail for sampling — we downscale to ~90 cols anyway,
    // so a small thumb gives identical fidelity at a fraction of the decode
    // cost, especially on mobile where decoding 4–8MB hero images can take
    // 100–300ms and steal the gesture frame budget.
    const src = item.imageUrl || item.fullUrl;
    if(!src){ cb && cb(null); return; }
    const img = new Image();
    img.decoding = "async";
    let done = false;
    const finish = ()=>{
      if(done) return; done = true;
      try{
        const sample = buildSample(img);
        cache.set(item.id, sample);
        // LRU prune to max 5 entries.
        while(cache.size > 5){
          const oldest = cache.keys().next().value;
          if(oldest === undefined) break;
          cache.delete(oldest);
        }
        cb && cb(sample);
      } catch(e){
        cb && cb(null);
      }
    };
    img.onload = finish;
    img.onerror = ()=>{ if(!done){ done = true; cb && cb(null); } };
    img.src = src;
    if(img.complete && img.naturalWidth > 0) finish();
  };

  // Prefetch: warm cache for current + neighbours whenever index changes.
  // requestIdleCallback keeps it off the critical render path.
  lbE(()=>{
    if(typeof window === "undefined" || !items.length) return;
    const ric = window.requestIdleCallback || ((fn)=> window.setTimeout(fn, 60));
    const targets = [
      items[index],
      items[(index + 1) % items.length],
      items[(index - 1 + items.length) % items.length],
    ];
    const handles = targets
      .filter(it => it && !sampleCacheRef.current.has(it.id))
      .map(it => ric(()=> ensureSample(it)));
    return ()=>{
      const cic = window.cancelIdleCallback || window.clearTimeout;
      handles.forEach(h => { try{ cic(h); } catch(_){} });
    };
  },[index, items]);

  // Trigger transition state when index changes. Cleanup tail covers the
  // longest animation (~1.6s); hold canvas until 1.75s.
  lbE(()=>{
    if(lastIndexRef.current === index) return;
    setPrevItem(items[lastIndexRef.current]);
    lastIndexRef.current = index;
    const t = setTimeout(()=>setPrevItem(null), 1750);
    return ()=>clearTimeout(t);
  },[index, items]);

  // Run the canvas animation when prevItem is set. Cache hit → starts on
  // the same frame as the swipe. Cache miss → samples now then starts (rare
  // on neighbours due to prefetch effect above).
  lbE(()=>{
    if(!prevItem) return;
    const canvas = dotCanvasRef.current;
    if(!canvas) return;

    let cancelled = false;

    // Target tint = incoming image's mean colour (for the colour migration
    // during ember flight). Defaults to a neutral warm fallback if the
    // incoming sample isn't ready yet.
    let target = { r: 220, g: 170, b: 110 };
    const incomingCached = w && sampleCacheRef.current.get(w.id);
    if(incomingCached) target = incomingCached.mean;
    else if(w) ensureSample(w, (s)=>{ if(s && !cancelled) target = s.mean; });

    // Two draw paths:
    //   Desktop (arc): rounded dots, slightly softer look. Arc requires a
    //     beginPath + path tessellation per dot but desktop GPUs handle it
    //     fine and the look reads more "ember" than "pixel".
    //   Mobile  (fillRect): square dots. fillRect is the cheapest fill
    //     primitive in Canvas2D — a single rasteriser op, no path setup,
    //     no tessellation. ~2–3× faster than arc on mobile and pairs well
    //     with the pixel/ASCII-disintegrate aesthetic.
    const isCoarse = isCoarsePointer();
    const drawDot = isCoarse
      ? (ctx, x, y, radius, d, alpha, lp)=>{
          const mix = Math.max(0, lp) * 0.55;
          const cR = (d.r * (1 - mix) + target.r * mix) | 0;
          const cG = (d.g * (1 - mix) + target.g * mix) | 0;
          const cB = (d.b * (1 - mix) + target.b * mix) | 0;
          const a0 = Math.max(0, Math.min(1, alpha));
          ctx.fillStyle = `rgba(${cR},${cG},${cB},${a0})`;
          const s = radius * 2;
          ctx.fillRect(x - radius, y - radius, s, s);
        }
      : (ctx, x, y, radius, d, alpha, lp)=>{
          const mix = Math.max(0, lp) * 0.55;
          const cR = (d.r * (1 - mix) + target.r * mix) | 0;
          const cG = (d.g * (1 - mix) + target.g * mix) | 0;
          const cB = (d.b * (1 - mix) + target.b * mix) | 0;
          const a0 = Math.max(0, Math.min(1, alpha));
          ctx.fillStyle = `rgba(${cR},${cG},${cB},${a0})`;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        };

    const startCanvasAnimation = (sample)=>{
      if(cancelled || !sample) return;
      const stage = canvas.parentElement;
      if(!stage) return;
      const W = stage.clientWidth, H = stage.clientHeight;
      if(W <= 0 || H <= 0) return;

      // Lower DPR cap on coarse-pointer devices: at DPR 3 (modern phones),
      // a full-screen canvas is ~6M pixels — filling 5000 dots per frame
      // turns into hundreds of MB/s of memory bandwidth. 1.5 is plenty for
      // the ember effect at viewing distance and cuts pixel cost ~44%.
      const dprCap = isCoarsePointer() ? 1.5 : 2;
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Compute object-fit:contain rect using the cached aspect ratio. Drift
      // origins are recomputed at draw time so the same cached sample works
      // across resizes.
      const imgAR = sample.imgAR;
      const stageAR = W / H;
      let drawW, drawH, offX, offY;
      if(imgAR > stageAR){ drawW = W; drawH = W / imgAR; offX = 0; offY = (H - drawH) / 2; }
      else { drawH = H; drawW = H * imgAR; offX = (W - drawW) / 2; offY = 0; }

      const cellW = drawW / sample.cols;
      const cellH = drawH / sample.rows;
      const cellSize = Math.max(1.5, Math.min(cellW, cellH) * 0.4);
      const dots = sample.dots;
      const t0 = performance.now();
      const dur = 1500;
      const stagger = 0.4;

      const tick = (now)=>{
        if(cancelled) return;
        const p = Math.min((now - t0) / dur, 1);
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = "lighter";
        for(let k=0; k<dots.length; k++){
          const d = dots[k];
          const baseX = offX + (d.cx + 0.5) * cellW;
          const baseY = offY + (d.cy + 0.5) * cellH;
          const ls = d.phase * stagger;
          const lp = (p - ls) / (1 - ls);
          if(lp < 0){
            drawDot(ctx, baseX, baseY, cellSize, d, 1, 0);
          } else if(lp < 1){
            const ease = 1 - Math.pow(1 - lp, 2.2);
            const wob = Math.sin(lp * Math.PI * 1.6) * d.wobble * lp;
            drawDot(
              ctx,
              baseX + d.driftX * ease + wob,
              baseY + d.driftY * ease,
              cellSize * (1 - lp * 0.42),
              d,
              1 - lp,
              lp
            );
          }
        }
        if(p < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    // Cache hit fast path — animation starts synchronously.
    const cached = sampleCacheRef.current.get(prevItem.id);
    if(cached) startCanvasAnimation(cached);
    else ensureSample(prevItem, (sample)=> startCanvasAnimation(sample));

    return ()=>{
      cancelled = true;
      if(rafRef.current){ cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      const c = canvas;
      if(c){
        const cx = c.getContext("2d");
        cx.setTransform(1, 0, 0, 1, 0, 0);
        cx.clearRect(0, 0, c.width, c.height);
      }
    };
  }, [prevItem && prevItem.id]);

  const goTo = (next)=>{
    if(next === index) return;
    directionRef.current = next > index ? 1 : -1;
    onIndex(next);
  };
  const prev = ()=>{ directionRef.current = -1; onIndex((index-1+items.length)%items.length); };
  const next = ()=>{ directionRef.current = 1; onIndex((index+1)%items.length); };

  // Lock scroll & handle keys
  lbE(()=>{
    const pB = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e)=>{
      if(e.key==="Escape") onClose();
      else if(e.key==="ArrowLeft") prev();
      else if(e.key==="ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return ()=>{ document.body.style.overflow = pB; window.removeEventListener("keydown", onKey); };
  },[index, items.length, onIndex, onClose]);

  const onTouchStart = (e)=>{
    const t = e.touches[0];
    startRef.current = { x:t.clientX, y:t.clientY, t:Date.now() };
    setDrag({ x:0, y:0, active:true });
  };
  const onTouchMove = (e)=>{
    const t = e.touches[0];
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;
    setDrag({ x:dx, y:dy, active:true });
  };
  const onTouchEnd = ()=>{
    const { x, y } = drag;
    const absX = Math.abs(x), absY = Math.abs(y);
    // Vertical swipe navigates: up = next, down = previous. Close stays on
    // the × button — no swipe-to-dismiss to avoid conflict with drag-prev.
    if(absY > 70 && absY > absX){
      if(y < 0) next(); else prev();
    }
    setDrag({ x:0, y:0, active:false });
  };

  // Vertical-only drag follow with mild damping so the gesture feels sticky
  // (and matches the magnetic-snap design language). Horizontal drift is
  // ignored since horizontal swipes don't navigate anymore.
  const dragStyle = drag.active ? {
    transform: `translate3d(0, ${drag.y * 0.45}px, 0) scale(${Math.max(0.94, 1 - Math.abs(drag.y)/2400)})`,
    transition: "none",
  } : {};

  return (
    <div className="lb-root" style={{
      position:"fixed", inset:0, zIndex:9500,
      background:"#000",
      animation:"lbFade .35s ease-out",
      // touchAction:"none" lets us own the vertical gesture without the
      // browser stealing it for pull-to-refresh / page scroll.
      touchAction:"none",
      // clip, not hidden: the blurred backdrop bleeds past the edges, and a
      // hidden-overflow box still scrolls sideways when a button inside it
      // takes focus (the whole lightbox jumped left on click).
      overflow:"clip",
    }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

      {/* Blurred-cover backdrop fills the letterbox gaps left by
          object-fit:contain on portrait photos in landscape viewports (or
          vice versa). Without this, chrome text reads as floating in black
          space outside the photo on mobile. Heavy blur + low brightness
          masks the snap-update across navigations. */}
      {(() => {
        const signedIn = (typeof akHasSession === "function") ? akHasSession() : ((typeof akCurrentUser === "function") && !!akCurrentUser());
        const src = w && (signedIn ? (w.originalUrl || w.fullUrl || w.imageUrl) : (w.previewUrl || w.imageUrl));
        if (!src) return null;
        return <ProtectedImage className="lb-backdrop" src={src} alt="" fit="cover"/>;
      })()}

      {/* image stage — outgoing disintegrates, embers flash, incoming assembles */}
      <div style={{
        position:"absolute", inset:0,
        transition:"transform .4s var(--ease-out), opacity .4s ease",
        ...dragStyle,
      }}>
        {(() => {
          if (!prevItem) return null;
          const signedIn = (typeof akHasSession === "function") ? akHasSession() : ((typeof akCurrentUser === "function") && !!akCurrentUser());
          const src = signedIn ? (prevItem.originalUrl || prevItem.fullUrl || prevItem.imageUrl) : (prevItem.previewUrl || prevItem.imageUrl);
          if (!src) return null;
          return (
            <ProtectedImage key={`lb-prev-${prevItem.id}`}
              src={src} alt=""
              className="lb-img lb-img-exit"
              fit="contain"
              watermark={false}/>
          );
        })()}

        {prevItem && (
          <canvas ref={dotCanvasRef} className="lb-dots" aria-hidden/>
        )}

        {w && (() => {

          const one = akSlideSources(w).length <= 1;

          if (one) {

            const src = akSlideSources(w)[0];

            return src ? (

              <ProtectedImage key={`lb-cur-${w.id}-${index}`}

                src={src} alt={w.title}

                className="lb-img lb-img-enter"

                fit="contain"

                watermark={false}/>

            ) : null;

          }

          // Multi-image post: shared viewer (lib.jsx) owns strips/swipe/full.

          return (

            <div key={`lb-cur-${w.id}-${index}`} className="lb-img-enter" style={{ position:"absolute", inset:0 }}>

              <AkSlideViewer w={w}/>

            </div>

          );

        })()}
      </div>

      {/* chrome — fades in on hover, out otherwise */}
      <div className="lb-chrome" style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
        <div style={{
          position:"absolute", top:0, left:0, right:0,
          padding:"18px 22px",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          color:"#fff",
          background:"linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 100%)",
        }}>
          <div className="mono" style={{ fontSize:10, letterSpacing:".3em", color:"rgba(255,255,255,.7)", textTransform:"uppercase" }}>
            {String(index+1).padStart(2,"0")} / {String(items.length).padStart(2,"0")}
          </div>
          <div className="mono" style={{ fontSize:10, letterSpacing:".3em", color:w.accent, textTransform:"uppercase" }}>
            {w.deity} · {w.style}
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            pointerEvents:"auto",
            width:40, height:40, borderRadius:"50%",
            background:"rgba(255,255,255,.08)", border:"1px solid rgba(255,255,255,.15)",
            color:"#fff", cursor:"pointer", fontSize:16,
            display:"grid", placeItems:"center",
            backdropFilter:"blur(6px)",
          }}>✕</button>
        </div>

        <button onClick={prev} aria-label="Previous" className="lb-arrow" style={{
          pointerEvents:"auto",
          position:"absolute", left:18, top:"50%", transform:"translateY(-50%)",
          width:52, height:52, borderRadius:"50%",
          background:"rgba(0,0,0,.4)", border:"1px solid rgba(255,255,255,.18)",
          color:"#fff", cursor:"pointer", fontSize:20,
          display:"grid", placeItems:"center",
          backdropFilter:"blur(6px)",
          transition:"all .25s",
        }}>←</button>
        <button onClick={next} aria-label="Next" className="lb-arrow" style={{
          pointerEvents:"auto",
          position:"absolute", right:18, top:"50%", transform:"translateY(-50%)",
          width:52, height:52, borderRadius:"50%",
          background:"rgba(0,0,0,.4)", border:"1px solid rgba(255,255,255,.18)",
          color:"#fff", cursor:"pointer", fontSize:20,
          display:"grid", placeItems:"center",
          backdropFilter:"blur(6px)",
          transition:"all .25s",
        }}>→</button>

        <div style={{
          position:"absolute", bottom:0, left:0, right:0,
          padding:"40px 22px 22px",
          color:"#fff",
          background:"linear-gradient(0deg, rgba(0,0,0,.78) 0%, rgba(0,0,0,.35) 55%, rgba(0,0,0,0) 100%)",
        }}>
          <div className="mono" style={{ fontSize:10, letterSpacing:".3em", color:w.accent, textTransform:"uppercase", marginBottom:8 }}>
            AK/W · {String(index+1).padStart(3,"0")}
          </div>
          <div className="display" style={{ fontSize:"clamp(28px,4vw,44px)", fontStyle:"italic", lineHeight:1.05, fontWeight:400 }}>
            {w.title}
          </div>
          {Array.isArray(w.colors) && w.colors.length>0 && (
            <div style={{ display:"flex", gap:4, marginTop:14 }}>
              {w.colors.map((c,i)=>(
                <span key={i} style={{ width:18, height:18, borderRadius:"50%", background:c, border:"1.5px solid rgba(0,0,0,.3)" }}/>
              ))}
            </div>
          )}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center", maxWidth:"90vw", margin:"18px auto 0" }}>
            {items.slice(Math.max(0, index-6), index+7).map((it, i)=>{
              const actualIdx = Math.max(0, index-6) + i;
              return (
                <button key={it.id} onClick={()=>goTo(actualIdx)} aria-label={it.title} style={{
                  pointerEvents:"auto",
                  width: actualIdx===index?20:6, height:6, borderRadius:3,
                  background: actualIdx===index?"var(--gold)":"rgba(255,255,255,.35)",
                  border:"none", cursor:"pointer", padding:0,
                  transition:"all .3s",
                }}/>
              );
            })}
          </div>
          <div className="mono lb-hint" style={{ fontSize:9, letterSpacing:".3em", color:"rgba(255,255,255,.5)", textTransform:"uppercase", textAlign:"center", marginTop:10 }}>
            Swipe ↑ ↓ · Tap dots · ← → · Esc
          </div>
        </div>
      </div>

      <style>{`
        @keyframes lbFade { from { opacity:0; } to { opacity:1; } }
        /* Blurred-cover backdrop sits behind everything else; fills the
           letterbox gap with a stylised version of the current photo so
           caption text never reads as floating-in-black. */
        .lb-backdrop {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          filter: blur(38px) saturate(1.35) brightness(0.42);
          transform: scale(1.08); /* overshoot edges so blur ring isn't visible */
          z-index: 0;
          pointer-events: none;
          user-select: none;
        }
        /* Chrome sits above all image layers (which can use z 1–3 during a
           transition). Keeps text + buttons reliably on top. */
        .lb-chrome { opacity: 0; transition: opacity .28s ease; z-index: 10; }
        .lb-root:hover .lb-chrome,
        .lb-root:focus-within .lb-chrome { opacity: 1; }
        @media (hover: none) { .lb-chrome { opacity: 1; } }
        .lb-arrow:hover { background:rgba(197,160,89,.25) !important; border-color:var(--gold) !important; color:var(--gold) !important; }
        @media (max-width: 640px) {
          .lb-arrow { display:none !important; }
        }

        /* Disintegrate → embers (image-shaped) → reassemble.
             Outgoing <img> fades out fast (.45s) — the canvas dot-grid is the
             primary visual during the dissolve, so leaving the photo on
             screen would visually compete with the embers.
             Canvas (.lb-dots) renders ~3000–8000 warm-tinted dots that hold
             the shape of the source image, then peel off as embers (handled
             entirely in JS via requestAnimationFrame).
             Incoming <img> starts at .55s from a heavy blurred/warm state and
             settles to neutral (.95s) — emerges from the same space the
             embers came from. Total ~1.6s. */
        .lb-img {
          position:absolute; inset:0;
          width:100%; height:100%;
          object-fit:contain;
          will-change: transform, opacity, filter;
          transform-origin: center center;
          backface-visibility: hidden;
        }
        .lb-img-exit {
          z-index:1;
          animation: lbExitFade .45s ease-out both;
        }
        .lb-img-enter {
          z-index:3;
          animation: lbAssemble .95s cubic-bezier(.16, 1, .3, 1) .55s both;
        }
        @keyframes lbExitFade {
          0%   { opacity: 1; filter: blur(0); transform: scale(1); }
          100% { opacity: 0; filter: blur(6px); transform: scale(1.02); }
        }
        @keyframes lbAssemble {
          0% {
            opacity: 0;
            filter: blur(14px) brightness(1.15);
            transform: scale(.96);
          }
          55% {
            opacity: .92;
            filter: blur(2px) brightness(1.05);
            transform: scale(.995);
          }
          100% {
            opacity: 1;
            filter: blur(0) brightness(1);
            transform: scale(1);
          }
        }

        /* Dot-grid ember canvas. Sits between outgoing image and incoming
           image; lighter compositing inside canvas already makes dots glow,
           and screen blend on the layer keeps it emissive against the bg. */
        .lb-dots {
          position: absolute; inset: 0;
          z-index: 2;
          pointer-events: none;
          mix-blend-mode: screen;
          opacity: 1;
          animation: lbDotsFade 1.5s ease-out both;
        }
        @keyframes lbDotsFade {
          0%, 70% { opacity: 1; }
          100%    { opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .lb-img-exit, .lb-img-enter { animation-duration: .22s; animation-delay: 0s; }
          .lb-dots { display: none; }
          @keyframes lbExitFade { from { opacity: 1; filter: none; transform: none; } to { opacity: 0; filter: none; transform: none; } }
          @keyframes lbAssemble { from { opacity: 0; filter: none; transform: none; } to { opacity: 1; filter: none; transform: none; } }
        }
      `}</style>
    </div>
  );
}

Object.assign(window, { Lightbox });
