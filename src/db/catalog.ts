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

function selectionProducts(): ProductSeed[] {
  return Array.from({ length: EDITION_SIZE }, (_, index) => {
    const number = index + 1;
    const label = String(number).padStart(2, "0");
    return {
      slug: `selection-${label}`,
      name: `Selection ${label}`,
      kind: "selection" as const,
      editionNumber: number,
      editionSize: EDITION_SIZE,
      subtitle: "Numbered box",
      description: SELECTION_SPEC,
      imagePath: null,
      sortOrder: number,
    };
  });
}

export const productSeeds: ProductSeed[] = [
  ...selectionProducts(),
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

export const eventSeeds: EventSeed[] = [
  {
    slug: "toronto-king-west",
    name: "King West",
    regionSlug: "toronto",
    venue: "King West. The room address is sent with pickup.",
    city: "Toronto",
    summary: "Sixteen boxes and the jar line. Deposit by e-Transfer, balance at the door.",
    timeZone: "America/Toronto",
    startsAt: "2026-12-12T23:00:00.000Z",
    endsAt: "2026-12-13T03:00:00.000Z",
    preorderOpensAt: "2026-11-01T15:00:00.000Z",
    preorderClosesAt: "2026-12-12T22:00:00.000Z",
    complianceConfirmed: true,
    complianceNote: "Confirmed for the Toronto pop-up.",
  },
  {
    slug: "vancouver-railtown",
    name: "Railtown",
    regionSlug: "vancouver",
    venue: "Railtown. The room address is sent with pickup.",
    city: "Vancouver",
    summary: "The same sixteen, Vancouver stock. Preorders stay shut until compliance is confirmed.",
    timeZone: "America/Vancouver",
    startsAt: "2026-12-20T03:00:00.000Z",
    endsAt: "2026-12-20T07:00:00.000Z",
    preorderOpensAt: "2026-11-01T16:00:00.000Z",
    preorderClosesAt: "2026-12-19T23:00:00.000Z",
    complianceConfirmed: false,
    complianceNote: null,
  },
  {
    slug: "los-angeles-arts-district",
    name: "Arts District",
    regionSlug: "united-states",
    venue: "Arts District. The room address is sent with pickup.",
    city: "Los Angeles",
    summary: "US stock only. Preorders open on the date below.",
    timeZone: "America/Los_Angeles",
    startsAt: "2027-01-17T03:00:00.000Z",
    endsAt: "2027-01-17T07:00:00.000Z",
    preorderOpensAt: "2026-12-20T16:00:00.000Z",
    preorderClosesAt: "2027-01-16T23:00:00.000Z",
    complianceConfirmed: true,
    complianceNote: "Confirmed. The window has not opened.",
  },
];

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
