/**
 * ==============================================================================
 * ELEVÉ PRIVATE RESERVE — PRODUCT CATALOG (products.js)
 * ==============================================================================
 * 
 * Edit this file to add new strains, update pricing tiers, adjust harvest/cure
 * dates, or update the live vault scarcity counters.
 * 
 * PASSCODE ACCESS:
 * Passcode for the gate is: LEAF24 or ELEVE24
 * 
 * TEMPLATE TO ADD A NEW PRODUCT:
 * {
 *   id: 'unique-strain-slug',
 *   category: 'headstash', // 'headstash' | 'indoor' | 'doinks'
 *   name: 'Strain Name by Elevé',
 *   tag: 'In-House', // 'In-House' | 'Craft' | 'Private Reserve'
 *   subtitle: 'GENETICS X LINEAGE',
 *   description: 'Full description of cure, aroma, and living soil methodology.',
 *   harvestCure: 'Harvest: Date · Cold Cured X Days',
 *   scarcityBadge: 'Vault Reserve: X / Y lbs remaining',
 *   terpenes: [
 *     { name: 'Limonene', val: '2.5%', note: 'Sweet Citrus Gas' },
 *     { name: 'Caryophyllene', val: '1.8%', note: 'Warm Pepper Funk' },
 *     { name: 'Linalool', val: '1.0%', note: 'Floral Lavender' }
 *   ],
 *   burnSpecs: {
 *     ash: 'Bone-white stacked ash',
 *     resin: 'Immediate heavy oil ring / resin drip',
 *     cure: 'Cold-cured in glass vault at 58% RH'
 *   },
 *   image: 'assets/your_image.jpg',
 *   variants: [
 *     { label: '3.5 g', price: 50 },
 *     { label: '1 oz', price: 300 },
 *     { label: '1/4 lb', price: 900 },
 *     { label: '1/2 lb', price: 1500 },
 *     { label: 'full lb', price: 2700 }
 *   ]
 * }
 * ==============================================================================
 */

window.PRODUCTS = [
  {
    id: 'zunzet',
    category: 'headstash',
    name: 'ZunZet by Elevé',
    tag: 'In-House',
    subtitle: 'BLUE ZUSHI X SHERB BX',
    description: 'Blue Zushi X Sherb Bx. LSO, grown in house.',
    harvestCure: 'Harvest: Oct 12, 2026 · Cold Cured 24 Days',
    scarcityBadge: 'Vault Reserve: 2.5 / 6 lbs remaining',
    terpenes: [
      { name: 'Limonene', val: '2.8%', note: 'Sweet Meyer Lemon' },
      { name: 'Caryophyllene', val: '1.9%', note: 'Warm Cracked Pepper' },
      { name: 'Linalool', val: '1.1%', note: 'Floral Lavender Gas' }
    ],
    burnSpecs: {
      ash: 'Bone-white stacked ash',
      resin: 'Immediate heavy oil ring / resin drip',
      cure: 'Cold-cured 24 days in glass vault at 58% RH'
    },
    image: 'assets/zunzet.jpg',
    variants: [
      { label: '3.5 g', price: 50 },
      { label: '1 oz', price: 300 },
      { label: '1/4 lb', price: 900 },
      { label: '1/2 lb', price: 1500 },
      { label: 'full lb', price: 2700 }
    ]
  },
  {
    id: 'toad-venom',
    category: 'indoor',
    name: 'Toad Venom By Elevé select',
    tag: 'Craft',
    subtitle: 'ANIMAL FACE X SIN MINTZ',
    description: 'Animal Face x Sin Mintz (LSO, grown in BC by Kingsmen Crew).',
    harvestCure: 'Harvest: Oct 04, 2026 · Cold Cured 28 Days',
    scarcityBadge: 'Vault Reserve: 3.5 / 8 lbs remaining',
    terpenes: [
      { name: 'Caryophyllene', val: '2.4%', note: 'Spicy Diesel Fuel' },
      { name: 'Myrcene', val: '1.8%', note: 'Earthy Herbal Funk' },
      { name: 'Humulene', val: '1.0%', note: 'Woody Pine Hops' }
    ],
    burnSpecs: {
      ash: 'Clean pale white ash with light grey fringe',
      resin: 'Thick greasy ring on burn line',
      cure: 'Slow cure 28 days cold cellar'
    },
    image: 'assets/toad-venom.jpg',
    variants: [
      { label: '1 oz', price: 200 },
      { label: '1/4 lb', price: 600 },
      { label: '1/2 lb', price: 1100 },
      { label: 'full lb', price: 2000 }
    ]
  },
  {
    id: 'zunzet-doink',
    category: 'doinks',
    name: 'ZunZet 2g Hand roll',
    tag: 'In-House',
    subtitle: 'BLUE ZUSHI X SHERB BX',
    description: 'Blue Zushi x Sherb Bx (Grown and rolled in-house). Straight hand rolled 2g doink with custom glass tip.',
    harvestCure: 'Fresh In-House Roll · 12mm Borosilicate Glass Tip',
    scarcityBadge: 'Limited Vault Run: 18 / 50 rolled',
    terpenes: [
      { name: 'Sweet Sherb Gas', val: 'High', note: 'Uncut Whole Flower' },
      { name: 'Limonene Terps', val: 'Dominant', note: 'Candied Citrus Ring' },
      { name: 'Glass Flow', val: '12mm', note: 'Borosilicate Core' }
    ],
    burnSpecs: {
      ash: 'Pure solid bone-white ash stack',
      resin: 'Persistent continuous oil halo down to tip',
      burnTime: '35–45 minutes slow even draw'
    },
    image: 'assets/zunzet-doink.jpg',
    variants: [
      { label: 'Single', price: 25 },
      { label: '5 Units', price: 100 },
      { label: '25 Units', price: 450 },
      { label: '50 Units', price: 750 }
    ]
  }
];
