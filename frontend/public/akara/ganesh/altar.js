/* Altar — the layer behind the Curtain: diya flame, dhoop smoke, petal shower, bell, modak.
   Draws on one overlay canvas (#altar-fx). Sounds are tap-to-play; no autoplay.
*/
(function(){
  const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  class Altar {
    constructor(fxCanvas, opts){
      this.c = fxCanvas; this.x = fxCanvas.getContext("2d");
      this.o = Object.assign({ audioBase: "/akara/ganesh/audio/" }, opts || {});
      this.lit = false; this.dhoop = false;
      this.smoke = []; this.petals = []; this.sparks = [];
      this.time = 0; this.alive = true;
      this.sounds = {};
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this._resize(); this._onResize = () => this._resize();
      window.addEventListener("resize", this._onResize);
      if (window.ResizeObserver){ this._ro = new ResizeObserver(() => this._resize()); this._ro.observe(fxCanvas); }
      this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    }
    _resize(){
      const r = this.c.getBoundingClientRect();
      this.w = r.width; this.h = r.height;
      this.c.width = Math.round(this.w * this.dpr); this.c.height = Math.round(this.h * this.dpr);
      this.x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    // anchor points come from the DOM so the flame sits on the real diya image
    _pt(el, fx, fy){
      const r = el.getBoundingClientRect(), b = this.c.getBoundingClientRect();
      return { x: r.left - b.left + r.width * fx, y: r.top - b.top + r.height * fy };
    }
    sound(name, loop){
      let a = this.sounds[name];
      if (!a){ a = new Audio(this.o.audioBase + name + ".mp3"); a.preload = "auto"; this.sounds[name] = a; }
      a.loop = !!loop;
      try { a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
      return a;
    }
    stop(name){ const a = this.sounds[name]; if (a){ a.pause(); a.currentTime = 0; } }

    lightDiya(el){ this.lit = !this.lit; this.diyaEl = el; if (this.lit) this.sound("chime"); }
    ringBell(){ this.sound("ghanta-bell"); }   // Indian bell chime (Pixabay licence); see audio/LICENCES.md
    toggleDhoop(el){ this.dhoop = !this.dhoop; this.dhoopEl = el; }
    petalRain(on){ this.rain = !!on; this._rainAcc = 0; }   // endless slow fall while the music plays
    shower(n){
      if (REDUCED) return;
      for (let i = 0; i < (n || 60); i++){
        this.petals.push({ x: Math.random() * this.w, y: -20 - Math.random() * this.h * 0.4, vx: (Math.random() - 0.5) * 0.6, vy: 0.8 + Math.random() * 1.2, r: 4 + Math.random() * 5, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.08, hue: Math.random() < 0.5 ? "#e89a2b" : "#f2b93b", life: 1 });
      }
    }

    _step(dt){
      // smoke
      if (this.dhoop && this.dhoopEl && !REDUCED && Math.random() < 0.6){
        const p = this._pt(this.dhoopEl, 0.5, 0.08);
        this.smoke.push({ x: p.x + (Math.random() - 0.5) * 4, y: p.y, vx: (Math.random() - 0.5) * 0.15, vy: -0.45 - Math.random() * 0.3, r: 3 + Math.random() * 3, life: 1, seed: Math.random() * 6.28 });
      }
      for (const s of this.smoke){ s.x += s.vx + Math.sin(this.time * 1.3 + s.seed) * 0.25; s.y += s.vy; s.r += 0.09; s.life -= dt * 0.22; }
      this.smoke = this.smoke.filter(s => s.life > 0);
      // petals
      if (this.rain && !REDUCED){ this._rainAcc = (this._rainAcc || 0) + dt; while (this._rainAcc >= 0.4){ this._rainAcc -= 0.4; this.petals.push({ x: Math.random() * this.w, y: -20, vx: (Math.random() - 0.5) * 0.6, vy: 0.6 + Math.random() * 0.9, r: 4 + Math.random() * 5, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.08, hue: Math.random() < 0.5 ? "#e89a2b" : "#f2b93b", life: 1 }); } }
      for (const p of this.petals){ p.x += p.vx + Math.sin(this.time * 2 + p.a) * 0.4; p.y += p.vy; p.a += p.va; if (p.y > this.h - 40) p.life -= dt * 0.8; }
      this.petals = this.petals.filter(p => p.life > 0);
    }

    _draw(){
      const x = this.x; x.clearRect(0, 0, this.w, this.h);
      // flame + glow
      if (this.lit && this.diyaEl){
        const p = this._pt(this.diyaEl, 0.79, 0.30);
        const fl = REDUCED ? 0 : Math.sin(this.time * 9) * 1.2 + Math.sin(this.time * 23) * 0.6;
        const g = x.createRadialGradient(p.x, p.y, 2, p.x, p.y, 140 + fl * 6);
        g.addColorStop(0, "rgba(255,190,90,0.38)"); g.addColorStop(0.5, "rgba(255,160,60,0.10)"); g.addColorStop(1, "rgba(255,150,50,0)");
        x.fillStyle = g; x.beginPath(); x.arc(p.x, p.y, 150, 0, 6.283); x.fill();
        const h = 22 + fl * 2, w = 7;
        x.save(); x.translate(p.x, p.y); x.rotate(fl * 0.03);
        const f = x.createLinearGradient(0, 0, 0, -h);
        f.addColorStop(0, "rgba(255,120,30,0.95)"); f.addColorStop(0.55, "rgba(255,200,70,0.95)"); f.addColorStop(1, "rgba(255,255,220,0.0)");
        x.fillStyle = f; x.beginPath(); x.moveTo(-w / 2, 0); x.quadraticCurveTo(-w * 0.9, -h * 0.5, 0, -h); x.quadraticCurveTo(w * 0.9, -h * 0.5, w / 2, 0); x.closePath(); x.fill();
        x.fillStyle = "rgba(60,90,255,0.35)"; x.beginPath(); x.ellipse(0, -2, 2.5, 3.5, 0, 0, 6.283); x.fill();
        x.restore();
      }
      for (const s of this.smoke){ x.fillStyle = `rgba(120,100,80,${0.16 * s.life})`; x.beginPath(); x.arc(s.x, s.y, s.r, 0, 6.283); x.fill(); }
      for (const p of this.petals){
        x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.globalAlpha = p.life;
        x.fillStyle = p.hue; x.beginPath(); x.ellipse(0, 0, p.r, p.r * 0.62, 0, 0, 6.283); x.fill();
        x.fillStyle = "rgba(160,70,10,0.35)"; x.beginPath(); x.arc(0, 0, p.r * 0.28, 0, 6.283); x.fill();
        x.restore();
      }
      x.globalAlpha = 1;
    }
    _loop(ts){ if (!this.alive) return; const dt = Math.min(0.05, (ts - (this._last || ts)) / 1000); this._last = ts; this.time += dt; this._step(dt); this._draw(); requestAnimationFrame(this._loop); }
    destroy(){ this.alive = false; window.removeEventListener("resize", this._onResize); if (this._ro) this._ro.disconnect(); }
  }
  window.Altar = Altar;
})();
