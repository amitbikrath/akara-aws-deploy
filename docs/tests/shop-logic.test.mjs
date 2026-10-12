// Runs the pure block of shop-page.jsx against the saved Storefront fixture.
//   node akara/docs/tests/shop-logic.test.mjs
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const jsx = fs.readFileSync(path.join(here, "../../frontend/public/akara/shop-page.jsx"), "utf8");
const block = jsx.split("// @pure-start")[1].split("// @pure-end")[0];
assert.ok(block.length > 1000, "pure block found");
assert.ok(!/<[A-Za-z]/.test(block.replace(/\/\/.*$/gm,"")), "pure block has no JSX");

const exportsList = ["DEITIES","deityFor","typeLabelFor","swatchFor","buildFacets","applyFilters","anyFilterActive","SORTS","sortProducts","isNewThisWeek","upsellFor","filtersFromParams","paramsFromFilters","TRUST","whatsappUrl","sortSizes","fmtINR","reviewsVisible","parseRatingMetafield","parseJudgeMeSummary","parseJudgeMeReviews","fmtReviewDate","writeReviewUrl","founderNoteParas","productExternalId","reviewPayload"];
const L = new Function(block + `\nreturn {${exportsList.join(",")}};`)();

// ---- fixture → minimal product shape (mirrors mapProduct's fields used by the pure code)
const fx = JSON.parse(fs.readFileSync(path.join(here, "storefront-fixture-2026-09-07.json"), "utf8"));
const products = fx.data.products.edges.map(({node:n})=>{
  const colorOpt = n.options.find(o=>o.name.toLowerCase()==="color");
  const t = String(n.productType||"").toLowerCase();
  return {
    id:n.id, handle:n.handle, name:n.title.split(/\s+[—–-]\s+/)[0], title:n.title,
    price:Number(n.priceRange.minVariantPrice.amount), createdAt:n.createdAt,
    tags:n.tags, colors: colorOpt ? colorOpt.values : [],
    deity:L.deityFor(n.tags), typeLabel:L.typeLabelFor(n.productType),
    aisle: (t.includes("t-shirt")||t.includes("tee")) ? "clothing" : "merch",
    comingSoon:false, image:null,
  };
});
assert.equal(products.length, 11);

let passed = 0; const t = (name, fn)=>{ fn(); passed++; console.log("ok -", name); };

