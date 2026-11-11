import type { Metadata } from "next";
import { connection } from "next/server";
import { PageShell } from "@/components/page-shell";
import { isClientSpaceConfigured } from "@/lib/client-space";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "@/components/password-reset-forms";

export const metadata: Metadata = {
  title: "Nouveau mot de passe",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage() {
  await connection();
  const configured = isClientSpaceConfigured();
  const { data: { user } } = configured ? await (await createClient()).auth.getUser() : { data: { user: null } };

  return <PageShell>
    <section className="container py-12"><div className="mx-auto max-w-md rounded-2xl border border-[#e5e9e3] bg-white p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-[#18371d]">Nouveau mot de passe</h1>
      <div className="mt-6">
        {!configured
          ? <p role="alert" className="rounded-xl bg-[#f8f2e8] p-4 text-xs leading-5 text-[#775d34]">L’espace client est désactivé.</p>
          : user
            ? <NewPasswordForm/>
            : <p role="alert" className="rounded-xl bg-[#fbf0ee] p-4 text-xs leading-5 text-[#8d3c32]">Ce lien n’est plus valide. <a href="/espace-client/connexion?mode=oubli" className="font-bold underline">Demandez un nouveau lien</a>.</p>}
      </div>
    </div></section>
  </PageShell>;
}
