// Shop Page — unique ecommerce browsing experience.
// Vertical aisle metaphor: each category is a horizontal scrolling film-strip row
// of large editorial product cards. Left rail for collections, right-side cart drawer.

const { useState: spS, useEffect: spE, useRef: spR, useMemo: spM } = React;

// ───────────────────────── catalog data ─────────────────────────
const SHOP_CATALOG = [
  {
    id:"clothing", name:"Clothing", tag:"Woven in Varanasi",
    desc:"Cotton, silk, and linen — cut loose, worn daily.",
    media:"/akara/assets/shop-clothing.mp4", still:"/akara/assets/shop-clothing-sm.png",
    accent:"#d08a70",
    sized:true,
    sizes:["XS","S","M","L","XL","XXL"],
    products:[
      { id:"c1", name:"Kailash Tee",         price:1800, meta:"Cotton · Ink Black",       tone:["#0a0a0a","#c5a059"] },
      { id:"c2", name:"Varanasi Kurta",      price:4200, meta:"Khadi · Ivory",             tone:["#fef1d1","#c5a059"] },
      { id:"c3", name:"Vrindavan Overshirt", price:3600, meta:"Linen · Indigo",            tone:["#1b3a6a","#486080"] },
      { id:"c4", name:"Sindoor Hoodie",      price:4800, meta:"Fleece · Sindoor",          tone:["#a6284a","#3a0a14"] },
      { id:"c5", name:"Moksha Joggers",      price:3200, meta:"Cotton · Charcoal",         tone:["#221822","#050505"] },
    ],
  },
  {
    id:"prints", name:"Fine Prints", tag:"Giclée on cotton",
    desc:"Limited editions. Numbered, signed, archival.",
    media:"/akara/assets/shop-prints.mp4", still:"/akara/assets/shop-prints-sm.png",
    accent:"#e4b37a",
    products:[
      { id:"p1", name:"Nataraja / A2",   price:3500, meta:"Edition /50",    tone:["#8a6932","#1a0e06"] },
      { id:"p2", name:"Yamuna / A3",     price:2400, meta:"Edition /100",   tone:["#122456","#4a6ea5"] },
      { id:"p3", name:"Sri Yantra / A2", price:3500, meta:"Edition /40",    tone:["#c5a059","#0a1626"] },
      { id:"p4", name:"Durga / A1",      price:5800, meta:"Edition /25",    tone:["#a6284a","#e28a5a"] },
      { id:"p5", name:"Ganesha / A3",    price:2400, meta:"Edition /80",    tone:["#e37a28","#fef1d1"] },
    ],
  },
  {
    id:"merch", name:"Objects", tag:"For the living altar",
    desc:"Brass, ceramic, wood — made for daily use.",
    media:"/akara/assets/shop-merch.mp4", still:"/akara/assets/shop-merch-sm.png",
    accent:"#8fb5d6",
    products:[
      { id:"m1", name:"Brass Diya Pair",    price:1400, meta:"Cast brass",            tone:["#c5a059","#8a6932"] },
      { id:"m2", name:"Ceramic Chai Set",   price:2200, meta:"Set of 4 + pot",       tone:["#fef1d1","#d08a70"] },
      { id:"m3", name:"Sandalwood Mala",    price:1800, meta:"108 beads · Chandan",  tone:["#b67d3a","#f0d19a"] },
      { id:"m4", name:"Incense / Monsoon",  price:600,  meta:"Pack of 40",           tone:["#5e8e6b","#14251a"] },
      { id:"m5", name:"Copper Lota",        price:1600, meta:"Hand-hammered",         tone:["#c56a29","#2a0d0b"] },
    ],
  },
];

const COLLECTIONS = [
  { id:"all",      label:"The Whole Shop",   filter:()=>true },
  { id:"new",      label:"New Arrivals",     filter:(p)=>["c4","p4","m1"].includes(p.id) },
  { id:"under2k",  label:"Under ₹2,000",     filter:(p)=>p.price < 2000 },
  { id:"altar",    label:"For Your Altar",   filter:(p,c)=>c.id==="merch" },
  { id:"wear",     label:"To Wear",          filter:(p,c)=>c.id==="clothing" },
  { id:"hang",     label:"On Your Wall",     filter:(p,c)=>c.id==="prints" },
];

function fmtINR(n){ return "₹" + n.toLocaleString("en-IN"); }

