# ELEVÉ — Luxury Cannabis Reserve Storefront

An underground-luxury private reserve ordering web app built for high-end craft cannabis allocations, 1-on-1 personal concierge dispatch, and direct encrypted ordering across Mississauga, the Greater Toronto Area (GTA), and Ontario.

## 🌿 How to Edit Products & Pricing

All products, pricing tiers, harvest dates, and live vault scarcity counters are cleanly isolated in **`products.js`**.

**You do NOT need to touch `index.html` to add strains or change prices!**

Just open `products.js` and edit:
- **Price Tiers**: Change prices for 3.5g, 1 oz, ¼ lb, ½ lb, or full lb.
- **Harvest & Cure Dates**: Update the cure duration and harvest dates.
- **Vault Scarcity**: Adjust `scarcityBadge` (e.g. `Vault Reserve: 2.5 / 6 lbs remaining`).
- **Terpenes & Burn Specs**: Customize aroma notes, ash color, and oil ring specs.
- **New Strains**: Copy and paste the template at the top of `products.js`.

## 📁 Repository Structure
```
├── index.html       # The main luxury storefront application & 2nd-page order desk
├── products.js      # Clean product catalog array (edit your menu here!)
├── vercel.json      # Instant deployment configuration
└── README.md        # Documentation and editing guide
```

## 🚀 Live Deployment
This repository is configured for 1-click deployment on **Vercel** or **GitHub Pages**.
Push your changes to GitHub and Vercel will update your live storefront in ~15 seconds.
