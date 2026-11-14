import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { isClientSpaceConfigured } from "@/lib/client-space";
import { createClient } from "@/lib/supabase/server";
import { AuthForms } from "./auth-forms";

export const metadata: Metadata = {
  title: "Mon espace",
  description: "Connectez-vous pour suivre vos demandes auprès de Sama Kër.",
  robots: { index: false, follow: false },
};

export default async function ClientLoginPage({ searchParams }: { searchParams: Promise<{ mode?: string; erreur?: string; compte?: string }> }) {
  await connection();
  const params = await searchParams;
  const configured = isClientSpaceConfigured();

  if (configured) {
    const { data: { user } } = await (await createClient()).auth.getUser();
    if (user) redirect("/espace-client");
  }

  return <PageShell>
    <section className="bg-[#18371d] py-14 text-white"><div className="container">
      <span className="eyebrow text-[#a6c8ad]">Mon espace</span>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Suivez vos demandes.</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-white/65">Retrouvez vos demandes d’information et de visite, leur avancement et vos rendez-vous au même endroit.</p>
    </div></section>
    <section className="container py-12"><div className="mx-auto max-w-md rounded-2xl border border-[#e5e9e3] bg-white p-6 sm:p-8">
      {params.erreur === "confirmation" && <p role="alert" className="mb-5 rounded-xl bg-[#fbf0ee] px-4 py-3 text-xs leading-5 text-[#8d3c32]">Le lien de confirmation est invalide ou expiré. Connectez-vous, ou créez de nouveau votre espace pour recevoir un nouveau lien.</p>}
      {params.erreur === "reinitialisation" && <p role="alert" className="mb-5 rounded-xl bg-[#fbf0ee] px-4 py-3 text-xs leading-5 text-[#8d3c32]">Le lien de réinitialisation est invalide ou expiré. Demandez un nouveau lien.</p>}
      {params.compte === "supprime" && <p role="status" className="mb-5 rounded-xl bg-[#edf4ee] px-4 py-3 text-xs leading-5 text-[#3d7759]">Votre compte a été supprimé.</p>}
      {configured
        ? <AuthForms initialMode={params.mode === "inscription" ? "inscription" : params.mode === "oubli" ? "oubli" : "connexion"}/>
        : <p role="alert" className="rounded-xl bg-[#f8f2e8] p-4 text-xs leading-5 text-[#775d34]">L’espace client est désactivé : l’authentification et le service de demandes ne sont pas configurés.</p>}
      <p className="mt-6 text-[11px] leading-5 text-[#56605a]">Le compte est facultatif : vous pouvez aussi écrire à l’équipe sans compte depuis la page Contact, mais la demande ne sera alors pas visible ici.</p>
    </div></section>
  </PageShell>;
}
