"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Building2, ChevronLeft, ChevronRight, Compass, Hammer, MapPin, Pause, Play, Search, SlidersHorizontal } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { PropertyCard } from "@/components/property-card";
import type { Property } from "@/lib/properties";
import { useDataSaver } from "@/components/data-saver";

const categories = [
  { label: "Acheter", href: "/immobilier" },
  { label: "Louer", href: "/immobilier?statut=%C3%80+louer" },
  { label: "Parcelle", href: "/terrains" },
  { label: "Construire", href: "/services" },
] as const;

const shortcuts = [
  { label: "Parcelle", detail: "Parcelles & lots", href: "/terrains", icon: Compass },
  { label: "Immobilier", detail: "Maisons & locations", href: "/immobilier", icon: Building2 },
  { label: "Construction", detail: "Du terrain aux clés", href: "/services", icon: Hammer },
  { label: "Carte", detail: "Explorer les lieux", href: "/carte", icon: MapPin },
] as const;

export function SamaKeurHome({ properties }: { properties: Property[] }) {
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]["label"]>("Acheter");
  const [showcasePaused, setShowcasePaused] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dataSaver = useDataSaver();

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (showcasePaused || reducedMotion || dataSaver) return;
    const timer = window.setInterval(() => setActiveSlide((slide) => (slide + 1) % 2), 6500);
    return () => window.clearInterval(timer);
  }, [showcasePaused, reducedMotion, dataSaver]);

  return (
    <PageShell>
      <div className="container">
        <section className="pb-7 pt-8 sm:pb-10 sm:pt-12">
          <div className={`home-showcase relative isolate overflow-hidden rounded-[26px] bg-[#174c38] p-5 sm:p-8 ${showcasePaused || reducedMotion || dataSaver ? "home-showcase--paused" : ""}`}>
            <Image
              src="/images/parcel.jpg"
              alt=""
              fill
              loading="eager"
              sizes="(max-width: 640px) 100vw, 1240px"
              className={`home-showcase__image object-cover ${activeSlide === 0 ? "home-showcase__image--active" : ""}`}
            />
            {(!dataSaver || activeSlide === 1) && <Image
              src="/images/immobilier2%20(2).jpg"
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 1240px"
              className={`home-showcase__image object-cover ${activeSlide === 1 ? "home-showcase__image--active" : ""}`}
            />}
            <div className="home-showcase__shade absolute inset-0" aria-hidden="true"/>
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-[.17em] text-[#e2c893]">Immobilier &amp; expertise géospatiale · Sénégal</span>
                  <h1 className="mt-3 max-w-[700px] text-[clamp(2rem,5vw,3.8rem)] font-semibold leading-[1.04] tracking-[-.045em] text-white">
                    Votre projet mérite<br className="hidden sm:block"/> une vision du territoire.
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/85 sm:mt-4 sm:text-base">
                    Terrains, immobilier et accompagnement géospatial : explorez les possibilités avec Sama Kër.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex w-full max-w-[560px] gap-1 overflow-x-auto rounded-full bg-black/30 p-1 backdrop-blur" role="tablist" aria-label="Type de projet">
                {categories.map((category) => (
                  <button
                    key={category.label}
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === category.label}
                    onClick={() => setActiveCategory(category.label)}
                    className={`min-h-10 shrink-0 rounded-full px-4 text-[11px] font-semibold transition sm:px-5 ${activeCategory === category.label ? "bg-white text-[#18201b] shadow-sm" : "text-white hover:bg-white/15"}`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>

              <form action={activeCategory === "Parcelle" ? "/terrains" : activeCategory === "Louer" || activeCategory === "Acheter" ? "/immobilier" : "/services"} method="get" className="mt-3 flex max-w-[700px] items-center gap-2 rounded-full border border-[#e7e9e7] bg-white p-2 pl-4 shadow-[0_8px_28px_rgba(27,38,30,.15)]">
                {activeCategory === "Louer" && <input type="hidden" name="statut" value="À louer"/>}
                <Search size={17} className="shrink-0 text-[#56605a]"/>
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Rechercher un bien ou un lieu</span>
                  <input name="localisation" placeholder="Ville, quartier ou type de bien…" className="h-10 w-full bg-transparent text-xs text-[#242a26] outline-none placeholder:text-[#56605a] sm:text-sm"/>
                </label>
                <Link href="/terrains" aria-label="Filtres avancés" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f5f1e8] text-[#515b54] hover:bg-[#e3ebe3]">
                  <SlidersHorizontal size={16}/>
                </Link>
                <button type="submit" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#174c38] text-white hover:bg-[#24674d] sm:flex sm:w-auto sm:gap-2 sm:px-5">
                  <Search size={15}/>
                  <span className="hidden text-xs font-semibold sm:inline">Rechercher</span>
                  <span className="sr-only sm:hidden">Rechercher</span>
                </button>
              </form>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs leading-4 text-white/75">
              Visuels d’inspiration uniquement · ils ne représentent pas des annonces vérifiées.
                </p>
                <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label="Afficher la photo précédente"
                onClick={() => setActiveSlide((slide) => (slide + 1) % 2)}
                className="home-showcase__control grid size-9 place-items-center rounded-full border border-white/40 bg-black/30 text-white backdrop-blur"
              >
                <ChevronLeft size={17} aria-hidden="true"/>
              </button>
              {!dataSaver && <button
                type="button"
                aria-label={showcasePaused ? "Reprendre le diaporama" : "Mettre le diaporama en pause"}
                aria-pressed={showcasePaused}
                onClick={() => setShowcasePaused((paused) => !paused)}
                className="home-showcase__motion-control grid size-10 place-items-center rounded-full border border-white/50 bg-white text-[#174c38] shadow-lg"
              >
                {showcasePaused ? <Play size={16} aria-hidden="true"/> : <Pause size={16} aria-hidden="true"/>}
              </button>}
              <button
                type="button"
                aria-label="Afficher la photo suivante"
                onClick={() => setActiveSlide((slide) => (slide + 1) % 2)}
                className="home-showcase__control grid size-9 place-items-center rounded-full border border-white/40 bg-black/30 text-white backdrop-blur"
              >
                <ChevronRight size={17} aria-hidden="true"/>
              </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {shortcuts.map(({ label, detail, href, icon: Icon }) => (
              <Link key={href} href={href} className="home-shortcut group flex min-h-[86px] items-center gap-3 rounded-2xl border border-[#e7e9e7] bg-white p-3.5 hover:border-[#cbd9cc] hover:shadow-[0_8px_24px_rgba(24,38,26,.06)] sm:min-h-[96px] sm:p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eef3ee] text-[#4c8551] transition group-hover:bg-[#deebde]"><Icon size={18}/></span>
                <span className="min-w-0"><strong className="block text-xs font-semibold text-[#202722] sm:text-sm">{label}</strong><span className="mt-1 block text-xs leading-4 text-[#56605a] sm:text-xs">{detail}</span></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="pb-9 sm:pb-12">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <span className="eyebrow">À découvrir</span>
              <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[#174c38] sm:text-2xl">Des lieux pour vos projets</h2>
            </div>
            <Link href="/terrains" className="inline-flex items-center gap-1.5 pb-1 text-xs font-semibold text-[#4c8551] sm:text-xs">
              Tout voir <ArrowRight size={14}/>
            </Link>
          </div>
          {properties.some((property) => property.isDemo) && <p className="mb-4 rounded-xl bg-[#f0f1ee] px-3 py-2 text-xs leading-4 text-[#56605a]">
            Annonces et images de démonstration : informations, prix et disponibilités non vérifiés.
          </p>}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {properties.filter((property) => property.isDemo ? property.featured : true).slice(0, 3).map((property) => (
              <PropertyCard key={property.slug} property={property}/>
            ))}
          </div>
          {properties.length === 0 && <p className="rounded-xl bg-[#f0f1ee] px-4 py-6 text-sm text-[#56605a]">Aucune annonce publiée pour le moment.</p>}
        </section>

        <section className="pb-10 sm:pb-14">
          <Link href="/carte" className="group relative block min-h-[250px] overflow-hidden rounded-[26px] bg-[#151817] p-5 text-white sm:min-h-[300px] sm:p-8">
            <div className="dark-map absolute inset-0 opacity-90"/>
            <span className="map-road left-[-6%] top-[35%] w-[82%] rotate-[21deg]"/>
            <span className="map-road left-[33%] top-[-5%] w-[79%] rotate-[76deg]"/>
            <span className="map-road left-[1%] top-[83%] w-[84%] rotate-[-18deg]"/>
            <span className="absolute left-[22%] top-[46%] grid size-10 place-items-center rounded-full border-4 border-[#151817] bg-[#4d9057] text-white shadow-[0_0_26px_rgba(91,160,91,.38)]"><MapPin size={15} fill="currentColor"/></span>
            <span className="absolute left-[62%] top-[26%] grid size-9 place-items-center rounded-full border-4 border-[#151817] bg-[#b38a4a] text-white"><MapPin size={13} fill="currentColor"/></span>
            <span className="absolute left-[71%] top-[68%] grid size-9 place-items-center rounded-full border-4 border-[#151817] bg-[#4d9057] text-white"><MapPin size={13} fill="currentColor"/></span>
            <div className="relative z-10 flex min-h-[210px] flex-col justify-between sm:min-h-[236px]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-[.17em] text-[#aeb7b0]">Explorer le territoire</span>
                  <h2 className="mt-2 max-w-[300px] text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">Les biens, sur la carte.</h2>
                  <p className="mt-2 max-w-[300px] text-xs leading-5 text-white/60">Repères illustratifs uniquement · positions à confirmer.</p>
                </div>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[#141815] transition group-hover:bg-[#dcebdc]"><ArrowUpRight size={18}/></span>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-2 text-xs font-semibold text-white/85 backdrop-blur">
                <MapPin size={13} className="text-[#7eb67e]"/> Ouvrir l’aperçu cartographique
              </span>
            </div>
          </Link>
        </section>

        <section className="mb-8 grid gap-4 rounded-[26px] bg-[#e9ede8] p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
          <div>
            <span className="eyebrow">L’accompagnement Sama Kër</span>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#174c38] sm:text-2xl">Du terrain à la maison, à votre rythme.</h2>
            <p className="mt-2 max-w-xl text-xs leading-5 text-[#6e7770]">GéoSpatia Consulting réunit immobilier, construction et savoir-faire géospatial dans un même parcours.</p>
          </div>
          <Link href="/services" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#174c38] px-5 text-xs font-semibold text-white transition hover:bg-[#24674d]">
            Découvrir les services <ArrowRight size={14}/>
          </Link>
        </section>
      </div>
    </PageShell>
  );
}
