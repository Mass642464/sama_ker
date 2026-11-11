"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

export async function signIn(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Saisissez votre adresse e-mail et votre mot de passe." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Connexion impossible. Vérifiez vos identifiants ou contactez l’administrateur." };

  // L’appartenance à l’équipe et le rôle sont vérifiés par l’API à l’ouverture de l’administration.
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("La déconnexion n’a pas pu être terminée.");
  redirect("/connexion-admin");
}
