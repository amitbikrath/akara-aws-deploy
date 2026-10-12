/* Curtain — hanging beads of Devanagari (or marigolds) under the Roof.
   Plain 2D canvas, verlet strings, cursor gathers strands (like the Budarina reference).
   Fixed 60 Hz timestep; every force scales with the curtain width so phones and
   wide screens show the same motion. No dependencies.
   API: new Curtain(canvas, opts) · setText · setMode('hymn'|'marigold') · part(bool) · shift(dx, lag) · rebuild · destroy
*/
(function(){
  const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const REF_W = 420;                       // desktop reference curtain width; all px constants are for this width
  const STEP = 1 / 60;

  function segment(str){
    if (window.Intl && Intl.Segmenter){
      const seg = new Intl.Segmenter("hi", { granularity: "grapheme" });
      return Array.from(seg.segment(str), s => s.segment);
    }
    return Array.from(str);
  }

  class Curtain {
    constructor(canvas, opts){
      this.canvas = canvas; this.ctx = canvas.getContext("2d");
      this.o = Object.assign({
        font: "500 13px 'Tiro Devanagari Sanskrit', 'Noto Serif Devanagari', serif",
        ink: "#2a1f14",
        colGap: 10.5, rowGap: 13, glyph: 11.5,   // at REF_W
        reach: 130, pull: 0.55, drag: 0.42,      // cursor: reach radius, attraction, how much cursor motion the strands inherit
        gravity: 0.22, damping: 0.955, restPull: 0.010, wind: 0.10,
        shadowDX: 22, shadowDY: 30,
        marigoldSheet: null, marigoldCols: 4, marigoldRows: 3,
      }, opts || {});
      this.mode = "hymn"; this.modeMix = 0;
      this.parted = false; this.partMix = 0;
      this.text = ""; this.glyphs = []; this.strings = [];
      this.cursor = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, on: false };
      this.time = 0; this.acc = 0; this.alive = true; this.growT = 0;
      this.spriteCache = new Map();
      this._bind(); this._resize();
      this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    }

    get u(){ return this.w / REF_W; }      // size unit

    _bind(){
      const c = this.canvas;
      const pos = (e) => { const r = c.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return { x: p.clientX - r.left, y: p.clientY - r.top }; };
      this._onMove = (e) => { const p = pos(e); if (!this.cursor.on){ this.cursor.px = p.x; this.cursor.py = p.y; } this.cursor.x = p.x; this.cursor.y = p.y; this.cursor.on = true; };
      this._onLeave = () => { this.cursor.on = false; this.cursor.x = this.cursor.px = -9999; this.cursor.y = this.cursor.py = -9999; this.cursor.vx = this.cursor.vy = 0; };
      c.addEventListener("mousemove", this._onMove); c.addEventListener("mouseleave", this._onLeave);
      c.addEventListener("touchstart", this._onMove, { passive: true }); c.addEventListener("touchmove", this._onMove, { passive: true }); c.addEventListener("touchend", this._onLeave);
      this._onResize = () => { this._resize(); this.rebuild(); };
      window.addEventListener("resize", this._onResize);
      if (window.ResizeObserver){
        this._ro = new ResizeObserver(() => { const r = c.getBoundingClientRect(); if (Math.abs(r.width - this.w) > 1 || Math.abs(r.height - this.h) > 1){ this._resize(); this.rebuild(); } });
        this._ro.observe(c);
      }
    }

    _resize(){
      const r = this.canvas.getBoundingClientRect();
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      this.dpr = Math.min(window.devicePixelRatio || 1, this.w < 360 ? 1.5 : 2);
      this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.spriteCache.clear();
    }

    setText(str){ this.text = str; this.glyphs = segment(str.replace(/\s+/g, " ")); this.rebuild(); }
    setMode(m){ this.mode = m; }
    part(on){ this.parted = !!on; }
    ripple(){ const u = Math.max(0.55, Math.min(1.6, this.u)); for (const s of this.strings){ const k = s.knots, dir = Math.random() < 0.5 ? -1 : 1; for (let i = 1; i < k.length; i++){ const w = 2.2 * u * (i / k.length) * dir; k[i].px -= w; } } }   // one soft sideways sway, used when the murti changes
    shift(dx, lag){ const f = lag == null ? 1 : lag; for (const s of this.strings){ const k = s.knots; for (let i = 1; i < k.length; i++){ const w = f * (0.4 + 0.6 * i / k.length); k[i].x -= dx * w; k[i].px -= dx * w; } } }

    rebuild(){
      const u = Math.max(0.55, Math.min(1.6, this.u));
      const colGap = this.o.colGap * u, rowGap = this.o.rowGap * u;
      const cols = Math.max(4, Math.floor(this.w / colGap)), rows = Math.max(4, Math.floor(this.h / rowGap));
      const x0 = (this.w - (cols - 1) * colGap) / 2;
      this.strings = []; this.rowGap = rowGap; this.glyphPx = Math.max(9, Math.min(15, this.o.glyph * u));
      let gi = 0; const grid = [];
      for (let r = 0; r < rows; r++){ const row = []; for (let c = 0; c < cols; c++) row.push(this.glyphs.length ? this.glyphs[gi++ % this.glyphs.length] : ""); grid.push(row); }
      for (let c = 0; c < cols; c++){
        const ax = x0 + c * colGap, knots = [];
        for (let r = 0; r < rows; r++){
          const g = grid[r][c], jy = r * rowGap, jx = (Math.random() - 0.5) * 0.4;
          knots.push({ x: ax + jx, y: jy, px: ax + jx, py: jy, g: g === " " ? "" : g, fi: (c * 7 + r * 3) % (this.o.marigoldCols * this.o.marigoldRows), seed: Math.random() * 6.28 });
        }
        this.strings.push({ ax, restAx: ax, knots, phase: Math.random() * 6.28 });
      }
      this.growT = 0;
    }

    _sprite(g, size){
      const key = g + "|" + size; let s = this.spriteCache.get(key); if (s) return s;
      const pad = 6, cw = size * 1.6 + pad * 2, ch = size * 1.9 + pad * 2;
      const oc = document.createElement("canvas"); oc.width = Math.ceil(cw * this.dpr); oc.height = Math.ceil(ch * this.dpr);
      const x = oc.getContext("2d"); x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      x.font = this.o.font.replace(/\d+(\.\d+)?px/, size + "px"); x.fillStyle = this.o.ink; x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(g, cw / 2, ch / 2);
      s = { c: oc, w: cw, h: ch }; this.spriteCache.set(key, s); return s;
    }

    // one fixed 60 Hz step; every px constant is multiplied by the size unit
    _step(){
      const o = this.o, t = this.time, u = Math.max(0.55, Math.min(1.6, this.u));
      this.growT = Math.min(1, this.growT + STEP * 0.9);
      this.modeMix += ((this.mode === "marigold" ? 1 : 0) - this.modeMix) * STEP * 1.6;
      this.partMix += ((this.parted ? 1 : 0) - this.partMix) * STEP * 1.1;
      const cx = this.w / 2, reach = o.reach * u, reach2 = reach * reach;
      const cur = this.cursor;
      // cursor velocity (smoothed) — strands inherit part of it, which is what makes them bunch into a rope when you drag
      if (cur.on){ cur.vx += ((cur.x - cur.px) - cur.vx) * 0.5; cur.vy += ((cur.y - cur.py) - cur.vy) * 0.5; cur.px = cur.x; cur.py = cur.y; }
      const gravity = o.gravity * u, wind = o.wind * u, pull = o.pull * u, maxV = 14 * u;
      for (const s of this.strings){
        const side = s.restAx < cx ? -1 : 1, edge = side < 0 ? this.w * 0.06 : this.w * 0.94;
        s.ax = s.restAx + ((edge + (s.restAx - edge) * 0.18) - s.restAx) * this.partMix;
        const k = s.knots, n = k.length;
        for (let i = 1; i < n; i++){
          const b = k[i];
          let vx = (b.x - b.px) * o.damping, vy = (b.y - b.py) * o.damping;
          b.px = b.x; b.py = b.y;
          vy += gravity;
          if (!REDUCED){
            vx += Math.sin(t * 0.7 + s.phase + i * 0.08) * wind * (i / n);
            if (cur.on){
              const dx = cur.x - b.x, dy = cur.y - b.y, d2 = dx * dx + dy * dy;
              if (d2 < reach2){
                const d = Math.sqrt(d2) || 0.001, f = Math.pow(1 - d / reach, 1.6);
                vx += (dx / d) * pull * f + cur.vx * o.drag * f;
                vy += (dy / d) * pull * f * 0.6 + cur.vy * o.drag * f;
              }
            }
          }
          vx += (s.ax - b.x) * o.restPull;
          const sp = Math.hypot(vx, vy); if (sp > maxV){ vx *= maxV / sp; vy *= maxV / sp; }
          b.x += vx; b.y += vy;
        }
        const want = this.rowGap * (1 + 0.35 * this.modeMix);
        for (let pass = 0; pass < 2; pass++){
          for (let i = 1; i < n; i++){
            const a = k[i - 1], b = k[i];
            let dx = b.x - a.x, dy = b.y - a.y; const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
            if (d < 0.01) dy = 0.01;
            const diff = (d - want) / d;
            if (i === 1){ b.x -= dx * diff; b.y -= dy * diff; }
            else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
          }
          k[0].x = s.ax; k[0].y = 0;
        }
      }
    }

    _draw(){
      const x = this.ctx, o = this.o, u = Math.max(0.55, Math.min(1.6, this.u));
      x.clearRect(0, 0, this.w, this.h);
      const reveal = 1 - Math.pow(1 - this.growT, 3);
      x.save(); x.beginPath(); x.rect(-50, -50, this.w + 100, (this.h + 100) * reveal); x.clip();
      const size = this.glyphPx || 11, hymnA = 1 - this.modeMix, flowerA = this.modeMix;
      const sheet = o.marigoldSheet && o.marigoldSheet.complete && o.marigoldSheet.naturalWidth ? o.marigoldSheet : null;
      const fw = sheet ? sheet.naturalWidth / o.marigoldCols : 0, fh = sheet ? sheet.naturalHeight / o.marigoldRows : 0;
      for (let pass = 0; pass < 2; pass++){
        const dx = pass === 0 ? o.shadowDX * u : 0, dy = pass === 0 ? o.shadowDY * u : 0;
        for (const s of this.strings){
          const k = s.knots;
          for (let i = 1; i < k.length; i++){
            const n = k[i];
            if (hymnA > 0.02 && n.g){
              const sp = this._sprite(n.g, size);
              x.globalAlpha = pass === 0 ? 0.10 * hymnA : hymnA;
              x.drawImage(sp.c, n.x + dx - sp.w / 2, n.y + dy - sp.h / 2, sp.w, sp.h);
            }
            if (flowerA > 0.02 && (i % 2 === 0)){
              const sz = 18 * u * (0.8 + 0.4 * Math.sin(n.seed));
              x.globalAlpha = (pass === 0 ? 0.12 : 1) * flowerA;
              if (sheet){ const col = n.fi % o.marigoldCols, row = Math.floor(n.fi / o.marigoldCols); x.drawImage(sheet, col * fw, row * fh, fw, fh, n.x + dx - sz / 2, n.y + dy - sz / 2, sz, sz); }
              else { x.fillStyle = pass === 0 ? "#3a2a18" : (n.fi % 2 ? "#e89a2b" : "#f2b93b"); x.beginPath(); x.arc(n.x + dx, n.y + dy, sz / 3, 0, 6.283); x.fill(); }
            }
          }
        }
      }
      x.globalAlpha = 1; x.restore();
    }

    _loop(ts){
      if (!this.alive) return;
      const dt = Math.min(0.1, (ts - (this._last || ts)) / 1000); this._last = ts;
      this.acc += dt; let n = 0;
      while (this.acc >= STEP && n < 4){ this.time += STEP; this._step(); this.acc -= STEP; n++; }
      if (this.acc > STEP) this.acc = 0;
      if (this.strings.length) this._draw();
      requestAnimationFrame(this._loop);
    }

    destroy(){
      this.alive = false; const c = this.canvas;
      c.removeEventListener("mousemove", this._onMove); c.removeEventListener("mouseleave", this._onLeave);
      c.removeEventListener("touchstart", this._onMove); c.removeEventListener("touchmove", this._onMove); c.removeEventListener("touchend", this._onLeave);
      window.removeEventListener("resize", this._onResize); if (this._ro) this._ro.disconnect();
    }
  }
  window.Curtain = Curtain;
})();
