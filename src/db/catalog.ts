export const EDITION_SIZE = 16;

export const RETAIL_BOX_CENTS = {
  toronto: 28000,
  vancouver: 30000,
  "united-states": 45000,
} as const;

export const RETAIL_JAR_CENTS = {
  toronto: 8000,
  vancouver: 8500,
  "united-states": 16000,
} as const;

export const WHOLESALE_SET_CENTS = 260000;
export const WHOLESALE_JAR_CENTS = 4000;

export const RETAIL_SELECTION_ON_HAND = 1;
export const RETAIL_JAR_ON_HAND = 24;
export const WHOLESALE_SELECTION_ON_HAND = 2;
export const WHOLESALE_JAR_ON_HAND = 80;

export type RegionSeed = {
  slug: string;
  name: string;
  country: "CA" | "US";
  currency: "CAD" | "USD";
  channel: "retail" | "wholesale";
  minimumAge: number;
  timeZone: string;
  sortOrder: number;
};

export const regionSeeds: RegionSeed[] = [
  {
    slug: "toronto",
    name: "Toronto",
    country: "CA",
    currency: "CAD",
    channel: "retail",
    minimumAge: 19,
    timeZone: "America/Toronto",
    sortOrder: 1,
  },
  {
    slug: "vancouver",
    name: "Vancouver",
    country: "CA",
    currency: "CAD",
    channel: "retail",
    minimumAge: 19,
    timeZone: "America/Vancouver",
    sortOrder: 2,
  },
  {
    slug: "united-states",
    name: "United States",
    country: "US",
    currency: "USD",
    channel: "retail",
    minimumAge: 21,
    timeZone: "America/Los_Angeles",
    sortOrder: 3,
  },
  {
    slug: "on-golden-horseshoe",
    name: "Ontario — Golden Horseshoe",
    country: "CA",
    currency: "CAD",
    channel: "wholesale",
    minimumAge: 19,
    timeZone: "America/Toronto",
    sortOrder: 4,
  },
  {
    slug: "on-eastern",
    name: "Ontario — Eastern",
    country: "CA",
    currency: "CAD",
    channel: "wholesale",
    minimumAge: 19,
    timeZone: "America/Toronto",
    sortOrder: 5,
  },
  {
    slug: "on-southwestern",
    name: "Ontario — Southwestern",
    country: "CA",
    currency: "CAD",
    channel: "wholesale",
    minimumAge: 19,
    timeZone: "America/Toronto",
    sortOrder: 6,
  },
];

export const retailRegions = regionSeeds.filter((region) => region.channel === "retail");
export const customerRetailRegions = retailRegions.filter((region) => region.slug !== "united-states");

export const TORONTO_DROP = {
  name: "Sunday Service",
  venue: "Sunday Service by Caked, 1196 Queen St W",
  city: "Toronto",
  summary: "Every Sunday, 12:00–6:00 PM ET. Every numbered box in the drop carries the same four strains. Jars are those strains, sold one by one.",
};

export const VANCOUVER_DROP = {
  name: "Dank Club",
  venue: "Dank Club, 6416 Main St",
  city: "Vancouver",
  summary: "Pop-up at Dank Club. The date is set for each drop.",
};
export const wholesaleRegions = regionSeeds.filter((region) => region.channel === "wholesale");

export const SELECTION_SPEC =
  "8×8×3 pine wood gift box. Black foam insert. Matte white strain wrap label. Tamper seal. Hand-numbered tasting card.";

export const JAR_SPEC = "4 oz straight-sided amber glass. Black metal lid. 7 g.";

export type ProductSeed = {
  slug: string;
  name: string;
  kind: "selection" | "jar" | "selection_set";
  editionNumber: number | null;
  editionSize: number | null;
  subtitle: string;
  description: string;
  imagePath: string | null;
  sortOrder: number;
};

export const productSeeds: ProductSeed[] = [
  {
    slug: "selection-box",
    name: "Selection box",
    kind: "selection",
    editionNumber: null,
    editionSize: EDITION_SIZE,
    subtitle: "Numbered box",
    description: SELECTION_SPEC,
    imagePath: null,
    sortOrder: 1,
  },
  {
    slug: "jar-7g",
    name: "7 g jar",
    kind: "jar",
    editionNumber: null,
    editionSize: null,
    subtitle: "Standalone jar",
    description: JAR_SPEC,
    imagePath: null,
    sortOrder: 100,
  },
  {
    slug: "selection-of-16",
    name: "Selection of 16",
    kind: "selection_set",
    editionNumber: null,
    editionSize: EDITION_SIZE,
    subtitle: "Wholesale set",
    description: `All sixteen numbered boxes. ${SELECTION_SPEC}`,
    imagePath: null,
    sortOrder: 200,
  },
];

export type EventSeed = {
  slug: string;
  name: string;
  regionSlug: string;
  venue: string;
  city: string;
  summary: string;
  timeZone: string;
  startsAt: string;
  endsAt: string;
  preorderOpensAt: string;
  preorderClosesAt: string;
  complianceConfirmed: boolean;
  complianceNote: string | null;
};

export const eventSeeds: EventSeed[] = [];

export function editionLabel(editionNumber: number, editionSize = EDITION_SIZE) {
  return `${String(editionNumber).padStart(2, "0")}/${String(editionSize).padStart(2, "0")}`;
}

export const referenceCodes: Record<string, string> = {
  toronto: "TOR",
  vancouver: "YVR",
  "united-states": "USA",
  "on-golden-horseshoe": "GHS",
  "on-eastern": "EON",
  "on-southwestern": "SWO",
};
