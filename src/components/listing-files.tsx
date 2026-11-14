"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Download, FileText, LoaderCircle, Lock, Trash2, Upload } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { getAccessToken } from "@/lib/client-api";
import { useAdminSession } from "@/components/admin-session";

type PrivateFile = { id: string; name: string; type: string; sizeBytes: number; createdAt: string };

const maxBytes = 10 * 1024 * 1024;
const allowedTypes = new Map([["application/pdf", "PDF"], ["image/jpeg", "JPEG"], ["image/png", "PNG"]]);
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

function apiOrigin() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("Configurez NEXT_PUBLIC_API_URL pour connecter l’administration.");
  return new URL(apiUrl).origin;
}

export function ListingFiles({ listingId }: { listingId: string }) {
  const { can } = useAdminSession();
  const [files, setFiles] = useState<PrivateFile[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canWrite = can("properties:write");

  async function refresh() {
    setFiles(await adminApi<PrivateFile[]>(`/api/admin/files?propertyId=${listingId}`));
  }

  useEffect(() => {
    let active = true;
    adminApi<PrivateFile[]>(`/api/admin/files?propertyId=${listingId}`)
      .then((result) => { if (active) setFiles(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Les fichiers n’ont pas pu être chargés."); });
    return () => { active = false; };
  }, [listingId]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!allowedTypes.has(file.type)) {
      setError("Format non autorisé : seuls les fichiers PDF, JPEG et PNG sont acceptés.");
      return;
    }
    if (file.size === 0 || file.size > maxBytes) {
      setError("Le fichier doit peser entre 1 octet et 10 Mo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Votre session a expiré. Reconnectez-vous.");
      const params = new URLSearchParams({ propertyId: listingId, name: file.name });
      const response = await fetch(`${apiOrigin()}/api/admin/files?${params}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type },
        body: file,
        cache: "no-store",
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        throw new Error(typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : "Le fichier n’a pas pu être envoyé.");
      }
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le fichier n’a pas pu être envoyé.");
    } finally {
      setBusy(false);
    }
  }

  async function download(file: PrivateFile) {
    setError("");
    try {
      const { url } = await adminApi<{ url: string }>(`/api/admin/files/${file.id}/url`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le téléchargement n’a pas pu être préparé.");
    }
  }

  async function remove(file: PrivateFile) {
    if (!window.confirm(`Supprimer définitivement « ${file.name} » ?`)) return;
    setBusy(true);
    setError("");
    try {
      await adminApi(`/api/admin/files/${file.id}`, { method: "DELETE" });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le fichier n’a pas pu être supprimé.");
    } finally {
      setBusy(false);
    }
  }

  return <section aria-labelledby="files-title" className="space-y-5">
    <div className="rounded-xl border border-[#e6ebe6] bg-white p-4 text-xs leading-5 text-[#52655b]">
      <p className="flex items-center gap-2 font-bold text-[#3d7759]"><Lock size={14}/> Fichiers privés</p>
      <p className="mt-1">Justificatifs et documents réservés à l’équipe : ils ne sont jamais publiés. Chaque téléchargement passe par un lien valable 60 secondes. Formats acceptés : PDF, JPEG et PNG, 10 Mo maximum.</p>
    </div>

    {canWrite && <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#c9dccb] bg-[#f7faf6] p-5 text-xs font-bold text-[#3d7759] ${busy ? "opacity-60" : ""}`}>
      {busy ? <LoaderCircle size={15} className="animate-spin"/> : <Upload size={15}/>}
      {busy ? "Envoi en cours…" : "Ajouter un fichier (PDF, JPEG, PNG)"}
      <input type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} onChange={(event) => void upload(event)} className="sr-only"/>
    </label>}

    {error && <p role="alert" className="rounded-lg bg-[#fbf0ee] p-3 text-xs text-[#8d3c32]">{error}</p>}

    {files === null && !error && <p className="text-xs text-[#56605a]">Chargement…</p>}
    {files && files.length === 0 && <p className="text-xs text-[#56605a]">Aucun fichier privé pour cette annonce.</p>}
    {files && files.length > 0 && <ul className="divide-y divide-[#f0f2f0] rounded-xl border border-[#e6ebe6] bg-white">
      {files.map((file) => <li key={file.id} className="flex items-center justify-between gap-3 p-3.5 text-xs">
        <span className="flex min-w-0 items-center gap-3">
          <FileText size={16} className="shrink-0 text-[#3d7759]"/>
          <span className="min-w-0">
            <strong className="block truncate text-[#344b3f]">{file.name}</strong>
            <span className="text-[11px] text-[#56605a]">{allowedTypes.get(file.type) ?? file.type} · {formatSize(file.sizeBytes)} · {dateFormatter.format(new Date(file.createdAt))}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => void download(file)} aria-label={`Télécharger ${file.name}`} className="rounded-lg p-2 text-[#3d7759] hover:bg-[#edf4ed]"><Download size={15}/></button>
          {canWrite && <button type="button" disabled={busy} onClick={() => void remove(file)} aria-label={`Supprimer ${file.name}`} className="rounded-lg p-2 text-[#56605a] hover:bg-[#fbf0ee] hover:text-[#8d3c32] disabled:opacity-60"><Trash2 size={15}/></button>}
        </span>
      </li>)}
    </ul>}
  </section>;
}
