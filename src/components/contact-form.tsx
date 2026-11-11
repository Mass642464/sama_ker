"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { getAccessToken } from "@/lib/client-api";
import { createClient } from "@/lib/supabase/browser";

type ContactFormProps = {
  propertyReference?: string;
  initialSubject?: "property" | "visit" | "geospatial" | "report" | "other";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const authConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function ContactForm({ propertyReference = "", initialSubject = "property" }: ContactFormProps) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [accountEmail, setAccountEmail] = useState("");

  useEffect(() => {
    if (!authConfigured) return;
    let active = true;
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (active && session?.user.email) setAccountEmail(session.user.email);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setSent(false);
    setError("");

    const formData = new FormData(form);
    const requestBody = {
      name: formData.get("name"),
      email: formData.get("email"),
      subject: formData.get("subject"),
      message: formData.get("message"),
      propertyReference: formData.get("propertyReference"),
      consent: formData.get("consent") === "on",
      website: formData.get("website"),
    };

    let response: Response;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
      if (!apiUrl) {
        setError("Le service de contact n’est pas configuré. Votre demande n’a pas été envoyée.");
        setPending(false);
        return;
      }

      // Un visiteur connecté envoie sa session pour retrouver la demande dans son espace.
      const token = accountEmail ? await getAccessToken() : null;
      if (accountEmail && !token) {
        setError("Votre session a expiré. Reconnectez-vous pour envoyer cette demande depuis votre espace.");
        setPending(false);
        return;
      }

      response = await fetch(`${apiUrl}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(requestBody),
      });
    } catch {
      setError("La connexion au service a échoué. Votre demande n’a pas été confirmée.");
      setPending(false);
      return;
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      setError("Le service a renvoyé une réponse invalide. Votre demande n’a pas été confirmée.");
      setPending(false);
      return;
    }

    if (!response.ok || response.status !== 201 || !isRecord(result)) {
      setError(
        isRecord(result) && typeof result.error === "string"
          ? result.error
          : "La demande n’a pas été enregistrée. Veuillez réessayer ultérieurement.",
      );
      setPending(false);
      return;
    }

    form.reset();
    setSent(true);
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[#e5e9e3] bg-white p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-[#43584e]">
          Nom complet
          <input required name="name" autoComplete="name" maxLength={120} className="mt-2 block h-12 w-full rounded-xl border border-[#e5e9e3] bg-[#fbfcfa] px-4 text-sm font-normal outline-none focus:border-[#78a989]" placeholder="Votre nom"/>
        </label>
        <label className="text-xs font-semibold text-[#43584e]">
          Adresse e-mail
          <input required key={accountEmail} name="email" type="email" autoComplete="email" maxLength={254} defaultValue={accountEmail} readOnly={Boolean(accountEmail)} aria-describedby={accountEmail ? "contact-account-note" : undefined} className="mt-2 block h-12 w-full rounded-xl border border-[#e5e9e3] bg-[#fbfcfa] px-4 text-sm font-normal outline-none read-only:bg-[#f0f3ec] focus:border-[#78a989]" placeholder="vous@exemple.com"/>
          {accountEmail && <span id="contact-account-note" className="mt-1.5 block text-[11px] font-normal text-[#718078]">Adresse de votre compte : la demande apparaîtra dans « Mon espace ».</span>}
        </label>
      </div>
      <label className="block text-xs font-semibold text-[#43584e]">
        Votre projet
        <select name="subject" required defaultValue={initialSubject} className="mt-2 block h-12 w-full rounded-xl border border-[#e5e9e3] bg-[#fbfcfa] px-4 text-sm font-normal outline-none focus:border-[#78a989]">
          <option value="property">Information sur un bien</option>
          <option value="visit">Demande de visite</option>
          <option value="geospatial">Étude géospatiale</option>
          <option value="report">Signalement d’une annonce</option>
          <option value="other">Autre demande</option>
        </select>
      </label>
      <input type="hidden" name="propertyReference" value={propertyReference}/>
      <label className="block text-xs font-semibold text-[#43584e]">
        Votre message
        <textarea required name="message" rows={4} minLength={10} maxLength={4000} className="mt-2 block w-full rounded-xl border border-[#e5e9e3] bg-[#fbfcfa] p-4 text-sm font-normal outline-none focus:border-[#78a989]" placeholder={initialSubject === "report" ? "Indiquez le motif de votre signalement (fraude présumée, annonce indisponible ou autre)." : "Comment pouvons-nous vous aider ?"}/>
      </label>
      <label hidden>
        Site web
        <input name="website" tabIndex={-1} autoComplete="off"/>
      </label>
      <label className="flex items-start gap-3 text-xs leading-5 text-[#596b61]">
        <input required name="consent" type="checkbox" className="mt-1 size-4 shrink-0 accent-[#32743d]"/>
        <span>J’accepte que mes coordonnées soient utilisées par Sama Kër et GéoSpatia Consulting pour répondre à cette demande. Ne transmettez aucun document foncier ou information sensible par ce formulaire.</span>
      </label>
      <button disabled={pending} className="flex min-h-12 items-center gap-2 rounded-full bg-[#1c4523] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#339243] disabled:cursor-wait disabled:opacity-70">
        {pending ? <LoaderCircle size={16} className="animate-spin"/> : <Send size={15}/>}
        {pending ? "Envoi en cours…" : "Envoyer ma demande"}
      </button>
      <p role="status" aria-live="polite" className="flex min-h-5 items-center gap-2 text-xs text-[#60806a]">
        {sent && <><CheckCircle2 size={15}/>{accountEmail ? "Votre demande a bien été enregistrée : retrouvez son suivi dans « Mon espace ». Aucun message de suivi automatique n’est envoyé pour le moment." : "Votre demande a bien été enregistrée. Aucun message de suivi automatique n’est envoyé pour le moment."}</>}
      </p>
      {error && <p role="alert" className="text-xs leading-5 text-red-700">{error}</p>}
      <p className="text-[11px] leading-5 text-[#89938d]">La politique de confidentialité et les durées de conservation doivent être validées avant tout lancement public.</p>
    </form>
  );
}
