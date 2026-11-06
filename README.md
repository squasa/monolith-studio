# ReWind Hardware Co. (`rewind-hardware`)

Official storefront for **ReWind Hardware Co.** — Precision 5-Axis CNC-Machined Desktop Peripherals, Ultralight Wireless Mice, Split-Angle Mechanical Keyboards, and CNC Watch Armor.

## Product Lineup ($20 – $150 Tiers)

| Tier | SKU | Product | Parcel Weight |
| :--- | :--- | :--- | :--- |
| **$20.00** | `RW-PND-020` | ReWind™ CNC Aluminum Weighted Pen & Stylus Desk Dock | `180g (0.40 lbs)` |
| **$30.00** | `RW-GMP-030` | ReWind™ GlideMat Pro — Micro-Weave Precision Desk Pad (900×400mm) | `380g (0.84 lbs)` |
| **$40.00** | `RW-AWC-040` | ReWind™ CNC Metal Case for Apple Watch Series 10 & 12 (45mm) | `150g (0.33 lbs)` |
| **$50.00** | `RW-AGM-050` | ReWind™ Aerograde 50g — Ultralight Brushed Silver Wireless Gaming Mouse | `230g (0.51 lbs)` |
| **$60.00** | `RW-BRC-060` | ReWind™ Solid Brass CNC Case for Apple Watch Ultra (49mm) | `240g (0.53 lbs)` |
| **$70.00** | `RW-LMB-070` | ReWind™ Luminabar Pro — Asymmetric CNC Aluminum Monitor Light Bar | `420g (0.93 lbs)` |
| **$80.00** | `RW-MCP-080` | ReWind™ MacroPad 8 — CNC Aluminum Hot-Swappable Rotary Encoder Pad | `350g (0.77 lbs)` |
| **$90.00** | `RW-MLS-090` | ReWind™ Monolith Vertical Laptop & Tablet CNC Aluminum Studio Stand | `480g (1.06 lbs)` |
| **$120.00** | `RW-AKB-120` | ReWind™ Aero Ergonomic — Split-Angle CNC Aluminum Mechanical Keyboard | `620g (1.37 lbs)` |
| **$150.00** | `RW-PKT-150` | ReWind™ CNC Pocket — Solid Aluminum Retro Gaming Handheld | `450g (0.99 lbs)` |

---

## Connecting Your Wave Checkout Links Later

Once your Wave Payments account is approved:
1. Create your checkout links inside **Wave (`Sales & Payments → Checkouts`)** for each product tier (`$20`, `$30`, `$40`, `$50`, `$60`, `$70`, `$80`, `$90`, `$120`, `$150`).
2. Paste those URLs into [`public/config/store-config.json`](public/config/store-config.json) under `waveCheckoutLinks.byPriceTier` or `waveCheckoutLinks.bySku` and push to GitHub.
3. When a customer fills out their shipping address on the storefront and clicks **Continue to Secure Payment**, the storefront automatically redirects them to your Wave Checkout link with their name, email, phone, and shipping address pre-filled:
   ```text
   https://link.waveapps.com/<checkout-id>?first_name=...&last_name=...&email=...&phone=...&address=...&address2=...&city=...&region=...&postal=...&country=US
   ```

---

## Deploying to Render

This repository includes a `render.yaml` Blueprint for instant deployment on Render:
- **Static Site (Recommended — 100% Free, Zero Cold-Start Sleep):**
  - **Build Command:** `npm run build`
  - **Publish Directory:** `public`
- **Node Web Service:**
  - **Build Command:** `npm install`
  - **Start Command:** `npm start`
