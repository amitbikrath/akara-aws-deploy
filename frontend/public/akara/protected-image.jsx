// protected-image.jsx — shared component to deter casual image downloads.
//
// Strategy:
//  1. Render the image as a <div> with background-image (no <img> tag), so the
//     browser context menu does not show "Save image as".
//  2. Block oncontextmenu + ondragstart at the element AND at the document
//     (capture phase) so even a stray native <img> elsewhere is covered.
//  3. user-select:none + -webkit-touch-callout:none to suppress the iOS
//     long-press "Save Image" sheet.
//  4. Optional diagonal watermark layer for high-value surfaces (gallery,
//     wallpapers, lightbox).
//
// This is friction, not DRM — anyone with devtools or a screenshot can still
// capture pixels. Phase 3 (signed-cookie-gated full-res) is what locks the
// originals away from non-members.

const { useEffect: piE, useState: piS } = React;

// Members get /content/originals/* (gated by CloudFront signed cookies).
// Without the cookies CloudFront answers 403 → index.html (200 text/html), so
// a plain background-image just stays blank. Rule from the owner: a signed-in
// member never sees a watermarked picture — show a shimmer until the clean
// one has loaded. Flow: wait for the shared grant (akEnsureGrant), probe
// src then fallbackSrc, on failure force one re-grant and retry with ?r=,
// and retry again whenever auth.jsx fires "akara:image-access".
function _piIsGated(src){ return /\/content\/originals\//.test(src || ""); }
function _piLoad(u){
  return new Promise((res) => { const im = new Image(); im.onload = () => res(true); im.onerror = () => res(false); im.src = u; });
}
function _piBust(u){ return `${u}${u.includes("?") ? "&" : "?"}r=${Date.now()}`; }
function _piUseGatedSrc(src, fallbackSrc){
  const gated = _piIsGated(src);
  const [shown, setShown] = piS(gated ? null : src);
  piE(() => {
    if (!gated) { setShown(src); return; }
    let alive = true, done = false, busy = false;
    setShown(null);
    const cands = [src, fallbackSrc].filter(Boolean);
    const tryAll = async (bust) => {
      for (const u of cands) {
        const url = bust ? _piBust(u) : u;
        if (!alive) return true;
        if (await _piLoad(url)) { if (alive) { done = true; setShown(url); } return true; }
      }
      return false;
    };
    const run = async () => {
      if (done || busy) return;
      busy = true;
      try {
        try { if (typeof akEnsureGrant === "function") await akEnsureGrant(); } catch {}
        if (await tryAll(false)) return;
        try { if (typeof akEnsureGrant === "function") await akEnsureGrant(true); } catch {}
        await tryAll(true);
      } finally { busy = false; }
    };
    run();
    window.addEventListener("akara:image-access", run);
    return () => { alive = false; window.removeEventListener("akara:image-access", run); };
  }, [src, fallbackSrc]);
  return shown;
}

// Shimmer shown while a member's clean picture loads. Sits over the tile's
// own gradient; slow sweep, still under prefers-reduced-motion.
function _piInstallShimmerCss(){
  if (typeof document === "undefined" || document.getElementById("ak-pi-shimmer-css")) return;
  const st = document.createElement("style");
  st.id = "ak-pi-shimmer-css";
  st.textContent = `
.ak-pi-wait{position:absolute;inset:0;overflow:hidden;pointer-events:none;background:rgba(5,5,6,.35)}
.ak-pi-wait::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
  background:linear-gradient(100deg,transparent 30%,rgba(197,160,89,.10) 50%,transparent 70%);
  animation:akPiSweep 1.6s cubic-bezier(.45,0,.25,1) infinite}
@keyframes akPiSweep{to{transform:translateX(100%)}}
@media (prefers-reduced-motion: reduce){.ak-pi-wait::after{animation:none;transform:none;opacity:.5}}`;
  document.head.appendChild(st);
}
_piInstallShimmerCss();

function _piBlock(e){
  e.preventDefault();
  if (e.stopPropagation) e.stopPropagation();
  return false;
}

// ProtectedImage — drop-in replacement for absolutely-positioned <img>.
// Pass `style` to override (parent must establish a positioned context, same
// as the original <img> usage).
function ProtectedImage({
  src,
  fallbackSrc,              // tried if src fails (gated originals only)
  alt = "",
  className,
  style,
  fit = "cover",            // "cover" | "contain"
  position = "center",      // background-position
  watermark = false,        // diagonal AKARA mark; opt-in per surface
  watermarkText = "AKARA  ·  akara.studio",
  watermarkOpacity = 0.18,
  children,
}){
  const shown = _piUseGatedSrc(src, fallbackSrc);
  if(!src) return null;
  if(!shown) return <div className="ak-pi-wait" aria-busy="true" aria-label={alt}>{children}</div>;
  const cls = "ak-protected-img" + (className ? " " + className : "");
  return (
    <div
      role="img"
      aria-label={alt}
      className={cls}
      onContextMenu={_piBlock}
      onDragStart={_piBlock}
      draggable={false}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        backgroundImage: `url("${shown}")`,
        backgroundSize: fit,
        backgroundPosition: position,
        backgroundRepeat: "no-repeat",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        ...(style || {}),
      }}
    >
      {watermark && (
        <div
          aria-hidden="true"
          className="ak-protected-wm"
          style={{
            position: "absolute",
            inset: "-20%",
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "rotate(-26deg)",
            overflow: "hidden",
          }}
        >
          <div style={{
            color: `rgba(245,241,234,${watermarkOpacity})`,
            fontFamily: "var(--mono, ui-monospace, monospace)",
            fontSize: "clamp(10px, 1.3vw, 13px)",
            letterSpacing: ".34em",
            textTransform: "uppercase",
            fontWeight: 500,
            whiteSpace: "nowrap",
            textShadow: "0 1px 2px rgba(0,0,0,.35)",
            mixBlendMode: "overlay",
          }}>
            {`${watermarkText}    ·    ${watermarkText}    ·    ${watermarkText}    ·    ${watermarkText}`}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

// Global capture-phase hardening — runs once on load. Catches:
//  - any <img> that sneaks into the DOM (third-party widgets, future code)
//  - the protected divs themselves (defensive; per-element handler also exists)
function _akInstallImageProtection(){
  if (typeof window === "undefined") return;
  if (window.__akImageProtectionInstalled) return;
  window.__akImageProtectionInstalled = true;
  const block = (e) => {
    const t = e.target;
    if (!t) return;
    const tag = t.tagName;
    if (tag === "IMG" || tag === "PICTURE" ||
        (t.closest && t.closest(".ak-protected-img"))) {
      e.preventDefault();
    }
  };
  document.addEventListener("contextmenu", block, true);
  document.addEventListener("dragstart", block, true);
  // Best-effort: also disable selection-drag on artwork surfaces.
  document.addEventListener("selectstart", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest(".ak-protected-img")) e.preventDefault();
  }, true);
}

if (typeof window !== "undefined") {
  _akInstallImageProtection();
  Object.assign(window, { ProtectedImage });
}
