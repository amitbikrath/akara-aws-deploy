// Music + Story — two sections sharing a file

const { useState: msS, useRef: msR, useEffect: msE } = React;

// ═══════════════════════════ MUSIC ═══════════════════════════

// Static waveform — thin Apple-style bars, live amplitude pulse near playhead
function Waveform({ active, progress, onSeek }){
  // Bar count scales down on narrow viewports so bars don't overflow the card
  const BAR_COUNT = typeof window !== "undefined" && window.innerWidth < 720 ? 64 : 120;
  const bars = msR(null);
  const [tick, setTick] = msS(0);
  const [dragging, setDragging] = msS(false);
  const wrapRef = msR(null);

  if (!bars.current){
    bars.current = Array.from({length:BAR_COUNT}, (_,i)=>{
      const s = Math.sin(i*0.21)*0.5 + Math.cos(i*0.47)*0.3 + Math.sin(i*0.09)*0.25 + Math.cos(i*0.73)*0.15;
      return 0.18 + Math.abs(s) * 0.82;
    });
  }

  // drive tick only while playing for live pulse
  msE(()=>{
    if(!active) return;
    let raf;
    const loop = ()=>{ setTick(t=>t+1); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(raf);
  },[active]);

  const handlePoint = (clientX)=>{
    const r = wrapRef.current.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onSeek && onSeek(p);
  };

  msE(()=>{
    if(!dragging) return;
    const mv = (e)=>handlePoint(e.clientX ?? e.touches?.[0]?.clientX);
    const up = ()=>setDragging(false);
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", mv);
    window.addEventListener("touchend", up);
    return ()=>{
      window.removeEventListener("mousemove", mv);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", mv);
      window.removeEventListener("touchend", up);
    };
  },[dragging]);

  const playheadIdx = Math.floor(progress * BAR_COUNT);

  return (
    <div
      ref={wrapRef}
      onMouseDown={(e)=>{ setDragging(true); handlePoint(e.clientX); }}
      onTouchStart={(e)=>{ setDragging(true); handlePoint(e.touches[0].clientX); }}
      style={{
        position:"relative",
        display:"flex", alignItems:"center", gap:2,
        height:42, width:"100%", maxWidth:"100%", overflow:"hidden",
        cursor: dragging ? "grabbing" : "pointer",
        padding:"6px 0",
        touchAction:"none",
      }}>
      {bars.current.map((h,i)=>{
        const reached = i <= playheadIdx;
        // live pulse: gentle sine wobble near playhead only
        let pulse = 1;
        if (active){
          const dist = Math.abs(i - playheadIdx);
          if (dist < 14){
            const strength = (14 - dist)/14;
            pulse = 1 + Math.sin(tick*0.18 + i*0.6) * 0.35 * strength;
          }
        }
        return (
          <span key={i} style={{
            display:"block", flex:"1 1 0", minWidth:0,
            height:`${Math.min(100, h*100*pulse)}%`,
            background: reached ? "var(--gold)" : "rgba(255,255,255,.25)",
            borderRadius:1.5,
            transition:"background .15s, height .06s linear",
            pointerEvents:"none",
          }}/>
        );
      })}
      {/* scrub thumb */}
      <span aria-hidden style={{
        position:"absolute", top:"50%", left:`${progress*100}%`,
        width:12, height:12, borderRadius:"50%",
        background:"#fff",
        transform:`translate(-50%, -50%) scale(${dragging?1.3:1})`,
        boxShadow:"0 2px 8px rgba(0,0,0,.4), 0 0 0 1px rgba(197,160,89,.6)",
        pointerEvents:"none",
        transition:"transform .2s var(--ease-out)",
        opacity: .95,
      }}/>
    </div>
  );
}

// SPINNING VINYL RECORD
function Vinyl({ playing }){
  return (
    <div style={{
      position:"relative", aspectRatio:"1", width:"100%",
      animation: playing ? "akSpin 5s linear infinite" : "akSpin 80s linear infinite",
      filter:"drop-shadow(0 30px 60px rgba(0,0,0,.6))",
    }}>
      <svg viewBox="0 0 200 200" style={{ width:"100%", height:"100%" }}>
        <defs>
          <radialGradient id="vinylBody" cx="50%" cy="50%">
            <stop offset="0%"   stopColor="#1a1a1f"/>
            <stop offset="60%"  stopColor="#0a0a0c"/>
            <stop offset="100%" stopColor="#000"/>
          </radialGradient>
          <radialGradient id="vinylSheen" cx="30%" cy="30%" r="70%">
            <stop offset="0%"   stopColor="#C5A059" stopOpacity="0.22"/>
            <stop offset="35%"  stopColor="#C5A059" stopOpacity="0.06"/>
            <stop offset="100%" stopColor="#000" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="vinylLabel" cx="50%" cy="50%">
            <stop offset="0%"   stopColor="#1b2a3e"/>
            <stop offset="70%"  stopColor="#0A1626"/>
            <stop offset="100%" stopColor="#050a13"/>
          </radialGradient>
        </defs>

        {/* outer disc */}
        <circle cx="100" cy="100" r="98" fill="url(#vinylBody)"/>
        {/* grooves */}
        {Array.from({length:36}).map((_,i)=>(
          <circle key={i} cx="100" cy="100" r={34 + i*1.7} fill="none"
            stroke="#000" strokeWidth={i%6===0 ? 0.4 : 0.15} opacity={0.8}/>
        ))}
        {/* highlight sheen */}
        <circle cx="100" cy="100" r="96" fill="url(#vinylSheen)"/>
        {/* outer rim highlight */}
        <circle cx="100" cy="100" r="98" fill="none" stroke="#2a2a2f" strokeWidth="0.5"/>

        {/* label */}
        <circle cx="100" cy="100" r="32" fill="url(#vinylLabel)"/>
        <circle cx="100" cy="100" r="32" fill="none" stroke="#C5A059" strokeWidth="0.4" opacity="0.6"/>
        {/* label type — circular */}
        <defs>
          <path id="labelArcTop" d="M 100 100 m -22 0 a 22 22 0 1 1 44 0" fill="none"/>
          <path id="labelArcBot" d="M 100 100 m 22 0 a 22 22 0 1 1 -44 0" fill="none"/>
        </defs>
        <text fill="#C5A059" fontFamily="var(--mono)" fontSize="3.4" letterSpacing="0.6">
          <textPath href="#labelArcTop" startOffset="50%" textAnchor="middle">AKARA · SANATANI SOUND</textPath>
        </text>
        <text fill="#C5A059" fontFamily="var(--mono)" fontSize="3.4" letterSpacing="0.6" opacity="0.7">
          <textPath href="#labelArcBot" startOffset="50%" textAnchor="middle">VOL 01 · DIGITAL RITUAL</textPath>
        </text>
        {/* mandala center */}
        <g transform="translate(100 100)">
          {[6,10,14].map(r=>(<circle key={r} r={r} fill="none" stroke="#C5A059" strokeWidth="0.3" opacity="0.5"/>))}
          {Array.from({length:12}).map((_,i)=>{
            const a = (i/12)*Math.PI*2;
            return <line key={i} x1={Math.cos(a)*6} y1={Math.sin(a)*6} x2={Math.cos(a)*14} y2={Math.sin(a)*14} stroke="#C5A059" strokeWidth="0.25" opacity="0.6"/>;
          })}
          <circle r="4" fill="#C5A059"/>
          <circle r="1.4" fill="#030303"/>
        </g>
      </svg>
    </div>
  );
}

function MusicSection(){
  const [idx, setIdx] = msS(0);
  const [playing, setPlaying] = msS(false);
  const [prog, setProg] = msS(0.34);
  const t = TRACKS[idx];
  const ref = msR(null);
  const inView = useInView(ref, { threshold:0.2 });

  msE(()=>{
    if(!playing) return;
    const id = setInterval(()=>{
      setProg(p=>{ const np = p + 1/t.durSec; return np>=1 ? 0 : np; });
    }, 1000);
    return ()=>clearInterval(id);
  },[playing, t.durSec]);

  const fmt = (sec)=>`${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,"0")}`;

  return (
    <section id="music" data-screen-label="04 Music" className="cv-auto" ref={ref} style={{
      position:"relative", padding:"160px 40px 180px",
      background:"linear-gradient(180deg, #030303 0%, #0a0e18 50%, #030303 100%)",
      borderTop:"1px solid rgba(197,160,89,.08)",
      overflow:"hidden",
    }}>
      <div aria-hidden style={{
        position:"absolute", top:"20%", left:"50%", transform:"translateX(-50%)",
        width:900, height:900, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(197,160,89,.1) 0%, transparent 60%)",
        filter:"blur(80px)", pointerEvents:"none",
      }}/>
      <div style={{ maxWidth:1280, margin:"0 auto", position:"relative" }}>
        <div style={{ textAlign:"center", marginBottom:80,
          opacity:inView?1:0, transform:inView?"translateY(0)":"translateY(24px)", transition:"all .9s var(--ease-out)" }}>
          <SectionKicker num="04 / 05" label="Sound · Nāda · Mantra" align="center"/>
          <h2 className="display" style={{ fontSize:"clamp(44px,6vw,88px)", lineHeight:1, margin:"0 auto", fontWeight:400, maxWidth:"17ch", textWrap:"balance" }}>
            Digital ritual, <em className="gold-text" style={{ fontStyle:"italic" }}>pressed to feel old</em>.
          </h2>
          <p style={{ marginTop:20, fontSize:16, color:"var(--ice-muted)", maxWidth:640, margin:"20px auto 0", lineHeight:1.6, fontWeight:300 }}>
            Mantras and devotional pieces, generated and graded by Akara — sequenced for modern days and ancient hours.
          </p>
        </div>

        {/* player */}
        <div className="glass music-player" style={{
          borderRadius:24, padding:"28px 32px",
          display:"grid", gridTemplateColumns:"220px 1fr", gap:40, alignItems:"center",
          opacity:inView?1:0, transform:inView?"translateY(0)":"translateY(20px)", transition:"all 1s var(--ease-out) .2s",
        }}>
          {/* vinyl */}
          <div className="vinyl-wrap" style={{ position:"relative" }}>
            <Vinyl playing={playing}/>
            {/* tonearm */}
            <div aria-hidden style={{
              position:"absolute", top:-6, right:-10, width:86, height:12,
              transformOrigin:"right center",
              transform: playing ? "rotate(-22deg)" : "rotate(-42deg)",
              transition:"transform 1.4s cubic-bezier(.22,.61,.36,1)",
              pointerEvents:"none",
            }}>
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg, #2a2a2f 0%, #4a4a52 70%, #6a6a72 100%)", borderRadius:2, height:2, top:5 }}/>
              <div style={{ position:"absolute", left:0, top:0, width:12, height:12, background:"radial-gradient(circle, #4a4a52 0%, #1a1a1f 100%)", borderRadius:"50%", boxShadow:"0 2px 4px rgba(0,0,0,.4)" }}/>
              <div style={{ position:"absolute", right:-2, top:3, width:6, height:6, background:"#C5A059", borderRadius:1, boxShadow:"0 0 8px rgba(197,160,89,.6)" }}/>
            </div>
          </div>

          {/* player body */}
          <div style={{ display:"flex", flexDirection:"column", gap:16, minWidth:0 }}>
            <div>
              <div className="mono" style={{ fontSize:9, letterSpacing:".32em", color:"var(--ice-muted)", textTransform:"uppercase" }}>
                NOW PLAYING · SIDE A · {String(idx+1).padStart(2,"0")} / 05
              </div>
              <div className="display" style={{ fontSize:"clamp(26px,2.8vw,36px)", marginTop:6, letterSpacing:"-.01em", fontStyle:"italic", lineHeight:1.05 }}>{t.title}</div>
              <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
                <Chip k="Invokes" v={t.invokes}/>
                <Chip k="Mood" v={t.mood}/>
                <Chip k="Element" v={t.element}/>
                <Chip k="Occasion" v={t.occasion}/>
              </div>
            </div>
            <Waveform active={playing} progress={prog} onSeek={setProg}/>
            <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"var(--mono)", fontSize:10, letterSpacing:".12em", color:"var(--ice-muted)", marginTop:-6 }}>
              <span>{fmt(prog*t.durSec)}</span>
              <span>-{fmt((1-prog)*t.durSec)}</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:2 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <button onClick={()=>{ setIdx((idx-1+TRACKS.length)%TRACKS.length); setProg(0); }} style={btn()}>⟵</button>
                <button onClick={()=>setPlaying(p=>!p)} style={{
                  width:46, height:46, borderRadius:"50%", background:"var(--gold)", border:"none",
                  color:"var(--navy-deep)", fontSize:15, cursor:"pointer",
                  boxShadow:"0 6px 18px rgba(197,160,89,.32), inset 0 1px 0 rgba(255,255,255,.3)",
                  transition:"transform .2s",
                  display:"grid", placeItems:"center",
                }}>{playing?"❚❚":"▶"}</button>
                <button onClick={()=>{ setIdx((idx+1)%TRACKS.length); setProg(0); }} style={btn()}>⟶</button>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <span className="mono" style={{ fontSize:9, letterSpacing:".28em", color:"var(--ice-muted)" }}>33⅓</span>
                <span className="mono" style={{ fontSize:9, letterSpacing:".28em", color:"var(--ice-muted)" }}>LOOP</span>
                <span className="mono" style={{ fontSize:9, letterSpacing:".28em", color:"var(--gold)" }}>HI-FI</span>
              </div>
            </div>
          </div>
        </div>

        {/* playlist — reshaped columns */}
        <div style={{ marginTop:56, borderTop:"1px solid rgba(255,255,255,.08)" }}>
          <div className="playlist-row" style={{
            display:"grid", gridTemplateColumns:"48px 1.6fr 1.1fr .9fr 1.1fr .8fr",
            gap:20, padding:"14px 24px",
            borderBottom:"1px solid rgba(255,255,255,.06)",
          }}>
            {[
              ["#",""],["Title",""],["Invokes","playlist-col-invokes"],
              ["Mood","playlist-col-mood"],["Occasion","playlist-col-occasion"],["Length",""]
            ].map(([h, cls])=>(
              <span key={h} className={`label ${cls}`} style={{ fontSize:10 }}>{h}</span>
            ))}
          </div>
          {TRACKS.map((tr,i)=>{
            const isActive = i===idx;
            return (
              <button key={tr.id} onClick={()=>{ setIdx(i); setProg(0); setPlaying(true); }} className="playlist-row" style={{
                display:"grid", gridTemplateColumns:"48px 1.6fr 1.1fr .9fr 1.1fr .8fr",
                alignItems:"center", gap:20, padding:"20px 24px", width:"100%",
                background: isActive? "rgba(197,160,89,.05)" : "transparent",
                borderBottom:"1px solid rgba(255,255,255,.06)",
                border:"none", borderLeft: isActive? "2px solid var(--gold)" : "2px solid transparent",
                color:"#fff", textAlign:"left", fontFamily:"inherit",
                cursor:"pointer", transition:"all .3s var(--ease-out)",
              }}>
                <span className="mono" style={{ fontSize:11, color: isActive?"var(--gold)":"var(--ice-muted)", letterSpacing:".2em" }}>
                  {isActive && playing ? "♪" : String(i+1).padStart(2,"0")}
                </span>
                <span className="display" style={{ fontSize:22, fontStyle:"italic", color: isActive?"#fff":"#e7dfd2" }}>{tr.title}</span>
                <span className="mono playlist-col-invokes" style={{ fontSize:11, letterSpacing:".18em", color:isActive?"var(--gold)":"#c9c2b4", textTransform:"uppercase" }}>{tr.invokes}</span>
                <span className="playlist-col-mood" style={{ fontSize:13, color:"var(--ice-muted)" }}>{tr.mood}</span>
                <span className="playlist-col-occasion" style={{ fontSize:13, color:"var(--ice-muted)" }}>{tr.occasion}</span>
                <span className="mono" style={{ fontSize:11, color:"var(--ice-muted)", textAlign:"right" }}>{tr.dur}</span>
              </button>
            );
          })}
        </div>

        {/* footer strip */}
        <div className="music-meta" style={{ marginTop:36, padding:"22px 0", borderTop:"1px solid rgba(255,255,255,.08)",
          display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:24 }}>
          <Meta k="Mastered in" v="256kbps · Opus"/>
          <Meta k="Durations" v="4:32 – 8:04"/>
          <Meta k="Cadence" v="One new piece / moon"/>
          <Meta k="Play anywhere" v="Stream · Offline · Loop"/>
        </div>
      </div>
    </section>
  );
}

