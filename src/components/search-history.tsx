"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SearchEntry = { href: string; label: string };
const historyKey = "sama-keur-search-history-v1";
const savedKey = "sama-keur-saved-searches-v1";
const limit = 10;

function readEntries(key: string): SearchEntry[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("Les recherches enregistrées sont illisibles.");
  return data.filter((entry): entry is SearchEntry =>
    typeof entry === "object" && entry !== null && typeof entry.href === "string" &&
    /^\/(terrains|immobilier)\?/.test(entry.href) && typeof entry.label === "string" && entry.label.length <= 200,
  ).slice(0, limit);
}

export function SearchHistory({ href, label }: { href: string; label: string }) {
  const [history, setHistory] = useState<SearchEntry[]>([]);
  const [saved, setSaved] = useState<SearchEntry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const previous = readEntries(historyKey);
      const next = label ? [{ href, label }, ...previous.filter((entry) => entry.href !== href)].slice(0, limit) : previous;
      if (label) localStorage.setItem(historyKey, JSON.stringify(next));
      // L’historique est propre au navigateur et n’est lu qu’après le montage.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHistory(next);
      setSaved(readEntries(savedKey));
    } catch {
      setError("Impossible de lire ou d’enregistrer les recherches dans ce navigateur.");
    }
  }, [href, label]);

  function write(key: string, entries: SearchEntry[]) {
    try {
      localStorage.setItem(key, JSON.stringify(entries));
      if (key === historyKey) setHistory(entries);
      else setSaved(entries);
      setError("");
    } catch {
      setError("Impossible d’enregistrer les recherches dans ce navigateur.");
    }
  }

  return <section aria-label="Vos recherches" className="mb-6 rounded-2xl border border-[#e5e9e3] bg-[#f7f8f5] p-4 text-xs text-[#43584e]">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="font-bold text-[#18371d]">Vos recherches</h2><p className="mt-1">Stockées uniquement sur ce navigateur, sans synchronisation ni alerte.</p></div>
      {label && <button type="button" onClick={() => write(savedKey, [{ href, label }, ...saved.filter((entry) => entry.href !== href)].slice(0, limit))} className="rounded-full border border-[#b8ceba] bg-white px-4 py-2 font-semibold text-[#1c4523]">Enregistrer cette recherche</button>}
    </div>
    {error && <p role="alert" className="mt-2 text-[#8d3c32]">{error}</p>}
    {[{ title: "Récentes", key: historyKey, entries: history }, { title: "Enregistrées", key: savedKey, entries: saved }].map(({ title, key, entries }) => entries.length > 0 && <div key={key} className="mt-3">
      <div className="flex justify-between"><h3 className="font-semibold">{title}</h3><button type="button" onClick={() => write(key, [])} className="underline">Effacer</button></div>
      <ul className="mt-2 flex flex-wrap gap-2">{entries.map((entry) => <li key={entry.href} className="flex items-center rounded-full border border-[#dce5dc] bg-white">
        <Link href={entry.href} className="max-w-64 truncate px-3 py-2 font-semibold text-[#32743d]">{entry.label}</Link>
        <button type="button" onClick={() => write(key, entries.filter((item) => item.href !== entry.href))} aria-label={`Supprimer ${entry.label}`} className="px-3 py-2 text-[#56605a]">×</button>
      </li>)}</ul>
    </div>)}
  </section>;
}
