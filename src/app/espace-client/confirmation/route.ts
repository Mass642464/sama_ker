import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

// Destinations autorisées après confirmation ou réinitialisation : jamais une URL externe fournie par la requête.
const allowedNext = new Map([
  ["/espace-client", "/espace-client"],
  ["/espace-client/reinitialisation", "/espace-client/reinitialisation"],
]);

export async function GET(request: NextRequest) {
  const site = getSiteUrl();
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = allowedNext.get(searchParams.get("next") ?? "") ?? "/espace-client";

  let confirmed = false;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    if (code) {
      confirmed = !(await supabase.auth.exchangeCodeForSession(code)).error;
    } else if (tokenHash && (type === "signup" || type === "email" || type === "recovery")) {
      confirmed = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
    }
  }

  const failure = next === "/espace-client/reinitialisation" ? "/espace-client/connexion?erreur=reinitialisation" : "/espace-client/connexion?erreur=confirmation";
  const response = NextResponse.redirect(new URL(confirmed ? next : failure, site));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
