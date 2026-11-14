"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { adminApi, type AuditEntry } from "@/lib/admin-api";
import { useAdminSession } from "@/components/admin-session";

const actionLabels: Record<string, string> = {
  "property.create": "Annonce créée",
  "property.update": "Annonce modifiée",
  "property.availability": "Disponibilité modifiée",
  "property.approve": "Annonce validée et publiée",
  "lead.create": "Prospect ajouté",
  "lead.stage": "Étape du prospect modifiée",
  "lead.assign": "Prospect affecté",
  "lead.note": "Note ou réponse ajoutée",
  "lead.reminder": "Relance planifiée",
  "reminder.done": "Relance terminée",
  "appointment.create": "Rendez-vous créé",
  "appointment.status": "Statut de rendez-vous modifié",
  "appointment.visit-change": "Suivi de visite modifié",
  "staff.upsert": "Accès de l’équipe modifié",
  "work.project.create": "Chantier créé",
  "work.project.update": "Chantier modifié",
  "work.phase.update": "Avancement d’une phase modifié",
  "work.update.create": "Brouillon de travaux créé",
  "work.update.publish": "Mise à jour de travaux publiée",
  "work.photo.upload": "Photo de chantier ajoutée",
};

const formatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const pageSize = 100;

export default function AdminAuditPage() {
  const { can } = useAdminSession();
  const allowed = can("audit:read");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    adminApi<AuditEntry[]>(`/api/admin/audit?limit=${pageSize}`)
      .then((result) => { if (active) { setEntries(result); setMore(result.length === pageSize); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Le journal n’a pas pu être chargé."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed]);

  async function loadMore() {
    const last = entries.at(-1);
    if (!last) return;
    try {
      const next = await adminApi<AuditEntry[]>(`/api/admin/audit?limit=${pageSize}&before=${last.id}`);
      setEntries((current) => [...current, ...next]);
      setMore(next.length === pageSize);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La suite du journal n’a pas pu être chargée.");
    }
  }

  if (!allowed) return <p role="alert" className="rounded-xl bg-[#f8f2e8] p-5 text-sm text-[#775d34]">Votre rôle ne donne pas accès au journal d’audit.</p>;

  return <div>
    <p className="text-xs font-bold uppercase tracking-[.16em] text-[#3d7759]">Administration</p>
    <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold tracking-tight text-[#18371d] sm:text-3xl"><History size={24}/>Journal d’audit</h1>
    <p className="mt-2 max-w-2xl text-xs leading-5 text-[#56605a]">Actions effectuées dans l’administration, du plus récent au plus ancien. Le journal est en ajout seul et ne contient ni message, ni note, ni coordonnée de prospect.</p>
    {error && <p role="alert" className="mt-4 rounded-lg bg-[#fbf0ee] p-3 text-xs text-[#8d3c32]">{error}</p>}
    <div className="mt-6 overflow-x-auto rounded-2xl border border-[#e6ebe6] bg-white">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead className="border-b border-[#edf0ed] text-xs uppercase tracking-wider text-[#56605a]"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Personne</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Détail</th></tr></thead>
        <tbody>
          {entries.map((entry) => <tr key={entry.id} className="border-b border-[#f0f2f0] last:border-0">
            <td className="whitespace-nowrap px-4 py-3 text-[#56605a]">{formatter.format(new Date(entry.at))}</td>
            <td className="px-4 py-3 font-semibold">{entry.actor}</td>
            <td className="px-4 py-3">{actionLabels[entry.action] ?? entry.action}</td>
            <td className="px-4 py-3 text-[#56605a]">{Object.entries(entry.details).map(([key, value]) => `${key} : ${String(value)}`).join(" · ") || "—"}{entry.entityId && <span className="mt-1 block font-mono text-xs text-[#56605a]">{entry.entityId}</span>}</td>
          </tr>)}
          {!loading && entries.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-[#56605a]">Aucune action enregistrée.</td></tr>}
        </tbody>
      </table>
    </div>
    {loading && <p className="mt-3 text-xs text-[#56605a]">Chargement du journal…</p>}
    {more && <button type="button" onClick={() => void loadMore()} className="mt-4 rounded-lg border border-[#e5eae5] bg-white px-4 py-2 text-xs font-semibold">Voir plus</button>}
  </div>;
}
