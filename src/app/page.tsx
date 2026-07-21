"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

const jobs = [
  { id: "fisherman", label: "FISHERMAN", query: "cat fisherman commercial stock photo", image: "/images/cat-00.webp", no: "001", note: "Maritime experience. Zero fish delivered." },
  { id: "model", label: "ANATOMY MODEL", query: "cat anatomy renaissance stock image", image: "/images/cat-04.webp", no: "044", note: "Classically proportioned. Mostly round." },
  { id: "detective", label: "DETECTIVE", query: "cat detective looking for alpha", image: "/images/cat-07.webp", no: "089", note: "Found the missing liquidity. Said nothing." },
  { id: "vacation", label: "VACATION CAT", query: "cat on beach holding ice cream", image: "/images/cat-09.webp", no: "137", note: "Out of office. Still booked." },
  { id: "politician", label: "POLITICIAN", query: "cat election campaign stock photo", image: "/images/cat-10.webp", no: "201", note: "Running on a pro-nap platform." },
  { id: "king", label: "ROYALTY", query: "cat king crown throne isolated", image: "/images/cat-12.webp", no: "313", note: "Royalty-free? He heard royalty." },
] as const;

function CropMarks() {
  return <span className="cropMarks" aria-hidden="true"><i /><i /><i /><i /></span>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>;
}

