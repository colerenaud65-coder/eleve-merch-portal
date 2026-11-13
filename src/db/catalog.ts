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

type NamedCut = {
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  imagePath: string;
};

const namedCuts: NamedCut[] = [
  {
    slug: "original-z",
    name: "Original Z",
    subtitle: "Lineage unknown",
    description:
      "Sweet candy and tropical fruit. Cold-cured in glass, with a heavy resin ring.",
    imagePath: "/media/originalZNug.webp",
  },
  {
    slug: "zunzet",
    name: "ZunZet",
    subtitle: "Blue Zushi × Sherb Bx",
    description: "Living soil, grown in house. Meyer lemon, cracked pepper, lavender gas.",
    imagePath: "/media/zunzetNug.jpg",
  },
  {
    slug: "gas-station-og",
    name: "Gas Station OG",
    subtitle: "OG Kush",
    description: "Gassy funk and a clean, even burn. Issued as a numbered box and a 7 g jar.",
    imagePath: "/media/gasStationOGNug.webp",
  },
  {
    slug: "pi-chew-1",
    name: "Pi-Chew No. 1",
    subtitle: "Z-Pie #14 × Zuyaqui",
    description: "Fruit-chew sweetness, citrus zest, a candy finish on the exhale.",
    imagePath: "/media/piChewNug.webp",
  },
  {
    slug: "toad-venom",
    name: "Toad Venom",
    subtitle: "Animal Face × Sin Mintz",
    description: "Grown in British Columbia. Spicy diesel, herbal funk, woody pine.",
    imagePath: "/media/toadVenomNug.jpg",
  },
  {
    slug: "peaches",
    name: "Peaches",
    subtitle: "Zkittlez × Papaya",
    description: "Small-batch stone fruit from the archive, returned as a numbered box.",
    imagePath: "/media/originalZNug.webp",
  },
];

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

const houseImages = [
  "/media/gasStationOGNug.webp",
  "/media/piChewNug.webp",
  "/media/toadVenomNug.jpg",
  "/media/zunzetNug.jpg",
  "/media/originalZNug.webp",
];

function selectionProducts(): ProductSeed[] {
  const named = namedCuts.map((cut, index) => ({
    slug: cut.slug,
    name: cut.name,
    kind: "selection" as const,
    editionNumber: index + 1,
    editionSize: EDITION_SIZE,
    subtitle: cut.subtitle,
    description: cut.description,
    imagePath: cut.imagePath,
    sortOrder: index + 1,
  }));

  const rest: ProductSeed[] = [];
  for (let number = namedCuts.length + 1; number <= EDITION_SIZE; number += 1) {
    rest.push({
      slug: `edition-${String(number).padStart(2, "0")}`,
      name: "House selection",
      kind: "selection",
      editionNumber: number,
      editionSize: EDITION_SIZE,
      subtitle: "Numbered box",
      description:
        "One of sixteen. The card inside the box names the cut packed for this drop.",
      imagePath: houseImages[(number - 1) % houseImages.length] ?? null,
      sortOrder: number,
    });
  }

  return [...named, ...rest];
}

function jarProducts(): ProductSeed[] {
  return namedCuts.slice(0, 5).map((cut, index) => ({
    slug: `jar-${cut.slug}`,
    name: `${cut.name} 7 g`,
    kind: "jar" as const,
    editionNumber: null,
    editionSize: null,
    subtitle: "Standalone jar",
    description: cut.description,
    imagePath: cut.slug === "zunzet" ? "/media/zunzetJar.jpg" : cut.imagePath,
    sortOrder: 100 + index,
  }));
}

export const productSeeds: ProductSeed[] = [
  ...selectionProducts(),
  ...jarProducts(),
  {
    slug: "selection-of-16",
    name: "Selection of 16",
    kind: "selection_set",
    editionNumber: null,
    editionSize: EDITION_SIZE,
    subtitle: "Wholesale set",
    description:
      "All sixteen numbered boxes, allocated together and priced as one Ontario wholesale selection.",
    imagePath: "/media/zunzetJar.jpg",
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
