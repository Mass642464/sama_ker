"use client";

import { useEffect } from "react";
import "./globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function GlobalError({ error, retry }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Sama Kër root error", error.digest ?? "no-digest");
  }, [error.digest]);

  return (
    <html lang="fr">
      <body>
        <main className="grid min-h-screen place-items-center bg-[#f5f1e8] px-5 py-16 text-[#263238]" aria-labelledby="global-error-title">
          <section className="w-full max-w-lg rounded-2xl border border-[#e3dccf] bg-white p-7 shadow-sm sm:p-10" role="alert">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#52655b]">Sama Kër</p>
            <h1 id="global-error-title" className="mt-3 text-2xl font-semibold text-[#174c38]">Le site rencontre un problème.</h1>
            <p className="mt-3 text-sm leading-6 text-[#263238]">Une erreur empêche l’affichage. Réessayez dans un instant.</p>
            <button type="button" onClick={() => retry()} className="mt-6 min-h-11 rounded-full bg-[#174c38] px-5 text-sm font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#a17229]">Réessayer</button>
          </section>
        </main>
      </body>
    </html>
  );
}
