import Link from "next/link";
import { ArrowUpRight, BedDouble, CalendarDays, MapPin, Ruler, UserRound } from "lucide-react";
import { FavoriteButton } from "@/components/favorite-button";
import { PropertyCardImage } from "@/components/property-card-image";
import type { Property } from "@/lib/properties";
import { getPropertyHref } from "@/lib/properties";

export function PropertyCard({ property }: { property: Property }) {
  const href = getPropertyHref(property);
  const published = property.publishedAt && !Number.isNaN(Date.parse(property.publishedAt))
    ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(property.publishedAt))
    : null;
  return <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e7e0d4] bg-white shadow-[0_5px_20px_rgba(27,38,30,.035)] transition duration-300 hover:border-[#c59b52]">
    <div className={`property-art property-art--${property.art} relative h-[220px] sm:h-[240px]`}>
      <PropertyCardImage key={property.photos?.[0]?.src ?? "empty"} photo={property.photos?.[0]} isDemo={property.isDemo}/>
      <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#174c38]">{property.kind}</span>
      {property.isDemo && <span className="absolute right-3 top-3 rounded-full bg-[#fff9eb] px-3 py-1.5 text-xs font-bold text-[#604c27]">Exemple fictif</span>}
    </div>
    <div className="flex flex-1 flex-col p-5">
      <p className="text-lg font-bold text-[#174c38]">{property.priceLabel}</p>
      <h3 className="mt-2 text-base font-semibold leading-6 text-[#263238]"><Link href={href} className="hover:underline">{property.title}</Link></h3>
      <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-[#52655b]"><MapPin size={14} className="mt-0.5 shrink-0"/>{property.location}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-y border-[#eee8dc] py-3 text-xs text-[#52655b]">
        <span className="flex items-center gap-1.5"><Ruler size={14}/>{property.area} m²</span>
        {property.category === "immobilier" && <span className="flex items-center gap-1.5"><BedDouble size={14}/>Chambres non renseignées</span>}
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#52655b]"><UserRound size={14} className="mt-0.5 shrink-0"/>Agence ou vendeur : non renseigné</p>
      <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-[#52655b]"><CalendarDays size={14} className="mt-0.5 shrink-0"/>{property.isDemo ? "Date de publication : exemple fictif" : published ? <>Publié le <time dateTime={property.publishedAt}>{published}</time></> : "Date de publication non renseignée"}</p>
      <p className="mt-3 text-[11px] leading-5 text-[#626d66]">{property.isDemo ? "Informations fictives non vérifiées." : "Annonce publiée : informations à confirmer, sans certification juridique."}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
        <FavoriteButton slug={property.slug} isDemo={property.isDemo} compact/>
        <Link href={href} className="inline-flex min-h-10 items-center gap-1 text-xs font-bold text-[#174c38]">Voir le bien <ArrowUpRight size={15}/><span className="sr-only"> : {property.title}</span></Link>
      </div>
    </div>
  </article>;
}