function Chip({ k, v }){
  return (
    <span style={{
      display:"inline-flex", alignItems:"baseline", gap:6,
      padding:"5px 11px",
      background:"rgba(255,255,255,.06)",
      border:"1px solid rgba(255,255,255,.12)",
      borderRadius:999, fontSize:12, color:"#e7dfd2",
    }}>
      <span className="mono" style={{ fontSize:9, letterSpacing:".22em", color:"var(--gold)", textTransform:"uppercase" }}>{k}</span>
      <span style={{ fontStyle:"italic", fontFamily:"var(--display)", fontSize:14 }}>{v}</span>
    </span>
  );
}
function Meta({ k, v }){
  return (
    <div>
      <span className="label">{k}</span>
      <div style={{ fontSize:14, marginTop:8, color:"#fff", fontWeight:300 }}>{v}</div>
    </div>
  );
}
function btn(){
  return {
    width:34, height:34, borderRadius:"50%",
    background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.12)",
    color:"#fff", fontSize:12, cursor:"pointer",
    transition:"background .2s",
    display:"grid", placeItems:"center",
  };
}

// ═══════════════════════════ STORY ═══════════════════════════

function StoryChapter({ ch, idx, total }){
  const ref = msR(null);
  const [active, setActive] = msS(false);

  msE(()=>{
    const el = ref.current; if(!el) return;
    const io = new IntersectionObserver(([e])=>{
      setActive(e.intersectionRatio > 0.5);
    }, { threshold:[0, .5, 1], rootMargin:"-25% 0px -45% 0px" });
    io.observe(el);
    return ()=>io.disconnect();
  },[]);

  // Progressive stack: each card sticks slightly lower than the previous,
  // so they pile up as the user scrolls. Base offset lands below the nav.
  const stickyTop = 100 + idx * 22;
  // Subtle scale-down on stacked cards behind the top one
  const scale = 1 - (total - 1 - idx) * 0.015;

  return (
    <div ref={ref} style={{
      position:"sticky",
      top: stickyTop,
      zIndex: 10 + idx,
      marginBottom: 40,
      transformOrigin:"50% 0",
    }}>
      <article className="story-chapter" style={{
        position:"relative",
        display:"grid", gridTemplateColumns:"140px 1fr 1.1fr", gap:48,
        alignItems:"center", padding:"48px 48px",
        borderRadius:24,
        background:"linear-gradient(145deg, rgba(16,22,34,.82) 0%, rgba(8,12,22,.92) 100%)",
        backdropFilter:"blur(30px) saturate(160%)", WebkitBackdropFilter:"blur(30px) saturate(160%)",
        border:"1px solid rgba(255,255,255,.08)",
        boxShadow:`
          inset 0 1px 0 rgba(255,255,255,.08),
          0 -1px 0 rgba(255,255,255,.04),
          0 40px 80px rgba(0,0,0,.55),
          0 14px 30px rgba(0,0,0,.35)
        `,
        transform: `scale(${scale})`,
        transition:"transform .6s var(--ease-out)",
      }}>
        {/* accent rail */}
        <div aria-hidden style={{
          position:"absolute", left:0, top:"20%", bottom:"20%", width:2,
          background:"linear-gradient(180deg, transparent, var(--gold), transparent)",
          opacity: active ? 1 : 0.25,
          transition:"opacity .5s var(--ease-out)",
        }}/>
        {/* chapter index */}
        <div className="ch-num" style={{
          fontFamily:"var(--display)", fontSize:108, fontStyle:"italic", lineHeight:1,
          color: active ? "var(--gold)" : "rgba(255,255,255,.18)",
          transition:"color .6s var(--ease-out)",
        }}>0{idx+1}</div>

        {/* title */}
        <div>
          <span className="mono" style={{ fontSize:10, letterSpacing:".32em", color:"var(--gold)", textTransform:"uppercase" }}>
            Ch. {idx+1} / {total}
          </span>
          <h3 className="display" style={{
            fontSize:"clamp(32px,3.6vw,52px)", fontStyle:"italic", lineHeight:1.05,
            margin:"12px 0 0", fontWeight:400, letterSpacing:"-.01em",
          }}>
            {ch.title}
          </h3>
        </div>

        {/* body */}
        <div>
          <p style={{
            fontSize:16, lineHeight:1.7, color:"#d8d2c4", fontWeight:300, margin:0,
            textWrap:"pretty",
          }}>
            {ch.body}
          </p>
        </div>
      </article>
    </div>
  );
}

