"use client";

import { useActionState, useState } from "react";
import { signInClient, signUpClient, type AuthState } from "../actions";
import { ResetRequestForm } from "@/components/password-reset-forms";

const initialState: AuthState = {};
const inputClass = "mt-2 block h-12 w-full rounded-xl border border-[#e5e9e3] bg-[#fbfcfa] px-4 text-sm font-normal outline-none focus:border-[#78a989]";
const primaryButton = "flex min-h-12 w-full items-center justify-center rounded-full bg-[#1c4523] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#339243] disabled:cursor-wait disabled:opacity-70";

function Feedback({ state }: { state: AuthState }) {
  return <>
    {state.error && <p role="alert" className="rounded-xl bg-[#fbf0ee] px-4 py-3 text-xs leading-5 text-[#8d3c32]">{state.error}</p>}
    {state.notice && <p role="status" className="rounded-xl bg-[#edf4ee] px-4 py-3 text-xs leading-5 text-[#3d7759]">{state.notice}</p>}
  </>;
}
function SignInForm({ onForgot }: { onForgot: () => void }) {
  const [state, action, pending] = useActionState(signInClient, initialState);
  return <form action={action} className="space-y-4">
    <label className="block text-xs font-semibold text-[#43584e]">Adresse e-mail
      <input name="email" type="email" autoComplete="username" required maxLength={254} className={inputClass}/>
    </label>
    <label className="block text-xs font-semibold text-[#43584e]">Mot de passe
      <input name="password" type="password" autoComplete="current-password" required className={inputClass}/>
    </label>
    <div className="text-right"><button type="button" onClick={onForgot} className="text-[11px] font-semibold text-[#477052] underline underline-offset-2">Mot de passe oublié ?</button></div>
    <Feedback state={state}/>
    <button disabled={pending} className={primaryButton}>{pending ? "Connexion…" : "Se connecter"}</button>
  </form>;
}

function SignUpForm() {
  const [state, action, pending] = useActionState(signUpClient, initialState);
  return <form action={action} className="space-y-4">
    <label className="block text-xs font-semibold text-[#43584e]">Adresse e-mail
      <input name="email" type="email" autoComplete="email" required maxLength={254} className={inputClass}/>
    </label>
    <label className="block text-xs font-semibold text-[#43584e]">Mot de passe (10 caractères minimum)
      <input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} className={inputClass}/>
    </label>
    <label className="flex items-start gap-3 text-xs leading-5 text-[#596b61]">
      <input required name="consent" type="checkbox" className="mt-1 size-4 shrink-0 accent-[#32743d]"/>
      <span>J’accepte que mon adresse e-mail soit utilisée pour créer mon espace et suivre mes demandes auprès de Sama Kër et GéoSpatia Consulting. La politique de confidentialité reste à valider avant tout lancement public.</span>
    </label>
    <Feedback state={state}/>
    <button disabled={pending} className={primaryButton}>{pending ? "Création…" : "Créer mon espace"}</button>
  </form>;
}

export function AuthForms({ initialMode }: { initialMode: "connexion" | "inscription" | "oubli" }) {
  const [mode, setMode] = useState<"connexion" | "inscription" | "oubli">(initialMode);
  const tab = (value: "connexion" | "inscription", label: string) => (
    <button type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)}
      className={`flex-1 rounded-full px-4 py-2.5 text-xs font-bold transition ${mode === value ? "bg-[#1c4523] text-white" : "text-[#56605a] hover:text-[#1c4523]"}`}>{label}</button>
  );
  return <div>
    {mode === "oubli"
      ? <div>
        <h2 className="mb-4 text-sm font-bold text-[#18371d]">Réinitialiser mon mot de passe</h2>
        <ResetRequestForm/>
        <button type="button" onClick={() => setMode("connexion")} className="mt-5 text-xs font-semibold text-[#477052] underline underline-offset-2">Retour à la connexion</button>
      </div>
      : <>
        <div role="tablist" aria-label="Accès à l’espace client" className="mb-6 flex gap-1 rounded-full bg-[#f0f3ec] p-1">
          {tab("connexion", "Connexion")}{tab("inscription", "Créer mon espace")}
        </div>
        {mode === "connexion" ? <SignInForm onForgot={() => setMode("oubli")}/> : <SignUpForm/>}
      </>}
  </div>;
}
