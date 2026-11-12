import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { PropertyCard } from "@/components/property-card";
import { getPublicProperties } from "@/lib/public-properties";

const communeNames: Record<string, string> = { thies: "Thiès", dakar: "Dakar", saly: "Saly", "keur-massar": "Keur Massar" };
export async function generateMetadata({ params }: { params: Promise<{ commune: string }> }): Promise<Metadata> {
  const commune = (await params).commune;
  const name = communeNames[commune] ?? commune.replaceAll("-", " ");
  return { title: `Biens et terrains à ${name}`, description: `Découvrez les opportunités foncières et immobilières à ${name}.` };
}
export default async function LocalityPage({ params }: { params: Promise<{ commune: string }> }) {
  const commune = (await params).commune;
  const properties = await getPublicProperties();
  const name = communeNames[commune] ?? commune.replaceAll("-", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const listings = properties.filter((property) => property.location.toLowerCase().includes(name.toLowerCase()));
  return <PageShell><section className="bg-[#174c38] py-16 text-white"><div className="container"><span className="eyebrow text-[#a6c8ad]">Découvrir nos zones</span><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Nos biens à {name}.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-white/65">Une sélection de biens dans la région de {name}. Chaque fiche est à confirmer auprès de notre équipe.</p></div></section><section className="container py-12"><p className="mb-6 flex items-center gap-2 text-sm text-[#718078]"><MapPin size={15}/>{listings.length} bien(s) associé(s) à {name}</p>{listings.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{listings.map((property) => <PropertyCard key={property.slug} property={property}/>)}</div> : <div className="rounded-2xl border border-dashed border-[#dce3dc] bg-white p-10 text-center"><p className="text-sm text-[#718078]">Aucun bien publié n’est associé à cette zone.</p><Link href="/contact" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#174c38]">Nous contacter <ArrowRight size={15}/></Link></div>}{listings.some((property) => property.isDemo) && <p className="mt-8 text-xs leading-5 text-[#89938d]">Page locale générée à titre de démonstration ; le contenu éditorial et les biens doivent être vérifiés avant publication.</p>}</section></PageShell>;
}