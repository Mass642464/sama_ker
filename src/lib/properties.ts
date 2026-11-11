export type Property = {
  slug: string;
  ref: string;
  title: string;
  location: string;
  region: string;
  price: number;
  priceLabel: string;
  area: number;
  category: "terrain" | "immobilier";
  kind: string;
  status: string;
  verified: boolean;
  featured: boolean;
  isDemo: boolean;
  art: string;
  description: string;
  features: string[];
  photos?: PropertyPhoto[];
  coordinates?: PropertyCoordinates;
};

// Position approximative (arrondie à environ 1 km), validée par l'équipe avant publication.
export type PropertyCoordinates = { lat: number; lng: number };

export type PropertyPhoto = {
  src: string;
  alt: string;
  credit: string;
  sourceUrl: string;
};

type ExampleProperty = Omit<Property, "isDemo">;

const exampleProperties: ExampleProperty[] = [
  {
    slug: "terrain-thies-thiapong-300m2-ref-t0142", ref: "T-0142", title: "Parcelle à Thiapong", location: "Thiapong, Thiès", region: "Thiès", price: 18_500_000, priceLabel: "18 500 000 FCFA", area: 300, category: "terrain", kind: "Terrain résidentiel", status: "Disponible", verified: false, featured: true, art: "field", description: "Une parcelle bien située dans un quartier en développement, avec un accès facile aux axes principaux de Thiès. Les informations de cette fiche sont fournies à titre indicatif et peuvent être confirmées auprès de notre équipe.", features: ["Titre foncier à confirmer", "Accès par voie carrossable", "Réseaux à proximité"], photos: [
      { src: "/images/terrain-vue-aerienne-inspiration.jpg", alt: "Vue aérienne illustrative d’un terrain non localisé, sans lien avec la parcelle T-0142", credit: "Pinterest · épingle 16114511162047557", sourceUrl: "https://fr.pinterest.com/pin/16114511162047557/" },
      { src: "/images/terrain-paysage-inspiration.jpg", alt: "Paysage de terrain non localisé utilisé comme inspiration, sans lien avec la parcelle T-0142", credit: "Pinterest · épingle 23151385580091362", sourceUrl: "https://fr.pinterest.com/pin/23151385580091362/" },
      { src: "/images/Sénégal 🇸🇳.jpg", alt: "Visuel urbain du Sénégal fourni dans le projet, lieu exact non confirmé", credit: "Image fournie dans le workspace", sourceUrl: "" },
    ],
  },
  {
    slug: "terrain-saly-niakhniakhal-450m2-ref-t0186", ref: "T-0186", title: "Terrain proche de la Petite-Côte", location: "Niakhniakhal, Saly", region: "Thiès", price: 27_000_000, priceLabel: "27 000 000 FCFA", area: 450, category: "terrain", kind: "Terrain résidentiel", status: "Disponible", verified: false, featured: true, art: "coast", description: "Une surface généreuse dans un secteur apprécié de la Petite-Côte. Notre équipe peut vous accompagner dans la vérification des informations et l'organisation d'une visite.", features: ["Environnement calme", "Accès à la route principale", "Bornage à vérifier"], photos: [
      { src: "/images/terrain-vue-aerienne-inspiration.jpg", alt: "Vue aérienne illustrative d’un terrain sans lien avec le terrain de Saly", credit: "Pinterest · épingle 16114511162047557", sourceUrl: "https://fr.pinterest.com/pin/16114511162047557/" },
      { src: "/images/terrain-paysage-inspiration.jpg", alt: "Vue paysagère générique, sans localisation confirmée près de Saly", credit: "Pinterest · épingle 23151385580091362", sourceUrl: "https://fr.pinterest.com/pin/23151385580091362/" },
      { src: "/images/Sénégal 🇸🇳.jpg", alt: "Image d’ambiance du Sénégal fournie dans le projet, sans lien confirmé avec ce terrain", credit: "Image fournie dans le workspace", sourceUrl: "" },
    ],
  },
  {
    slug: "terrain-keur-massar-250m2-ref-t0201", ref: "T-0201", title: "Parcelle urbaine à Keur Massar", location: "Keur Massar, Dakar", region: "Dakar", price: 15_000_000, priceLabel: "15 000 000 FCFA", area: 250, category: "terrain", kind: "Terrain urbain", status: "Disponible", verified: false, featured: true, art: "city", description: "Parcelle à découvrir dans une zone urbaine bien desservie. Les éléments administratifs sont communiqués après échange avec un conseiller.", features: ["Quartier habité", "Transports à proximité", "Informations sur demande"], photos: [
      { src: "/images/terrain-vue-aerienne-inspiration.jpg", alt: "Vue aérienne illustrative d’une parcelle non identifiée, différente de la référence T-0201", credit: "Pinterest · épingle 16114511162047557", sourceUrl: "https://fr.pinterest.com/pin/16114511162047557/" },
      { src: "/images/terrain-paysage-inspiration.jpg", alt: "Paysage générique non géolocalisé, utilisé comme inspiration seulement", credit: "Pinterest · épingle 23151385580091362", sourceUrl: "https://fr.pinterest.com/pin/23151385580091362/" },
      { src: "/images/Sénégal 🇸🇳.jpg", alt: "Visuel urbain du Sénégal fourni dans le projet ; ni Dakar ni Keur Massar ne sont confirmés", credit: "Image fournie dans le workspace", sourceUrl: "" },
    ],
  },
  {
    slug: "maison-thies-centre-ref-i0038", ref: "I-0038", title: "Maison familiale lumineuse", location: "Centre-ville, Thiès", region: "Thiès", price: 62_000_000, priceLabel: "62 000 000 FCFA", area: 180, category: "immobilier", kind: "Maison · 4 pièces", status: "Disponible", verified: false, featured: true, art: "house", description: "Une maison familiale avec des volumes agréables et une cour intérieure. Prenez rendez-vous pour obtenir les détails et organiser une visite sur place.", features: ["4 pièces", "Cour intérieure", "Visite sur rendez-vous"], photos: [
      { src: "/images/maison-contemporaine-exterieur-inspiration.jpg", alt: "Façade de maison contemporaine d’inspiration, sans lien confirmé avec la maison I-0038", credit: "Pinterest · épingle 2814818512656691", sourceUrl: "https://fr.pinterest.com/pin/2814818512656691/" },
      { src: "/images/salon-moderne-inspiration.jpg", alt: "Salon moderne d’inspiration, non photographié dans le bien I-0038", credit: "Pinterest · épingle 300756081390539146", sourceUrl: "https://fr.pinterest.com/pin/300756081390539146/" },
      { src: "/images/chambre-parentale-moderne.jpg", alt: "Chambre parentale d’inspiration, non photographiée dans le bien I-0038", credit: "Déco M · Pinterest", sourceUrl: "https://fr.pinterest.com/pin/521362094388334289/" },
      { src: "/images/jardin-residentiel-inspiration.jpg", alt: "Jardin d’inspiration d’une résidence non localisée à Thiès", credit: "Pinterest · épingle 23995810512082845", sourceUrl: "https://fr.pinterest.com/pin/23995810512082845/" },
    ],
  },
  {
    slug: "villa-saly-ref-i0042", ref: "I-0042", title: "Villa avec jardin à Saly", location: "Saly, Mbour", region: "Thiès", price: 95_000_000, priceLabel: "95 000 000 FCFA", area: 240, category: "immobilier", kind: "Villa · 5 pièces", status: "Disponible", verified: false, featured: true, art: "coast", description: "Villa avec espaces extérieurs dans un environnement résidentiel de la Petite-Côte. Échangez avec nos conseillers pour connaître les modalités de visite.", features: ["5 pièces", "Jardin", "Environnement résidentiel"], photos: [
      { src: "/images/maison-contemporaine-exterieur-inspiration.jpg", alt: "Façade contemporaine d’inspiration, non liée à la villa I-0042", credit: "Pinterest · épingle 2814818512656691", sourceUrl: "https://fr.pinterest.com/pin/2814818512656691/" },
      { src: "/images/jardin-residentiel-inspiration.jpg", alt: "Jardin paysager de référence, lieu non confirmé à Saly", credit: "Pinterest · épingle 23995810512082845", sourceUrl: "https://fr.pinterest.com/pin/23995810512082845/" },
      { src: "/images/chambre-parentale-neutre.jpg", alt: "Chambre neutre d’inspiration, différente de la villa annoncée", credit: "Home Luxura Decor · Pinterest", sourceUrl: "https://fr.pinterest.com/pin/244390717275768784/" },
      { src: "/images/salon-moderne-inspiration.jpg", alt: "Salon moderne d’inspiration, non lié à la villa I-0042", credit: "Pinterest · épingle 300756081390539146", sourceUrl: "https://fr.pinterest.com/pin/300756081390539146/" },
    ],
  },
  {
    slug: "appartement-dakar-mermoz-ref-i0054", ref: "I-0054", title: "Appartement contemporain", location: "Mermoz, Dakar", region: "Dakar", price: 450_000, priceLabel: "450 000 FCFA / mois", area: 92, category: "immobilier", kind: "Appartement · 3 pièces", status: "À louer", verified: false, featured: true, art: "city", description: "Appartement en location dans un quartier recherché de Dakar. Contactez-nous pour les conditions de location et les disponibilités.", features: ["3 pièces", "92 m²", "Location mensuelle"], photos: [
      { src: "/images/chambre-parentale-moderne.jpg", alt: "Chambre parentale moderne, image d’inspiration non liée au bien", credit: "Déco M · Pinterest", sourceUrl: "https://fr.pinterest.com/pin/521362094388334289/" },
      { src: "/images/chambre-parentale-neutre.jpg", alt: "Chambre aux tons neutres, image d’inspiration non liée au bien", credit: "Home Luxura Decor · Pinterest", sourceUrl: "https://fr.pinterest.com/pin/244390717275768784/" },
      { src: "/images/salon-moderne-inspiration.jpg", alt: "Salon moderne d’inspiration, différent de l’appartement I-0054", credit: "Pinterest · épingle 300756081390539146", sourceUrl: "https://fr.pinterest.com/pin/300756081390539146/" },
      { src: "/images/maison-contemporaine-exterieur-inspiration.jpg", alt: "Architecture résidentielle contemporaine d’inspiration, non liée à l’appartement I-0054", credit: "Pinterest · épingle 2814818512656691", sourceUrl: "https://fr.pinterest.com/pin/2814818512656691/" },
    ],
  },
];

