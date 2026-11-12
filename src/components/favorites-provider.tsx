"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { clientApi } from "@/lib/client-http";
import { createClient } from "@/lib/supabase/browser";

type State = { status: "loading" | "anonymous" | "ready" | "error"; favorites: string[]; error: string };
type FavoritesContext = State & { toggle: (slug: string) => Promise<void>; reload: () => void };
const Context = createContext<FavoritesContext | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading", favorites: [], error: "" });
  const [version, setVersion] = useState(0);
  const generation = useRef(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const current = ++generation.current;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      // Aucun service client configuré.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ status: "error", favorites: [], error: "Les favoris ne sont pas configurés." });
      return () => { active = false; };
    }
    const supabase = createClient();
    async function sync() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active || current !== generation.current) return;
        if (!session) { setState({ status: "anonymous", favorites: [], error: "" }); return; }
        const result = await clientApi<{ favorites: string[] }>("/api/client/favorites");
        if (!Array.isArray(result.favorites) || !result.favorites.every((slug) => typeof slug === "string")) throw new Error("La liste des favoris reçue est invalide.");
        if (active && current === generation.current) setState({ status: "ready", favorites: result.favorites, error: "" });
      } catch (error) {
        if (active && current === generation.current) setState({ status: "error", favorites: [], error: error instanceof Error ? error.message : "Les favoris sont indisponibles." });
      }
    }
    void sync();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        generation.current++;
        setState({ status: "loading", favorites: [], error: "" });
        reload();
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [version, reload]);

  const toggle = useCallback(async (slug: string) => {
    if (state.status !== "ready") throw new Error("Les favoris ne sont pas disponibles.");
    const saved = state.favorites.includes(slug);
    const current = generation.current;
    if (saved) await clientApi(`/api/client/favorites/${slug}`, { method: "DELETE" });
    else await clientApi("/api/client/favorites", { method: "POST", body: { slug } });
    if (current === generation.current) setState((old) => old.status !== "ready" ? old : {
      ...old, favorites: saved ? old.favorites.filter((item) => item !== slug) : [...new Set([...old.favorites, slug])],
    });
  }, [state]);

  return <Context.Provider value={{ ...state, toggle, reload }}>{children}</Context.Provider>;
}

export function useFavorites() {
  const value = useContext(Context);
  if (!value) throw new Error("Le contexte des favoris est indisponible.");
  return value;
}
