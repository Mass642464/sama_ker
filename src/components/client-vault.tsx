"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/browser";
import { clientApi } from "@/lib/client-api";

type VaultFile = { id: string; name: string; type: string; sizeBytes: number; createdAt: string };
type VaultAccess = { fileId: string; accessedAt: string };
type VaultState = { files: VaultFile[]; accesses: VaultAccess[]; maxFiles: number; maxFileBytes: number };
type DownloadLink = { url: string; expiresInSeconds: number };

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date indisponible" : new Intl.DateTimeFormat("fr-SN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Dakar",
  }).format(date);
}

function displaySize(value: number) {
  return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)} Mo` : `${Math.max(1, Math.round(value / 1000))} Ko`;
}

export function ClientVault({ email }: { email: string }) {
  const [data, setData] = useState<VaultState | null>(null);
  const [error, setError] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<Record<string, string>>({});
  const fileNames = useMemo(() => new Map(data?.files.map((file) => [file.id, file.name]) ?? []), [data]);

  function showError(reason: unknown, fallback: string) {
    const message = reason instanceof Error ? reason.message : fallback;
    if (message.includes("authentification récente requise")) {
      setNeedsPassword(true);
      setError("");
    } else {
      setError(message);
    }
  }

  async function load() {
    try {
      const result = await clientApi<VaultState>("/api/client/vault");
      setData(result);
      setNeedsPassword(false);
      setError("");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Le coffre n’a pas pu être chargé.";
      showError(message, "Le coffre n’a pas pu être chargé.");
    }
  }

  useEffect(() => {
    let active = true;
    clientApi<VaultState>("/api/client/vault")
      .then((result) => {
        if (!active) return;
        setData(result);
        setNeedsPassword(false);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const message = reason instanceof Error ? reason.message : "Le coffre n’a pas pu être chargé.";
        if (message.includes("authentification récente requise")) setNeedsPassword(true);
        else setError(message);
      });
    return () => { active = false; };
  }, []);

  async function confirmPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error: authError } = await createClient().auth.signInWithPassword({ email, password });
      if (authError) throw new Error("Mot de passe incorrect ou connexion impossible.");
      setPassword("");
      await load();
    } catch (reason) {
      showError(reason, "Le mot de passe n’a pas pu être vérifié.");
    } finally {
      setBusy(false);
    }
  }

  async function addFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const selected = (form.elements.namedItem("vault-file") as HTMLInputElement | null)?.files?.[0];
    if (!selected) {
      setError("Choisissez un fichier.");
      return;
    }
    if (!data || selected.size > data.maxFileBytes) {
      setError("Chaque fichier doit peser au plus 10 Mo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await clientApi("/api/client/vault/files", {
        method: "POST",
        headers: { "Content-Type": selected.type, "X-File-Name": encodeURIComponent(selected.name) },
        body: selected,
      });
      form.reset();
      await load();
    } catch (reason) {
      showError(reason, "Le fichier n’a pas pu être ajouté.");
    } finally {
      setBusy(false);
    }
  }

  async function openFile(file: VaultFile) {
    setError("");
    try {
      const link = await clientApi<DownloadLink>(`/api/client/vault/files/${encodeURIComponent(file.id)}`);
      setLinks((current) => ({ ...current, [file.id]: link.url }));
      window.setTimeout(() => setLinks((current) => {
        if (current[file.id] !== link.url) return current;
        const next = { ...current };
        delete next[file.id];
        return next;
      }), link.expiresInSeconds * 1000);
      await load();
    } catch (reason) {
      showError(reason, "Le lien du fichier n’a pas pu être créé.");
    }
  }

  async function removeFile(file: VaultFile) {
    if (!window.confirm(`Supprimer « ${file.name} » de votre coffre ?`)) return;
    setBusy(true);
    setError("");
    try {
      await clientApi(`/api/client/vault/files/${encodeURIComponent(file.id)}`, { method: "DELETE" });
      setLinks((current) => {
        const next = { ...current };
        delete next[file.id];
        return next;
      });
      await load();
    } catch (reason) {
      showError(reason, "Le fichier n’a pas pu être supprimé.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="space-y-6">
    <div>
      <p className="eyebrow">Documents privés</p>
      <h2 className="mt-2 text-2xl font-semibold text-[#18371d]">Mon coffre personnel</h2>
      <p className="mt-2 text-sm leading-6 text-[#66766c]">Vos documents ne sont visibles que par vous. Formats acceptés : PDF, JPEG, PNG et Word (.docx), 10 Mo maximum par fichier. Les liens expirent après 60 secondes.</p>
    </div>

    {needsPassword && <form onSubmit={confirmPassword} className="rounded-2xl border border-[#e6e0d5] bg-white p-5">
      <h3 className="font-semibold text-[#18371d]">Confirmez votre mot de passe</h3>
      <p className="mt-1 text-sm leading-6 text-[#66766c]">Pour protéger vos documents, le serveur exige une authentification par mot de passe datant de moins de 30 minutes.</p>
      <label className="mt-4 block text-sm font-medium text-[#52655b]">Mot de passe
        <input required autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="admin-field max-w-md"/>
      </label>
      <button disabled={busy} className="mt-4 rounded-lg bg-[#174c38] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">Confirmer</button>
    </form>}

    {error && <p role="alert" className="rounded-xl bg-[#fbf0ee] p-4 text-sm text-[#8d3c32]">{error}</p>}

    {data && <>
      <form onSubmit={addFile} className="grid gap-3 rounded-2xl border border-[#e6e0d5] bg-white p-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="text-sm font-semibold text-[#52655b]">Ajouter un fichier ({data.files.length}/{data.maxFiles})
          <input name="vault-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#eaf2e9] file:px-4 file:py-2 file:font-semibold file:text-[#174c38]"/>
        </label>
        <button disabled={busy || data.files.length >= data.maxFiles} className="min-h-11 rounded-lg bg-[#174c38] px-5 text-sm font-bold text-white disabled:opacity-50">Ajouter au coffre</button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-[#e6e0d5] bg-white">
        <h3 className="border-b border-[#edf0ed] px-5 py-4 font-semibold text-[#18371d]">Mes fichiers</h3>
        {data.files.length === 0 ? <p className="p-5 text-sm text-[#56605a]">Aucun document enregistré pour le moment.</p> :
          <ul className="divide-y divide-[#edf0ed]">{data.files.map((file) => <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0"><p className="break-all text-sm font-semibold text-[#263238]">{file.name}</p><p className="mt-1 text-xs text-[#56605a]">{displaySize(file.sizeBytes)} · ajouté le {displayDate(file.createdAt)}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              {links[file.id] ? <a href={links[file.id]} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#eaf2e9] px-3 py-2 text-xs font-bold text-[#174c38]">Ouvrir (60 s)</a> : <button type="button" onClick={() => void openFile(file)} className="rounded-lg bg-[#eaf2e9] px-3 py-2 text-xs font-bold text-[#174c38]">Préparer l’ouverture</button>}
              <button type="button" disabled={busy} onClick={() => void removeFile(file)} className="rounded-lg border border-[#eadbd4] px-3 py-2 text-xs font-bold text-[#8d3c32] disabled:opacity-50">Supprimer</button>
            </div>
          </li>)}</ul>}
      </div>

      <div className="rounded-2xl border border-[#e6e0d5] bg-white p-5">
        <h3 className="font-semibold text-[#18371d]">Historique des accès</h3>
        {data.accesses.length === 0 ? <p className="mt-2 text-sm text-[#56605a]">Aucun document ouvert.</p> :
          <ul className="mt-3 space-y-2">{data.accesses.map((entry, index) => <li key={`${entry.fileId}-${entry.accessedAt}-${index}`} className="text-sm text-[#66766c]">{displayDate(entry.accessedAt)} · {fileNames.get(entry.fileId) ?? "Document supprimé"}</li>)}</ul>}
      </div>
    </>}
  </section>;
}
