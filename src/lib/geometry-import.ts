export type ImportedGeometry =
  | { type: "Point"; coordinates: number[] }
  | { type: "LineString"; coordinates: number[][] }
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPoint"; coordinates: number[][] }
  | { type: "MultiLineString"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export type ImportedGeoJson = {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: null; geometry: ImportedGeometry }[];
};

const maxFeatures = 250;
const maxPositions = 10_000;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseGeoJson(value: unknown): ImportedGeoJson {
  let positions = 0;
  const features: ImportedGeoJson["features"] = [];
  function point(value: unknown): number[] {
    if (!Array.isArray(value) || value.length < 2 || value.length > 3 ||
      !value.every((n) => typeof n === "number" && Number.isFinite(n)) ||
      value[0] < -180 || value[0] > 180 || value[1] < -90 || value[1] > 90) {
      throw new Error("Coordonnées invalides : utilisez longitude, latitude en degrés décimaux.");
    }
    if (++positions > maxPositions) throw new Error("Le fichier dépasse la limite de 10 000 positions.");
    return [value[0], value[1]];
  }
  function points(value: unknown, min: number): number[][] {
    if (!Array.isArray(value) || value.length < min) throw new Error("Géométrie vide ou incomplète.");
    return value.map(point);
  }
  function polygon(value: unknown): number[][][] {
    if (!Array.isArray(value) || value.length === 0) throw new Error("Polygone vide.");
    return value.map((ring) => {
      const vertices = points(ring, 4);
      if (vertices[0][0] !== vertices[vertices.length - 1][0] || vertices[0][1] !== vertices[vertices.length - 1][1]) {
        throw new Error("Chaque contour de polygone doit être fermé.");
      }
      return vertices;
    });
  }
  function geometry(value: unknown, depth = 0): void {
    if (depth > 16) throw new Error("Les collections de géométries sont trop imbriquées.");
    if (!record(value) || typeof value.type !== "string") throw new Error("Géométrie GeoJSON invalide.");
    if (value.crs !== undefined) throw new Error("Les systèmes de coordonnées personnalisés ne sont pas pris en charge : utilisez WGS 84.");
    if (value.type === "GeometryCollection") {
      if (!Array.isArray(value.geometries) || value.geometries.length === 0) throw new Error("Collection de géométries vide.");
      for (const item of value.geometries) geometry(item, depth + 1);
      return;
    }
    let result: ImportedGeometry;
    switch (value.type) {
      case "Point": result = { type: "Point", coordinates: point(value.coordinates) }; break;
      case "LineString": result = { type: "LineString", coordinates: points(value.coordinates, 2) }; break;
      case "Polygon": result = { type: "Polygon", coordinates: polygon(value.coordinates) }; break;
      case "MultiPoint": result = { type: "MultiPoint", coordinates: points(value.coordinates, 1) }; break;
      case "MultiLineString":
        if (!Array.isArray(value.coordinates) || !value.coordinates.length) throw new Error("Géométrie vide.");
        result = { type: "MultiLineString", coordinates: value.coordinates.map((line) => points(line, 2)) }; break;
      case "MultiPolygon":
        if (!Array.isArray(value.coordinates) || !value.coordinates.length) throw new Error("Géométrie vide.");
        result = { type: "MultiPolygon", coordinates: value.coordinates.map(polygon) }; break;
      default: throw new Error(`Type de géométrie non pris en charge : ${value.type}.`);
    }
    if (features.length >= maxFeatures) throw new Error("Le fichier dépasse la limite de 250 géométries.");
    features.push({ type: "Feature", properties: null, geometry: result });
  }
  function add(value: unknown) {
    if (!record(value)) throw new Error("Objet GeoJSON invalide.");
    if (value.crs !== undefined) throw new Error("Les systèmes de coordonnées personnalisés ne sont pas pris en charge : utilisez WGS 84.");
    if (value.type === "Feature") geometry(value.geometry);
    else geometry(value);
  }
  if (!record(value)) throw new Error("Objet GeoJSON invalide.");
  if (value.crs !== undefined) throw new Error("Les systèmes de coordonnées personnalisés ne sont pas pris en charge : utilisez WGS 84.");
  if (value.type === "FeatureCollection") {
    if (!Array.isArray(value.features) || !value.features.length) throw new Error("Collection GeoJSON vide.");
    for (const item of value.features) add(item);
  } else add(value);
  return { type: "FeatureCollection", features };
}

