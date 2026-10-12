// Wallpapers — editorial masonry, device-frame peek on hover

const { useState: wpS, useRef: wpR, useEffect: wpE } = React;

// Tile click behaves like a hyperlink: open the wallpaper gallery and auto-
// expand this image. The gallery → lightbox flow is the single source of
// truth; landing-page tiles are just entry points into it.
function openWallpaperInGallery(w, e){
  const r = e && e.currentTarget && e.currentTarget.getBoundingClientRect
    ? e.currentTarget.getBoundingClientRect()
    : null;
  const origin = r
    ? { x: r.left + r.width/2, y: r.top + r.height/2 }
    : { x: window.innerWidth/2, y: window.innerHeight/2 };
  window.__openGallery && window.__openGallery(origin, { openItemId: w.id });
}

function WpTile({ w, idx, featured }){
  const ref = wpR(null);
  const [hover, setHover] = wpS(false);
  const inView = useInView(ref, { threshold: 0.2 });
  return (
    <article ref={ref}
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      onClick={(e)=>openWallpaperInGallery(w, e)}
      role="button"
      tabIndex={0}
      onKeyDown={(e)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); openWallpaperInGallery(w, e); } }}
      style={{
        position:"relative",
        aspectRatio: featured ? "4/5" : "3/4",
        overflow:"hidden",
        cursor:"pointer",
        background:"#050506",
        borderRadius:4,
        opacity: inView?1:0,
        transform: inView?"translate3d(0,0,0)":"translate3d(0,30px,0)",
        transition:`opacity .8s var(--ease-out) ${idx*60}ms, transform .9s var(--ease-out) ${idx*60}ms`,
      }}>
      {/* art (image if live, else gradient) */}
      <div style={{
        position:"absolute", inset:0, background: w.grad,
        transform: hover?"scale(1.08)":"scale(1.02)",
        transition:"transform 1.2s var(--ease-out)",
      }}>
        <AkSlideTile w={w}/>
      </div>
      {/* ornamental linework */}
      <svg viewBox="-100 -100 200 200" style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.22, mixBlendMode:"overlay", pointerEvents:"none" }}>
        <g style={{ animation: hover ? "akSpin 60s linear infinite" : "akSpin 220s linear infinite", transformOrigin:"center" }}>
          {[20,40,60,80].map(r=>(
            <circle key={r} r={r} fill="none" stroke="#fff" strokeWidth="0.3" strokeDasharray={r===40||r===80?"1 2":"none"}/>
          ))}
          {Array.from({length:24}).map((_,i)=>{
            const a = (i/24)*Math.PI*2;
            return <line key={i} x1={Math.cos(a)*20} y1={Math.sin(a)*20} x2={Math.cos(a)*86} y2={Math.sin(a)*86} stroke="#fff" strokeWidth="0.2"/>;
          })}
        </g>
      </svg>
      {/* vignette */}
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, rgba(0,0,0,.25) 0%, transparent 35%, transparent 55%, rgba(0,0,0,.75) 100%)" }}/>
      {/* top meta */}
      <div style={{ position:"absolute", top:14, left:14, right:14, display:"flex", justifyContent:"space-between", alignItems:"center", color:"rgba(255,255,255,.85)", gap:8 }}>
        <span className="mono" style={{ fontSize:9, letterSpacing:".3em", textTransform:"uppercase" }}>AK/W · {String(idx+1).padStart(3,"0")}</span>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {w.freePreview && (
            <span className="mono" style={{
              fontSize:9, letterSpacing:".24em", textTransform:"uppercase", fontWeight:600,
              color:"#0A1626", background:"var(--gold)", padding:"3px 8px", borderRadius:999,
              boxShadow:"0 2px 8px rgba(197,160,89,.4)",
            }}>FREE</span>
          )}
          <span className="mono" style={{ fontSize:9, letterSpacing:".3em", textTransform:"uppercase", opacity:.8 }}>{w.mood}</span>
        </div>
      </div>
      {/* caption */}
      <div style={{ position:"absolute", left:16, right:16, bottom:16, color:"#fff" }}>
        <div className="mono" style={{ fontSize:10, letterSpacing:".26em", color:w.accent, textTransform:"uppercase", marginBottom:6 }}>{w.deity}</div>
        <div className="display" style={{ fontSize: featured? 30: 22, fontStyle:"italic", lineHeight:1.1 }}>{w.title}</div>
      </div>
      {/* hover pill */}
      <div style={{
        position:"absolute", right:14, bottom:14,
        padding:"7px 12px", background:"rgba(255,255,255,.96)", color:"var(--navy-deep)",
        fontFamily:"var(--mono)", fontSize:9, letterSpacing:".22em", textTransform:"uppercase", fontWeight:600,
        borderRadius:999,
        opacity: hover?1:0, transform: hover?"translateY(0)":"translateY(6px)",
        transition:"all .3s var(--ease-out)",
      }}>Preview ↗</div>
    </article>
  );
}

