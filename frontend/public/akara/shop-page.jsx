// Shop Page — the face of the AKARA store. The Shopify Storefront is the till.
// Vertical aisle metaphor: each Aisle is a horizontal film-strip row of editorial
// product cards. Products, prices, availability and the cart all come from
// Shopify (see AKARA_SHOPIFY / shopifyStorefront in lib.jsx). Nothing here
// ever takes money: "Checkout" hands the buyer to Shopify's hosted checkout.
//
// Vocabulary (CONTEXT.md): Shop, Storefront, Product, Variant, Aisle,
// Coming Soon item, Dhyana state.

const { useState: spS, useEffect: spE, useRef: spR, useMemo: spM, useCallback: spC } = React;

// ───────────────────────── Aisles ─────────────────────────
// A Product lands in exactly one Aisle, decided by its Shopify product type.
const AISLES = [
  {
    id:"clothing", name:"Clothing", tag:"Devotional streetwear",
    desc:"Supima cotton, printed to order in India. Cut loose, worn daily.",
    media:"/akara/assets/shop-clothing.mp4", still:"/akara/assets/shop-clothing-sm.png",
    accent:"#d08a70",
    types:["t-shirt","tee","hoodie","sweatshirt","jacket","kurta","shirt","jogger","shorts","dress","apparel","clothing","top"],
    comingSoon:[
      { id:"cs-hanuman", name:"Hanuman · Drop 001", meta:"Black · 240 GSM oversized · 108 numbered", price:2499, tone:["#0a0a0a","#c5a059"] },
    ],
  },
  {
    id:"prints", name:"Fine Prints", tag:"Giclée on cotton",
    desc:"Limited editions. Numbered, signed, archival.",
    media:"/akara/assets/shop-prints.mp4", still:"/akara/assets/shop-prints-sm.png",
    accent:"#e4b37a",
    types:["print","poster","art","canvas"],
    comingSoon:[
      { id:"cs-prints", name:"First editions", meta:"Numbered · signed · archival", price:null, tone:["#8a6932","#1a0e06"] },
    ],
  },
  {
    id:"merch", name:"Merchandise", tag:"For the living altar",
    desc:"Brass, ceramic, wood — made for daily use.",
    media:"/akara/assets/shop-merch.mp4", still:"/akara/assets/shop-merch-sm.png",
    accent:"#8fb5d6",
    types:[],
    comingSoon:[
      { id:"cs-merch", name:"Objects for the altar", meta:"Brass · ceramic · wood", price:null, tone:["#c5a059","#8a6932"] },
    ],
  },
];

function aisleForType(productType){
  const t = String(productType || "").toLowerCase();
  if(AISLES[1].types.some(k=>t.includes(k))) return "prints";
  if(AISLES[0].types.some(k=>t.includes(k))) return "clothing";
  return "merch";
}

// ═══════════════════ PURE SHOP LOGIC (no React, no DOM) ═══════════════════
// Everything between @pure-start and @pure-end is plain JS. The Node test at
// akara/docs/tests/shop-logic.test.mjs extracts this block and runs it on a
// saved Storefront fixture. Keep it free of JSX and browser globals.
// @pure-start
const SIZE_ORDER = ["XXS","XS","S","M","L","XL","XXL","2XL","3XL","4XL","5XL"];
function sortSizes(list){
  return [...list].sort((a,b)=>{
    const ia = SIZE_ORDER.indexOf(String(a).toUpperCase()), ib = SIZE_ORDER.indexOf(String(b).toUpperCase());
    return (ia<0?99:ia) - (ib<0?99:ib);
  });
}

function fmtINR(n){ return "₹" + Math.round(Number(n)||0).toLocaleString("en-IN"); }

// Deity: the first Product tag that matches this list. Order = display order.
const DEITIES = [
  { id:"shiva",     label:"Shiva",     match:["shiva","shivoham","aghor","mahadev","rudra","nataraja"] },
  { id:"hanuman",   label:"Hanuman",   match:["hanuman","bajrang","maruti","anjaneya"] },
  { id:"krishna",   label:"Krishna",   match:["krishna","murali","govinda","gopal","radha krishna"] },
  { id:"ganesha",   label:"Ganesha",   match:["ganesha","ganesh","gajanana","vinayaka","ganapati"] },
  { id:"rama",      label:"Rama",      match:["rama","ram","sita ram","raghava"] },
  { id:"durga",     label:"Durga",     match:["durga","kali","shakti","devi","ambe"] },
  { id:"lakshmi",   label:"Lakshmi",   match:["lakshmi","laxmi"] },
  { id:"saraswati", label:"Saraswati", match:["saraswati"] },
  { id:"vishnu",    label:"Vishnu",    match:["vishnu","narayana","hari"] },
  { id:"surya",     label:"Surya",     match:["surya","aditya"] },
  { id:"sadhu",     label:"Sadhu",     match:["sadhu","yogi","aghori","naga"] },
];
function deityFor(tags){
  const low = (tags||[]).map(t=>String(t).toLowerCase().trim());
  for(const d of DEITIES){ if(low.some(t=>d.match.includes(t))) return d.id; }
  return null;
}
function deityLabel(id){ const d = DEITIES.find(x=>x.id===id); return d ? d.label : null; }

// Type: Shopify productType, shown short.
const TYPE_LABELS = { "t-shirt":"Tee", "tshirt":"Tee", "tee":"Tee", "mug":"Mug", "hoodie":"Hoodie", "sweatshirt":"Sweatshirt", "print":"Print", "poster":"Print", "cap":"Cap" };
function typeLabelFor(productType){
  const t = String(productType||"").trim();
  if(!t) return "Other";
  return TYPE_LABELS[t.toLowerCase()] || t;
}

// Swatches: a known map first; unknown names return null so the UI can try a
// CSS named colour and finally fall back to a neutral dot WITH the name shown.
const SWATCH = {
  white:"#f4f1ea", "off white":"#f1ece0", cream:"#efe6d2", beige:"#d9c7a5", sand:"#cdb894",
  black:"#141414", charcoal:"#2b2b2b", "navy blue":"#1b2a4a", navy:"#1b2a4a", indigo:"#2a2f6b",
  maroon:"#5a1a24", red:"#a6284a", lavender:"#c9b8dc", mint:"#b7dccb", olive:"#6b7042", mustard:"#c9a227",
  grey:"#8a8a8a", gray:"#8a8a8a", "grey melange":"#a3a39c", "gray melange":"#a3a39c", "dark grey":"#4a4a4a",
  brown:"#5b3a29", coffee:"#4b3226", "royal blue":"#2f4aa8", "sky blue":"#9cc3e0", pink:"#e2b4c0", peach:"#f0c6a8", yellow:"#e8d060",
};
function swatchFor(name){ return SWATCH[String(name||"").toLowerCase().trim()] || null; }

// Facets: every filter row is built from live Products only.
function buildFacets(products){
  const count = (key)=>{ const m = new Map(); products.forEach(p=>{ const ks = key(p); (Array.isArray(ks)?ks:[ks]).filter(Boolean).forEach(k=>m.set(k,(m.get(k)||0)+1)); }); return m; };
  const dm = count(p=>p.deity), tm = count(p=>p.typeLabel), cm = count(p=>p.colors);
  return {
    deities: DEITIES.filter(d=>dm.has(d.id)).map(d=>({ id:d.id, label:d.label, count:dm.get(d.id) })),
    types:   [...tm.entries()].sort((a,b)=>b[1]-a[1]).map(([id,c])=>({ id, label:id, count:c })),
    colors:  [...cm.entries()].sort((a,b)=>b[1]-a[1]).map(([id,c])=>({ id, label:id, count:c, hex:swatchFor(id) })),
  };
}

// Filters: AND across rows, OR within a row. Each value is an array of ids.
function applyFilters(products, f){
  const has = (arr)=>Array.isArray(arr) && arr.length>0;
  return products.filter(p=>{
    if(has(f.deity) && !f.deity.includes(p.deity)) return false;
    if(has(f.type)  && !f.type.includes(p.typeLabel)) return false;
    if(has(f.color) && !p.colors.some(c=>f.color.includes(c))) return false;
    if(f.aisle && p.aisle!==f.aisle) return false;
    return true;
  });
}
function anyFilterActive(f){ return ["deity","type","color"].some(k=>Array.isArray(f[k]) && f[k].length>0); }

const SORTS = [
  { id:"newest",     label:"Newest" },
  { id:"price-asc",  label:"Price ↑" },
  { id:"price-desc", label:"Price ↓" },
];
function sortProducts(products, sort){
  const arr = [...products];
  if(sort==="price-asc")  return arr.sort((a,b)=>a.price-b.price || cmpNewest(a,b));
  if(sort==="price-desc") return arr.sort((a,b)=>b.price-a.price || cmpNewest(a,b));
  return arr.sort(cmpNewest);
}
function cmpNewest(a,b){ return (Date.parse(b.createdAt)||0) - (Date.parse(a.createdAt)||0); }

const WEEK_MS = 7*24*60*60*1000;
function isNewThisWeek(createdAt, now){ const t = Date.parse(createdAt); return !!t && (now - t) >= 0 && (now - t) < WEEK_MS; }

// Upsell: up to n Products not in the cart that share a Deity with a cart line.
function upsellFor(products, cartLines, n=3){
  const inCart = new Set((cartLines||[]).map(l=>l.handle).filter(Boolean));
  const deities = new Set(products.filter(p=>inCart.has(p.handle)).map(p=>p.deity).filter(Boolean));
  const pool = sortProducts(products.filter(p=>!inCart.has(p.handle) && !p.comingSoon), "newest");
  const same = pool.filter(p=>deities.has(p.deity));
  return (same.length ? same : pool).slice(0, n);
}

