// Wallpaper Gallery — dedicated page with deity / style / orientation / color filters
// and an immersive yantra-iris portal transition from the landing page.

const { useState: glS, useEffect: glE, useRef: glR, useMemo: glM } = React;

// ───────────────────────── color helpers ─────────────────────────
function hexToRgb(hex){
  const h = hex.replace("#","");
  const full = h.length===3 ? h.split("").map(c=>c+c).join("") : h;
  const n = parseInt(full,16);
  return [(n>>16)&255, (n>>8)&255, n&255];
}
// perceptual-ish distance in sRGB (good enough for tone matching)
function colorDist(a, b){
  const [r1,g1,b1] = hexToRgb(a);
  const [r2,g2,b2] = hexToRgb(b);
  const dr = r1-r2, dg = g1-g2, db = b1-b2;
  return Math.sqrt(dr*dr + dg*dg + db*db);
}
function minSwatchDist(wallColors, swatchColors){
  let min = Infinity;
  for(const a of wallColors){
    for(const b of swatchColors){
      const d = colorDist(a,b);
      if(d < min) min = d;
    }
  }
  return min;
}

// ───────────────────────── Portal transition ─────────────────────────
// Radial/yantra iris that grows from a point, peels open, and reveals the gallery.
// Controlled via window.__openGallery({x,y}) from the landing page button.

