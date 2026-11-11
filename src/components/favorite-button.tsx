"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { clientApi } from "@/lib/client-http";
import { createClient } from "@/lib/supabase/browser";

export function FavoriteButton({ slug }: { slug: string }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      // Sans configuration, le bouton n'est pas proposé.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSignedIn(false);
      return;
    }
    let active = true;
    createClient().auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      setSignedIn(Boolean(session));
      if (!session) return;
      const body = await clientApi<{ favorites: string[] }>("/api/client/favorites").catch(() => null);
      if (active && body) setSaved(body.favorites.includes(slug));
    }).catch(() => setSignedIn(false));
    return () => { active = false; };
  }, [slug]);

  if (!signedIn) return null;

  async function toggle() {
    setBusy(true);
    setMessage("");
    try {
      if (saved) {
        await clientApi(`/api/client/favorites/${slug}`, { method: "DELETE" });
        setSaved(false);
      } else {
        await clientApi("/api/client/favorites", { method: "POST", body: { slug } });
        setSaved(true);
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Le favori n’a pas pu être modifié.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-3">
    <button type="button" onClick={() => void toggle()} disabled={busy || saved === null} aria-pressed={Boolean(saved)} className="flex w-full items-center justify-center gap-2 rounded-full border border-[#dfe6df] px-5 py-3 text-xs font-bold text-[#18371d] disabled:opacity-60">
      <Heart size={14} fill={saved ? "currentColor" : "none"}/>{saved ? "Retirer des favoris" : "Ajouter aux favoris"}
    </button>
    {message && <p role="alert" className="mt-2 text-[11px] text-[#8d3c32]">{message}</p>}
  </div>;
}