function StorySection(){
  const ref = msR(null);
  const headInView = useInView(ref, { threshold:0.3 });
  const total = STORY_CHAPTERS.length;
  return (
    <section id="story" data-screen-label="05 Our Story" className="cv-auto" style={{
      position:"relative",
      padding:"160px 40px 80px",
      background:"#030303",
      borderTop:"1px solid rgba(197,160,89,.08)",
    }}>
      <div style={{ maxWidth:1280, margin:"0 auto" }}>
        <div ref={ref} style={{ marginBottom:80, textAlign:"left",
          opacity:headInView?1:0, transform:headInView?"translateY(0)":"translateY(20px)", transition:"all .9s var(--ease-out)" }}>
          <SectionKicker num="05 / 05" label="Founder's note · In their own words"/>
          <h2 className="display" style={{ fontSize:"clamp(44px,6vw,88px)", lineHeight:1, margin:0, fontWeight:400, maxWidth:"16ch" }}>
            Why <em className="gold-text" style={{ fontStyle:"italic" }}>Akara</em> exists.
          </h2>
        </div>
        {/* Give the sticky stack room — each card needs a scroll window equal to ~90vh so
            the user experiences each one before the next overlaps */}
        <div className="story-stack" style={{ paddingBottom: total * 40 }}>
          {STORY_CHAPTERS.map((ch,i)=>(
            <div key={ch.id} style={{ minHeight: "85vh", display:"flex", alignItems:"flex-start" }}>
              <StoryChapter ch={ch} idx={i} total={total}/>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { MusicSection, StorySection });
