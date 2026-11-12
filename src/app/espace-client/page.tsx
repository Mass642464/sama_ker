import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { ClientAccountDeletion, ClientFollowUp, type CatalogEntry } from "@/components/client-follow-up";
import { ClientRequests } from "@/components/client-requests";
import { ClientVisits } from "@/components/client-visits";
import { ContactForm } from "@/components/contact-form";
import { PageShell } from "@/components/page-shell";
import { isClientSpaceConfigured } from "@/lib/client-space";
import { getPropertyCatalog } from "@/lib/public-properties";
import { createClient } from "@/lib/supabase/server";
import { signOutClient } from "./actions";

export const metadata: Metadata = {
  title: "Mon espace",
  robots: { index: false, follow: false },
};

export default async function ClientSpacePage() {
  await connection();
  if (!isClientSpaceConfigured()) {
    return <PageShell><section className="container py-16"><p role="alert" className="mx-auto max-w-lg rounded-xl bg-[#f8f2e8] p-5 text-sm leading-6 text-[#775d34]">L’espace client est désactivé : configurez Supabase Auth et l’URL du service API avant de l’utiliser.</p></section></PageShell>;
  }

  const { data: { user }, error } = await (await createClient()).auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") {
    return <PageShell><section className="container py-16"><p role="alert" className="mx-auto max-w-lg rounded-xl bg-[#fbf0ee] p-5 text-sm leading-6 text-[#8d3c32]">Votre session ne peut pas être vérifiée pour le moment. Réessayez plus tard.</p></section></PageShell>;
  }
  if (!user) redirect("/espace-client/connexion");

  // Catalogue public : sert uniquement à afficher le titre et le prix des favoris.
  const { properties } = await getPropertyCatalog();
  const catalog: CatalogEntry[] = properties.map((property) => ({
    slug: property.slug,
    title: property.title,
    priceLabel: property.priceLabel,
    href: `/${property.category === "terrain" ? "terrains" : "immobilier"}/${property.slug}`,
  }));

  return <PageShell>
    <section className="bg-[#18371d] py-12 text-white"><div className="container flex flex-wrap items-end justify-between gap-4">
      <div>
        <span className="eyebrow text-[#a6c8ad]">Mon espace</span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Bonjour{user.email ? `, ${user.email}` : ""}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">Suivez l’avancement de vos demandes, vos favoris et vos alertes. Les notifications apparaissent ici ; aucun e-mail n’est envoyé pour le moment.</p>
      </div>
      <form action={signOutClient}><button className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-white/10"><LogOut size={14}/>Se déconnecter</button></form>
    </div></section>
    {(process.env.NEXT_PUBLIC_CLIENT_VAULT_ENABLED === "true" || process.env.NEXT_PUBLIC_CONSTRUCTION_WORK_ENABLED === "true") && <section className="container grid gap-3 pt-8 sm:grid-cols-2">
      {process.env.NEXT_PUBLIC_CLIENT_VAULT_ENABLED === "true" && <Link href="/espace-client/coffre" className="rounded-2xl border border-[#e6e0d5] bg-white p-5 transition hover:border-[#9db69f]"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#60856c]">Mes documents</span><strong className="mt-2 block text-lg text-[#18371d]">Ouvrir mon coffre personnel</strong><span className="mt-1 block text-sm text-[#718078]">Accès privé à vos fichiers</span></Link>}
      {process.env.NEXT_PUBLIC_CONSTRUCTION_WORK_ENABLED === "true" && <Link href="/espace-client/travaux" className="rounded-2xl border border-[#e6e0d5] bg-white p-5 transition hover:border-[#9db69f]"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#60856c]">Suivi de chantier</span><strong className="mt-2 block text-lg text-[#18371d]">Consulter mes travaux</strong><span className="mt-1 block text-sm text-[#718078]">Phases et mises à jour publiées</span></Link>}
    </section>}
    <section className="container grid gap-10 py-12 lg:grid-cols-[1.1fr_.9fr]">
      <div className="space-y-12">
        <ClientRequests/>
        {process.env.NEXT_PUBLIC_VISIT_AGENDA_ENABLED === "true" && <ClientVisits/>}
        <ClientFollowUp catalog={catalog}/>
      </div>
      <div className="space-y-10">
        <div>
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-[#18371d]">Nouvelle demande</h2>
          <ContactForm/>
        </div>
        <ClientAccountDeletion/>
      </div>
    </section>
  </PageShell>;
}
