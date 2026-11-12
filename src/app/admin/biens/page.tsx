"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Building2, MapPinned } from "lucide-react";
import { AdminPropertiesTable } from "@/components/admin-properties-table";
import { adminApi, type AdminListing } from "@/lib/admin-api";

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<AdminListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    adminApi<AdminListing[]>("/api/admin/properties")
      .then((result) => { if (active) setProperties(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Les annonces n’ont pas pu être chargées."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const land = properties.filter((property) => property.category === "terrain").length;
  const realEstate = properties.length - land;
  const published = properties.filter((property) => property.publicationStatus === "published").length;
  const cards = [
    { label: "Terrains", value: land, icon: MapPinned, tone: "bg-[#edf4ee] text-[#3d7759]" },
    { label: "Biens immobiliers", value: realEstate, icon: Building2, tone: "bg-[#ecf2ed] text-[#497651]" },
    { label: "Annonces publiées", value: published, icon: BadgeCheck, tone: "bg-[#f6f0e6] text-[#987444]" },
  ];

  return <div>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#60856c]">Catalogue</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#18371d] sm:text-3xl">Gestion des biens</h1><p className="mt-2 text-xs text-[#718078]">Retrouvez vos annonces, gérez leur disponibilité et consultez les positions publiées.</p></div><span className="w-fit rounded-lg border border-[#e5eae5] bg-white px-3 py-2 text-[10px] font-semibold text-[#6a7a71]">Espace sécurisé</span></div>
    {error && <p role="alert" className="mt-5 rounded-lg bg-[#fbf0ee] p-3 text-xs text-[#8d3c32]">{error}</p>}
    <div className="mt-6 grid gap-3 sm:grid-cols-3">{cards.map(({ label, value, icon: Icon, tone }) => <article key={label} className="flex items-center gap-3 rounded-2xl border border-[#e6ebe6] bg-white p-4"><span className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon size={17}/></span><div><p className="text-[10px] text-[#849188]">{label}</p><p className="mt-0.5 text-xl font-semibold text-[#18371d]">{loading ? "—" : value}</p></div></article>)}</div>
    <div className="mt-6">{loading
      ? <p className="rounded-2xl border border-[#e6ebe6] bg-white p-10 text-center text-xs text-[#849188]">Chargement des annonces…</p>
      : error ? null : <AdminPropertiesTable properties={properties} onPropertiesChange={setProperties}/>}</div>
  </div>;
}
