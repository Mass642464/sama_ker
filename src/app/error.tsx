"use client";

import { useEffect } from "react";
import Link from "next/link";

type ErrorPageProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function ErrorPage({ error, retry }: ErrorPageProps) {
  useEffect(() => {
    console.error("Sama Kër page error", error.digest ?? "no-digest");
  }, [error.digest]);

  return (
    <main className="grid min-h-[60vh] place-items-center bg-[#f5f1e8] px-5 py-16 text-[#263238]" aria-labelledby="error-title">
      <section className="w-full max-w-lg rounded-2xl border border-[#e3dccf] bg-white p-7 shadow-sm sm:p-10" role="alert">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[#52655b]">Sama Kër</p>
        <h1 id="error-title" className="mt-3 text-2xl font-semibold text-[#174c38]">Une erreur est survenue.</h1>
        <p className="mt-3 text-sm leading-6 text-[#263238]">La page n’a pas pu être chargée. Réessayez ou revenez à l’accueil.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => retry()} className="min-h-11 rounded-full bg-[#174c38] px-5 text-sm font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#a17229]">Réessayer</button>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-[#52655b] px-5 text-sm font-bold text-[#263238] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#a17229]">Retour à l’accueil</Link>
        </div>
      </section>
    </main>
  );
}
