import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { SamaKeurLogo } from "@/components/sama-keur-logo";

export const metadata: Metadata = {
  title: "Connexion administration",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  await connection();
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.ADMIN_EMAILS?.trim(),
  );

  return <main className="grid min-h-screen place-items-center bg-[#f5f7f5] p-5">
    <section className="w-full max-w-md rounded-2xl border border-[#e6ebe6] bg-white p-7 shadow-sm">
      <Link href="/" aria-label="Sama Kër — accueil"><SamaKeurLogo/></Link>
      <h1 className="mt-2 text-2xl font-semibold text-[#18371d]">Administration</h1>
      <p className="mt-2 text-sm text-[#56605a]">Connectez-vous avec un compte autorisé.</p>
      {configured
        ? <LoginForm />
        : <p role="alert" className="mt-6 rounded-lg bg-[#f8f2e8] p-3 text-xs leading-5 text-[#775d34]">
          Connexion désactivée : configurez Supabase Auth et la liste des comptes autorisés dans l’environnement serveur.
        </p>}
      <Link href="/" className="mt-6 inline-block text-xs font-semibold text-[#477052]">Retour au site public</Link>
    </section>
  </main>;
}
