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

const { useEffect: piE } = React;

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
  if(!src) return null;
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
        backgroundImage: `url("${src}")`,
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
