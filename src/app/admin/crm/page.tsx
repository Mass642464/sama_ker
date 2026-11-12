"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, CalendarDays, Filter, Mail, Plus, Search, UserRound, UserRoundCheck, X } from "lucide-react";
import { adminApi, type AdminLead, type LeadReminder } from "@/lib/admin-api";
import { LeadFollowUp } from "@/components/lead-follow-up";
import { CrmReminders } from "@/components/crm-reminders";
import { useAdminSession } from "@/components/admin-session";

const stages = ["Nouveau", "À qualifier", "Visite planifiée", "Dossier ouvert", "Fermé"] as const;
const columns = [
  { stage: "Nouveau", color: "border-[#4f8d68]", background: "bg-[#e4efe5]" },
  { stage: "À qualifier", color: "border-[#c59b52]", background: "bg-[#f3ead7]" },
  { stage: "Visite planifiée", color: "border-[#73966f]", background: "bg-[#e9f0e2]" },
  { stage: "Dossier ouvert", color: "border-[#a87b54]", background: "bg-[#f0e6dc]" },
  { stage: "Fermé", color: "border-[#728079]", background: "bg-[#e9ede9]" },
] as const;

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function replyLink(lead: AdminLead) {
  const subject = `Votre demande Sama Kër — ${lead.interest}`;
  const body = `Bonjour ${lead.full_name},\n\nMerci pour votre demande (${lead.interest}).\n\n`;
  return `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Dakar" });

export default function AdminCrmPage() {
  const { can } = useAdminSession();
  const canWrite = can("leads:write");
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [sourceFilter, setSourceFilter] = useState("Toutes les sources");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stageBusy, setStageBusy] = useState<string | null>(null);
  const [reminders, setReminders] = useState<LeadReminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [remindersError, setRemindersError] = useState("");
  const [now, setNow] = useState<number | null>(null);

  async function refreshReminders() {
    try {
      const result = await adminApi<LeadReminder[]>("/api/admin/reminders");
      setReminders(result);
      setRemindersError("");
    } catch (reason) {
      setRemindersError(reason instanceof Error ? reason.message : "Les relances n’ont pas pu être chargées.");
      throw reason;
    }
  }

  async function refresh() {
    const result = await adminApi<AdminLead[]>("/api/admin/leads");
    setLeads(result);
    setLoadError("");
    await refreshReminders();
  }

  useEffect(() => {
    let active = true;
    adminApi<AdminLead[]>("/api/admin/leads")
      .then((result) => { if (active) setLeads(result); })
      .catch((reason: unknown) => { if (active) setLoadError(reason instanceof Error ? reason.message : "Les prospects n’ont pas pu être chargés."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let active = true;
    adminApi<LeadReminder[]>("/api/admin/reminders")
      .then((result) => { if (active) setReminders(result); })
      .catch((reason: unknown) => { if (active) setRemindersError(reason instanceof Error ? reason.message : "Les relances n’ont pas pu être chargées."); })
      .finally(() => { if (active) setRemindersLoading(false); });
    return () => { active = false; };
  }, []);

  const sources = useMemo(() => [...new Set(leads.map((lead) => lead.source))].sort(), [leads]);
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const visibleLeads = leads.filter((lead) =>
    (sourceFilter === "Toutes les sources" || lead.source === sourceFilter) &&
    (!normalizedQuery || `${lead.full_name} ${lead.email} ${lead.interest}`.toLocaleLowerCase("fr").includes(normalizedQuery)));
  const unknownLeads = visibleLeads.filter((lead) => !stages.some((stage) => stage === lead.pipeline_stage));

  async function changeStage(lead: AdminLead, pipelineStage: string) {
    setError("");
    setStageBusy(lead.id);
    try {
      await adminApi(`/api/admin/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ pipelineStage }) });
      setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, pipeline_stage: pipelineStage } : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L’étape du prospect n’a pas pu être modifiée.");
    } finally {
      setStageBusy(null);
    }
  }

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");
    setSaving(true);
    try {
      await adminApi("/api/admin/leads", {
        method: "POST",
        body: JSON.stringify({
          fullName: formData.get("fullName"), email: formData.get("email"),
          interest: formData.get("interest"), source: formData.get("source"), message: formData.get("message"),
        }),
      });
      setAdding(false);
      try {
        await refresh();
      } catch {
        setError("Le prospect a été enregistré, mais l’actualisation a échoué. Rechargez la page.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le prospect n’a pas pu être créé.");
    } finally {
      setSaving(false);
    }
  }

  function renderCard(lead: AdminLead) {
    const date = new Date(lead.created_at);
    return <article key={lead.id} className="rounded-xl border border-[#e5e2d9] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><h3 className="break-words text-sm font-bold text-[#263238]">{lead.full_name}</h3><p className="mt-1 break-words text-xs leading-5 text-[#52655b]">{lead.interest}</p></div>
        {lead.has_account && <span title="Compte client" aria-label="Compte client" className="rounded-full bg-[#edf4ee] p-1.5 text-[#174c38]"><UserRoundCheck size={15}/></span>}
      </div>
      <div className="mt-3 space-y-2 text-xs text-[#52655b]">
        <a href={replyLink(lead)} className="flex min-w-0 items-center gap-2 font-semibold text-[#174c38]"><Mail size={14} className="shrink-0" aria-hidden="true"/><span className="break-all">{lead.email}</span></a>
        <p>Source : {lead.source}</p>
        <p className="flex items-center gap-2"><CalendarDays size={14} aria-hidden="true"/>{Number.isNaN(date.getTime()) ? "Date non disponible" : <time dateTime={lead.created_at}>{dateFormatter.format(date)}</time>}</p>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-[#eee8dc] pt-3 text-xs text-[#52655b]">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e1ede1] text-[10px] font-bold text-[#174c38]" aria-hidden="true">{lead.assigned_to ? initials(lead.assigned_to) : <UserRound size={15}/>}</span>
        <span className="min-w-0 break-all">Responsable : {lead.assigned_to ?? "non affecté"}</span>
      </div>
      {canWrite && <label className="mt-3 block text-xs font-semibold text-[#52655b]">Étape
        <select aria-label={`Étape de ${lead.full_name}`} value={lead.pipeline_stage} disabled={stageBusy !== null} onChange={(event) => void changeStage(lead, event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#dddccf] bg-white px-2 text-xs text-[#263238] disabled:opacity-60">
          {!stages.some((stage) => stage === lead.pipeline_stage) && <option value={lead.pipeline_stage}>{lead.pipeline_stage} (à requalifier)</option>}
          {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
        </select>
      </label>}
      {!canWrite && <p className="mt-3 text-xs text-[#52655b]">Étape : {lead.pipeline_stage}</p>}
      {lead.message && <details className="mt-3 text-xs text-[#52655b]"><summary className="cursor-pointer font-semibold">Lire le message</summary><p className="mt-2 whitespace-pre-wrap break-words leading-5">{lead.message}</p></details>}
      {now !== null && (lead.pipeline_stage === "Nouveau" || lead.pipeline_stage === "À qualifier") && now - date.getTime() >= 24 * 60 * 60 * 1000 && <p className="mt-3 text-xs font-semibold text-[#946447]">Créé il y a plus de 24 h · suivi à vérifier</p>}
      <LeadFollowUp lead={lead} onChanged={refresh}/>
      <a href={replyLink(lead)} className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-[#174c38]">Préparer une réponse <ArrowRight size={14} aria-hidden="true"/></a>
    </article>;
  }

  return <div className="min-w-0">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#92703e]">Relations clients</p><h1 className="mt-2 text-2xl font-semibold text-[#174c38] sm:text-3xl">Pipeline des prospects</h1><p className="mt-2 text-sm text-[#52655b]">Suivez les demandes et les prochaines actions de votre équipe.</p></div>
      {canWrite && <button type="button" onClick={() => { setError(""); setAdding(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#174c38] px-4 text-sm font-semibold text-white"><Plus size={16}/> Ajouter un prospect</button>}
    </div>
    <div className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-[#e7e0d4] bg-white p-4">
      <label className="min-w-0 flex-1 text-xs font-semibold text-[#52655b]">Rechercher
        <span className="mt-1 flex min-h-11 items-center gap-2 rounded-lg border border-[#dddccf] px-3"><Search size={16} aria-hidden="true"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, e-mail, intérêt…" className="min-w-0 w-full bg-transparent text-sm outline-none"/></span>
      </label>
      <label className="text-xs font-semibold text-[#52655b]">Source
        <span className="mt-1 flex min-h-11 items-center gap-2 rounded-lg border border-[#dddccf] px-3"><Filter size={15} aria-hidden="true"/><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="max-w-40 bg-transparent text-sm text-[#263238]"><option>Toutes les sources</option>{sources.map((source) => <option key={source}>{source}</option>)}</select></span>
      </label>
    </div>
    {!loading && !loadError && <p className="mt-3 text-xs leading-5 text-[#52655b]">{visibleLeads.length} prospect(s) affiché(s) · 500 prospects récents au maximum. Déplacez-vous horizontalement pour voir les étapes ; utilisez le sélecteur pour changer une étape.</p>}
    {error && !adding && <p role="alert" className="mt-3 rounded-lg bg-[#fbf0ee] p-3 text-sm text-[#8d3c32]">{error}</p>}
    {loadError && <p role="alert" className="mt-3 rounded-lg bg-[#fbf0ee] p-3 text-sm text-[#8d3c32]">Pipeline indisponible : {loadError}</p>}
    {loading ? <p role="status" className="mt-4 rounded-xl bg-white p-6 text-sm text-[#52655b]">Chargement des prospects…</p> : !loadError && <section aria-label="Pipeline des prospects" tabIndex={0} className="mt-4 flex max-w-full snap-x gap-3 overflow-x-auto pb-4">
      {columns.map(({ stage, color, background }) => {
        const items = visibleLeads.filter((lead) => lead.pipeline_stage === stage);
        return <section key={stage} aria-label={`${stage} : ${items.length} prospect(s)`} className={`w-[280px] max-w-[85vw] shrink-0 snap-start rounded-xl border-t-4 ${color} ${background} p-3`}>
          <div className="flex items-center justify-between gap-2 px-1 pb-3"><h2 className="text-sm font-bold text-[#263238]">{stage}</h2><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-[#174c38]">{items.length}</span></div>
          <div className="space-y-2">{items.map(renderCard)}</div>
          {items.length === 0 && <p className="rounded-lg border border-dashed border-[#bdcbbb] p-4 text-center text-xs text-[#52655b]">Aucun prospect dans cette étape.</p>}
        </section>;
      })}
      {unknownLeads.length > 0 && <section aria-label="Étapes inconnues à requalifier" className="w-[280px] max-w-[85vw] shrink-0 snap-start rounded-xl border-t-4 border-[#a87b54] bg-[#f0e6dc] p-3"><h2 className="px-1 pb-3 text-sm font-bold text-[#263238]">À requalifier · {unknownLeads.length}</h2><div className="space-y-2">{unknownLeads.map(renderCard)}</div></section>}
    </section>}
    <CrmReminders reminders={reminders} loading={remindersLoading} error={remindersError} canWrite={canWrite} onRefresh={refreshReminders}/>
    {adding && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#17251bcc] p-4"><section role="dialog" aria-modal="true" aria-labelledby="lead-form-title" className="my-auto w-full max-w-lg rounded-2xl bg-white p-6"><div className="flex items-center justify-between"><h2 id="lead-form-title" className="text-lg font-semibold text-[#18371d]">Ajouter un prospect</h2><button type="button" onClick={() => setAdding(false)} aria-label="Fermer" className="grid size-11 place-items-center"><X size={18}/></button></div><form onSubmit={createLead} className="mt-4 space-y-3">
      {error && <p role="alert" className="rounded-lg bg-[#fbf0ee] p-3 text-sm text-[#8d3c32]">{error}</p>}
      <label className="block text-xs font-semibold text-[#52655b]">Nom<input name="fullName" required minLength={2} maxLength={120} className="admin-field"/></label>
      <label className="block text-xs font-semibold text-[#52655b]">E-mail<input name="email" type="email" required maxLength={254} className="admin-field"/></label>
      <label className="block text-xs font-semibold text-[#52655b]">Intérêt<input name="interest" required minLength={2} maxLength={240} className="admin-field"/></label>
      <label className="block text-xs font-semibold text-[#52655b]">Source<input name="source" required minLength={2} maxLength={80} className="admin-field" placeholder="Contact direct"/></label>
      <label className="block text-xs font-semibold text-[#52655b]">Note (facultative)<textarea name="message" maxLength={4000} rows={3} className="admin-field"/></label>
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setAdding(false)} className="min-h-11 rounded-lg border border-[#e5eae5] px-4 text-xs font-semibold text-[#52655b]">Annuler</button><button disabled={saving} className="min-h-11 rounded-lg bg-[#174c38] px-4 text-xs font-bold text-white disabled:opacity-60">{saving ? "Enregistrement…" : "Enregistrer"}</button></div>
    </form></section></div>}
  </div>;
}