export function parseKml(text: string): ImportedGeoJson {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("Les déclarations XML de type DOCTYPE ou ENTITY ne sont pas autorisées.");
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.getElementsByTagName("parsererror").length) throw new Error("Le fichier KML n’est pas un XML valide.");
  if (document.documentElement.localName !== "kml") throw new Error("Le fichier doit contenir un document KML.");
  if (Array.from(document.getElementsByTagName("*")).some((element) => ["NetworkLink", "GroundOverlay", "ScreenOverlay", "PhotoOverlay", "Model", "Track", "MultiTrack"].includes(element.localName))) {
    throw new Error("Ce KML contient des éléments ou liens externes non pris en charge.");
  }
  function children(element: Element, name: string) {
    return Array.from(element.children).filter((child) => child.localName === name);
  }
  function coordinates(element: Element): number[][] {
    const nodes = children(element, "coordinates");
    if (nodes.length !== 1 || !nodes[0].textContent?.trim()) throw new Error("Coordonnées KML manquantes.");
    return nodes[0].textContent.trim().split(/\s+/).map((tuple) => {
      const parts = tuple.split(",");
      if (parts.length < 2 || parts.length > 3 || parts.some((part) => !part.trim() || !Number.isFinite(Number(part)))) throw new Error("Coordonnées KML invalides.");
      return parts.map(Number);
    });
  }
  const geometries: Record<string, unknown>[] = [];
  const consumed = new Set<Element>();
  const metadata = new Set(["name", "description", "visibility", "open", "address", "phoneNumber", "styleUrl", "Style", "StyleMap", "ExtendedData", "TimeStamp", "TimeSpan", "Region", "Snippet", "snippet"]);
  function readGeometry(element: Element): void {
    consumed.add(element);
    if (element.localName === "Point") {
      const list = coordinates(element);
      if (list.length !== 1) throw new Error("Un point KML doit contenir une seule position.");
      geometries.push({ type: "Point", coordinates: list[0] });
    } else if (element.localName === "LineString") {
      geometries.push({ type: "LineString", coordinates: coordinates(element) });
    } else if (element.localName === "Polygon") {
      const outer = children(element, "outerBoundaryIs");
      const inner = children(element, "innerBoundaryIs");
      if (outer.length !== 1) throw new Error("Contour extérieur KML manquant.");
      const rings = [...outer, ...inner].map((boundary) => {
        const ring = children(boundary, "LinearRing");
        if (ring.length !== 1) throw new Error("Contour KML invalide.");
        consumed.add(ring[0]);
        return coordinates(ring[0]);
      });
      geometries.push({ type: "Polygon", coordinates: rings });
    } else if (element.localName === "MultiGeometry") {
      if (!element.children.length) throw new Error("Collection de géométries KML vide.");
      for (const child of Array.from(element.children)) readGeometry(child);
    } else {
      throw new Error(`Élément géométrique KML non pris en charge : ${element.localName}.`);
    }
  }
  const elements = Array.from(document.getElementsByTagName("*"));
  for (const placemark of elements.filter((element) => element.localName === "Placemark")) {
    let found = false;
    for (const child of Array.from(placemark.children)) {
      if (metadata.has(child.localName)) continue;
      found = true;
      readGeometry(child);
    }
    if (!found) throw new Error("Un repère KML ne contient aucune géométrie compatible.");
  }
  if (elements.some((element) => ["Point", "LineString", "Polygon", "MultiGeometry", "LinearRing"].includes(element.localName) && !consumed.has(element))) {
    throw new Error("Le fichier contient une géométrie KML hors d’un repère ou non prise en charge.");
  }
  if (!geometries.length) throw new Error("Aucune géométrie KML compatible trouvée.");
  return parseGeoJson({ type: "GeometryCollection", geometries });
}
