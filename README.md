# Monolith Studio Co. (`monolith-studio`)

Official storefront for **Monolith Studio Co.** — Precision 5-Axis CNC-Machined Desktop Peripherals, Ultralight Wireless Mice, Split-Angle Mechanical Keyboards, and CNC Watch Armor.

- **Live Storefront**: `https://monolith-studio.onrender.com`
- **Los Angeles Studio & Warehouse**: `6515 S Crenshaw Blvd, Los Angeles, CA 90043, United States`
- **Stripe Account**: `acct_1UZqdVDpvRsFSG1g`
- **Local Shipment Studio**: `http://localhost:8425` (`/Users/rmclol/Downloads/rewind-fulfillment`)

## Product Lineup ($20 – $150 Tiers)

| Tier | SKU | Product | Parcel Weight | Stripe Product ID | Stripe Payment Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **$20.00** | `ML-PND-020` | Monolith™ CNC Machined Titanium Bolt-Action Studio Pen | `180g (0.40 lbs)` | `prod_VbZTRsSu7Yhvkv` | `https://buy.stripe.com/eVq7sLaI35WFdDBbpN1sQ00` |
| **$30.00** | `ML-GMP-030` | Monolith™ GlideMat Pro — Micro-Weave Precision Desk Pad (900×400mm) | `380g (0.84 lbs)` | `prod_VbZTF5psnj7qnG` | `https://buy.stripe.com/eVqaEX2bx98RgPN1Pd1sQ01` |
| **$40.00** | `ML-AWC-040` | Monolith™ 316L Stainless CNC Case for Apple Watch 45mm / 46mm | `150g (0.33 lbs)` | `prod_VbZUKT7PI7AiYx` | `https://buy.stripe.com/fZu00j6rN70JdDBctR1sQ02` |
| **$50.00** | `ML-AGM-050` | Monolith™ Magnesium X — 42g Ultralight Wireless Magnesium Alloy Mouse | `230g (0.51 lbs)` | `prod_VbZULcbYDDnfrg` | `https://buy.stripe.com/dRmdR95nJbgZgPNfG31sQ03` |
| **$60.00** | `ML-BRC-060` | Monolith™ PVD Gold & Brass CNC Case for Apple Watch (45mm / 49mm) | `240g (0.53 lbs)` | `prod_VbZUTGfQw1ZNTY` | `https://buy.stripe.com/fZu14n4jF84NeHF3Xl1sQ04` |
| **$70.00** | `ML-LMB-070` | Monolith™ Luminabar Pro — Asymmetric CNC Aluminum Monitor Light Bar | `420g (0.93 lbs)` | `prod_VbZUz4uI4KpF5Q` | `https://buy.stripe.com/4gM4gz9DZacV6b91Pd1sQ05` |
| **$80.00** | `ML-MCP-080` | Monolith™ Q0 Pro — CNC Aluminum QMK/VIA Wireless Custom Macro & Number Pad | `350g (0.77 lbs)` | `prod_VbZUGSMoSY0THe` | `https://buy.stripe.com/7sY3cv7vRfxf8jh3Xl1sQ06` |
| **$90.00** | `ML-MLS-090` | Monolith™ Dual Dock Pro — CNC Aluminum Under-Laptop Workstation Stand & USB-C Hub | `480g (1.06 lbs)` | `prod_VbZUpcBzxQF77r` | `https://buy.stripe.com/aFa7sLdUf5WF431ctR1sQ07` |
| **$120.00** | `ML-AKB-120` | Monolith™ Q14 Pro — 96% Alice Split-Layout CNC Aluminum Wireless Mechanical Keyboard | `620g (1.37 lbs)` | `prod_VbZUfOzg0BKN1t` | `https://buy.stripe.com/00w6oH2bx70JdDB3Xl1sQ08` |
| **$150.00** | `ML-PKT-150` | Monolith™ Pocket 35 — Dual-Analog Vertical Retro Gaming Handheld Console | `450g (0.99 lbs)` | `prod_VbZUoT2GPMtOHM` | `https://buy.stripe.com/cNi28r7vR84N2YX2Th1sQ09` |

---

## Synced Local Shipment & Fulfillment Studio (`http://localhost:8425`)

The storefront is bidirectional-synced with the local **Monolith Studio Co. Fulfillment & Dispatch Center** (`http://localhost:8425`):
- **Pre-Checkout Registration (`POST /api/orders`)**: When a customer enters their shipping details on the storefront and proceeds to Stripe Payment Links, the order reference (`#ML-XXXXXX`), SKU, parcel weight, and shipping address are immediately registered with the local shipment studio.
- **Stripe Live Polling (`/v1/checkout/sessions` & `/v1/charges`)**: The shipment studio polls Stripe account `acct_1UZqdVDpvRsFSG1g` to match completed payments, stage sub-1lb carrier tracking numbers via TrackTaco, write `tracking_number` / `carrier` metadata back to Stripe Charges & PaymentIntents, and dispatch branded HTML shipping/delivery emails.
- **Live Storefront Order Lookup (`GET /api/shipments/track?q=...`)**: Customers checking order status in the storefront's **Track Order** modal receive real-time carrier tracking numbers and delivery statuses directly from the shipment studio.

---

## Deploying to Render

This repository includes a `render.yaml` Blueprint for instant deployment on Render:
- **Static Site (Recommended — 100% Free, Zero Cold-Start Sleep):**
  - **Build Command:** `npm run build`
  - **Publish Directory:** `public`
- **Node Web Service:**
  - **Build Command:** `npm install`
  - **Start Command:** `npm start`
