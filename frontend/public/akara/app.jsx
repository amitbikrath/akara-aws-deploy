// App — scroll progress + tweaks + assembly

const { useState: apS, useEffect: apE, useRef: apR } = React;

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "particles": 16,
  "motion": 1,
  "accent": "#C5A059",
  "showChrome": true,
  "heroMuted": true,
  "density": "balanced"
}/*EDITMODE-END*/;

function ScrollRail(){
  const fill = apR(null);
  useScrollBus(()=>{
    if(!fill.current) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max>0 ? window.scrollY / max : 0;
    fill.current.style.height = `${Math.max(0, Math.min(1, p))*100}%`;
  });
  return (
    <div className="scroll-rail" aria-hidden>
      <div className="fill" ref={fill} style={{ height:"0%" }}/>
    </div>
  );
}

function Cursor(){
  const ref = apR(null);
  const ringRef = apR(null);
  apE(()=>{
    if (window.matchMedia("(pointer:coarse)").matches) return;
    let tx=0, ty=0, cx=0, cy=0;
    const onMove = (e)=>{ tx = e.clientX; ty = e.clientY;
      if(ref.current){ ref.current.style.transform = `translate3d(${tx}px, ${ty}px, 0)`; }
    };
    window.addEventListener("mousemove", onMove);
    let raf;
    const tick = ()=>{
      cx += (tx-cx)*0.18; cy += (ty-cy)*0.18;
      if(ringRef.current) ringRef.current.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return ()=>{ window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  },[]);
  return (
    <React.Fragment>
      <div ref={ringRef} style={{
        position:"fixed", top:-16, left:-16, width:32, height:32, borderRadius:"50%",
        border:"1px solid rgba(197,160,89,.5)", pointerEvents:"none", zIndex:1000,
        mixBlendMode:"difference",
      }}/>
      <div ref={ref} style={{
        position:"fixed", top:-3, left:-3, width:6, height:6, borderRadius:"50%",
        background:"var(--gold)", pointerEvents:"none", zIndex:1000,
        boxShadow:"0 0 10px rgba(197,160,89,.8)",
      }}/>
    </React.Fragment>
  );
}

function App(){
  const [v, setT] = useTweaks(DEFAULTS);
  const [galleryOpen, setGalleryOpen] = apS(false);
  const [portalOrigin, setPortalOrigin] = apS({ x: 0, y: 0 });
  const [openItemId, setOpenItemId] = apS(null);
  // /shop is a dedicated page: decide it from the URL before first paint so the
  // home site never flashes underneath (and never renders behind it).
  const shopFromUrl = ()=>/^\/shop(\/|$)/.test(window.location.pathname) || window.location.hash === "#shop";
  const [shopOpen, setShopOpen] = apS(shopFromUrl);
  const [shopAisle, setShopAisle] = apS(()=>{ try{ return new URLSearchParams(window.location.search).get("aisle") || null; }catch(e){ return null; } });
  const [socialsOpen, setSocialsOpen] = apS(false);

  apE(()=>{ document.documentElement.style.setProperty("--accent", v.accent); }, [v.accent]);
  apE(()=>{ document.documentElement.classList.add("js-anim"); return ()=>document.documentElement.classList.remove("js-anim"); }, []);

  // Expose openers so WallpapersSection button can trigger the portal
  apE(()=>{
    window.__openGallery = (origin, opts)=>{
      setPortalOrigin(origin || { x: window.innerWidth/2, y: window.innerHeight/2 });
      setOpenItemId((opts && opts.openItemId) || null);
      setGalleryOpen(true);
    };
    window.__closeGallery = ()=> setGalleryOpen(false);
    window.__openShop = (opts)=>{
      setShopAisle((opts && opts.aisle) || null);
      setShopOpen(true);
      if(window.location.pathname !== "/shop") history.pushState({ akShop:true }, "", "/shop" + ((opts && opts.aisle) ? `?aisle=${opts.aisle}` : ""));
    };
    window.__closeShop = ()=> setShopOpen(false);
    window.__openSocials = ()=> setSocialsOpen(true);
    window.__closeSocials = ()=> setSocialsOpen(false);
    return ()=>{
      delete window.__openGallery; delete window.__closeGallery;
      delete window.__openShop; delete window.__closeShop;
      delete window.__openSocials; delete window.__closeSocials;
    };
  },[]);

  // Hash-based entry (direct link support)
  apE(()=>{
    const onHash = ()=>{
      if(window.location.hash === "#gallery") {
        setPortalOrigin({ x: window.innerWidth/2, y: window.innerHeight/2 });
        setGalleryOpen(true);
      }
      if(window.location.hash === "#shop") setShopOpen(true);
      if(/^\/shop(\/|$)/.test(window.location.pathname)){
        const a = new URLSearchParams(window.location.search).get("aisle");
        setShopAisle(a || null);
        setShopOpen(true);
      }
      if(window.location.hash === "#socials-page") setSocialsOpen(true);
    };
    // Browser back from /shop closes the shop.
    const onPop = ()=>{ if(!/^\/shop(\/|$)/.test(window.location.pathname)) setShopOpen(false); else onHash(); };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onPop);
    onHash();
    return ()=>{ window.removeEventListener("hashchange", onHash); window.removeEventListener("popstate", onPop); };
  },[]);

  if(shopOpen){
    return (
      <ShopPage initialAisle={shopAisle} onClose={()=>{
        setShopOpen(false);
        if(window.location.hash === "#shop") history.replaceState(null, "", window.location.pathname);
        if(/^\/shop(\/|$)/.test(window.location.pathname)) history.replaceState(null, "", "/");
      }}/>
    );
  }

  return (
    <React.Fragment>
      {v.showChrome !== false && <Cursor/>}
      {v.showChrome !== false && <ScrollRail/>}
      <TopNav/>
      <main>
        <Hero tweaks={{ particles: v.particles ?? 16 }}/>
        <WallpapersSection tweaks={v}/>
        <ShopSection tweaks={v}/>
        <MusicSection/>
        <StorySection/>
        <SocialsStrip/>
      </main>
      <Footer/>

      <GalleryPortal open={galleryOpen} origin={portalOrigin} onDone={()=>{}}/>
      {galleryOpen && <GalleryPage openItemId={openItemId} onClose={()=>{
        setGalleryOpen(false);
        setOpenItemId(null);
        if(window.location.hash === "#gallery") history.replaceState(null, "", window.location.pathname);
      }}/>}

      {socialsOpen && <SocialsPage onClose={()=>{
        setSocialsOpen(false);
        if(window.location.hash === "#socials-page") history.replaceState(null, "", window.location.pathname);
      }}/>}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Motion">
          <TweakSlider label="Particles" value={v.particles} min={0} max={40} step={1} onChange={(x)=>setT("particles",x)}/>
          <TweakToggle label="Show chrome" value={v.showChrome!==false} onChange={(x)=>setT("showChrome",x)}/>
          <TweakToggle label="Hero muted" value={v.heroMuted!==false} onChange={(x)=>setT("heroMuted",x)}/>
        </TweakSection>
        <TweakSection label="Palette">
          <TweakColor label="Accent" value={v.accent} onChange={(x)=>setT("accent",x)}/>
        </TweakSection>
        <TweakSection label="Density">
          <TweakRadio value={v.density} options={[
            { label:"Airy", value:"airy" },
            { label:"Balanced", value:"balanced" },
            { label:"Dense", value:"dense" },
          ]} onChange={(x)=>setT("density",x)}/>
        </TweakSection>
      </TweaksPanel>
    </React.Fragment>
  );
}

// Guard for routes that load this layout without a #root mount point
// (e.g. /auth/callback). Avoids a console error there.
const _akRootEl = document.getElementById("root");
// The shell ships a boot veil inside #root (src/app/page.tsx). Our first render
// clears #root, so re-draw the veil on top and fade it out: a crossfade, not a cut.
function AkBootVeil({ html }){
  const [gone, setGone] = apS(false);
  const ref = apR(null);
  apE(()=>{
    let r2 = 0;
    const r1 = requestAnimationFrame(()=>{ r2 = requestAnimationFrame(()=>{
      if (ref.current) ref.current.classList.add("is-leaving");
    }); });
    const t = setTimeout(()=> setGone(true), 1500);
    return ()=>{ cancelAnimationFrame(r1); cancelAnimationFrame(r2); clearTimeout(t); };
  },[]);
  if (gone) return null;
  return <div ref={ref} className="ak-boot is-static" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }}/>;
}

if (_akRootEl) {
  const _akBoot = _akRootEl.querySelector(".ak-boot");
  const _akBootHtml = _akBoot ? _akBoot.innerHTML : null;
  let _akMount = _akRootEl;
  let _akRoot = ReactDOM.createRoot(_akMount);
  _akRoot.render(<React.Fragment><App/>{_akBootHtml && <AkBootVeil html={_akBootHtml}/>}</React.Fragment>);
  // Watchdog: on deep links like /shop the Next.js shell can fail hydration and
  // client-render a fresh, empty #root AFTER we rendered into the old one —
  // the visitor then sees a blank page. If our mount node is detached or
  // emptied, remount into a node the shell never owns.
  let _akTicks = 0;
  const _akWatch = setInterval(()=>{
    _akTicks++;
    const lost = !_akMount.isConnected || _akMount.childElementCount === 0;
    if(lost){
      try{ _akRoot.unmount(); }catch(e){}
      _akMount = document.createElement("div");
      _akMount.id = "ak-root";
      document.body.appendChild(_akMount);
      _akRoot = ReactDOM.createRoot(_akMount);
      _akRoot.render(<App/>);
    }
    if(_akTicks >= 40) clearInterval(_akWatch); // stop after ~10s
  }, 250);
}
