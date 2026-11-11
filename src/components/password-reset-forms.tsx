"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/browser";

const inputClass = "mt-2 block h-12 w-full rounded-xl border border-[#e5e9e3] bg-[#fbfcfa] px-4 text-sm font-normal outline-none focus:border-[#78a989]";
const primaryButton = "flex min-h-12 w-full items-center justify-center rounded-full bg-[#1c4523] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#339243] disabled:cursor-wait disabled:opacity-70";

// Réponse identique que l'adresse existe ou non, pour ne pas révéler les comptes.
export function ResetRequestForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim().toLowerCase();
    setBusy(true);
    setError("");
    try {
      const redirectTo = `${window.location.origin}/espace-client/confirmation?next=/espace-client/reinitialisation`;
      const { error: resetError } = await createClient().auth.resetPasswordForEmail(email, { redirectTo });
      // Erreur technique (réseau, limite de débit) : on le signale sans révéler si le compte existe.
      if (resetError) {
        setError("La demande n’a pas pu être envoyée. Réessayez plus tard.");
        return;
      }
      setSent(true);
    } catch {
      setError("La demande n’a pas pu être envoyée. Réessayez plus tard.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) return <p role="status" className="rounded-xl bg-[#edf4ee] px-4 py-3 text-xs leading-5 text-[#3d7759]">Si cette adresse est associée à un compte, un e-mail de réinitialisation vient d’être envoyé.</p>;

  return <form onSubmit={submit} className="space-y-4">
    <label className="block text-xs font-semibold text-[#43584e]">Adresse e-mail
      <input name="email" type="email" autoComplete="email" required maxLength={254} className={inputClass}/>
    </label>
    {error && <p role="alert" className="rounded-xl bg-[#fbf0ee] px-4 py-3 text-xs text-[#8d3c32]">{error}</p>}
    <button disabled={busy} className={primaryButton}>{busy ? "Envoi…" : "Recevoir le lien"}</button>
  </form>;
}

export function NewPasswordForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirmation = String(data.get("confirmation") ?? "");
    if (password.length < 10 || password.length > 72) {
      setError("Choisissez un mot de passe de 10 à 72 caractères.");
      return;
    }
    if (password !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError("Le mot de passe n’a pas pu être modifié. Demandez un nouveau lien.");
      return;
    }
    setDone(true);
  }

  if (done) return <p role="status" className="rounded-xl bg-[#edf4ee] px-4 py-3 text-xs leading-5 text-[#3d7759]">Votre mot de passe a été modifié. <a href="/espace-client" className="font-bold underline">Accéder à mon espace</a></p>;

  return <form onSubmit={submit} className="space-y-4">
    <label className="block text-xs font-semibold text-[#43584e]">Nouveau mot de passe (10 caractères minimum)
      <input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} className={inputClass}/>
    </label>
    <label className="block text-xs font-semibold text-[#43584e]">Confirmez le mot de passe
      <input name="confirmation" type="password" autoComplete="new-password" required minLength={10} maxLength={72} className={inputClass}/>
    </label>
    {error && <p role="alert" className="rounded-xl bg-[#fbf0ee] px-4 py-3 text-xs text-[#8d3c32]">{error}</p>}
    <button disabled={busy} className={primaryButton}>{busy ? "Enregistrement…" : "Enregistrer le nouveau mot de passe"}</button>
  </form>;
}
