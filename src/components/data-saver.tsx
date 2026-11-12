"use client";

import { useState, useSyncExternalStore } from "react";

const storageKey = "sama-ker-data-saver";
const changeEvent = "sama-ker-data-saver-change";

function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(changeEvent, callback);
  };
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(storageKey) !== "off";
  } catch {
    return true;
  }
}

export function useDataSaver() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

export function DataSaverToggle() {
  const enabled = useDataSaver();
  const [error, setError] = useState("");

  function toggle() {
    try {
      window.localStorage.setItem(storageKey, enabled ? "off" : "on");
      window.dispatchEvent(new Event(changeEvent));
      setError("");
    } catch {
      setError("Impossible de mémoriser ce choix sur cet appareil. Vérifiez les réglages du navigateur.");
    }
  }

  return <div className="border-t border-[#eee8dc] bg-[#f5f1e8]">
    <div className="container flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
      <p className="text-xs leading-5 text-[#43584e]">Mode léger : cartes sur demande{enabled ? ", miniatures et diaporama limités" : ""}.</p>
      <button type="button" aria-pressed={enabled} onClick={toggle} className="min-h-11 rounded-lg px-2 text-xs font-bold text-[#174c38] underline underline-offset-2">
        Mode léger {enabled ? "activé" : "désactivé"}
      </button>
      {error && <p role="alert" className="w-full text-xs text-[#8d3c32]">{error}</p>}
    </div>
  </div>;
}
