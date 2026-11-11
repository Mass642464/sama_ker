"use client";

const callbackName = "__samaKerGoogleMapsReady";
let loading: Promise<void> | null = null;
const authFailureListeners = new Set<() => void>();

export function getGoogleMapsKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
}

export function onGoogleMapsAuthFailure(listener: () => void) {
  authFailureListeners.add(listener);
  return () => { authFailureListeners.delete(listener); };
}

// Charge l’API Google Maps à la demande : aucun appel à Google n’est émis avant le clic de l’utilisateur.
export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window.google?.maps?.importLibrary === "function") return Promise.resolve();
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    const target = window as unknown as Record<string, unknown>;
    target[callbackName] = () => resolve();
    target.gm_authFailure = () => authFailureListeners.forEach((listener) => listener());

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({
      key: apiKey, v: "weekly", language: "fr", region: "SN", loading: "async", callback: callbackName,
    })}`;
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Google Maps n’a pas pu être chargé."));
    };
    document.head.append(script);
  });
  return loading;
}
