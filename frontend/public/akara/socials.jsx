// Socials — newspaper edition
// SocialsStrip = classic newsprint front-page tease (cream paper, black ink)
// SocialsPage  = dark newsprint broadsheet (charcoal paper, ivory ink)
// Real embeds (X widgets, IG embed, Pinterest profile widget) live inside the broadsheet.

const { useState: scS, useEffect: scE, useRef: scR, useMemo: scM } = React;

// ─────────────────────────────────────────────────────────────────────────────
// Handles + curated permalinks (swap with real Akara post URLs as you publish)
// ─────────────────────────────────────────────────────────────────────────────
const SOCIAL_HANDLES = {
  x:         { user:"akara__1",     alias:"AKARA", url:"https://x.com/akara__1" },
  instagram: { user:"akaraxstudio", alias:"AKARA", url:"https://instagram.com/akaraxstudio" },
  pinterest: { user:"akaraxstudio", alias:"AKARA", url:"https://pinterest.com/akaraxstudio" },
};

// Fallback URLs are placeholders. The real wire is fetched at runtime from:
//   /content/social/twitter-posts.json   (akara-twitter-poller Lambda)
//   /content/social/instagram-posts.json (akara-instagram-poller Lambda)
// Hook: useLivePosts(jsonPath, fallbackUrls) — defined below.
const CURATED = {
  x: [
    "https://twitter.com/akara__1/status/1800000000000000001",
    "https://twitter.com/akara__1/status/1800000000000000002",
    "https://twitter.com/akara__1/status/1800000000000000003",
    "https://twitter.com/akara__1/status/1800000000000000004",
  ],
  instagram: [
    "https://www.instagram.com/p/Cxxxxxxxxx1/",
    "https://www.instagram.com/p/Cxxxxxxxxx2/",
    "https://www.instagram.com/reel/Cxxxxxxxxx3/",
    "https://www.instagram.com/p/Cxxxxxxxxx4/",
    "https://www.instagram.com/p/Cxxxxxxxxx5/",
    "https://www.instagram.com/p/Cxxxxxxxxx6/",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Edition data (the "gimmicks" — restrained but real)
// ─────────────────────────────────────────────────────────────────────────────
const EDITION = {
  vol: "III",
  issue: "12",
  date: "Vaisakha Shukla · Tritiya",
  gregorian: "Wednesday, 30 April 2026",
  city: "PUNE",
  price: "Free with attention",
  weather: {
    studio: "Loom warm · incense lit",
    sky:    "Clear · 31°C",
    sun:    "Sunrise 6:14 · Sunset 7:08",
  },
};

// Live masthead values — real Gregorian date (always) and live panchang where
// the panchang engine (window.computePanchang from panchang.jsx) is loaded.
// Falls back gracefully so the masthead is never stale on the homepage.
function liveEdition(){
  const now = new Date();
  let gregorian = EDITION.gregorian;
  try {
    gregorian = now.toLocaleDateString("en-IN", { weekday:"long", year:"numeric", month:"long", day:"numeric", timeZone:"Asia/Kolkata" });
  } catch(e){}
  let panchang = null;
  try {
    if (typeof computePanchang === "function") {
      const p = computePanchang(now);
      if (p) panchang = `${p.paksha} ${p.tithi} · ${p.nakshatra}`;
    }
  } catch(e){}
  return { gregorian, panchang: panchang || EDITION.date };
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform glyph marks (currentColor)
// ─────────────────────────────────────────────────────────────────────────────
const SocialMark = ({ kind, size=22, ...rest })=>{
  const common = { width:size, height:size, viewBox:"0 0 24 24", fill:"currentColor", ...rest };
  if (kind === "x") return (
    <svg {...common}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.643Z"/></svg>
  );
  if (kind === "instagram") return (
    <svg {...common}><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16ZM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.13 1.38C1.35 2.68.94 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13.67.66 1.34 1.07 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.31 1.46-.72 2.13-1.38.66-.67 1.07-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.31-.79-.72-1.46-1.38-2.13C21.32 1.35 20.65.94 19.86.63 19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0Zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84Zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4Zm6.4-11.85a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44Z"/></svg>
  );
  if (kind === "pinterest") return (
    <svg {...common}><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.748-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z"/></svg>
  );
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Embed loaders — idempotent
// ─────────────────────────────────────────────────────────────────────────────
function loadScript(src, id){
  return new Promise((resolve)=>{
    if(id && document.getElementById(id)) return resolve();
    const s = document.createElement("script");
    s.src = src; s.async = true; if(id) s.id = id;
    s.onload = ()=>resolve(); s.onerror = ()=>resolve();
    document.head.appendChild(s);
  });
}
const Embeds = {
  twitter:   ()=> loadScript("https://platform.twitter.com/widgets.js", "twitter-wjs").then(()=>{ if(window.twttr?.widgets) window.twttr.widgets.load(); }),
  instagram: ()=> loadScript("https://www.instagram.com/embed.js",      "instagram-wjs").then(()=>{ if(window.instgrm?.Embeds) window.instgrm.Embeds.process(); }),
  pinterest: ()=> loadScript("https://assets.pinterest.com/js/pinit.js","pinterest-wjs").then(()=>{ if(window.PinUtils?.build) window.PinUtils.build(); }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Embeds
// ─────────────────────────────────────────────────────────────────────────────
function XEmbed({ url, dark=true }){
  const ref = scR(null);
  scE(()=>{ Embeds.twitter().then(()=>{ if(ref.current && window.twttr?.widgets) window.twttr.widgets.load(ref.current); }); }, [url]);
  return (
    <div ref={ref} className="np-embed np-embed-x" style={{
      background: dark ? "rgba(255,255,255,.02)" : "transparent",
      padding: dark ? 10 : 0, minHeight: 280,
    }}>
      <blockquote className="twitter-tweet" data-theme={dark ? "dark" : "light"} data-conversation="none" data-dnt="true">
        <a href={url}>Loading wire…</a>
      </blockquote>
    </div>
  );
}

function IGEmbed({ url, dark=true }){
  const ref = scR(null);
  scE(()=>{ Embeds.instagram().then(()=>{ if(window.instgrm?.Embeds) window.instgrm.Embeds.process(); }); }, [url]);
  return (
    <div ref={ref} className="np-embed np-embed-ig" style={{
      background: dark ? "#000" : "#fff",
      minHeight: 480, overflow:"hidden",
    }}>
      <blockquote className="instagram-media"
        data-instgrm-permalink={url} data-instgrm-version="14" data-instgrm-captioned
        style={{ background: dark ? "#000" : "#fff", border:0, margin:0, maxWidth:540, minWidth:260, padding:0, width:"100%" }}>
        <a href={url} style={{ display:"block", padding:"40px 24px", color:"#888", textDecoration:"none" }}>Loading dispatch…</a>
      </blockquote>
    </div>
  );
}

function PinterestProfile({ user, width=236, height=600, cols=4 }){
  const ref = scR(null);
  scE(()=>{ Embeds.pinterest().then(()=>{ if(window.PinUtils?.build) window.PinUtils.build(); }); }, [user]);
  return (
    <div ref={ref} className="np-embed np-embed-pin" style={{
      display:"grid", placeItems:"center", minHeight: 600,
      padding: 12,
    }}>
      <a data-pin-do="embedUser"
         data-pin-board-width={width * cols + 24}
         data-pin-scale-height={height}
         data-pin-scale-width={width / 4}
         href={`https://www.pinterest.com/${user}/`}>Loading reference vault…</a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Newspaper primitives
// ─────────────────────────────────────────────────────────────────────────────
function NewspaperRule({ thick=false, double=false, color="currentColor", style }){
  if (double) return (
    <div style={{ height: 6, borderTop:`1px solid ${color}`, borderBottom:`1px solid ${color}`, ...style }}/>
  );
  return <div style={{ height: thick ? 3 : 1, background: color, ...style }}/>;
}

// Masthead — used by both strip and broadsheet, dark/light variants
function Masthead({ dark=false, sub="The Studio Edition", showStrip=true }){
  const ink   = dark ? "#f4ede1" : "#0a0a08";
  const muted = dark ? "rgba(244,237,225,.55)" : "rgba(10,10,8,.55)";
  const ed = liveEdition();
  return (
    <div className="np-masthead" style={{ color:ink, fontFamily:"var(--display)" }}>
      {showStrip && (
        <div className="np-edition-strip" style={{
          display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", gap:18,
          fontFamily:"var(--mono)", fontSize:10, letterSpacing:".24em", textTransform:"uppercase",
          color: muted, paddingBottom: 12,
        }}>
          <div style={{ textAlign:"left" }}>VOL. {EDITION.vol} · ISSUE {EDITION.issue} · {EDITION.city}</div>
          <div style={{ textAlign:"center", color:ink, letterSpacing:".3em" }}>{ed.gregorian}</div>
          <div style={{ textAlign:"right" }}>{EDITION.price}</div>
        </div>
      )}
      <NewspaperRule color={ink}/>
      <div style={{ textAlign:"center", padding:"14px 0 10px" }}>
        <h1 className="np-title" style={{
          margin:0, fontStyle:"italic", fontWeight:400,
          fontSize:"clamp(58px, 11vw, 156px)", lineHeight:.92, letterSpacing:"-.02em",
        }}>Akara Times</h1>
        <div style={{
          marginTop:6, fontFamily:"var(--mono)", fontSize:10, letterSpacing:".42em",
          textTransform:"uppercase", color:muted,
        }}>
          सत्यम् शिवम् सुन्दरम् · {sub}
        </div>
      </div>
      <NewspaperRule double color={ink}/>
      <div className="np-weather" style={{
        display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:18,
        padding:"10px 0", fontFamily:"var(--mono)", fontSize:10, letterSpacing:".22em",
        textTransform:"uppercase", color:muted,
      }}>
        <div><span style={{color:ink}}>PANCHANG</span> · {ed.panchang}</div>
        <div><span style={{color:ink}}>STUDIO</span> · {EDITION.weather.studio}</div>
        <div><span style={{color:ink}}>SKY</span> · {EDITION.weather.sky}</div>
        <div><span style={{color:ink}}>SUN</span> · {EDITION.weather.sun}</div>
      </div>
      <NewspaperRule color={ink}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SocialsStrip — classic newsprint, cream paper, front-page tease
// ─────────────────────────────────────────────────────────────────────────────
function SocialsStrip(){
  const ref = scR(null);
  const observed = useInView(ref, { threshold: 0.15 });
  const [seen, setSeen] = scS(true);
  scE(()=>{ if(observed) setSeen(true); }, [observed]);
  const inView = seen;

  const open = (e)=>{ e?.preventDefault?.(); window.__openSocials?.(); };

  const editorial = useEditorial();
  const lead = editorial[0];

  const leads = [
    {
      kind:"instagram",
      kicker:"FROM THE FEEDS",
      headline:"A new reel: Radha-Krishna in indigo, set to the rāga of dusk",
      dek:"The studio's loom and pigment table feature in a 38-second devotional cut released this morning to @akaraxstudio.",
      meta:"@akaraxstudio · Reel · 2 hrs ago",
      byline:"By the studio",
      drop:"A",
    },
    {
      kind:"x",
      kicker:"WIRE DISPATCH",
      headline:"Why Sanatani aesthetics belong on the home screen",
      dek:"In a thread of seven, @akara__1 argues that ornament is not decoration but devotion — a position that has drawn 4,300 reposts since dawn.",
      meta:"@akara__1 · Thread · This morning",
      byline:"Filed from the studio",
      drop:"O",
    },
    {
      kind:"pinterest",
      kicker:"PINNED THIS WEEK",
      headline:"Reference vault: temple stonework, a study in repetition",
      dek:"Sixteen new pins added to the Akara reference board — pillars from Hampi, jaali screens from Fatehpur Sikri, palm-leaf manuscripts from the south.",
      meta:"@akaraxstudio · 16 new pins",
      byline:"Curated by the studio",
      drop:"T",
    },
  ];

  return (
    <section id="socials" ref={ref} style={{
      position:"relative", padding:"110px 24px", background:"#030303", overflow:"hidden",
    }}>
      <div className="np-paper" style={{
        position:"relative", maxWidth:1180, margin:"0 auto",
        background:"#f4ede1",
        color:"#0a0a08",
        padding:"36px 48px 44px",
        boxShadow:"0 40px 100px rgba(0,0,0,.6), 0 4px 0 rgba(0,0,0,.5)",
        transform: inView ? "rotate(-.4deg)" : "rotate(-.4deg) translateY(20px)",
        opacity: inView ? 1 : 0,
        transition:"opacity 1s var(--ease-out), transform 1s var(--ease-out)",
        fontFamily:"var(--display)",
      }}>
        <div aria-hidden style={{
          position:"absolute", inset:0, pointerEvents:"none", opacity:.18, mixBlendMode:"multiply",
          backgroundImage:"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .35 0 0 0 0 .3 0 0 0 0 .22 0 0 0 .8 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}/>
        <div aria-hidden style={{
          position:"absolute", top:-20, right:-30, width:260, height:260, borderRadius:"50%",
          background:"radial-gradient(circle, rgba(140,80,30,.18), transparent 60%)",
          pointerEvents:"none",
        }}/>

        <div style={{ position:"relative" }}>
          <Masthead dark={false} sub="The Studio Edition · Front Page"/>

          {lead && (
            <a href={lead.url} className="np-times-lead" style={{
              display:"block", textDecoration:"none", color:"#0a0a08",
              padding:"22px 0 24px", marginTop:6, borderBottom:"3px double #0a0a08",
            }}>
              <div style={{
                display:"flex", alignItems:"center", gap:10, flexWrap:"wrap",
                fontFamily:"var(--mono)", fontSize:10, letterSpacing:".3em",
                textTransform:"uppercase", color:"#7a1a14", marginBottom:10,
              }}>
                <span>Today's Dispatch</span>
                <span style={{opacity:.4}}>·</span>
                <span style={{color:"rgba(10,10,8,.6)"}}>{lead.category}{lead.festivalName ? ` · ${lead.festivalName}` : ""}</span>
              </div>
              <h2 style={{
                margin:"0 0 10px", fontFamily:"var(--display)", fontStyle:"italic", fontWeight:400,
                fontSize:"clamp(28px, 4vw, 46px)", lineHeight:1.02, letterSpacing:"-.01em",
                color:"#0a0a08", textWrap:"balance",
              }}>{lead.title}</h2>
              <p style={{
                margin:"0 0 10px", fontFamily:"'Iowan Old Style', Georgia, serif",
                fontSize:15.5, lineHeight:1.55, color:"#1a1a16", maxWidth:"68ch",
              }}>{lead.dek}</p>
              <span style={{
                fontFamily:"var(--mono)", fontSize:10, letterSpacing:".24em",
                textTransform:"uppercase", color:"#7a1a14",
              }}>Read the full dispatch →</span>
            </a>
          )}

          <div className="np-leads" style={{
            display:"grid", gridTemplateColumns:"1fr 1px 1fr 1px 1fr",
            gap:0, paddingTop:30, paddingBottom:18,
          }}>
            {leads.map((l, i)=>(
              <React.Fragment key={l.kind}>
                {i > 0 && <div style={{ background:"#0a0a08", opacity:.18 }}/>}
                <article className="np-lead" style={{
                  padding: i === 0 ? "0 26px 0 0" : i === leads.length-1 ? "0 0 0 26px" : "0 26px",
                }}>
                  <div className="np-kicker" style={{
                    display:"flex", alignItems:"center", gap:10,
                    fontFamily:"var(--mono)", fontSize:10, letterSpacing:".3em",
                    textTransform:"uppercase", color:"#0a0a08",
                    paddingBottom:10, marginBottom:14, borderBottom:"1px solid #0a0a08",
                  }}>
                    <SocialMark kind={l.kind} size={12}/>
                    <span>{l.kicker}</span>
                  </div>
                  <h2 className="np-headline" style={{
                    margin:"0 0 10px", fontFamily:"var(--display)", fontWeight:400, fontStyle:"normal",
                    fontSize:"clamp(22px, 2.1vw, 30px)", lineHeight:1.08, letterSpacing:"-.01em",
                    color:"#0a0a08", textWrap:"balance",
                  }}>
                    {l.headline}
                  </h2>
                  <p className="np-dek" style={{
                    margin:"0 0 12px", fontFamily:"'Iowan Old Style', Georgia, serif",
                    fontSize:14, lineHeight:1.55, color:"#1a1a16", textAlign:"justify", hyphens:"auto",
                  }}>
                    <span className="np-drop" style={{
                      float:"left", fontFamily:"var(--display)", fontStyle:"italic",
                      fontSize:46, lineHeight:.85, marginRight:8, marginTop:4,
                      color:"#0a0a08",
                    }}>{l.drop}</span>
                    {l.dek}
                  </p>
                  <div className="np-byline" style={{
                    fontFamily:"var(--mono)", fontSize:9, letterSpacing:".22em",
                    textTransform:"uppercase", color:"rgba(10,10,8,.55)",
                    paddingTop:10, borderTop:"1px solid rgba(10,10,8,.18)",
                    display:"flex", justifyContent:"space-between", gap:8,
                  }}>
                    <span>{l.byline}</span>
                    <span>{l.meta}</span>
                  </div>
                </article>
              </React.Fragment>
            ))}
          </div>

          <NewspaperRule double color="#0a0a08"/>

          <div className="np-tease-foot" style={{
            display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center",
            paddingTop:18, gap:24,
          }}>
            <div style={{ fontFamily:"var(--mono)", fontSize:10, letterSpacing:".24em", textTransform:"uppercase", color:"rgba(10,10,8,.6)" }}>
              CONTINUED ON THE INSIDE PAGES →
            </div>
            <a href="#socials-page" onClick={open} className="np-cta-print" style={{
              display:"inline-flex", alignItems:"center", gap:14,
              padding:"14px 26px", border:"1.5px solid #0a0a08", borderRadius:0,
              fontFamily:"var(--mono)", fontSize:11, letterSpacing:".24em", textTransform:"uppercase",
              color:"#f4ede1", background:"#0a0a08", textDecoration:"none",
              transition:"all .25s var(--ease)",
            }}
              onMouseEnter={(e)=>{ e.currentTarget.style.background="#7a1a14"; e.currentTarget.style.borderColor="#7a1a14"; }}
              onMouseLeave={(e)=>{ e.currentTarget.style.background="#0a0a08"; e.currentTarget.style.borderColor="#0a0a08"; }}>
              Read the full edition
              <span style={{ fontSize:14 }}>→</span>
            </a>
            <div style={{ fontFamily:"var(--mono)", fontSize:10, letterSpacing:".24em", textTransform:"uppercase", color:"rgba(10,10,8,.6)", textAlign:"right" }}>
              Three sections · Live wires · Free
            </div>
          </div>
        </div>
      </div>

      <div className="np-handles" style={{
        maxWidth:1180, margin:"22px auto 0", display:"flex", justifyContent:"center", gap:36,
        fontFamily:"var(--mono)", fontSize:10, letterSpacing:".28em", textTransform:"uppercase",
        color:"rgba(255,255,255,.45)",
      }}>
        <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}><SocialMark kind="instagram" size={12}/> @akaraxstudio</span>
        <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}><SocialMark kind="x" size={11}/> @akara__1</span>
        <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}><SocialMark kind="pinterest" size={12}/> @akaraxstudio</span>
      </div>

      <style dangerouslySetInnerHTML={{__html:`
        @media (max-width: 980px){
          .np-paper{padding:28px 28px 32px !important; transform:rotate(0deg) !important}
          .np-leads{grid-template-columns:1fr !important; gap:24px !important}
          .np-leads > div[style*="background"][style*="opacity"]{height:1px; width:100%;}
          .np-lead{padding:18px 0 !important; border-top:1px solid rgba(10,10,8,.18)}
          .np-lead:first-of-type{border-top:0; padding-top:24px !important}
          .np-tease-foot{grid-template-columns:1fr !important; text-align:center; gap:14px !important}
          .np-tease-foot > div{text-align:center !important}
          .np-handles{flex-wrap:wrap; gap:20px !important}
          .np-edition-strip{grid-template-columns:1fr !important; gap:6px !important; text-align:center}
          .np-edition-strip > div{text-align:center !important}
          .np-weather{grid-template-columns:1fr 1fr !important; gap:8px !important; font-size:9px !important}
        }
        @media (max-width: 720px){
          #socials{padding:70px 14px 80px !important}
          .np-paper{padding:22px 18px 26px !important}
          .np-title{font-size:46px !important}
        }
      `}}/>
    </section>
  );
}

// ContinueLink — gold monospace pointer that smoothly scrolls to an anchored
// inside page. Renders as a real <a> for accessibility / right-click open.
function ContinueLink({ href, label }){
  const onClick = (e)=>{
    e.preventDefault();
    const id = href.replace(/^#/, "");
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <a href={href} onClick={onClick} className="mono" style={{
      display:"block", fontSize:10, letterSpacing:".3em", color:"var(--gold)",
      textTransform:"uppercase", textDecoration:"none",
      borderTop:"1px solid rgba(244,237,225,.25)", paddingTop:10, marginTop:4,
      cursor:"pointer", transition:"opacity .2s ease",
    }}
    onMouseEnter={(e)=>{ e.currentTarget.style.opacity = "0.7"; }}
    onMouseLeave={(e)=>{ e.currentTarget.style.opacity = "1"; }}>
      {label} ↓
    </a>
  );
}

// useLivePosts — fetch a JSON wire from the assets bucket. Used for both the
// Twitter poller's twitter-posts.json and the Instagram poller's
// instagram-posts.json — both files share the shape:
//   { posts: [ { url, ...platform fields, article? } ] }
// where article = { headline, dek, lede, body } when Claude generation
// succeeded. Falls back to placeholder URLs while loading or if the fetch
// fails, so the layout never collapses.
function useLivePosts(jsonPath, fallbackUrls){
  const [posts, setPosts] = scS(()=>fallbackUrls.map(u => ({ url: u })));
  scE(()=>{
    let alive = true;
    fetch(jsonPath, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!alive || !json?.posts?.length) return;
        setPosts(json.posts);
      })
      .catch(()=>{});
    return ()=>{ alive = false; };
  }, [jsonPath]);
  return posts;
}

// useEditorial — fetch the daily Akara Times articles written by the
// akara-times-daily Lambda. Shape: { updated_at, articles: [ {slug, url,
// title, dek, lede, category, deity, festivalName, image:{url,alt,width,
// height}, datePublished, panchang} ] }. Each links to a crawlable /times/{slug}.
function useEditorial(){
  const [articles, setArticles] = scS([]);
  scE(()=>{
    let alive = true;
    fetch("/content/editorial/akara-times.json", { cache:"no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (alive && j && j.articles && j.articles.length) setArticles(j.articles); })
      .catch(()=>{});
    return ()=>{ alive = false; };
  }, []);
  return articles;
}

// ═════════════════════════════════════════════════════════════════════════════
// SocialsPage — DARK newsprint broadsheet (overlay)
// ═════════════════════════════════════════════════════════════════════════════
function SocialsPage({ onClose }){
  const xPosts  = useLivePosts("/content/social/twitter-posts.json",  CURATED.x);
  const igPosts = useLivePosts("/content/social/instagram-posts.json", CURATED.instagram);
  const editorial = useEditorial();
  // Convenience for places that still want bare URLs (front-page teaser, etc).
  const xUrls = xPosts.map(p => p.url);

  scE(()=>{
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return ()=>{ document.body.style.overflow = prev; };
  },[]);
  scE(()=>{
    const onKey = (e)=>{ if(e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return ()=>window.removeEventListener("keydown", onKey);
  },[onClose]);

  return (
    <div className="np-broadsheet" style={{
      position:"fixed", inset:0, zIndex:60, background:"#161310",
      animation:"akFadeIn .35s var(--ease-out) both",
      overflowY:"auto", overflowX:"hidden",
      color:"#f4ede1",
    }}>
      <div aria-hidden style={{
        position:"fixed", inset:0, pointerEvents:"none", opacity:.06, mixBlendMode:"screen", zIndex:1,
        backgroundImage:"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .9 0 0 0 0 .85 0 0 0 0 .75 0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      }}/>

      <button onClick={onClose} aria-label="Close edition" style={{
        position:"fixed", top:22, right:24, zIndex:10,
        width:42, height:42, borderRadius:0, border:"1px solid #f4ede1",
        background:"#161310", color:"#f4ede1", cursor:"pointer",
        display:"grid", placeItems:"center", fontSize:18, fontFamily:"var(--mono)",
      }}>×</button>

      <div className="np-bs-body" style={{ position:"relative", zIndex:2, maxWidth:1280, margin:"0 auto", padding:"36px 36px 120px" }}>
        <Masthead dark sub="The Studio Edition · Inside Pages"/>

        {/* ── AKARA TIMES — the daily editorial dispatches (akara-times-daily) ──
            Lead story + a grid of recent dispatches, each linking to its own
            crawlable /times/{slug} page. This is the in-app face of the SEO
            article engine. */}
        {editorial.length > 0 && (
          <section id="page-times" style={{ paddingTop:34, scrollMarginTop:24 }}>
            <SectionHead num="I" title="Akara Times" sub="Daily dispatches · Sanatana Dharma" big/>
            <a href={editorial[0].url} className="np-times-hero" style={{
              display:"grid", gridTemplateColumns: editorial[0].image ? "1.5fr 1fr" : "1fr", gap:32,
              textDecoration:"none", color:"#f4ede1", padding:"6px 0 28px",
              borderBottom:"1px solid rgba(244,237,225,.2)",
            }}>
              <div>
                <div className="mono" style={{ fontSize:10, letterSpacing:".3em", color:"var(--gold)", marginBottom:8 }}>
                  {editorial[0].category}{editorial[0].festivalName ? ` · ${editorial[0].festivalName}` : ""}
                </div>
                <h2 style={{
                  fontFamily:"var(--display)", fontStyle:"italic", fontSize:"clamp(32px, 4.2vw, 56px)",
                  lineHeight:.98, letterSpacing:"-.02em", margin:"0 0 14px", fontWeight:400, color:"#f4ede1", textWrap:"balance",
                }}>{editorial[0].title}</h2>
                {editorial[0].dek && <p style={{
                  fontFamily:"'Iowan Old Style', Georgia, serif", fontStyle:"italic", fontSize:18,
                  lineHeight:1.45, color:"rgba(244,237,225,.85)", margin:"0 0 16px", textWrap:"balance",
                }}>{editorial[0].dek}</p>}
                {editorial[0].lede && <p style={{
                  fontFamily:"'Iowan Old Style', Georgia, serif", fontSize:15, lineHeight:1.6,
                  color:"rgba(244,237,225,.72)", margin:0, textAlign:"justify", hyphens:"auto",
                }}>{editorial[0].lede}</p>}
                <span className="mono" style={{ display:"inline-block", marginTop:14, fontSize:10, letterSpacing:".24em", textTransform:"uppercase", color:"var(--gold)" }}>Read the full dispatch →</span>
              </div>
              {editorial[0].image && (
                <div aria-hidden style={{ width:"100%", aspectRatio:"4 / 5", backgroundImage:`url(${editorial[0].image.url})`, backgroundSize:"cover", backgroundPosition:"center", border:"1px solid rgba(244,237,225,.2)" }}/>
              )}
            </a>
            {editorial.length > 1 && (
              <div className="np-times-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:0 }}>
                {editorial.slice(1, 7).map((a, i)=>(
                  <a key={a.slug} href={a.url} className="np-cell" style={{
                    padding:"22px", textDecoration:"none", color:"#f4ede1",
                    borderRight: (i % 3 !== 2) ? "1px solid rgba(244,237,225,.2)" : "none",
                    borderBottom:"1px solid rgba(244,237,225,.2)",
                  }}>
                    {a.image && <div aria-hidden style={{ width:"100%", aspectRatio:"3 / 2", backgroundImage:`url(${a.image.url})`, backgroundSize:"cover", backgroundPosition:"center", marginBottom:12, border:"1px solid rgba(244,237,225,.15)" }}/>}
                    <div className="mono" style={{ fontSize:9, letterSpacing:".3em", color:"var(--gold)", marginBottom:6 }}>{a.category}</div>
                    <h4 style={{ fontFamily:"var(--display)", fontStyle:"italic", fontSize:19, lineHeight:1.1, margin:"0 0 8px", fontWeight:400, color:"#f4ede1", textWrap:"balance" }}>{a.title}</h4>
                    {a.dek && <p style={{ fontFamily:"'Iowan Old Style', Georgia, serif", fontSize:12.5, lineHeight:1.5, color:"rgba(244,237,225,.7)", margin:0 }}>{a.dek}</p>}
                  </a>
                ))}
              </div>
            )}
            <div style={{ margin:"54px 0 10px" }}><NewspaperRule double color="#f4ede1"/></div>
          </section>
        )}

        {/* ── ABOVE THE FOLD ────────────────────────────────────────────────
            A real broadsheet front: asymmetric collage (Old City News
            reference). NO live widget embeds on the front — they each
            have their own dedicated inside section where there's room
            to breathe. Front page is text-driven typography with
            clickable "Continue" anchors that scroll to the relevant page. */}
        <section className="np-fold" style={{
          display:"grid",
          gridTemplateColumns:"2.2fr 1.2fr",
          gap:0, paddingTop:36, alignItems:"stretch",
        }}>
          {/* A1 — Hero (widest column, takes the lead story).
              Flex column so the ContinueLink can pin to the bottom and the
              left column ends visually at the same height as the A2+A3 stack
              on the right (the right column defines the natural floor). */}
          <div className="np-col" style={{
            paddingRight:36, borderRight:"1px solid rgba(244,237,225,.2)",
            display:"flex", flexDirection:"column",
          }}>
            <SectionHead num="A1" title="Above the fold" sub="Featured this edition · X" platform="x"/>
            <h2 style={{
              fontFamily:"var(--display)", fontStyle:"italic",
              fontSize:"clamp(38px, 4.6vw, 68px)", lineHeight:.96, letterSpacing:"-.02em",
              margin:"6px 0 18px", fontWeight:400, color:"#f4ede1", textWrap:"balance",
            }}>
              {xPosts[0]?.article?.headline || "Filed from the studio."}
            </h2>
            {xPosts[0]?.article?.dek && (
              <p style={{
                fontFamily:"'Iowan Old Style', Georgia, serif", fontStyle:"italic",
                fontSize:18, lineHeight:1.45, color:"rgba(244,237,225,.85)",
                margin:"0 0 22px", textWrap:"balance",
              }}>
                {xPosts[0].article.dek}
              </p>
            )}
            {xPosts[0]?.article?.lede && (
              <p style={{
                fontFamily:"'Iowan Old Style', Georgia, serif", fontSize:15, lineHeight:1.62,
                color:"rgba(244,237,225,.78)", marginBottom:14, textAlign:"justify", hyphens:"auto",
              }}>
                <span style={{
                  float:"left", fontFamily:"var(--display)", fontStyle:"italic",
                  fontSize:64, lineHeight:.8, marginRight:10, marginTop:6, color:"var(--gold)",
                }}>{xPosts[0].article.lede.charAt(0)}</span>
                {xPosts[0].article.lede.slice(1)}
              </p>
            )}
            <div style={{ marginTop:"auto" }}>
              <ContinueLink href="#page-x" label="Continue on Page 3"/>
            </div>
          </div>

          {/* A2 + A3 stacked vertically in the right column */}
          <div className="np-col-stack" style={{ paddingLeft:30 }}>
            {/* A2 — Pinterest teaser (top) */}
            <div style={{ paddingBottom:24, borderBottom:"1px solid rgba(244,237,225,.2)" }}>
              <SectionHead num="A2" title="The reference vault" sub="Live · Pinterest profile" platform="pinterest"/>
              <h3 style={{
                fontFamily:"var(--display)", fontStyle:"italic", fontSize:30, lineHeight:1.05,
                margin:"6px 0 14px", fontWeight:400, color:"#f4ede1", letterSpacing:"-.01em",
                textWrap:"balance",
              }}>
                Sixteen new pins added since Sunday.
              </h3>
              <p style={{
                fontFamily:"'Iowan Old Style', Georgia, serif", fontSize:13.5, lineHeight:1.55,
                color:"rgba(244,237,225,.72)", marginBottom:16, textAlign:"justify", hyphens:"auto",
              }}>
                <span style={{
                  float:"left", fontFamily:"var(--display)", fontStyle:"italic",
                  fontSize:42, lineHeight:.8, marginRight:8, marginTop:4, color:"var(--gold)",
                }}>T</span>
                he studio's reference board grew this week with stonework from Hampi, jaali screens from Fatehpur Sikri, and palm-leaf manuscripts from the south.
              </p>
              <ContinueLink href="#page-pinterest" label="Continue on Page 4"/>
            </div>

            {/* A3 — Instagram brief (bottom) */}
            <div style={{ paddingTop:24 }}>
              <SectionHead num="A3" title="From the feeds" sub="Featured · Instagram" platform="instagram"/>
              <h3 style={{
                fontFamily:"var(--display)", fontStyle:"italic", fontSize:26, lineHeight:1.08,
                margin:"6px 0 12px", fontWeight:400, color:"#f4ede1", letterSpacing:"-.01em",
                textWrap:"balance",
              }}>
                {igPosts[0]?.article?.headline || "On the loom: a new reel from the prayer room."}
              </h3>
              <p style={{
                fontFamily:"'Iowan Old Style', Georgia, serif", fontSize:13, lineHeight:1.55,
                color:"rgba(244,237,225,.7)", marginBottom:14, textAlign:"justify", hyphens:"auto",
              }}>
                {igPosts[0]?.article?.dek || "Filed at dawn from a small room above the studio, this morning's reel was shot on a single camera. Captioned only \"बंधन\" (binding)."}
              </p>
              <ContinueLink href="#page-instagram" label="Continue on Page 2"/>
            </div>
          </div>
        </section>

        {/* ── DIVIDER: section break ──────────────────────────────────────── */}
        <div style={{ margin:"60px 0 40px" }}>
          <NewspaperRule color="#f4ede1"/>
          <div style={{
            display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", padding:"14px 0",
            fontFamily:"var(--mono)", fontSize:10, letterSpacing:".32em", textTransform:"uppercase",
            color:"rgba(244,237,225,.55)",
          }}>
            <span>END OF FRONT PAGE</span>
            <span style={{ color:"var(--gold)", letterSpacing:".5em" }}>· · ·</span>
            <span style={{ textAlign:"right" }}>TURN THE PAGE</span>
          </div>
          <NewspaperRule color="#f4ede1"/>
        </div>

        {/* ── PAGE 2: INSTAGRAM, three-up grid ─────────────────────────────
            3-up (not 4) — IG embed iframes have a hard min-width that pushed
            a 4th column off the right edge of the 1280px container. 3-up
            also gives each cell room to breathe and shows the headline
            without crowding. */}
        <section id="page-instagram" className="np-page2" style={{ scrollMarginTop:24 }}>
          <SectionHead num="B" title="From the feeds" sub="Instagram · Page 2" big platform="instagram"/>
          <p style={{
            fontFamily:"'Iowan Old Style', Georgia, serif", fontSize:15, lineHeight:1.6,
            color:"rgba(244,237,225,.78)", maxWidth:760, margin:"0 0 30px", textAlign:"justify",
          }}>
            Daily devotionals from <strong style={{color:"#f4ede1"}}>@akaraxstudio</strong> — reels, prints, and behind-the-loom moments. Selected from the past fortnight by the studio.
          </p>
          <div className="np-ig-grid" style={{
            display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:0,
            borderTop:"1px solid rgba(244,237,225,.2)",
          }}>
            {(igPosts.length ? igPosts : CURATED.instagram.map(u => ({ url: u }))).slice(0, 3).map((post, i)=>{
              const kindLabel = post.media_type === "VIDEO" ? "Reel"
                : post.media_type === "CAROUSEL_ALBUM" ? "Carousel" : "Post";
              return (
                <div key={post.url || i} className="np-cell" style={{
                  padding:22,
                  borderRight: i < 2 ? "1px solid rgba(244,237,225,.2)" : "none",
                  borderBottom:"1px solid rgba(244,237,225,.2)",
                }}>
                  <div className="np-cell-num mono" style={{
                    fontSize:10, letterSpacing:".3em", color:"var(--gold)", marginBottom:8,
                  }}>NO. {String(i+1).padStart(2,"0")}</div>
                  {post.article?.headline && (
                    <h4 style={{
                      fontFamily:"var(--display)", fontStyle:"italic", fontSize:20, lineHeight:1.1,
                      margin:"0 0 12px", fontWeight:400, color:"#f4ede1", textWrap:"balance",
                    }}>
                      {post.article.headline}
                    </h4>
                  )}
                  <IGEmbed url={post.url} dark/>
                  <Caption text={`Dispatch · ${kindLabel}`}/>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── PAGE 4 (interlude): PINTEREST profile ─────────────────────────
            Moved off the front page and given its own room. The full
            live profile widget anchors this page; the front page A2
            teaser links here via #page-pinterest. */}
        <section id="page-pinterest" style={{ marginTop:80, scrollMarginTop:24 }}>
          <SectionHead num="P" title="The reference vault" sub="Pinterest · Page 4" big platform="pinterest"/>
          <p style={{
            fontFamily:"'Iowan Old Style', Georgia, serif", fontSize:15, lineHeight:1.6,
            color:"rgba(244,237,225,.78)", maxWidth:760, margin:"0 0 30px", textAlign:"justify",
          }}>
            The studio's reference board: stonework from Hampi, jaali screens from Fatehpur Sikri, palm-leaf manuscripts from the south. Pinned by <strong style={{color:"#f4ede1"}}>@akaraxstudio</strong> and updating live.
          </p>
          {/* Pinterest's widget renders a white card we can't restyle (it's
              a cross-origin iframe). Wrap it in a cream "newsprint clipping"
              panel so the whiteness reads as intentional pasted-in paper
              rather than a UI bug — same visual language as the front-page
              SocialsStrip cream-on-dark composition. */}
          <div className="np-pin-clipping" style={{
            position:"relative",
            background:"#f4ede1",
            padding:"36px 32px 28px",
            margin:"0 auto",
            maxWidth:1080,
            boxShadow:"0 30px 80px rgba(0,0,0,.5), 0 4px 0 rgba(0,0,0,.4)",
            transform:"rotate(-.3deg)",
          }}>
            <div aria-hidden style={{
              position:"absolute", inset:0, pointerEvents:"none", opacity:.18, mixBlendMode:"multiply",
              backgroundImage:"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .35 0 0 0 0 .3 0 0 0 0 .22 0 0 0 .8 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            }}/>
            <div style={{
              position:"relative",
              fontFamily:"var(--mono)", fontSize:10, letterSpacing:".3em",
              textTransform:"uppercase", color:"rgba(10,10,8,.6)",
              borderBottom:"1px solid rgba(10,10,8,.25)", paddingBottom:10, marginBottom:18,
              display:"flex", justifyContent:"space-between", alignItems:"center",
            }}>
              <span>Reference clipping · pasted in</span>
              <span style={{ display:"inline-flex", alignItems:"center", gap:6, color:"rgba(10,10,8,.7)" }}>
                <SocialMark kind="pinterest" size={11}/>
                @{SOCIAL_HANDLES.pinterest.user}
              </span>
            </div>
            <div style={{ position:"relative" }}>
              <PinterestProfile user={SOCIAL_HANDLES.pinterest.user} width={250} height={680} cols={5}/>
            </div>
          </div>
        </section>

        {/* ── PAGE 3: THE WIRE — broadsheet ─────────────────────────────────
            Hero (post[0]): big italic headline, italic dek, drop-cap lede,
            two body paragraphs, X embed alongside as "facsimile".
            Secondary (post[1] & post[2]): two-up grid, smaller treatment.
            Brief (post[3]): full-width with side-by-side prose + embed.
            Each story is rendered from the {headline, dek, lede, body}
            article generated by the akara-twitter-poller Lambda; if a post
            has no article (e.g. Claude generation failed), we fall back to
            showing the raw tweet via the X embed only. */}
        <section id="page-x" className="np-page3" style={{ marginTop:80, scrollMarginTop:24 }}>
          <SectionHead num="C" title="The wire" sub="X · Page 3" big platform="x"/>
          <p style={{
            fontFamily:"'Iowan Old Style', Georgia, serif", fontSize:15, lineHeight:1.6,
            color:"rgba(244,237,225,.78)", maxWidth:760, margin:"0 0 30px", textAlign:"justify",
          }}>
            Threads, observations, and field notes from <strong style={{color:"#f4ede1"}}>@akara__1</strong> — on craft, sound, and Sanatani thought. Filed from the studio in Pune.
          </p>
          <NewspaperRule color="#f4ede1"/>

          {/* HERO ────────────────────────────────────────────────────── */}
          {xPosts[0] && (
            <article style={{
              display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:36,
              padding:"32px 0", borderBottom:"1px solid rgba(244,237,225,.2)",
            }}>
              <div>
                <div className="mono" style={{ fontSize:10, letterSpacing:".3em", color:"var(--gold)", marginBottom:8 }}>
                  DISPATCH NO. 01
                </div>
                <h2 style={{
                  fontFamily:"var(--display)", fontStyle:"italic",
                  fontSize:"clamp(34px, 4vw, 56px)", lineHeight:.98, letterSpacing:"-.02em",
                  margin:"0 0 14px", fontWeight:400, color:"#f4ede1", textWrap:"balance",
                }}>
                  {xPosts[0].article?.headline || "Filed from the studio."}
                </h2>
                {xPosts[0].article?.dek && (
                  <p style={{
                    fontFamily:"'Iowan Old Style', Georgia, serif", fontStyle:"italic",
                    fontSize:18, lineHeight:1.45, color:"rgba(244,237,225,.85)",
                    margin:"0 0 22px", textWrap:"balance",
                  }}>
                    {xPosts[0].article.dek}
                  </p>
                )}
                {xPosts[0].article?.lede ? (
                  <p style={{
                    fontFamily:"'Iowan Old Style', Georgia, serif", fontSize:15.5, lineHeight:1.62,
                    color:"rgba(244,237,225,.82)", marginBottom:16, textAlign:"justify", hyphens:"auto",
                  }}>
                    <span style={{
                      float:"left", fontFamily:"var(--display)", fontStyle:"italic",
                      fontSize:64, lineHeight:.8, marginRight:10, marginTop:6, color:"var(--gold)",
                    }}>{xPosts[0].article.lede.charAt(0)}</span>
                    {xPosts[0].article.lede.slice(1)}
                  </p>
                ) : null}
                {xPosts[0].article?.body && (
                  <div style={{ columnCount:1 }}>
                    {xPosts[0].article.body.split(/\n\n+/).map((para, j) => (
                      <p key={j} style={{
                        fontFamily:"'Iowan Old Style', Georgia, serif", fontSize:14.5, lineHeight:1.62,
                        color:"rgba(244,237,225,.78)", margin:"0 0 14px", textAlign:"justify", hyphens:"auto",
                      }}>{para}</p>
                    ))}
                  </div>
                )}
                <div className="mono" style={{
                  fontSize:10, letterSpacing:".3em", color:"rgba(244,237,225,.5)",
                  textTransform:"uppercase", marginTop:8,
                }}>
                  Filed by @akara__1
                </div>
              </div>
              <aside>
                <div className="mono" style={{
                  fontSize:9, letterSpacing:".3em", color:"rgba(244,237,225,.5)",
                  textTransform:"uppercase", marginBottom:8,
                }}>
                  Source dispatch
                </div>
                <XEmbed key={xPosts[0].url} url={xPosts[0].url} dark/>
              </aside>
            </article>
          )}

          {/* SECONDARY 2-UP ──────────────────────────────────────────── */}
          <div style={{
            display:"grid", gridTemplateColumns:"1fr 1px 1fr", gap:0,
            borderBottom:"1px solid rgba(244,237,225,.2)",
          }}>
            {[xPosts[1], xPosts[2]].filter(Boolean).map((post, i, arr) => (
              <React.Fragment key={post.url}>
                <article style={{ padding:"28px 24px" }}>
                  <div className="mono" style={{ fontSize:10, letterSpacing:".3em", color:"var(--gold)", marginBottom:8 }}>
                    DISPATCH NO. {String(i + 2).padStart(2, "0")}
                  </div>
                  <h3 style={{
                    fontFamily:"var(--display)", fontStyle:"italic", fontSize:26, lineHeight:1.05,
                    margin:"0 0 10px", fontWeight:400, color:"#f4ede1", textWrap:"balance",
                  }}>
                    {post.article?.headline || "Filed from the studio."}
                  </h3>
                  {post.article?.dek && (
                    <p style={{
                      fontFamily:"'Iowan Old Style', Georgia, serif", fontStyle:"italic",
                      fontSize:14, lineHeight:1.45, color:"rgba(244,237,225,.78)", margin:"0 0 14px",
                    }}>
                      {post.article.dek}
                    </p>
                  )}
                  {post.article?.lede && (
                    <p style={{
                      fontFamily:"'Iowan Old Style', Georgia, serif", fontSize:13.5, lineHeight:1.6,
                      color:"rgba(244,237,225,.72)", margin:"0 0 16px", textAlign:"justify", hyphens:"auto",
                    }}>
                      {post.article.lede}
                    </p>
                  )}
                  <XEmbed key={post.url} url={post.url} dark/>
                </article>
                {i === 0 && arr.length > 1 && (
                  <div style={{ background:"rgba(244,237,225,.2)" }}/>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* WIDE BRIEF ──────────────────────────────────────────────── */}
          {xPosts[3] && (
            <article style={{
              display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:32,
              padding:"28px 0", borderBottom:"1px solid rgba(244,237,225,.2)",
            }}>
              <div>
                <div className="mono" style={{ fontSize:10, letterSpacing:".3em", color:"var(--gold)", marginBottom:8 }}>
                  DISPATCH NO. 04
                </div>
                <h3 style={{
                  fontFamily:"var(--display)", fontStyle:"italic", fontSize:30, lineHeight:1.05,
                  margin:"0 0 12px", fontWeight:400, color:"#f4ede1", textWrap:"balance",
                }}>
                  {xPosts[3].article?.headline || "Filed from the studio."}
                </h3>
                {xPosts[3].article?.dek && (
                  <p style={{
                    fontFamily:"'Iowan Old Style', Georgia, serif", fontStyle:"italic",
                    fontSize:15, lineHeight:1.45, color:"rgba(244,237,225,.78)", margin:"0 0 14px",
                  }}>
                    {xPosts[3].article.dek}
                  </p>
                )}
                {xPosts[3].article?.lede && (
                  <p style={{
                    fontFamily:"'Iowan Old Style', Georgia, serif", fontSize:14, lineHeight:1.6,
                    color:"rgba(244,237,225,.72)", margin:"0 0 12px", textAlign:"justify", hyphens:"auto",
                  }}>
                    {xPosts[3].article.lede}
                  </p>
                )}
              </div>
              <XEmbed key={xPosts[3].url} url={xPosts[3].url} dark/>
            </article>
          )}
        </section>

        {/* ── BACK PAGE: classifieds-style follow strip ────────────────────── */}
        <section style={{ marginTop:90, paddingTop:30, borderTop:"3px double rgba(244,237,225,.5)" }}>
          <SectionHead num="∞" title="Subscriptions & notices" sub="The back page" big/>
          <div className="np-classifieds" style={{
            display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:0,
            marginTop:18,
          }}>
            {[
              { kind:"instagram", h:SOCIAL_HANDLES.instagram, label:"Subscribe to the feed", body:"Daily devotionals delivered as reels, prints, and behind-the-loom dispatches." },
              { kind:"x",         h:SOCIAL_HANDLES.x,         label:"Receive the wire",      body:"Threads on craft, sound, and Sanatani thought. Free of charge to all readers." },
              { kind:"pinterest", h:SOCIAL_HANDLES.pinterest, label:"Visit the vault",       body:"The studio's complete reference board — temple stone, manuscript, palette." },
            ].map((p, i)=>(
              <a key={p.kind} href={p.h.url} target="_blank" rel="noopener" className="np-classified" style={{
                padding:"22px 24px", textDecoration:"none", color:"#f4ede1",
                borderLeft: i > 0 ? "1px solid rgba(244,237,225,.2)" : "none",
                transition:"background .25s",
              }}
                onMouseEnter={(e)=>{ e.currentTarget.style.background="rgba(244,237,225,.04)"; }}
                onMouseLeave={(e)=>{ e.currentTarget.style.background="transparent"; }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                  <SocialMark kind={p.kind} size={14}/>
                  <span className="mono" style={{ fontSize:9, letterSpacing:".3em", textTransform:"uppercase", color:"var(--gold)" }}>
                    NOTICE
                  </span>
                </div>
                <h4 style={{
                  fontFamily:"var(--display)", fontStyle:"italic", fontSize:26, lineHeight:1.05,
                  margin:"0 0 10px", fontWeight:400, color:"#f4ede1",
                }}>
                  {p.label}
                </h4>
                <p style={{ fontFamily:"'Iowan Old Style', Georgia, serif", fontSize:13, lineHeight:1.55, color:"rgba(244,237,225,.7)", margin:"0 0 14px", textAlign:"justify", hyphens:"auto" }}>
                  {p.body}
                </p>
                <div className="mono" style={{
                  fontSize:11, letterSpacing:".18em", textTransform:"uppercase", color:"var(--gold)",
                  display:"flex", alignItems:"center", gap:10,
                }}>
                  <span>@{p.h.user}</span>
                  <span style={{ flex:1, height:1, background:"rgba(197,160,89,.4)" }}/>
                  <span>↗</span>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* ── COLOPHON ────────────────────────────────────────────────────── */}
        <div className="np-colophon" style={{
          marginTop:80, paddingTop:24, borderTop:"1px solid rgba(244,237,225,.2)",
          display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:24, alignItems:"center",
          fontFamily:"var(--mono)", fontSize:10, letterSpacing:".24em", textTransform:"uppercase",
          color:"rgba(244,237,225,.5)",
        }}>
          <span>Set in Instrument Serif & Iowan Old Style</span>
          <span style={{ color:"var(--gold)", letterSpacing:".4em" }}>· AKARA TIMES ·</span>
          <span style={{ textAlign:"right" }}>Printed in Pune · No. {EDITION.vol}.{EDITION.issue}</span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html:`
        @media (max-width: 1080px){
          .np-fold{grid-template-columns:1fr !important; gap:0 !important}
          .np-fold > .np-col{padding:0 !important; border-right:0 !important; border-bottom:1px solid rgba(244,237,225,.2); padding-bottom:36px !important; margin-bottom:36px !important}
          .np-fold > .np-col:last-child{border-bottom:0; margin-bottom:0}
          .np-ig-grid{grid-template-columns:1fr !important}
          .np-ig-grid > .np-cell{border-right:none !important}
          .np-grid-2{grid-template-columns:1fr !important}
          .np-grid-2 > div[style*="background"][style*="rgba(244,237,225"]{display:none}
          .np-classifieds{grid-template-columns:1fr !important}
          .np-classified{border-left:none !important; border-top:1px solid rgba(244,237,225,.2)}
          .np-classified:first-child{border-top:none}
          .np-times-hero{grid-template-columns:1fr !important}
          .np-times-hero > div[aria-hidden]{display:none}
          .np-times-grid{grid-template-columns:1fr !important}
          .np-times-grid > .np-cell{border-right:none !important}
          .np-page3 .np-cell[style*="grid-template-columns: 220px"]{grid-template-columns:1fr !important; gap:14px !important}
          .np-colophon{grid-template-columns:1fr !important; text-align:center; gap:8px !important}
          .np-colophon > *{text-align:center !important}
          .np-pin-clipping{padding:24px 18px 22px !important; transform:rotate(0deg) !important}
        }
        @media (max-width: 720px){
          .np-bs-body{padding:24px 16px 80px !important}
          .np-ig-grid{grid-template-columns:1fr !important}
          .np-ig-grid > .np-cell{border-right:none !important; border-bottom:1px solid rgba(244,237,225,.2) !important}
          .np-pin-clipping{padding:18px 12px 16px !important}
        }
      `}}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — Section head + Caption
// ─────────────────────────────────────────────────────────────────────────────
function SectionHead({ num, title, sub, big=false, platform=null }){
  return (
    <div style={{
      display:"grid", gridTemplateColumns:"auto 1fr auto", gap:20, alignItems:"end",
      paddingBottom:14, marginBottom:18,
      borderBottom: big ? "3px double rgba(244,237,225,.5)" : "1px solid rgba(244,237,225,.3)",
    }}>
      <div style={{
        fontFamily:"var(--display)", fontStyle:"italic", fontWeight:400,
        fontSize: big ? 64 : 36, lineHeight:.9, color:"var(--gold)",
      }}>{num}</div>
      <div>
        <h2 style={{
          margin:0, fontFamily:"var(--display)", fontStyle:"italic", fontWeight:400,
          fontSize: big ? "clamp(36px, 4vw, 56px)" : 26, lineHeight:1.0,
          letterSpacing:"-.02em", color:"#f4ede1",
        }}>{title}</h2>
        <div style={{
          fontFamily:"var(--mono)", fontSize:10, letterSpacing:".28em",
          textTransform:"uppercase", color:"rgba(244,237,225,.55)", marginTop:6,
        }}>{sub}</div>
      </div>
      {platform && (
        <div aria-hidden style={{
          // Tasteful platform glyph — gold, sized to match the title baseline,
          // sits at the right edge of the section head as a small mark.
          color:"var(--gold)", opacity:.8,
          alignSelf: big ? "center" : "end",
          paddingBottom: big ? 0 : 4,
          display:"flex", alignItems:"center",
        }}>
          <SocialMark kind={platform} size={big ? 22 : 16}/>
        </div>
      )}
    </div>
  );
}

function Caption({ text }){
  return (
    <div style={{
      fontFamily:"var(--mono)", fontSize:9, letterSpacing:".24em", textTransform:"uppercase",
      color:"rgba(244,237,225,.45)", paddingTop:8, fontStyle:"normal",
      borderTop:"1px solid rgba(244,237,225,.12)", marginTop:8,
    }}>↳ {text}</div>
  );
}

Object.assign(window, { SocialsStrip, SocialsPage, SOCIAL_HANDLES });
