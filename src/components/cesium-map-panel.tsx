"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { LoaderCircle, LocateFixed, MapPinned, ShieldCheck } from "lucide-react";
import type * as Cesium from "cesium";
import type { GeoPoint, MapBounds } from "@/lib/geo";
import type { ImportedGeoJson } from "@/lib/geometry-import";
import { getRegionView, senegalView } from "@/lib/senegal-regions";

export type MapMarker = { id: string; title: string; detail: string; href: string; lat: number; lng: number };

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

declare global {
  interface Window {
    Cesium?: typeof Cesium;
    CESIUM_BASE_URL?: string;
  }
}

let cesiumLoad: Promise<typeof Cesium> | null = null;

function loadCesium(): Promise<typeof Cesium> {
  if (window.Cesium) return Promise.resolve(window.Cesium);
  if (cesiumLoad) return cesiumLoad;
  window.CESIUM_BASE_URL = "/cesium/";
  if (!document.getElementById("cesium-widgets-css")) {
    const link = document.createElement("link");
    link.id = "cesium-widgets-css";
    link.rel = "stylesheet";
    link.href = "/cesium/Widgets/widgets.css";
    document.head.append(link);
  }
  cesiumLoad = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/cesium/Cesium.js";
    script.onload = () => {
      if (window.Cesium) resolve(window.Cesium);
      else { script.remove(); cesiumLoad = null; reject(new Error("CesiumJS est indisponible.")); }
    };
    script.onerror = () => {
      script.remove();
      cesiumLoad = null;
      reject(new Error("CesiumJS n’a pas pu être chargé."));
    };
    document.head.append(script);
  });
  return cesiumLoad;
}

const geolocationMessages: Record<number, string> = {
  1: "Position refusée : autorisez la localisation dans votre navigateur pour centrer la carte sur vous.",
  2: "Votre position n’a pas pu être déterminée pour le moment.",
  3: "La localisation a pris trop de temps. Réessayez.",
};