function GalleryPortal({ open, origin, onDone }){
  const [phase, setPhase] = glS("idle"); // idle | grow | hold | embers | done
  glE(()=>{
    if(open){
      setPhase("grow");
      const t1 = setTimeout(()=>setPhase("hold"),    900);
      const t2 = setTimeout(()=>setPhase("embers"), 1150);
      const t3 = setTimeout(()=>{ setPhase("done"); onDone && onDone(); }, 2150);
      const t4 = setTimeout(()=>setPhase("idle"),   2550);
      return ()=>{ clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    } else {
      setPhase("idle");
    }
  },[open]);

  // Pre-compute ember scatter once when the embers phase starts so positions
  // don't re-randomize on every render.
  const embers = phase==="embers";
  const emberData = glM(()=>{
    if(!embers) return [];
    const maxD = Math.max(window.innerWidth, window.innerHeight);
    return Array.from({length: 90}).map((_,i)=>{
      const a = (i / 90) * Math.PI * 2 + (Math.random()-.5) * 0.5;
      const dist = 160 + Math.random() * maxD * 0.85;
      return {
        ax: Math.cos(a) * dist,
        ay: Math.sin(a) * dist,
        size: 2 + Math.random() * 5,
        delay: Math.random() * 0.22,
        dur: 0.95 + Math.random() * 0.55,
      };
    });
  }, [embers]);

  if(phase === "idle" || phase === "done") return null;

  const grow = phase==="grow" || phase==="hold" || phase==="embers";
  const maxR = Math.sqrt(window.innerWidth**2 + window.innerHeight**2);

  return (
    <div aria-hidden style={{
      position:"fixed", inset:0, zIndex:9000, pointerEvents:"none",
      overflow:"hidden",
    }}>
      {/* Amoeba: dark body whose displacement scale ramps as it travels outward,
          so the edge keeps reaching with new pseudopods rather than just zooming.
          A hammered gold-leaf medallion sits at the center and falls off to
          transparent, so the leaf reads as anchored at origin. */}
      <svg
        viewBox="-100 -100 200 200"
        preserveAspectRatio="xMidYMid meet"
        style={{
          position:"absolute",
          left: origin.x - 400, top: origin.y - 400,
          width: 800, height: 800,
          transform: grow ? `scale(${Math.max(2, maxR/380)})` : "scale(.05)",
          transformOrigin:"center center",
          opacity: embers ? 0 : 1,
          transition:"transform 1.15s cubic-bezier(.22,.61,.36,1), opacity .55s ease-out",
          overflow:"visible",
          filter:"drop-shadow(0 0 28px rgba(197,160,89,.4))",
        }}>
        <defs>
          {/* Travelling amoeba: low-freq turbulence + escalating displacement so the
              shape extends pseudopods as it grows, with internal noise roiling. */}
          <filter id="akAmoeba" x="-80%" y="-80%" width="260%" height="260%">
            <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="3" seed="3">
              <animate attributeName="seed" values="1;6;13;20;28" dur="1.6s" repeatCount="1"/>
              <animate attributeName="baseFrequency" values="0.045;0.024;0.014;0.011" dur="1.6s" repeatCount="1"/>
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="20">
              <animate attributeName="scale" values="6;26;42;36" dur="1.6s" repeatCount="1"/>
            </feDisplacementMap>
            <feGaussianBlur stdDeviation=".4"/>
          </filter>
          {/* Same low-freq displacement as the body (so edges align), plus a
              high-freq gold mottle multiplied for the hammered leaf sheen. */}
          <filter id="akGoldLeaf" x="-80%" y="-80%" width="260%" height="260%">
            <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="3" seed="3" result="d">
              <animate attributeName="seed" values="1;6;13;20;28" dur="1.6s" repeatCount="1"/>
              <animate attributeName="baseFrequency" values="0.045;0.024;0.014;0.011" dur="1.6s" repeatCount="1"/>
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="d" scale="20" result="shape">
              <animate attributeName="scale" values="6;26;42;36" dur="1.6s" repeatCount="1"/>
            </feDisplacementMap>
            <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="11" result="leaf"/>
            <feColorMatrix in="leaf" type="matrix" values="
              0.55 0 0 0 0.55
              0.42 0 0 0 0.36
              0.10 0 0 0 0.08
              0    0 0 0 1" result="leafGold"/>
            <feComposite in="leafGold" in2="shape" operator="in" result="leafMasked"/>
            <feBlend in="shape" in2="leafMasked" mode="multiply"/>
          </filter>
          <radialGradient id="akInkFill" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#0d0a06"/>
            <stop offset="55%"  stopColor="#070503"/>
            <stop offset="92%"  stopColor="#0a0705"/>
            <stop offset="100%" stopColor="#0a0705" stopOpacity="0"/>
          </radialGradient>
          {/* Hammered gold leaf anchored at center, fades out by ~70% radius. */}
          <radialGradient id="akLeafCenter" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#fde9a8" stopOpacity="1"/>
            <stop offset="14%"  stopColor="#f0c968" stopOpacity="1"/>
            <stop offset="32%"  stopColor="#c5a059" stopOpacity=".9"/>
            <stop offset="50%"  stopColor="#7a4d18" stopOpacity=".55"/>
            <stop offset="72%"  stopColor="#3a2410" stopOpacity=".15"/>
            <stop offset="100%" stopColor="#3a2410" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle r="92" fill="url(#akInkFill)"     filter="url(#akAmoeba)"/>
        <circle r="65" fill="url(#akLeafCenter)"  filter="url(#akGoldLeaf)"/>
      </svg>

      {/* Origin flare — quick gold pulse at click point */}
      <div style={{
        position:"absolute", left: origin.x, top: origin.y,
        width:4, height:4, borderRadius:"50%", background:"#fff",
        boxShadow:"0 0 0 0 rgba(197,160,89,0)",
        animation: grow ? "akFlare .9s ease-out forwards" : "none",
      }}/>
      <style>{`
        @keyframes akFlare {
          0%   { box-shadow: 0 0 0 0 rgba(197,160,89,.9), 0 0 40px rgba(197,160,89,.8); opacity:1; }
          100% { box-shadow: 0 0 0 240px rgba(197,160,89,0), 0 0 120px rgba(197,160,89,0); opacity:0; }
        }
        @keyframes akEmber {
          0%   { transform: translate(0,0) scale(1);   opacity:0; }
          12%  {                                       opacity:1; }
          70%  {                                       opacity:.8; }
          100% { transform: translate(var(--ax), var(--ay)) scale(.25); opacity:0; }
        }
      `}</style>

      {/* Gold embers — scatter outward from origin, replacing the curtain peel.
          The dark amoeba above fades during this phase, so embers carry the
          reveal as they fly across the now-visible gallery. */}
      {embers && emberData.map((d,i)=>(
        <div key={i} style={{
          position:"absolute",
          left: origin.x - d.size/2, top: origin.y - d.size/2,
          width: d.size, height: d.size, borderRadius:"50%",
          background:"radial-gradient(circle, #fde9a8 0%, #c5a059 55%, rgba(197,160,89,0) 100%)",
          boxShadow:`0 0 ${d.size*2.4}px rgba(197,160,89,.85), 0 0 ${d.size*4}px rgba(254,241,209,.35)`,
          animation:`akEmber ${d.dur}s cubic-bezier(.2,.65,.3,1) ${d.delay}s forwards`,
          "--ax": `${d.ax}px`,
          "--ay": `${d.ay}px`,
        }}/>
      ))}
    </div>
  );
}

// ───────────────────────── Gallery Page ─────────────────────────

function GalleryPage({ onClose, openItemId }){
  const liveItems = useLiveWallpapers();
  const sourceItems = (liveItems && liveItems.length) ? liveItems : WALLPAPER_ITEMS;
  const liveDeities = glM(()=> Array.from(new Set(sourceItems.map(w=>w.deity))).filter(Boolean), [sourceItems]);
  const liveStyles  = glM(()=> Array.from(new Set(sourceItems.map(w=>w.style))).filter(Boolean), [sourceItems]);
  const [deity, setDeity] = glS("All");
  const [styleF, setStyleF] = glS("All");
  const [orient, setOrient] = glS("All");
  // dual-swatch color filter: primary + secondary hex, or null
  const [primary, setPrimary] = glS(null);
  const [secondary, setSecondary] = glS(null);
  const [pickerOpen, setPickerOpen] = glS(null); // "primary" | "secondary" | null
  const [hovered, setHovered] = glS(null);
  const [lightboxIdx, setLightboxIdx] = glS(null); // index into filtered[]

  // Lock the landing page's scroll while gallery is open; restore on close.
  glE(()=>{
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow="hidden";
    document.documentElement.style.overflow="hidden";
    return ()=>{
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  },[]);

  // Escape closes gallery
  glE(()=>{
    const onKey = (e)=>{ if(e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return ()=>window.removeEventListener("keydown", onKey);
  },[onClose]);

  const filtered = glM(()=>{
    let list = sourceItems.slice();
    if(deity !== "All") list = list.filter(w=>w.deity===deity);
    if(styleF !== "All") list = list.filter(w=>w.style===styleF);
    if(orient !== "All") list = list.filter(w=>w.orient===orient);
    const picked = [primary, secondary].filter(Boolean);
    if(picked.length){
      list = list.map(w=>({ w, d: minSwatchDist(w.colors, picked) }))
                 .sort((a,b)=>a.d-b.d)
                 .map(({w})=>w);
    }
    return list;
  },[deity, styleF, orient, primary, secondary, sourceItems]);

  const anyFilter = deity!=="All" || styleF!=="All" || orient!=="All" || primary || secondary;

  // Auto-open the lightbox at a specific item when GalleryPage is launched from
  // a tile click on the landing page. Re-runs only when openItemId changes so
  // user-triggered closes aren't reverted.
  glE(()=>{
    if(!openItemId) return;
    const i = filtered.findIndex(w=>w.id===openItemId);
    if(i >= 0) setLightboxIdx(i);
  },[openItemId, filtered]);

  return (
    <div style={{
      position:"fixed", top:0, left:0, right:0, bottom:0,
      width:"100vw", height:"100vh",
      zIndex:8000, overflowY:"auto", overflowX:"hidden",
      WebkitOverflowScrolling:"touch", overscrollBehavior:"contain",
      background:"radial-gradient(ellipse at 50% -10%, #0a0f1a 0%, #030305 60%, #000 100%)",
      color:"#fff",
    }}>
      {/* subtle mandala backdrop */}
      <svg aria-hidden viewBox="-100 -100 200 200" style={{
        position:"fixed", inset:0, width:"100%", height:"100%", opacity:.06,
        pointerEvents:"none",
      }}>
        <g stroke="#c5a059" strokeWidth=".15" fill="none">
          {[20,40,60,80].map(r=><circle key={r} r={r}/>)}
          {Array.from({length:36}).map((_,i)=>{
            const a = (i/36)*Math.PI*2;
            return <line key={i} x1={Math.cos(a)*20} y1={Math.sin(a)*20} x2={Math.cos(a)*96} y2={Math.sin(a)*96}/>;
          })}
        </g>
      </svg>

      {/* TOP NAV — gallery-specific, matches the landing nav design language */}
      <nav style={{
        position:"sticky", top:0, zIndex:30,
        padding:"18px 40px",
        background:"linear-gradient(180deg, rgba(3,3,5,.94) 0%, rgba(3,3,5,.72) 80%, transparent 100%)",
        backdropFilter:"blur(14px) saturate(150%)", WebkitBackdropFilter:"blur(14px) saturate(150%)",
        borderBottom:"1px solid rgba(197,160,89,.14)",
        display:"flex", alignItems:"center", justifyContent:"space-between", gap:24,
      }}>
        {/* back-to-site */}
        <button onClick={onClose} style={{
          display:"inline-flex", alignItems:"center", gap:12,
          fontFamily:"var(--mono)", fontSize:10, letterSpacing:".3em", textTransform:"uppercase", fontWeight:600,
          color:"rgba(255,255,255,.75)", background:"transparent", border:"none",
          cursor:"pointer", padding:0, transition:"color .25s",
        }}
        onMouseEnter={(e)=>{ e.currentTarget.style.color="var(--gold)"; }}
        onMouseLeave={(e)=>{ e.currentTarget.style.color="rgba(255,255,255,.75)"; }}>
          <span style={{ fontSize:14, fontWeight:300 }}>←</span>
          <span>Back to Akara</span>
        </button>

        {/* centered wordmark */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <span className="display" style={{ fontSize:20, fontStyle:"italic", fontWeight:400, letterSpacing:".02em" }}>
            <span className="gold-text">Akara</span> <span style={{ opacity:.6 }}>/ Gallery</span>
          </span>
          <span className="mono" style={{ fontSize:9, letterSpacing:".35em", color:"rgba(255,255,255,.4)", textTransform:"uppercase" }}>
            {filtered.length} / {sourceItems.length} works
          </span>
        </div>

        {/* close */}
        <button onClick={onClose} aria-label="Close gallery" style={{
          width:40, height:40, borderRadius:"50%",
          background:"rgba(255,255,255,.05)",
          border:"1px solid rgba(255,255,255,.15)",
          color:"#fff", cursor:"pointer",
          display:"grid", placeItems:"center",
          fontSize:16, fontWeight:300,
          transition:"all .25s",
        }}
        onMouseEnter={(e)=>{ e.currentTarget.style.borderColor="var(--gold)"; e.currentTarget.style.color="var(--gold)"; e.currentTarget.style.background="rgba(197,160,89,.08)"; }}
        onMouseLeave={(e)=>{ e.currentTarget.style.borderColor="rgba(255,255,255,.15)"; e.currentTarget.style.color="#fff"; e.currentTarget.style.background="rgba(255,255,255,.05)"; }}>
          ✕
        </button>
      </nav>

      {/* HEADER */}
      <div style={{ maxWidth:1400, margin:"0 auto", padding:"48px 40px 24px", position:"relative" }}>
        <SectionKicker num="∞ / ∞" label="The Complete Gallery"/>
        <h1 className="display" style={{
          fontSize:"clamp(56px,7vw,104px)", lineHeight:.95, margin:"8px 0 18px", fontWeight:400, letterSpacing:"-.015em",
        }}>
          Find the work that <em className="gold-text" style={{ fontStyle:"italic" }}>calls you</em>.
        </h1>
        <p style={{ fontSize:17, color:"var(--ice-muted)", fontWeight:300, maxWidth:620, lineHeight:1.6, margin:0 }}>
          Filter by deity, art style, orientation, or pick the <span style={{color:"var(--gold)"}}>primary &amp; secondary colours</span> you love.
          We'll surface the wallpapers whose palettes are closest to yours.
        </p>
      </div>

      {/* FILTERS */}
      <div style={{ maxWidth:1400, margin:"0 auto", padding:"24px 40px 28px", position:"relative" }}>
        <FilterRow label="Deity">
          <FilterChip active={deity==="All"} onClick={()=>setDeity("All")}>All</FilterChip>
          {liveDeities.map(d=>(
            <FilterChip key={d} active={deity===d} onClick={()=>setDeity(d)}>{d}</FilterChip>
          ))}
        </FilterRow>
        <FilterRow label="Style">
          <FilterChip active={styleF==="All"} onClick={()=>setStyleF("All")}>All</FilterChip>
          {liveStyles.map(s=>(
            <FilterChip key={s} active={styleF===s} onClick={()=>setStyleF(s)}>{s}</FilterChip>
          ))}
        </FilterRow>
        <FilterRow label="Orientation">
          <FilterChip active={orient==="All"} onClick={()=>setOrient("All")}>All</FilterChip>
          <FilterChip active={orient==="portrait"} onClick={()=>setOrient("portrait")}>▯ Portrait</FilterChip>
          <FilterChip active={orient==="landscape"} onClick={()=>setOrient("landscape")}>▭ Landscape</FilterChip>
        </FilterRow>
        <FilterRow label="Colour Palette">
          <ColorSlotButton
            label="Primary"
            color={primary}
            open={pickerOpen==="primary"}
            onToggle={()=>setPickerOpen(pickerOpen==="primary" ? null : "primary")}
            onPick={(hex)=>{ setPrimary(hex); setPickerOpen(null); }}
            onClear={()=>setPrimary(null)}
          />
          <ColorSlotButton
            label="Secondary"
            color={secondary}
            open={pickerOpen==="secondary"}
            onToggle={()=>setPickerOpen(pickerOpen==="secondary" ? null : "secondary")}
            onPick={(hex)=>{ setSecondary(hex); setPickerOpen(null); }}
            onClear={()=>setSecondary(null)}
          />
          {(primary || secondary) && (
            <span className="mono" style={{
              fontSize:10, letterSpacing:".22em", textTransform:"uppercase",
              color:"rgba(255,255,255,.4)", marginLeft:8, alignSelf:"center",
            }}>
              Sorted by closest match
            </span>
          )}
        </FilterRow>

        {anyFilter && (
          <div style={{ marginTop:20 }}>
            <button onClick={()=>{ setDeity("All"); setStyleF("All"); setOrient("All"); setPrimary(null); setSecondary(null); setPickerOpen(null); }}
              className="mono" style={{
                background:"transparent", border:"none", color:"var(--gold)",
                fontSize:10, letterSpacing:".3em", textTransform:"uppercase", cursor:"pointer",
                padding:0,
              }}>↺ Reset filters</button>
          </div>
        )}
      </div>

      {/* GRID */}
      <div style={{ maxWidth:1400, margin:"0 auto", padding:"16px 40px 120px", position:"relative" }}>
        {filtered.length === 0 ? (
          <div style={{
            padding:"120px 40px", textAlign:"center",
            border:"1px dashed rgba(255,255,255,.12)", borderRadius:8,
            color:"rgba(255,255,255,.5)",
          }}>
            <div className="display" style={{ fontSize:32, fontStyle:"italic", marginBottom:10 }}>Nothing quite matches.</div>
            <div className="mono" style={{ fontSize:11, letterSpacing:".3em", textTransform:"uppercase" }}>
              Try a different combination
            </div>
          </div>
        ) : (
          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))",
            gap:18,
          }}>
            {filtered.map((w, i)=>(
              <GalleryTile key={w.id} w={w} idx={i}
                hovered={hovered} setHovered={setHovered}
                onOpen={()=>setLightboxIdx(i)}/>
            ))}
          </div>
        )}
      </div>

      {lightboxIdx !== null && (
        <Lightbox items={filtered} index={lightboxIdx}
          onIndex={setLightboxIdx} onClose={()=>setLightboxIdx(null)}/>
      )}
    </div>
  );
}

// Lightbox is defined in lightbox.jsx (loaded before this script) and exposed
// as a global. Both this gallery page and the landing-page wallpaper section
// render it directly — single source of truth for the wallpaper image viewer.

function FilterRow({ label, children }){
  return (
    <div className="gl-filter-row" style={{
      display:"grid", gridTemplateColumns:"160px 1fr", gap:24, alignItems:"center",
      padding:"12px 0",
      borderBottom:"1px solid rgba(255,255,255,.04)",
    }}>
      <span className="mono" style={{
        fontSize:10, letterSpacing:".3em", color:"rgba(255,255,255,.45)", textTransform:"uppercase",
      }}>{label}</span>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>{children}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children }){
  return (
    <button onClick={onClick} style={{
      padding:"7px 14px", borderRadius:999,
      background: active ? "var(--gold)" : "transparent",
      color: active ? "#0a0a0a" : "rgba(255,255,255,.75)",
      border:`1px solid ${active ? "var(--gold)" : "rgba(255,255,255,.12)"}`,
      fontFamily:"var(--mono)", fontSize:10, letterSpacing:".26em", textTransform:"uppercase",
      fontWeight: active ? 600 : 400,
      cursor:"pointer", transition:"all .25s",
    }}
    onMouseEnter={(e)=>{ if(!active){ e.currentTarget.style.borderColor="rgba(197,160,89,.55)"; e.currentTarget.style.color="#fff"; } }}
    onMouseLeave={(e)=>{ if(!active){ e.currentTarget.style.borderColor="rgba(255,255,255,.12)"; e.currentTarget.style.color="rgba(255,255,255,.75)"; } }}>
      {children}
    </button>
  );
}

function GalleryTile({ w, idx, hovered, setHovered, onOpen }){
  const isHovered = hovered===w.id;
  const dimmed = hovered && !isHovered;
  const portrait = w.orient === "portrait";
  return (
    <article
      onClick={onOpen}
      onMouseEnter={()=>setHovered(w.id)}
      onMouseLeave={()=>setHovered(null)}
      style={{
        position:"relative",
        aspectRatio: portrait ? "3/4" : "4/3",
        overflow:"hidden",
        borderRadius:6,
        background:"#050506",
        cursor:"pointer",
        opacity: dimmed ? .42 : 1,
        transform: isHovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: isHovered
          ? "0 30px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(197,160,89,.3)"
          : "0 8px 20px rgba(0,0,0,.35)",
        transition:"all .5s var(--ease-out)",
        animation: `fadeUp .7s var(--ease-out) ${Math.min(idx*50, 600)}ms both`,
      }}>
      {/* art */}
      <div style={{
        position:"absolute", inset:0, background: w.grad,
        transform: isHovered?"scale(1.06)":"scale(1.01)",
        transition:"transform 1.2s var(--ease-out)",
      }}>
        {(() => {
          const signedIn = (typeof akCurrentUser === "function") && !!akCurrentUser();
          const src = signedIn ? (w.originalUrl || w.fullUrl || w.imageUrl) : (w.previewUrl || w.imageUrl);
          if (!src) return null;
          return <ProtectedImage src={src} alt={w.title} fit="cover" watermark={false}/>;
        })()}
      </div>
      {/* ornamental linework */}
      <svg viewBox="-100 -100 200 200" style={{
        position:"absolute", inset:0, width:"100%", height:"100%",
        opacity:.18, mixBlendMode:"overlay", pointerEvents:"none",
      }}>
        <g style={{ animation: isHovered ? "akSpin 45s linear infinite" : "akSpin 200s linear infinite", transformOrigin:"center" }}>
          {[28,52,78].map(r=>(
            <circle key={r} r={r} fill="none" stroke="#fff" strokeWidth=".25"/>
          ))}
          {Array.from({length:16}).map((_,i)=>{
            const a=(i/16)*Math.PI*2;
            return <line key={i} x1={Math.cos(a)*28} y1={Math.sin(a)*28} x2={Math.cos(a)*82} y2={Math.sin(a)*82} stroke="#fff" strokeWidth=".15"/>;
          })}
        </g>
      </svg>
      {/* vignette */}
      <div style={{ position:"absolute", inset:0,
        background:"linear-gradient(180deg, rgba(0,0,0,.2) 0%, transparent 40%, transparent 55%, rgba(0,0,0,.75) 100%)" }}/>
      {/* top meta */}
      <div style={{ position:"absolute", top:12, left:12, right:12, display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
        <span className="mono" style={{ fontSize:9, letterSpacing:".28em", textTransform:"uppercase", color:"rgba(255,255,255,.8)" }}>
          AK/W · {String(idx+1).padStart(3,"0")}
        </span>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {w.freePreview && (
            <span className="mono" style={{
              fontSize:9, letterSpacing:".24em", textTransform:"uppercase", fontWeight:600,
              color:"#0A1626", background:"var(--gold)", padding:"3px 8px", borderRadius:999,
              boxShadow:"0 2px 8px rgba(197,160,89,.4)",
            }}>FREE</span>
          )}
          <span className="mono" style={{ fontSize:9, letterSpacing:".28em", textTransform:"uppercase", color:"rgba(255,255,255,.6)" }}>
            {w.orient==="portrait"?"▯":"▭"}
          </span>
        </div>
      </div>
      {/* bottom caption */}
      <div style={{ position:"absolute", left:14, right:14, bottom:14 }}>
        <div className="mono" style={{ fontSize:9, letterSpacing:".28em", color:w.accent, textTransform:"uppercase", marginBottom:6 }}>
          {w.deity} · {w.style}
        </div>
        <div className="display" style={{ fontSize:20, fontStyle:"italic", lineHeight:1.1, color:"#fff" }}>{w.title}</div>
      </div>
      {/* color strip */}
      <div style={{
        position:"absolute", top:12, right:12,
        display:"flex", gap:0,
        opacity: isHovered ? 1 : .6,
        transition:"opacity .3s",
      }}>
        {w.colors.map((c,i)=>(
          <span key={i} style={{
            width:10, height:10, borderRadius:"50%",
            background:c, marginLeft:i===0?0:-4,
            border:"1px solid rgba(0,0,0,.5)",
          }}/>
        ))}
      </div>
      {/* hover preview pill */}
      <div style={{
        position:"absolute", right:12, bottom:12,
        padding:"7px 12px", background:"rgba(255,255,255,.96)", color:"var(--navy-deep)",
        fontFamily:"var(--mono)", fontSize:9, letterSpacing:".22em", textTransform:"uppercase", fontWeight:600,
        borderRadius:999,
        opacity: isHovered?1:0, transform: isHovered?"translateY(0)":"translateY(6px)",
        transition:"all .3s var(--ease-out)",
      }}>View ↗</div>
      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform: translateY(20px); }
          to { opacity:1; transform: translateY(0); }
        }
      `}</style>
    </article>
  );
}

// ────────────── Color slot + picker popover ──────────────
// A slot shows the currently-picked primary/secondary color (or an empty ring),
// click opens a popover with curated swatches + gradient slider + hex input.

// Curated swatch grid — rows are hue families, tuned to Akara's palette range.
const SWATCH_GRID = [
  // neutrals
  ["#ffffff","#f4ece0","#d9cdb5","#c5a059","#8b6a2e","#3d2d13","#1a1208","#050505"],
  // warms
  ["#fef1d1","#fbcaa4","#f0a857","#e37a28","#c56a29","#8a3e18","#3a1a0b","#1a0a06"],
  // reds / sindoor
  ["#f2b6a8","#e55e7f","#d14b5f","#a6284a","#6b1a24","#3a0a14","#200510","#0a0408"],
  // indigo / navy
  ["#cfe5f0","#a4b8d4","#5a78b8","#486080","#1b3a6a","#0a1832","#050914","#020510"],
  // greens
  ["#e7f0f5","#c4d8c2","#8a9e88","#5e8e6b","#3f6a4c","#1d3f2a","#0a1a12","#050a08"],
  // violets
  ["#e3d4ee","#b79bce","#7a3050","#4a1a3a","#2a0d2a","#1a0f25","#0a051a","#030208"],
];

function ColorSlotButton({ label, color, open, onToggle, onPick, onClear }){
  const [hex, setHex] = glS(color || "#c5a059");
  glE(()=>{ if(color) setHex(color); }, [color]);

  return (
    <div style={{ position:"relative" }}>
      <button onClick={onToggle} style={{
        display:"inline-flex", alignItems:"center", gap:12,
        padding:"7px 14px 7px 7px", borderRadius:999,
        background: color ? "rgba(197,160,89,.1)" : "rgba(255,255,255,.03)",
        border:`1px solid ${color ? "var(--gold)" : "rgba(255,255,255,.12)"}`,
        color:"#fff", cursor:"pointer", transition:"all .25s",
      }}
      onMouseEnter={(e)=>{ if(!color) e.currentTarget.style.borderColor="rgba(197,160,89,.55)"; }}
      onMouseLeave={(e)=>{ if(!color) e.currentTarget.style.borderColor="rgba(255,255,255,.12)"; }}>
        <span style={{
          width:26, height:26, borderRadius:"50%",
          background: color || "repeating-conic-gradient(from 0deg, rgba(255,255,255,.18) 0deg 18deg, rgba(255,255,255,.04) 18deg 36deg)",
          border:"1.5px solid rgba(255,255,255,.2)",
          boxShadow: color ? `0 0 0 2px rgba(0,0,0,.5), 0 2px 8px ${color}66` : "inset 0 0 0 1px rgba(255,255,255,.08)",
        }}/>
        <span className="mono" style={{
          fontSize:10, letterSpacing:".26em", textTransform:"uppercase",
          color: color ? "var(--gold)" : "rgba(255,255,255,.7)",
        }}>
          {label}{color ? ` · ${color.toUpperCase()}` : ""}
        </span>
        <span style={{ fontSize:11, color:"rgba(255,255,255,.4)", marginLeft:-4 }}>{open?"▲":"▼"}</span>
      </button>

      {color && (
        <button onClick={onClear} aria-label={`Clear ${label}`} style={{
          position:"absolute", top:-6, right:-6,
          width:18, height:18, borderRadius:"50%",
          background:"#1a1a1a", border:"1px solid rgba(255,255,255,.2)",
          color:"#fff", fontSize:9, cursor:"pointer",
          display:"grid", placeItems:"center", zIndex:2,
        }}>✕</button>
      )}

      {open && (
        <div onClick={(e)=>e.stopPropagation()} style={{
          position:"absolute", top:"calc(100% + 10px)", left:0,
          width:320, padding:18,
          background:"rgba(10,12,18,.96)", backdropFilter:"blur(24px) saturate(160%)", WebkitBackdropFilter:"blur(24px) saturate(160%)",
          border:"1px solid rgba(197,160,89,.25)", borderRadius:16,
          boxShadow:"0 30px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.04)",
          zIndex:50,
        }}>
          {/* label */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <span className="mono" style={{ fontSize:10, letterSpacing:".3em", textTransform:"uppercase", color:"var(--gold)" }}>
              Pick {label.toLowerCase()}
            </span>
            <span className="mono" style={{ fontSize:9, letterSpacing:".25em", textTransform:"uppercase", color:"rgba(255,255,255,.4)" }}>
              Any tone
            </span>
          </div>

          {/* preview */}
          <div style={{
            width:"100%", height:48, borderRadius:8, marginBottom:14,
            background: hex,
            border:"1px solid rgba(255,255,255,.12)",
            boxShadow:"inset 0 1px 0 rgba(255,255,255,.08), 0 4px 14px rgba(0,0,0,.5)",
          }}/>

          {/* swatch grid */}
          <div style={{ display:"grid", gap:4, marginBottom:14 }}>
            {SWATCH_GRID.map((row, ri)=>(
              <div key={ri} style={{ display:"grid", gridTemplateColumns:"repeat(8, 1fr)", gap:4 }}>
                {row.map((c)=>{
                  const active = (hex||"").toLowerCase() === c.toLowerCase();
                  return (
                    <button key={c}
                      onClick={()=>{ setHex(c); }}
                      onDoubleClick={()=>onPick(c)}
                      title={c}
                      style={{
                        width:"100%", aspectRatio:"1/1",
                        borderRadius:4, cursor:"pointer",
                        background:c,
                        border: active ? "2px solid var(--gold)" : "1px solid rgba(255,255,255,.1)",
                        boxShadow: active ? `0 0 0 2px rgba(0,0,0,.6), 0 0 12px ${c}88` : "inset 0 0 0 1px rgba(0,0,0,.3)",
                        transition:"transform .15s ease-out, box-shadow .2s",
                        transform: active ? "scale(1.12)" : "scale(1)",
                      }}/>
                  );
                })}
              </div>
            ))}
          </div>

          {/* hex input */}
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:12 }}>
            <input
              type="color"
              value={hex}
              onChange={(e)=>setHex(e.target.value)}
              style={{
                width:36, height:36, padding:0, border:"1px solid rgba(255,255,255,.15)",
                borderRadius:8, background:"transparent", cursor:"pointer",
              }}
            />
            <input
              type="text"
              value={hex}
              onChange={(e)=>{
                const v = e.target.value;
                setHex(v);
              }}
              placeholder="#c5a059"
              style={{
                flex:1, padding:"10px 12px",
                background:"rgba(255,255,255,.04)",
                border:"1px solid rgba(255,255,255,.12)",
                borderRadius:8, color:"#fff",
                fontFamily:"var(--mono)", fontSize:12, letterSpacing:".08em",
                outline:"none",
              }}
            />
          </div>

          {/* apply */}
          <button
            onClick={()=>{
              const clean = /^#?[0-9a-f]{6}$/i.test(hex) ? (hex.startsWith("#") ? hex : "#"+hex) : null;
              if(clean) onPick(clean);
            }}
            style={{
              width:"100%", padding:"12px",
              background:"var(--gold)", color:"#0a0a0a",
              border:"none", borderRadius:8,
              fontFamily:"var(--mono)", fontSize:10, letterSpacing:".3em", textTransform:"uppercase", fontWeight:700,
              cursor:"pointer", transition:"transform .2s",
            }}
            onMouseEnter={(e)=>{ e.currentTarget.style.transform="translateY(-1px)"; }}
            onMouseLeave={(e)=>{ e.currentTarget.style.transform="translateY(0)"; }}>
            Apply {label}
          </button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { GalleryPortal, GalleryPage });
