"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImageLibraryPanel } from "@/components/ImageLibraryPanel";
import { AssetBasketPanel } from "@/components/AssetBasketPanel";
import { ActiveTradesPanel } from "@/components/ActiveTradesPanel";
import { PortfolioPanel } from "@/components/PortfolioPanel";

const heroImages = [
  { src: "/images/cat-12.webp", label: "THE ORIGINAL", no: "001" },
  { src: "/images/cat-00.webp", label: "FISHERMAN", no: "044" },
  { src: "/images/cat-07.webp", label: "DETECTIVE", no: "089" },
  { src: "/images/cat-09.webp", label: "BEACH TRADER", no: "137" },
  { src: "/images/cat-10.webp", label: "POLITICIAN", no: "201" },
  { src: "/images/cat-04.webp", label: "ANATOMY MODEL", no: "300" },
] as const;

const panelNames = ["THE FIRST STOCK CAT", "300 CATS", "WHAT HE TRADES", "ACTIVE TRADES", "HOLDER SHARE", "STILL FIRST"];

function CropMarks() {
  return <span className="cropMarks" aria-hidden="true"><i /><i /><i /><i /></span>;
}

function ArrowIcon({ back = false }: { back?: boolean }) {
  return <svg className={back ? "backArrow" : ""} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>;
}

