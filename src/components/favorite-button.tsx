"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useFavorites } from "@/components/favorites-provider";

export function FavoriteButton({ slug, isDemo = false, compact = false }: { slug: string; isDemo?: boolean; compact?: boolean }) {
  const { status, favorites, error, toggle, reload } = useFavorites();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const saved = favorites.includes(slug);
  const style = compact
    ? "flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#dfe6df] px-3 text-xs font-semibold text-[#174c38] disabled:opacity-60"
    : "flex w-full min-h-11 items-center justify-center gap-2 rounded-full border border-[#dfe6df] px-5 py-3 text-xs font-bold text-[#174c38] disabled:opacity-60";

  if (isDemo) return <p className="text-xs text-[#626d66]">Favoris indisponibles pour cet exemple.</p>;
  if (status === "anonymous") return <Link href="/espace-client/connexion" aria-label="Se connecter pour ajouter aux favoris" className={style}><Heart size={15}/> Se connecter pour enregistrer</Link>;
  if (status === "error") return <div><p role="alert" className="text-xs text-[#8d3c32]">{error}</p><button type="button" onClick={reload} className="mt-1 text-xs font-semibold text-[#174c38] underline">Réessayer les favoris</button></div>;

  async function handleToggle() {
    setBusy(true);
    setMessage("");
    try { await toggle(slug); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Le favori n’a pas pu être modifié."); }
    finally { setBusy(false); }
  }
  return <div>
    <button type="button" onClick={() => void handleToggle()} disabled={busy || status === "loading"} aria-pressed={saved} className={style}>
      <Heart size={15} fill={saved ? "currentColor" : "none"}/>{status === "loading" ? "Chargement…" : saved ? "Retirer des favoris" : "Ajouter aux favoris"}
    </button>
    {message && <p role="alert" className="mt-2 text-xs text-[#8d3c32]">{message}</p>}
  </div>;
}
