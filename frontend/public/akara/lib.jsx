// Akara lib — hooks, content, shared primitives

const { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } = React;

// ── Google Analytics 4 (2026-10-04) ─────────────────────────────────────────
// Injected at runtime for the same reason as the CSS below: the live
// prerendered index.html must not be patched (Next hydration crash).
// GA4 "enhanced measurement" counts the in-app route changes (/shop etc.).
// The same tag is inlined in public/ganpati.html and in the Times pages
// (akara-times-daily Lambda template).
if (typeof document !== "undefined" && !document.getElementById("ak-ga4")){
  const AK_GA_ID = "G-BQEB260FD7";
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", AK_GA_ID);
  const ga = document.createElement("script");
  ga.id = "ak-ga4";
  ga.async = true;
  ga.src = "https://www.googletagmanager.com/gtag/js?id=" + AK_GA_ID;
  document.head.appendChild(ga);
}
// Shared tracker (clicks, sections, scroll, time): /akara/ak-track.js.
// akTrack() is defined here too so feature events sent before that file
// loads still reach Google (gtag queues them).
if (typeof window !== "undefined"){
  window.akTrack = window.akTrack || function(name, params){ try{ window.gtag("event", name, params || {}); }catch(e){} };
  if (!document.getElementById("ak-track-js")){
    const tk = document.createElement("script");
    tk.id = "ak-track-js"; tk.async = true; tk.src = "/akara/ak-track.js";
    document.head.appendChild(tk);
  }
}

// ── micro-interaction CSS (2026-07-23) ──────────────────────────────────────
// Injected at runtime because the LIVE prerendered index.html's <style> block
// cannot be safely patched (Next hydration replaces it with the string baked
// into the deployed JS chunks). The same rules also live in the three static
// style blocks (src/app/akara-site.css, akara.html, index.html) for the next
// full-shell deploy — after which this injection is harmless duplication and
// may be removed. Keep all copies in lockstep.
if (typeof document !== "undefined" && !document.getElementById("ak-micro-css")){
  const st = document.createElement("style");
  st.id = "ak-micro-css";
  st.textContent = `
.nav-links .link-u{transition:opacity .35s var(--ease-out),filter .35s var(--ease-out)}
.nav-links:hover .link-u{opacity:.4;filter:blur(1px)}
.nav-links:hover .link-u:hover{opacity:1;filter:none}
.tbtn .tb-ic{display:block;transition:transform .28s var(--ease-out)}
.tbtn:hover{background:rgba(197,160,89,.14)!important;border-color:rgba(197,160,89,.5)!important}
.tbtn-next:hover .tb-ic{transform:translateX(3px)}
.tbtn-prev:hover .tb-ic{transform:translateX(-3px)}
.tbtn:active .tb-ic{transform:scale(.82)}
.play-btn:hover{transform:scale(1.06)}
.play-btn:active{transform:scale(.94)}
.pb-ring{position:absolute;inset:0;border-radius:50%;border:1.5px solid var(--gold);opacity:0;pointer-events:none;animation:akRingOut .9s var(--ease-out) forwards}
@keyframes akRingOut{0%{transform:scale(1);opacity:.85}100%{transform:scale(2.2);opacity:0}}
@media (prefers-reduced-motion:reduce){
.pb-ring{animation:none}
.nav-links .link-u,.tbtn .tb-ic{transition:none}
.nav-links:hover .link-u{opacity:1;filter:none}
}`;
  document.head.appendChild(st);
}

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
  { id:"s-clothing", name:"Clothing",      lead:"Printed to order", sub:"Supima · Cotton · Unisex", video:"/akara/assets/shop-clothing.mp4",  img:"/akara/assets/shop-clothing-sm.png",  tint:"#d08a70", href:"/shop?aisle=clothing", aisle:"clothing" },
  { id:"s-prints",   name:"Fine Prints",   lead:"Giclée on cotton",  sub:"A2 · A3 · Editions",       video:"/akara/assets/shop-prints.mp4",    img:"/akara/assets/shop-prints-sm.png",     tint:"#e4b37a", href:"/shop?aisle=prints",   aisle:"prints" },
  { id:"s-merch",    name:"Merchandise",   lead:"Objects for living",sub:"Brass · Ceramic · Wood",   video:"/akara/assets/shop-merch.mp4",     img:"/akara/assets/shop-merch-sm.png",      tint:"#8fb5d6", href:"/shop?aisle=merch",    aisle:"merch" },
];

