// Akara lib — hooks, content, shared primitives

const { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } = React;

// Shared scroll bus — single rAF-throttled listener
const scrollListeners = new Set();
let latestScrollY = 0;
let rafPending = false;
function emitScroll(){
  rafPending = false;
  scrollListeners.forEach((fn)=>fn(latestScrollY));
}
function onScrollRaw(){
  latestScrollY = window.scrollY;
  if(!rafPending){ rafPending = true; requestAnimationFrame(emitScroll); }
}
if (typeof window !== "undefined"){
  window.addEventListener("scroll", onScrollRaw, { passive:true });
  window.addEventListener("resize", onScrollRaw);
}
function useScrollBus(cb){
  const cbRef = useRef(cb); cbRef.current = cb;
  useEffect(()=>{
    const f = (y)=>cbRef.current(y);
    scrollListeners.add(f);
    f(window.scrollY);
    return ()=>scrollListeners.delete(f);
  },[]);
}

function useInView(ref, opts={ threshold:.15, rootMargin:"0px" }){
  const [v,sv] = useState(false);
  useEffect(()=>{
    if(!ref.current) return;
    const io = new IntersectionObserver(([e])=>{ if(e.isIntersecting){ sv(true); io.disconnect(); } }, opts);
    io.observe(ref.current);
    return ()=>io.disconnect();
  },[]);
  return v;
}

