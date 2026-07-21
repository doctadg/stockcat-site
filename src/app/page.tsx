"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageLibraryPanel } from "@/components/ImageLibraryPanel";
import { AssetBasketPanel } from "@/components/AssetBasketPanel";
import { PortfolioPanel } from "@/components/PortfolioPanel";

const jobs = [
  { id: "fisherman", label: "FISHERMAN", query: "cat fisherman commercial stock photo", image: "/images/cat-00.webp", no: "001", note: "Maritime experience. Zero fish delivered." },
  { id: "model", label: "ANATOMY MODEL", query: "cat anatomy renaissance stock image", image: "/images/cat-04.webp", no: "044", note: "Classically proportioned. Mostly round." },
  { id: "detective", label: "DETECTIVE", query: "cat detective looking for alpha", image: "/images/cat-07.webp", no: "089", note: "Found the missing liquidity. Said nothing." },
  { id: "vacation", label: "VACATION CAT", query: "cat on beach holding ice cream", image: "/images/cat-09.webp", no: "137", note: "Out of office. Still booked." },
  { id: "politician", label: "POLITICIAN", query: "cat election campaign stock photo", image: "/images/cat-10.webp", no: "201", note: "Running on a pro-nap platform." },
  { id: "king", label: "ROYALTY", query: "cat king crown throne isolated", image: "/images/cat-12.webp", no: "313", note: "Royalty-free? He heard royalty." },
] as const;

const panelNames = ["THE CAT", "THE LORE", "THE CATALOG", "IMAGE LIBRARY", "STOCK SHELF", "WALLET X-RAY", "CASTING", "THE LISTING", "CLOCK OUT"];

function CropMarks() {
  return <span className="cropMarks" aria-hidden="true"><i /><i /><i /><i /></span>;
}

function ArrowIcon({ back = false }: { back?: boolean }) {
  return <svg className={back ? "backArrow" : ""} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>;
}

