"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialState);

  return <form action={action} className="mt-7 space-y-4">
    <label className="block text-xs font-semibold text-[#43584e]">Adresse e-mail
      <input name="email" type="email" autoComplete="username" required className="mt-2 h-11 w-full rounded-lg border border-[#e5eae5] px-3 text-sm outline-none focus:border-[#32743d]" />
    </label>
    <label className="block text-xs font-semibold text-[#43584e]">Mot de passe
      <input name="password" type="password" autoComplete="current-password" required className="mt-2 h-11 w-full rounded-lg border border-[#e5eae5] px-3 text-sm outline-none focus:border-[#32743d]" />
    </label>
    {state.error && <p role="alert" className="rounded-lg bg-[#fbf0ee] px-3 py-2 text-xs text-[#8d3c32]">{state.error}</p>}
    <button disabled={pending} className="h-11 w-full rounded-lg bg-[#32743d] text-sm font-bold text-white disabled:opacity-60">
      {pending ? "Connexion…" : "Se connecter"}
    </button>
  </form>;
}