t("deity: Shiva 4, Hanuman 2, Krishna 2, Ganesha 1, Sadhu 1", ()=>{
  const f = L.buildFacets(products);
  const m = Object.fromEntries(f.deities.map(d=>[d.id,d.count]));
  assert.deepEqual(m, { shiva:4, hanuman:2, krishna:2, ganesha:1, sadhu:1 });
  assert.equal(f.deities[0].id, "shiva", "display order follows DEITIES list");
});
t("mug has no deity and is absent from every deity filter, present in All", ()=>{
  const mug = products.find(p=>p.typeLabel==="Mug");
  assert.equal(mug.deity, null);
  for(const d of L.DEITIES){ assert.ok(!L.applyFilters(products,{deity:[d.id]}).includes(mug)); }
  assert.ok(L.applyFilters(products,{}).includes(mug));
});
t("type facet: Tee 10, Mug 1", ()=>{
  const f = L.buildFacets(products);
  assert.deepEqual(f.types.map(x=>[x.id,x.count]), [["Tee",10],["Mug",1]]);
});
t("colour facet counts + every live colour has a swatch", ()=>{
  const f = L.buildFacets(products);
  const m = Object.fromEntries(f.colors.map(c=>[c.id,c.count]));
  assert.deepEqual(m, {White:7, Black:7, "Navy Blue":3, Lavender:3, Beige:2, "Grey Melange":1, Mint:1});
  f.colors.forEach(c=>assert.ok(c.hex, `swatch for ${c.id}`));
  assert.equal(L.swatchFor("Ultra Violet Haze"), null, "unknown → null, not a wrong guess");
});
t("filters: Mint → 1; Shiva AND Black → subset of Shiva; OR within row", ()=>{
  assert.equal(L.applyFilters(products,{color:["Mint"]}).length, 1);
  const shiva = L.applyFilters(products,{deity:["shiva"]});
  const shivaBlack = L.applyFilters(products,{deity:["shiva"], color:["Black"]});
  assert.ok(shivaBlack.length>0 && shivaBlack.length<=shiva.length && shivaBlack.every(p=>shiva.includes(p)));
  assert.equal(L.applyFilters(products,{deity:["hanuman","krishna"]}).length, 4);
  assert.equal(L.anyFilterActive({deity:[],type:[],color:[]}), false);
  assert.equal(L.anyFilterActive({deity:["shiva"]}), true);
});
t("sort: price-asc puts the mug first; newest puts 2026-09-06 items before 09-05", ()=>{
  assert.equal(L.sortProducts(products,"price-asc")[0].typeLabel, "Mug");
  assert.equal(L.sortProducts(products,"price-desc").at(-1).typeLabel, "Mug");
  const s = L.sortProducts(products,"newest");
  assert.equal(s.at(-1).createdAt.slice(0,10), "2026-09-05");
});
t("new-this-week: 6 days → true, 8 days → false, future → false", ()=>{
  const now = Date.parse("2026-09-12T00:00:00Z");
  assert.equal(L.isNewThisWeek("2026-09-06T10:00:00Z", now), true);
  assert.equal(L.isNewThisWeek("2026-09-03T10:00:00Z", now), false);
  assert.equal(L.isNewThisWeek("2026-09-20T10:00:00Z", now), false);
  assert.equal(L.isNewThisWeek(null, now), false);
});
t("upsell: Shiva in cart → 3 Shiva products not in cart; empty cart → newest 3", ()=>{
  const shiva = products.filter(p=>p.deity==="shiva");
  const up = L.upsellFor(products, [{handle:shiva[0].handle}], 3);
  assert.equal(up.length, 3);
  up.forEach(p=>{ assert.equal(p.deity,"shiva"); assert.notEqual(p.handle, shiva[0].handle); });
  const cold = L.upsellFor(products, [], 3);
  assert.equal(cold.length, 3);
  assert.deepEqual(cold.map(p=>p.handle), L.sortProducts(products,"newest").slice(0,3).map(p=>p.handle));
});
t("url round-trip", ()=>{
  const f = { deity:["shiva","hanuman"], type:["Tee"], color:["Navy Blue"], aisle:null, sort:"price-asc" };
  const q = L.paramsFromFilters(f);
  const back = L.filtersFromParams(new URLSearchParams(q));
  assert.deepEqual(back, f);
  assert.equal(L.paramsFromFilters({deity:[],type:[],color:[],aisle:null,sort:"newest"}), "");
  assert.equal(L.filtersFromParams(new URLSearchParams("?sort=bogus")).sort, "newest");
});
t("trust strip copy rules", ()=>{
  const all = L.TRUST.items.join(" ").toLowerCase();
  assert.ok(!/\breturns?\b/.test(all), "never says returns");
  assert.ok(all.includes("replacement") && all.includes("5–8 days") && all.includes("most pin codes"));
  assert.equal(L.whatsappUrl("hi"), "https://wa.me/919993518528?text=hi");
});
t("review gate: hidden for 4, null, NaN; shown for 5 and 12", ()=>{
  [4, null, undefined, "x", 0].forEach(v=>assert.equal(L.reviewsVisible(v), false, String(v)));
  [5, "5", 12].forEach(v=>assert.equal(L.reviewsVisible(v), true, String(v)));
});
t("rating metafield: JSON value + count string; null → no rating, count 0", ()=>{
  assert.deepEqual(L.parseRatingMetafield('{"scale_min":"1.0","scale_max":"5.0","value":"4.5"}', "7"), { rating:4.5, count:7 });
  assert.deepEqual(L.parseRatingMetafield(null, null), { rating:null, count:0 });
  assert.deepEqual(L.parseRatingMetafield("not json {", "x"), { rating:null, count:0 });
  assert.deepEqual(L.parseRatingMetafield("0.0", "0"), { rating:null, count:0 });
});
// PARSER FIXTURE — synthetic Judge.me widget markup, never rendered anywhere.
const W = `<div class='jdgm-rev-widg' data-average-rating='4.50' data-number-of-reviews='2'>
<div class='jdgm-rev jdgm-divider-top' data-review-id='11' data-verified-buyer='true' data-product-title='X'>
 <div class='jdgm-rev__header'><span class='jdgm-rev__rating' data-score='5' tabindex='0'></span>
 <span class='jdgm-rev__timestamp jdgm-spinner' data-content='2026-08-14 09:12:00 UTC'></span>
 <div class='jdgm-rev__author-wrapper'><span class='jdgm-rev__author'>Riya &amp; Co</span></div></div>
 <div class='jdgm-rev__content'><b class='jdgm-rev__title'>Print holds</b><div class='jdgm-rev__body'><p>Washed twice.<br>Still gold.</p></div></div></div>
<div class='jdgm-rev' data-review-id='12' data-verified-buyer='false'>
 <span class="jdgm-rev__rating" data-score="4"></span><span class='jdgm-rev__author'>K.</span>
 <b class='jdgm-rev__title'></b><div class='jdgm-rev__body'><p>Good fit</p></div></div>
<div class='jdgm-rev' data-review-id='13'><b class='jdgm-rev__title'></b><div class='jdgm-rev__body'></div></div>
<div class='jdgm-paginate'></div></div>`;
t("judge.me widget: summary + 2 reviews parsed, empty one dropped, entities decoded", ()=>{
  assert.deepEqual(L.parseJudgeMeSummary(W), { rating:4.5, count:2 });
  const r = L.parseJudgeMeReviews(W);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { id:"11", verified:true, rating:5, author:"Riya & Co", title:"Print holds", body:"Washed twice.\nStill gold.", date:"2026-08-14 09:12:00 UTC" });
  assert.equal(r[1].rating, 4); assert.equal(r[1].verified, false); assert.equal(r[1].title, "");
  assert.deepEqual(L.parseJudgeMeReviews(""), []); assert.deepEqual(L.parseJudgeMeReviews(null), []);
  assert.deepEqual(L.parseJudgeMeSummary("<div>"), { rating:0, count:0 });
  assert.equal(L.fmtReviewDate("2026-08-14 09:12:00 UTC"), "Aug 2026");
  assert.equal(L.fmtReviewDate("junk"), "");
});
t("founder note paragraphs + write-review url", ()=>{
  assert.deepEqual(L.founderNoteParas("  I printed this 40 times.\n\nThe gold stayed.  "), ["I printed this 40 times.","The gold stayed."]);
  assert.deepEqual(L.founderNoteParas(""), []); assert.deepEqual(L.founderNoteParas(null), []);
  assert.equal(L.writeReviewUrl("srfvqf-tj.myshopify.com","unisex-supima-t-shirt-3"), "https://srfvqf-tj.myshopify.com/products/unisex-supima-t-shirt-3#judgeme_product_reviews");
});
t("review payload: validation order, numeric product id, url", ()=>{
  const prod = { id:"gid://shopify/Product/8427682267210", handle:"unisex-supima-t-shirt-3" };
  assert.equal(L.productExternalId(prod.id), "8427682267210"); assert.equal(L.productExternalId(null), null);
  const ok = L.reviewPayload("srfvqf-tj.myshopify.com", prod, { rating:5, name:" Riya ", email:"r@x.in", title:"", body:"Washed twice, still gold." });
  assert.deepEqual(ok.fields, { shop_domain:"srfvqf-tj.myshopify.com", platform:"shopify", id:"8427682267210", url:"https://www.akara.studio/shop/unisex-supima-t-shirt-3", name:"Riya", email:"r@x.in", rating:"5", title:"", body:"Washed twice, still gold." });
  assert.ok(L.reviewPayload("s", prod, { rating:0, name:"a", email:"a@b.co", body:"long enough words" }).error);
  assert.ok(L.reviewPayload("s", prod, { rating:4, name:"", email:"a@b.co", body:"long enough words" }).error);
  assert.ok(L.reviewPayload("s", prod, { rating:4, name:"a", email:"nope", body:"long enough words" }).error);
  assert.ok(L.reviewPayload("s", prod, { rating:4, name:"a", email:"a@b.co", body:"short" }).error);
  assert.ok(L.reviewPayload("s", { id:"x", handle:"h" }, { rating:4, name:"a", email:"a@b.co", body:"long enough words" }).error);
});
console.log(`\n${passed} tests passed`);