export function CesiumMapPanel({
  region = "", regions, locate = false, markers = [], focusId = null, focusNonce = 0, onLocate,
  heightClassName = "h-[320px]", note, onSearchArea, autoFit = true, importedGeometry = null,
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_TILES_API_KEY?.trim() ?? "";
  const container = useRef<HTMLDivElement>(null);
  const credits = useRef<HTMLDivElement>(null);
  const viewer = useRef<Cesium.Viewer | null>(null);
  const library = useRef<typeof Cesium | null>(null);
  const markerEntities = useRef<Cesium.Entity[]>([]);
  const locationEntities = useRef<Cesium.Entity[]>([]);
  const selectedRegionRef = useRef(region);
  const markersRef = useRef(markers);
  const autoFitRef = useRef(autoFit);
  const showZonesRef = useRef(true);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [selectedRegion, setSelectedRegion] = useState(region);
  const [selected, setSelected] = useState<MapMarker | null>(null);
  const [showZones, setShowZones] = useState(true);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [importError, setImportError] = useState<{ geometry: ImportedGeoJson; message: string } | null>(null);
  useEffect(() => {
    markersRef.current = markers;
    autoFitRef.current = autoFit;
    selectedRegionRef.current = selectedRegion;
    showZonesRef.current = showZones;
  }, [markers, autoFit, selectedRegion, showZones]);

  const flyTo = useCallback((point: GeoPoint, height: number) => {
    const map = viewer.current;
    const C = library.current;
    if (!map || !C || map.isDestroyed()) return;
    map.camera.flyTo({ destination: C.Cartesian3.fromDegrees(point.lng, point.lat, height), orientation: { heading: 0, pitch: C.Math.toRadians(-65), roll: 0 }, duration: 1 });
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    const view = getRegionView(selectedRegion) ?? senegalView;
    flyTo(view.center, 12_000_000 / 2 ** (view.zoom - 3));
  }, [selectedRegion, status, flyTo]);

  useEffect(() => {
    const map = viewer.current;
    const C = library.current;
    if (status !== "ready" || !map || !C) return;
    markerEntities.current.forEach((entity) => map.entities.remove(entity));
    markerEntities.current = markers.map((item) => map.entities.add({
      id: `listing:${item.id}`,
      position: C.Cartesian3.fromDegrees(item.lng, item.lat),
      point: { pixelSize: 13, color: C.Color.fromCssColorString("#174c38"), outlineColor: C.Color.WHITE, outlineWidth: 2, heightReference: C.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      ellipse: { semiMajorAxis: 1200, semiMinorAxis: 1200, height: 0, material: C.Color.fromCssColorString("#174c38").withAlpha(0.18), heightReference: C.HeightReference.CLAMP_TO_GROUND, show: showZonesRef.current },
    }));
    if (autoFitRef.current && markers.length === 1) flyTo(markers[0], 5000);
    else if (autoFitRef.current && markers.length > 1 && !selectedRegionRef.current) {
      void map.flyTo(markerEntities.current, { duration: 1 }).catch((failure: unknown) => console.error("Cadrage de la carte impossible", failure));
    }
    return () => { if (!map.isDestroyed()) markerEntities.current.forEach((entity) => map.entities.remove(entity)); markerEntities.current = []; };
  }, [status, markers, flyTo]);

  useEffect(() => {
    for (const entity of markerEntities.current) {
      if (entity.ellipse?.show instanceof (library.current!.ConstantProperty)) entity.ellipse.show.setValue(showZones);
    }
  }, [status, showZones, markers]);

  useEffect(() => {
    const item = markersRef.current.find((marker) => marker.id === focusId);
    if (status !== "ready" || !item) return;
    flyTo(item, 5000);
    // Un nouveau nonce permet de recentrer plusieurs fois sur le même bien.
    setSelected(item);
  }, [focusId, focusNonce, status, flyTo]);

  useEffect(() => {
    const map = viewer.current;
    const C = library.current;
    if (status !== "ready" || !map || !C || !importedGeometry) return;
    let active = true;
    let source: Cesium.GeoJsonDataSource | null = null;
    void C.GeoJsonDataSource.load(importedGeometry, {
      clampToGround: true,
      stroke: C.Color.fromCssColorString("#ab7628"),
      strokeWidth: 3,
      fill: C.Color.fromCssColorString("#d3a657").withAlpha(0.25),
      markerColor: C.Color.fromCssColorString("#174c38"),
    }).then(async (loaded) => {
      if (!active || map.isDestroyed()) return;
      source = loaded;
      await map.dataSources.add(loaded);
      if (active && !map.isDestroyed()) await map.flyTo(loaded);
    }).catch((failure: unknown) => {
      console.error("Impossible d’afficher les géométries importées", failure);
      if (active) setImportError({ geometry: importedGeometry, message: "Les géométries n’ont pas pu être affichées sur la carte." });
    });
    return () => { active = false; if (source && !map.isDestroyed()) map.dataSources.remove(source, true); };
  }, [status, importedGeometry]);

  useEffect(() => () => {
    const map = viewer.current;
    viewer.current = null;
    if (map && !map.isDestroyed()) map.destroy();
  }, []);

  async function start() {
    if (status === "loading") return;
    setStatus("loading");
    setError("");
    let map: Cesium.Viewer | null = null;
    try {
      const C = await loadCesium();
      if (!container.current || !credits.current) return;
      library.current = C;
      map = new C.Viewer(container.current, {
        globe: false, baseLayer: false, geocoder: false, homeButton: false, sceneModePicker: false,
        baseLayerPicker: false, navigationHelpButton: false, animation: false, timeline: false,
        fullscreenButton: false, infoBox: false, selectionIndicator: false,
        creditContainer: credits.current,
        requestRenderMode: true, maximumRenderTimeChange: Infinity,
      });
      viewer.current = map;
      const tileset = await C.createGooglePhotorealistic3DTileset(
        { key: apiKey, onlyUsingWithGoogleGeocoder: true },
        { showCreditsOnScreen: true, maximumScreenSpaceError: 24, cacheBytes: 256 * 1024 * 1024, maximumCacheOverflowBytes: 128 * 1024 * 1024 },
      );
      if (map.isDestroyed() || viewer.current !== map) { tileset.destroy(); return; }
      map.scene.primitives.add(tileset);
      tileset.tileFailed.addEventListener(() => setError("Certaines tuiles 3D n’ont pas pu être chargées. Vérifiez la connexion, la clé et la couverture Google."));
      map.screenSpaceEventHandler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        const picked = map?.scene.pick(movement.position) as { id?: Cesium.Entity } | undefined;
        const id = picked?.id?.id;
        if (typeof id === "string" && id.startsWith("listing:")) setSelected(markersRef.current.find((item) => `listing:${item.id}` === id) ?? null);
      }, C.ScreenSpaceEventType.LEFT_CLICK);
      setStatus("ready");
    } catch (failure) {
      console.error("Chargement de la carte 3D impossible", failure);
      if (map && !map.isDestroyed()) map.destroy();
      viewer.current = null;
      setError("La carte 3D n’a pas pu être chargée. Vérifiez la clé Map Tiles API, la facturation et votre connexion.");
      setStatus("error");
    }
  }

  function locateUser() {
    setLocationMessage("");
    if (!viewer.current) return;
    if (!navigator.geolocation) { setLocationMessage("Votre navigateur ne permet pas la géolocalisation."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLocating(false);
      const map = viewer.current;
      const C = library.current;
      if (!map || !C || map.isDestroyed()) return;
      const center = { lat: coords.latitude, lng: coords.longitude };
      locationEntities.current.forEach((entity) => map.entities.remove(entity));
      locationEntities.current = [map.entities.add({
        position: C.Cartesian3.fromDegrees(center.lng, center.lat),
        point: { pixelSize: 10, color: C.Color.fromCssColorString("#174c38"), outlineColor: C.Color.WHITE, outlineWidth: 2, heightReference: C.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        ellipse: { semiMajorAxis: Math.max(coords.accuracy, 30), semiMinorAxis: Math.max(coords.accuracy, 30), height: 0, material: C.Color.fromCssColorString("#174c38").withAlpha(0.12), heightReference: C.HeightReference.CLAMP_TO_GROUND },
      })];
      flyTo(center, coords.accuracy > 2000 ? 20_000 : 5000);
      setLocationMessage("Carte centrée sur votre position. Elle n’est pas enregistrée par Sama Kër ; Google reçoit les requêtes des tuiles de la zone affichée.");
      onLocate?.(center);
    }, (failure) => {
      setLocating(false);
      setLocationMessage(geolocationMessages[failure.code] ?? geolocationMessages[2]);
    }, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 });
  }

  if (!apiKey) return <div role="note" className={`grid ${heightClassName} place-items-center rounded-2xl border border-dashed border-[#d9ddd2] bg-[#f6f3ea] p-6 text-center text-xs leading-5 text-[#6f6a58]`}>La carte 3D n’est pas configurée : ajoutez une clé Map Tiles API restreinte dans NEXT_PUBLIC_GOOGLE_MAP_TILES_API_KEY.</div>;

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {regions && regions.length > 0 && <label className="flex items-center gap-3 text-xs font-semibold text-[#43584e]">Région<select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)} className="h-10 rounded-xl border border-[#e7e0d4] bg-white px-3 text-xs"><option value="">Tout le Sénégal</option>{regions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}
      {status === "ready" && <>
        {markers.length > 0 && <label className="flex items-center gap-2 text-xs font-semibold text-[#43584e]"><input type="checkbox" checked={showZones} onChange={(event) => setShowZones(event.target.checked)} className="size-4 accent-[#174c38]"/>Zones approximatives</label>}
        {onSearchArea && <button type="button" onClick={() => {
          const C = library.current;
          const bounds = viewer.current?.camera.computeViewRectangle(C?.Ellipsoid.WGS84);
          if (!bounds || !C) { setLocationMessage("La zone de la carte n’est pas disponible. Réessayez avec une vue plus verticale."); return; }
          onSearchArea({ north: C.Math.toDegrees(bounds.north), east: C.Math.toDegrees(bounds.east), south: C.Math.toDegrees(bounds.south), west: C.Math.toDegrees(bounds.west) });
        }} className="rounded-full bg-[#174c38] px-4 py-2 text-xs font-bold text-white">Rechercher dans cette zone</button>}
      </>}
    </div>
    <div className={`relative ${heightClassName} overflow-hidden rounded-2xl border border-[#e7e0d4] bg-[#f0f3ec]`}>
      {(status === "idle" || status === "error") && <div className="grid h-full place-items-center p-6 text-center"><div className="max-w-sm">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-[#edf4ee] text-[#3d7759]"><MapPinned size={20}/></span>
        <p className="mt-4 text-sm font-semibold text-[#174c38]">Carte immersive 3D</p>
        <p className="mt-2 flex items-start gap-2 text-left text-[11px] leading-5 text-[#6f7c74]"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#548365]"/>En affichant la carte, votre navigateur se connecte à Google et aux services de Cesium ; ces services peuvent recevoir votre adresse IP et les zones affichées.</p>
        {error && <p role="alert" className="mt-3 rounded-lg bg-[#fbf0ee] px-3 py-2 text-xs text-[#8d3c32]">{error}</p>}
        <button type="button" onClick={() => void start()} className="mt-4 min-h-11 rounded-full bg-[#174c38] px-6 text-xs font-bold text-white">{status === "error" ? "Réessayer" : "Afficher la carte 3D"}</button>
      </div></div>}
      {status === "loading" && <div role="status" className="absolute inset-0 z-10 grid place-items-center bg-[#f0f3ec] text-xs text-[#6f7c74]"><span className="flex items-center gap-2"><LoaderCircle size={16} className="animate-spin"/>Chargement de la carte 3D…</span></div>}
      <div ref={container} className={`absolute inset-0 ${status === "ready" ? "" : "invisible"}`} role="application" aria-label="Carte 3D du Sénégal"/>
      <div className={`cesium-attribution absolute inset-x-0 bottom-0 z-10 flex items-center bg-white text-[#263238] ${status === "ready" ? "" : "invisible"}`}>
        <Image src="/images/google-maps-attribution.png" alt="Google Maps" width={98} height={18} unoptimized className="mx-[10px] mb-[5px] mt-[10px] h-[18px] w-auto shrink-0"/>
        <div ref={credits} className="min-w-0 flex-1 text-[10px] leading-4"/>
      </div>
      {status === "ready" && locate && <button type="button" onClick={locateUser} disabled={locating} className="absolute right-3 top-3 z-10 inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-xs font-bold text-[#174c38] shadow-lg disabled:opacity-60">{locating ? <LoaderCircle size={14} className="animate-spin"/> : <LocateFixed size={14}/>}Ma position</button>}
      {status === "ready" && selected && <div className="absolute left-3 top-3 z-10 max-w-56 rounded-xl bg-white p-3 text-xs text-[#174c38] shadow-lg"><button type="button" onClick={() => setSelected(null)} className="float-right ml-2 font-bold" aria-label="Fermer">×</button><strong>{selected.title}</strong><p className="mt-1">{selected.detail}</p><a href={selected.href} className="mt-2 inline-block font-bold underline">Voir la fiche</a></div>}
    </div>
    {status === "ready" && error && <p role="alert" className="text-xs text-[#8d3c32]">{error}</p>}
    <p aria-live="polite" className="min-h-4 text-[11px] leading-5 text-[#60806a]">{locationMessage}</p>
    {importError?.geometry === importedGeometry && <p role="alert" className="text-xs text-red-700">{importError.message}</p>}
    <p className="text-[11px] leading-5 text-[#89938d]">{note ?? (markers.length ? "Chaque repère indique une zone d’environ 1 km, pas l’emplacement exact du bien." : "Vue générale : aucun bien n’est positionné tant qu’une position n’a pas été validée par l’équipe.")}</p>
  </div>;
}
