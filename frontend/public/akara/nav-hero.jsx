// Nav + Hero — cinematic video, letter stagger, scroll dolly, particles

const { useState: nhS, useEffect: nhE, useRef: nhR } = React;

// Inline sign-in panel — frosted glass that genie-unfurls from the
// trigger button's corner. Has its own submit button at the bottom.
function SignInPanel({ onClose }){
  const [busy, setBusy] = nhS(false);
  const [err, setErr] = nhS("");
  const [closing, setClosing] = nhS(false);
  const emailRef = nhR(null);
  const pwRef = nhR(null);
  const rootRef = nhR(null);

  const close = nhR(() => {
    setClosing(true);
    setTimeout(onClose, 950);
  });

  nhE(() => {
    // focus email once the genie + content cascade has settled
    const t = setTimeout(() => emailRef.current?.focus(), 1700);
    const onKey = (e) => { if (e.key === "Escape") close.current(); };
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close.current();
    };
    window.addEventListener("keydown", onKey);
    const bind = setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    return () => {
      clearTimeout(t); clearTimeout(bind);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await window.akSignInWithPassword(emailRef.current.value, pwRef.current.value);
      close.current();
    } catch (ex) {
      setErr(ex && ex.message ? ex.message : "Sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div ref={rootRef} className={"glass ak-signin-panel" + (closing ? " closing" : "")}
      role="dialog" aria-modal="true" aria-label="Sign in"
      style={{
        position:"absolute", top:0, right:0,
        width:320, maxWidth:"calc(100vw - 32px)",
        padding:"22px 22px 18px", borderRadius:18, zIndex:60,
      }}>
      <button onClick={()=> close.current()} aria-label="Close" style={{
        position:"absolute", top:8, right:10, background:"none", border:"none",
        color:"rgba(255,255,255,.55)", fontSize:20, lineHeight:1, cursor:"pointer", padding:6, zIndex:1,
      }}>×</button>

      <div className="mono" style={{
        fontSize:10, letterSpacing:".28em", textTransform:"uppercase",
        color:"var(--ice-muted)", marginBottom:14,
      }}>Sign in</div>

      <button type="button"
        onClick={()=> window.akSignIn({ identityProvider: "Google" })}
        style={{
          width:"100%", padding:"11px 14px", borderRadius:999,
          border:"1px solid rgba(255,255,255,.22)", background:"rgba(255,255,255,.08)",
          color:"#fff", font:"inherit", fontSize:13, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center", gap:10,
        }}>
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.2 35.5 24 35.5c-6.3 0-11.5-5.1-11.5-11.5S17.7 12.5 24 12.5c2.9 0 5.5 1.1 7.6 2.9l5.7-5.7C33.8 6.5 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.9 0 19.5-7.9 19.5-19.5 0-1.2-.1-2.4-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.6 19 12.5 24 12.5c2.9 0 5.5 1.1 7.6 2.9l5.7-5.7C33.8 6.5 29.1 4.5 24 4.5 16.3 4.5 9.7 8.8 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 43.5c5 0 9.6-1.9 13-5l-6.2-5.1c-1.8 1.2-4.1 2-6.8 2-5.2 0-9.6-3.3-11.2-8L6.3 32.6C9.7 39 16.2 43.5 24 43.5z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.3 5.5l6.2 5.1c-.4.4 6.7-4.9 6.7-14.6 0-1.2-.1-2.4-.3-3.5z"/>
        </svg>
        Continue with Google
      </button>

      <div style={{
        display:"flex", alignItems:"center", gap:10, margin:"16px 0 14px",
        color:"rgba(255,255,255,.4)", fontFamily:"var(--mono)", fontSize:10, letterSpacing:".22em",
      }}>
        <span style={{ flex:1, height:1, background:"rgba(255,255,255,.1)" }}/>
        OR
        <span style={{ flex:1, height:1, background:"rgba(255,255,255,.1)" }}/>
      </div>

      <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <input ref={emailRef} type="email" placeholder="Email" autoComplete="email" required disabled={busy} className="ak-signin-input"/>
        <input ref={pwRef} type="password" placeholder="Password" autoComplete="current-password" required disabled={busy} className="ak-signin-input"/>
        {err && (
          <div role="alert" style={{ color:"#ffb4a8", fontSize:12, lineHeight:1.45, marginTop:2 }}>{err}</div>
        )}
        <button type="submit" disabled={busy} className="mag-btn primary" style={{ marginTop:6, opacity: busy ? .7 : 1, width:"100%" }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div style={{ marginTop:14, fontSize:12, color:"var(--ice-muted)", textAlign:"center" }}>
        New here?{" "}
        <button type="button" onClick={()=> window.akSignIn({ signup: true })} style={{
          background:"none", border:"none", color:"var(--gold)", cursor:"pointer",
          padding:0, font:"inherit", textDecoration:"underline",
        }}>
          Create an account
        </button>
      </div>
    </div>
  );
}

// Auth-aware sign-in / signed-in button.
function NavAuthButton(){
  const auth = (typeof useAuth === "function") ? useAuth() : { signedIn: false, user: null, signIn: ()=>{}, signOut: ()=>{} };
  const [menuOpen, setMenuOpen] = nhS(false);
  const [signInOpen, setSignInOpen] = nhS(false);
  if (!auth.signedIn) {
    return (
      <div style={{ position:"relative" }}>
        <span style={{
          display:"inline-block",
          visibility: signInOpen ? "hidden" : "visible",
          pointerEvents: signInOpen ? "none" : "auto",
        }}>
          <MagButton primary onClick={(e)=>{ e.preventDefault(); setSignInOpen(true); }}>
            Sign in / up
          </MagButton>
        </span>
        {signInOpen && <SignInPanel onClose={()=> setSignInOpen(false)}/>}
      </div>
    );
  }
  const label = (auth.user && (auth.user.name || auth.user.email)) || "Member";
  const short = label.length > 18 ? label.slice(0, 16) + "…" : label;
  return (
    <div style={{ position:"relative" }}>
      <MagButton primary onClick={(e)=>{ e.preventDefault(); setMenuOpen(o=>!o); }}>
        {short}
      </MagButton>
      {menuOpen && (
        <div className="glass" style={{
          position:"absolute", top:"calc(100% + 10px)", right:0, minWidth:200,
          padding:"10px 0", borderRadius:14, zIndex:50,
        }}>
          <div style={{ padding:"8px 16px 12px", fontSize:11, color:"var(--ice-muted)", borderBottom:"1px solid rgba(255,255,255,.08)", fontFamily:"var(--mono)", letterSpacing:".18em", textTransform:"uppercase" }}>
            Signed in
          </div>
          <button onClick={()=>{ setMenuOpen(false); auth.signOut(); }} style={{
            display:"block", width:"100%", textAlign:"left",
            background:"none", border:"none", color:"#fff",
            padding:"12px 16px", fontFamily:"inherit", fontSize:13, cursor:"pointer",
          }}
            onMouseEnter={(e)=>{ e.currentTarget.style.background="rgba(255,255,255,.06)"; }}
            onMouseLeave={(e)=>{ e.currentTarget.style.background="none"; }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function TopNav(){
  const [y, setY] = nhS(0);
  useScrollBus((sy)=>setY(sy));
  const scrolled = y > 60;
  const items = [
    { id:"wallpapers",    label:"Wallpapers" },
    // Darśana is its own page (/darshan): browse by deity, bhava and colour.
    { id:"darshan",       label:"Darśana", href:"/darshan" },
    { id:"shop",          label:"Shop" },
    { id:"music",          label:"Music" },
    { id:"story",          label:"Our Story" },
    // The Edition opens as a fullscreen broadsheet overlay (SocialsPage).
    // It's mounted off-tree so we can't scrollIntoView — instead we set the
    // hash, and app.jsx's hashchange listener flips socialsOpen to true.
    { id:"socials-page",   label:"The Edition", hash:true },
  ];
  const go = (item)=>{
    if (item.href) { window.location.href = item.href; return; }
    if (item.hash) {
      window.location.hash = "#" + item.id;
      return;
    }
    document.getElementById(item.id)?.scrollIntoView({ behavior:"smooth", block:"start" });
  };
  return (
    <nav className="site-nav" style={{
      position:"fixed", top:0, left:0, right:0, zIndex:40,
      padding: scrolled ? "14px 40px" : "22px 40px",
      transition:"all .4s var(--ease)",
      background: scrolled ? "rgba(3,3,3,.4)" : "transparent",
      backdropFilter: scrolled ? "blur(40px) saturate(180%)" : "none",
      WebkitBackdropFilter: scrolled ? "blur(40px) saturate(180%)" : "none",
      borderBottom: scrolled ? "1px solid rgba(255,255,255,.1)" : "1px solid transparent",
      boxShadow: scrolled ? "inset 0 1px 0 rgba(255,255,255,.08), 0 8px 32px rgba(0,0,0,.3)" : "none",
      display:"grid", gridTemplateColumns:"auto 1fr auto", alignItems:"center", gap:32,
    }}>
      <a href="#" onClick={(e)=>{e.preventDefault(); window.scrollTo({top:0, behavior:"smooth"});}} style={{ display:"flex", alignItems:"center", gap:12 }}>
        <img src="/akara/assets/akara-icon-round.png" alt="Akara" style={{ width: scrolled?28:34, height: scrolled?28:34, transition:"all .4s var(--ease)" }}/>
        <div style={{ display:"flex", flexDirection:"column", lineHeight:1 }}>
          <span className="display brand-txt" style={{ fontSize: scrolled?20:24, fontStyle:"italic" }}>Akara</span>
          <span className="mono brand-sub" style={{ fontSize:9, letterSpacing:".3em", color:"var(--ice-muted)", textTransform:"uppercase", marginTop:3 }}>Sanatani · Studio</span>
        </div>
      </a>
      <div className="nav-links" style={{ display:"flex", gap:36, justifyContent:"center" }}>
        {items.map((it,i)=>(
          <button key={it.id} onClick={()=>go(it)} className="link-u" style={{
            background:"none", border:"none", color:"#fff",
            fontSize:13, letterSpacing:".05em", fontFamily:"inherit", padding:"4px 0",
          }}>
            <span className="mono" style={{ fontSize:10, color:"var(--gold)", marginRight:6, opacity:.7 }}>0{i+1}</span>
            {it.label}
          </button>
        ))}
      </div>
      <div className="nav-right" style={{ display:"flex", gap:14, alignItems:"center" }}>
        <span className="mono lang" style={{ fontSize:10, color:"var(--ice-muted)", letterSpacing:".22em" }}>EN · INR</span>
        <NavAuthButton/>
      </div>
    </nav>
  );
}

function Particles({ count=16 }){
  const parts = nhR(null);
  if (!parts.current){
    parts.current = Array.from({length: count}, (_,i)=>({
      id:i,
      left: 8 + (i*11)%82,
      top: 10 + (i*17)%78,
      size: 4 + (i%5)*2,
      delay: (i%7)*0.5,
      dur: 7 + (i%6),
    }));
  }
  return (
    <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:3 }}>
      {parts.current.map(p=>(
        <span key={p.id} style={{
          position:"absolute", left:`${p.left}%`, top:`${p.top}%`,
          width:p.size, height:p.size, borderRadius:"50%",
          background:"rgba(255,255,255,.85)",
          boxShadow:"0 0 14px rgba(255,240,200,.7)",
          animation:`akParticle ${p.dur}s cubic-bezier(.77,0,.175,1) ${p.delay}s infinite`,
        }}/>
      ))}
    </div>
  );
}

function Hero({ tweaks }){
  const ref = nhR(null);
  const videoRef = nhR(null);
  const contentRef = nhR(null);
  const mediaRef = nhR(null);
  const [isMobile, setIsMobile] = nhS(typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  nhE(()=>{
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 767px)");
    const update = ()=> setIsMobile(mql.matches);
    update();
    mql.addEventListener ? mql.addEventListener("change", update) : mql.addListener(update);
    return ()=>{
      mql.removeEventListener ? mql.removeEventListener("change", update) : mql.removeListener(update);
    };
  },[]);
  const heroVideo = isMobile ? "/akara/assets/radha-krishna-hero-mobile.mp4" : "/akara/assets/radha-krishna-hero.mp4";
  const heroGifFallback = "/akara/assets/radha-krishna-hero-mobile.gif";

  // Live panchang — recomputed every 60s. null until astronomy-engine loads.
  const [panchang, setPanchang] = nhS(null);
  nhE(()=>{
    const tick = ()=>{
      const p = (typeof window !== "undefined" && typeof window.computePanchang === "function")
        ? window.computePanchang() : null;
      if (p) setPanchang(p);
    };
    tick();
    // Astronomy Engine loads via CDN; if not ready yet, retry briefly.
    const warm = setInterval(tick, 1500);
    const stopWarm = setTimeout(()=> clearInterval(warm), 15000);
    const id = setInterval(tick, 60000);
    return ()=>{ clearInterval(warm); clearTimeout(stopWarm); clearInterval(id); };
  },[]);
  const railLine = panchang
    ? `TITHI · ${panchang.paksha.toUpperCase()} ${panchang.tithi.toUpperCase()}  ·  NAKSHATRA · ${panchang.nakshatra.toUpperCase()}  ·  YOGA · ${panchang.yoga.toUpperCase()}`
    : "AKARA · VOL. 01 · DHARMA SEASON";
  const metaLine = panchang
    ? `${panchang.paksha.toUpperCase()} ${panchang.tithi.toUpperCase()} · ${panchang.nakshatra.toUpperCase()} · ${panchang.yoga.toUpperCase()}`
    : "Pune · Varanasi · Kumbakonam";

  // Live counts: wallpapers (API-backed), tracks (static list), products (sum across shop categories).
  const [counts, setCounts] = nhS({ wp:0, tr:0, pr:0 });
  nhE(()=>{
    const tick = ()=>{
      const wp = (window.WALLPAPER_ITEMS_LIVE && window.WALLPAPER_ITEMS_LIVE.length)
        || (window.WALLPAPER_ITEMS && window.WALLPAPER_ITEMS.length) || 0;
      const tr = (window.TRACKS && window.TRACKS.length) || 0;
      let pr = 0;
      if (Array.isArray(window.SHOP_CATALOG)){
        pr = window.SHOP_CATALOG.reduce((n,c)=> n + ((c.products && c.products.length) || 0), 0);
      } else if (Array.isArray(window.SHOP_ITEMS)){
        pr = window.SHOP_ITEMS.length;
      }
      setCounts(prev => (prev.wp===wp && prev.tr===tr && prev.pr===pr) ? prev : { wp, tr, pr });
    };
    tick();
    // Wallpapers + SHOP_CATALOG arrive after async/script load — poll briefly, then settle.
    const warm = setInterval(tick, 1500);
    const stopWarm = setTimeout(()=> clearInterval(warm), 20000);
    const id = setInterval(tick, 60000);
    return ()=>{ clearInterval(warm); clearTimeout(stopWarm); clearInterval(id); };
  },[]);
  const pad2 = n => (n < 10 ? "0" + n : "" + n);
  const rightRailLine = `${pad2(counts.wp)} WALLPAPERS · ${pad2(counts.tr)} TRACKS · ${pad2(counts.pr)} PRODUCTS`;

  useScrollBus((y)=>{
    if(!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const h = window.innerHeight;
    const progress = Math.max(0, Math.min(1, -rect.top / h));
    // media dolly — subtle scale + blur at exit
    if (mediaRef.current){
      const s = 1 + progress * 0.12;
      const b = progress * 12;
      mediaRef.current.style.transform = `scale(${s}) translate3d(0, ${progress*40}px, 0)`;
      mediaRef.current.style.filter = `blur(${b}px) brightness(${1 - progress*0.4})`;
    }
    // copy rises and fades
    if (contentRef.current){
      contentRef.current.style.transform = `translate3d(0, ${-progress*60}px, 0)`;
      contentRef.current.style.opacity = `${1 - progress*1.4}`;
    }
  });

  nhE(()=>{
    if(videoRef.current){
      videoRef.current.play().catch(()=>{});
    }
  },[]);

  return (
    <section id="hero" data-screen-label="01 Hero" ref={ref} style={{
      position:"relative",
      height:"112vh",
      background:"#030303",
      overflow:"hidden",
    }}>
      <div style={{ position:"sticky", top:0, height:"100vh", overflow:"hidden" }}>
        {/* video layer */}
        <div ref={mediaRef} style={{
          position:"absolute", inset:0, zIndex:1,
          willChange:"transform, filter",
        }}>
          <video ref={videoRef}
            key={isMobile ? "hero-mobile" : "hero-desktop"}
            autoPlay muted loop playsInline preload="auto" disableRemotePlayback
            style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition: isMobile ? "center 40%" : "center 30%" }}
            onError={(e)=>{
              // Fallback: swap in the animated GIF if the mp4 can't play (iOS Safari low-power / codec)
              const v = e.currentTarget;
              if(v && !v.dataset.fallback){
                v.dataset.fallback = "1";
                const img = document.createElement("img");
                img.src = heroGifFallback;
                img.alt = "";
                img.style.cssText = "width:100%;height:100%;object-fit:cover;object-position:" + (isMobile ? "center 40%" : "center 30%") + ";";
                v.replaceWith(img);
              }
            }}>
            <source src={heroVideo} type="video/mp4"/>
          </video>
          {/* gradient overlays */}
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 50% 40%, rgba(3,3,3,0) 0%, rgba(3,3,3,.25) 50%, rgba(3,3,3,.75) 100%)" }}/>
          <div style={{ position:"absolute", left:0, right:0, bottom:0, height:"35%", background:"linear-gradient(to top, #030303 0%, transparent 100%)" }}/>
          <div style={{ position:"absolute", left:0, right:0, top:0, height:"20%", background:"linear-gradient(to bottom, rgba(3,3,3,.6) 0%, transparent 100%)" }}/>
        </div>

        {/* particles */}
        {tweaks.particles > 0 && <Particles count={tweaks.particles}/>}

        {/* side rails */}
        <div className="hero-side-rail" style={{ position:"absolute", left:40, top:"20vh", bottom:"14vh", zIndex:4, display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", pointerEvents:"none" }}>
          <span title="Live Drik panchang · Lahiri ayanamsa" className="mono" style={{ fontSize:10, letterSpacing:".28em", color:"rgba(255,255,255,.75)", writingMode:"vertical-rl", transform:"rotate(180deg)", whiteSpace:"nowrap" }}>{railLine}</span>
        </div>
        <div className="hero-side-rail" style={{ position:"absolute", right:40, top:"20vh", bottom:"14vh", zIndex:4, display:"flex", flexDirection:"column", justifyContent:"space-between", alignItems:"center", pointerEvents:"none" }}>
          <span className="mono" style={{ fontSize:10, letterSpacing:".28em", color:"rgba(255,255,255,.55)", writingMode:"vertical-rl", whiteSpace:"nowrap" }}>{rightRailLine}</span>
        </div>

        {/* content */}
        <div ref={contentRef} style={{
          position:"relative", zIndex:5, height:"100%",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          textAlign:"center", padding:"0 24px", willChange:"transform, opacity",
        }}>
          <p className="mono fade-in" style={{ fontSize:11, letterSpacing:".4em", color:"rgba(255,255,255,.9)", marginBottom:20, fontWeight:500, animationDelay:".2s" }}>
            {HERO.kicker}
          </p>
          <h1 className="display" style={{
            fontSize:"clamp(40px, 6.2vw, 96px)", lineHeight:1.05, margin:0,
            fontWeight:400, letterSpacing:"-.02em", maxWidth:"24ch",
            textShadow:"0 18px 60px rgba(0,0,0,.5)",
            color:"#fff",
            paddingInline:12,
          }}>
            <StaggerText text="AWAKEN THE" delay={300} step={38} style={{ display:"block" }}/>
            <span style={{ display:"block" }}>
              <StaggerText text={"INNER\u00A0"} delay={700} step={38}/>
              <em style={{
                fontStyle:"italic", fontWeight:400,
                background:"linear-gradient(90deg,#C5A059 0%,#E1A95F 25%,#fff6d9 50%,#E1A95F 75%,#C5A059 100%)",
                backgroundSize:"200% 100%", WebkitBackgroundClip:"text", backgroundClip:"text",
                WebkitTextFillColor:"transparent", color:"transparent",
                animation:"akShimmer 6s ease-in-out infinite",
                display:"inline-block",
                paddingRight:"0.12em",
              }}>SANATANI</em>
            </span>
          </h1>
          <p className="fade-in" style={{
            marginTop:28, maxWidth:620, fontSize:17, lineHeight:1.55,
            color:"rgba(255,255,255,.92)", fontWeight:400, animationDelay:"1.4s",
            textWrap:"balance",
          }}>
            {HERO.sub}
          </p>
          <p className="mono fade-in" style={{
            marginTop:8, fontSize:12, letterSpacing:".18em", color:"rgba(255,255,255,.72)",
            animationDelay:"1.7s",
          }}>
            {HERO.scrollHint}
          </p>
          <div className="fade-in hero-ctas" style={{ marginTop:36, display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center", animationDelay:"2s" }}>
            <MagButton primary href="#wallpapers" onClick={(e)=>{e.preventDefault(); document.getElementById('wallpapers')?.scrollIntoView({behavior:'smooth'});}}>Explore Art</MagButton>
            <MagButton href="#shop" onClick={(e)=>{e.preventDefault(); document.getElementById('shop')?.scrollIntoView({behavior:'smooth'});}}>Shop · objects &amp; prints</MagButton>
            <MagButton href="#music" onClick={(e)=>{e.preventDefault(); document.getElementById('music')?.scrollIntoView({behavior:'smooth'});}}>Listen · {pad2(counts.tr)} tracks ▶</MagButton>
          </div>
        </div>

        {/* bottom meta */}
        <div className="fade-in hero-meta" style={{
          position:"absolute", bottom:32, left:40, right:40, zIndex:5,
          display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center",
          color:"rgba(255,255,255,.65)", animationDelay:"2.3s",
        }}>
          <span title="Live Drik panchang · Lahiri ayanamsa" className="mono" style={{ fontSize:10, letterSpacing:".3em", textTransform:"uppercase" }}>{metaLine}</span>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span className="mono" style={{ fontSize:10, letterSpacing:".3em" }}>SCROLL</span>
            <span style={{ width:1, height:32, background:"var(--gold)", animation:"akBreath 2s infinite" }}/>
          </div>
          <span className="mono" style={{ fontSize:10, letterSpacing:".3em", textTransform:"uppercase", textAlign:"right" }}>© 2026 · A Quiet Catalog</span>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { TopNav, Hero });
