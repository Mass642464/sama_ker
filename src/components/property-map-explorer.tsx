"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MapPin, Search } from "lucide-react";
import { CesiumMapPanel, type MapMarker } from "@/components/cesium-map-panel";
import { formatApproximateDistance, isInMapBounds, sortByDistance, type GeoPoint, type MapBounds } from "@/lib/geo";
import { parseSearchQuery } from "@/lib/search-query";
import { parseGeoJson, parseKml, type ImportedGeoJson } from "@/lib/geometry-import";
import type { Property } from "@/lib/properties";
import { PropertyCard } from "@/components/property-card";

export type ExplorerProperty = {
  slug: string;
  title: string;
  location: string;
  region: string;
  area: number;
  priceLabel: string;
  status: string;
  isDemo: boolean;
  property: Property;
  href: string;
  coordinates?: GeoPoint;
};

type Props = {
  properties: ExplorerProperty[];
  regions: string[];
  query: string;
  isDemo: boolean;
  filters?: Record<string, string | undefined>;
};

export function PropertyMapExplorer({ properties, regions, query, isDemo, filters = {} }: Props) {
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [focus, setFocus] = useState<{ id: string | null; nonce: number }>({ id: null, nonce: 0 });
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [imported, setImported] = useState<ImportedGeoJson | null>(null);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);

  async function importFile(file: File) {
    setImporting(true);
    setImportError("");
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("Le fichier dépasse la limite de 2 Mo.");
      const extension = file.name.toLowerCase();
      if (!extension.endsWith(".geojson") && !extension.endsWith(".json") && !extension.endsWith(".kml")) throw new Error("Choisissez un fichier GeoJSON ou KML.");
      const text = await file.text();
      let geometry: ImportedGeoJson;
      if (extension.endsWith(".kml")) geometry = parseKml(text);
      else {
        let value: unknown;
        try { value = JSON.parse(text); }
        catch (error) {
          if (error instanceof SyntaxError) throw new Error("Le fichier GeoJSON n’est pas un JSON valide.");
          throw error;
        }
        geometry = parseGeoJson(value);
      }
      setImported(geometry);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Le fichier n’a pas pu être importé.");
    } finally { setImporting(false); }
  }

  const inArea = useMemo(() => bounds ? properties.filter((item) => {
    const point = item.coordinates;
    return point && isInMapBounds(point, bounds);
  }) : properties, [properties, bounds]);
  const items = useMemo(() => origin ? sortByDistance(inArea, origin) : inArea.map((item) => ({ ...item, distanceKm: null as number | null })), [inArea, origin]);
  const markers = useMemo<MapMarker[]>(() => inArea.flatMap((item) => item.coordinates ? [{
    id: item.slug, title: item.title, detail: `${item.priceLabel} · ${item.status}`, href: item.href, lat: item.coordinates.lat, lng: item.coordinates.lng,
  }] : []), [inArea]);
  const positioned = markers.length;
  const count = (value: number, one: string, many: string) => `${value} ${value > 1 ? many : one}`;
  const catalogPath = filters.category === "immobilier" ? "/immobilier" : "/terrains";
  const catalogParams = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (key !== "category" && key !== "page" && value) catalogParams.set(key, value);
  }

  return <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
    <div className="min-w-0">
      <CesiumMapPanel regions={regions} locate markers={markers} focusId={focus.id} focusNonce={focus.nonce} onLocate={setOrigin} onSearchArea={setBounds} autoFit={!bounds} importedGeometry={imported} heightClassName="h-[360px] sm:h-[580px]"/>
      <section className="mt-4 rounded-2xl border border-[#e7e0d4] bg-white p-4 sm:p-5">
        <h2 className="text-sm font-bold text-[#174c38]">Importer des géométries</h2>
        <p className="mt-2 text-xs leading-5 text-[#596b61]">GeoJSON ou KML en WGS 84, 2 Mo maximum. Points, lignes et polygones sont affichés temporairement. Les données ne sont ni enregistrées ni publiées par Sama Kër. Si la carte est affichée, les géométries apparaissent sur le fond Google.</p>
        <p className="mt-2 text-xs font-semibold leading-5 text-[#775d34]">Ces contours proviennent de votre fichier : ils ne constituent pas des limites cadastrales officielles ou vérifiées. Vérifiez vos droits avant import.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3"><label className="cursor-pointer rounded-lg bg-[#174c38] px-4 py-2 text-xs font-bold text-white focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-[#a17229]">Choisir un fichier<input type="file" accept=".geojson,.json,.kml,application/geo+json,application/json,application/vnd.google-earth.kml+xml" disabled={importing} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void importFile(file); }} className="sr-only"/></label>
          {imported && <button type="button" onClick={() => { setImported(null); setImportError(""); }} className="rounded-lg border border-[#dfe6df] px-4 py-2 text-xs font-semibold text-[#43584e]">Retirer le fichier</button>}
        </div>
        {importing && <p role="status" className="mt-3 text-xs text-[#596b61]">Lecture du fichier…</p>}
        {importError && <p role="alert" className="mt-3 text-xs text-red-700">{importError}{imported ? " Le fichier précédent reste chargé." : ""}</p>}
        {imported && <p role="status" className="mt-3 text-xs text-[#174c38]">{imported.features.length} géométrie(s) chargée(s) localement pour la carte 3D.</p>}
      </section>
    </div>

    <aside className="min-w-0 rounded-2xl border border-[#e7e0d4] bg-white p-5 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-[.15em] text-[#80622f]">Votre sélection</span>
          <h2 className="mt-2 text-xl font-semibold text-[#174c38]">Biens à découvrir</h2>
          <p className="mt-1 text-xs text-[#626d66]">
            {isDemo ? count(items.length, "annonce de démonstration", "annonces de démonstration") : count(items.length, "annonce publiée", "annonces publiées")}
            {!isDemo && ` · ${count(positioned, "positionnée", "positionnées")} sur la carte`}
          </p>
        </div>
        <Link href={`${catalogPath}${catalogParams.size ? `?${catalogParams}` : ""}`} className="grid size-9 place-items-center rounded-full bg-[#f5f1e8] text-[#4c8551]" aria-label="Voir les annonces"><ArrowUpRight size={16}/></Link>
      </div>

      <form action="/carte" className="mt-4 flex gap-2">
        {Object.entries(filters).filter(([key, value]) => key !== "q" && key !== "page" && value).map(([key, value]) => <input key={key} type="hidden" name={key} value={value}/>)}
        <label className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-full border border-[#e7e0d4] bg-[#fbfcfa] px-4">
          <Search size={15} className="shrink-0 text-[#56605a]"/>
          <span className="sr-only">Rechercher par mots-clés ou phrase</span>
          <input name="q" defaultValue={query} placeholder="Ville, type ou critères" className="min-w-0 flex-1 bg-transparent text-sm text-[#242a26] outline-none placeholder:text-[#56605a]"/>
        </label>
        <button className="rounded-full bg-[#174c38] px-4 text-xs font-bold text-white">Filtrer</button>
      </form>
      {parseSearchQuery(query).unsupportedProximity && <p role="note" className="mt-3 text-[11px] leading-5 text-[#7a5d52]">La recherche par proximité n’est pas encore disponible : retirez cette précision pour rechercher.</p>}
      {bounds && <div className="mt-3 rounded-xl bg-[#edf4ed] p-3 text-[11px] leading-5 text-[#43584e]">Zone visible appliquée aux repères approximatifs ; les biens sans position en sont exclus. <button type="button" onClick={() => setBounds(null)} className="font-bold underline">Afficher tous les résultats</button></div>}
      {origin && <p className="mt-3 text-[11px] leading-5 text-[#60806a]">Triés du plus proche au plus éloigné de votre position. Distances approximatives : les repères sont arrondis à environ 1 km.</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {items.map((property) => {
          return <div key={property.slug} className="min-w-0">
            <PropertyCard property={property.property}/>
            {property.distanceKm !== null && <p className="mt-2 text-xs font-semibold text-[#174c38]">{formatApproximateDistance(property.distanceKm)}</p>}
            {property.coordinates && <button type="button" onClick={() => setFocus((current) => ({ id: property.slug, nonce: current.nonce + 1 }))} aria-label={`Voir ${property.title} sur la carte`} className="mt-2 flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-[#174c38] hover:bg-[#f5f1e8]"><MapPin size={14}/> Voir sur la carte</button>}
          </div>;
        })}
        {items.length === 0 && <p className="rounded-2xl bg-[#f1f2f0] p-4 text-xs leading-5 text-[#56605a]">Aucun bien ne correspond{query ? ` à « ${query} »` : ""}. Essayez une autre ville ou un autre quartier.</p>}
      </div>
      <p className="mt-4 rounded-xl bg-[#f1f2f0] p-3 text-[11px] leading-5 text-[#56605a]">
        {isDemo ? "Les annonces, prix et localisations de cette liste sont fictifs et non vérifiés, et aucun n’est positionné." : "Les annonces sont publiées par l’équipe ; leurs informations sont à confirmer. Seuls les biens dont la zone a été validée sont repérés, sans coordonnée exacte ni donnée cadastrale."}
      </p>
    </aside>
  </div>;
}
