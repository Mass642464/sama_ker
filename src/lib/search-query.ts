export type ParsedSearch = {
  category?: "terrain" | "immobilier";
  localisation?: string;
  prixMin?: number;
  prixMax?: number;
  surfaceMin?: number;
  surfaceMax?: number;
  keywords: string[];
  unsupportedProximity?: boolean;
};

export function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim();
}

function amount(value: string, unit = "") {
  const number = Number(value.replace(/\s/g, "").replace(",", "."));
  const multiplier = unit.startsWith("milliard") ? 1_000_000_000 : unit.startsWith("million") ? 1_000_000 : unit.startsWith("mille") ? 1_000 : 1;
  const result = number * multiplier;
  return Number.isFinite(result) && result >= 0 ? result : undefined;
}

export function parseSearchQuery(query: string): ParsedSearch {
  let text = normalizeSearch(query).replace(/m²/g, "m2");
  const result: ParsedSearch = { keywords: [] };
  result.unsupportedProximity = /\b(?:proche|pres|proximite)\b/.test(text);
  text = text.replace(/\b(?:terrain|terrains|parcelle|parcelles)\b/g, () => {
    result.category = "terrain";
    return " ";
  });
  text = text.replace(/\b(?:maison|maisons|villa|villas|appartement|appartements|logement|logements)\b/g, (match) => {
    result.category = "immobilier";
    result.keywords.push(match.replace(/s$/, ""));
    return " ";
  });
  text = text.replace(/\b(?:de|entre)?\s*(\d+(?:[.,]\d+)?)\s*(?:a|et|-)\s*(\d+(?:[.,]\d+)?)\s*(?:m2|metres?\s*carres?)\b/g, (_match, min: string, max: string) => {
    result.surfaceMin = amount(min);
    result.surfaceMax = amount(max);
    return " ";
  });
  text = text.replace(/\b(?:budget|prix)\s*(?:inferieur a|moins de|maximum|au maximum|jusqu'?a|de|:)?\s*(\d+(?:[.,]\d+)?)\s*(milliards?|millions?|mille)?\s*(?:de\s*)?(?:fcfa|cfa)?\b/g, (match, value: string, unit: string | undefined) => {
    const parsed = amount(value, unit);
    result.prixMax = parsed !== undefined && /inferieur a|moins de/.test(match) ? Math.max(0, parsed - 1) : parsed;
    return " ";
  });
  text = text.replace(/\b(?:a|au|aux|dans|vers)\s+([a-z][a-z0-9'-]*(?:\s+[a-z][a-z0-9'-]*){0,3}?)(?=\s*(?:,|;|\.|$|\s+avec\b|\s+pour\b|\s+budget\b))/g, (_match, location: string) => {
    result.localisation = location.trim();
    return " ";
  });
  const stop = new Set(["un", "une", "des", "du", "de", "le", "la", "les", "avec", "pour", "je", "cherche", "recherche", "trouve", "trouver", "et", "a", "au", "en"]);
  result.keywords.push(...text.split(/[^a-z0-9-]+/).filter((word) => word && !stop.has(word)));
  return result;
}