function WallpapersSection({ tweaks }){
  const titleRef = wpR(null);
  const inView = useInView(titleRef, { threshold:0.3 });
  const liveItems = useLiveWallpapers();
  const items = (liveItems && liveItems.length) ? liveItems : WALLPAPER_ITEMS;
  return (
    <section id="wallpapers" data-screen-label="02 Wallpapers" className="cv-auto" style={{
      position:"relative",
      background:"linear-gradient(180deg, #030303 0%, #080812 50%, #030303 100%)",
      padding:"140px 40px 160px",
      zIndex:20,
      marginTop:"-8vh",
      borderTop:"1px solid rgba(197,160,89,.08)",
    }}>
      {/* handoff blur moment */}
      <div aria-hidden style={{
        position:"absolute", top:-120, left:0, right:0, height:240,
        backgroundImage:"url(/akara/assets/handoff-blur.png)",
        backgroundSize:"cover", backgroundPosition:"center",
        opacity:.28, filter:"blur(6px)",
        maskImage:"linear-gradient(180deg, #000 0%, transparent 100%)",
        WebkitMaskImage:"linear-gradient(180deg, #000 0%, transparent 100%)",
        pointerEvents:"none",
      }}/>
      <div style={{ maxWidth:1440, margin:"0 auto", position:"relative" }}>
        <div ref={titleRef} className="wp-header" style={{
          display:"grid", gridTemplateColumns:"1fr 1fr", gap:64, alignItems:"end", marginBottom:64,
          opacity:inView?1:0, transform:inView?"translateY(0)":"translateY(24px)",
          transition:"all .9s var(--ease-out)",
        }}>
          <div>
            <SectionKicker num="02 / 05" label="Wallpapers · Vol. 01"/>
            <h2 className="display" style={{ fontSize:"clamp(44px,6vw,88px)", lineHeight:.98, margin:0, fontWeight:400 }}>
              Eight works, <em style={{ fontStyle:"italic" }} className="gold-text">lit like paintings</em>.
            </h2>
          </div>
          <div style={{ alignSelf:"end", display:"flex", flexDirection:"column", gap:20 }}>
            <p style={{ color:"var(--ice-muted)", fontSize:17, lineHeight:1.6, fontWeight:300, margin:0, maxWidth:480 }}>
              Every wallpaper ships in <span style={{ color:"var(--gold)" }}>five device-exact crops</span> — iPhone, iPad, Mac, Android, lock-screen. Calibrated in P3, colour-graded for OLED, and always free for personal devices.
            </p>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              <button
                onClick={(e)=>{
                  const r = e.currentTarget.getBoundingClientRect();
                  window.__openGallery && window.__openGallery({ x: r.left + r.width/2, y: r.top + r.height/2 });
                }}
                style={{
                  position:"relative",
                  padding:"16px 26px",
                  background:"linear-gradient(135deg, var(--gold) 0%, #d9b876 50%, var(--gold) 100%)",
                  color:"#0a0a0a",
                  border:"none", borderRadius:999,
                  fontFamily:"var(--mono)", fontSize:10, letterSpacing:".3em", textTransform:"uppercase", fontWeight:700,
                  cursor:"pointer",
                  boxShadow:"0 10px 30px rgba(197,160,89,.3), inset 0 1px 0 rgba(255,255,255,.3)",
                  overflow:"hidden",
                  transition:"transform .3s var(--ease-out), box-shadow .3s",
                }}
                onMouseEnter={(e)=>{ e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 16px 40px rgba(197,160,89,.45), inset 0 1px 0 rgba(255,255,255,.4)"; }}
                onMouseLeave={(e)=>{ e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="0 10px 30px rgba(197,160,89,.3), inset 0 1px 0 rgba(255,255,255,.3)"; }}>
                <span style={{ display:"inline-flex", alignItems:"center", gap:12 }}>
                  ✦ &nbsp; Enter the Gallery &nbsp; →
                </span>
              </button>
              <a href="/darshan" data-track="darshan_entry_gallery"
                style={{
                  padding:"16px 24px", border:"1px solid rgba(197,160,89,.55)", borderRadius:999, color:"var(--gold)",
                  fontFamily:"var(--mono)", fontSize:10, letterSpacing:".3em", textTransform:"uppercase", textDecoration:"none",
                  display:"inline-flex", alignItems:"center", transition:"border-color 1s var(--ease-out), background 1s var(--ease-out)",
                }}
                onMouseEnter={(e)=>{ e.currentTarget.style.background="rgba(197,160,89,.1)"; e.currentTarget.style.borderColor="var(--gold)"; }}
                onMouseLeave={(e)=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="rgba(197,160,89,.55)"; }}>
                Enter the Darśana &nbsp; →
              </a>
            </div>
          </div>
        </div>

        {/* masonry */}
        <div className="wp-masonry" style={{
          display:"grid",
          gridTemplateColumns:"repeat(4, 1fr)",
          gap:16,
        }}>
          {items[0] && (
            <div className="wp-featured" style={{ gridColumn:"span 2", gridRow:"span 2" }}>
              <WpTile w={items[0]} idx={0} featured/>
            </div>
          )}
          {items.slice(1, 13).map((w,i)=>(
            <WpTile key={w.id} w={w} idx={i+1}/>
          ))}
        </div>

        {/* footer row */}
        <div className="wp-footer-row" style={{ marginTop:56, display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:32, padding:"28px 0", borderTop:"1px solid rgba(255,255,255,.08)" }}>
          {[
            ["Calibrated","P3 / 10-bit"],
            ["Crops","iPhone · iPad · Mac · Android · Lock"],
            ["New drops","Every new moon"],
            ["Licence","Personal devices, no resale"],
          ].map(([k,v])=>(
            <div key={k}>
              <span className="label">{k}</span>
              <div style={{ fontSize:14, marginTop:10, color:"#fff", fontWeight:300 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { WallpapersSection });