// ───────────────────────── ShopPage root ─────────────────────────
function ShopPage({ onClose }){
  const [collection, setCollection] = spS("all");
  const [cart, setCart] = spS([]); // [{id, name, price, qty}]
  const [cartOpen, setCartOpen] = spS(false);
  const [peek, setPeek] = spS(null); // product being quick-viewed

  // Lock body scroll
  spE(()=>{
    const pB=document.body.style.overflow, pH=document.documentElement.style.overflow;
    document.body.style.overflow="hidden";
    document.documentElement.style.overflow="hidden";
    return ()=>{ document.body.style.overflow=pB; document.documentElement.style.overflow=pH; };
  },[]);

  // Escape closes
  spE(()=>{
    const onKey=(e)=>{
      if(e.key==="Escape"){
        if(peek) setPeek(null);
        else if(cartOpen) setCartOpen(false);
        else onClose && onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return ()=>window.removeEventListener("keydown", onKey);
  },[onClose, peek, cartOpen]);

  const cf = COLLECTIONS.find(c=>c.id===collection);
  const catalog = spM(()=>{
    return SHOP_CATALOG.map(cat=>({
      ...cat,
      products: cat.products.filter(p=>cf.filter(p, cat)),
    })).filter(cat=>cat.products.length>0);
  },[collection]);

  const addToCart=(p, opts={})=>{
    const size = opts.size || null;
    const cartKey = size ? `${p.id}-${size}` : p.id;
    setCart(prev=>{
      const ex = prev.find(c=>c.cartKey===cartKey);
      if(ex) return prev.map(c=>c.cartKey===cartKey?{...c, qty:c.qty+1}:c);
      return [...prev, { cartKey, id:p.id, name:p.name, price:p.price, qty:1, size }];
    });
    setCartOpen(true);
  };
  const cartTotal = cart.reduce((s,c)=>s + c.price*c.qty, 0);
  const cartCount = cart.reduce((s,c)=>s+c.qty, 0);

  return (
    <div style={{
      position:"fixed", top:0,left:0,right:0,bottom:0,
      width:"100vw", height:"100vh", zIndex:8000,
      overflowY:"auto", overflowX:"hidden",
      WebkitOverflowScrolling:"touch", overscrollBehavior:"contain",
      background:"linear-gradient(180deg, #f5efe4 0%, #ede5d3 100%)",
      color:"#1a1008",
    }}>
      {/* paper texture + subtle mandala watermark */}
      <svg aria-hidden viewBox="-100 -100 200 200" style={{
        position:"fixed", inset:0, width:"100%", height:"100%", opacity:.05, pointerEvents:"none",
      }}>
        <g stroke="#8a6932" strokeWidth=".15" fill="none">
          {[22,46,72,98].map(r=><circle key={r} r={r}/>)}
          {Array.from({length:48}).map((_,i)=>{
            const a=(i/48)*Math.PI*2;
            return <line key={i} x1={Math.cos(a)*22} y1={Math.sin(a)*22} x2={Math.cos(a)*98} y2={Math.sin(a)*98}/>;
          })}
        </g>
      </svg>

      {/* TOP NAV */}
      <nav className="shop-nav" style={{
        position:"sticky", top:0, zIndex:30,
        padding:"18px 40px",
        background:"linear-gradient(180deg, rgba(245,239,228,.96) 0%, rgba(245,239,228,.72) 80%, transparent 100%)",
        backdropFilter:"blur(14px) saturate(140%)", WebkitBackdropFilter:"blur(14px) saturate(140%)",
        borderBottom:"1px solid rgba(138,105,50,.18)",
        display:"flex", alignItems:"center", justifyContent:"space-between", gap:24,
      }}>
        <button onClick={onClose} style={{
          display:"inline-flex", alignItems:"center", gap:12,
          fontFamily:"var(--mono)", fontSize:10, letterSpacing:".3em", textTransform:"uppercase", fontWeight:600,
          color:"#3d2d13", background:"transparent", border:"none",
          cursor:"pointer", padding:0, transition:"color .25s",
        }}
        onMouseEnter={(e)=>{ e.currentTarget.style.color="#8a3e18"; }}
        onMouseLeave={(e)=>{ e.currentTarget.style.color="#3d2d13"; }}>
          <span style={{ fontSize:14, fontWeight:300 }}>←</span>
          <span className="shop-back-label">Back to Akara</span>
        </button>

        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <span className="display" style={{ fontSize:20, fontStyle:"italic", fontWeight:400, letterSpacing:".02em", color:"#1a1008" }}>
            <span style={{ color:"#8a3e18", background:"linear-gradient(135deg,#c5a059,#8a6932)", WebkitBackgroundClip:"text", backgroundClip:"text", WebkitTextFillColor:"transparent" }}>Akara</span>
            <span style={{ opacity:.5, color:"#3d2d13" }}> / Shop</span>
          </span>
          <span className="mono shop-brand-sub" style={{ fontSize:9, letterSpacing:".35em", color:"rgba(61,45,19,.45)", textTransform:"uppercase" }}>
            Est. 2025 · Made with intention
          </span>
        </div>

        <button onClick={()=>setCartOpen(true)} className="shop-cta-cart" style={{
          position:"relative",
          display:"inline-flex", alignItems:"center", gap:10,
          padding:"10px 18px 10px 14px",
          background:"#1a1008", color:"#f5efe4",
          border:"none", borderRadius:999,
          fontFamily:"var(--mono)", fontSize:10, letterSpacing:".26em", textTransform:"uppercase", fontWeight:600,
          cursor:"pointer", transition:"transform .25s",
        }}
        onMouseEnter={(e)=>{ e.currentTarget.style.transform="translateY(-1px)"; }}
        onMouseLeave={(e)=>{ e.currentTarget.style.transform="translateY(0)"; }}>
          <span>⌇</span>
          <span className="cart-label">Cart{cartCount?` · ${cartCount}`:""}</span>
          {cartCount>0 && (
            <span style={{
              position:"absolute", top:-4, right:-4,
              minWidth:18, height:18, padding:"0 5px", borderRadius:9,
              background:"#c5a059", color:"#1a1008", fontSize:10, fontWeight:700,
              display:"grid", placeItems:"center",
              border:"2px solid #f5efe4",
            }}>{cartCount}</span>
          )}
        </button>
      </nav>

      {/* HEADER */}
      <header className="shop-header" style={{ maxWidth:1400, margin:"0 auto", padding:"64px 40px 24px", position:"relative" }}>
        <div className="mono" style={{
          display:"inline-flex", alignItems:"center", gap:12,
          fontSize:10, letterSpacing:".35em", color:"#8a3e18", textTransform:"uppercase", marginBottom:18,
        }}>
          <span style={{ width:20, height:1, background:"#8a6932" }}/>
          <span>The Akara Shop</span>
          <span style={{ width:20, height:1, background:"#8a6932" }}/>
        </div>
        <h1 className="display" style={{
          fontSize:"clamp(56px,7vw,108px)", lineHeight:.95, margin:"0 0 20px", fontWeight:400, letterSpacing:"-.015em", color:"#1a1008",
        }}>
          Objects, worn, <em style={{ fontStyle:"italic", color:"#8a3e18" }}>and hung.</em>
        </h1>
        <p style={{ fontSize:18, color:"rgba(26,16,8,.68)", fontWeight:300, maxWidth:640, lineHeight:1.6, margin:0 }}>
          Every piece is a quiet reminder — woven, printed, or cast with care.
          Browse the aisles. Each row is a category, each card a piece you can carry home.
        </p>
      </header>

      {/* COLLECTION RAIL */}
      <div className="shop-collections" style={{
        position:"sticky", top:68, zIndex:20,
        padding:"18px 40px",
        background:"linear-gradient(180deg, rgba(245,239,228,.95) 0%, rgba(245,239,228,.8) 100%)",
        backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)",
        borderBottom:"1px solid rgba(138,105,50,.14)",
        overflowX:"auto", whiteSpace:"nowrap",
      }}>
        <div style={{ display:"inline-flex", gap:8, alignItems:"center" }}>
          <span className="mono" style={{
            fontSize:10, letterSpacing:".3em", color:"#8a3e18", textTransform:"uppercase", marginRight:14,
          }}>Collections</span>
          {COLLECTIONS.map(c=>{
            const active = c.id===collection;
            return (
              <button key={c.id} onClick={()=>setCollection(c.id)} style={{
                padding:"8px 16px", borderRadius:999,
                background: active ? "#1a1008" : "rgba(255,255,255,.6)",
                color: active ? "#f5efe4" : "#1a1008",
                border:`1px solid ${active ? "#1a1008" : "rgba(138,105,50,.25)"}`,
                fontFamily:"var(--mono)", fontSize:10, letterSpacing:".26em", textTransform:"uppercase",
                fontWeight: active ? 700 : 500,
                cursor:"pointer", transition:"all .25s",
              }}>
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* AISLES */}
      <main className="shop-main" style={{ maxWidth:1500, margin:"0 auto", padding:"48px 40px 120px", position:"relative" }}>
        {catalog.length === 0 ? (
          <div style={{
            padding:"120px 40px", textAlign:"center",
            border:"1.5px dashed rgba(138,105,50,.25)", borderRadius:12,
            color:"rgba(26,16,8,.5)",
          }}>
            <div className="display" style={{ fontSize:36, fontStyle:"italic", marginBottom:10 }}>This aisle is empty.</div>
            <div className="mono" style={{ fontSize:11, letterSpacing:".3em", textTransform:"uppercase" }}>Try another collection</div>
          </div>
        ) : catalog.map((cat, i)=>(
          <Aisle key={cat.id} cat={cat} idx={i} onAdd={addToCart} onPeek={setPeek}/>
        ))}
      </main>

      {/* quick-peek modal */}
      {peek && <PeekModal p={peek.p} cat={peek.cat} onClose={()=>setPeek(null)} onAdd={(p)=>{ addToCart(p); setPeek(null); }}/>}

      {/* cart drawer */}
      <CartDrawer open={cartOpen} cart={cart} setCart={setCart} total={cartTotal} onClose={()=>setCartOpen(false)}/>

      {/* Mobile responsive overrides */}
      <style>{`
        @media (max-width: 780px) {
          .shop-nav { padding: 14px 18px !important; gap: 10px !important; }
          .shop-nav .shop-brand-sub { display: none !important; }
          .shop-nav .shop-back-label { display: none !important; }
          .shop-header { padding: 40px 20px 18px !important; }
          .shop-header h1 { font-size: clamp(44px, 11vw, 68px) !important; }
          .shop-header p { font-size: 15px !important; }
          .shop-collections { padding: 14px 20px !important; top: 56px !important; }
          .shop-main { padding: 32px 16px 100px !important; }
          .aisle-header { grid-template-columns: 1fr !important; gap: 16px !important; }
          .aisle-chip { width: 100%; height: 120px !important; }
          .aisle-arrows { display: none !important; }
          .aisle-title { font-size: clamp(36px, 9vw, 56px) !important; }
          .product-card { flex: 0 0 72vw !important; max-width: 300px; }
          .shop-drawer { width: 100% !important; }
          .shop-cta-cart .cart-label { display: none; }
        }
        @media (max-width: 460px) {
          .product-card { flex: 0 0 82vw !important; }
        }
      `}</style>
    </div>
  );
}

// ───────────────────────── Aisle ─────────────────────────
function Aisle({ cat, idx, onAdd, onPeek }){
  const scroller = spR(null);
  const videoRef = spR(null);
  const chipRef = spR(null);
  const [hover, setHover] = spS(false);
  const [isTouch, setIsTouch] = spS(false);
  const [inView, setInView] = spS(false);
  const [videoPlaying, setVideoPlaying] = spS(false);
  const [videoError, setVideoError] = spS(false);

  // detect touch/coarse-pointer devices once on mount
  spE(()=>{
    if(typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    setIsTouch(mq.matches);
    const onChange = (e)=> setIsTouch(e.matches);
    if(mq.addEventListener) mq.addEventListener("change", onChange);
    return ()=> { if(mq.removeEventListener) mq.removeEventListener("change", onChange); };
  },[]);

  // observe visibility for touch devices (autoplay when scrolled into view)
  spE(()=>{
    if(!isTouch || !chipRef.current || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver((entries)=>{
      entries.forEach(e=> setInView(e.isIntersecting && e.intersectionRatio > 0.3));
    }, { threshold:[0, 0.3, 0.6] });
    obs.observe(chipRef.current);
    return ()=> obs.disconnect();
  },[isTouch]);

  // play/pause logic — hover on desktop, in-view on touch
  const shouldPlay = isTouch ? inView : hover;
  spE(()=>{
    const v = videoRef.current; if(!v) return;
    if(shouldPlay){
      v.muted = true;
      v.playsInline = true;
      const p = v.play();
      if(p && p.catch) p.catch(()=>{});
    } else {
      v.pause();
    }
  },[shouldPlay]);

  // Track whether video is actually playing frames — keep poster visible otherwise
  spE(()=>{
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

  // on touch devices, keep the video visible (not crossfaded away) so you see it playing
  const videoVisible = isTouch ? true : hover;
  // Poster image: always visible UNTIL video is actually playing (and not errored)
  const posterOpacity = (videoPlaying && !videoError) ? 0 : 1;
  const videoOpacity  = videoError ? 0 : (videoVisible ? 1 : 0);

  const scrollBy = (dx)=>{
    if(!scroller.current) return;
    scroller.current.scrollBy({ left:dx, behavior:"smooth" });
  };

  return (
    <section style={{ marginBottom: 88, position:"relative" }}>
      {/* aisle header */}
      <div
        className="aisle-header"
        onMouseEnter={()=>setHover(true)}
        onMouseLeave={()=>setHover(false)}
        style={{
          display:"grid", gridTemplateColumns:"220px 1fr auto", gap:32, alignItems:"end",
          marginBottom:24,
        }}>
        {/* category media chip */}
        <div ref={chipRef} className="aisle-chip" style={{
          position:"relative", width:220, height:140, borderRadius:8,
          overflow:"hidden",
          background:"#1a1008",
          boxShadow:"0 10px 30px rgba(61,45,19,.25)",
        }}>
          <ProtectedImage src={cat.still} alt="" fit="cover" style={{ opacity: posterOpacity, transition:"opacity .4s", zIndex:1 }}/>
          <video ref={videoRef} src={cat.media} muted loop playsInline autoPlay={isTouch} preload="metadata"
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity: videoOpacity, transition:"opacity .4s", zIndex:2 }}/>
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, transparent 50%, rgba(0,0,0,.6) 100%)" }}/>
          <div style={{
            position:"absolute", top:10, left:12,
            padding:"4px 9px", borderRadius:4,
            background:"rgba(245,239,228,.92)", color:"#1a1008",
            fontFamily:"var(--mono)", fontSize:9, letterSpacing:".28em", textTransform:"uppercase", fontWeight:700,
          }}>Aisle {String(idx+1).padStart(2,"0")}</div>
          <div style={{
            position:"absolute", left:12, bottom:10, color:"#f5efe4",
            fontFamily:"var(--mono)", fontSize:9, letterSpacing:".3em", textTransform:"uppercase",
          }}>{cat.products.length} pieces</div>
        </div>

        {/* title + desc */}
        <div>
          <div className="mono" style={{
            fontSize:10, letterSpacing:".3em", color:"#8a3e18", textTransform:"uppercase", marginBottom:8,
          }}>{cat.tag}</div>
          <h2 className="display aisle-title" style={{
            fontSize:"clamp(40px,5vw,72px)", lineHeight:1, margin:"0 0 10px", fontWeight:400, color:"#1a1008",
          }}>
            <em style={{ fontStyle:"italic" }}>{cat.name}</em>
          </h2>
          <p style={{ fontSize:16, color:"rgba(26,16,8,.6)", fontWeight:300, margin:0, maxWidth:480 }}>
            {cat.desc}
          </p>
        </div>

        {/* scroll arrows */}
        <div className="aisle-arrows" style={{ display:"flex", gap:8 }}>
          {[-1,1].map(d=>(
            <button key={d} onClick={()=>scrollBy(d*420)} aria-label={d<0?"Scroll left":"Scroll right"} style={{
              width:44, height:44, borderRadius:"50%",
              background:"rgba(255,255,255,.65)", border:"1px solid rgba(138,105,50,.25)",
              color:"#1a1008", cursor:"pointer", display:"grid", placeItems:"center",
              fontSize:16, transition:"all .2s",
            }}
            onMouseEnter={(e)=>{ e.currentTarget.style.background="#1a1008"; e.currentTarget.style.color="#f5efe4"; }}
            onMouseLeave={(e)=>{ e.currentTarget.style.background="rgba(255,255,255,.65)"; e.currentTarget.style.color="#1a1008"; }}>
              {d<0?"←":"→"}
            </button>
          ))}
        </div>
      </div>

      {/* film-strip scroller */}
      <div ref={scroller} style={{
        display:"flex", gap:16, overflowX:"auto", overflowY:"hidden",
        paddingBottom:12,
        scrollSnapType:"x mandatory",
        WebkitOverflowScrolling:"touch",
        scrollbarWidth:"thin",
      }}>
        {cat.products.map((p,i)=>(
          <ProductCard key={p.id} p={p} cat={cat} idx={i} onAdd={onAdd} onPeek={()=>onPeek({ p, cat })}/>
        ))}
        {/* end cap: "see all" */}
        <button onClick={()=>onPeek({ p: cat.products[0], cat })} style={{
          flex:"0 0 180px", scrollSnapAlign:"start",
          display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center",
          border:"1.5px dashed rgba(138,105,50,.35)", borderRadius:10,
          background:"transparent", color:"#3d2d13", cursor:"pointer",
          padding:"20px",
          transition:"all .25s",
        }}
        onMouseEnter={(e)=>{ e.currentTarget.style.borderColor="#8a3e18"; e.currentTarget.style.background="rgba(255,255,255,.4)"; }}
        onMouseLeave={(e)=>{ e.currentTarget.style.borderColor="rgba(138,105,50,.35)"; e.currentTarget.style.background="transparent"; }}>
          <div className="display" style={{ fontSize:28, fontStyle:"italic", marginBottom:8 }}>All {cat.name.toLowerCase()}</div>
          <div className="mono" style={{ fontSize:10, letterSpacing:".3em", textTransform:"uppercase", color:"#8a3e18" }}>Browse aisle →</div>
        </button>
      </div>
    </section>
  );
}

// ───────────────────────── ProductCard ─────────────────────────
function ProductCard({ p, cat, idx, onAdd, onPeek }){
  const [hover, setHover] = spS(false);
  const gradient = `linear-gradient(155deg, ${p.tone[0]} 0%, ${p.tone[1]} 100%)`;
  const handleQuickAdd=(e)=>{
    e.stopPropagation();
    if(cat.sized){ onPeek(); return; } // force size selection through peek
    onAdd(p);
  };
  return (
    <article
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      className="product-card"
      style={{
        flex:"0 0 300px", scrollSnapAlign:"start",
        position:"relative",
        borderRadius:10, overflow:"hidden",
        background:"#fff",
        boxShadow: hover
          ? "0 24px 50px rgba(61,45,19,.28), 0 0 0 1px rgba(138,105,50,.25)"
          : "0 8px 22px rgba(61,45,19,.14)",
        transform: hover ? "translateY(-4px)" : "translateY(0)",
        transition:"all .4s var(--ease-out)",
        cursor:"pointer",
      }}
      onClick={()=>onPeek()}>
      {/* art panel */}
      <div style={{
        position:"relative", aspectRatio:"4/5", overflow:"hidden",
        background: gradient,
      }}>
        {/* ornamental yantra */}
        <svg viewBox="-50 -50 100 100" style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:.2, mixBlendMode:"overlay" }}>
          <g stroke="#fff" strokeWidth=".3" fill="none" style={{
            transformOrigin:"center", animation: hover?"akSpin 60s linear infinite":"akSpin 220s linear infinite",
          }}>
            <circle r="18"/><circle r="32"/><circle r="44"/>
            {Array.from({length:12}).map((_,i)=>{
              const a=(i/12)*Math.PI*2;
              return <line key={i} x1={Math.cos(a)*18} y1={Math.sin(a)*18} x2={Math.cos(a)*44} y2={Math.sin(a)*44}/>;
            })}
          </g>
        </svg>
        {/* vignette */}
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, transparent 40%, rgba(0,0,0,.5) 100%)" }}/>
        {/* index */}
        <div className="mono" style={{
          position:"absolute", top:12, left:14, color:"rgba(255,255,255,.85)",
          fontSize:9, letterSpacing:".3em", textTransform:"uppercase",
        }}>{cat.id}/{String(idx+1).padStart(2,"0")}</div>
        {/* add hover */}
        <button
          onClick={handleQuickAdd}
          style={{
            position:"absolute", right:12, top:12,
            width:36, height:36, borderRadius:"50%",
            background:"rgba(245,239,228,.96)", color:"#1a1008", border:"none",
            cursor:"pointer", fontSize:18, fontWeight:300,
            opacity: hover?1:0, transform: hover?"translateY(0)":"translateY(-4px)",
            transition:"all .3s",
            display:"grid", placeItems:"center",
          }} aria-label={cat.sized?`Pick size for ${p.name}`:`Add ${p.name}`}>{cat.sized?"◷":"+"}</button>
      </div>
      {/* text panel */}
      <div style={{ padding:"16px 16px 18px", background:"#fff" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
          <span className="display" style={{ fontSize:18, fontStyle:"italic", color:"#1a1008" }}>{p.name}</span>
          <span className="mono" style={{ fontSize:11, letterSpacing:".08em", color:"#8a3e18", fontWeight:600 }}>{fmtINR(p.price)}</span>
        </div>
        <div className="mono" style={{ fontSize:9, letterSpacing:".28em", color:"rgba(26,16,8,.55)", textTransform:"uppercase" }}>{p.meta}</div>
      </div>
    </article>
  );
}

// ───────────────────────── PeekModal ─────────────────────────
function PeekModal({ p, cat, onClose, onAdd }){
  const [size, setSize] = spS(cat.sized ? "M" : null);
  spE(()=>{
    const onKey=(e)=>{ if(e.key==="Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return ()=>window.removeEventListener("keydown", onKey);
  },[onClose]);
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:50,
      background:"rgba(26,16,8,.6)", backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)",
      display:"grid", placeItems:"center", padding:"16px",
      animation:"fadeIn .3s ease-out",
      overflowY:"auto",
    }}>
      <div onClick={(e)=>e.stopPropagation()} className="peek-modal" style={{
        width:"min(920px, 100%)", maxHeight:"90vh", overflowY:"auto",
        display:"grid", gridTemplateColumns:"1.1fr 1fr",
        background:"#f5efe4", borderRadius:14, overflow:"hidden",
        boxShadow:"0 60px 120px rgba(0,0,0,.5)",
        animation:"slideUp .45s var(--ease-out)",
      }}>
        <div className="peek-art" style={{
          position:"relative", minHeight:360,
          background:`linear-gradient(155deg, ${p.tone[0]} 0%, ${p.tone[1]} 100%)`,
        }}>
          <svg viewBox="-50 -50 100 100" style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:.18, mixBlendMode:"overlay" }}>
            <g stroke="#fff" strokeWidth=".3" fill="none">
              {[18,32,44].map(r=><circle key={r} r={r}/>)}
              {Array.from({length:24}).map((_,i)=>{
                const a=(i/24)*Math.PI*2;
                return <line key={i} x1={Math.cos(a)*18} y1={Math.sin(a)*18} x2={Math.cos(a)*44} y2={Math.sin(a)*44}/>;
              })}
            </g>
          </svg>
          <div className="mono" style={{ position:"absolute", top:20, left:22, color:"rgba(255,255,255,.85)",
            fontSize:10, letterSpacing:".3em", textTransform:"uppercase" }}>{cat.name} · {p.id.toUpperCase()}</div>
        </div>
        <div style={{ padding:"32px 32px", display:"flex", flexDirection:"column", gap:14 }}>
          <div className="mono" style={{ fontSize:10, letterSpacing:".3em", color:"#8a3e18", textTransform:"uppercase" }}>
            {cat.tag}
          </div>
          <h3 className="display" style={{ fontSize:"clamp(32px, 5vw, 44px)", fontStyle:"italic", margin:0, fontWeight:400, color:"#1a1008", lineHeight:1 }}>{p.name}</h3>
          <div style={{ fontFamily:"var(--mono)", fontSize:12, letterSpacing:".08em", color:"#3d2d13" }}>{p.meta}</div>
          <div style={{ fontSize:22, color:"#1a1008", fontWeight:500, marginTop:4 }}>{fmtINR(p.price)}</div>

          {cat.sized && (
            <div style={{ marginTop:6 }}>
              <div className="mono" style={{ fontSize:9, letterSpacing:".32em", color:"rgba(26,16,8,.55)", textTransform:"uppercase", marginBottom:8 }}>
                Size · <span style={{ color:"#8a3e18" }}>{size}</span>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {cat.sizes.map(s=>{
                  const active = s===size;
                  return (
                    <button key={s} onClick={()=>setSize(s)} style={{
                      minWidth:44, height:40, padding:"0 10px", borderRadius:6,
                      background: active?"#1a1008":"transparent",
                      color: active?"#f5efe4":"#1a1008",
                      border:`1px solid ${active?"#1a1008":"rgba(26,16,8,.2)"}`,
                      fontFamily:"var(--mono)", fontSize:11, fontWeight:600, letterSpacing:".1em",
                      cursor:"pointer", transition:"all .2s",
                    }}>{s}</button>
                  );
                })}
              </div>
              <div className="mono" style={{ fontSize:8, letterSpacing:".28em", color:"rgba(26,16,8,.4)", textTransform:"uppercase", marginTop:8 }}>
                Size guide · Free returns within 14 days
              </div>
            </div>
          )}

          <p style={{ fontSize:14, color:"rgba(26,16,8,.7)", lineHeight:1.7, margin:"10px 0 0", fontWeight:300 }}>
            A quiet object made in small batches. Ships from Delhi within 5 working days,
            wrapped in recycled cotton with a handwritten note of thanks.
          </p>
          <div style={{ display:"flex", gap:10, marginTop:"auto", paddingTop:20, flexWrap:"wrap" }}>
            <button onClick={()=>onAdd(p, { size })} style={{
              flex:"1 1 220px", padding:"14px 18px",
              background:"#1a1008", color:"#f5efe4", border:"none", borderRadius:8,
              fontFamily:"var(--mono)", fontSize:10, letterSpacing:".3em", textTransform:"uppercase", fontWeight:700,
              cursor:"pointer",
            }}>+ Add · {cat.sized?`Size ${size} · `:""}{fmtINR(p.price)}</button>
            <button onClick={onClose} style={{
              padding:"14px 18px",
              background:"transparent", color:"#1a1008",
              border:"1px solid rgba(26,16,8,.25)", borderRadius:8,
              fontFamily:"var(--mono)", fontSize:10, letterSpacing:".3em", textTransform:"uppercase", fontWeight:600,
              cursor:"pointer",
            }}>Close</button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes slideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 720px) {
          .peek-modal { grid-template-columns: 1fr !important; max-height: 94vh !important; }
          .peek-art { min-height: 220px !important; aspect-ratio: 4/3; }
        }
      `}</style>
    </div>
  );
}

// ───────────────────────── CartDrawer ─────────────────────────
function CartDrawer({ open, cart, setCart, total, onClose }){
  return (
    <React.Fragment>
      <div onClick={onClose} style={{
        position:"fixed", inset:0, zIndex:40,
        background:"rgba(26,16,8,.4)",
        opacity: open?1:0, pointerEvents: open?"auto":"none",
        transition:"opacity .35s",
      }}/>
      <aside className="shop-drawer" style={{
        position:"fixed", top:0, right:0, bottom:0, width:"min(420px, 92vw)", zIndex:45,
        background:"#f5efe4", borderLeft:"1px solid rgba(138,105,50,.18)",
        transform: open?"translateX(0)":"translateX(100%)",
        transition:"transform .4s var(--ease-out)",
        display:"flex", flexDirection:"column",
        boxShadow:"-20px 0 60px rgba(0,0,0,.25)",
      }}>
        <div style={{
          padding:"22px 26px", display:"flex", justifyContent:"space-between", alignItems:"center",
          borderBottom:"1px solid rgba(138,105,50,.18)",
        }}>
          <div>
            <div className="mono" style={{ fontSize:9, letterSpacing:".35em", color:"#8a3e18", textTransform:"uppercase" }}>Your Cart</div>
            <div className="display" style={{ fontSize:22, fontStyle:"italic", color:"#1a1008", marginTop:2 }}>
              {cart.length?`${cart.reduce((s,c)=>s+c.qty,0)} pieces`:"Empty"}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close cart" style={{
            width:36, height:36, borderRadius:"50%", background:"transparent",
            border:"1px solid rgba(26,16,8,.2)", cursor:"pointer", color:"#1a1008", fontSize:14,
          }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"18px 26px" }}>
          {cart.length===0 ? (
            <div style={{ padding:"40px 10px", textAlign:"center", color:"rgba(26,16,8,.45)" }}>
              <div className="display" style={{ fontSize:26, fontStyle:"italic", marginBottom:8 }}>Nothing added yet.</div>
              <div className="mono" style={{ fontSize:10, letterSpacing:".3em", textTransform:"uppercase" }}>Browse the aisles →</div>
            </div>
          ) : cart.map(ci=>(
            <div key={ci.cartKey} style={{
              display:"grid", gridTemplateColumns:"1fr auto", gap:12,
              padding:"14px 0", borderBottom:"1px solid rgba(138,105,50,.12)",
            }}>
              <div>
                <div style={{ fontFamily:"var(--display,serif)", fontSize:16, fontStyle:"italic", color:"#1a1008" }}>{ci.name}</div>
                {ci.size && (
                  <div className="mono" style={{ fontSize:9, letterSpacing:".28em", color:"#8a3e18", textTransform:"uppercase", marginTop:3 }}>
                    Size {ci.size}
                  </div>
                )}
                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6 }}>
                  <button onClick={()=>setCart(prev=>prev.map(c=>c.cartKey===ci.cartKey?{...c, qty:Math.max(1,c.qty-1)}:c))}
                    style={{ width:24, height:24, borderRadius:4, border:"1px solid rgba(26,16,8,.2)", background:"transparent", cursor:"pointer" }}>−</button>
                  <span className="mono" style={{ fontSize:11, minWidth:24, textAlign:"center" }}>{ci.qty}</span>
                  <button onClick={()=>setCart(prev=>prev.map(c=>c.cartKey===ci.cartKey?{...c, qty:c.qty+1}:c))}
                    style={{ width:24, height:24, borderRadius:4, border:"1px solid rgba(26,16,8,.2)", background:"transparent", cursor:"pointer" }}>+</button>
                  <button onClick={()=>setCart(prev=>prev.filter(c=>c.cartKey!==ci.cartKey))}
                    className="mono" style={{ marginLeft:10, background:"transparent", border:"none", color:"#8a3e18", fontSize:9, letterSpacing:".25em", textTransform:"uppercase", cursor:"pointer" }}>Remove</button>
                </div>
              </div>
              <div className="mono" style={{ fontSize:12, color:"#1a1008", fontWeight:600, alignSelf:"start" }}>{fmtINR(ci.price*ci.qty)}</div>
            </div>
          ))}
        </div>
        <div style={{ padding:"22px 26px", borderTop:"1px solid rgba(138,105,50,.18)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
            <span className="mono" style={{ fontSize:10, letterSpacing:".3em", color:"rgba(26,16,8,.55)", textTransform:"uppercase" }}>Subtotal</span>
            <span style={{ fontSize:18, fontWeight:600, color:"#1a1008" }}>{fmtINR(total)}</span>
          </div>
          <button disabled={cart.length===0} style={{
            width:"100%", padding:"16px",
            background: cart.length?"#1a1008":"rgba(26,16,8,.25)", color:"#f5efe4", border:"none", borderRadius:8,
            fontFamily:"var(--mono)", fontSize:11, letterSpacing:".3em", textTransform:"uppercase", fontWeight:700,
            cursor: cart.length?"pointer":"default",
          }}>Checkout →</button>
          <div className="mono" style={{ fontSize:9, letterSpacing:".28em", color:"rgba(26,16,8,.4)", textTransform:"uppercase", textAlign:"center", marginTop:10 }}>
            Ships from Delhi · Wrapped in cotton
          </div>
        </div>
      </aside>
    </React.Fragment>
  );
}

Object.assign(window, { ShopPage, SHOP_CATALOG });
