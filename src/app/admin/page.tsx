"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, MapPinned, MessageSquareText, UsersRound } from "lucide-react";
import { adminApi, type AdminAppointment, type AdminDashboard, type AdminLead } from "@/lib/admin-api";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboard | null>(null);
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const now = new Date();
    const until = new Date(now);
    until.setDate(until.getDate() + 30);
    Promise.all([
      adminApi<AdminDashboard>("/api/admin/dashboard"),
      adminApi<AdminLead[]>("/api/admin/leads"),
      adminApi<AdminAppointment[]>(`/api/admin/appointments?from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(until.toISOString())}`),
    ]).then(([dashboard, leadRows, appointmentRows]) => {
      if (!active) return;
      setStats(dashboard);
      setLeads(leadRows.slice(0, 5));
      setAppointments(appointmentRows.filter((item) => item.status !== "Annulé").slice(0, 4));
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Le tableau de bord n’a pas pu être chargé.");
    });
    return () => { active = false; };
  }, []);

  const metrics = [
    { label: "Annonces", value: stats?.listings, detail: `${stats?.published ?? "—"} publiées`, icon: MapPinned, tone: "text-[#3d7759] bg-[#edf4ee]" },
    { label: "Prospects", value: stats?.leads, detail: `${stats?.leadsToQualify ?? "—"} à qualifier`, icon: UsersRound, tone: "text-[#497651] bg-[#ecf2ed]" },
    { label: "Rendez-vous à venir", value: stats?.appointments, detail: "30 prochains jours", icon: CalendarDays, tone: "text-[#987444] bg-[#f6f0e6]" },
    { label: "Biens immobiliers", value: stats?.realEstate, detail: `${stats?.land ?? "—"} terrains`, icon: MessageSquareText, tone: "text-[#6e9274] bg-[#e8eee5]" },
  ];

  return <div className="space-y-7">
    <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#60856c]">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date())}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#18371d] sm:text-3xl">Vue d’ensemble</h1><p className="mt-2 text-xs text-[#718078]">Synthèse actualisée depuis les données enregistrées.</p></div>
    {error && <p role="alert" className="rounded-lg bg-[#fbf0ee] p-3 text-xs text-[#8d3c32]">{error}</p>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicateurs clés">{metrics.map(({ label, value, detail, icon: Icon, tone }) => <article key={label} className="rounded-2xl border border-[#e6ebe6] bg-white p-5"><div className="flex items-start justify-between"><span className="text-[11px] font-medium text-[#738078]">{label}</span><span className={`grid size-9 place-items-center rounded-xl ${tone}`}><Icon size={16}/></span></div><div className="mt-4 flex items-end justify-between"><span className="text-3xl font-semibold tracking-tight text-[#18371d]">{value ?? "—"}</span><span className="pb-1 text-[9px] font-semibold text-[#548365]">{detail}</span></div></article>)}</section>
    <section className="grid gap-4 xl:grid-cols-2">
      <article className="overflow-hidden rounded-2xl border border-[#e6ebe6] bg-white"><div className="flex items-center justify-between p-5"><div><h2 className="text-sm font-bold text-[#18371d]">Prospects récents</h2><p className="mt-1 text-[10px] text-[#8a958e]">Demandes et contacts enregistrés</p></div><Link href="/admin/crm" className="text-[10px] font-bold text-[#589262]">Ouvrir le CRM <ArrowRight className="inline" size={12}/></Link></div><div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left"><thead className="border-y border-[#f0f2f0] bg-[#fbfcfb] text-[9px] uppercase tracking-wider text-[#96a099]"><tr><th className="px-5 py-3 font-bold">Contact</th><th className="px-4 py-3 font-bold">Intérêt</th><th className="px-4 py-3 font-bold">Étape</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id} className="border-b border-[#f1f3f1] last:border-0"><td className="px-5 py-3 text-[10px] font-semibold text-[#354a3f]">{lead.full_name}</td><td className="px-4 py-3 text-[10px] text-[#718078]">{lead.interest}</td><td className="px-4 py-3 text-[9px] text-[#5d7163]">{lead.pipeline_stage}</td></tr>)}</tbody></table>{leads.length === 0 && <p className="p-8 text-center text-xs text-[#849188]">Aucun prospect enregistré.</p>}</div></article>
      <article className="rounded-2xl border border-[#e6ebe6] bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-[#18371d]">Rendez-vous à venir</h2><p className="mt-1 text-[10px] text-[#8a958e]">30 prochains jours</p></div><Link href="/admin/agenda" className="text-[10px] font-bold text-[#589262]">Ouvrir l’agenda <ArrowRight className="inline" size={12}/></Link></div><div className="mt-4 space-y-2">{appointments.map((appointment) => <div key={appointment.id} className="flex gap-3 rounded-xl bg-[#f8faf7] px-3 py-3"><span className="w-24 shrink-0 text-[9px] font-bold text-[#718078]">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(appointment.starts_at))}</span><span><strong className="block text-[10px] font-semibold text-[#344b3f]">{appointment.purpose}</strong><span className="mt-1 block text-[9px] text-[#89948d]">{appointment.contact_name} · {appointment.status}</span></span></div>)}{appointments.length === 0 && <p className="py-8 text-center text-xs text-[#849188]">Aucun rendez-vous dans les 30 prochains jours.</p>}</div></article>
    </section>
    <div className="flex flex-wrap gap-3"><Link href="/admin/biens" className="rounded-lg border border-[#e1e7e1] bg-white px-4 py-3 text-[10px] font-semibold text-[#52655b]">Gérer les annonces</Link><Link href="/admin/crm" className="rounded-lg border border-[#e1e7e1] bg-white px-4 py-3 text-[10px] font-semibold text-[#52655b]">Suivre les prospects</Link><Link href="/admin/agenda" className="rounded-lg border border-[#e1e7e1] bg-white px-4 py-3 text-[10px] font-semibold text-[#52655b]">Planifier un rendez-vous</Link></div>
  </div>;
}
