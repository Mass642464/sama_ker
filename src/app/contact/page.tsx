import type { Metadata } from "next";
import { Clock3, Mail, MapPin } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { PageShell } from "@/components/page-shell";
import { VisitScheduler } from "@/components/visit-scheduler";
import { properties } from "@/lib/properties";
import { getPublicProperties } from "@/lib/public-properties";

export const metadata: Metadata = { title: "Contact", description: "Contactez notre équipe pour parler de votre projet foncier, immobilier ou géospatial." };
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ bien?: string; visite?: string; motif?: string; apercuVisite?: string }> }) {
  const params = await searchParams;
  if (params.apercuVisite === "1") {
    return <PageShell><VisitScheduler property={properties[0]}/></PageShell>;
  }
  if (params.visite) {
    const property = (await getPublicProperties()).find((item) => item.ref === params.visite);
    return <PageShell>{property
      ? <VisitScheduler property={property}/>
      : <section className="container py-16"><h1 className="text-2xl font-semibold text-[#174c38]">Bien introuvable</h1><p className="mt-3 text-sm text-[#596b61]">Cette annonce n’est pas disponible pour une demande de visite. Revenez au catalogue pour choisir un bien publié.</p></section>}</PageShell>;
  }
  const reference = params.bien ?? params.visite;
  const initialSubject = params.motif === "signalement" ? "report" : params.visite ? "visit" : "property";
  return <PageShell><section className="bg-[#174c38] py-14 text-white"><div className="container"><span className="eyebrow text-[#a6c8ad]">Restons en contact</span><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Parlons de votre projet.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-white/65">Une demande d’information, un rendez-vous ou une question sur nos expertises ? Écrivez-nous.</p></div></section><section className="container grid gap-10 py-12 lg:grid-cols-[.75fr_1.25fr]"><div className="space-y-4">{[{ icon: MapPin, title: "Notre implantation", text: "Tivaouane, Sénégal — adresse à confirmer" }, { icon: Mail, title: "Écrivez-nous", text: "Adresse e-mail à renseigner" }, { icon: Clock3, title: "Disponibilité", text: "Horaires d’accueil à renseigner" }].map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-4 rounded-2xl border border-[#e6eae4] bg-white p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf4ee] text-[#3d7759]"><Icon size={18}/></span><div><h2 className="text-sm font-bold text-[#174c38]">{title}</h2><p className="mt-1 text-sm text-[#718078]">{text}</p></div></div>)}<div className="map-grid relative h-[230px] overflow-hidden rounded-2xl"><span className="absolute left-1/2 top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-[#174c38] text-white"><MapPin size={16} fill="currentColor"/></span><span className="absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-1 text-[10px] text-[#586a60]">Carte illustrative — position à confirmer</span></div></div><div>{reference && <p className="mb-4 rounded-xl bg-[#edf4ee] px-4 py-3 text-sm text-[#3d7759]">Votre demande concerne la référence <strong>{reference}</strong>.</p>}<ContactForm propertyReference={reference} initialSubject={initialSubject}/></div></section></PageShell>;
}