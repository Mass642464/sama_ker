import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, BadgeCheck, MapPin, Ruler } from "lucide-react";
import type { Property } from "@/lib/properties";
import { getPropertyHref } from "@/lib/properties";

export function PropertyCard({ property }: { property: Property }) {
  return (
    <article className="group overflow-hidden rounded-[22px] border border-[#e7e9e7] bg-white shadow-[0_5px_20px_rgba(27,38,30,.035)] transition duration-300 hover:-translate-y-1 hover:border-[#d3dfd3] hover:shadow-[0_14px_36px_-22px_rgba(24,38,26,.22)]">
      <Link href={getPropertyHref(property)} className="block">
        <div className={`property-art property-art--${property.art} relative h-[190px] transition-transform duration-500 group-hover:scale-[1.02] sm:h-[210px]`}>
          {property.photos?.[0] ? <><Image src={property.photos[0].src} alt={property.photos[0].alt} fill unoptimized={!property.isDemo} sizes="(max-width: 768px) 100vw, 33vw" className="object-cover"/><span className="absolute bottom-4 right-3 rounded-full bg-white/95 px-2 py-1 text-[8px] font-bold text-[#52614c]">{property.isDemo ? "Illustration · bien non représenté" : "Média publié"}</span></> : <span className="absolute bottom-3 right-3 rounded-full bg-white/95 px-2 py-1 text-[8px] font-bold text-[#52614c]">{property.isDemo ? "Visuel illustratif" : "Photo non fournie"}</span>}
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-[9px] font-semibold tracking-wide text-[#353d37]">{property.kind}</span>
          {property.isDemo && <span className="absolute right-3 top-3 rounded-full bg-[#fff9eb] px-2.5 py-1.5 text-[9px] font-bold text-[#604c27]">Exemple fictif</span>}
          {property.verified && <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1.5 text-[9px] font-bold text-[#387450]"><BadgeCheck size={12} /> Vérifié</span>}
          <span className="absolute bottom-3 left-3 rounded-full bg-[#171a18]/85 px-3 py-1.5 text-[9px] font-semibold text-white">Réf. {property.ref}</span>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><h3 className="text-[14px] font-semibold tracking-tight text-[#202722] sm:text-[15px]">{property.title}</h3><p className="mt-2 flex items-center gap-1.5 text-[10px] text-[#777e79] sm:text-xs"><MapPin size={12} />{property.location}</p></div><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f0f2f0] text-[#4c8551] transition group-hover:bg-[#e5eee5]"><ArrowUpRight size={15} /></span></div>
          <div className="mt-4 flex items-center justify-between border-t border-[#eff0ef] pt-3.5"><div><span className="block text-[9px] uppercase tracking-wider text-[#8a918c]">Prix indicatif</span><span className="mt-1 block text-sm font-bold text-[#202722]">{property.priceLabel}</span></div><div className="text-right"><span className="block text-[9px] uppercase tracking-wider text-[#8a918c]">Surface</span><span className="mt-1 flex items-center justify-end gap-1 text-xs font-semibold text-[#414943]"><Ruler size={12} />{property.area} m²</span></div></div>
        </div>
      </Link>
    </article>
  );
}