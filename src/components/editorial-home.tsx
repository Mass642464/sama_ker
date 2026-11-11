"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Building2, Compass, MapPin, MoveUpRight, Search, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { PropertyCard } from "@/components/property-card";
import { properties } from "@/lib/properties";

const services = [
  { icon: Compass, number: "01", title: "Lire le territoire", text: "Des données spatiales claires pour révéler les possibilités d’un lieu." },
  { icon: Building2, number: "02", title: "Trouver votre lieu", text: "Terrains et biens choisis pour donner corps à vos projets au Sénégal." },
  { icon: ShieldCheck, number: "03", title: "Avancer sereinement", text: "Un accompagnement de proximité, attentif à chaque étape." },
];

function LandscapeIllustration() {
  return (
    <svg className="h-full w-full" viewBox="0 0 1600 680" preserveAspectRatio="xMidYMax slice" role="img" aria-labelledby="landscape-title">
      <title id="landscape-title">Illustration d’une maison contemporaine devant un paysage sénégalais</title>
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#eee5d7"/><stop offset=".66" stopColor="#e8dacc"/><stop offset="1" stopColor="#d9c9ad"/></linearGradient>
        <linearGradient id="hills" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#758679"/><stop offset="1" stopColor="#3e594b"/></linearGradient>
        <linearGradient id="wall" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#f7f1e6"/><stop offset="1" stopColor="#d7cbbb"/></linearGradient>
        <linearGradient id="glass" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#425b5a"/><stop offset="1" stopColor="#9cae9f"/></linearGradient>
        <linearGradient id="field" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#8d9879"/><stop offset="1" stopColor="#606f53"/></linearGradient>
      </defs>
      <rect width="1600" height="680" fill="url(#sky)"/>
      <circle cx="1260" cy="145" r="75" fill="#f6ebd8" opacity=".7"/>
      <path d="M0 378 165 246l104 89 159-175 140 173 118-102 163 152 146-189 149 155 152-115 144 130 160-68v204H0Z" fill="#a9a999" opacity=".38"/>
      <path d="m0 415 168-112 111 85 159-146 134 144 117-86 164 107 142-157 149 121 143-85 153 112 160-73v178H0Z" fill="url(#hills)" opacity=".72"/>
      <path d="M0 438q200-54 377 5t355-1q205-53 438 4t430-5v239H0Z" fill="url(#field)"/>
      <path d="M0 536q247-50 515 3t497-3q298-43 588 0v144H0Z" fill="#737e5e" opacity=".7"/>
      <path d="M0 612q318-49 585 0t495 0q255-35 520 0v68H0Z" fill="#4e604c" opacity=".7"/>
      <path d="M1012 680q62-77 194-126t394-59v185Z" fill="#c4b394" opacity=".9"/>
      <g opacity=".7" fill="#394f41"><path d="M205 454q-30-65 5-104 39 42 13 104Zm-5 0h28v57h-28z"/><path d="M335 439q-34-70 3-111 43 46 15 111Zm-7 0h29v67h-29z"/><path d="M1450 458q-30-65 5-104 39 42 13 104Zm-5 0h28v57h-28z"/><path d="M1370 445q-34-70 3-111 43 46 15 111Zm-7 0h29v67h-29z"/></g>
      <ellipse cx="1115" cy="560" rx="310" ry="32" fill="#33463a" opacity=".24"/>
      <g>
        <path d="m816 355 192-102 349 47-196 114Z" fill="#f8f4ed"/>
        <path d="m816 355 345 59v159l-345-59Z" fill="url(#wall)"/>
        <path d="m1161 414 196-114v159l-196 114Z" fill="#cabfae"/>
        <path d="m829 348 178-97 345 49-184 107Z" fill="#283e37"/>
        <path d="m829 348 339 57v16l-339-59Z" fill="#d4bd91"/>
        <path d="m850 377 95 17v111l-95-16Z" fill="url(#glass)"/>
        <path d="m965 397 76 13v110l-76-13Z" fill="#465d55"/>
        <path d="m1056 412 88 15v112l-88-15Z" fill="url(#glass)"/>
        <path d="m1176 440 161-93v78l-161 93Z" fill="url(#glass)"/>
        <path d="m834 534 329 58v10l-329-58Z" fill="#3e5146"/>
        <path d="m1162 592 195-113v10l-195 113Z" fill="#33473c"/>
        <path d="m1008 253 349 47-196 114-345-59Z" fill="#e8dfd1" opacity=".85"/>
        <path d="m1008 253 349 47-196 114-345-59Z" fill="none" stroke="#fffaf0" strokeWidth="5"/>
        <path d="m1008 253v-28l350 48v27" fill="none" stroke="#253b35" strokeWidth="10"/>
        <path d="m1162 414 1 178" stroke="#f1e9dc" strokeWidth="4" opacity=".7"/>
      </g>
      <g fill="#354d3e" opacity=".9"><path d="M692 534q-22-48 4-77 29 31 10 77Zm-3 0h21v44h-21z"/><path d="M755 550q-20-43 4-70 26 28 9 70Zm-2 0h19v39h-19z"/><path d="M1430 525q-22-48 4-77 29 31 10 77Zm-3 0h21v44h-21z"/></g>
      <path d="M0 619q165-31 323 0t337 1" fill="none" stroke="#d6c6a8" strokeWidth="3" opacity=".65"/>
      <path d="M33 656q190-29 348 1t276 0" fill="none" stroke="#d6c6a8" strokeWidth="2" opacity=".45"/>
    </svg>
  );
}

