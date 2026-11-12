"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import type { Property } from "@/lib/properties";

const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const monthFormat = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeZone: "UTC" });

function dateKey(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

export function VisitScheduler({ property }: { property: Property }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  });
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState("");
  const firstDay = new Date(Date.UTC(month.year, month.month, 1));
  const offset = (firstDay.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(month.year, month.month + 1, 0)).getUTCDate();
  const today = new Date().toISOString().slice(0, 10);

  function moveMonth(amount: number) {
    const next = new Date(Date.UTC(month.year, month.month + amount, 1));
    setMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  }

  function nextStep() {
    if (!date || !time || !Number.isFinite(Date.parse(`${date}T${time}:00Z`)) || Date.parse(`${date}T${time}:00Z`) <= Date.now()) {
      setError("Choisissez une date et une heure futures.");
      return;
    }
    setError("");
    setContinuing(true);
  }

  return <section className="container py-10 sm:py-14">
    <div className="mb-8">
      <p className="text-xs font-bold uppercase tracking-widest text-[#60856c]">Demande de visite</p>
      <h1 className="mt-2 text-3xl font-semibold text-[#18371d]">Proposer une visite</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#596b61]">Choisissez une date et une heure souhaitées. L’équipe vérifiera sa disponibilité : aucun créneau n’est réservé ou confirmé à cette étape.</p>
      {property.isDemo && <p role="note" className="mt-4 rounded-xl bg-[#f8f2e8] p-4 text-sm text-[#775d34]">Annonce de démonstration : ce calendrier est un aperçu et aucune demande ne peut être envoyée pour ce bien fictif.</p>}
      {!property.isDemo && property.status === "Vendu" && <p role="note" className="mt-4 rounded-xl bg-[#f8f2e8] p-4 text-sm text-[#775d34]">Ce bien est indiqué comme vendu : les demandes de visite sont désactivées.</p>}
    </div>
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="rounded-2xl border border-[#e5e9e3] bg-white p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="Mois précédent" className="rounded-full p-2 text-[#43584e] hover:bg-[#edf4ee]"><ChevronLeft size={18}/></button>
            <h2 className="font-bold capitalize text-[#18371d]">{monthFormat.format(firstDay)}</h2>
            <button type="button" onClick={() => moveMonth(1)} aria-label="Mois suivant" className="rounded-full p-2 text-[#43584e] hover:bg-[#edf4ee]"><ChevronRight size={18}/></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map((day) => <span key={day} className="py-2 text-xs font-semibold text-[#89938d]">{day}</span>)}
            {Array.from({ length: offset }, (_, i) => <span key={`empty-${i}`}/>)}
            {Array.from({ length: count }, (_, i) => {
              const value = dateKey(month.year, month.month, i + 1);
              return <button key={value} type="button" disabled={value < today} aria-label={dateFormat.format(new Date(`${value}T00:00:00Z`))} aria-pressed={date === value} onClick={() => { setDate(value); setContinuing(false); }} className={`mx-auto grid size-10 place-items-center rounded-full text-sm transition ${date === value ? "bg-[#32743d] font-bold text-white" : "border border-[#e5e9e3] text-[#43584e] hover:bg-[#edf4ee]"} disabled:border-transparent disabled:text-[#c2c9c3] disabled:hover:bg-transparent`}>{i + 1}</button>;
            })}
          </div>
        </div>
        <label className="mt-5 block text-sm font-semibold text-[#43584e]">Heure souhaitée (heure du Sénégal)
          <input type="time" value={time} onChange={(event) => { setTime(event.target.value); setContinuing(false); }} className="mt-2 block h-12 w-full max-w-48 rounded-xl border border-[#e5e9e3] bg-white px-4 text-sm text-[#18371d]"/>
        </label>
        <p className="mt-2 text-xs leading-5 text-[#718078]">L’horaire est une préférence, pas une disponibilité vérifiée.</p>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e5e9e3] bg-white p-4">
          <p className="text-sm text-[#43584e]">{date && time ? <><span className="block text-xs text-[#89938d]">Votre préférence</span><strong>{dateFormat.format(new Date(`${date}T00:00:00Z`))} à {time}</strong></> : "Choisissez une date et une heure."}</p>
          <button type="button" onClick={nextStep} className="rounded-full bg-[#32743d] px-6 py-3 text-sm font-bold text-white">Continuer</button>
        </div>
        {continuing && !property.isDemo && property.status !== "Vendu" && <div className="mt-6"><h2 className="mb-3 text-lg font-bold text-[#18371d]">Envoyer votre demande</h2><ContactForm propertyReference={property.ref} initialSubject="visit" visitProposal={{ date, time }}/></div>}
        {continuing && (property.isDemo || property.status === "Vendu") && <p role="status" className="mt-4 rounded-xl bg-[#f0f3ec] p-4 text-sm text-[#43584e]">{property.isDemo ? "Aperçu terminé : aucune demande n’a été envoyée." : "Aucune demande ne peut être envoyée pour ce bien vendu."}</p>}
      </div>
      <aside className="overflow-hidden rounded-2xl border border-[#e5e9e3] bg-white">
        {property.photos?.[0] && <div className="relative h-44"><Image src={property.photos[0].src} alt={property.photos[0].alt} fill unoptimized sizes="320px" className="object-cover"/></div>}
        <div className="p-5">
          <p className="text-xs font-semibold text-[#718078]">Votre demande concerne</p>
          <h2 className="mt-2 text-lg font-bold text-[#18371d]">{property.title}</h2>
          <p className="mt-2 font-bold text-[#32743d]">{property.priceLabel}</p>
          <p className="mt-2 text-sm text-[#718078]">{property.location} · {property.area} m²</p>
          <p className="mt-2 text-xs text-[#89938d]">Réf. {property.ref}{property.isDemo ? " · Données fictives, image d’illustration" : ""}</p>
        </div>
      </aside>
    </div>
  </section>;
}