// ── Shopify Storefront (2026-09-06) ─────────────────────────────────────────
// akara.studio is the face of the store; the Shopify Storefront is the till.
// The token below is a PUBLIC Storefront token (read products, write carts).
// It is safe in client code. Rotate it in Shopify admin → Headless channel.
const AKARA_SHOPIFY = {
  domain: "srfvqf-tj.myshopify.com",
  token: "c19a6e5993655118c7b44df70ec9a3ad",
  version: "2025-07",
};
// Judge.me PUBLIC token (2026-09-07). Read-only widget endpoints, CORS-open to
// akara.studio. Rotate in Judge.me → Settings → Integrations → API.
const AKARA_JUDGEME = {
  token: "uYG86eq35fhsh2uH_6Rs6cbYT5g",
  base: "https://judge.me/api/v1",
};
async function shopifyStorefront(query, variables = {}){
  const res = await fetch(`https://${AKARA_SHOPIFY.domain}/api/${AKARA_SHOPIFY.version}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": AKARA_SHOPIFY.token },
    body: JSON.stringify({ query, variables }),
  });
  if(!res.ok) throw new Error("storefront http " + res.status);
  const j = await res.json();
  if(j.errors && j.errors.length) throw new Error(j.errors[0].message || "storefront error");
  return j.data;
}

// Akara's own recordings. Audio + square album art live in the frontend bucket
// under /akara/music/ (public) — catalog originals/ are member-gated, so they
// cannot back a public player. Album art = a crop of the matching deity wallpaper.
const _akTrack = (slug, o) => ({ id:slug, src:`/akara/music/${slug}.mp3`, art:`/akara/music/art/${slug}.jpg`,
  dur:`${Math.floor(o.durSec/60)}:${String(o.durSec%60).padStart(2,"0")}`, ...o });
const TRACKS = [
  _akTrack("ganpati-bappa-morya",     { title:"Gaṇapati Bāppā Moryā",        invokes:"Ganesha",  mood:"Celebration", occasion:"Chaturthi · Visarjan", element:"Earth", durSec:227 }),
  _akTrack("om-gan-ganapataye",       { title:"Oṃ Gaṃ Gaṇapataye Namo Namaḥ", invokes:"Ganesha",  mood:"Beginning",   occasion:"Before any work",     element:"Earth", durSec:224 }),
  _akTrack("premsagar",               { title:"Premasāgara",                  invokes:"Shiva · Pārvatī", mood:"Longing", occasion:"Monday · Dusk",    element:"Water", durSec:252 }),
  _akTrack("shankar-albele",          { title:"Śaṅkara Albele",               invokes:"Shiva",    mood:"Stillness",   occasion:"Monday · Pre-dawn",   element:"Space", durSec:148 }),
  _akTrack("shishu-rama",             { title:"Śiśurāma Vibhor Akhilaṃ Lalitam", invokes:"Rama", mood:"Tenderness", occasion:"Navami · Lullaby", element:"Light", durSec:227 }),
  _akTrack("jai-shri-ram",            { title:"Jaya Śrī Rāma",                invokes:"Rama",     mood:"Resolve",     occasion:"Navami · Morning",    element:"Light", durSec:179 }),
  _akTrack("kah-sah",                 { title:"Kaḥ Saḥ?",                     invokes:"Hanuman",  mood:"Fury",        occasion:"Tuesday · Strength",  element:"Air",   durSec:293 }),
  _akTrack("vajra-breath-choir",      { title:"Vajra Breath Choir",           invokes:"Hanuman",  mood:"Fierce",      occasion:"Saturday · Courage",  element:"Fire",  durSec:171 }),
  _akTrack("aham-vayuh",              { title:"Aham Vāyuḥ",                   invokes:"Hanuman",  mood:"Ecstasy",     occasion:"Tuesday · Dawn",      element:"Air",   durSec:236 }),
  _akTrack("manojavam",               { title:"Manojavam",                    invokes:"Hanuman",  mood:"Warmth",      occasion:"Evening · Rest",      element:"Air",   durSec:144 }),
  _akTrack("padmahaste-padmalakshmi", { title:"Padmahaste Padmalakṣmī",       invokes:"Lakshmi",  mood:"Abundance",   occasion:"Friday · Aarti",      element:"Water", durSec:380 }),
  _akTrack("shantakaram",             { title:"Śāntākāraṃ Bhujagaśayanam",    invokes:"Vishnu",   mood:"Grace",       occasion:"Ekadashi · Night",    element:"Space", durSec:207 }),
  _akTrack("argala",                  { title:"Argalā Stotram",               invokes:"Durga",    mood:"Reverence",   occasion:"Navaratri",           element:"Fire",  durSec:196 }),
  _akTrack("krishna-rain-song",       { title:"Krishna Rain Song",            invokes:"Krishna",  mood:"Poetry",      occasion:"Monsoon · Afternoon", element:"Water", durSec:91 }),
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
  // No match → no deity. (Was "Krishna", which mislabelled every untagged image.)
  return "";
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
  // Owner-approved deities (admin Organize) win. Otherwise guess from the title
  // only: many old captions were pasted from the wrong post.
  const deity = (Array.isArray(api.deities) && api.deities[0]) || _akInferDeity(api.title);
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
    title: (deity ? `${deity} / ` : "") + (titleClean.length>40 ? titleClean.slice(0,40)+"…" : titleClean),
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
    // "strip" = one wide artwork cut into strips (old rows have no field);
    // "carousel" = separate images. Picks how AkSlideTile/AkSlideViewer show it.
    layout: api.layout === "carousel" ? "carousel" : "strip",
    // Carousel: extra slides after the cover. Same auth-gated url pairs as
    // the cover, so tiles and lightbox pick with akSlideSources().
    slides: (Array.isArray(api.slideKeys) ? api.slideKeys : []).map((k) => ({
      imageUrl: _akPreviewUrl(k) || _akAssetUrl(k),
      fullUrl: _akAssetUrl(k),
      previewUrl: _akPreviewUrl(k),
      originalUrl: _akAssetUrl(k),
    })),
  };
}

// Cover + slides as one ordered list of image urls, respecting the auth gate
// the single-image paths use. Empty `slides` → a one-element list, so every
// caller can treat a plain wallpaper and a carousel the same way.
function akSlideSources(w){
  if(!w) return [];
  const signedIn = (typeof akHasSession === "function") ? akHasSession() : ((typeof akCurrentUser === "function") && !!akCurrentUser());
  const pick = (x) => signedIn ? (x.originalUrl || x.fullUrl || x.imageUrl) : (x.previewUrl || x.imageUrl);
  return [w, ...(Array.isArray(w.slides) ? w.slides : [])].map(pick).filter(Boolean);
}

// ── Multi-image posts: one component for every surface (2026-10-09) ────────
// Tiles (gallery, wallpapers) use AkSlideTile; the lightbox uses
// AkSlideViewer. Change the look here, never in the callers.
//   strip    → tile: strips side by side. Lightbox: Strips / Swipe / Full.
//   carousel → tile: cover + "1 / N" badge. Lightbox: Swipe only.
const AK_SLIDE_EASE = "cubic-bezier(.22,1,.36,1)";
function _akReducedMotion(){
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch(e){ return false; }
}

// Members' tiles: the 480px clean WebP at /content/originals/sm/{uuid}
// (~44 KB) instead of the ~2 MB original. The original is the fallback for
// the few uploads without an sm variant.
function _akTileSrc(src){
  const m = /^(.*\/content\/originals\/)([^/?#]+?)(\.[^./?#]+)?$/.exec(src || "");
  return m ? `${m[1]}sm/${m[2]}` : src;
}
function AkTileImg({ src, alt, fit }){
  const sm = _akTileSrc(src);
  return <ProtectedImage src={sm} fallbackSrc={sm !== src ? src : undefined} alt={alt} fit={fit} watermark={false}/>;
}

function AkSlideTile({ w, alt }){
  const srcs = akSlideSources(w);
  if (!srcs.length) return null;
  const title = alt != null ? alt : (w.title || "");
  if (srcs.length === 1) return <AkTileImg src={srcs[0]} alt={title} fit="cover"/>;
  if (w.layout === "carousel") return (
    <>
      <AkTileImg src={srcs[0]} alt={title} fit="cover"/>
      <span className="mono" aria-label={`${srcs.length} images`} style={{
        // Sits under the tile's top row (number + mood tag), right-aligned.
        position:"absolute", top:44, right:14, zIndex:2, pointerEvents:"none",
        fontSize:9, letterSpacing:".22em", color:"var(--gold)",
        padding:"5px 8px 4px", border:"1px solid rgba(197,160,89,.55)",
        background:"rgba(5,5,6,.62)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)",
      }}>1 / {srcs.length}</span>
    </>
  );
  // Strip: the strips are one wide artwork cut left→right, so laid side by
  // side (thin gutters, like the feed) they read as the panorama.
  return (
    <div style={{ position:"absolute", inset:0, display:"flex", gap:3 }}>
      {srcs.map((src, i) => (
        <div key={i} style={{ position:"relative", flex:1, minWidth:0, overflow:"hidden" }}>
          <AkTileImg src={src} alt={i === 0 ? title : ""} fit="cover"/>
        </div>
      ))}
    </div>
  );
}

// Natural aspect ratios (w/h) of a list of image urls; null until all load.
function _akUseRatios(srcs){
  const key = srcs.join("|");
  const [ratios, setRatios] = useState(null);
  useEffect(() => {
    let alive = true; setRatios(null);
    Promise.all(srcs.map((src) => new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1);
      im.onerror = () => res(1);
      im.src = src;
    }))).then((r) => { if (alive) setRatios(r); });
    return () => { alive = false; };
  }, [key]);
  return ratios;
}

// Size of an element, kept current on resize.
function _akUseBox(ref){
  const [box, setBox] = useState({ w:0, h:0 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return box;
}

function AkSlideViewer({ w, inset = "6% 4%" }){
  const srcs = akSlideSources(w);
  const isCarousel = w.layout === "carousel";
  const modes = isCarousel ? ["swipe"] : ["strips", "swipe", "full"];
  const [mode, setMode] = useState(modes[0]);
  const [i, setI] = useState(0);
  const [dx, setDx] = useState(0);
  const touch = useRef(null); // { x, y, h: horizontal?, mx: last drag }
  const stage = useRef(null);
  const box = _akUseBox(stage);
  const ratios = _akUseRatios(srcs);
  const still = _akReducedMotion();
  const n = srcs.length;
  if (!n) return null;
  if (n === 1) return (
    <div style={{ position:"absolute", inset }}>
      <ProtectedImage src={srcs[0]} alt={w.title} fit="contain" watermark={false}/>
    </div>
  );

  const go = (k) => setI(Math.max(0, Math.min(n - 1, k)));
  // Horizontal swipes belong to the slides; vertical ones still bubble up
  // to the lightbox (up/down = next/previous post).
  const onTouchStart = (e) => { const t = e.touches[0]; touch.current = { x:t.clientX, y:t.clientY, h:null }; };
  const onTouchMove = (e) => {
    const s = touch.current; if (!s) return;
    const t = e.touches[0], mx = t.clientX - s.x, my = t.clientY - s.y;
    if (s.h === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) s.h = Math.abs(mx) > Math.abs(my);
    if (s.h) { e.stopPropagation(); s.mx = mx; setDx(mx); }
  };
  const onTouchEnd = (e) => {
    const s = touch.current; touch.current = null;
    if (!s || !s.h) return;
    e.stopPropagation();
    // Read the drag from the ref: a fast flick can end before React re-renders.
    const width = box.w || 1, mx = s.mx || 0;
    if (mx < -width * 0.18) go(i + 1); else if (mx > width * 0.18) go(i - 1);
    setDx(0);
  };

  // Swipe: the dots ride the top edge of the current picture (object-fit:
  // contain leaves letterbox space), under the mode switch when it shows,
  // so they never land on the lightbox caption at the bottom.
  let dotsTop = null;
  if (ratios && box.w && box.h) {
    const r = ratios[i] || 1;
    const imgH = r > box.w / box.h ? box.w / r : box.h;
    dotsTop = Math.max((box.h - imgH) / 2 + 12, modes.length > 1 ? 50 : 0);
  }

  let art;
  if (mode === "swipe") {
    const pct = box.w ? (dx / box.w) * 100 : 0;
    art = (
      <div style={{ position:"absolute", inset:0, overflow:"hidden" }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div style={{
          position:"absolute", inset:0, display:"flex",
          transform:`translate3d(${-i * 100 + pct}%,0,0)`,
          transition: dx || still ? "none" : `transform .9s ${AK_SLIDE_EASE}`,
        }}>
          {srcs.map((src, k) => (
            <div key={k} style={{ position:"relative", flex:"0 0 100%", height:"100%" }}>
              <ProtectedImage src={src} alt={k === 0 ? w.title : `${w.title}, ${k + 1} of ${n}`} fit="contain" watermark={false}/>
            </div>
          ))}
        </div>
      </div>
    );
  } else {
    // Strips / Full: every strip at one shared height, sized from the real
    // aspect ratios so "Full" joins them with no seam.
    const gap = mode === "strips" ? 6 : 0;
    let W = 0, H = 0;
    if (ratios && box.w && box.h) {
      const sum = ratios.reduce((a, b) => a + b, 0);
      const free = box.w - gap * (n - 1);
      H = Math.min(box.h, free / sum);
      W = H * sum + gap * (n - 1);
    }
    art = (
      <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center" }}>
        {W > 0 && (
          <div style={{ display:"flex", gap, width:W, height:H, transition: still ? "none" : `gap .9s ${AK_SLIDE_EASE}` }}>
            {srcs.map((src, k) => (
              <div key={k} style={{ position:"relative", flex:`${ratios[k]} 1 0`, minWidth:0 }}>
                <ProtectedImage src={src} alt={k === 0 ? w.title : ""} fit="cover" watermark={false}/>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const chip = { pointerEvents:"auto", background:"none", border:"none", cursor:"pointer", padding:"6px 2px",
    fontSize:9, letterSpacing:".3em", textTransform:"uppercase", fontFamily:"inherit" };
  const arrow = (dir) => ({ pointerEvents:"auto", position:"absolute", top:"50%", [dir < 0 ? "left" : "right"]:6,
    transform:"translateY(-50%)", width:38, height:38, borderRadius:"50%", border:"1px solid rgba(197,160,89,.5)",
    background:"rgba(5,5,6,.55)", color:"var(--gold)", cursor:"pointer", fontSize:15, display:"grid", placeItems:"center",
    backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)", transition:"opacity .6s ease" });

  return (
    <div style={{ position:"absolute", inset }}>
      <div ref={stage} style={{ position:"absolute", inset:0 }}>{art}</div>
      {mode === "swipe" && (
        <>
          <button aria-label="Previous image" onClick={(e) => { e.stopPropagation(); go(i - 1); }}
            style={{ ...arrow(-1), opacity: i === 0 ? 0 : 1, pointerEvents: i === 0 ? "none" : "auto" }}>‹</button>
          <button aria-label="Next image" onClick={(e) => { e.stopPropagation(); go(i + 1); }}
            style={{ ...arrow(1), opacity: i === n - 1 ? 0 : 1, pointerEvents: i === n - 1 ? "none" : "auto" }}>›</button>
          <div style={{ position:"absolute", left:"50%", top: dotsTop || 0, opacity: dotsTop == null ? 0 : 1,
            transform:"translateX(-50%)", zIndex:3, display:"flex", gap:6, transition: still ? "none" : `top .9s ${AK_SLIDE_EASE}, opacity .9s ease`,
            padding:"7px 10px", borderRadius:999, background:"rgba(5,5,6,.55)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)" }}>
            {srcs.map((_, k) => (
              <button key={k} aria-label={`Image ${k + 1} of ${n}`} onClick={(e) => { e.stopPropagation(); go(k); }} style={{
                pointerEvents:"auto", width: k === i ? 16 : 5, height:5, borderRadius:3, border:"none", padding:0, cursor:"pointer",
                background: k === i ? "var(--gold)" : "rgba(244,237,225,.35)",
                transition: still ? "none" : `width .9s ${AK_SLIDE_EASE}, background .9s ease`,
              }}/>
            ))}
          </div>
        </>
      )}
      {modes.length > 1 && (
        // Inside the art's top edge, so it never meets the lightbox's own top bar.
        <div className="mono" role="group" aria-label="How to show this artwork" style={{
          position:"absolute", left:"50%", top:12, transform:"translateX(-50%)", zIndex:3,
          display:"flex", gap:16, padding:"2px 14px",
          background:"rgba(5,5,6,.62)", border:"1px solid rgba(197,160,89,.3)", borderRadius:999,
          backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)",
        }}>
          {modes.map((m) => (
            <button key={m} aria-pressed={mode === m} onClick={(e) => { e.stopPropagation(); setMode(m); setI(0); }} style={{
              ...chip, color: mode === m ? "var(--gold)" : "rgba(244,237,225,.55)",
              borderBottom: `1px solid ${mode === m ? "var(--gold)" : "transparent"}`,
              transition: still ? "none" : "color .9s ease, border-color .9s ease",
            }}>{m === "strips" ? "Strips" : m === "swipe" ? "Swipe" : "Full"}</button>
          ))}
        </div>
      )}
    </div>
  );
}

let _akWallpapersLoaded = false;
let _akWallpapersData = null;
const _akWallpaperListeners = new Set();

let _akWallpapersPromise = null;
function loadLiveWallpapers(){
  if(_akWallpapersLoaded) return Promise.resolve(_akWallpapersData);
  return _akWallpapersPromise || (_akWallpapersPromise = _akFetchAllWallpapers());
}
// Pages through the whole catalog (the API returns one page + lastEvaluatedKey).
// The first page paints fast; every later page re-notifies with the full list.
async function _akFetchAllWallpapers(){
  // Phase 3: empty string is a valid base (same-origin via CloudFront /api/*).
  // Treat undefined/null as missing config; "" is a green light.
  const baseRaw = (typeof window !== "undefined") ? window.__AKARA_API_BASE : undefined;
  if (baseRaw === undefined || baseRaw === null){ _akWallpapersLoaded = true; return null; }
  const base = baseRaw;
  const all = [];
  let key = null;
  try{
    for(let page = 0; page < 30; page++){
      const res = await fetch(`${base}/api/catalog?type=wallpaper&limit=${page ? 500 : 100}` + (key ? `&lastEvaluatedKey=${key}` : ""), { credentials:"omit" });
      const json = await res.json();
      if(!(json && json.ok && Array.isArray(json.items))) break;
      // hiddenFromPublic: duplicates and withdrawn pieces (Darśana honours it too).
      all.push(...json.items.filter(i=>!i.archived && !i.hiddenFromPublic).map(mapApiWallpaper));
      _akWallpapersData = all.slice();
      window.WALLPAPER_ITEMS_LIVE = _akWallpapersData;
      _akWallpaperListeners.forEach(fn=>fn(_akWallpapersData));
      key = json.lastEvaluatedKey;
      if(!key) break;
    }
  } catch(e){ /* keep what loaded; fall back to static if nothing did */ }
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
    if(_akWallpapersData && _akWallpapersData.length) setItems(_akWallpapersData);
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
  useLiveWallpapers, loadLiveWallpapers, mapApiWallpaper, AKARA_SHOPIFY, shopifyStorefront, AKARA_JUDGEME });
