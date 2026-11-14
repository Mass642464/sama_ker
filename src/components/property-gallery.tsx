"use client";

import Image from "next/image";
import { useState } from "react";
import type { PropertyPhoto } from "@/lib/properties";
import { useDataSaver } from "@/components/data-saver";

export function PropertyGallery({ photos = [], isDemo, art }: { photos?: PropertyPhoto[]; isDemo: boolean; art: string }) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const dataSaver = useDataSaver();
  const photo = photos[selected];
  const unavailable = photo && failed.includes(photo.src);

  function recordFailure(src: string) {
    setFailed((current) => current.includes(src) ? current : [...current, src]);
  }

  return <section aria-label="Galerie photos">
    {isDemo && <p role="note" className="mb-3 rounded-xl border border-[#e8dfc8] bg-[#faf6e9] px-4 py-3 text-xs leading-5 text-[#786543]">Galerie d’inspiration : ces images ne représentent pas le bien et ne documentent ni sa localisation ni ses caractéristiques.</p>}
    <figure>
      <div className={`property-art property-art--${art} relative grid h-[280px] place-items-center rounded-2xl sm:h-[480px]`}>
        {photo && !unavailable && <Image key={photo.src} src={photo.src} alt={photo.alt} fill loading={selected === 0 ? "eager" : "lazy"} unoptimized={!isDemo} sizes="(max-width: 1024px) 100vw, 65vw" onError={() => recordFailure(photo.src)} className="rounded-2xl object-cover"/>}
        {(!photo || unavailable) && <span className="relative rounded-lg bg-white px-4 py-2 text-sm text-[#263238]">{unavailable ? "Photo indisponible" : "Aucune photo disponible"}</span>}
        {photo && !unavailable && <span className="absolute bottom-4 left-4 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#174c38]">{isDemo ? "Illustration seulement" : "Média publié avec l’annonce"}</span>}
      </div>
      {photo && <figcaption className="mt-2 text-xs leading-5 text-[#626d66]" aria-live="polite">
        Photo {selected + 1} sur {photos.length} · {photo.alt} · Source : {photo.sourceUrl ? <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="underline">{photo.credit}</a> : photo.credit}
      </figcaption>}
    </figure>
    {photos.length > 1 && <div role="group" aria-label="Choisir une photo" className="mt-4 flex gap-2 overflow-x-auto pb-2">
      {photos.map((item, index) => <button key={`${item.src}-${index}`} type="button" aria-label={`Afficher la photo ${index + 1} sur ${photos.length} : ${item.alt}`} aria-pressed={selected === index} onClick={() => setSelected(index)} className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 ${selected === index ? "border-[#174c38]" : "border-transparent"}`}>
        {failed.includes(item.src) ? <span className="grid h-full place-items-center bg-[#f5f1e8] text-xs text-[#263238]">Indisponible</span> : dataSaver ? <span className="grid h-full place-items-center bg-[#f5f1e8] text-sm font-semibold text-[#174c38]">{index + 1}</span> : <Image src={item.src} alt="" fill unoptimized={!isDemo} sizes="96px" onError={() => recordFailure(item.src)} className="object-cover"/>}
      </button>)}
    </div>}
  </section>;
}