export default function Home() {
  const [active, setActive] = useState(0);
  const [queryIndex, setQueryIndex] = useState(0);
  const [hires, setHires] = useState(0);
  const [toast, setToast] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const activeJob = jobs[active];
  const featured = useMemo(() => [jobs[5], jobs[0], jobs[3]], []);

  useEffect(() => {
    const id = window.setInterval(() => setQueryIndex((n) => (n + 1) % jobs.length), 2400);
    return () => window.clearInterval(id);
  }, []);

  function hireCat() {
    setActive((n) => (n + 1) % jobs.length);
    setHires((n) => n + 1);
    setToast("BOOKING CONFIRMED — CAT DID NOT READ THE BRIEF");
    window.setTimeout(() => setToast(""), 2200);
  }

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -8;
    setTilt({ x: y, y: x });
  }

  return (
    <main>
      <div className="progress" aria-hidden="true" />
      <nav className="nav">
        <a className="brand" href="#top" aria-label="Stockcat home"><span className="brandBox">SC</span><span>STOCKCAT</span></a>
        <div className="navCenter"><span className="liveDot" /> CAT CURRENTLY IN STOCK</div>
        <a className="navCta" href="#catalog">OPEN CATALOG <ArrowIcon /></a>
      </nav>

      <section className="hero" id="top">
        <div className="heroCopy">
          <p className="eyebrow"><span>313 SEARCH RESULTS</span><span>1 EMPLOYEE</span></p>
          <h1>THE CAT IS<br /><span>ALWAYS</span><br />IN STOCK.</h1>
          <p className="heroSub">The most employed cat on the internet.<br />Now dangerously underqualified for crypto.</p>
          <div className="heroActions">
            <a className="button primary" href="#catalog">BROWSE THE CAT <ArrowIcon /></a>
            <button className="button status" onClick={() => setToast("CA NOT ISSUED — NO FAKE CONTRACTS HERE")}>CA: NOT ISSUED <span>PRE-LAUNCH</span></button>
          </div>
          <p className="micro">$STOCKCAT · ONE CAT · EVERY JOB · NO PROMISES · FULL-TIME</p>
        </div>

        <div className="searchScene" aria-label="Stockcat image search collage">
          <div className="searchBar"><span className="searchIcon" /> <span>{jobs[queryIndex].query}</span><b>×</b></div>
          <div className="resultWindow">
            <div className="windowTop"><span>IMAGE RESULTS</span><span>SAFESEARCH: OFF</span><span className="windowDots">● ● ●</span></div>
            <div className="heroImage">
              <Image src="/images/cat-12.webp" alt="The Stockcat wearing a crown on a throne" fill priority sizes="(max-width: 900px) 94vw, 48vw" />
              <CropMarks />
              <span className="watermark w1">STOCKCAT</span><span className="watermark w2">STOCKCAT</span>
              <span className="resultTag">MOST POPULAR</span>
            </div>
            <div className="thumbRail">
              {featured.map((job) => <button key={job.id} onClick={() => setActive(jobs.indexOf(job))}><Image src={job.image} alt={job.label} fill sizes="120px" /><span>{job.no}</span></button>)}
            </div>
          </div>
          <div className="floatingLabel labelA">COMMERCIAL USE<br /><b>QUESTIONABLE</b></div>
          <div className="floatingLabel labelB">MODEL RELEASE<br /><b>HE SIGNED WITH A PAW</b></div>
        </div>
      </section>

      <div className="ticker" aria-label="Stockcat jobs"><div className="tickerTrack">{[0,1].map((loop) => <span key={loop}>CEO <i>✦</i> FISHERMAN <i>✦</i> HACKER <i>✦</i> DETECTIVE <i>✦</i> KING <i>✦</i> BEACH MODEL <i>✦</i> STILL JUST A CAT <i>✦</i> </span>)}</div></div>

      <section className="manifesto">
        <div className="sectionIndex">01 / THE LORE</div>
        <p className="manifestoLead">Before AI could generate<br />a cat doing every job,</p>
        <p className="manifestoPunch">HE ALREADY<br /><em>DID THEM.</em></p>
        <div className="manifestoAside"><b>FUNT — PROFESSIONAL CAT</b><p>One round tabby. Hundreds of staged photos. Fisherman. Detective. Monarch. Whatever the client paid for.</p><p>The internet kept finding him. So we listed him.</p></div>
      </section>

      <section className="catalog" id="catalog">
        <div className="catalogHead">
          <div><span className="sectionIndex">02 / SEARCH RESULTS</span><h2>ONE CAT.<br /><em>EVERY JOB.</em></h2></div>
          <p>Filter by profession. It changes nothing.<br />He is underqualified for all of them.</p>
        </div>
        <div className="filterRow">
          <button className="active">ALL 313</button>{jobs.map((job, i) => <button className={active === i ? "selected" : ""} key={job.id} onClick={() => setActive(i)}>{job.label}</button>)}
        </div>
        <div className="catalogGrid">
          {jobs.map((job, i) => (
            <article className={`stockCard c${i + 1} ${active === i ? "isActive" : ""}`} key={job.id} onClick={() => setActive(i)}>
              <div className="cardImage"><Image src={job.image} alt={`Stockcat as ${job.label.toLowerCase()}`} fill loading="eager" sizes="(max-width: 700px) 92vw, 32vw" /><span className="cardNo">SC-{job.no}</span>{active === i && <span className="selectedStamp">SELECTED</span>}</div>
              <div className="cardMeta"><div><b>{job.label}</b><span>{job.query}</span></div><button aria-label={`Select ${job.label}`}>↗</button></div>
            </article>
          ))}
        </div>
      </section>

      <section className="casting">
        <div className="castingCopy">
          <span className="sectionIndex light">03 / CASTING DESK</span>
          <h2>GIVE HIM<br /><em>ANOTHER</em> JOB.</h2>
          <p>Press the button. Create zero jobs.<br />Give all of them to the same cat.</p>
          <button className="hireButton" onClick={hireCat}>HIRE THE CAT <span>+</span></button>
          <div className="hireCount"><span>{String(hires).padStart(3, "0")}</span><p>NEW ROLES BOOKED<br />THIS SESSION</p></div>
        </div>
        <div className="castingStage" ref={stageRef} onPointerMove={handleMove} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
          <div className="blueprint"><span>CASTING CARD</span><span>SUBJECT: FUNT</span><span>AVAILABILITY: YES</span></div>
          <div className="talentCard" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) rotate(-2deg)` }}>
            <div className="talentImage"><Image key={activeJob.image} src={activeJob.image} alt={activeJob.label} fill loading="eager" sizes="(max-width: 800px) 88vw, 38vw" /><CropMarks /></div>
            <div className="talentInfo"><div><span>CAST AS</span><b>{activeJob.label}</b></div><strong>{activeJob.no}</strong></div>
            <p>{activeJob.note}</p>
          </div>
          <span className="approved">APPROVED<br />WITHOUT<br />AUDITION</span>
        </div>
      </section>

      <section className="listing">
        <div className="listingTop"><span className="sectionIndex">04 / THE LISTING</span><span>THIS IS NOT FINANCIAL ADVICE. IT IS A CAT.</span></div>
        <div className="listingTitle"><h2>THE WORLD’S<br />FIRST <em>STOCK</em> CAT.</h2><div className="tickerCard"><span>TICKER</span><b>$STOCKCAT</b><small>STATUS · NOT YET TRADING</small></div></div>
        <div className="facts">
          <div><span>01</span><b>THE SUPPLY</b><p>To be confirmed at launch. No invented token math.</p></div>
          <div><span>02</span><b>THE CONTRACT</b><p>Not issued. Verify only from the official site when live.</p></div>
          <div><span>03</span><b>THE UTILITY</b><p>Employ the cat. Make the memes. That is the entire job description.</p></div>
        </div>
      </section>

      <section className="finale">
        <div className="finalImage"><Image src="/images/cat-00.webp" alt="Stockcat working as a fisherman" fill loading="eager" sizes="100vw" /><span className="giantWatermark">STOCKCAT</span></div>
        <div className="finalCopy"><span className="sectionIndex light">END OF SEARCH RESULTS</span><h2>HE’S<br />HIRED.</h2><p>Clock in before the cat gets another job.</p><a href="#top" className="button finaleButton">BACK TO TOP <ArrowIcon /></a></div>
      </section>

      <footer><div className="footerBrand">STOCKCAT</div><div><p>ONE CAT. EVERY JOB.</p><p>$STOCKCAT · 2026</p></div><a href="https://www.shutterstock.com/g/Iryna+Kuznetsova?sort=popular" target="_blank" rel="noreferrer">SOURCE PORTFOLIO ↗</a></footer>
      {toast && <div className="toast" role="status"><span className="liveDot" /> {toast}</div>}
    </main>
  );
}
