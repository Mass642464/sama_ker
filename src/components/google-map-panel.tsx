"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, LocateFixed, MapPinned, ShieldCheck } from "lucide-react";
import { getGoogleMapsKey, loadGoogleMaps, onGoogleMapsAuthFailure } from "@/lib/google-maps";
import type { GeoPoint, MapBounds } from "@/lib/geo";
import { getRegionView, senegalView } from "@/lib/senegal-regions";
import type { ImportedGeoJson } from "@/lib/geometry-import";

export type MapMarker = {
  id: string;
  title: string;
  detail: string;
  href: string;
  lat: number;
  lng: number;
};

type Props = {
  region?: string;
  regions?: string[];
  locate?: boolean;
  markers?: MapMarker[];
  focusId?: string | null;
  focusNonce?: number;
  onLocate?: (position: GeoPoint) => void;
  heightClassName?: string;
  note?: string;
  onSearchArea?: (bounds: MapBounds) => void;
  autoFit?: boolean;
  importedGeometry?: ImportedGeoJson | null;
};

type Status = "idle" | "loading" | "ready" | "error";
type MapTypeId = "roadmap" | "satellite";

// Rayon de la zone affichée autour d'un repère : les positions publiées sont arrondies à environ 1 km.
const approximateZoneMeters = 1200;
const singleMarkerZoom = 13;

const geolocationMessages: Record<number, string> = {
  1: "Position refusée : autorisez la localisation dans votre navigateur pour centrer la carte sur vous.",
  2: "Votre position n’a pas pu être déterminée pour le moment.",
  3: "La localisation a pris trop de temps. Réessayez.",
};

