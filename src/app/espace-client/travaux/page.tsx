import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ClientConstructionWork } from "@/components/client-construction-work";
import { PageShell } from "@/components/page-shell";
import { isClientSpaceConfigured } from "@/lib/client-space";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Suivi de mes travaux",
  robots: { index: false, follow: false },
};

export default async function ClientConstructionPage() {
  await connection();
  if (!isClientSpaceConfigured()) {
    return <PageShell><section className="container py-16"><p role="alert" className="mx-auto max-w-lg rounded-xl bg-[#f8f2e8] p-5 text-sm text-[#775d34]">Le suivi des travaux est désactivé : configurez Supabase Auth et l’URL du service API.</p></section></PageShell>;
  }
  const { data: { user }, error } = await (await createClient()).auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") {
    return <PageShell><section className="container py-16"><p role="alert" className="mx-auto max-w-lg rounded-xl bg-[#fbf0ee] p-5 text-sm text-[#8d3c32]">Votre session ne peut pas être vérifiée pour le moment.</p></section></PageShell>;
  }
  if (!user?.email) redirect("/espace-client/connexion");

  return <PageShell><section className="container max-w-6xl space-y-8 py-12">
    <Link href="/espace-client" className="text-sm font-semibold text-[#174c38]">← Retour à Mon espace</Link>
    {process.env.NEXT_PUBLIC_CONSTRUCTION_WORK_ENABLED === "true"
      ? <ClientConstructionWork/>
      : <p role="status" className="rounded-xl bg-[#f8f2e8] p-5 text-sm text-[#775d34]">Le suivi des travaux est désactivé jusqu’à l’application et la recette de sa migration Supabase.</p>}
  </section></PageShell>;
}