export default function Home() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(5);
  const [queryIndex, setQueryIndex] = useState(5);
  const [hires, setHires] = useState(0);
  const [toast, setToast] = useState("");
  const [flash, setFlash] = useState(false);
  const [burst, setBurst] = useState(0);
  const [panel, setPanel] = useState(0);
  const [progress, setProgress] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const activeJob = jobs[active];
  const featured = useMemo(() => [jobs[5], jobs[0], jobs[3]], []);

  const goTo = useCallback((index: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const target = Math.max(0, Math.min(panelNames.length - 1, index));
    viewport.scrollTo({ left: target * viewport.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      const distance = Math.sign(event.deltaY) * Math.min(Math.abs(event.deltaY) * 1.15, viewport.clientWidth * 0.82);
      viewport.scrollLeft += distance;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") { event.preventDefault(); goTo(panel + 1); }
      if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); goTo(panel - 1); }
      if (event.key === "Home") { event.preventDefault(); goTo(0); }
      if (event.key === "End") { event.preventDefault(); goTo(panelNames.length - 1); }
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      viewport.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [goTo, panel]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setQueryIndex((n) => (n + 1) % jobs.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, []);

  function onHorizontalScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const max = viewport.scrollWidth - viewport.clientWidth;
    const ratio = max > 0 ? viewport.scrollLeft / max : 0;
    setProgress(ratio);
    setPanel(Math.round(viewport.scrollLeft / viewport.clientWidth));
  }

  function triggerFlash(message?: string) {
    setFlash(false);
    window.requestAnimationFrame(() => setFlash(true));
    window.setTimeout(() => setFlash(false), 420);
    if (message) {
      setToast(message);
      window.setTimeout(() => setToast(""), 2200);
    }
  }

  function selectJob(index: number) {
    setActive(index);
    setQueryIndex(index);
    triggerFlash();
  }

  function hireCat() {
    const next = (active + 1) % jobs.length;
    setActive(next);
    setQueryIndex(next);
    setHires((n) => n + 1);
    setBurst((n) => n + 1);
    triggerFlash("BOOKING CONFIRMED — CAT DID NOT READ THE BRIEF");
  }

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -8;
    setTilt({ x: y, y: x });
  }

  const panelClass = (index: number, extra = "") => `panel ${extra} ${panel === index ? "isCurrent" : ""}`;

  return (
    <main className="experience">
      <div className="grain" aria-hidden="true" />
      <div className={`cameraFlash ${flash ? "isFlashing" : ""}`} aria-hidden="true" />
      <div className="progress"><i style={{ transform: `scaleX(${progress})` }} /></div>

      <nav className={`nav ${panel > 0 ? "scrolled" : ""}`}>
        <button className="brand" onClick={() => goTo(0)} aria-label="Stockcat home"><span className="brandBox">SC</span><span>STOCKCAT</span></button>
        <div className="navCenter"><span className="liveDot" /> {panelNames[panel]} <span className="navFraction">0{panel + 1} / 0{panelNames.length}</span></div>
        <button className="navCta" onClick={() => goTo(5)}>CHECK WALLET <ArrowIcon /></button>
      </nav>

      <div className="horizontalViewport" ref={viewportRef} onScroll={onHorizontalScroll} tabIndex={0} aria-label="Horizontal Stockcat experience">
        <div className="horizontalTrack">
          <section className={panelClass(0, "hero")} id="top">
            <div className="heroFilm" aria-hidden="true">
              {jobs.map((job, i) => <div key={job.id} className={`filmFrame f${i}`}><Image src={job.image} alt="" fill loading="eager" sizes="18vw" /></div>)}
            </div>
            <div className="heroCopy panelReveal">
              <p className="eyebrow"><span>313 SEARCH RESULTS</span><span>1 EMPLOYEE</span></p>
              <h1><span className="lineMask"><b>THE CAT IS</b></span><span className="lineMask accent"><b>ALWAYS</b></span><span className="lineMask"><b>IN STOCK.</b></span></h1>
              <p className="heroSub">The most employed cat on the internet.<br />Now dangerously underqualified for crypto.</p>
              <div className="heroActions">
                <button className="button primary magnetic" onClick={() => goTo(2)}>BROWSE THE CAT <ArrowIcon /></button>
                <button className="button status" onClick={() => triggerFlash("CA NOT ISSUED — NO FAKE CONTRACTS HERE")}>CA: NOT ISSUED <span>PRE-LAUNCH</span></button>
              </div>
              <p className="micro">$STOCKCAT · ONE CAT · EVERY JOB · FULL-TIME</p>
            </div>

            <div className="searchScene panelReveal" aria-label="Stockcat image search collage">
              <div className="searchBar"><span className="searchIcon" /><span key={queryIndex}>{jobs[queryIndex].query}</span><b>×</b></div>
              <div className="resultShadow shadowOne" /><div className="resultShadow shadowTwo" />
              <div className="resultWindow">
                <div className="windowTop"><span>IMAGE RESULTS</span><span>SAFESEARCH: OFF</span><span className="windowDots">● ● ●</span></div>
                <div className="heroImage">
                  <Image key={jobs[queryIndex].image} src={jobs[queryIndex].image} alt={`The Stockcat as ${jobs[queryIndex].label.toLowerCase()}`} fill priority sizes="(max-width: 900px) 94vw, 48vw" />
                  <CropMarks />
                  <span className="scanLine" />
                  <span className="watermark w1">STOCKCAT</span><span className="watermark w2">STOCKCAT</span>
                  <span className="resultTag">RESULT {jobs[queryIndex].no} / 313</span>
                </div>
                <div className="thumbRail">
                  {featured.map((job) => <button className={activeJob.id === job.id ? "activeThumb" : ""} key={job.id} onClick={() => selectJob(jobs.indexOf(job))}><Image src={job.image} alt={job.label} fill sizes="120px" /><span>{job.no}</span></button>)}
                </div>
              </div>
              <div className="floatingLabel labelA">COMMERCIAL USE<br /><b>QUESTIONABLE</b></div>
              <div className="floatingLabel labelB">MODEL RELEASE<br /><b>HE SIGNED WITH A PAW</b></div>
            </div>
            <button className="edgePrompt" onClick={() => goTo(1)}>SCROLL SIDEWAYS <ArrowIcon /></button>
            <div className="heroTicker"><div>CEO ✦ FISHERMAN ✦ HACKER ✦ DETECTIVE ✦ KING ✦ BEACH MODEL ✦ STILL JUST A CAT ✦ CEO ✦ FISHERMAN ✦ HACKER ✦ DETECTIVE ✦ KING ✦ BEACH MODEL ✦ STILL JUST A CAT ✦</div></div>
          </section>

          <section className={panelClass(1, "manifesto")}>
            <div className="sectionIndex">01 / THE LORE</div>
            <div className="manifestoCopy panelReveal">
              <p className="manifestoLead">Before AI could generate<br />a cat doing every job,</p>
              <p className="manifestoPunch">HE ALREADY<br /><em>DID THEM.</em></p>
              <div className="manifestoAside"><b>FUNT — PROFESSIONAL CAT</b><p>One round tabby. Hundreds of staged photos. Whatever the client paid for.</p></div>
            </div>
            <div className="proofStack panelReveal">
              {[jobs[0], jobs[2], jobs[5]].map((job, i) => <figure key={job.id} className={`proofPhoto p${i}`}><div><Image src={job.image} alt={job.label} fill sizes="32vw" /><CropMarks /></div><figcaption><span>SC-{job.no}</span><b>{job.label}</b></figcaption></figure>)}
              <span className="proofStamp">EMPLOYEE<br />OF EVERY<br />MONTH</span>
            </div>
            <span className="manifestoNumber">313</span>
          </section>

          <section className={panelClass(2, "catalog")} id="catalog">
            <div className="catalogHead panelReveal"><div><span className="sectionIndex">02 / SEARCH RESULTS</span><h2>ONE CAT. <em>EVERY JOB.</em></h2></div><p>Click a profession. It changes nothing.<br />He is underqualified for all of them.</p></div>
            <div className="filterRow panelReveal"><button className="active">ALL 313</button>{jobs.map((job, i) => <button className={active === i ? "selected" : ""} key={job.id} onClick={() => selectJob(i)}>{job.label}</button>)}</div>
            <div className="catalogGrid panelReveal">
              {jobs.map((job, i) => (
                <article className={`stockCard ${active === i ? "isActive" : ""}`} key={job.id} onClick={() => selectJob(i)}>
                  <div className="cardImage"><Image src={job.image} alt={`Stockcat as ${job.label.toLowerCase()}`} fill loading="eager" sizes="(max-width: 700px) 45vw, 16vw" /><span className="cardNo">SC-{job.no}</span>{active === i && <span className="selectedStamp">SELECTED</span>}<span className="cardScan" /></div>
                  <div className="cardMeta"><div><b>{job.label}</b><span>{job.query}</span></div><button aria-label={`Select ${job.label}`}>↗</button></div>
                </article>
              ))}
            </div>
          </section>

          <section className={panelClass(3, "library")} id="library">
            <ImageLibraryPanel />
          </section>

          <section className={panelClass(4, "basket")} id="basket">
            <AssetBasketPanel />
          </section>

          <section className={panelClass(5, "portfolio")} id="portfolio">
            <PortfolioPanel />
          </section>

          <section className={panelClass(6, "casting")}>
            <div className="castingCopy panelReveal">
              <span className="sectionIndex light">06 / CASTING DESK</span>
              <h2>GIVE HIM<br /><em>ANOTHER</em> JOB.</h2>
              <p>Press the button. Create zero jobs.<br />Give all of them to the same cat.</p>
              <button className="hireButton" onClick={hireCat}>HIRE THE CAT <span>+</span></button>
              <div className="hireCount"><span>{String(hires).padStart(3, "0")}</span><p>NEW ROLES BOOKED<br />THIS SESSION</p></div>
            </div>
            <div className="castingStage panelReveal" ref={stageRef} onPointerMove={handleMove} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
              <div className="blueprint"><span>CASTING CARD</span><span>SUBJECT: FUNT</span><span>AVAILABILITY: ALWAYS</span></div>
              <div className="talentCard" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) rotate(-2deg)` }}>
                <div className="talentImage"><Image key={activeJob.image} src={activeJob.image} alt={activeJob.label} fill loading="eager" sizes="(max-width: 800px) 70vw, 32vw" /><CropMarks /><span className="scanLine" /></div>
                <div className="talentInfo"><div><span>CAST AS</span><b>{activeJob.label}</b></div><strong>{activeJob.no}</strong></div>
                <p>{activeJob.note}</p>
              </div>
              <span className="approved">APPROVED<br />WITHOUT<br />AUDITION</span>
              <div key={burst} className={burst ? "bookingBurst active" : "bookingBurst"} aria-hidden="true">{Array.from({ length: 12 }).map((_, i) => <i key={i} />)}</div>
            </div>
          </section>

          <section className={panelClass(7, "listing")}>
            <div className="listingTop panelReveal"><span className="sectionIndex">07 / THE LISTING</span><span>THIS IS NOT FINANCIAL ADVICE. IT IS A CAT.</span></div>
            <div className="listingTitle panelReveal"><h2>THE WORLD’S<br />FIRST <em>STOCK</em> CAT.</h2><div className="tickerCard"><span>TICKER</span><b>$STOCKCAT</b><small>STATUS · NOT YET TRADING</small><i /></div></div>
            <div className="facts panelReveal">
              <div><span>01</span><b>THE PLAN</b><p>A future executor can route configured fees into allowlisted Stock Tokens.</p></div>
              <div><span>02</span><b>THE VAULT</b><p>Not deployed yet. When enabled, balances stay public on Robinhood Chain.</p></div>
              <div><span>03</span><b>ATTRIBUTION</b><p>One-block wallet balance ÷ eligible supply × allowlisted vault assets.</p></div>
            </div>
            <div className="listingTape">NOT A SECURITY · BARELY AN EMPLOYEE · NOT A SECURITY · BARELY AN EMPLOYEE ·</div>
          </section>

          <section className={panelClass(8, "finale")}>
            <div className="finalImage"><Image src="/images/cat-00.webp" alt="Stockcat working as a fisherman" fill loading="eager" sizes="100vw" /><span className="giantWatermark">STOCKCAT</span><span className="finalScan" /></div>
            <div className="finalCopy panelReveal"><span className="sectionIndex light">END OF SEARCH RESULTS</span><h2>HE’S<br />HIRED.</h2><p>Clock in before the cat gets another job.</p><button onClick={() => goTo(0)} className="button finaleButton">START AGAIN <ArrowIcon /></button></div>
            <footer><div>STOCKCAT · ONE CAT. EVERY JOB.</div><a href="https://www.shutterstock.com/g/Iryna+Kuznetsova?sort=popular" target="_blank" rel="noreferrer">SOURCE PORTFOLIO ↗</a></footer>
          </section>
        </div>
      </div>

      <div className="railControls" aria-label="Panel navigation">
        <button onClick={() => goTo(panel - 1)} disabled={panel === 0} aria-label="Previous panel"><ArrowIcon back /></button>
        <div><span>0{panel + 1}</span><i /><span>0{panelNames.length}</span></div>
        <button onClick={() => goTo(panel + 1)} disabled={panel === panelNames.length - 1} aria-label="Next panel"><ArrowIcon /></button>
      </div>
      <div className="orientationHint">WHEEL / SWIPE <span>→</span></div>
      {toast && <div className="toast" role="status"><span className="liveDot" /> {toast}</div>}
    </main>
  );
}
