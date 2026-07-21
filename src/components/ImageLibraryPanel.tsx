"use client";

import Image from "next/image";
import { IMAGE_LIBRARY } from "@/data/images";

export function ImageLibraryPanel() {
  return (
    <>
      <div className="libraryHead panelReveal">
        <div><span className="sectionIndex">02 / THE STOCKCAT ARCHIVE</span><h2>300 CATS.<br /><em>ONE ORIGINAL.</em></h2></div>
        <p>Every image is the same first Stockcat.<br />Different job. Same cat. Scroll the wall.</p>
        <strong className="archiveCount">300</strong>
      </div>
      <div className="libraryGrid panelReveal" data-vertical-scroll onWheel={(event) => event.stopPropagation()}>
        {IMAGE_LIBRARY.map((item, index) => (
          <a className="libraryImage" href={item.sourceUrl} target="_blank" rel="noreferrer" key={item.id} title={item.title}>
            <Image src={item.src} alt={`${item.id}: the original Stockcat`} fill loading={index < 24 ? "eager" : "lazy"} sizes="(max-width: 620px) 24vw, 10vw" />
            <span className="libraryShade" />
            <div><b>{item.id}</b><span>{item.source}</span></div>
          </a>
        ))}
      </div>
      <a className="sourceCredit" href="https://www.shutterstock.com/g/Iryna+Kuznetsova?sort=popular" target="_blank" rel="noreferrer">300 ARCHIVED REFERENCES · SOURCE PORTFOLIO ↗</a>
    </>
  );
}