export function EditorialHome() {
  const [activeTab, setActiveTab] = useState("Terrain");
  const target = activeTab === "Terrain" ? "/terrains" : "/immobilier";

  return (
    <PageShell>
      <section className="relative isolate min-h-[690px] overflow-hidden bg-[#eee9df] sm:min-h-[710px]">
        <Image src="/images/acceuil.jpg" alt="Vue d’ambiance d’un ensemble résidentiel — lieu à confirmer" fill priority sizes="100vw" className="object-cover object-[center_58%]"/>
        <div className="absolute inset-0 bg-gradient-to-r from-[#eee9df]/55 via-[#eee9df]/32 to-[#eee9df]/10"/>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] opacity-10 sm:h-[66%]"><LandscapeIllustration/></div>
        <div className="container relative min-h-[690px] pb-40 pt-12 sm:min-h-[710px] sm:pb-48 sm:pt-16">
          <div className="hero-copy max-w-[650px]">
            <p className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-[.25em] text-[#3c6a44]"><span className="h-px w-8 bg-[#6f984d]"/>Sénégal · Terre · Demain</p>
            <h1 className="mt-7 max-w-full font-serif text-[clamp(2.75rem,7vw,5.875rem)] leading-[.96] tracking-[-.055em] text-[#1c4523]">La terre qui<br/>fait pousser<br/><span className="ml-5 italic text-[#648e47] sm:ml-10">vos projets.</span></h1>
            <p className="mt-6 max-w-[390px] text-[13px] leading-6 text-[#647067] sm:text-sm">Des lieux à découvrir, des territoires à comprendre, un accompagnement qui vous ressemble.</p>
            <div className="mt-8 flex flex-wrap items-center gap-7 sm:gap-9"><Link href="/terrains" className="group inline-flex items-center gap-5 rounded-full bg-[#1c4523] px-6 py-3.5 text-xs font-bold text-white transition hover:bg-[#339243]">Découvrir les biens <span className="grid size-7 place-items-center rounded-full bg-[#d6e8d9] text-[#1c4523]"><ArrowUpRight size={14}/></span></Link><Link href="/a-propos" className="text-[11px] font-semibold text-[#3c6a44] underline decoration-[#2a6534] underline-offset-4">Notre approche</Link></div>
          </div>
          <div className="absolute right-6 top-[26%] hidden w-[210px] rounded-2xl border border-white/70 bg-[#fbfaf5]/95 p-4 shadow-[0_18px_45px_-32px_rgba(34,50,40,.5)] backdrop-blur-sm sm:block lg:right-[8%] lg:top-[22%]">
            <div className="flex items-center justify-between"><span className="text-[8px] font-extrabold uppercase tracking-[.16em] text-[#3c6a44]">Exemple · localisation fictive</span><span className="grid size-7 place-items-center rounded-full bg-[#e6efe8] text-[#339243]"><MapPin size={13}/></span></div>
            <p className="mt-3 font-serif text-lg leading-tight text-[#1c4523]">Parcelle à<br/>Thiapong</p>
            <div className="mt-3 flex items-end justify-between border-t border-[#e8e6dc] pt-3"><span className="text-[9px] text-[#112214]">Données d’exemple · 300 m²</span><Link href="/terrains/terrain-thies-thiapong-300m2-ref-t0142" className="text-[10px] font-bold text-[#339243]">Explorer ↗</Link></div>
          </div>
          <div className="absolute bottom-7 left-6 flex items-center gap-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[#344638] sm:bottom-10 sm:left-8"><span className="grid size-8 place-items-center rounded-full border border-[#61765d]/70"><ArrowDownRight size={14}/></span>Un territoire de possibles</div>
          <div className="absolute bottom-7 right-6 hidden items-center gap-2 rounded-full bg-[#fbfaf5]/90 px-3 py-2 text-[8px] font-semibold text-[#52614c] sm:flex sm:bottom-10 sm:right-8">Visuel d’ambiance · lieu à confirmer</div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#172c22]/25 to-transparent"/>
      </section>

      <section id="recherche" className="container relative z-10 -mt-3 pb-8 sm:-mt-5">
        <div className="rounded-2xl border border-[#e9e4d9] bg-[#fbfaf6] p-4 shadow-[0_18px_50px_-35px_rgba(45,58,43,.28)] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><div className="flex gap-1" role="tablist" aria-label="Type de bien">{["Terrain", "Maison", "Location"].map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`rounded-full px-4 py-2 text-[10px] font-bold transition ${activeTab === tab ? "bg-[#e6e9df] text-[#314a36]" : "text-[#8b9186] hover:bg-[#f2f0e9]"}`}>{tab}</button>)}</div><span className="hidden text-[9px] uppercase tracking-[.15em] text-[#9b9f91] sm:inline">Trouver votre prochain lieu</span></div>
          <form action={target} method="get" className="grid gap-3 sm:grid-cols-[1.3fr_1fr_1fr_auto]">
            <label className="flex min-h-[52px] items-center gap-3 rounded-xl bg-[#f1f0e9] px-4"><MapPin className="text-[#75856a]" size={16}/><span className="min-w-0 flex-1"><span className="block text-[8px] font-extrabold uppercase tracking-[.14em] text-[#8f9688]">Destination</span><input name="localisation" placeholder="Ville, quartier…" className="mt-1 w-full bg-transparent text-[11px] text-[#293a30] outline-none placeholder:text-[#a1a59a]"/></span></label>
            <label className="flex min-h-[52px] flex-col justify-center rounded-xl bg-[#f1f0e9] px-4"><span className="text-[8px] font-extrabold uppercase tracking-[.14em] text-[#8f9688]">Budget maximum</span><select name="budget" defaultValue="" className="mt-1 bg-transparent text-[11px] text-[#52624f] outline-none"><option value="">Tous les budgets</option><option value="20000000">Jusqu’à 20 millions</option><option value="50000000">Jusqu’à 50 millions</option><option value="100000000">Jusqu’à 100 millions</option></select></label>
            <label className="flex min-h-[52px] flex-col justify-center rounded-xl bg-[#f1f0e9] px-4"><span className="text-[8px] font-extrabold uppercase tracking-[.14em] text-[#8f9688]">Type de bien</span><select name="type" defaultValue="" className="mt-1 bg-transparent text-[11px] text-[#52624f] outline-none"><option value="">Tout découvrir</option><option value="Terrain">Terrain</option><option value="Maison">Maison</option><option value="Appartement">Appartement</option></select></label>
            <button type="submit" className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#339243] px-6 text-[10px] font-extrabold uppercase tracking-wide text-white transition hover:bg-[#1c4523]"><Search size={15}/> Rechercher</button>
          </form>
        </div>
      </section>

      <section className="section-space">
        <div className="container"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><span className="eyebrow">Lieux choisis avec attention</span><h2 className="mt-3 font-serif text-3xl tracking-tight text-[#293a30] sm:text-[42px]">Un lieu pour la suite.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-[#788076]">Terrains et biens à découvrir, avec des informations à confirmer auprès de notre équipe.</p></div><Link href="/terrains" className="inline-flex items-center gap-2 text-xs font-bold text-[#657b59]">Voir toutes les opportunités <ArrowRight size={15}/></Link></div><div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{properties.filter((property) => property.featured).slice(0, 3).map((property) => <PropertyCard key={property.slug} property={property}/>)}</div></div>
      </section>

      <section className="bg-[#e7e8de] py-16 sm:py-20"><div className="container grid gap-10 md:grid-cols-[.8fr_1.2fr] md:items-center"><div><span className="eyebrow">Le territoire, en perspective</span><h2 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-[#1c4523] sm:text-[42px]">Voir le lieu.<br/><em>Comprendre son potentiel.</em></h2><p className="mt-4 max-w-md text-sm leading-6 text-[#132516]">Une lecture cartographique pour situer les biens et mieux comprendre leur environnement. Les positions actuelles sont illustratives.</p><Link href="/carte" className="mt-6 inline-flex items-center gap-3 rounded-full bg-[#1c4523] px-5 py-3 text-[10px] font-bold text-white">Explorer la carte <MoveUpRight size={14}/></Link></div><div className="relative grid min-h-[290px] grid-cols-[1.15fr_.85fr] gap-3 overflow-hidden rounded-[22px] border-[8px] border-[#f4f1e8] bg-[#d9ddcf] p-3 sm:min-h-[360px]"><Link href="/carte" className="map-grid relative overflow-hidden rounded-[15px]" aria-label="Ouvrir la carte de démonstration"><div className="absolute left-[11%] top-[18%] h-[52%] w-[53%] rotate-[8deg] border border-dashed border-[#577355]/70 bg-[#99b28f]/25"/><div className="absolute left-[58%] top-[52%] h-[24%] w-[27%] -rotate-[12deg] border border-dashed border-[#577355]/70 bg-[#99b28f]/25"/><span className="absolute left-[35%] top-[40%] grid size-9 place-items-center rounded-full border-[3px] border-white bg-[#339243] text-white shadow-lg"><MapPin size={14} fill="currentColor"/></span><span className="absolute left-[70%] top-[32%] grid size-9 place-items-center rounded-full border-[3px] border-white bg-[#339243] text-white shadow-lg"><MapPin size={14} fill="currentColor"/></span><span className="absolute bottom-3 left-3 rounded-full bg-[#fbfaf5] px-3 py-2 text-[8px] font-bold text-[#2f5c36] shadow">Repères illustratifs ↗</span></Link><div className="relative min-h-full overflow-hidden rounded-[15px]"><Image src="/images/Sénégal 🇸🇳.jpg" alt="Visuel fourni représentant un paysage urbain côtier au Sénégal — lieu à confirmer" fill sizes="(max-width: 768px) 40vw, 25vw" className="object-cover object-center"/><span className="absolute inset-x-2 bottom-2 rounded-lg bg-[#fbfaf5]/90 px-2 py-2 text-center text-[8px] font-semibold leading-3 text-[#52614c]">Sénégal · visuel fourni<br/>localisation à confirmer</span></div></div></div></section>

      <section className="section-space bg-[#faf9f5]"><div className="container"><div className="max-w-xl"><span className="eyebrow">Notre savoir-faire</span><h2 className="mt-3 font-serif text-3xl tracking-tight text-[#293a30] sm:text-[42px]">Des racines solides.<br/><em>Des perspectives ouvertes.</em></h2><p className="mt-4 text-sm leading-6 text-[#788076]">Foncier, géospatial et conseil réunis pour accompagner vos idées du premier repérage aux prochaines étapes.</p></div><div className="mt-10 grid gap-4 md:grid-cols-3">{services.map(({ icon: Icon, number, title, text }) => <Link key={number} href="/services" className="group border-t border-[#d8ddd2] py-5 transition hover:border-[#829471]"><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-full bg-[#e8ebdf] text-[#617654]"><Icon size={18}/></span><span className="font-serif text-lg italic text-[#a0a691]">{number}</span></div><h3 className="mt-6 font-serif text-xl text-[#344538]">{title}</h3><p className="mt-2 min-h-[48px] text-xs leading-5 text-[#7b8479]">{text}</p><span className="mt-4 inline-flex items-center gap-2 text-[10px] font-bold text-[#657b59]">Découvrir <ArrowRight size={13} className="transition group-hover:translate-x-1"/></span></Link>)}</div></div></section>

      <section className="container py-16 sm:py-20"><div className="relative overflow-hidden rounded-[26px] bg-[#d9dfd2] p-7 sm:p-12"><div className="absolute -right-10 -top-16 size-64 rounded-full border border-[#687b5b]/20 sm:size-80"/><div className="relative max-w-2xl"><span className="eyebrow">Pour celles et ceux qui sont loin</span><h2 className="mt-3 font-serif text-3xl leading-tight text-[#1c4523] sm:text-[42px]">Un projet au pays.<br/><em>Un lien qui reste proche.</em></h2><p className="mt-4 max-w-lg text-sm leading-6 text-[#19311d]">Un parcours de découverte et d’échange conçu pour avancer à distance, en prenant le temps de chaque étape.</p><Link href="/diaspora" className="mt-7 inline-flex items-center gap-3 rounded-full bg-[#1c4523] px-5 py-3 text-[10px] font-bold text-white transition hover:bg-[#339243]">Découvrir le parcours diaspora <ArrowRight size={14}/></Link></div></div></section>

      <section className="container pb-20 text-center"><span className="eyebrow">La suite commence par un échange</span><h2 className="mt-3 font-serif text-3xl tracking-tight text-[#1c4523] sm:text-[40px]">Parlons de votre projet.</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#19311d]">Expliquez-nous ce que vous imaginez. Nous vous aiderons à identifier les prochaines étapes.</p><Link href="/contact" className="mt-7 inline-flex items-center gap-3 rounded-full bg-[#339243] px-6 py-3.5 text-[11px] font-extrabold uppercase tracking-wide text-white transition hover:bg-[#1c4523]">Nous contacter <ArrowRight size={15}/></Link></section>
    </PageShell>
  );
}
