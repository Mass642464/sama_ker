"use server";

import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export type AuthState = { error?: string; notice?: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signInClient(_previousState: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!emailPattern.test(email) || !password) return { error: "Saisissez votre adresse e-mail et votre mot de passe." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error: error.code === "email_not_confirmed"
        ? "Confirmez votre adresse e-mail grâce au message reçu avant de vous connecter."
        : "Connexion impossible. Vérifiez vos identifiants.",
    };
  }
  redirect("/espace-client");
}

export async function signUpClient(_previousState: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const consent = formData.get("consent") === "on";
  if (!emailPattern.test(email) || email.length > 254) return { error: "Saisissez une adresse e-mail valide." };
  if (password.length < 10 || password.length > 72) return { error: "Choisissez un mot de passe de 10 à 72 caractères." };
  if (!consent) return { error: "Votre accord est nécessaire pour créer un compte." };

  // Même réponse dans tous les cas pour ne pas révéler si une adresse est déjà utilisée.
  const notice = "Si cette adresse peut être utilisée, un e-mail de confirmation vient d’être envoyé. Cliquez sur son lien pour activer votre espace.";
  if (isAdminEmail(email)) return { notice };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: new URL("/espace-client/confirmation", getSiteUrl()).toString() },
  });
  if (error) {
    return {
      error: error.code === "weak_password"
        ? "Ce mot de passe est trop faible. Choisissez-en un plus long et moins courant."
        : "L’inscription est momentanément impossible. Réessayez plus tard.",
    };
  }
  if (data.session) redirect("/espace-client");
  return { notice };
}

export async function signOutClient() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("La déconnexion n’a pas pu être terminée.");
  redirect("/espace-client/connexion");
}
