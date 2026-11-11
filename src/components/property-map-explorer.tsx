"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MapPin, Search } from "lucide-react";
import { GoogleMapPanel, type MapMarker } from "@/components/google-map-panel";
import { formatApproximateDistance, sortByDistance, type GeoPoint } from "@/lib/geo";

export type ExplorerProperty = {
  slug: string;
  title: string;
  location: string;
  region: string;
  area: number;
  priceLabel: string;
  status: string;
  isDemo: boolean;
  href: string;
  coordinates?: GeoPoint;
};

type Props = {
  properties: ExplorerProperty[];
  regions: string[];
  query: string;
  isDemo: boolean;
};

export function PropertyMapExplorer({ properties, regions, query, isDemo }: Props) {
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [focus, setFocus] = useState<{ id: string | null; nonce: number }>({ id: null, nonce: 0 });

  const items = useMemo(() => origin ? sortByDistance(properties, origin) : properties.map((item) => ({ ...item, distanceKm: null as number | null })), [properties, origin]);
  const markers = useMemo<MapMarker[]>(() => properties.flatMap((item) => item.coordinates ? [{
    id: item.slug, title: item.title, detail: `${item.priceLabel} · ${item.status}`, href: item.href, lat: item.coordinates.lat, lng: item.coordinates.lng,
  }] : []), [properties]);
  const positioned = markers.length;
  const count = (value: number, one: string, many: string) => `${value} ${value > 1 ? many : one}`;

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
    <GoogleMapPanel regions={regions} locate markers={markers} focusId={focus.id} focusNonce={focus.nonce} onLocate={setOrigin} heightClassName="h-[360px] sm:h-[520px]"/>

    <aside className="rounded-[22px] border border-[#e4e7e4] bg-white p-4 sm:p-5 lg:max-h-[640px] lg:overflow-y-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#1c241e] sm:text-base">Biens à découvrir</h2>
          <p className="mt-1 text-[11px] text-[#858c86]">
            {isDemo ? count(items.length, "annonce de démonstration", "annonces de démonstration") : count(items.length, "annonce publiée", "annonces publiées")}
            {!isDemo && ` · ${count(positioned, "positionnée", "positionnées")} sur la carte`}
          </p>
        </div>
        <Link href="/terrains" className="grid size-9 place-items-center rounded-full bg-[#f0f2f0] text-[#4c8551]" aria-label="Voir les annonces"><ArrowUpRight size={16}/></Link>
      </div>

      <form action="/carte" className="mt-4 flex gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-full border border-[#e5e9e3] bg-[#fbfcfa] px-4">
          <Search size={15} className="shrink-0 text-[#737b75]"/>
          <span className="sr-only">Rechercher un bien par ville ou quartier</span>
          <input name="q" defaultValue={query} placeholder="Ville ou quartier" className="min-w-0 flex-1 bg-transparent text-sm text-[#242a26] outline-none placeholder:text-[#959b96]"/>
        </label>
        <button className="rounded-full bg-[#1c4523] px-4 text-xs font-bold text-white">Filtrer</button>
      </form>
      {origin && <p className="mt-3 text-[11px] leading-5 text-[#60806a]">Triés du plus proche au plus éloigné de votre position. Distances approximatives : les repères sont arrondis à environ 1 km.</p>}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {items.map((property) => {
          const body = <>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#edf4ed] text-[#4c8551]"><MapPin size={16}/></span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-xs font-semibold text-[#28302a]">{property.title}</strong>
              <span className="mt-1 block truncate text-[11px] text-[#818882]">{property.location} · {property.area} m²</span>
              {property.distanceKm !== null && <span className="mt-1 block text-[11px] font-semibold text-[#3d7759]">{formatApproximateDistance(property.distanceKm)}</span>}
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[11px] font-semibold text-[#343b35]">{property.priceLabel}</span>
              <span className="mt-1 block text-[10px] text-[#959b96]">{property.isDemo ? "Démonstration" : property.status}</span>
            </span>
          </>;
          return <div key={property.slug} className="flex min-w-0 items-stretch overflow-hidden rounded-2xl border border-[#eceeec] bg-white transition hover:border-[#d3dfd3]">
            <Link href={property.href} className="flex min-w-0 flex-1 items-center gap-3 p-3 hover:bg-[#fbfcfb]">{body}</Link>
            {property.coordinates && <button type="button" onClick={() => setFocus((current) => ({ id: property.slug, nonce: current.nonce + 1 }))} aria-label={`Voir ${property.title} sur la carte`} className="grid w-11 shrink-0 place-items-center border-l border-[#eceeec] text-[#3d7759] hover:bg-[#edf4ed]"><MapPin size={16}/></button>}
          </div>;
        })}
        {items.length === 0 && <p className="rounded-2xl bg-[#f1f2f0] p-4 text-xs leading-5 text-[#777e79]">Aucun bien ne correspond{query ? ` à « ${query} »` : ""}. Essayez une autre ville ou un autre quartier.</p>}
      </div>
      <p className="mt-4 rounded-xl bg-[#f1f2f0] p-3 text-[11px] leading-5 text-[#797f7a]">
        {isDemo ? "Les annonces, prix et localisations de cette liste sont fictifs et non vérifiés, et aucun n’est positionné." : "Les annonces sont publiées par l’équipe ; leurs informations sont à confirmer. Seuls les biens dont la zone a été validée sont repérés, sans coordonnée exacte ni donnée cadastrale."}
      </p>
    </aside>
  </div>;
}
