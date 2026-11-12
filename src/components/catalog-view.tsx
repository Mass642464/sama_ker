import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { FilterPanel } from "@/components/catalog-filters";
import { PropertyCard } from "@/components/property-card";
import { SearchHistory } from "@/components/search-history";
import { parseSearchQuery } from "@/lib/search-query";
import type { Property } from "@/lib/properties";

type Props = {
  title: string;
  intro: string;
  properties: Property[];
  kind: "terrain" | "immobilier";
  q?: string;
  localisation?: string;
  budget?: string;
  region?: string;
  prixMin?: string;
  prixMax?: string;
  surfaceMin?: string;
  surfaceMax?: string;
  type?: string;
  statut?: string;
  tri?: string;
  isDemo?: boolean;
  regions?: string[];
  pagination?: {
    page: number;
    pageCount: number;
    total: number;
    basePath: string;
    params: Record<string, string | undefined>;
  };
};

function pageHref(basePath: string, params: Record<string, string | undefined>, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value && key !== "page") query.set(key, value);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
}

export function CatalogView({ title, intro, properties, kind, q = "", localisation = "", budget = "", region = "", prixMin = "", prixMax = "", surfaceMin = "", surfaceMax = "", type = "", statut = "", tri = "", isDemo = true, regions: availableRegions, pagination }: Props) {
  const basePath = kind === "terrain" ? "/terrains" : "/immobilier";
  const regions = availableRegions ?? [...new Set(properties.map((property) => property.region))].sort((left, right) => left.localeCompare(right, "fr"));
  const typeOptions = kind === "terrain" ? ["résidentiel", "urbain"] : ["Maison", "Villa", "Appartement"];
  const activeFilters = [region, type, statut, prixMin, prixMax || budget, surfaceMin, surfaceMax].filter(Boolean).length;
  const heroImage = kind === "terrain" ? "/images/parcel.jpg" : "/images/immobilier2%20(2).jpg";
  const criteria = { q, localisation, region, type, statut, prixMin, prixMax: prixMax || budget, surfaceMin, surfaceMax, tri };
  const query = new URLSearchParams(Object.entries(criteria).filter(([, value]) => value));
  const searchHref = `${basePath}?${query.toString()}`;
  const searchLabel = q || [localisation, region, type, statut, prixMin && `dès ${prixMin} FCFA`, (prixMax || budget) && `max ${prixMax || budget} FCFA`, surfaceMin && `dès ${surfaceMin} m²`, surfaceMax && `max ${surfaceMax} m²`].filter(Boolean).join(" · ");
  const parsed = parseSearchQuery(q);
  const interpretation = [parsed.category && `catégorie : ${parsed.category}`, parsed.localisation && `lieu : ${parsed.localisation}`, parsed.surfaceMin !== undefined && `surface min. : ${parsed.surfaceMin} m²`, parsed.surfaceMax !== undefined && `surface max. : ${parsed.surfaceMax} m²`, parsed.prixMax !== undefined && `prix max. : ${parsed.prixMax.toLocaleString("fr-FR")} FCFA`, parsed.keywords.length > 0 && `mots-clés : ${parsed.keywords.join(", ")}`].filter(Boolean).join(" · ");
  return <PageShell>
    <section className="relative isolate overflow-hidden bg-[#174c38] py-8 text-white sm:py-20">
      <Image src={heroImage} alt="" fill priority sizes="100vw" className="catalog-hero__image object-cover"/>
      <div className="catalog-hero__shade absolute inset-0" aria-hidden="true"/>
      <div className="container relative z-10">
        <div className="text-xs text-white/70"><Link href="/">Accueil</Link><span className="mx-2">/</span>{title}</div>
        <span className="mt-5 inline-block text-[10px] font-bold uppercase tracking-[.17em] text-[#e2c893] sm:mt-8">Le catalogue</span>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{title}<span className="text-[#e2c893]">.</span></h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/85">{intro}</p>
        <p className="mt-3 text-[10px] leading-4 text-white/75">
          {kind === "terrain"
            ? "Visuel d’illustration avec filigrane · ne représente aucun terrain du catalogue."
            : "Visuel d’inspiration uniquement · ne représente aucun bien immobilier du catalogue."}
        </p>
      </div>
    </section>
    <section className="container py-10">
      <form key={searchHref} action={basePath} method="get" className="mb-8 rounded-2xl border border-[#e8ebe5] bg-white p-4 sm:p-5">
        <label className="mb-3 block text-xs font-semibold text-[#174c38]">Recherche par mots-clés ou phrase
          <input name="q" defaultValue={q} maxLength={200} placeholder="Ex. Terrain de 300 à 500 m² à Saly, budget inférieur à 15 millions FCFA" className="mt-2 min-h-12 w-full rounded-xl border border-[#dce5dc] bg-[#f7f8f5] px-4 text-sm outline-none focus:border-[#174c38]"/>
        </label>
        <p className="mb-3 text-[11px] leading-5 text-[#718078]">Expressions simples : type, lieu, fourchette de surface et budget maximum. Les autres mots sont recherchés dans les annonces.</p>
        {q && <p className="mb-3 rounded-xl bg-[#edf4ed] p-3 text-xs text-[#43584e]">Critères reconnus : {interpretation || "aucun critère reconnu"}.{parsed.unsupportedProximity && " La recherche par proximité n’est pas encore disponible : retirez cette précision pour rechercher."}</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex min-h-12 items-center gap-3 rounded-xl bg-[#f7f8f5] px-4"><MapPin className="text-[#66816e]" size={16}/><span className="flex-1"><span className="block text-[9px] font-bold uppercase tracking-wider text-[#89938d]">Localisation</span><input name="localisation" defaultValue={localisation} placeholder="Ville ou quartier" className="mt-1 w-full bg-transparent text-xs outline-none" /></span></label>
          <FilterPanel activeCount={activeFilters}><label className="flex min-h-12 flex-col justify-center rounded-xl bg-[#f7f8f5] px-4"><span className="text-[9px] font-bold uppercase tracking-wider text-[#89938d]">Région</span><select name="region" defaultValue={region} className="mt-1 bg-transparent text-xs outline-none"><option value="">Toutes les régions</option>{regions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="flex min-h-12 flex-col justify-center rounded-xl bg-[#f7f8f5] px-4"><span className="text-[9px] font-bold uppercase tracking-wider text-[#89938d]">Type de bien</span><select name="type" defaultValue={type} className="mt-1 bg-transparent text-xs outline-none"><option value="">Tous les types</option>{typeOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="flex min-h-12 flex-col justify-center rounded-xl bg-[#f7f8f5] px-4"><span className="text-[9px] font-bold uppercase tracking-wider text-[#89938d]">Disponibilité</span><select name="statut" defaultValue={statut} className="mt-1 bg-transparent text-xs outline-none"><option value="">Tous les statuts</option><option value="Disponible">Disponible</option><option value="À louer">À louer</option><option value="Réservé">Réservé</option></select></label>
          <label className="flex min-h-12 flex-col justify-center rounded-xl bg-[#f7f8f5] px-4"><span className="text-[9px] font-bold uppercase tracking-wider text-[#89938d]">Prix minimum (FCFA)</span><input name="prixMin" type="number" min="0" defaultValue={prixMin} placeholder="Sans minimum" className="mt-1 bg-transparent text-xs outline-none placeholder:text-[#a0a8a2]"/></label>
          <label className="flex min-h-12 flex-col justify-center rounded-xl bg-[#f7f8f5] px-4"><span className="text-[9px] font-bold uppercase tracking-wider text-[#89938d]">Prix maximum (FCFA)</span><input name="prixMax" type="number" min="0" defaultValue={prixMax || budget} placeholder="Sans maximum" className="mt-1 bg-transparent text-xs outline-none placeholder:text-[#a0a8a2]"/></label>
          <label className="flex min-h-12 flex-col justify-center rounded-xl bg-[#f7f8f5] px-4"><span className="text-[9px] font-bold uppercase tracking-wider text-[#89938d]">Surface minimum (m²)</span><input name="surfaceMin" type="number" min="0" defaultValue={surfaceMin} placeholder="Sans minimum" className="mt-1 bg-transparent text-xs outline-none placeholder:text-[#a0a8a2]"/></label>
          <label className="flex min-h-12 flex-col justify-center rounded-xl bg-[#f7f8f5] px-4"><span className="text-[9px] font-bold uppercase tracking-wider text-[#89938d]">Surface maximum (m²)</span><input name="surfaceMax" type="number" min="0" defaultValue={surfaceMax} placeholder="Sans maximum" className="mt-1 bg-transparent text-xs outline-none placeholder:text-[#a0a8a2]"/></label></FilterPanel>
        </div>
        <p className="mt-3 text-[11px] text-[#718078]">Proximité d’une école, route, plage ou d’un marché : indisponible en attendant une source de lieux vérifiée.</p>
        <div className="mt-3 flex flex-col gap-3 border-t border-[#edf0eb] pt-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[10px] text-[#89938d]">Les filtres figurent dans l’URL partageable : ne saisissez pas d’informations sensibles.</p><div className="flex gap-2"><Link href={basePath} className="flex min-h-10 items-center justify-center rounded-xl border border-[#e5eae5] px-4 text-[10px] font-semibold text-[#67776f]">Effacer</Link><button className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#174c38] px-5 text-xs font-bold text-white"><Search size={15}/> Appliquer les filtres</button></div></div>
      </form>
      <SearchHistory href={searchHref} label={searchLabel.slice(0, 200)}/>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><p className="text-sm text-[#718078]"><strong className="text-[#174c38]">{pagination?.total ?? properties.length}</strong> biens à découvrir</p><div className="flex items-center gap-3"><Link href={`/carte?${new URLSearchParams({ ...Object.fromEntries(query), category: kind })}`} className="text-[10px] font-semibold text-[#589262]">Voir les résultats sur la carte</Link><form key={searchHref} action={basePath} method="get" className="inline-flex items-center gap-2 text-xs text-[#718078]">{Object.entries(criteria).filter(([name, value]) => name !== "tri" && value).map(([name, value]) => <input key={name} type="hidden" name={name} value={value}/>)}<SlidersHorizontal size={14}/><label htmlFor="catalog-sort" className="text-[10px]">Trier :</label><select id="catalog-sort" name="tri" defaultValue={tri} className="rounded-lg border border-[#e5eae5] bg-white px-2 py-2 text-[10px] font-semibold text-[#52655b] outline-none"><option value="">Ordre du catalogue</option><option value="pertinence">Pertinence des mots-clés</option>{!isDemo && <option value="nouveautes">Nouveautés</option>}<option value="prix-croissant">Prix croissant</option><option value="prix-decroissant">Prix décroissant</option><option value="surface-croissante">Surface croissante</option><option value="surface-decroissante">Surface décroissante</option></select><button className="rounded-lg border border-[#e5eae5] bg-white px-3 py-2 text-[10px] font-semibold text-[#52655b]">OK</button></form></div></div>
      {properties.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{properties.map((property) => <PropertyCard key={property.slug} property={property}/>)}</div> : <div className="rounded-2xl border border-dashed border-[#dce3dc] bg-white px-6 py-16 text-center"><h2 className="text-xl font-bold text-[#174c38]">Aucun bien ne correspond à ces filtres</h2><p className="mt-2 text-sm text-[#718078]">Essayez une autre localisation, une surface ou un budget différent.</p><Link href={basePath} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#174c38]">Voir tous les biens <ArrowRight size={15}/></Link></div>}
      {pagination && pagination.pageCount > 1 && <nav aria-label="Pages du catalogue" className="mt-10 flex items-center justify-between gap-3 text-xs font-semibold text-[#52655b]">
        {pagination.page > 1 ? <Link href={pageHref(pagination.basePath, pagination.params, pagination.page - 1)} rel="prev" className="rounded-full border border-[#dfe6df] bg-white px-4 py-2.5">Page précédente</Link> : <span/>}
        <span aria-current="page">Page {pagination.page} sur {pagination.pageCount} · {pagination.total} biens</span>
        {pagination.page < pagination.pageCount ? <Link href={pageHref(pagination.basePath, pagination.params, pagination.page + 1)} rel="next" className="rounded-full border border-[#dfe6df] bg-white px-4 py-2.5">Page suivante</Link> : <span/>}
      </nav>}
      <p className="mt-8 text-xs leading-5 text-[#89938d]">{isDemo ? "Les informations et prix présentés sont des données de démonstration. Ils doivent être confirmés par l’équipe avant toute décision." : "Annonces publiées par l’équipe Sama Kër. Les prix, caractéristiques et disponibilités sont à confirmer auprès de l’équipe."}</p>
    </section>
  </PageShell>;
}