export function GoogleMapPanel({
  region = "", regions, locate = false, markers = [], focusId = null, focusNonce = 0, onLocate,
  heightClassName = "h-[320px]", note, onSearchArea, autoFit = true, importedGeometry = null,
}: Props) {
  const apiKey = getGoogleMapsKey();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markerLibrary = useRef<google.maps.MarkerLibrary | null>(null);
  const infoWindow = useRef<google.maps.InfoWindow | null>(null);
  const userCircles = useRef<google.maps.Circle[]>([]);
  const drawn = useRef(new Map<string, { marker: google.maps.marker.AdvancedMarkerElement; zone: google.maps.Circle }>());
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [selectedRegion, setSelectedRegion] = useState(region);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [mapType, setMapType] = useState<MapTypeId>("roadmap");
  const [showZones, setShowZones] = useState(true);
  const [importError, setImportError] = useState<{ geometry: ImportedGeoJson; message: string } | null>(null);
  const showZonesRef = useRef(true);

  useEffect(() => onGoogleMapsAuthFailure(() => {
    setError("La clé Google Maps est refusée ou mal configurée.");
    setStatus("error");
  }), []);

  const showRegion = useCallback((name: string) => {
    if (!map.current) return;
    const view = getRegionView(name) ?? senegalView;
    map.current.setCenter(view.center);
    map.current.setZoom(view.zoom);
  }, []);

  useEffect(() => {
    showRegion(selectedRegion);
  }, [selectedRegion, showRegion]);

  useEffect(() => {
    map.current?.setMapTypeId(mapType);
  }, [mapType]);

  const openInfo = useCallback((item: MapMarker, anchor: google.maps.marker.AdvancedMarkerElement) => {
    if (!map.current || !infoWindow.current) return;
    // Contenu construit en DOM (textContent) : les titres viennent de la base et ne doivent jamais être interprétés comme du HTML.
    const content = document.createElement("div");
    content.style.cssText = "max-width:220px;font:13px system-ui,sans-serif;color:#174c38";
    const title = document.createElement("strong");
    title.textContent = item.title;
    const detail = document.createElement("p");
    detail.style.cssText = "margin:4px 0 8px;color:#586a60";
    detail.textContent = item.detail;
    const link = document.createElement("a");
    link.href = item.href;
    link.textContent = "Voir la fiche";
    link.style.cssText = "font-weight:700;color:#174c38";
    content.append(title, detail, link);
    infoWindow.current.setContent(content);
    infoWindow.current.open({ map: map.current, anchor });
  }, []);

  // Synchronise repères et zones avec la liste fournie.
  useEffect(() => {
    const library = markerLibrary.current;
    if (status !== "ready" || !map.current || !library) return;
    const currentMap = map.current;

    drawn.current.forEach(({ marker, zone }) => { marker.map = null; zone.setMap(null); });
    drawn.current.clear();

    for (const item of markers) {
      const position = { lat: item.lat, lng: item.lng };
      const pin = new library.PinElement({ background: "#174c38", borderColor: "#174c38", glyphColor: "#ffffff" });
      const marker = new library.AdvancedMarkerElement({ map: currentMap, position, title: item.title, content: pin.element });
      marker.addListener("gmp-click", () => openInfo(item, marker));
      const zone = new google.maps.Circle({
        map: showZonesRef.current ? currentMap : null, center: position, radius: approximateZoneMeters,
        strokeColor: "#174c38", strokeOpacity: .6, strokeWeight: 1, fillColor: "#174c38", fillOpacity: .1, clickable: false,
      });
      drawn.current.set(item.id, { marker, zone });
    }

    if (autoFit && markers.length === 1) {
      currentMap.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
      currentMap.setZoom(singleMarkerZoom);
    } else if (autoFit && markers.length > 1 && !selectedRegion) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((item) => bounds.extend({ lat: item.lat, lng: item.lng }));
      currentMap.fitBounds(bounds, 48);
    }
    // La région sélectionnée ne doit pas redessiner les repères : elle est lue seulement pour le cadrage initial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, markers, openInfo]);

  // Afficher ou masquer les zones ne doit ni redessiner les repères ni recadrer la carte.
  useEffect(() => {
    showZonesRef.current = showZones;
    drawn.current.forEach(({ zone }) => zone.setMap(showZones ? map.current : null));
  }, [showZones]);

  useEffect(() => {
    if (status !== "ready" || !map.current || !importedGeometry) return;
    const layer = new google.maps.Data({ map: map.current });
    try {
      layer.setStyle({
        strokeColor: "#ab7628", strokeWeight: 3, fillColor: "#d3a657", fillOpacity: 0.18,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#174c38", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 },
      });
      const features = layer.addGeoJson(importedGeometry);
      const bounds = new google.maps.LatLngBounds();
      features.forEach((feature) => feature.getGeometry()?.forEachLatLng((point) => bounds.extend(point)));
      if (!bounds.isEmpty()) {
        if (importedGeometry.features.length === 1 && importedGeometry.features[0].geometry.type === "Point") {
          map.current.setCenter(bounds.getCenter());
          map.current.setZoom(singleMarkerZoom);
        } else map.current.fitBounds(bounds, 48);
      }
    } catch (caught) {
      console.error("Impossible d’afficher les géométries importées", caught);
      layer.setMap(null);
      // L’erreur provient de la synchronisation avec l’API externe de cartographie.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImportError({ geometry: importedGeometry, message: "Les géométries n’ont pas pu être affichées sur la carte." });
    }
    return () => { layer.setMap(null); };
  }, [status, importedGeometry]);

  useEffect(() => {
    if (!focusId) return;
    const entry = drawn.current.get(focusId);
    const item = markers.find((candidate) => candidate.id === focusId);
    if (!entry || !item || !map.current) return;
    map.current.setCenter({ lat: item.lat, lng: item.lng });
    map.current.setZoom(singleMarkerZoom);
    openInfo(item, entry.marker);
    // focusNonce permet de recentrer à nouveau sur un repère déjà sélectionné.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, focusNonce]);

  async function start() {
    setStatus("loading");
    setError("");
    try {
      await loadGoogleMaps(apiKey);
      const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
      markerLibrary.current = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
      if (!container.current) return;
      const view = getRegionView(selectedRegion) ?? senegalView;
      map.current = new Map(container.current, {
        center: view.center,
        zoom: view.zoom,
        // Identifiant de carte requis pour les repères avancés ; DEMO_MAP_ID convient au développement.
        mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || "DEMO_MAP_ID",
        mapTypeControl: false,
        streetViewControl: false,
        gestureHandling: "cooperative",
      });
      infoWindow.current = new google.maps.InfoWindow();
      setStatus("ready");
    } catch {
      setError("La carte n’a pas pu être chargée. Vérifiez votre connexion ou réessayez plus tard.");
      setStatus("error");
    }
  }

  async function locateUser() {
    setLocationMessage("");
    if (!map.current) return;
    if (!navigator.geolocation) {
      setLocationMessage("Votre navigateur ne permet pas la géolocalisation.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        if (!map.current) return;
        const center = { lat: coords.latitude, lng: coords.longitude };
        userCircles.current.forEach((circle) => circle.setMap(null));
        userCircles.current = [
          new google.maps.Circle({ map: map.current, center, radius: Math.max(coords.accuracy, 30), strokeColor: "#174c38", strokeOpacity: .5, strokeWeight: 1, fillColor: "#174c38", fillOpacity: .12, clickable: false }),
          new google.maps.Circle({ map: map.current, center, radius: 8, strokeColor: "#ffffff", strokeWeight: 2, fillColor: "#174c38", fillOpacity: 1, clickable: false }),
        ];
        map.current.setCenter(center);
        map.current.setZoom(coords.accuracy > 2000 ? 11 : 14);
        setLocationMessage("Carte centrée sur votre position. Elle n’est ni enregistrée ni transmise à Sama Kër.");
        onLocate?.(center);
      },
      (failure) => {
        setLocating(false);
        setLocationMessage(geolocationMessages[failure.code] ?? geolocationMessages[2]);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  if (!apiKey) {
    return <div role="note" className={`grid ${heightClassName} place-items-center rounded-2xl border border-dashed border-[#d9ddd2] bg-[#f6f3ea] p-6 text-center text-xs leading-5 text-[#6f6a58]`}>
      La carte Google Maps n’est pas configurée : ajoutez une clé restreinte dans NEXT_PUBLIC_GOOGLE_MAPS_API_KEY pour l’activer.
    </div>;
  }

  const hasMarkers = markers.length > 0;
  const defaultNote = hasMarkers
    ? "Chaque repère indique une zone d’environ 1 km validée par l’équipe, pas l’emplacement exact du bien."
    : "Vue générale : aucun bien n’est positionné tant qu’une position n’a pas été validée par l’équipe.";

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {regions && regions.length > 0 && <label className="flex items-center gap-3 text-xs font-semibold text-[#43584e]">Région
        <select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)} className="h-10 rounded-xl border border-[#e7e0d4] bg-white px-3 text-xs font-normal outline-none focus:border-[#78a989]">
          <option value="">Tout le Sénégal</option>
          {regions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>}
      {status === "ready" && <>
        <div role="group" aria-label="Fond de carte" className="inline-flex rounded-full bg-[#f0f3ec] p-1">
          {([["roadmap", "Plan"], ["satellite", "Satellite"]] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={mapType === value} onClick={() => setMapType(value)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${mapType === value ? "bg-[#174c38] text-white" : "text-[#56605a]"}`}>{label}</button>
          ))}
        </div>
        {hasMarkers && <label className="flex items-center gap-2 text-xs font-semibold text-[#43584e]"><input type="checkbox" checked={showZones} onChange={(event) => setShowZones(event.target.checked)} className="size-4 accent-[#174c38]"/>Zones approximatives</label>}
        {onSearchArea && <button type="button" onClick={() => {
          const bounds = map.current?.getBounds();
          if (!bounds) {
            setLocationMessage("La zone de la carte n’est pas encore disponible. Réessayez.");
            return;
          }
          const northEast = bounds.getNorthEast();
          const southWest = bounds.getSouthWest();
          onSearchArea({ north: northEast.lat(), east: northEast.lng(), south: southWest.lat(), west: southWest.lng() });
        }} className="rounded-full bg-[#174c38] px-4 py-2 text-xs font-bold text-white">Rechercher dans cette zone</button>}
      </>}
    </div>

    <div className={`relative ${heightClassName} overflow-hidden rounded-2xl border border-[#e7e0d4] bg-[#f0f3ec]`}>
      {status === "idle" || status === "error" ? <div className="grid h-full place-items-center p-6 text-center">
        <div className="max-w-sm">
          <span className="mx-auto grid size-11 place-items-center rounded-full bg-[#edf4ee] text-[#3d7759]"><MapPinned size={20}/></span>
          <p className="mt-4 text-sm font-semibold text-[#174c38]">Carte Google Maps</p>
          <p className="mt-2 flex items-start gap-2 text-left text-[11px] leading-5 text-[#6f7c74]"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#548365]"/>En affichant la carte, votre navigateur se connecte à Google, qui peut recevoir votre adresse IP et utiliser des cookies selon sa propre politique.</p>
          {error && <p role="alert" className="mt-3 rounded-lg bg-[#fbf0ee] px-3 py-2 text-xs text-[#8d3c32]">{error}</p>}
          <button type="button" onClick={() => void start()} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[#174c38] px-6 text-xs font-bold text-white transition hover:bg-[#24674d]">{status === "error" ? "Réessayer" : "Afficher la carte"}</button>
        </div>
      </div> : null}
      {status === "loading" && <div role="status" className="absolute inset-0 z-10 grid place-items-center bg-[#f0f3ec] text-xs text-[#6f7c74]"><span className="flex items-center gap-2"><LoaderCircle size={16} className="animate-spin"/>Chargement de la carte…</span></div>}
      <div ref={container} className={`absolute inset-0 ${status === "ready" ? "" : "invisible"}`} role="application" aria-label="Carte Google Maps du Sénégal"/>
      {status === "ready" && locate && <button type="button" onClick={() => void locateUser()} disabled={locating} className="absolute right-3 top-3 z-10 inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-xs font-bold text-[#174c38] shadow-lg disabled:opacity-60">
        {locating ? <LoaderCircle size={14} className="animate-spin"/> : <LocateFixed size={14}/>}Ma position
      </button>}
    </div>

    <p aria-live="polite" className="min-h-4 text-[11px] leading-5 text-[#60806a]">{locationMessage}</p>
    {importError?.geometry === importedGeometry && <p role="alert" className="text-xs text-red-700">{importError.message}</p>}
    <p className="text-[11px] leading-5 text-[#89938d]">{note ?? defaultNote}</p>
  </div>;
}
