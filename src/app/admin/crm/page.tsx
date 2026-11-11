"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Plus, Search, UserRoundCheck, UsersRound, X } from "lucide-react";
import { adminApi, type AdminLead } from "@/lib/admin-api";
import { LeadFollowUp } from "@/components/lead-follow-up";

const stages = ["Nouveau", "À qualifier", "Visite planifiée", "Dossier ouvert", "Fermé"];
const urgentStages = new Set(["Nouveau", "À qualifier"]);
const urgentAfterMinutes = 24 * 60;

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function minutesSince(date: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60_000));
}

function ageLabel(date: string) {
  const minutes = minutesSince(date);
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (minutes < 1440) return `Il y a ${Math.floor(minutes / 60)} h`;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(date));
}

function replyLink(lead: AdminLead) {
  const subject = `Votre demande Sama Kër — ${lead.interest}`;
  const body = `Bonjour ${lead.full_name},\n\nMerci pour votre demande (${lead.interest}).\n\n`;
  return `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function AdminCrmPage() {
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceFilter, setSourceFilter] = useState("Toutes les sources");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const result = await adminApi<AdminLead[]>("/api/admin/leads");
    setLeads(result);
    setError("");
  }

  useEffect(() => {
    let active = true;
    adminApi<AdminLead[]>("/api/admin/leads")
      .then((result) => { if (active) setLeads(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Les prospects n’ont pas pu être chargés."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const sources = useMemo(() => [...new Set(leads.map((lead) => lead.source))].sort(), [leads]);
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const visibleLeads = leads.filter((lead) =>
    (sourceFilter === "Toutes les sources" || lead.source === sourceFilter) &&
    (!normalizedQuery || `${lead.full_name} ${lead.email} ${lead.interest}`.toLocaleLowerCase("fr").includes(normalizedQuery)));
  const toProcess = leads.filter((lead) => lead.pipeline_stage === "Nouveau").length;

  async function changeStage(lead: AdminLead, pipelineStage: string) {
    setError("");
    try {
      await adminApi(`/api/admin/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ pipelineStage }) });
      setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, pipeline_stage: pipelineStage } : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L’étape du prospect n’a pas pu être modifiée.");
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
          fullName: formData.get("fullName"),
          email: formData.get("email"),
          interest: formData.get("interest"),
          source: formData.get("source"),
          message: formData.get("message"),
        }),
      });
      await refresh();
      setAdding(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le prospect n’a pas pu être créé.");
    } finally {
      setSaving(false);
    }
  }

  return <div>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#60856c]">Relations clients</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#18371d] sm:text-3xl">Prospects & CRM</h1><p className="mt-2 text-xs text-[#718078]">Les demandes du site et les prospects ajoutés sont enregistrés dans Supabase.</p></div><button type="button" onClick={() => setAdding(true)} className="flex w-fit items-center gap-2 rounded-lg bg-[#32743d] px-4 py-2.5 text-[10px] font-bold text-white"><Plus size={14}/> Ajouter un prospect</button></div>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e6ebe6] bg-white p-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#edf4ee] text-[#3d7759]"><UsersRound size={16}/></span><div><p className="text-[11px] font-bold text-[#344b3f]">Pipeline des demandes</p><p className="mt-1 text-xs text-[#89948d]">{loading ? "Chargement…" : toProcess > 0 ? `${visibleLeads.length} prospect(s) · ${toProcess} nouvelle(s) demande(s) à prendre en charge` : `${visibleLeads.length} prospect(s) · aucune nouvelle demande en attente`}</p></div></div><div className="flex flex-wrap items-center gap-3"><label className="flex h-10 items-center gap-2 rounded-lg border border-[#e5eae5] bg-white px-3"><Search size={14} className="text-[#89948d]"/><span className="sr-only">Rechercher un prospect</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, e-mail, référence…" className="w-44 bg-transparent text-xs outline-none placeholder:text-[#a0a8a2]"/></label><label className="flex items-center gap-2 text-xs text-[#718078]">Source<select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="rounded-lg border border-[#e5eae5] bg-white px-2.5 py-2 font-semibold"><option>Toutes les sources</option>{sources.map((source) => <option key={source}>{source}</option>)}</select></label></div></div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-[#fbf0ee] p-3 text-xs text-[#8d3c32]">{error}</p>}
    {loading ? <p className="mt-4 rounded-2xl border border-[#e6ebe6] bg-white p-10 text-center text-xs text-[#849188]">Chargement des prospects…</p>
      : <section className="mt-4 grid gap-4 xl:grid-cols-5" aria-label="Pipeline des prospects">{stages.map((stage, index) => {
        const items = visibleLeads.filter((lead) => lead.pipeline_stage === stage).sort((left, right) => (urgentStages.has(stage) ? 1 : -1) * (Date.parse(left.created_at) - Date.parse(right.created_at)));
        return <div key={stage} className="min-h-[300px] rounded-2xl border border-[#e6ebe6] bg-[#f0f3f0] p-3"><div className="flex items-center justify-between px-1 py-2"><span className="flex items-center gap-2 text-[11px] font-bold text-[#43584e]"><span className={`size-2 rounded-full ${["bg-[#7ca78a]", "bg-[#c3a66e]", "bg-[#7e9c83]", "bg-[#1b4121]", "bg-[#b57c6b]"][index]}`}/>{stage}</span><span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-[#77857d]">{items.length}</span></div>
          <div className="mt-2 space-y-2.5">{items.map((lead) => { const late = urgentStages.has(lead.pipeline_stage) && minutesSince(lead.created_at) >= urgentAfterMinutes; return <article key={lead.id} className={`rounded-xl border bg-white p-3.5 shadow-sm ${late ? "border-[#e3c9a6]" : "border-[#e8ece8]"}`}><div className="flex items-start justify-between gap-2"><span className="grid size-9 place-items-center rounded-full bg-[#dbe9dc] text-[11px] font-bold text-[#37684a]">{initials(lead.full_name)}</span><select aria-label={`Étape de ${lead.full_name}`} value={lead.pipeline_stage} onChange={(event) => changeStage(lead, event.target.value)} className="max-w-36 rounded-full bg-[#f5f7f5] px-2.5 py-1.5 text-[11px] font-semibold text-[#52655b]">{stages.map((item) => <option key={item}>{item}</option>)}</select></div><h2 className="mt-3 text-sm font-bold text-[#354b40]">{lead.full_name}</h2><a href={replyLink(lead)} className="mt-1 block truncate text-xs text-[#589262]">{lead.email}</a><div className="mt-3 rounded-lg bg-[#f7f8f5] px-2.5 py-2"><p className="text-xs font-semibold text-[#51655a]">{lead.interest}</p><p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#89948d]">Source : {lead.source}{lead.has_account && <span className="inline-flex items-center gap-1 rounded-full bg-[#edf4ee] px-2 py-0.5 font-semibold text-[#3d7759]"><UserRoundCheck size={11}/>Compte client</span>}</p></div>{lead.message && <details className="mt-2 text-xs text-[#718078]"><summary className="cursor-pointer font-semibold">Lire le message</summary><p className="mt-2 whitespace-pre-wrap leading-5">{lead.message}</p></details>}{late && <p className="mt-2 text-[11px] font-semibold text-[#946447]">Sans suite depuis plus de 24 h</p>}<LeadFollowUp lead={lead} onChanged={refresh}/><div className="mt-3 border-t border-[#f0f2f0] pt-2.5"><span className="block text-[11px] text-[#9aa49e]">{ageLabel(lead.created_at)}</span><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">{lead.pipeline_stage === "Nouveau" && <button type="button" onClick={() => changeStage(lead, "À qualifier")} className="whitespace-nowrap rounded-full bg-[#32743d] px-3 py-1.5 text-[11px] font-bold text-white">Prendre en charge</button>}<a href={replyLink(lead)} className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-[#589262]">Répondre <ArrowRight size={12}/></a></div></div></article>; })}</div>
          {items.length === 0 && <p className="mt-3 rounded-xl border border-dashed border-[#d9e1d9] p-4 text-center text-[9px] text-[#8b968e]">Aucun prospect dans cette étape.</p>}
        </div>;
      })}</section>}
    <p className="mt-5 text-[10px] leading-5 text-[#849188]">Les demandes envoyées depuis le formulaire public sont ajoutées automatiquement au CRM. Les changements d’étape et les nouveaux prospects sont enregistrés.</p>
    {adding && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#17251bcc] p-4"><section role="dialog" aria-modal="true" aria-labelledby="lead-form-title" className="my-auto w-full max-w-lg rounded-2xl bg-white p-6"><div className="flex items-center justify-between"><h2 id="lead-form-title" className="text-lg font-semibold text-[#18371d]">Ajouter un prospect</h2><button type="button" onClick={() => setAdding(false)} aria-label="Fermer"><X size={18}/></button></div><form onSubmit={createLead} className="mt-4 space-y-3">
      <label className="block text-xs font-semibold text-[#52655b]">Nom<input name="fullName" required minLength={2} maxLength={120} className="admin-field"/></label>
      <label className="block text-xs font-semibold text-[#52655b]">E-mail<input name="email" type="email" required maxLength={254} className="admin-field"/></label>
      <label className="block text-xs font-semibold text-[#52655b]">Intérêt<input name="interest" required minLength={2} maxLength={240} className="admin-field"/></label>
      <label className="block text-xs font-semibold text-[#52655b]">Source<input name="source" required minLength={2} maxLength={80} className="admin-field" placeholder="Contact direct"/></label>
      <label className="block text-xs font-semibold text-[#52655b]">Note (facultative)<textarea name="message" maxLength={4000} rows={3} className="admin-field"/></label>
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setAdding(false)} className="rounded-lg border border-[#e5eae5] px-4 py-2 text-xs font-semibold text-[#52655b]">Annuler</button><button disabled={saving} className="rounded-lg bg-[#32743d] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{saving ? "Enregistrement…" : "Enregistrer"}</button></div>
    </form></section></div>}
  </div>;
}
