"use client";

import Image from "next/image";
import { IMAGE_LIBRARY } from "@/data/images";

export function ImageLibraryPanel() {
  return (
    <>
      <div className="libraryHead panelReveal">
        <div><span className="sectionIndex">03 / ASSET LIBRARY</span><h2>THE WHOLE<br /><em>CATALOGUE.</em></h2></div>
        <p>Every campaign image on one contact sheet.<br />Open the original. Save the cat. Make the meme.</p>
      </div>
      <div className="libraryGrid panelReveal">
        {IMAGE_LIBRARY.map((item, index) => (
          <a className={`libraryImage lib${index}`} href={item.src} target="_blank" rel="noreferrer" key={item.id}>
            <Image src={item.src} alt={`Stockcat image: ${item.title}`} fill loading="eager" sizes="(max-width: 700px) 46vw, 22vw" />
            <span className="libraryShade" />
            <div><b>{item.id} · {item.title}</b><span>{item.dimensions} / {item.use}</span></div>
            <i>OPEN ↗</i>
          </a>
        ))}
      </div>
      <a className="sourceCredit" href="https://www.shutterstock.com/g/Iryna+Kuznetsova?sort=popular" target="_blank" rel="noreferrer">SOURCE PORTFOLIO / IRYNA KUZNETSOVA ↗</a>
    </>
  );
}
