// Footer — sky return using footer-banner.png

const { useRef: ftR, useState: ftS } = React;

function Footer(){
  const ref = ftR(null);
  const bgRef = ftR(null);
  const inView = useInView(ref, { threshold:0.15 });
  const auth = (typeof useAuth === "function") ? useAuth() : { signedIn: false, user: null, signIn: ()=>{}, signOut: ()=>{} };

  useScrollBus((y)=>{
    if(!bgRef.current) return;
    const rect = bgRef.current.getBoundingClientRect();
    const h = window.innerHeight;
    const p = Math.max(-1, Math.min(1, (h - rect.top) / (h + rect.height)));
    bgRef.current.style.transform = `translate3d(0, ${-p*60}px, 0) scale(1.08)`;
  });

  const cols = [
    { h:"Explore", links:["Wallpapers","Shop","Music","Our Story","Journal"] },
    { h:"Studio",  links:["About","Process","Commissions","Contact","Press kit"] },
    { h:"Support", links:["FAQ","Licence","Shipping","Returns","Accessibility"] },
  ];

  return (
    <footer ref={ref} style={{
      position:"relative", padding:"200px 40px 40px",
      background:"#030303", overflow:"hidden", borderTop:"1px solid rgba(197,160,89,.1)",
    }}>
      {/* banner sky — pilgrimage */}
      <div ref={bgRef} style={{
        position:"absolute", top:-40, left:0, right:0, height:520,
        backgroundImage:"url(/akara/assets/footer-banner.png)",
        backgroundSize:"cover", backgroundPosition:"center 30%",
        willChange:"transform",
        maskImage:"linear-gradient(180deg, #000 0%, #000 50%, transparent 100%)",
        WebkitMaskImage:"linear-gradient(180deg, #000 0%, #000 50%, transparent 100%)",
      }}/>
      <div style={{
        position:"absolute", top:-40, left:0, right:0, height:520,
        background:"linear-gradient(180deg, rgba(3,3,3,.1) 0%, rgba(3,3,3,.2) 60%, #030303 100%)",
        pointerEvents:"none",
      }}/>

      <div style={{ position:"relative", maxWidth:1440, margin:"0 auto" }}>
        <div style={{
          textAlign:"center", marginBottom:120,
          opacity:inView?1:0, transform:inView?"translateY(0)":"translateY(30px)", transition:"all 1s var(--ease-out)",
        }}>
          <span className="mono" style={{ fontSize:11, letterSpacing:".4em", color:"var(--gold)", textTransform:"uppercase" }}>
            The journey continues
          </span>
          <h2 className="display" style={{
            fontSize:"clamp(56px, 9vw, 160px)", fontStyle:"italic", lineHeight:.98, letterSpacing:"-.03em",
            margin:"22px auto 30px", fontWeight:400, color:"#fff",
            textShadow:"0 20px 50px rgba(0,0,0,.5)",
            maxWidth:"14ch", textWrap:"balance",
          }}>
            Walk with us.
          </h2>
          <p style={{ maxWidth:560, margin:"0 auto 36px", color:"rgba(255,255,255,.85)", fontSize:17, lineHeight:1.6, fontWeight:300 }}>
            {auth.signedIn
              ? "Welcome to the inner circle. Members get full-resolution wallpapers, early drops, and the monthly letter."
              : "Become a member — full-resolution wallpapers, early drops, and one letter a month with a new mantra recording."}
          </p>
          <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
            {auth.signedIn ? (
              <React.Fragment>
                <MagButton primary onClick={(e)=>{ e.preventDefault(); document.getElementById("wallpapers")?.scrollIntoView({ behavior:"smooth" }); }}>
                  Browse wallpapers →
                </MagButton>
                <MagButton onClick={(e)=>{ e.preventDefault(); auth.signOut(); }}>
                  Sign out
                </MagButton>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <MagButton primary onClick={(e)=>{ e.preventDefault(); auth.signIn({ signup: true }); }}>
                  Create account →
                </MagButton>
                <MagButton onClick={(e)=>{ e.preventDefault(); auth.signIn(); }}>
                  Sign in
                </MagButton>
              </React.Fragment>
            )}
          </div>
          <div style={{ marginTop:20, display:"flex", gap:28, justifyContent:"center", fontFamily:"var(--mono)", fontSize:10, letterSpacing:".28em", color:"var(--ice-muted)", textTransform:"uppercase" }}>
            <span>Free to join</span><span>·</span><span>Email or Google</span><span>·</span><span>Cancel anytime</span>
          </div>
        </div>

        {/* columns */}
        <div className="footer-cols" style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr 1fr 1fr", gap:48, paddingBottom:56, borderBottom:"1px solid rgba(255,255,255,.08)" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
              <img src="/akara/assets/akara-icon-round.png" alt="" style={{ width:36, height:36 }}/>
              <span className="display" style={{ fontSize:32, fontStyle:"italic" }}>Akara</span>
            </div>
            <p style={{ color:"var(--ice-muted)", fontSize:14, lineHeight:1.6, maxWidth:320, fontWeight:300 }}>
              A small studio awakening the inner Sanatani through art, sound, and objects for daily life.
            </p>
            <div style={{ marginTop:20, display:"flex", gap:10 }}>
              {["IG","YT","X","SP"].map(s=>(
                <a key={s} href="#" className="mono" style={{
                  width:38, height:38, display:"grid", placeItems:"center",
                  border:"1px solid rgba(255,255,255,.14)", borderRadius:"50%",
                  fontSize:10, letterSpacing:".12em", color:"#fff", transition:"all .25s",
                }}
                onMouseEnter={(e)=>{ e.currentTarget.style.background="var(--gold)"; e.currentTarget.style.borderColor="var(--gold)"; e.currentTarget.style.color="var(--navy-deep)"; }}
                onMouseLeave={(e)=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="rgba(255,255,255,.14)"; e.currentTarget.style.color="#fff"; }}>
                  {s}
                </a>
              ))}
            </div>
          </div>
          {cols.map(col=>(
            <div key={col.h}>
              <div className="label" style={{ marginBottom:22 }}>{col.h}</div>
              <ul style={{ listStyle:"none", padding:0, margin:0, display:"flex", flexDirection:"column", gap:12 }}>
                {col.links.map(l=>(
                  <li key={l}><a href="#" className="link-u" style={{ fontSize:14, color:"#d8d2c4" }}>{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ paddingTop:28, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
          <div className="mono" style={{ fontSize:10, letterSpacing:".28em", color:"var(--ice-muted)", textTransform:"uppercase" }}>
            © 2026 Akara Studio · Pune · India
          </div>
          <div className="mono" style={{ fontSize:10, letterSpacing:".28em", color:"var(--ice-muted)", textTransform:"uppercase" }}>
            सत्यम् शिवम् सुन्दरम् · Satyam Śivam Sundaram
          </div>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { Footer });