export const properties = exampleProperties.map((property) => ({ ...property, verified: false, isDemo: true }));

export const formatPrice = (property: Property) => property.priceLabel;

export function getProperty(slug: string) {
  return properties.find((property) => property.slug === slug);
}

export function getPropertyHref(property: Property) {
  return `/${property.category === "terrain" ? "terrains" : "immobilier"}/${property.slug}`;
}

export type PropertySearchParams = {
  page?: string;
  localisation?: string;
  region?: string;
  budget?: string;
  prixMin?: string;
  prixMax?: string;
  surfaceMin?: string;
  surfaceMax?: string;
  type?: string;
  statut?: string;
  tri?: string;
};

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim();
}

function numericFilter(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function filterProperties(listings: Property[], params: PropertySearchParams) {
  const location = normalized(params.localisation ?? "");
  const region = normalized(params.region ?? "");
  const type = normalized(params.type ?? "");
  const minPrice = numericFilter(params.prixMin, 0);
  const maxPrice = numericFilter(params.prixMax, numericFilter(params.budget, Infinity));
  const minArea = numericFilter(params.surfaceMin, 0);
  const maxArea = numericFilter(params.surfaceMax, Infinity);
  const filtered = listings.filter((property) =>
    (!location || normalized(property.location).includes(location)) &&
    (!region || normalized(property.region) === region) &&
    (!type || normalized(property.kind).includes(type)) &&
    (!params.statut || property.status === params.statut) &&
    property.price >= minPrice && property.price <= maxPrice &&
    property.area >= minArea && property.area <= maxArea,
  );

  switch (params.tri) {
    case "prix-croissant": return filtered.sort((left, right) => left.price - right.price);
    case "prix-decroissant": return filtered.sort((left, right) => right.price - left.price);
    case "surface-croissante": return filtered.sort((left, right) => left.area - right.area);
    case "surface-decroissante": return filtered.sort((left, right) => right.area - left.area);
    default: return filtered;
  }
}