export default function Home() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState(0);
  const [progress, setProgress] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);

  const goTo = useCallback((index: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ left: Math.max(0, Math.min(panelNames.length - 1, index)) * viewport.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest("[data-vertical-scroll]")) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      viewport.scrollLeft += Math.sign(event.deltaY) * Math.min(Math.abs(event.deltaY) * 1.15, viewport.clientWidth * 0.82);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") { event.preventDefault(); goTo(panel + 1); }
      if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); goTo(panel - 1); }
      if (event.key === "Home") goTo(0);
      if (event.key === "End") goTo(panelNames.length - 1);
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => { viewport.removeEventListener("wheel", onWheel); window.removeEventListener("keydown", onKey); };
  }, [goTo, panel]);

  useEffect(() => {
    const id = window.setInterval(() => setHeroIndex((value) => (value + 1) % heroImages.length), 2400);
    return () => window.clearInterval(id);
  }, []);

  function onHorizontalScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const max = viewport.scrollWidth - viewport.clientWidth;
    setProgress(max > 0 ? viewport.scrollLeft / max : 0);
    setPanel(Math.round(viewport.scrollLeft / viewport.clientWidth));
  }

  const panelClass = (index: number, extra: string) => `panel ${extra} ${panel === index ? "isCurrent" : ""}`;
  const hero = heroImages[heroIndex];

  return (
    <main className="experience">
      <div className="grain" aria-hidden="true" />
      <div className="progress"><i style={{ transform: `scaleX(${progress})` }} /></div>

      <button className="floatingLogo" onClick={() => goTo(0)} aria-label="Stockcat home">
        <Image src="/brand/stockcat-mark.png" alt="" width={52} height={52} priority />
        <span><b>STOCKCAT</b><small>THE FIRST STOCK CAT</small></span>
      </button>

      <div className="horizontalViewport" ref={viewportRef} onScroll={onHorizontalScroll} tabIndex={0} aria-label="Horizontal Stockcat experience">
        <div className="horizontalTrack">
          <section className={panelClass(0, "hero")} id="top">
            <div className="heroFilm" aria-hidden="true">
              {heroImages.map((item, index) => <div key={item.src} className={`filmFrame f${index}`}><Image src={item.src} alt="" fill loading="eager" sizes="18vw" /></div>)}
            </div>
            <div className="heroCopy panelReveal">
              <p className="eyebrow"><span>THE ORIGINAL</span><span>1 CAT · 300 LIVES</span></p>
              <h1><span className="lineMask"><b>THE FIRST</b></span><span className="lineMask accent"><b>STOCK</b></span><span className="lineMask"><b>CAT.</b></span></h1>
              <p className="heroSub">A cat that trades Stock Tokens<br />and shares the profit with holders.</p>
              <div className="heroActions">
                <button className="button primary" onClick={() => goTo(1)}>SEE 300 CATS <ArrowIcon /></button>
                <button className="button status" onClick={() => goTo(4)}>CHECK THE BOOKS <ArrowIcon /></button>
              </div>
              <p className="micro">$STOCKCAT · CAT TRADES · HOLDERS SHARE · PRE-LAUNCH</p>
            </div>

            <div className="searchScene panelReveal" aria-label="Stockcat archive preview">
              <div className="searchBar"><span className="searchIcon" /><span>the first cat that trades and shares profits</span><b>×</b></div>
              <div className="resultShadow shadowOne" /><div className="resultShadow shadowTwo" />
              <div className="resultWindow">
                <div className="windowTop"><span>STOCKCAT ARCHIVE</span><span>300 IMAGES</span><span className="windowDots">● ● ●</span></div>
                <div className="heroImage">
                  <Image key={hero.src} src={hero.src} alt={`Stockcat as ${hero.label.toLowerCase()}`} fill priority sizes="(max-width: 900px) 94vw, 48vw" />
                  <CropMarks /><span className="scanLine" /><span className="watermark w1">STOCKCAT</span><span className="resultTag">{hero.no} / 300</span>
                </div>
                <div className="thumbRail">
                  {heroImages.slice(0, 3).map((item, index) => <button className={heroIndex === index ? "activeThumb" : ""} key={item.src} onClick={() => setHeroIndex(index)}><Image src={item.src} alt={item.label} fill sizes="120px" /><span>{item.no}</span></button>)}
                </div>
              </div>
              <div className="floatingLabel labelA">THE CAT TRADES<br /><b>THE VAULT IS PUBLIC</b></div>
              <div className="floatingLabel labelB">HOLDERS SHARE<br /><b>BY TOKEN OWNERSHIP</b></div>
            </div>
            <button className="edgePrompt" onClick={() => goTo(1)}>MEET ALL 300 <ArrowIcon /></button>
            <div className="heroTicker"><div>THE FIRST STOCK CAT ✦ CAT TRADES ✦ HOLDERS SHARE ✦ STILL THE FIRST ✦ THE FIRST STOCK CAT ✦ CAT TRADES ✦ HOLDERS SHARE ✦ STILL THE FIRST ✦</div></div>
          </section>

          <section className={panelClass(1, "library")} id="library"><ImageLibraryPanel /></section>
          <section className={panelClass(2, "basket")} id="basket"><AssetBasketPanel /></section>
          <section className={panelClass(3, "trades")} id="trades"><ActiveTradesPanel /></section>
          <section className={panelClass(4, "portfolio")} id="portfolio"><PortfolioPanel /></section>

          <section className={panelClass(5, "finale")}>
            <div className="finalImage"><Image src="/images/cat-00.webp" alt="Stockcat at work" fill loading="eager" sizes="100vw" /><span className="giantWatermark">STOCKCAT</span><span className="finalScan" /></div>
            <div className="finalCopy panelReveal"><span className="sectionIndex light">THE ORIGINAL STOCK CAT</span><h2>CAT TRADES.<br />HOLDERS SHARE.</h2><p>Three words: still the first Stockcat.</p><button onClick={() => goTo(4)} className="button finaleButton">CHECK YOUR SHARE <ArrowIcon /></button></div>
            <footer><div>STOCKCAT · THE FIRST STOCK CAT.</div><a href="https://www.shutterstock.com/g/Iryna+Kuznetsova?sort=popular" target="_blank" rel="noreferrer">IMAGE SOURCE ↗</a></footer>
          </section>
        </div>
      </div>

      <div className="railControls" aria-label="Panel navigation">
        <button onClick={() => goTo(panel - 1)} disabled={panel === 0} aria-label="Previous panel"><ArrowIcon back /></button>
        <div><span>0{panel + 1}</span><i /><span>0{panelNames.length}</span></div>
        <button onClick={() => goTo(panel + 1)} disabled={panel === panelNames.length - 1} aria-label="Next panel"><ArrowIcon /></button>
      </div>
      <div className="orientationHint">WHEEL / SWIPE <span>→</span></div>
    </main>
  );
}
