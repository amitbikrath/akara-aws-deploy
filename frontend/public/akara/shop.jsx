// Shop — three frosted-glass specimen cards, clickable → /shop/<category>

const { useState: shS, useRef: shR, useEffect: shE } = React;

function SpecimenCard({ item, index }){
  const ref = shR(null);
  const videoRef = shR(null);
  const [hover, setHover] = shS(false);
  const [tapPlaying, setTapPlaying] = shS(false);
  const [videoPlaying, setVideoPlaying] = shS(false);
  const [videoError, setVideoError] = shS(false);
  const inView = useInView(ref, { threshold:0.3 });

  shE(()=>{
    const v = videoRef.current; if(!v) return;
    if(hover){ v.play().catch(()=>{}); } else if(!tapPlaying){ v.pause(); }
  },[hover, tapPlaying]);

  // Track whether the video is actually rendering frames — if not, we keep the
  // poster image visible so mobile never goes to a black box.
  shE(()=>{
    const v = videoRef.current; if(!v) return;
    const onPlaying = ()=> { setVideoPlaying(true); setVideoError(false); };
    const onPause   = ()=> setVideoPlaying(false);
    const onError   = ()=> { setVideoError(true); setVideoPlaying(false); };
    const onStalled = ()=> setVideoPlaying(false);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("pause", onPause);
    v.addEventListener("error", onError);
    v.addEventListener("stalled", onStalled);
    v.addEventListener("emptied", onStalled);
    return ()=>{
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("error", onError);
      v.removeEventListener("stalled", onStalled);
      v.removeEventListener("emptied", onStalled);
    };
  },[]);

  // On touch devices autoplay when the card is on-screen; pause when it leaves.
  // Uses the card wrapper (not the video el) as the observed target, since the
  // video el can be inside a transformed/blurred parent that confuses the
  // observer's intersection math.
  shE(()=>{
    const isTouch = matchMedia("(hover: none), (pointer: coarse)").matches;
    if(!isTouch) return;
    const card = ref.current;
    const v = videoRef.current;
    if(!card || !v) return;
    // iOS needs these explicit properties set imperatively too
    v.muted = true;
    v.playsInline = true;
    v.setAttribute("playsinline","");
    v.setAttribute("webkit-playsinline","");
    v.setAttribute("muted","");
    const io = new IntersectionObserver(([e])=>{
      if(e.intersectionRatio > 0.45){
        const p = v.play();
        if(p && p.catch) p.catch(()=>{ /* user gesture required — tap to play fallback */ });
      } else {
        v.pause();
      }
    }, { threshold:[0, 0.45, 1] });
    io.observe(card);
    return ()=>io.disconnect();
  },[]);

  shE(()=>{
    const el = ref.current; if(!el) return;
    let raf = null;
    const onMove = (e)=>{
      const r = el.getBoundingClientRect();
      const px = (e.clientX - (r.left + r.width/2)) / (r.width/2);
      const py = (e.clientY - (r.top + r.height/2)) / (r.height/2);
      if(raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(()=>{
        el.style.setProperty("--rx", `${-py*4}deg`);
        el.style.setProperty("--ry", `${px*6}deg`);
      });
    };
    const onLeave = ()=>{ el.style.setProperty("--rx","0deg"); el.style.setProperty("--ry","0deg"); };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return ()=>{ el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
  },[]);

  const tilt = [-2.5, 1.5, -1.5][index];
  const yOff = [0, -28, 12][index];
  const accents = ["#F3C97C", "#E1A95F", "#C5A059"];
  const ACCENT = accents[index];

  return (
    <a ref={ref}
      href={item.href}
      onClick={(e)=>{ e.preventDefault(); if(window.__openShop) window.__openShop({ aisle:item.aisle }); }}
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      style={{
        position:"relative", display:"flex", flexDirection:"column",
        width:"100%", padding:20, borderRadius:18,
        color:"#f5f1ea", textDecoration:"none",
        background:"linear-gradient(140deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,.06) 100%)",
        backdropFilter:"blur(44px) saturate(180%)", WebkitBackdropFilter:"blur(44px) saturate(180%)",
        border:"1px solid rgba(255,255,255,.22)",
        boxShadow:`
          inset 0 1px 0 rgba(255,255,255,.28),
          inset 0 -1px 0 rgba(0,0,0,.15),
          0 40px 80px rgba(0,0,0,.5),
          0 14px 34px rgba(0,0,0,.35)
        `,
        transform: inView
          ? `perspective(1400px) rotate(${tilt}deg) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) translate3d(0, ${yOff}px, 0)`
          : "perspective(1400px) translate3d(0, 80px, 0)",
        opacity: inView?1:0,
        transition:`transform 1.1s var(--ease-out) ${index*180}ms, opacity 1s var(--ease-out) ${index*180}ms, box-shadow .4s var(--ease)`,
        animation: inView ? `akFloat ${5.2 + index*0.7}s ease-in-out ${index*0.4}s infinite` : "none",
        willChange:"transform",
        overflow:"hidden",
        cursor:"pointer",
      }}>
      {/* spec highlight ring */}
      <div aria-hidden style={{
        position:"absolute", inset:12, borderRadius:10, pointerEvents:"none",
        border:"1px solid rgba(255,255,255,.08)",
      }}/>
      {/* hover sheen */}
      <div aria-hidden style={{
        position:"absolute", inset:0, pointerEvents:"none",
        background:`radial-gradient(circle at 30% 0%, rgba(255,255,255,.14), transparent 55%)`,
        opacity: hover?1:.5, transition:"opacity .4s var(--ease)",
      }}/>

      {/* header */}
      <header style={{ position:"relative", display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14, zIndex:2 }}>
        <div>
          <div className="mono" style={{ fontSize:9, letterSpacing:".32em", color:ACCENT, textTransform:"uppercase", fontWeight:600 }}>
            Specimen · {String(index+1).padStart(2,"0")}
          </div>
          <div className="mono" style={{ fontSize:9, letterSpacing:".2em", color:"rgba(255,255,255,.6)", marginTop:4, textTransform:"uppercase" }}>
            {item.sub}
          </div>
        </div>
        <span style={{
          fontFamily:"var(--display)", fontStyle:"italic", fontSize:26, lineHeight:1,
          color:ACCENT, opacity:.9,
        }}>§{index+1}</span>
      </header>

      {/* media */}
      <div style={{
        position:"relative", aspectRatio:"4/5", borderRadius:12, overflow:"hidden",
        background:"#1a1208",
        boxShadow:"inset 0 0 0 1px rgba(255,255,255,.1), 0 8px 28px rgba(0,0,0,.45)",
      }}>
        {/* Poster image — always rendered, sits BEHIND video. If video fails or hasn't started yet, this is what you see. */}
        <ProtectedImage src={item.img} alt="" fit="cover" style={{
          transform: hover?"scale(1.05)":"scale(1)",
          transition:"transform 1s var(--ease-out), opacity .4s var(--ease)",
          opacity: (videoPlaying && !videoError) ? 0 : 1,
          zIndex:1,
        }}/>
        <video ref={videoRef} poster={item.img} muted loop playsInline webkit-playsinline="true" autoPlay preload="auto"
          onClick={(e)=>{
            e.preventDefault(); e.stopPropagation();
            const v = videoRef.current; if(!v) return;
            if(v.paused){
              v.muted = true;
              const p = v.play();
              if(p && p.then) p.then(()=>setTapPlaying(true)).catch(()=>{});
              else setTapPlaying(true);
            } else {
              v.pause();
              setTapPlaying(false);
            }
          }}
          style={{
            position:"absolute", inset:0,
            width:"100%", height:"100%", objectFit:"cover",
            transform: hover?"scale(1.05)":"scale(1)",
            transition:"transform 1s var(--ease-out)",
            zIndex:2,
            opacity: videoError ? 0 : 1,
          }}>
          <source src={item.video} type="video/mp4"/>
        </video>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, transparent 40%, rgba(0,0,0,.5) 100%)" }}/>
        <div style={{
          position:"absolute", left:12, bottom:12,
          padding:"6px 11px",
          background:"rgba(255,255,255,.18)", backdropFilter:"blur(22px) saturate(180%)", WebkitBackdropFilter:"blur(22px) saturate(180%)",
          border:"1px solid rgba(255,255,255,.28)",
          color:"#fff",
          fontFamily:"var(--mono)", fontSize:9, letterSpacing:".24em", textTransform:"uppercase", fontWeight:600,
          borderRadius:999,
          opacity: hover?1:0, transform: hover?"translateY(0)":"translateY(6px)",
          transition:"all .35s var(--ease-out)",
        }}>Enter shop ↗</div>
        <div aria-hidden style={{
          position:"absolute", top:10, right:10,
          width:42, height:42, borderRadius:"50%",
          border:`1px solid ${ACCENT}`, color:ACCENT,
          display:"grid", placeItems:"center",
          fontFamily:"var(--mono)", fontSize:8, letterSpacing:".18em", fontWeight:600,
          background:"rgba(0,0,0,.25)", backdropFilter:"blur(10px)",
          transform:"rotate(-8deg)", lineHeight:1.15, textAlign:"center",
        }}>AKR<br/>2026</div>
      </div>

      {/* body */}
      <div style={{ marginTop:18, position:"relative", zIndex:2 }}>
        <h3 className="display" style={{
          fontSize:30, fontStyle:"italic", lineHeight:1, margin:0, fontWeight:400,
          letterSpacing:"-.01em", color:"#fff",
        }}>{item.name}</h3>
        <p style={{
          marginTop:8, fontSize:13, lineHeight:1.5, color:"rgba(255,255,255,.78)", fontWeight:300,
          textWrap:"pretty",
        }}>{item.lead}</p>

        <dl style={{
          marginTop:14, paddingTop:14, borderTop:"1px solid rgba(255,255,255,.1)",
          display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px 14px", margin:0,
        }}>
          {[
            ["Category", item.sub],
            ["Edition",  "Vol. 01 · Limited"],
            ["Drops",    "Autumn 2026"],
            ["Interest", `${240 + index*97}`],
          ].map(([k,v])=>(
            <div key={k}>
              <dt className="mono" style={{ fontSize:8, letterSpacing:".26em", color:ACCENT, textTransform:"uppercase", opacity:.9 }}>{k}</dt>
              <dd style={{ margin:"3px 0 0", fontSize:12, color:"#eae3d3", fontWeight:400 }}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div style={{
        marginTop:18, display:"flex", justifyContent:"space-between", alignItems:"center",
        paddingTop:12, borderTop:"1px solid rgba(255,255,255,.1)", position:"relative", zIndex:2,
      }}>
        <span className="mono" style={{ fontSize:9, letterSpacing:".28em", color:"rgba(255,255,255,.55)", textTransform:"uppercase" }}>
          Hand · Grain · Ritual
        </span>
        <span style={{
          padding:"7px 12px",
          background: hover ? ACCENT : "transparent",
          color: hover ? "#0a1626" : ACCENT,
          border:`1px solid ${ACCENT}`, borderRadius:999,
          fontFamily:"var(--mono)", fontSize:9, letterSpacing:".24em", textTransform:"uppercase", fontWeight:600,
          transition:"all .3s var(--ease-out)",
        }}>Enter →</span>
      </div>
    </a>
  );
}

function ShopSection({ tweaks }){
  const bgRef = shR(null);
  const titleRef = shR(null);
  const inView = useInView(titleRef, { threshold:0.25 });

  useScrollBus(()=>{
    if(!bgRef.current) return;
    const rect = bgRef.current.parentElement.getBoundingClientRect();
    const h = window.innerHeight;
    const p = (rect.top - h) / (rect.height + h);
    const offset = Math.max(-1, Math.min(1, -p)) * 80;
    bgRef.current.style.transform = `translate3d(0, ${offset}px, 0) scale(1.1)`;
  });

  return (
    <section id="shop" data-screen-label="03 Shop" className="cv-auto" style={{
      position:"relative",
      padding:"180px 40px 200px",
      overflow:"hidden",
      background:"#030303",
    }}>
      <div ref={bgRef} style={{
        position:"absolute", inset:"-10% 0",
        backgroundImage:"url(/akara/assets/shop-backdrop.png)",
        backgroundSize:"cover", backgroundPosition:"center",
        willChange:"transform",
      }}/>
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, rgba(3,3,3,.3) 0%, rgba(3,3,3,.05) 35%, rgba(3,3,3,.25) 80%, #030303 100%)" }}/>

      <div style={{ position:"relative", maxWidth:1440, margin:"0 auto" }}>
        <div ref={titleRef} style={{ textAlign:"center", marginBottom:100,
          opacity:inView?1:0, transform:inView?"translateY(0)":"translateY(24px)", transition:"all .9s var(--ease-out)" }}>
          <SectionKicker num="03 / 05" label="Shop · Objects for a Sanatani home" align="center"/>
          <h2 className="display" style={{ fontSize:"clamp(40px,5.2vw,76px)", lineHeight:1.05, margin:"0 auto", fontWeight:400, maxWidth:"22ch", textWrap:"balance", textShadow:"0 10px 30px rgba(0,0,0,.5)" }}>
            A physical brand, <em className="gold-text" style={{ fontStyle:"italic" }}>arriving slowly</em>.
          </h2>
          <p style={{ fontSize:16, color:"rgba(255,255,255,.88)", maxWidth:640, margin:"32px auto 0", lineHeight:1.6, fontWeight:300, textShadow:"0 4px 20px rgba(0,0,0,.5)" }}>
            Three categories in production. Tap a specimen to enter its room.
          </p>
        </div>

        <div style={{ marginTop:40, marginBottom:64, textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:18 }}>
          <button
            onClick={()=>window.__openShop && window.__openShop()}
            style={{
              position:"relative",
              display:"inline-flex", alignItems:"center", gap:18,
              padding:"20px 36px 20px 30px",
              background:"linear-gradient(135deg, #c5a059 0%, #8a6932 100%)",
              color:"#0a0a0a", border:"none", borderRadius:999,
              fontFamily:"var(--mono)", fontSize:11, letterSpacing:".32em", textTransform:"uppercase", fontWeight:700,
              cursor:"pointer",
              boxShadow:"0 20px 50px rgba(197,160,89,.35), inset 0 0 0 1px rgba(255,255,255,.25)",
              transition:"transform .35s var(--ease-out), box-shadow .35s var(--ease-out)",
            }}
            onMouseEnter={(e)=>{ e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="0 30px 70px rgba(197,160,89,.5), inset 0 0 0 1px rgba(255,255,255,.35)"; }}
            onMouseLeave={(e)=>{ e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="0 20px 50px rgba(197,160,89,.35), inset 0 0 0 1px rgba(255,255,255,.25)"; }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:"#0a0a0a" }}/>
            <span>Enter the Akara Shop</span>
            <span style={{ fontSize:16, fontWeight:400 }}>→</span>
          </button>
          <div className="mono" style={{ fontSize:9, letterSpacing:".32em", color:"rgba(197,160,89,.7)", textTransform:"uppercase" }}>
            First drop live · three aisles · printed to order in India
          </div>
        </div>

        <div className="shop-grid" style={{
          display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:48,
          padding:"20px 60px 60px",
        }}>
          {SHOP_ITEMS.map((it,i)=>(
            <SpecimenCard key={it.id} item={it} index={i}/>
          ))}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { ShopSection });