// Magnetic hover — button follows cursor subtly
function useMagnetic(ref, strength=0.25){
  useEffect(()=>{
    const el = ref.current; if(!el) return;
    let raf = null;
    const onMove = (e)=>{
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width/2)) * strength;
      const dy = (e.clientY - (r.top + r.height/2)) * strength;
      if(raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(()=>{ el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`; });
    };
    const onLeave = ()=>{ if(raf) cancelAnimationFrame(raf); el.style.transform = `translate3d(0,0,0)`; };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return ()=>{ el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
  },[strength]);
}

// Stagger words into spans for letter-stagger.
// Spaces get an explicit width so inline-block children don't collapse them.
function StaggerText({ text, delay=0, step=40, style }){
  const chars = text.split("");
  return (
    <span className="stag" style={{ overflow:"hidden", display:"inline-block", ...style }}>
      {chars.map((c,i)=>{
        const isSpace = c===" ";
        return (
          <span key={i} style={{
            animationDelay: `${delay + i*step}ms`,
            display:"inline-block",
            width: isSpace ? "0.28em" : "auto",
          }}>{isSpace ? "\u00A0" : c}</span>
        );
      })}
    </span>
  );
}

function MagButton({ children, primary, href, onClick, style }){
  const ref = useRef(null);
  useMagnetic(ref, 0.18);
  return (
    <a ref={ref} href={href||"#"} onClick={onClick} className={`mag-btn ${primary?"primary":""}`} style={style}>
      {children}
    </a>
  );
}

function SectionKicker({ num, label, align="left" }){
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14, justifyContent: align==="center"?"center":"flex-start", marginBottom: 14 }}>
      <span style={{ height:1, width:32, background:"var(--gold)", opacity:.7 }}/>
      <span className="mono" style={{ fontSize:11, letterSpacing:".32em", color:"var(--gold)", textTransform:"uppercase", fontWeight:500 }}>
        <span style={{opacity:.7}}>§ {num}</span> · {label}
      </span>
    </div>
  );
}

// Content pulled from the live codebase
const HERO = {
  kicker: "AKARA",
  title: "AWAKEN THE INNER SANATANI",
  sub: "Sacred art for your screen — calm, cinematic, and rooted in dharma.",
  scrollHint: "Scroll to explore wallpapers, the shop, music, and what is coming next.",
};

// deity, style (custom names), orientation, and dominant colors for swatch-matching
const WALLPAPER_ITEMS = [
  { id:"w01", title:"Shiva / Kailash Dawn",        deity:"Shiva",    style:"Painterly",   orient:"portrait",  mood:"Stillness",  grad:"linear-gradient(155deg,#0a1832 0%,#1b3a6a 40%,#e0b977 100%)", accent:"#E1A95F", colors:["#0a1832","#1b3a6a","#e0b977"] },
  { id:"w02", title:"Radha-Krishna / Vrindavan",   deity:"Krishna",  style:"Ghiblish",    orient:"landscape", mood:"Reverence",  grad:"linear-gradient(160deg,#1d2a5a 0%,#5a78b8 45%,#fbcaa4 100%)", accent:"#F8BA77", colors:["#1d2a5a","#5a78b8","#fbcaa4"] },
  { id:"w03", title:"Saraswati / Vidya",           deity:"Saraswati",style:"Whitish",     orient:"portrait",  mood:"Clarity",    grad:"radial-gradient(ellipse at 40% 30%,#fef8e8 0%,#cfe5f0 40%,#486080 100%)", accent:"#DCE9F5", colors:["#fef8e8","#cfe5f0","#486080"] },
  { id:"w04", title:"Ganesha / First Light",       deity:"Ganesha",  style:"Stone Shrine",orient:"portrait",  mood:"Beginning",  grad:"linear-gradient(180deg,#2a0d0b 0%,#c56a29 50%,#fef1d1 100%)", accent:"#E37A28", colors:["#2a0d0b","#c56a29","#fef1d1"] },
  { id:"w05", title:"Durga / Sindoor Bloom",       deity:"Durga",    style:"Neon Bhakti", orient:"portrait",  mood:"Strength",   grad:"linear-gradient(135deg,#3a0a14 0%,#a6284a 45%,#f2b6a8 100%)", accent:"#D14B5F", colors:["#3a0a14","#a6284a","#f2b6a8"] },
  { id:"w06", title:"Hanuman / Lanka Flight",      deity:"Hanuman",  style:"Painterly",   orient:"landscape", mood:"Devotion",   grad:"radial-gradient(circle at 50% 80%,#fde5b2 0%,#e37a28 25%,#2a0d0b 75%)", accent:"#F0A857", colors:["#fde5b2","#e37a28","#2a0d0b"] },
  { id:"w07", title:"Lakshmi / Prosperity",        deity:"Lakshmi",  style:"Miniature",   orient:"portrait",  mood:"Grace",      grad:"linear-gradient(155deg,#1a0f25 0%,#7a3050 40%,#f3c97c 100%)", accent:"#F3C97C", colors:["#1a0f25","#7a3050","#f3c97c"] },
  { id:"w08", title:"Yantra / Sri",                 deity:"Yantra",   style:"Geometric",   orient:"portrait",  mood:"Geometry",   grad:"conic-gradient(from 45deg at 50% 50%,#0a1626,#1a2a3a,#c5a059,#0a1626)", accent:"#C5A059", colors:["#0a1626","#1a2a3a","#c5a059"] },
  { id:"w09", title:"Krishna / Yamuna Night",      deity:"Krishna",  style:"Painterly",   orient:"portrait",  mood:"Mystery",    grad:"linear-gradient(170deg,#050914 0%,#122456 40%,#4a6ea5 100%)", accent:"#4a6ea5", colors:["#050914","#122456","#4a6ea5"] },
  { id:"w10", title:"Shiva / Nataraja",            deity:"Shiva",    style:"Monochrome",  orient:"portrait",  mood:"Ecstasy",    grad:"radial-gradient(circle at 50% 45%,#f4e8c8 0%,#8a6932 35%,#1a0e06 85%)", accent:"#C79A4E", colors:["#f4e8c8","#8a6932","#1a0e06"] },
  { id:"w11", title:"Saraswati / Veena",           deity:"Saraswati",style:"Ghiblish",    orient:"landscape", mood:"Poetry",     grad:"linear-gradient(165deg,#e7f0f5 0%,#cfd9d5 40%,#8a9e88 100%)", accent:"#B8C7B0", colors:["#e7f0f5","#cfd9d5","#8a9e88"] },
  { id:"w12", title:"Ganesha / Modaka",            deity:"Ganesha",  style:"Whitish",     orient:"portrait",  mood:"Warmth",     grad:"linear-gradient(155deg,#fff6e5 0%,#f0d19a 50%,#b67d3a 100%)", accent:"#E9B969", colors:["#fff6e5","#f0d19a","#b67d3a"] },
  { id:"w13", title:"Durga / Mahishasura",         deity:"Durga",    style:"Painterly",   orient:"landscape", mood:"Fury",       grad:"linear-gradient(155deg,#090203 0%,#6b1a24 40%,#e28a5a 100%)", accent:"#D1584A", colors:["#090203","#6b1a24","#e28a5a"] },
  { id:"w14", title:"Hanuman / Sanjivani",         deity:"Hanuman",  style:"Neon Bhakti", orient:"portrait",  mood:"Resolve",    grad:"linear-gradient(175deg,#1a0a18 0%,#c43c66 45%,#ffd6a0 100%)", accent:"#E55E7F", colors:["#1a0a18","#c43c66","#ffd6a0"] },
  { id:"w15", title:"Lakshmi / Gajendra",          deity:"Lakshmi",  style:"Miniature",   orient:"landscape", mood:"Abundance",  grad:"linear-gradient(160deg,#14251a 0%,#5e8e6b 40%,#f3e2a8 100%)", accent:"#BFD8A0", colors:["#14251a","#5e8e6b","#f3e2a8"] },
  { id:"w16", title:"Yantra / Meru",               deity:"Yantra",   style:"Geometric",   orient:"portrait",  mood:"Axis",       grad:"conic-gradient(from 0deg at 50% 50%,#000,#3a0a14,#c5a059,#fef1d1,#000)", accent:"#C5A059", colors:["#000000","#3a0a14","#c5a059"] },
  { id:"w17", title:"Kali / Dakshineshwar",        deity:"Kali",     style:"Monochrome",  orient:"portrait",  mood:"Fierce",     grad:"radial-gradient(circle at 50% 30%,#221822 0%,#060205 60%,#000 100%)", accent:"#7a5b7a", colors:["#221822","#060205","#7a5b7a"] },
  { id:"w18", title:"Rama / Ayodhya Return",       deity:"Rama",     style:"Stone Shrine",orient:"landscape", mood:"Homecoming", grad:"linear-gradient(180deg,#2a1606 0%,#e39638 50%,#fde9b7 100%)", accent:"#E9A85A", colors:["#2a1606","#e39638","#fde9b7"] },
];

// Swatch palette — cohesive with brand, curated for picker
const WP_SWATCHES = [
  { id:"gold-white",  label:"Gold & White",      colors:["#c5a059","#fef1d1"] },
  { id:"black-gold",  label:"Black & Gold",      colors:["#050505","#c5a059"] },
  { id:"indigo-dusk", label:"Indigo Dusk",       colors:["#0a1832","#486080"] },
  { id:"sindoor",     label:"Sindoor & Saffron", colors:["#a6284a","#e37a28"] },
  { id:"pearl",       label:"Pearl & Silver",    colors:["#fef8e8","#cfd9d5"] },
  { id:"moss",        label:"Moss & Ivory",      colors:["#5e8e6b","#f3e2a8"] },
  { id:"mystic",      label:"Violet Mystic",     colors:["#1a0f25","#7a3050"] },
  { id:"obsidian",    label:"Obsidian",          colors:["#0a0a0a","#221822"] },
];

// custom style taxonomy
const WP_STYLES = ["Painterly","Ghiblish","Whitish","Stone Shrine","Neon Bhakti","Miniature","Geometric","Monochrome"];
const WP_DEITIES = ["Shiva","Krishna","Saraswati","Ganesha","Durga","Hanuman","Lakshmi","Kali","Rama","Yantra"];

const SHOP_ITEMS = [
  { id:"s-clothing", name:"Clothing",      lead:"Woven in Varanasi", sub:"Cotton · Silk · Linen",   video:"/akara/assets/shop-clothing.mp4",  img:"/akara/assets/shop-clothing-sm.png",  tint:"#d08a70", href:"/shop/clothing" },
  { id:"s-prints",   name:"Fine Prints",   lead:"Giclée on cotton",  sub:"A2 · A3 · Editions",       video:"/akara/assets/shop-prints.mp4",    img:"/akara/assets/shop-prints-sm.png",     tint:"#e4b37a", href:"/shop/prints" },
  { id:"s-merch",    name:"Merchandise",   lead:"Objects for living",sub:"Brass · Ceramic · Wood",   video:"/akara/assets/shop-merch.mp4",     img:"/akara/assets/shop-merch-sm.png",      tint:"#8fb5d6", href:"/shop/merch" },
];

const TRACKS = [
  { id:"t1", title:"Asato Mā Sadgamaya", invokes:"Saraswati", mood:"Stillness",  occasion:"Pre-dawn",     element:"Space",  dur:"4:32", durSec:272 },
  { id:"t2", title:"Gāyatrī Mantra",       invokes:"Savitṛ",     mood:"Clarity",    occasion:"Sandhya",      element:"Light",  dur:"6:18", durSec:378 },
  { id:"t3", title:"Śiva Tāṇḍava Stotra", invokes:"Shiva",      mood:"Ecstasy",    occasion:"Night · Moksha", element:"Fire",   dur:"5:47", durSec:347 },
  { id:"t4", title:"Hanumān Chālīsā",      invokes:"Hanuman",    mood:"Devotion",   occasion:"Tuesday · Strength", element:"Earth", dur:"7:12", durSec:432 },
  { id:"t5", title:"Lalitā Sahasranāma",   invokes:"Lalitā",     mood:"Grace",      occasion:"Friday · Aarti",  element:"Water", dur:"8:04", durSec:484 },
];

const STORY_CHAPTERS = [
  { id:"where",    title:"Where it began",          body:"I grew up in a time where speaking about our traditions with pride didn't always feel easy. There were more questions than answers — about whether Hinduism was regressive, outdated, or something to outgrow. Those doubts stayed with me." },
  { id:"discover", title:"What I discovered",       body:"As I started reading and forming my own understanding, I found something very different — a depth in Sanatan Dharma that felt expansive, philosophical, and deeply fulfilling. But stepping into the real world, I realized how few people truly experience this richness today." },
  { id:"why",      title:"Why Akara exists",         body:"Akara began as a response to that gap — a way to awaken the inner Sanatani in a way that feels natural, not forced. Art became our medium, because it transcends language. From north to south, east to west — our iconography is something we all instinctively understand." },
  { id:"build",    title:"What we are building",    body:"We started with wallpapers — something you see every day, quietly becoming a reminder. Using AI thoughtfully, we create visuals that are aesthetic, respectful, and intentional — never noise, never \u201CAI slop.\u201D This is just the beginning — from digital to physical, we're building something people can live with, not just look at." },
  { id:"help",     title:"Help us build this",       body:"Akara is still at its earliest stage, and every step forward is community-powered. If this resonates with you, the simplest way to support us right now is by carrying Akara with you — through our merchandise, our art, and our journey. You're not just supporting a brand, you're helping grow a space for all of us." },
];

// ───────── Live wallpaper API integration ─────────
function _akInferDeity(text){
  const t = String(text||"").toLowerCase();
  const list = [
    ["krishna","Krishna"],["radha","Krishna"],["shiva","Shiva"],["nataraja","Shiva"],
    ["saraswati","Saraswati"],["ganesha","Ganesha"],["ganesh","Ganesha"],
    ["durga","Durga"],["kali","Kali"],["lakshmi","Lakshmi"],["laxmi","Lakshmi"],
    ["hanuman","Hanuman"],["rama","Rama"],["yantra","Yantra"],
  ];
  for(const [k,v] of list) if(t.includes(k)) return v;
  return "Krishna";
}
function _akInferStyle(s){
  if(!s) return "Painterly";
  const v = String(s).trim();
  if(v.toLowerCase()==="wallpaper") return "Painterly";
  return v;
}
function _akInferOrient(ratio){
  if(!ratio || typeof ratio !== "string") return "portrait";
  const m = ratio.match(/^(\d+)\s*[:x]\s*(\d+)/);
  if(!m) return "portrait";
  return parseInt(m[1],10) >= parseInt(m[2],10) ? "landscape" : "portrait";
}
function _akParsePalette(p){
  if(!p) return null;
  if(Array.isArray(p)) return p.filter(Boolean).slice(0,5);
  if(typeof p === "string"){
    const arr = p.split(/[\s,]+/).filter(Boolean);
    return arr.length ? arr.slice(0,5) : null;
  }
  return null;
}
function _akAssetUrl(key){
  if(!key) return null;
  return `/content/${String(key).replace(/^\//,"")}`;
}
// Phase 3: preview path is deterministic — originals/{uuid}.{ext} ↔ previews/{uuid}.jpg.
// The generatePreview Lambda creates that JPEG on every PutObject; the backfill
// script ensures it exists for historical uploads. Anonymous viewers always
// load this watermarked, downscaled version. Members get fileKey directly.
function _akPreviewUrl(fileKey){
  if(!fileKey) return null;
  const k = String(fileKey).replace(/^\//,"");
  if (!k.startsWith("originals/")) return _akAssetUrl(k);
  const base = k.substring("originals/".length).replace(/\.[^./]+$/, "");
  return `/content/previews/${base}.jpg`;
}
const _AK_MOOD_ROTATION = ["Stillness","Reverence","Clarity","Beginning","Strength","Devotion","Grace","Geometry","Mystery","Ecstasy","Poetry","Warmth","Fury","Resolve","Abundance","Axis","Fierce","Homecoming"];
const _AK_FALLBACK_GRADS = [
  ["linear-gradient(155deg,#0a1832 0%,#1b3a6a 40%,#e0b977 100%)","#E1A95F",["#0a1832","#1b3a6a","#e0b977"]],
  ["linear-gradient(160deg,#1d2a5a 0%,#5a78b8 45%,#fbcaa4 100%)","#F8BA77",["#1d2a5a","#5a78b8","#fbcaa4"]],
  ["radial-gradient(ellipse at 40% 30%,#fef8e8 0%,#cfe5f0 40%,#486080 100%)","#DCE9F5",["#fef8e8","#cfe5f0","#486080"]],
  ["linear-gradient(180deg,#2a0d0b 0%,#c56a29 50%,#fef1d1 100%)","#E37A28",["#2a0d0b","#c56a29","#fef1d1"]],
  ["linear-gradient(135deg,#3a0a14 0%,#a6284a 45%,#f2b6a8 100%)","#D14B5F",["#3a0a14","#a6284a","#f2b6a8"]],
  ["linear-gradient(155deg,#1a0f25 0%,#7a3050 40%,#f3c97c 100%)","#F3C97C",["#1a0f25","#7a3050","#f3c97c"]],
];

function mapApiWallpaper(api, idx){
  const titleRaw = api.title || "Untitled";
  const deity = _akInferDeity(`${api.title} ${api.caption||""}`);
  const titleClean = titleRaw.replace(/^\s*([A-Za-z]+)\s*[\/-]\s*/, "");
  const style = _akInferStyle(api.style);
  const orient = _akInferOrient(api.ratio);
  const mood = _AK_MOOD_ROTATION[idx % _AK_MOOD_ROTATION.length];
  const palette = _akParsePalette(api.palette);
  const fb = _AK_FALLBACK_GRADS[idx % _AK_FALLBACK_GRADS.length];
  const colors = palette && palette.length>=2 ? palette : fb[2];
  const grad = palette && palette.length>=2
    ? `linear-gradient(155deg, ${colors[0]} 0%, ${colors[Math.min(1,colors.length-1)]} 50%, ${colors[Math.min(2,colors.length-1)] || colors[0]} 100%)`
    : fb[0];
  return {
    id: api.id || `w-live-${idx}`,
    title: `${deity} / ${titleClean.length>40 ? titleClean.slice(0,40)+"…" : titleClean}`,
    deity, style, orient, mood, grad,
    accent: (palette && palette[0]) || fb[1],
    colors,
    // Phase 3: imageUrl is the *anonymous* tile — always the watermarked
    // preview. fullUrl is the gated original (CloudFront 403s without a
    // valid signed cookie). The gallery/lightbox swap based on auth state.
    imageUrl: _akPreviewUrl(api.fileKey) || _akAssetUrl(api.thumbKey || api.fileKey),
    fullUrl:  _akAssetUrl(api.fileKey),
    previewUrl: _akPreviewUrl(api.fileKey),
    originalUrl: _akAssetUrl(api.fileKey),
    shloka: api.shloka || "",
    meaning: api.meaning || "",
    caption: api.caption || "",
    // Phase 3 freemium teaser. When true: preview is full-res unwatermarked.
    freePreview: api.freePreview === true,
  };
}

let _akWallpapersLoaded = false;
let _akWallpapersData = null;
const _akWallpaperListeners = new Set();

async function loadLiveWallpapers(){
  if(_akWallpapersLoaded) return _akWallpapersData;
  // Phase 3: empty string is a valid base (same-origin via CloudFront /api/*).
  // Treat undefined/null as missing config; "" is a green light.
  const baseRaw = (typeof window !== "undefined") ? window.__AKARA_API_BASE : undefined;
  if (baseRaw === undefined || baseRaw === null){ _akWallpapersLoaded = true; return null; }
  const base = baseRaw;
  try{
    const res = await fetch(`${base}/api/catalog?type=wallpaper&limit=100`, { credentials:"omit" });
    const json = await res.json();
    if(json && json.ok && Array.isArray(json.items)){
      _akWallpapersData = json.items.filter(i=>!i.archived).map(mapApiWallpaper);
      window.WALLPAPER_ITEMS_LIVE = _akWallpapersData;
    }
  } catch(e){ /* fall back to static */ }
  _akWallpapersLoaded = true;
  _akWallpaperListeners.forEach(fn=>fn(_akWallpapersData));
  return _akWallpapersData;
}

function useLiveWallpapers(){
  const [items, setItems] = useState(()=>_akWallpapersData || WALLPAPER_ITEMS);
  useEffect(()=>{
    if(_akWallpapersLoaded){
      if(_akWallpapersData && _akWallpapersData.length) setItems(_akWallpapersData);
      return;
    }
    const fn = (data)=>{ if(data && data.length) setItems(data); };
    _akWallpaperListeners.add(fn);
    loadLiveWallpapers();
    return ()=>_akWallpaperListeners.delete(fn);
  },[]);
  return items;
}

if (typeof window !== "undefined"){ loadLiveWallpapers(); }

Object.assign(window, { useScrollBus, useInView, useMagnetic, StaggerText, MagButton, SectionKicker,
  HERO, WALLPAPER_ITEMS, WP_SWATCHES, WP_STYLES, WP_DEITIES, SHOP_ITEMS, TRACKS, STORY_CHAPTERS,
  useLiveWallpapers, loadLiveWallpapers, mapApiWallpaper });