// /shop/{handle} → handle, else null.
function handleFromPath(pathname){
  const m = /^\/shop\/([^\/?#]+)\/?$/.exec(String(pathname||""));
  return m ? decodeURIComponent(m[1]) : null;
}

// URL ⇄ filters. Only non-empty keys are written.
function filtersFromParams(sp){
  const list = (k)=>{ const v = sp.get(k); return v ? v.split(",").map(x=>x.trim()).filter(Boolean) : []; };
  const sort = sp.get("sort"); 
  return { deity:list("deity"), type:list("type"), color:list("color"), aisle: sp.get("aisle")||null, sort: SORTS.some(s=>s.id===sort) ? sort : "newest" };
}
function paramsFromFilters(f){
  const out = [];
  ["deity","type","color"].forEach(k=>{ if(Array.isArray(f[k]) && f[k].length) out.push(k+"="+encodeURIComponent(f[k].join(","))); });
  if(f.aisle) out.push("aisle="+encodeURIComponent(f.aisle));
  if(f.sort && f.sort!=="newest") out.push("sort="+f.sort);
  return out.length ? "?"+out.join("&") : "";
}

// Trust strip. Real Qikink numbers (see T Shirt Printing/tools/QIKINK_TRUST_FACTS.md).
// Never "returns", never "free returns", never COD (store is prepaid-only, decided 2026-09-08).
const TRUST = {
  items: [
    "Printed to order in India",
    "Delivered in 5–8 business days across India",
    "Secure prepaid checkout — UPI, cards, netbanking",
    "7-day replacement for damage or misprint",
  ],
  whatsapp: "919993518528",
};
function whatsappUrl(text){ return "https://wa.me/" + TRUST.whatsapp + (text ? "?text=" + encodeURIComponent(text) : ""); }
// ── Reviews (Judge.me) ──
// Store-wide gate: no stars, no review text anywhere until 5 approved reviews exist.
const REVIEW_GATE = 5;
function reviewsVisible(totalApproved){ const n = Number(totalApproved); return Number.isFinite(n) && n >= REVIEW_GATE; }
// Shopify "reviews.rating" metafield is JSON {"value":"4.5","scale_min":..}; rating_count is an integer string.
function parseRatingMetafield(rating, count){
  let r = null;
  try { const v = (typeof rating === "string" && rating.trim().startsWith("{")) ? JSON.parse(rating).value : rating; r = (v==null || v==="") ? null : Number(v); } catch(e){ r = null; }
  const c = (count==null || count==="") ? 0 : Number(count);
  return { rating: Number.isFinite(r) && r > 0 ? r : null, count: Number.isFinite(c) ? c : 0 };
}
// Judge.me widget HTML → plain data. Tolerant: a markup change yields empty results, never a throw.
function jmAttr(html, name){ const m = new RegExp(name + "=(['\"])([^'\"]*)\\1").exec(String(html||"")); return m ? m[2] : null; }
function jmDecode(s){ return String(s||"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">"); }
function jmText(s){ return jmDecode(String(s||"").replace(/<\s*br\s*\/?>/gi,"\n").replace(/<\/p>/gi,"\n").replace(/<[^>]+>/g,"")).replace(/[ \t]+\n/g,"\n").replace(/\n{2,}/g,"\n").trim(); }
function parseJudgeMeSummary(html){
  return { rating: Number(jmAttr(html,"data-average-rating"))||0, count: Number(jmAttr(html,"data-number-of-reviews"))||0 };
}
function parseJudgeMeReviews(html){
  const parts = String(html||"").split(/<\s*div class=['"]jdgm-rev(?: [^'"]*)?['"]\s+data-review-id=/).slice(1);
  const out = [];
  parts.forEach(raw=>{
    const c = "data-review-id=" + raw;
    const pick = (re)=>{ const m = re.exec(c); return m ? m[1] : ""; };
    const body = jmText(pick(/<\s*div class=['"]jdgm-rev__body['"]>([\s\S]*?)<\/div>/));
    const title = jmText(pick(/<\s*b class=['"]jdgm-rev__title['"]>([\s\S]*?)<\/b>/));
    if(!body && !title) return;
    out.push({
      id: jmAttr(c,"data-review-id"),
      verified: jmAttr(c,"data-verified-buyer") === "true",
      rating: Number(pick(/jdgm-rev__rating['"][^>]*data-score=['"]([\d.]+)['"]/)) || 0,
      author: jmText(pick(/<\s*span class=['"]jdgm-rev__author['"]>([\s\S]*?)<\/span>/)) || "A buyer",
      title, body,
      date: pick(/jdgm-rev__timestamp[^>]*data-content=['"]([^'"]*)['"]/) || null,
    });
  });
  return out;
}
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtReviewDate(s){ const t = Date.parse(String(s||"").replace(" UTC","Z").replace(" ","T")); if(!t) return ""; const d = new Date(t); return MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
// The Judge.me form lives on the Shopify product page (theme widget). No form in our JSX.
function writeReviewUrl(shopDomain, handle){ return "https://" + shopDomain + "/products/" + encodeURIComponent(handle) + "#judgeme_product_reviews"; }
// Judge.me wants the numeric Shopify product id, not the gid.
function productExternalId(gid){ const m = /\/(\d+)$/.exec(String(gid||"")); return m ? m[1] : null; }
// Review form → Judge.me create-review fields, or { error } for the first missing thing.
function reviewPayload(shopDomain, product, f){
  const name = String(f.name||"").trim(), email = String(f.email||"").trim(), title = String(f.title||"").trim(), body = String(f.body||"").trim();
  const rating = Number(f.rating);
  if(!(rating>=1 && rating<=5)) return { error:"Pick a star rating." };
  if(!name) return { error:"Your name, please." };
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error:"A real email, please. It stays private." };
  if(body.length < 10) return { error:"A few more words, please." };
  const id = productExternalId(product && product.id);
  if(!id) return { error:"This piece cannot take reviews yet." };
  return { fields:{ shop_domain:shopDomain, platform:"shopify", id, url:"https://www.akara.studio/shop/"+product.handle, name, email, rating:String(rating), title, body } };
}
// Founder's note: metafield text → paragraphs. Empty → [].
function founderNoteParas(text){ return String(text||"").split(/\n+/).map(x=>x.trim()).filter(Boolean); }
// @pure-end

// ───────────────────────── Storefront: products ─────────────────────────
const PRODUCTS_QUERY = `{
  products(first: 100, sortKey: CREATED_AT, reverse: true) {
    nodes {
      id handle title productType tags availableForSale descriptionHtml createdAt
      featuredImage { url altText }
      images(first: 20) { nodes { url altText } }
      options { name values }
      priceRange { minVariantPrice { amount } }
      compareAtPriceRange { minVariantPrice { amount } }
      founderNote: metafield(namespace: "akara", key: "founder_note") { value }
      reviewRating: metafield(namespace: "reviews", key: "rating") { value }
      reviewCount: metafield(namespace: "reviews", key: "rating_count") { value }
      variants(first: 100) {
        nodes {
          id title availableForSale
          price { amount } compareAtPrice { amount }
          image { url }
          selectedOptions { name value }
        }
      }
    }
  }
}`;

// Shopify's plain `description` glues paragraphs together. Keep the breaks.
function htmlToText(html){
  const t = String(html||"")
    .replace(/>\s+</g, "><")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return t.split(/\n+/).map(x=>x.trim().replace(/\s*\|\s*$/, "")).filter(Boolean).join("\n");
}

function mapProduct(n){
  // "Satyam Shivam Sundaram Tee — Shiva | Supima Cotton" → name + meta
  const [head, ...rest] = n.title.split(/\s+[—–-]\s+/);
  const meta = rest.join(" · ").split(/\s*\|\s*/).join(" · ");
  const optName = (want)=> (n.options||[]).find(o=>o.name.toLowerCase()===want);
  const colorOpt = optName("color") || optName("colour");
  const sizeOpt  = optName("size");
  const variants = (n.variants.nodes||[]).map(v=>{
    const so = Object.fromEntries((v.selectedOptions||[]).map(o=>[o.name.toLowerCase(), o.value]));
    return {
      id:v.id, title:v.title, available:!!v.availableForSale,
      price:Number(v.price.amount), compareAt: v.compareAtPrice ? Number(v.compareAtPrice.amount) : null,
      image: v.image ? v.image.url : null,
      color: so.color || so.colour || null, size: so.size || null,
    };
  });
  const images = (n.images.nodes||[]).map(i=>i.url);
  const imageForColor = {};
  variants.forEach(v=>{ if(v.color && v.image && !imageForColor[v.color]) imageForColor[v.color] = v.image; });
  const price = Number(n.priceRange.minVariantPrice.amount);
  const cmp = Number((n.compareAtPriceRange && n.compareAtPriceRange.minVariantPrice.amount) || 0);
  return {
    id:n.id, handle:n.handle, title:n.title, name:head.trim(), meta: meta || n.productType,
    description: htmlToText(n.descriptionHtml),
    productType:n.productType, tags:n.tags||[], available:!!n.availableForSale,
    aisle: aisleForType(n.productType),
    createdAt: n.createdAt || null,
    deity: deityFor(n.tags), typeLabel: typeLabelFor(n.productType),
    price, compareAt: cmp > price ? cmp : null,
    image: n.featuredImage ? n.featuredImage.url : (images[0]||null),
    images, imageForColor,
    colors: colorOpt ? colorOpt.values : [],
    sizes: sizeOpt ? sortSizes(sizeOpt.values) : [],
    variants,
    founderNote: (n.founderNote && n.founderNote.value) ? String(n.founderNote.value).trim() : "",
    ...parseRatingMetafield(n.reviewRating && n.reviewRating.value, n.reviewCount && n.reviewCount.value),
    comingSoon:false,
  };
}

// ───────────────────────── Judge.me: reviews ─────────────────────────
// Gate lives in context so cards and the product page read one answer.
const ReviewsCtx = React.createContext({ total:null, visible:false });
function judgeMe(path, params){
  const q = new URLSearchParams({ shop_domain: AKARA_SHOPIFY.domain, api_token: AKARA_JUDGEME.token, ...(params||{}) });
  return fetch(`${AKARA_JUDGEME.base}/${path}?${q}`).then(r=>{ if(!r.ok) throw new Error("judgeme http " + r.status); return r.json(); });
}
function useReviewGate(){
  const [total, setTotal] = spS(null);
  spE(()=>{
    let on = true;
    if(typeof AKARA_JUDGEME === "undefined" || !AKARA_JUDGEME.token) return;
    judgeMe("widgets/all_reviews_count").then(j=>{ if(on) setTotal(Number(j && j.all_reviews_count) || 0); }).catch(()=>{ if(on) setTotal(null); });
    return ()=>{ on = false; };
  },[]);
  return { total, visible: reviewsVisible(total) };
}
function submitJudgeMeReview(fields){
  const body = new URLSearchParams({ ...fields, api_token: AKARA_JUDGEME.token });
  return fetch(`${AKARA_JUDGEME.base}/reviews`, { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body })
    .then(async r=>{ let j = null; try { j = await r.json(); } catch(e){} if(!r.ok) throw new Error((j && j.message) || ("judgeme http " + r.status)); return j; });
}
function useProductReviews(handle, enabled){
  const [state, setState] = spS({ status:"idle", summary:null, reviews:[] });
  spE(()=>{
    if(!enabled || !handle) return;
    let on = true;
    setState(s=>({ ...s, status:"loading" }));
    judgeMe("widgets/product_review", { handle })
      .then(j=>{ if(!on) return; const w = (j && j.widget) || ""; setState({ status:"ok", summary:parseJudgeMeSummary(w), reviews:parseJudgeMeReviews(w) }); })
      .catch(()=>{ if(on) setState({ status:"error", summary:null, reviews:[] }); });
    return ()=>{ on = false; };
  },[handle, enabled]);
  return state;
}

function useStorefrontProducts(){
  const [state, setState] = spS({ status:"loading", products:[], error:null });
  const load = spC(()=>{
    setState(s=>({ ...s, status:"loading", error:null }));
    const timeout = new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")), 12000));
    Promise.race([shopifyStorefront(PRODUCTS_QUERY), timeout])
      .then(d=>setState({ status:"ok", products:(d.products.nodes||[]).map(mapProduct), error:null }))
      .catch(e=>setState({ status:"dhyana", products:[], error:String(e && e.message || e) }));
  },[]);
  spE(()=>{ load(); },[load]);
  return { ...state, reload:load };
}

// ───────────────────────── Storefront: cart ─────────────────────────
const CART_KEY = "akara_shopify_cart_id";
const CART_FIELDS = `
  id checkoutUrl totalQuantity
  cost { subtotalAmount { amount } }
  lines(first: 50) { nodes {
    id quantity
    merchandise { ... on ProductVariant {
      id title price { amount } image { url }
      product { title handle }
      selectedOptions { name value }
    } }
  } }`;

function mapCart(c){
  if(!c) return null;
  return {
    id:c.id, checkoutUrl:c.checkoutUrl, count:c.totalQuantity||0,
    subtotal:Number((c.cost && c.cost.subtotalAmount.amount) || 0),
    lines:(c.lines.nodes||[]).map(l=>{
      const m = l.merchandise || {};
      const so = Object.fromEntries((m.selectedOptions||[]).map(o=>[o.name.toLowerCase(), o.value]));
      const [head] = String(m.product && m.product.title || "").split(/\s+[—–-]\s+/);
      return {
        id:l.id, qty:l.quantity, variantId:m.id, name:head.trim(), handle:(m.product && m.product.handle) || null,
        color: so.color || so.colour || null, size: so.size || null,
        price:Number(m.price && m.price.amount || 0), image: m.image ? m.image.url : null,
      };
    }),
  };
}

function useStorefrontCart(){
  const [cart, setCart] = spS(null);
  const [busy, setBusy] = spS(false);
  const [error, setError] = spS(null);

  const remember = (c)=>{ try{ if(c && c.id) localStorage.setItem(CART_KEY, c.id); else localStorage.removeItem(CART_KEY); }catch(e){} };

  // Restore a cart from a previous visit.
  spE(()=>{
    let id = null; try{ id = localStorage.getItem(CART_KEY); }catch(e){}
    if(!id) return;
    shopifyStorefront(`query($id: ID!){ cart(id:$id){ ${CART_FIELDS} } }`, { id })
      .then(d=>{ if(d.cart){ setCart(mapCart(d.cart)); } else { remember(null); } })
      .catch(()=>{});
  },[]);

  const run = async (fn)=>{
    setBusy(true); setError(null);
    try{ const c = await fn(); setCart(c); remember(c); return c; }
    catch(e){ setError(String(e && e.message || e)); throw e; }
    finally{ setBusy(false); }
  };

  const add = (variantId, qty=1)=> run(async ()=>{
    if(cart && cart.id){
      const d = await shopifyStorefront(`mutation($id: ID!, $lines: [CartLineInput!]!){
        cartLinesAdd(cartId:$id, lines:$lines){ cart{ ${CART_FIELDS} } userErrors{ message } } }`,
        { id:cart.id, lines:[{ merchandiseId:variantId, quantity:qty }] });
      const r = d.cartLinesAdd;
      if(r.userErrors && r.userErrors.length) throw new Error(r.userErrors[0].message);
      if(r.cart) return mapCart(r.cart);
    }
    const d = await shopifyStorefront(`mutation($lines: [CartLineInput!]!){
      cartCreate(input:{ lines:$lines }){ cart{ ${CART_FIELDS} } userErrors{ message } } }`,
      { lines:[{ merchandiseId:variantId, quantity:qty }] });
    const r = d.cartCreate;
    if(r.userErrors && r.userErrors.length) throw new Error(r.userErrors[0].message);
    return mapCart(r.cart);
  });

  const update = (lineId, qty)=> run(async ()=>{
    const d = await shopifyStorefront(`mutation($id: ID!, $lines: [CartLineUpdateInput!]!){
      cartLinesUpdate(cartId:$id, lines:$lines){ cart{ ${CART_FIELDS} } userErrors{ message } } }`,
      { id:cart.id, lines:[{ id:lineId, quantity:qty }] });
    const r = d.cartLinesUpdate;
    if(r.userErrors && r.userErrors.length) throw new Error(r.userErrors[0].message);
    return mapCart(r.cart);
  });

  const remove = (lineId)=> run(async ()=>{
    const d = await shopifyStorefront(`mutation($id: ID!, $ids: [ID!]!){
      cartLinesRemove(cartId:$id, lineIds:$ids){ cart{ ${CART_FIELDS} } userErrors{ message } } }`,
      { id:cart.id, ids:[lineId] });
    const r = d.cartLinesRemove;
    if(r.userErrors && r.userErrors.length) throw new Error(r.userErrors[0].message);
    return mapCart(r.cart);
  });

  return { cart, busy, error, add, update, remove };
}

// ───────────────────────── ShopPage root ─────────────────────────
function ShopPage(props){
  const gate = useReviewGate();
  return <ReviewsCtx.Provider value={gate}><ShopPageInner {...props}/></ReviewsCtx.Provider>;
}
function ShopPageInner({ onClose, initialAisle }){
  // Filters live in the URL (/shop?deity=shiva&type=Tee&color=Black&sort=price-asc).
  const [filters, setFilters] = spS(()=>{
    let sp; try{ sp = new URLSearchParams(window.location.search); }catch(e){ sp = new URLSearchParams(); }
    const f = filtersFromParams(sp);
    if(initialAisle && AISLES.some(a=>a.id===initialAisle)) f.aisle = initialAisle;
    else if(f.aisle && !AISLES.some(a=>a.id===f.aisle)) f.aisle = null;
    return f;
  });
  const toggle = (key, id)=> setFilters(f=>{
    const cur = f[key]||[]; const next = cur.includes(id) ? cur.filter(x=>x!==id) : [...cur, id];
    return { ...f, [key]: next };
  });
  const setSort = (sort)=> setFilters(f=>({ ...f, sort }));
  const clearFilters = ()=> setFilters(f=>({ ...f, deity:[], type:[], color:[], aisle:null }));
  spE(()=>{
    filtersRef.current = filters;
    if(!/^\/shop\/?$/.test(window.location.pathname)) return;
    const q = paramsFromFilters(filters);
    if(window.location.search !== q) history.replaceState(history.state, "", "/shop" + q);
  },[filters]);
  const now = spM(()=>Date.now(), []);
  const [cartOpen, setCartOpen] = spS(false);
  const [handle, setHandle] = spS(()=>{ try{ return handleFromPath(window.location.pathname); }catch(e){ return null; } });
  const rootRef = spR(null);
  const store = useStorefrontProducts();

  // Product page routing: /shop/{handle}. Back button returns to the aisles.
  const openProduct = spC((p)=>{
    setHandle(p.handle);
    history.pushState({ akShop:true, handle:p.handle }, "", "/shop/" + encodeURIComponent(p.handle));
  },[]);
  const closeProduct = spC(()=>{
    setHandle(null);
    history.pushState({ akShop:true }, "", "/shop" + paramsFromFilters(filtersRef.current));
  },[]);
  const filtersRef = spR(null);
  spE(()=>{
    const onPop = ()=>{
      const h = handleFromPath(window.location.pathname);
      setHandle(h);
      if(!h){ try{ setFilters(f=>({ ...filtersFromParams(new URLSearchParams(window.location.search)), aisle:f.aisle })); }catch(e){} }
    };
    window.addEventListener("popstate", onPop);
    return ()=>window.removeEventListener("popstate", onPop);
  },[]);
  spE(()=>{ window.scrollTo(0, 0); },[handle]);
  const { cart, busy, error:cartError, add, update, remove } = useStorefrontCart();

  // The shop is a real page that scrolls the document (no fixed overlay, no
  // 100vh maths on phones). Paint the page canvas cream so rubber-band
  // overscroll never reveals the near-black home canvas underneath.
  spE(()=>{
    const h=document.documentElement, b=document.body;
    const prev={ hb:h.style.background, bb:b.style.background, ob:h.style.overscrollBehaviorY };
    h.style.background="#f5efe4"; b.style.background="#f5efe4"; h.style.overscrollBehaviorY="none";
    window.scrollTo(0, 0);
    return ()=>{ h.style.background=prev.hb; b.style.background=prev.bb; h.style.overscrollBehaviorY=prev.ob; };
  },[]);

  // Escape closes
  spE(()=>{
    const onKey=(e)=>{
      if(e.key==="Escape"){
        if(cartOpen) setCartOpen(false);
        else if(handle) closeProduct();
        else onClose && onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return ()=>window.removeEventListener("keydown", onKey);
  },[onClose, handle, cartOpen, closeProduct]);

  const facets = spM(()=>buildFacets(store.products), [store.products]);
  const active = anyFilterActive(filters);
  const visible = spM(()=>sortProducts(applyFilters(store.products, filters), filters.sort), [store.products, filters]);
  const aisles = spM(()=>{
    return AISLES.map(a=>{
      const real = visible.filter(p=>p.aisle===a.id);
      // Coming Soon items show only when no chip is pressed (and in the chosen aisle, if any).
      const showSoon = !active && (!filters.aisle || filters.aisle===a.id);
      const soon = showSoon ? a.comingSoon.map(c=>({ ...c, aisle:a.id, comingSoon:true })) : [];
      return { ...a, real, products:[...real, ...soon] };
    }).filter(a=>a.products.length>0);
  },[visible, active, filters.aisle]);
  const upsell = spM(()=>upsellFor(store.products, cart ? cart.lines : [], 3), [store.products, cart]);

  const addVariant = async (variantId)=>{
    try{
      const prod = store.products.find(p=>(p.variants||[]).some(v=>v.id===variantId));
      const vr = prod && prod.variants.find(v=>v.id===variantId);
      if(prod && window.akTrack) window.akTrack("add_to_cart", { currency:"INR", value:(vr && vr.price) || prod.price,
        items:[{ item_id:prod.handle, item_name:prod.title, item_variant:vr && vr.title, price:(vr && vr.price) || prod.price, quantity:1 }] });
    }catch(e){}
    try{ await add(variantId, 1); setCartOpen(true); }catch(e){ setCartOpen(true); }
  };
  const cartCount = cart ? cart.count : 0;

  const current = handle ? store.products.find(p=>p.handle===handle) : null;
  spE(()=>{
    if(current && window.akTrack) window.akTrack("view_item", { currency:"INR", value:current.price,
      items:[{ item_id:current.handle, item_name:current.title, price:current.price }] });
  },[current && current.handle]);

  return (
    <div ref={rootRef} className="shop-root" style={{
      position:"relative", zIndex:1,
      width:"100%", minHeight:"100vh",
      overflowX:"clip",
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
        <button onClick={handle ? closeProduct : onClose} style={{
          display:"inline-flex", alignItems:"center", gap:12,
          fontFamily:"var(--mono)", fontSize:10, letterSpacing:".3em", textTransform:"uppercase", fontWeight:600,
          color:"#3d2d13", background:"transparent", border:"none",
          cursor:"pointer", padding:0, transition:"color .25s",
        }}
        onMouseEnter={(e)=>{ e.currentTarget.style.color="#8a3e18"; }}
        onMouseLeave={(e)=>{ e.currentTarget.style.color="#3d2d13"; }}>
          <span style={{ fontSize:14, fontWeight:300 }}>←</span>
          <span className="shop-back-label">{handle ? "Back to the shop" : "Back to Akara"}</span>
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

      {handle ? (
        <ProductPage p={current} status={store.status} products={store.products} now={now} busy={busy}
          onAdd={addVariant} onOpen={openProduct} onBack={closeProduct} onRetry={store.reload}/>
      ) : (<React.Fragment>
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

      {/* FILTER RAILS — Deity, then Type, then Colour. Built from live Products only. */}
      <div className="shop-collections" style={{
        position:"sticky", top:68, zIndex:20,
        padding:"14px 40px 12px",
        background:"linear-gradient(180deg, rgba(245,239,228,.95) 0%, rgba(245,239,228,.86) 100%)",
        backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)",
        borderBottom:"1px solid rgba(138,105,50,.14)",
      }}>
        <FilterRow label="Deity" items={facets.deities} selected={filters.deity} onToggle={(id)=>toggle("deity", id)} allLabel="All deities"/>
        <div className="shop-filter-lower" style={{ display:"flex", gap:28, alignItems:"center", flexWrap:"wrap" }}>
          {facets.types.length > 1 && (
            <FilterRow label="Type" items={facets.types} selected={filters.type} onToggle={(id)=>toggle("type", id)} compact/>
          )}
          {facets.colors.length > 1 && (
            <FilterRow label="Colour" items={facets.colors} selected={filters.color} onToggle={(id)=>toggle("color", id)} compact swatch/>
          )}
          <div className="shop-sort-row" style={{ marginLeft:"auto", display:"inline-flex", alignItems:"center", gap:8, overflowX:"auto", scrollbarWidth:"none", maxWidth:"100%" }}>
            <span className="mono" style={{ fontSize:9, letterSpacing:".3em", color:"rgba(26,16,8,.5)", textTransform:"uppercase", flex:"0 0 auto" }}>Sort</span>
            {SORTS.map(o=>{
              const on = filters.sort===o.id;
              return (
                <button key={o.id} onClick={()=>setSort(o.id)} className="shop-chip" style={{
                  padding:"6px 12px", borderRadius:999,
                  background: on ? "#1a1008" : "transparent", color: on ? "#f5efe4" : "#3d2d13",
                  border:`1px solid ${on ? "#1a1008" : "rgba(138,105,50,.25)"}`,
                  fontFamily:"var(--mono)", fontSize:9, letterSpacing:".22em", textTransform:"uppercase", fontWeight: on?700:500,
                  whiteSpace:"nowrap", cursor:"pointer", transition:"all .3s",
                }}>{o.label}</button>
              );
            })}
            {(active || filters.aisle) && (
              <button onClick={clearFilters} className="mono" style={{
                marginLeft:6, background:"transparent", border:"none", color:"#8a3e18",
                fontSize:9, letterSpacing:".25em", textTransform:"uppercase", cursor:"pointer",
              }}>Clear ×</button>
            )}
          </div>
        </div>
      </div>

      {/* AISLES */}
      <main className="shop-main" style={{ maxWidth:1500, margin:"0 auto", padding:"48px 40px 120px", position:"relative" }}>
        {store.status==="dhyana" ? (
          <DhyanaState onRetry={store.reload}/>
        ) : store.status==="loading" ? (
          <div style={{ padding:"100px 40px", textAlign:"center", color:"rgba(26,16,8,.5)" }}>
            <div className="display" style={{ fontSize:32, fontStyle:"italic", marginBottom:10 }}>Opening the shutters…</div>
            <div className="mono" style={{ fontSize:10, letterSpacing:".3em", textTransform:"uppercase" }}>Fetching today's pieces</div>
          </div>
        ) : aisles.length === 0 ? (
          <div style={{
            padding:"120px 40px", textAlign:"center",
            border:"1.5px dashed rgba(138,105,50,.25)", borderRadius:12,
            color:"rgba(26,16,8,.5)",
          }}>
            <div className="display" style={{ fontSize:36, fontStyle:"italic", marginBottom:10 }}>Nothing here yet.</div>
            <div className="mono" style={{ fontSize:11, letterSpacing:".3em", textTransform:"uppercase", marginBottom:22 }}>No piece matches those chips</div>
            <button onClick={clearFilters} style={{
              padding:"12px 22px", borderRadius:999, background:"transparent", color:"#1a1008", border:"1px solid rgba(26,16,8,.3)",
              fontFamily:"var(--mono)", fontSize:10, letterSpacing:".3em", textTransform:"uppercase", fontWeight:600, cursor:"pointer",
            }}>Show everything</button>
          </div>
        ) : aisles.map((a, i)=>(
          <Aisle key={a.id} cat={a} idx={i} now={now} onPeek={openProduct}/>
        ))}

        {store.status==="ok" && (
          <footer style={{ marginTop:72, paddingTop:28, borderTop:"1px solid rgba(138,105,50,.18)" }}>
            <TrustStrip align="center"/>
          </footer>
        )}
      </main>
      </React.Fragment>)}

      {/* cart drawer */}
      <CartDrawer open={cartOpen} cart={cart} busy={busy} error={cartError} onUpdate={update} onRemove={remove} onClose={()=>setCartOpen(false)}
        upsell={upsell} onPeek={(p)=>{ setCartOpen(false); openProduct(p); }}/>

      {/* Mobile responsive overrides */}
      <style>{`
        @media (max-width: 780px) {
          .shop-nav { padding: 14px 18px !important; gap: 10px !important; }
          .shop-nav .shop-brand-sub { display: none !important; }
          .shop-nav .shop-back-label { display: none !important; }
          .shop-header { padding: 40px 20px 18px !important; }
          .shop-header h1 { font-size: clamp(44px, 11vw, 68px) !important; }
          .shop-header p { font-size: 15px !important; }
          .shop-collections { position: static !important; padding: 10px 14px 8px !important; }
          .shop-filter-lower { gap: 6px !important; }
          .shop-sort-row { margin-left: 0 !important; }
          .shop-filter-row { padding-right: 14px; }
          .pp-thumbs { grid-auto-columns: 56px !important; }
          .shop-main { padding: 32px 16px 100px !important; }
          .aisle-header { height: 200px !important; border-radius: 8px !important; }
          .aisle-copy { left: 16px !important; right: 16px !important; bottom: 16px !important; grid-template-columns: 1fr !important; }
          .aisle-copy p { font-size: 13px !important; }
          .aisle-arrows { display: none !important; }
          .aisle-title { font-size: clamp(36px, 9vw, 56px) !important; }
          .product-card { flex: 0 0 72vw !important; max-width: 300px; }
          .aisle-spread { grid-template-columns: 1fr !important; gap: 14px !important; }
          .spread-card .card-art { aspect-ratio: 4/5 !important; }
          .soon-banner { grid-template-columns: 1fr !important; padding: 24px 22px !important; min-height: 180px !important; }
          .shop-drawer { width: 100% !important; }
          .shop-cta-cart .cart-label { display: none; }
        }
        @media (max-width: 460px) {
          .product-card { flex: 0 0 82vw !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .product-card, .pp, .shop-drawer, .shop-chip, .new-ribbon, .filter-row-in { transition: none !important; animation: none !important; }
          .ak-gallery { scroll-behavior: auto !important; }
        }
      `}</style>
    </div>
  );
}

// ───────────────────────── FilterRow (one row of chips) ─────────────────────────
function FilterRow({ label, items, selected, onToggle, compact=false, swatch=false, allLabel }){
  if(!items || items.length===0) return null;
  return (
    <div className="shop-filter-row filter-row-in" style={{
      display:"flex", alignItems:"center", gap: compact ? 6 : 8,
      overflowX:"auto", whiteSpace:"nowrap", scrollbarWidth:"none",
      padding: compact ? "4px 0" : "2px 0 10px",
      animation:"filterIn 1.1s var(--ease-out) both",
    }}>
      <span className="mono" style={{ fontSize:9, letterSpacing:".3em", color:"#8a3e18", textTransform:"uppercase", marginRight: compact ? 6 : 10, flex:"0 0 auto" }}>{label}</span>
      {allLabel && (
        <button onClick={()=>selected.forEach(id=>onToggle(id))} className="shop-chip" style={chipStyle(selected.length===0, compact)}>{allLabel}</button>
      )}
      {items.map((it, i)=>{
        const on = selected.includes(it.id);
        const hex = swatch ? (it.hex || cssColorOrNull(it.id)) : null;
        return (
          <button key={it.id} onClick={()=>onToggle(it.id)} className="shop-chip" title={`${it.label} · ${it.count}`}
            style={{ ...chipStyle(on, compact), animationDelay:`${.05*i}s`, display:"inline-flex", alignItems:"center", gap:7 }}>
            {swatch && (
              <span aria-hidden style={{
                width:12, height:12, borderRadius:"50%", flex:"0 0 auto",
                background: hex || "transparent",
                border: hex ? "1px solid rgba(0,0,0,.18)" : "1px dashed rgba(26,16,8,.45)",
              }}/>
            )}
            <span>{it.label}</span>
            {!compact && <span style={{ opacity:.5, marginLeft:4 }}>{it.count}</span>}
          </button>
        );
      })}
      <style>{`@keyframes filterIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}
function chipStyle(on, compact){
  return {
    flex:"0 0 auto",
    padding: compact ? "6px 12px" : "8px 16px", borderRadius:999,
    background: on ? "#1a1008" : "rgba(255,255,255,.6)",
    color: on ? "#f5efe4" : "#1a1008",
    border:`1px solid ${on ? "#1a1008" : "rgba(138,105,50,.25)"}`,
    fontFamily:"var(--mono)", fontSize: compact ? 9 : 10, letterSpacing:".24em", textTransform:"uppercase",
    fontWeight: on ? 700 : 500,
    cursor:"pointer", transition:"all .35s var(--ease-out)",
  };
}
// Browser-only: does the first word of a colour name parse as a CSS colour?
function cssColorOrNull(name){
  try{
    const w = String(name||"").trim().split(/\s+/)[0].toLowerCase();
    if(!w || typeof CSS === "undefined" || !CSS.supports) return null;
    return CSS.supports("color", w) ? w : null;
  }catch(e){ return null; }
}

// ───────────────────────── TrustStrip (one constant, three places) ─────────────────────────
function TrustStrip({ align="left", product=null, compact=false }){
  const msg = product ? `Hi AKARA, I have a question about "${product}".` : "Hi AKARA, I have a question about the shop.";
  return (
    <div className="mono trust-strip" style={{
      fontSize: compact ? 8.5 : 9.5, letterSpacing:".2em", textTransform:"uppercase", lineHeight:2,
      color:"rgba(26,16,8,.55)", textAlign:align,
    }}>
      {TRUST.items.map((t,i)=>(
        <React.Fragment key={t}>
          {i>0 && <span style={{ color:"#c5a059", margin:"0 8px" }}>·</span>}
          <span style={{ whiteSpace:"nowrap" }}>{t}</span>
        </React.Fragment>
      ))}
      <span style={{ color:"#c5a059", margin:"0 8px" }}>·</span>
      <a href={whatsappUrl(msg)} target="_blank" rel="noopener noreferrer" style={{ color:"#8a3e18", textDecoration:"none", borderBottom:"1px solid rgba(138,62,24,.35)", whiteSpace:"nowrap" }}>WhatsApp us</a>
    </div>
  );
}

// ───────────────────────── Dhyana state ─────────────────────────
// The Storefront could not be reached. Never show a fake item here.
function DhyanaState({ onRetry }){
  return (
    <div style={{
      padding:"120px 40px", textAlign:"center",
      border:"1.5px dashed rgba(138,105,50,.25)", borderRadius:12,
      color:"rgba(26,16,8,.6)",
    }}>
      <div className="mono" style={{ fontSize:10, letterSpacing:".35em", textTransform:"uppercase", color:"#8a3e18", marginBottom:18 }}>ध्यान</div>
      <div className="display" style={{ fontSize:"clamp(32px,4vw,48px)", fontStyle:"italic", marginBottom:10, color:"#1a1008" }}>The shop is in dhyāna.</div>
      <div className="mono" style={{ fontSize:11, letterSpacing:".3em", textTransform:"uppercase", marginBottom:28 }}>It returns soon.</div>
      <button onClick={onRetry} style={{
        padding:"12px 22px", borderRadius:999,
        background:"transparent", color:"#1a1008", border:"1px solid rgba(26,16,8,.3)",
        fontFamily:"var(--mono)", fontSize:10, letterSpacing:".3em", textTransform:"uppercase", fontWeight:600, cursor:"pointer",
      }}>Knock again</button>
    </div>
  );
}

// ───────────────────────── Aisle ─────────────────────────
function Aisle({ cat, idx, now, onPeek }){
  const scroller = spR(null);
  const videoRef = spR(null);
  const chipRef = spR(null);
  const [hover, setHover] = spS(false);
  const [isTouch, setIsTouch] = spS(false);
  const [inView, setInView] = spS(false);
  const [videoPlaying, setVideoPlaying] = spS(false);
  const [videoError, setVideoError] = spS(false);

  spE(()=>{
    if(typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    setIsTouch(mq.matches);
    const onChange = (e)=> setIsTouch(e.matches);
    if(mq.addEventListener) mq.addEventListener("change", onChange);
    return ()=> { if(mq.removeEventListener) mq.removeEventListener("change", onChange); };
  },[]);

  spE(()=>{
    if(!isTouch || !chipRef.current || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver((entries)=>{
      entries.forEach(e=> setInView(e.isIntersecting && e.intersectionRatio > 0.3));
    }, { threshold:[0, 0.3, 0.6] });
    obs.observe(chipRef.current);
    return ()=> obs.disconnect();
  },[isTouch]);

  const shouldPlay = isTouch ? inView : hover;
  spE(()=>{
    const v = videoRef.current; if(!v) return;
    if(shouldPlay){
      v.muted = true; v.playsInline = true;
      const p = v.play(); if(p && p.catch) p.catch(()=>{});
    } else { v.pause(); }
  },[shouldPlay]);

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

  const videoVisible = isTouch ? true : hover;
  const posterOpacity = (videoPlaying && !videoError) ? 0 : 1;
  const videoOpacity  = videoError ? 0 : (videoVisible ? 1 : 0);

  const scrollBy = (dx)=>{
    if(!scroller.current) return;
    scroller.current.scrollBy({ left:dx, behavior:"smooth" });
  };
  const n = cat.products.length;
  const layout = n >= 4 ? "strip" : (n === 1 && cat.products[0].comingSoon) ? "banner" : "spread";
  const realCount = cat.real.length;
  const countLabel = realCount === 0 ? "Coming soon" : realCount === 1 ? "1 piece" : `${realCount} pieces`;

  return (
    <section style={{ marginBottom: 88, position:"relative" }}>
      {/* aisle opener: full-width film band, video edge to edge behind the name */}
      <div
        ref={chipRef}
        className="aisle-header"
        onMouseEnter={()=>setHover(true)}
        onMouseLeave={()=>setHover(false)}
        style={{
          position:"relative", overflow:"hidden", borderRadius:10,
          height:"clamp(220px, 26vw, 340px)", marginBottom:24,
          background:"#1a1008", boxShadow:"0 18px 50px rgba(61,45,19,.28)",
        }}>
        <ProtectedImage src={cat.still} alt="" fit="cover" style={{ opacity: posterOpacity, transition:"opacity .6s", zIndex:1 }}/>
        <video ref={videoRef} src={cat.media} muted loop playsInline autoPlay={isTouch} preload="metadata"
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity: videoOpacity, transition:"opacity .9s var(--ease-out)", zIndex:2,
            transform: hover ? "scale(1.03)" : "scale(1)", transitionProperty:"opacity, transform", transitionDuration:".9s, 6s" }}/>
        <div style={{ position:"absolute", inset:0, zIndex:3,
          background:"linear-gradient(180deg, rgba(10,6,2,.25) 0%, rgba(10,6,2,.05) 35%, rgba(10,6,2,.72) 100%), linear-gradient(90deg, rgba(10,6,2,.45) 0%, transparent 55%)" }}/>

        <div style={{
          position:"absolute", top:16, left:18, zIndex:4,
          padding:"5px 10px", borderRadius:4,
          background:"rgba(245,239,228,.92)", color:"#1a1008",
          fontFamily:"var(--mono)", fontSize:9, letterSpacing:".28em", textTransform:"uppercase", fontWeight:700,
        }}>Aisle {String(idx+1).padStart(2,"0")}</div>
        <div className="mono" style={{
          position:"absolute", top:20, right:20, zIndex:4, color:"rgba(245,239,228,.85)",
          fontFamily:"var(--mono)", fontSize:9, letterSpacing:".3em", textTransform:"uppercase",
        }}>{countLabel}</div>

        <div className="aisle-copy" style={{ position:"absolute", left:28, right:28, bottom:24, zIndex:4, display:"grid", gridTemplateColumns:"1fr auto", alignItems:"end", gap:24 }}>
          <div>
            <div className="mono" style={{
              fontSize:10, letterSpacing:".3em", color:"#e4b37a", textTransform:"uppercase", marginBottom:8,
            }}>{cat.tag}</div>
            <h2 className="display aisle-title" style={{
              fontSize:"clamp(40px,5vw,72px)", lineHeight:.95, margin:"0 0 10px", fontWeight:400, color:"#f5efe4",
              textShadow:"0 6px 30px rgba(0,0,0,.45)",
            }}>
              <em style={{ fontStyle:"italic" }}>{cat.name}</em>
            </h2>
            <p style={{ fontSize:16, color:"rgba(245,239,228,.78)", fontWeight:300, margin:0, maxWidth:520 }}>
              {cat.desc}
            </p>
          </div>
          <div className="aisle-arrows" style={{ display: layout==="strip" ? "flex" : "none", gap:8 }}>
            {[-1,1].map(d=>(
              <button key={d} onClick={()=>scrollBy(d*420)} aria-label={d<0?"Scroll left":"Scroll right"} style={{
                width:44, height:44, borderRadius:"50%",
                background:"rgba(245,239,228,.18)", border:"1px solid rgba(245,239,228,.35)",
                color:"#f5efe4", cursor:"pointer", display:"grid", placeItems:"center",
                fontSize:16, transition:"all .25s", backdropFilter:"blur(6px)",
              }}
              onMouseEnter={(e)=>{ e.currentTarget.style.background="#f5efe4"; e.currentTarget.style.color="#1a1008"; }}
              onMouseLeave={(e)=>{ e.currentTarget.style.background="rgba(245,239,228,.18)"; e.currentTarget.style.color="#f5efe4"; }}>
                {d<0?"←":"→"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {layout === "strip" ? (
        <div ref={scroller} style={{
          display:"flex", gap:16, overflowX:"auto", overflowY:"hidden",
          paddingBottom:12,
          scrollSnapType:"x mandatory",
          WebkitOverflowScrolling:"touch",
          scrollbarWidth:"thin",
        }}>
          {cat.products.map((p,i)=>(
            p.comingSoon
              ? <ComingSoonCard key={p.id} p={p} cat={cat} idx={i} layout="strip"/>
              : <ProductCard key={p.id} p={p} cat={cat} idx={i} layout="strip" now={now} onPeek={()=>onPeek(p)}/>
          ))}
        </div>
      ) : layout === "banner" ? (
        <ComingSoonCard p={cat.products[0]} cat={cat} idx={0} layout="banner"/>
      ) : (
        /* spread: a broadsheet page — one wide card, the rest narrower, edge to edge */
        <div className="aisle-spread" style={{
          display:"grid", gap:20,
          gridTemplateColumns: n === 2 ? "1.6fr 1fr" : "1.5fr 1fr 1fr",
          alignItems:"stretch",
        }}>
          {cat.products.map((p,i)=>(
            p.comingSoon
              ? <ComingSoonCard key={p.id} p={p} cat={cat} idx={i} layout={i===0?"lead":"spread"}/>
              : <ProductCard key={p.id} p={p} cat={cat} idx={i} layout={i===0?"lead":"spread"} now={now} onPeek={()=>onPeek(p)}/>
          ))}
        </div>
      )}
    </section>
  );
}

// ───────────────────────── Yantra ornament ─────────────────────────
function Yantra({ spin, opacity=.2 }){
  return (
    <svg viewBox="-50 -50 100 100" style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity, mixBlendMode:"overlay", pointerEvents:"none" }}>
      <g stroke="#fff" strokeWidth=".3" fill="none" style={{
        transformOrigin:"center", animation: spin?"akSpin 60s linear infinite":"akSpin 220s linear infinite",
      }}>
        <circle r="18"/><circle r="32"/><circle r="44"/>
        {Array.from({length:12}).map((_,i)=>{
          const a=(i/12)*Math.PI*2;
          return <line key={i} x1={Math.cos(a)*18} y1={Math.sin(a)*18} x2={Math.cos(a)*44} y2={Math.sin(a)*44}/>;
        })}
      </g>
    </svg>
  );
}

// ───────────────────────── ProductCard (real, from Shopify) ─────────────────────────
function ProductCard({ p, cat, idx, layout="strip", now, onPeek }){
  const [hover, setHover] = spS(false);
  const soldOut = !p.available;
  const fresh = isNewThisWeek(p.createdAt, now || Date.now());
  const strip = layout === "strip";
  const art = layout === "lead" ? "5/4" : "4/5";
  return (
    <article
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      className={strip ? "product-card" : `spread-card spread-${layout}`}
      style={{
        flex: strip ? "0 0 300px" : "none", scrollSnapAlign:"start",
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
      <div className="card-art" style={{ position:"relative", aspectRatio:art, overflow:"hidden", background:"#ece4d4" }}>
        <Gallery images={p.images.length ? p.images : (p.image ? [p.image] : [])} alt={p.name} hover={hover}
          objectPosition={layout==="lead" ? "center top" : "center"} arrows="hover" dots/>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, transparent 60%, rgba(0,0,0,.28) 100%)", pointerEvents:"none" }}/>
        <div className="mono" style={{
          position:"absolute", top:12, left:14, color:"rgba(255,255,255,.9)", textShadow:"0 1px 6px rgba(0,0,0,.5)",
          fontSize:9, letterSpacing:".3em", textTransform:"uppercase",
        }}>{cat.id}/{String(idx+1).padStart(2,"0")}</div>
        {fresh && (
          <div className="new-ribbon display" style={{
            position:"absolute", top:30, left:14, color:"#e4b37a", fontStyle:"italic", fontSize:15, letterSpacing:".01em",
            textShadow:"0 1px 8px rgba(0,0,0,.55)", animation:"ribbonIn 1.4s var(--ease-out) both",
          }}>New this week</div>
        )}
        {p.compareAt && !soldOut && (
          <div className="mono" style={{
            position:"absolute", left:14, bottom:12, padding:"4px 9px", borderRadius:4,
            background:"#c5a059", color:"#1a1008", fontSize:9, letterSpacing:".28em", textTransform:"uppercase", fontWeight:700,
          }}>Offer</div>
        )}
        {soldOut && (
          <div className="mono" style={{
            position:"absolute", left:14, bottom:12, padding:"4px 9px", borderRadius:4,
            background:"rgba(245,239,228,.92)", color:"#1a1008", fontSize:9, letterSpacing:".28em", textTransform:"uppercase", fontWeight:700,
          }}>Sold out</div>
        )}
        <button
          onClick={(e)=>{ e.stopPropagation(); onPeek(); }}
          style={{
            position:"absolute", right:12, top:12,
            width:36, height:36, borderRadius:"50%",
            background:"rgba(245,239,228,.96)", color:"#1a1008", border:"none",
            cursor:"pointer", fontSize:18, fontWeight:300,
            opacity: hover?1:0, transform: hover?"translateY(0)":"translateY(-4px)",
            transition:"all .3s",
            display:"grid", placeItems:"center",
          }} aria-label={`Open ${p.name}`}>→</button>
      </div>
      <div style={{ padding: layout==="lead" ? "22px 24px 24px" : "16px 16px 18px", background:"#fff" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:10, marginBottom:4 }}>
          <span className="display" style={{ fontSize: layout==="lead" ? 28 : 18, fontStyle:"italic", color:"#1a1008" }}>{p.name}</span>
          <Price price={p.price} compareAt={p.compareAt} size={layout==="lead" ? 13 : 11}/>
        </div>
        <div className="mono" style={{ fontSize:9, letterSpacing:".28em", color:"rgba(26,16,8,.55)", textTransform:"uppercase" }}>{p.meta}</div>
        <CardStars p={p}/>
        {layout==="lead" && (
          <div className="mono" style={{ fontSize:9, letterSpacing:".3em", color:"#8a3e18", textTransform:"uppercase", marginTop:14 }}>
            See the piece →
          </div>
        )}
      </div>
    </article>
  );
}

// ───────────────────────── Reviews UI ─────────────────────────
function Stars({ value=0, size=12 }){
  const pct = Math.max(0, Math.min(100, (Number(value)||0) / 5 * 100));
  const row = "★★★★★";
  return (
    <span aria-label={`${value} out of 5`} style={{ position:"relative", display:"inline-block", fontSize:size, lineHeight:1, letterSpacing:".08em", color:"rgba(26,16,8,.18)", whiteSpace:"nowrap", verticalAlign:"middle" }}>
      <span aria-hidden="true">{row}</span>
      <span aria-hidden="true" style={{ position:"absolute", left:0, top:0, width:`${pct}%`, overflow:"hidden", color:"#c5a059", whiteSpace:"nowrap" }}>{row}</span>
    </span>
  );
}
// Stars on a card only once the store-wide gate is open and this Product has reviews.
function CardStars({ p }){
  const rv = React.useContext(ReviewsCtx);
  if(!rv.visible || !p.rating || !(p.count>0)) return null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8 }}>
      <Stars value={p.rating} size={11}/>
      <span className="mono" style={{ fontSize:9, letterSpacing:".2em", color:"rgba(26,16,8,.5)" }}>{p.rating.toFixed(1)} · {p.count}</span>
    </div>
  );
}
// Founder's note: italic dek with a drop cap, signed. Empty metafield renders nothing.
function FounderNote({ text }){
  const paras = founderNoteParas(text);
  if(!paras.length) return null;
  return (
    <div className="founder-note" style={{ marginTop:14, paddingTop:18, borderTop:"1px solid rgba(138,105,50,.16)", animation:"fadeIn 1.2s ease-out both" }}>
      <div className="mono" style={{ fontSize:9, letterSpacing:".35em", color:"#8a3e18", textTransform:"uppercase", marginBottom:12 }}>Founder's note</div>
      {paras.map((t,i)=>(
        <p key={i} className="display" style={{ fontSize:18, fontStyle:"italic", color:"#1a1008", lineHeight:1.6, margin:"0 0 12px", fontWeight:400 }}>
          {i===0 && <span aria-hidden="true" style={{ float:"left", fontSize:"3.1em", lineHeight:.78, padding:"6px 10px 0 0", color:"#8a3e18", fontStyle:"normal" }}>{t.charAt(0)}</span>}
          {i===0 ? t.slice(1) : t}
        </p>
      ))}
      <div className="mono" style={{ fontSize:9, letterSpacing:".3em", color:"rgba(26,16,8,.55)", textTransform:"uppercase", clear:"both" }}>— Amit, AKARA</div>
    </div>
  );
}
// Write a review: our own form, posts straight to Judge.me, lands as "pending" for the owner.
function ReviewForm({ p }){
  const [open, setOpen] = spS(false);
  const [f, setF] = spS({ rating:0, name:"", email:"", title:"", body:"" });
  const [hoverStar, setHoverStar] = spS(0);
  const [st, setSt] = spS({ status:"idle", error:null });
  const set = (k)=>(e)=>setF(x=>({ ...x, [k]: e && e.target ? e.target.value : e }));
  const submit = (e)=>{
    e.preventDefault();
    const pl = reviewPayload(AKARA_SHOPIFY.domain, p, f);
    if(pl.error){ setSt({ status:"error", error:pl.error }); return; }
    setSt({ status:"sending", error:null });
    submitJudgeMeReview(pl.fields).then(()=>setSt({ status:"done", error:null })).catch(err=>setSt({ status:"error", error:"Could not send. " + (err && err.message || "") }));
  };
  const label = { fontSize:9, letterSpacing:".3em", color:"rgba(26,16,8,.55)", textTransform:"uppercase", marginBottom:6, display:"block" };
  const input = { width:"100%", boxSizing:"border-box", padding:"11px 12px", borderRadius:6, border:"1px solid rgba(26,16,8,.2)", background:"rgba(255,255,255,.6)", color:"#1a1008", fontSize:14, fontFamily:"inherit", outline:"none" };
  if(st.status==="done"){
    return (
      <div className="review-form" style={{ marginTop:14, animation:"fadeIn .9s ease-out both" }}>
        <p className="display" style={{ fontSize:18, fontStyle:"italic", color:"#1a1008", margin:"0 0 6px" }}>Thank you. Your review is with us. It appears once approved.</p>
        <div className="mono" style={{ fontSize:9, letterSpacing:".3em", color:"rgba(26,16,8,.5)", textTransform:"uppercase" }}>Read before it appears</div>
      </div>
    );
  }
  if(!open){
    return (
      <div style={{ marginTop:4 }}>
        <button type="button" onClick={()=>setOpen(true)} className="mono write-review-btn" style={{
          background:"transparent", border:"1px solid #1a1008", color:"#1a1008", borderRadius:6, padding:"13px 20px", cursor:"pointer",
          fontSize:10, letterSpacing:".3em", textTransform:"uppercase", fontWeight:700, transition:"all .3s",
        }}>Write a review →</button>
        <div className="mono" style={{ fontSize:8, letterSpacing:".22em", color:"rgba(26,16,8,.45)", textTransform:"uppercase", marginTop:8 }}>Read before it appears</div>
      </div>
    );
  }
  const shown = hoverStar || f.rating;
  return (
    <form className="review-form" onSubmit={submit} noValidate style={{ marginTop:16, padding:"18px 18px 16px", borderRadius:10, border:"1px solid rgba(138,105,50,.22)", background:"rgba(255,255,255,.35)", animation:"fadeIn .9s ease-out both", display:"grid", gap:14 }}>
      <div className="mono" style={{ fontSize:9, letterSpacing:".35em", color:"#8a3e18", textTransform:"uppercase" }}>Your word on {p.name}</div>
      <div>
        <span style={label}>Rating{shown ? ` · ${shown}/5` : ""}</span>
        <div style={{ display:"flex", gap:4 }} onMouseLeave={()=>setHoverStar(0)}>
          {[1,2,3,4,5].map(n=>(
            <button key={n} type="button" onClick={()=>set("rating")(n)} onMouseEnter={()=>setHoverStar(n)} aria-label={`${n} star${n>1?"s":""}`} style={{
              background:"none", border:"none", padding:"2px 3px", cursor:"pointer", fontSize:26, lineHeight:1,
              color: n<=shown ? "#c5a059" : "rgba(26,16,8,.18)", transition:"color .25s, transform .25s", transform: n<=shown ? "scale(1.08)" : "scale(1)",
            }}>★</button>
          ))}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div><label style={label}>Name</label><input style={input} value={f.name} onChange={set("name")} autoComplete="name" placeholder="As it should appear"/></div>
        <div><label style={label}>Email · stays private</label><input style={input} type="email" value={f.email} onChange={set("email")} autoComplete="email" placeholder="you@example.com"/></div>
      </div>
      <div><label style={label}>Title · optional</label><input style={input} value={f.title} onChange={set("title")} placeholder="One line"/></div>
      <div><label style={label}>Your words</label><textarea style={{ ...input, minHeight:96, resize:"vertical" }} value={f.body} onChange={set("body")} placeholder="Fit, print, how it wears."/></div>
      {st.error && <div style={{ fontSize:13, fontStyle:"italic", color:"#8a3e18" }}>{st.error}</div>}
      <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
        <button type="submit" disabled={st.status==="sending"} style={{
          padding:"13px 18px", background: st.status==="sending" ? "rgba(26,16,8,.35)" : "#1a1008", color:"#f5efe4", border:"none", borderRadius:6,
          fontFamily:"var(--mono)", fontSize:9, letterSpacing:".3em", textTransform:"uppercase", fontWeight:700, cursor: st.status==="sending" ? "default" : "pointer",
        }}>{st.status==="sending" ? "Sending…" : "Send review"}</button>
        <button type="button" onClick={()=>setOpen(false)} className="mono" style={{ background:"none", border:"none", padding:0, cursor:"pointer", fontSize:9, letterSpacing:".3em", color:"rgba(26,16,8,.5)", textTransform:"uppercase" }}>Cancel</button>
        <span className="mono" style={{ fontSize:8, letterSpacing:".22em", color:"rgba(26,16,8,.4)", textTransform:"uppercase" }}>Read before it appears</span>
      </div>
    </form>
  );
}
// Reviews for one Product. Gate closed → only a quiet "write a review" line.
// Judge.me down → nothing (the Founder's note above carries the page).
function ReviewsBlock({ p }){
  const rv = React.useContext(ReviewsCtx);
  const r = useProductReviews(p.handle, rv.visible);
  const link = <ReviewForm p={p}/>;
  if(!rv.visible) return (
    <div className="reviews" style={{ marginTop:14, paddingTop:18, borderTop:"1px solid rgba(138,105,50,.16)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap", marginBottom:10 }}>
        <div className="mono" style={{ fontSize:9, letterSpacing:".35em", color:"#8a3e18", textTransform:"uppercase" }}>Reviews</div>
        <Stars value={0} size={13}/>
      </div>
      <p className="display" style={{ fontSize:18, fontStyle:"italic", color:"#1a1008", margin:"0 0 14px", lineHeight:1.5 }}>No words on this piece yet. Yours would be the first.</p>
      {link}
    </div>
  );
  if(r.status!=="ok") return null;
  const sum = r.summary || { rating:0, count:0 };
  const rating = sum.rating || p.rating || 0, count = sum.count || p.count || 0;
  return (
    <div className="reviews" style={{ marginTop:14, paddingTop:18, borderTop:"1px solid rgba(138,105,50,.16)", animation:"fadeIn 1.2s ease-out both" }}>
      <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:12, flexWrap:"wrap", marginBottom:14 }}>
        <div className="mono" style={{ fontSize:9, letterSpacing:".35em", color:"#8a3e18", textTransform:"uppercase" }}>Reviews · from those who wear it</div>
        {count>0 && (
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <Stars value={rating} size={13}/>
            <span className="mono" style={{ fontSize:9, letterSpacing:".2em", color:"rgba(26,16,8,.55)" }}>{Number(rating).toFixed(1)} · {count} {count===1 ? "review" : "reviews"}</span>
          </div>
        )}
      </div>
      {r.reviews.length===0 && (
        <p style={{ fontSize:15, fontStyle:"italic", color:"rgba(26,16,8,.6)", margin:"0 0 12px", fontWeight:300 }}>No words on this piece yet. Be the first.</p>
      )}
      {r.reviews.map((x,i)=>(
        <div key={x.id||i} style={{ padding:"14px 0", borderTop: i===0 ? "none" : "1px solid rgba(138,105,50,.1)", animation:`fadeIn .9s ease-out ${Math.min(i,6)*0.12}s both` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:6 }}>
            <Stars value={x.rating} size={11}/>
            <span className="mono" style={{ fontSize:9, letterSpacing:".22em", color:"#1a1008", textTransform:"uppercase" }}>{x.author}</span>
            {x.verified && <span className="mono" style={{ fontSize:8, letterSpacing:".22em", color:"#8a3e18", textTransform:"uppercase" }}>Verified buyer</span>}
            {x.date && <span className="mono" style={{ fontSize:8, letterSpacing:".22em", color:"rgba(26,16,8,.45)", textTransform:"uppercase" }}>{fmtReviewDate(x.date)}</span>}
          </div>
          {x.title && <div className="display" style={{ fontSize:17, fontStyle:"italic", color:"#1a1008", marginBottom:4 }}>{x.title}</div>}
          {x.body && <p style={{ fontSize:14, color:"rgba(26,16,8,.75)", lineHeight:1.7, margin:0, fontWeight:300, whiteSpace:"pre-line" }}>{x.body}</p>}
        </div>
      ))}
      <div style={{ marginTop:14 }}>{link}</div>
    </div>
  );
}

function Price({ price, compareAt, size=11 }){
  // keyframe for the ribbon lives here once, near its only users
  if(typeof document !== "undefined" && !document.getElementById("akara-ribbon-kf")){
    const st = document.createElement("style"); st.id="akara-ribbon-kf";
    st.textContent = "@keyframes ribbonIn { from { opacity:0; transform:translateX(-6px); } to { opacity:1; transform:translateX(0); } }";
    document.head.appendChild(st);
  }
  return (
    <span className="mono" style={{ fontSize:size, letterSpacing:".08em", color:"#8a3e18", fontWeight:600, whiteSpace:"nowrap" }}>
      {compareAt && <span style={{ textDecoration:"line-through", color:"rgba(26,16,8,.4)", marginRight:8, fontWeight:400 }}>{fmtINR(compareAt)}</span>}
      {fmtINR(price)}
    </span>
  );
}

// ───────────────────────── Coming Soon card ─────────────────────────
function ComingSoonCard({ p, cat, idx, layout="strip" }){
  const [hover, setHover] = spS(false);
  const gradient = `linear-gradient(155deg, ${p.tone[0]} 0%, ${p.tone[1]} 100%)`;
  const strip = layout === "strip";
  if(layout === "banner"){
    // One wide strip across the whole aisle. Text lives inside the art.
    return (
      <article
        onMouseEnter={()=>setHover(true)}
        onMouseLeave={()=>setHover(false)}
        className="soon-banner"
        aria-label={`${p.name} — coming soon`}
        style={{
          position:"relative", borderRadius:10, overflow:"hidden",
          minHeight:220, background:gradient,
          boxShadow:"0 8px 22px rgba(61,45,19,.12)",
          display:"grid", gridTemplateColumns:"1fr auto", alignItems:"end", gap:24,
          padding:"32px 36px",
        }}>
        <Yantra spin={hover} opacity={.22}/>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg, rgba(0,0,0,.35) 0%, transparent 60%)" }}/>
        <div style={{ position:"relative" }}>
          <div className="mono" style={{ fontSize:9, letterSpacing:".3em", textTransform:"uppercase", color:"rgba(255,255,255,.8)", marginBottom:10 }}>{cat.id}/01 · {p.meta}</div>
          <div className="display" style={{ fontSize:"clamp(30px,3.6vw,48px)", fontStyle:"italic", color:"#f5efe4", lineHeight:1 }}>{p.name}</div>
        </div>
        <div className="display" style={{ position:"relative", fontSize:"clamp(22px,2.6vw,34px)", fontStyle:"italic", color:"rgba(245,239,228,.85)", whiteSpace:"nowrap" }}>coming soon</div>
      </article>
    );
  }
  const art = layout === "lead" ? "4/3" : "4/5";
  return (
    <article
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      className={strip ? "product-card" : `spread-card spread-${layout}`}
      aria-label={`${p.name} — coming soon`}
      style={{
        flex: strip ? "0 0 300px" : "none", scrollSnapAlign:"start",
        position:"relative", borderRadius:10, overflow:"hidden",
        background:"#fff", boxShadow:"0 8px 22px rgba(61,45,19,.12)",
        transition:"all .4s var(--ease-out)", cursor:"default",
        opacity: hover ? 1 : .92,
        display:"flex", flexDirection:"column",
      }}>
      <div className="card-art" style={{ position:"relative", aspectRatio:art, overflow:"hidden", background:gradient, flex:"1 1 auto" }}>
        <Yantra spin={hover}/>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, transparent 40%, rgba(0,0,0,.5) 100%)" }}/>
        <div className="mono" style={{
          position:"absolute", top:12, left:14, color:"rgba(255,255,255,.85)",
          fontSize:9, letterSpacing:".3em", textTransform:"uppercase",
        }}>{cat.id}/{String(idx+1).padStart(2,"0")}</div>
        <div className="display" style={{
          position:"absolute", left:0, right:0, bottom:22, textAlign:"center",
          color:"#f5efe4", fontSize:22, fontStyle:"italic", letterSpacing:".02em",
        }}>coming soon</div>
      </div>
      <div style={{ padding:"16px 16px 18px", background:"#fff" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:10, marginBottom:4 }}>
          <span className="display" style={{ fontSize:18, fontStyle:"italic", color:"#1a1008" }}>{p.name}</span>
          {p.price != null && <span className="mono" style={{ fontSize:11, letterSpacing:".08em", color:"rgba(26,16,8,.45)", fontWeight:600 }}>{fmtINR(p.price)}</span>}
        </div>
        <div className="mono" style={{ fontSize:9, letterSpacing:".28em", color:"rgba(26,16,8,.55)", textTransform:"uppercase" }}>{p.meta}</div>
      </div>
    </article>
  );
}

// ───────────────────────── Gallery (swipe / arrows / dots) ─────────────────────────
// One scroll-snap strip. Touch swipes natively; mouse uses the arrows. `api` (a ref)
// gets { goTo(i) } so thumbs and colour pickers can drive it.
function Gallery({ images, alt, hover=false, objectPosition="center", arrows="hover", dots=false, api=null, onIndex=null, fit="cover", eager=false }){
  const ref = spR(null);
  const [idx, setIdx] = spS(0);
  const n = images.length;
  const go = spC((i)=>{
    const el = ref.current; if(!el || !n) return;
    const j = ((i % n) + n) % n;
    el.scrollTo({ left: j * el.clientWidth, behavior: "smooth" });
  },[n]);
  spE(()=>{ if(api) api.current = { goTo:go, index:idx }; },[api, go, idx]);
  spE(()=>{
    const onResize = ()=>{ const el = ref.current; if(el) el.scrollTo({ left: idx * el.clientWidth }); };
    window.addEventListener("resize", onResize);
    return ()=>window.removeEventListener("resize", onResize);
  },[idx]);
  const onScroll = ()=>{
    const el = ref.current; if(!el) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if(i!==idx){ setIdx(i); onIndex && onIndex(i); }
  };
  const showArrows = n>1 && (arrows==="always" || (arrows==="hover" && hover));
  const arrowStyle = (side)=>({
    position:"absolute", top:"50%", [side]:10, transform:"translateY(-50%)",
    width:34, height:34, borderRadius:"50%", border:"none", cursor:"pointer",
    background:"rgba(245,239,228,.92)", color:"#1a1008", fontSize:16, fontWeight:300,
    display:"grid", placeItems:"center", zIndex:3,
    opacity: showArrows ? 1 : 0, transition:"opacity .35s, transform .35s",
    boxShadow:"0 4px 14px rgba(0,0,0,.25)",
  });
  return (
    <div style={{ position:"absolute", inset:0 }}>
      <div ref={ref} onScroll={onScroll} className="ak-gallery" style={{
        position:"absolute", inset:0, display:"flex", overflowX:"auto", overflowY:"hidden",
        scrollSnapType:"x mandatory", scrollbarWidth:"none", WebkitOverflowScrolling:"touch",
      }}>
        {images.map((u,i)=>(
          <div key={u+i} style={{ flex:"0 0 100%", height:"100%", scrollSnapAlign:"start", position:"relative", overflow:"hidden" }}>
            <img src={u} alt={i===0 ? alt : ""} loading={eager && i<2 ? "eager" : "lazy"} draggable={false} style={{
              position:"absolute", inset:0, width:"100%", height:"100%", objectFit:fit, objectPosition,
              transform: hover ? "scale(1.04)" : "scale(1)", transition:"transform 1.1s var(--ease-out)",
            }}/>
          </div>
        ))}
      </div>
      {n>1 && (
        <React.Fragment>
          <button aria-label="Previous image" onClick={(e)=>{ e.stopPropagation(); go(idx-1); }} style={arrowStyle("left")}>←</button>
          <button aria-label="Next image" onClick={(e)=>{ e.stopPropagation(); go(idx+1); }} style={arrowStyle("right")}>→</button>
        </React.Fragment>
      )}
      {dots && n>1 && (
        <div style={{ position:"absolute", left:0, right:0, bottom:10, display:"flex", justifyContent:"center", gap:5, zIndex:3, pointerEvents:"none" }}>
          {images.map((_,i)=>(
            <span key={i} style={{ width: i===idx ? 14 : 5, height:5, borderRadius:3, background: i===idx ? "#e4b37a" : "rgba(245,239,228,.7)", transition:"all .4s var(--ease-out)" }}/>
          ))}
        </div>
      )}
      <style>{`.ak-gallery::-webkit-scrollbar{display:none}`}</style>
    </div>
  );
}

// ───────────────────────── ProductPage (/shop/{handle}) ─────────────────────────
function ProductPage({ p, status, products, now, busy, onAdd, onOpen, onBack, onRetry }){
  if(status==="dhyana") return <main className="shop-main" style={{ maxWidth:1500, margin:"0 auto", padding:"48px 40px 120px" }}><DhyanaState onRetry={onRetry}/></main>;
  if(status==="loading" || (!p && status!=="ok")) return (
    <div style={{ padding:"140px 40px", textAlign:"center", color:"rgba(26,16,8,.5)" }}>
      <div className="display" style={{ fontSize:32, fontStyle:"italic", marginBottom:10 }}>Unfolding the piece…</div>
    </div>
  );
  if(!p) return (
    <div style={{ padding:"140px 40px", textAlign:"center", color:"rgba(26,16,8,.6)" }}>
      <div className="display" style={{ fontSize:"clamp(32px,4vw,48px)", fontStyle:"italic", marginBottom:10, color:"#1a1008" }}>That piece is not on the shelf.</div>
      <div className="mono" style={{ fontSize:11, letterSpacing:".3em", textTransform:"uppercase", marginBottom:28 }}>It may be paused, or the link is old</div>
      <button onClick={onBack} style={{ padding:"12px 22px", borderRadius:999, background:"transparent", color:"#1a1008", border:"1px solid rgba(26,16,8,.3)",
        fontFamily:"var(--mono)", fontSize:10, letterSpacing:".3em", textTransform:"uppercase", fontWeight:600, cursor:"pointer" }}>Back to the shop</button>
    </div>
  );
  return <ProductView key={p.id} p={p} products={products} now={now} busy={busy} onAdd={onAdd} onOpen={onOpen} onBack={onBack}/>;
}

function ProductView({ p, products, now, busy, onAdd, onOpen, onBack }){
  const cat = AISLES.find(a=>a.id===p.aisle) || AISLES[0];
  const hasColor = p.colors.length > 0, hasSize = p.sizes.length > 0;
  const firstAvail = p.variants.find(v=>v.available) || p.variants[0] || {};
  const [color, setColor] = spS(hasColor ? (firstAvail.color || p.colors[0]) : null);
  const [size, setSize]   = spS(hasSize ? (firstAvail.size || (p.sizes.includes("M") ? "M" : p.sizes[0])) : null);
  const [idx, setIdx] = spS(0);
  const gal = spR(null);
  const images = p.images.length ? p.images : (p.image ? [p.image] : []);
  const variantFor = (c, s)=> p.variants.find(v=>(!hasColor || v.color===c) && (!hasSize || v.size===s));
  const variant = variantFor(color, size);
  const sizeAvailable = (s)=>{ const v = variantFor(color, s); return !!(v && v.available); };
  const price = variant ? variant.price : p.price;
  const compareAt = variant ? variant.compareAt : p.compareAt;
  const canAdd = !!(variant && variant.available) && !busy;
  const fresh = isNewThisWeek(p.createdAt, now || Date.now());
  const deity = deityLabel(p.deity);
  const pickColor = (c)=>{
    setColor(c);
    const u = p.imageForColor[c]; const i = u ? images.indexOf(u) : -1;
    if(i>=0 && gal.current) gal.current.goTo(i);
  };
  const more = spM(()=>{
    const pool = sortProducts(products.filter(x=>x.handle!==p.handle && !x.comingSoon), "newest");
    const same = p.deity ? pool.filter(x=>x.deity===p.deity) : [];
    const rest = pool.filter(x=>!same.includes(x));
    return [...same, ...rest].slice(0, 6);
  },[products, p]);
  // Group consecutive "a | b | c" lines into one table; everything else is a paragraph.
  const blocks = spM(()=>{
    const out = []; let table = null;
    (p.description ? p.description.split("\n") : []).forEach(line=>{
      if(line.includes(" | ")){ const cells = line.split(/\s*\|\s*/); if(!table){ table = { type:"table", rows:[] }; out.push(table); } table.rows.push(cells); }
      else { table = null; out.push({ type:"p", text:line }); }
    });
    return out;
  },[p.description]);

  return (
    <article className="pp" style={{ maxWidth:1400, margin:"0 auto", padding:"28px 40px 120px", animation:"fadeIn .9s ease-out both" }}>
      {/* crumbs */}
      <div className="mono" style={{ fontSize:9, letterSpacing:".3em", textTransform:"uppercase", color:"rgba(26,16,8,.5)", marginBottom:22, display:"flex", gap:10, flexWrap:"wrap" }}>
        <button onClick={onBack} style={{ background:"none", border:"none", padding:0, cursor:"pointer", color:"#8a3e18", font:"inherit", letterSpacing:"inherit", textTransform:"inherit" }}>Shop</button>
        <span>/</span><span>{cat.name}</span>
        {deity && <React.Fragment><span>/</span><span>{deity}</span></React.Fragment>}
      </div>

      <div className="pp-grid" style={{ display:"grid", gridTemplateColumns:"minmax(0,1.25fr) minmax(0,1fr)", gap:48, alignItems:"start" }}>
        {/* GALLERY */}
        <div className="pp-gallery" style={{ position:"sticky", top:96 }}>
          <div style={{ position:"relative", aspectRatio:"4/5", borderRadius:12, overflow:"hidden", background:"#ece4d4", boxShadow:"0 24px 60px rgba(61,45,19,.18)" }}>
            <Gallery images={images} alt={p.name} arrows="always" dots api={gal} onIndex={setIdx} eager/>
            <div className="mono" style={{ position:"absolute", top:16, left:18, zIndex:3, color:"rgba(255,255,255,.9)", textShadow:"0 1px 6px rgba(0,0,0,.6)", fontSize:10, letterSpacing:".3em", textTransform:"uppercase", pointerEvents:"none" }}>
              {cat.name}{color ? ` · ${color}` : ""}{images.length>1 ? ` · ${idx+1}/${images.length}` : ""}
            </div>
            {fresh && <div className="new-ribbon display" style={{ position:"absolute", top:36, left:18, zIndex:3, color:"#e4b37a", fontStyle:"italic", fontSize:18, textShadow:"0 1px 8px rgba(0,0,0,.55)", pointerEvents:"none" }}>New this week</div>}
          </div>
          {images.length>1 && (
            <div className="pp-thumbs" style={{ display:"grid", gridAutoFlow:"column", gridAutoColumns:72, gap:10, overflowX:"auto", scrollbarWidth:"none", marginTop:12, padding:"2px 2px 6px" }}>
              {images.map((u,i)=>(
                <button key={u+i} onClick={()=>gal.current && gal.current.goTo(i)} aria-label={`Image ${i+1}`} style={{
                  width:72, height:88, padding:0, borderRadius:8, overflow:"hidden", cursor:"pointer", background:"#ece4d4",
                  border:`2px solid ${i===idx ? "#1a1008" : "rgba(138,105,50,.25)"}`, transition:"border-color .35s",
                }}>
                  <img src={u} alt="" loading="lazy" draggable={false} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* COPY */}
        <div className="pp-copy" style={{ display:"flex", flexDirection:"column", gap:16, minWidth:0 }}>
          <div className="mono" style={{ fontSize:10, letterSpacing:".32em", color:"#8a3e18", textTransform:"uppercase" }}>{deity ? `${deity} · ${cat.tag}` : cat.tag}</div>
          <h1 className="display" style={{ fontSize:"clamp(40px, 5vw, 64px)", fontStyle:"italic", margin:0, fontWeight:400, color:"#1a1008", lineHeight:.98, letterSpacing:"-.01em" }}>{p.name}</h1>
          <div className="mono" style={{ fontSize:12, letterSpacing:".08em", color:"#3d2d13" }}>{p.meta}</div>
          <div style={{ fontSize:26, color:"#1a1008", fontWeight:500, marginTop:2 }}>
            {compareAt && <span style={{ textDecoration:"line-through", color:"rgba(26,16,8,.4)", fontSize:17, marginRight:10, fontWeight:400 }}>{fmtINR(compareAt)}</span>}
            {fmtINR(price)}
            <span className="mono" style={{ fontSize:9, letterSpacing:".28em", color:"rgba(26,16,8,.45)", textTransform:"uppercase", marginLeft:10 }}>incl. GST</span>
          </div>

          {hasColor && (
            <div>
              <div className="mono" style={{ fontSize:9, letterSpacing:".32em", color:"rgba(26,16,8,.55)", textTransform:"uppercase", marginBottom:10 }}>
                Colour · <span style={{ color:"#8a3e18" }}>{color}</span>
              </div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                {p.colors.map(c=>{
                  const active = c===color; const hex = swatchFor(c) || cssColorOrNull(c);
                  return (
                    <button key={c} onClick={()=>pickColor(c)} aria-label={c} title={c} style={{
                      minWidth:36, height:36, borderRadius: hex ? "50%" : 999, padding: hex ? 0 : "0 12px",
                      background: hex || "rgba(255,255,255,.6)", color:"#1a1008",
                      fontFamily:"var(--mono)", fontSize:9, letterSpacing:".18em", textTransform:"uppercase",
                      border:`2px solid ${active ? "#1a1008" : "rgba(26,16,8,.18)"}`,
                      boxShadow: active ? "0 0 0 3px #f5efe4, 0 0 0 4px #1a1008" : "inset 0 0 0 1px rgba(0,0,0,.08)",
                      cursor:"pointer", transition:"all .3s",
                    }}>{hex ? "" : c}</button>
                  );
                })}
              </div>
            </div>
          )}

          {hasSize && (
            <div>
              <div className="mono" style={{ fontSize:9, letterSpacing:".32em", color:"rgba(26,16,8,.55)", textTransform:"uppercase", marginBottom:10 }}>
                Size · <span style={{ color:"#8a3e18" }}>{size}</span>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {p.sizes.map(s=>{
                  const active = s===size; const ok = sizeAvailable(s);
                  return (
                    <button key={s} onClick={()=>setSize(s)} disabled={!ok} style={{
                      minWidth:46, height:42, padding:"0 10px", borderRadius:6,
                      background: active?"#1a1008":"transparent",
                      color: active?"#f5efe4": ok ? "#1a1008" : "rgba(26,16,8,.3)",
                      border:`1px solid ${active?"#1a1008": ok ? "rgba(26,16,8,.2)" : "rgba(26,16,8,.1)"}`,
                      textDecoration: ok ? "none" : "line-through",
                      fontFamily:"var(--mono)", fontSize:11, fontWeight:600, letterSpacing:".1em",
                      cursor: ok ? "pointer" : "not-allowed", transition:"all .2s",
                    }}>{s}</button>
                  );
                })}
              </div>
              <div className="mono" style={{ fontSize:8, letterSpacing:".28em", color:"rgba(26,16,8,.4)", textTransform:"uppercase", marginTop:8 }}>Unisex fit · Printed to order</div>
            </div>
          )}

          <button onClick={()=>canAdd && onAdd(variant.id)} disabled={!canAdd} style={{
            marginTop:6, padding:"16px 20px",
            background: canAdd ? "#1a1008" : "rgba(26,16,8,.25)", color:"#f5efe4", border:"none", borderRadius:8,
            fontFamily:"var(--mono)", fontSize:10, letterSpacing:".3em", textTransform:"uppercase", fontWeight:700,
            cursor: canAdd ? "pointer" : "default", transition:"transform .3s",
          }}>
            {busy ? "Adding…" : (variant && !variant.available) ? "Sold out" : `+ Add to bag · ${size ? `Size ${size} · ` : ""}${fmtINR(price)}`}
          </button>
          <TrustStrip product={p.name} compact/>

          {blocks.length>0 && (
            <div style={{ marginTop:14, paddingTop:18, borderTop:"1px solid rgba(138,105,50,.16)" }}>
              <div className="mono" style={{ fontSize:9, letterSpacing:".35em", color:"#8a3e18", textTransform:"uppercase", marginBottom:10 }}>About this piece</div>
              {blocks.map((b,i)=> b.type==="table" ? (
                <div key={i} style={{ overflowX:"auto", margin:"6px 0 14px" }}>
                  <table className="mono" style={{ borderCollapse:"collapse", fontSize:11, letterSpacing:".06em", minWidth:260 }}>
                    <tbody>
                      {b.rows.map((r,ri)=>(
                        <tr key={ri} style={{ borderBottom:"1px solid rgba(138,105,50,.16)" }}>
                          {r.map((c,ci)=>(
                            ri===0
                              ? <th key={ci} style={{ textAlign:"left", padding:"6px 14px 6px 0", fontWeight:700, textTransform:"uppercase", fontSize:9, letterSpacing:".28em", color:"#8a3e18" }}>{c}</th>
                              : <td key={ci} style={{ padding:"6px 14px 6px 0", color:"#1a1008" }}>{c}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p key={i} style={{ fontSize: i===0 ? 17 : 15, color: i===0 ? "#1a1008" : "rgba(26,16,8,.72)", lineHeight:1.7, margin:"0 0 12px", fontWeight:300, fontStyle: i===0 ? "italic" : "normal" }}>{b.text}</p>
              ))}
            </div>
          )}

          <FounderNote text={p.founderNote}/>
          <ReviewsBlock p={p}/>

          <dl className="pp-facts" style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:"8px 18px", margin:"6px 0 0", paddingTop:16, borderTop:"1px solid rgba(138,105,50,.16)", fontSize:13 }}>
            {[
              ["Cut", p.meta], ["Type", p.typeLabel], deity && ["Deity", deity],
              p.colors.length && ["Colours", p.colors.join(", ")], p.sizes.length && ["Sizes", p.sizes.join(" · ")],
              ["Made", "Printed to order in India, delivered in 5–8 business days"],
            ].filter(Boolean).map(([k,v])=>(
              <React.Fragment key={k}>
                <dt className="mono" style={{ fontSize:9, letterSpacing:".3em", textTransform:"uppercase", color:"rgba(26,16,8,.5)", alignSelf:"baseline" }}>{k}</dt>
                <dd style={{ margin:0, color:"#1a1008" }}>{v}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      </div>

      {more.length>0 && (
        <section style={{ marginTop:88 }}>
          <div className="mono" style={{ fontSize:10, letterSpacing:".35em", color:"#8a3e18", textTransform:"uppercase", marginBottom:8 }}>{p.deity ? `More of ${deity}` : "More from the shop"}</div>
          <h2 className="display" style={{ fontSize:"clamp(30px,3.6vw,46px)", fontStyle:"italic", margin:"0 0 22px", fontWeight:400, color:"#1a1008" }}>Of the same devotion.</h2>
          <div style={{ display:"flex", gap:16, overflowX:"auto", paddingBottom:12, scrollSnapType:"x mandatory", scrollbarWidth:"thin" }}>
            {more.map((m,i)=>(
              <ProductCard key={m.id} p={m} cat={AISLES.find(a=>a.id===m.aisle)||cat} idx={i} layout="strip" now={now} onPeek={()=>onOpen(m)}/>
            ))}
          </div>
        </section>
      )}

      <footer style={{ marginTop:72, paddingTop:28, borderTop:"1px solid rgba(138,105,50,.18)" }}>
        <TrustStrip align="center"/>
      </footer>

      <style>{`
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        .pp-thumbs::-webkit-scrollbar { display:none; }
        @media (max-width: 880px) {
          .pp { padding: 18px 16px 100px !important; }
          .pp-grid { grid-template-columns: 1fr !important; gap: 26px !important; }
          .pp-gallery { position: static !important; }
          .pp-copy h1 { font-size: clamp(34px, 9vw, 48px) !important; }
        }
      `}</style>
    </article>
  );
}

// ───────────────────────── CartDrawer (Shopify cart) ─────────────────────────
function CartDrawer({ open, cart, busy, error, onUpdate, onRemove, onClose, upsell=[], onPeek }){
  const lines = cart ? cart.lines : [];
  const count = cart ? cart.count : 0;
  const subtotal = cart ? cart.subtotal : 0;
  const canCheckout = !!(cart && cart.checkoutUrl && lines.length) && !busy;
  const checkout = ()=>{
    if(!canCheckout) return;
    try{ window.akTrack && window.akTrack("begin_checkout", { currency:"INR", value:subtotal,
      items:lines.map(l=>({ item_id:l.handle, item_name:l.name, price:l.price, quantity:l.qty })) }); }catch(e){}
    window.location.assign(cart.checkoutUrl);
  };
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
              {count ? `${count} ${count===1?"piece":"pieces"}` : "Empty"}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close cart" style={{
            width:36, height:36, borderRadius:"50%", background:"transparent",
            border:"1px solid rgba(26,16,8,.2)", cursor:"pointer", color:"#1a1008", fontSize:14,
          }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"18px 26px", opacity: busy ? .6 : 1, transition:"opacity .3s" }}>
          {error && (
            <div className="mono" style={{ fontSize:9, letterSpacing:".2em", color:"#8a3e18", textTransform:"uppercase", marginBottom:12 }}>
              The till did not answer. Try again.
            </div>
          )}
          {lines.length===0 ? (
            <div style={{ padding:"40px 10px", textAlign:"center", color:"rgba(26,16,8,.45)" }}>
              <div className="display" style={{ fontSize:26, fontStyle:"italic", marginBottom:8 }}>Nothing added yet.</div>
              <div className="mono" style={{ fontSize:10, letterSpacing:".3em", textTransform:"uppercase" }}>Browse the aisles →</div>
            </div>
          ) : lines.map(ci=>(
            <div key={ci.id} style={{
              display:"grid", gridTemplateColumns:"56px 1fr auto", gap:12,
              padding:"14px 0", borderBottom:"1px solid rgba(138,105,50,.12)",
            }}>
              <div style={{ width:56, height:70, borderRadius:6, overflow:"hidden", background:"#ece4d4" }}>
                {ci.image && <img src={ci.image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>}
              </div>
              <div>
                <div style={{ fontFamily:"var(--display,serif)", fontSize:16, fontStyle:"italic", color:"#1a1008" }}>{ci.name}</div>
                {(ci.color || ci.size) && (
                  <div className="mono" style={{ fontSize:9, letterSpacing:".28em", color:"#8a3e18", textTransform:"uppercase", marginTop:3 }}>
                    {[ci.color, ci.size && `Size ${ci.size}`].filter(Boolean).join(" · ")}
                  </div>
                )}
                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6 }}>
                  <button disabled={busy} onClick={()=>onUpdate(ci.id, Math.max(1, ci.qty-1)).catch(()=>{})}
                    style={{ width:24, height:24, borderRadius:4, border:"1px solid rgba(26,16,8,.2)", background:"transparent", cursor:"pointer" }}>−</button>
                  <span className="mono" style={{ fontSize:11, minWidth:24, textAlign:"center" }}>{ci.qty}</span>
                  <button disabled={busy} onClick={()=>onUpdate(ci.id, ci.qty+1).catch(()=>{})}
                    style={{ width:24, height:24, borderRadius:4, border:"1px solid rgba(26,16,8,.2)", background:"transparent", cursor:"pointer" }}>+</button>
                  <button disabled={busy} onClick={()=>onRemove(ci.id).catch(()=>{})}
                    className="mono" style={{ marginLeft:10, background:"transparent", border:"none", color:"#8a3e18", fontSize:9, letterSpacing:".25em", textTransform:"uppercase", cursor:"pointer" }}>Remove</button>
                </div>
              </div>
              <div className="mono" style={{ fontSize:12, color:"#1a1008", fontWeight:600, alignSelf:"start" }}>{fmtINR(ci.price*ci.qty)}</div>
            </div>
          ))}

          {upsell.length > 0 && (
            <div style={{ marginTop:26 }}>
              <div className="mono" style={{ fontSize:9, letterSpacing:".35em", color:"#8a3e18", textTransform:"uppercase", marginBottom:4 }}>
                {lines.length ? "Goes with this" : "Start here"}
              </div>
              <div className="display" style={{ fontSize:18, fontStyle:"italic", color:"#1a1008", marginBottom:12 }}>
                {lines.length ? "Of the same deity." : "The newest pieces."}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10 }}>
                {upsell.map(u=>(
                  <button key={u.id} onClick={()=>onPeek && onPeek(u)} style={{
                    padding:0, border:"none", background:"transparent", cursor:"pointer", textAlign:"left",
                  }}>
                    <div style={{ aspectRatio:"4/5", borderRadius:6, overflow:"hidden", background:"#ece4d4", marginBottom:6 }}>
                      {u.image && <img src={u.image} alt={u.name} loading="lazy" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>}
                    </div>
                    <div className="display" style={{ fontSize:13, fontStyle:"italic", color:"#1a1008", lineHeight:1.2 }}>{u.name}</div>
                    <div className="mono" style={{ fontSize:8, letterSpacing:".18em", color:"rgba(26,16,8,.5)", textTransform:"uppercase", marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{u.meta}</div>
                    <div className="mono" style={{ fontSize:9, letterSpacing:".2em", color:"rgba(26,16,8,.7)", marginTop:2 }}>{fmtINR(u.price)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding:"22px 26px", borderTop:"1px solid rgba(138,105,50,.18)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
            <span className="mono" style={{ fontSize:10, letterSpacing:".3em", color:"rgba(26,16,8,.55)", textTransform:"uppercase" }}>Subtotal</span>
            <span style={{ fontSize:18, fontWeight:600, color:"#1a1008" }}>{fmtINR(subtotal)}</span>
          </div>
          <button disabled={!canCheckout} onClick={checkout} style={{
            width:"100%", padding:"16px",
            background: canCheckout?"#1a1008":"rgba(26,16,8,.25)", color:"#f5efe4", border:"none", borderRadius:8,
            fontFamily:"var(--mono)", fontSize:11, letterSpacing:".3em", textTransform:"uppercase", fontWeight:700,
            cursor: canCheckout?"pointer":"default",
          }}>{busy ? "One moment…" : "Checkout →"}</button>
          <div className="mono" style={{ fontSize:9, letterSpacing:".28em", color:"rgba(26,16,8,.4)", textTransform:"uppercase", textAlign:"center", marginTop:10 }}>
            Secure checkout by Shopify · UPI · Cards
          </div>
          <div style={{ marginTop:12, paddingTop:10, borderTop:"1px solid rgba(138,105,50,.14)" }}>
            <TrustStrip align="center" compact/>
          </div>
        </div>
      </aside>
    </React.Fragment>
  );
}

Object.assign(window, { ShopPage, AISLES, TRUST });
