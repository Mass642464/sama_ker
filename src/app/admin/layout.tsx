import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s | Administration" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  if (!process.env.ADMIN_EMAILS?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return <main className="grid min-h-screen place-items-center bg-[#f5f7f5] p-5"><p role="alert" className="max-w-lg rounded-xl bg-[#f8f2e8] p-5 text-sm text-[#775d34]">L’administration est désactivée : configurez Supabase Auth et au moins un compte autorisé avant de continuer.</p></main>;
  }
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") {
    return <main className="grid min-h-screen place-items-center bg-[#f5f7f5] p-5"><p role="alert" className="max-w-lg rounded-xl bg-[#fbf0ee] p-5 text-sm text-[#8d3c32]">La session ne peut pas être vérifiée pour le moment. Réessayez plus tard.</p></main>;
  }
  if (!user) redirect("/connexion-admin");
  if (!user.email) {
    return <main className="grid min-h-screen place-items-center bg-[#f5f7f5] p-5"><p role="alert" className="max-w-lg rounded-xl bg-[#f8f2e8] p-5 text-sm text-[#775d34]">Ce compte n’a pas d’adresse e-mail vérifiable.</p></main>;
  }
  // Le rôle et les droits sont déterminés par l’API (table de l’équipe) : AdminShell les charge et refuse les comptes hors équipe.
  return <AdminShell email={user.email}>{children}</AdminShell>;
}