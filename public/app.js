let STORE_CONFIG = null;
let ACTIVE_CATEGORY = 'All';
let CART = [];

async function initStore() {
  try {
    const res = await fetch('config/store-config.json');
    STORE_CONFIG = await res.json();
  } catch (e) {
    console.error('Failed to load store-config.json:', e);
    return;
  }

  renderFilters();
  renderProducts();
  updateCartBadge();
  handleInitialRoute();
}

function handleInitialRoute() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('order_success') === '1') {
    const sku = params.get('sku') || '';
    const matched = STORE_CONFIG.products.find(p => p.sku === sku);
    const orderId = 'ML-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const modal = document.getElementById('universal-modal');
    const content = document.getElementById('universal-modal-content');
    if (modal && content) {
      content.innerHTML = `
        <div class="checkout-container">
          <div style="background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; padding:20px 22px; border-radius:12px; margin-bottom:22px;">
            <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em;">Stripe Payment Verified • Order <span style="font-family:var(--font-mono);">#${orderId}</span></div>
            <h2 style="font-size:24px; font-weight:800; margin-top:4px; letter-spacing:-0.02em;">Thank You! Your Hardware Order is Confirmed.</h2>
            <p style="font-size:14px; margin-top:8px; line-height:1.6;">
              Your payment for <strong>${matched ? matched.title : 'Monolith Studio Hardware'}</strong> has been processed via Stripe. Your parcel is queued for inspection and protective foam packing at our Los Angeles studio warehouse (6515 S Crenshaw Blvd) and will dispatch within 24–48 hours with live USPS, UPS, or FedEx tracking.
            </p>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:12px;">
            <button class="btn-outline" onclick="openTrackModal('${orderId}')">Track Order #${orderId}</button>
            <button class="btn-buy" onclick="closeModal(); window.history.replaceState({}, '', window.location.pathname);">Return to Storefront</button>
          </div>
        </div>
      `;
      modal.classList.add('open');
    }
    return;
  }

  const path = window.location.pathname.replace(/\/+$/, '');
  const hash = window.location.hash.replace('#', '');
  const target = path.slice(1) || hash;
  if (['terms', 'returns', 'shipping', 'privacy', 'contact'].includes(target)) {
    openPolicyModal(target);
  } else if (target === 'track') {
    openTrackModal();
  }
}

function renderFilters() {
  const categories = ['All', ...new Set(STORE_CONFIG.products.map(p => p.category))];
  const bar = document.getElementById('filter-bar');
  if (!bar) return;
  bar.innerHTML = categories.map(cat => `
    <button class="filter-btn ${cat === ACTIVE_CATEGORY ? 'active' : ''}" onclick="setCategory('${cat}')">
      ${cat === 'All' ? 'All Releases (10)' : cat}
    </button>
  `).join('');
}

function setCategory(cat) {
  ACTIVE_CATEGORY = cat;
  renderFilters();
  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById('product-grid');
  if (!grid || !STORE_CONFIG) return;

  const list = ACTIVE_CATEGORY === 'All'
    ? STORE_CONFIG.products
    : STORE_CONFIG.products.filter(p => p.category === ACTIVE_CATEGORY);

  grid.innerHTML = list.map(p => `
    <article class="product-card">
      <div class="product-img-wrap" onclick="openProductModal(${p.id})">
        <img src="${p.image}" alt="${p.title}" loading="lazy" />
        <span class="product-badge">${p.badge}</span>
        <span class="product-sku-tag">${p.sku}</span>
      </div>
      <div class="product-body">
        <div class="product-category">${p.category} • ${p.weightGrams}g Parcel</div>
        <h3 class="product-title" onclick="openProductModal(${p.id})">${p.title}</h3>
        <p class="product-summary">${p.summary}</p>
        <div class="product-meta-row">
          <span class="product-price">$${p.price.toFixed(2)}</span>
          <span class="product-stock">● In Stock • Ships in 24–48h</span>
        </div>
        <div class="product-actions">
          <button class="btn-outline" onclick="openProductModal(${p.id})">View Specs</button>
          <button class="btn-buy" onclick="buyNow(${p.id})">Buy Now — $${p.price}</button>
        </div>
      </div>
    </article>
  `).join('');
}

function openProductModal(productId) {
  const p = STORE_CONFIG.products.find(item => item.id === productId);
  if (!p) return;

  const modal = document.getElementById('universal-modal');
  const content = document.getElementById('universal-modal-content');

  const specsHtml = Object.entries(p.specs || {}).map(([k, v]) => `
    <div class="spec-row">
      <span>${k}</span>
      <span>${v}</span>
    </div>
  `).join('');

  const highlightsHtml = (p.highlights || []).map(h => `<li style="margin-bottom:6px;">${h}</li>`).join('');
  const boxHtml = (p.boxContents || []).map(b => `<li style="margin-bottom:4px;">${b}</li>`).join('');
  const thumbsHtml = (p.gallery && p.gallery.length > 1)
    ? `<div class="thumb-row">
        ${p.gallery.map((imgUrl, idx) => `
          <img src="${imgUrl}" class="${idx === 0 ? 'active' : ''}" onclick="switchModalPhoto(this, '${imgUrl}')" alt="Thumbnail" />
        `).join('')}
      </div>`
    : '';

  content.innerHTML = `
    <div class="product-modal-grid">
      <div class="modal-gallery">
        <img id="modal-main-photo" class="main-photo" src="${p.image}" alt="${p.title}" />
        ${thumbsHtml}
        <div style="margin-top:16px; background:#f8f9fb; border:1px solid #e2e8f0; padding:14px 16px; border-radius:10px; font-size:13px; color:#475569; line-height:1.55;">
          <strong style="color:#0f172a; display:block; margin-bottom:3px;">🛡️ Monolith Studio Hardware Guarantee</strong>
          Includes Free Tracked USPS / UPS / FedEx Shipping (dispatches within 24–48h from Los Angeles), 30-Day Studio Satisfaction Trial, and 1-Year Structural CNC Warranty.
        </div>
      </div>
      <div>
        <div style="font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">
          ${p.category} • SKU: <span style="font-family:var(--font-mono);">${p.sku}</span>
        </div>
        <h2 style="font-size:24px; font-weight:800; margin:6px 0 12px; line-height:1.25; letter-spacing:-0.02em;">${p.title}</h2>
        <div style="display:flex; align-items:center; gap:14px; margin-bottom:18px; flex-wrap:wrap;">
          <span style="font-family:var(--font-display); font-size:28px; font-weight:800; letter-spacing:-0.02em; font-variant-numeric:tabular-nums;">$${p.price.toFixed(2)} USD</span>
          <span style="background:#ecfdf5; color:#047857; font-size:12px; font-weight:600; padding:4px 10px; border-radius:99px;">
            ● In Stock — Free 2–4 Day US Shipping
          </span>
        </div>

        <div class="shipping-notice-banner">
          <strong>📦 Direct Los Angeles Studio Fulfillment</strong>
          Inspected and packed in protective high-density foam at 6515 S Crenshaw Blvd, Los Angeles. Live USPS, UPS, or FedEx tracking is emailed upon dispatch.
        </div>

        <p style="font-size:14px; color:#334155; margin-bottom:16px; line-height:1.6;">${p.summary}</p>

        <h4 style="font-size:12.5px; text-transform:uppercase; letter-spacing:0.05em; color:#475569; margin-bottom:8px;">Engineering Highlights</h4>
        <ul style="padding-left:18px; font-size:13.5px; color:#334155; margin-bottom:18px; line-height:1.55;">
          ${highlightsHtml}
        </ul>

        <h4 style="font-size:12.5px; text-transform:uppercase; letter-spacing:0.05em; color:#475569;">Technical Specifications</h4>
        <div class="spec-list">${specsHtml}</div>

        <h4 style="font-size:12.5px; text-transform:uppercase; letter-spacing:0.05em; color:#475569; margin:14px 0 6px;">Included in the Box</h4>
        <ul style="padding-left:18px; font-size:13.5px; color:#334155; margin-bottom:24px; line-height:1.55;">
          ${boxHtml}
        </ul>

        <div style="display:grid; grid-template-columns:1fr 1.35fr; gap:10px;">
          <button class="btn-outline" style="padding:13px;" onclick="addToCart(${p.id}); closeModal();">Add to Bag</button>
          <button class="btn-buy" style="padding:13px; font-size:14.5px;" onclick="buyNow(${p.id})">Buy Now — $${p.price.toFixed(2)}</button>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('open');
}

function switchModalPhoto(thumbEl, url) {
  const main = document.getElementById('modal-main-photo');
  if (main) main.src = url;
  document.querySelectorAll('.thumb-row img').forEach(img => img.classList.remove('active'));
  thumbEl.classList.add('active');
}

function addToCart(productId) {
  const p = STORE_CONFIG.products.find(item => item.id === productId);
  if (!p) return;
  const existing = CART.find(i => i.product.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    CART.push({ product: p, qty: 1 });
  }
  updateCartBadge();
}

function changeCartQty(productId, delta) {
  const item = CART.find(i => i.product.id === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    CART = CART.filter(i => i.product.id !== productId);
  }
  updateCartBadge();
  openCheckoutModal();
}

function buyNow(productId) {
  const p = STORE_CONFIG.products.find(item => item.id === productId);
  if (!p) return;
  CART = [{ product: p, qty: 1 }];
  updateCartBadge();
  openCheckoutModal();
}

function updateCartBadge() {
  const count = CART.reduce((sum, i) => sum + i.qty, 0);
  const el = document.getElementById('cart-count');
  if (el) el.textContent = count;
}

function removeFromCart(productId) {
  CART = CART.filter(i => i.product.id !== productId);
  updateCartBadge();
  openCheckoutModal();
}

function openCheckoutModal() {
  const modal = document.getElementById('universal-modal');
  const content = document.getElementById('universal-modal-content');

  if (CART.length === 0) {
    content.innerHTML = `
      <div class="checkout-container" style="text-align:center; padding:60px 24px;">
        <h2 style="font-size:24px; font-weight:800; letter-spacing:-0.02em; margin-bottom:8px;">Your Studio Bag is Empty</h2>
        <p style="color:#475569; font-size:14.5px; margin-bottom:24px;">Select any CNC hardware peripheral from our collection to begin checkout.</p>
        <button class="btn-buy" style="padding:12px 24px;" onclick="closeModal()">Explore Hardware Collection</button>
      </div>
    `;
    modal.classList.add('open');
    return;
  }

  const subtotal = CART.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const itemsHtml = CART.map(i => `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:14px; padding:14px 0; border-bottom:1px solid #e2e8f0; flex-wrap:wrap;">
      <div style="display:flex; align-items:center; gap:14px; flex:1; min-width:220px;">
        <img src="${i.product.image}" alt="${i.product.title}" style="width:60px; height:60px; border-radius:8px; object-fit:contain; background:#ffffff; padding:4px; border:1px solid #e2e8f0;" />
        <div>
          <div style="font-weight:700; font-size:14.5px; color:#0f172a; line-height:1.3;">${i.product.title}</div>
          <div style="font-size:12px; color:#64748b; margin-top:3px;">
            SKU: <span style="font-family:var(--font-mono);">${i.product.sku}</span> • ${i.product.weightGrams}g • Free Tracked US Shipping
          </div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:14px;">
        <div style="display:inline-flex; align-items:center; gap:8px;">
          <button type="button" class="qty-btn" onclick="changeCartQty(${i.product.id}, -1)">−</button>
          <span style="font-size:13.5px; font-weight:700; min-width:16px; text-align:center; font-variant-numeric:tabular-nums;">${i.qty}</span>
          <button type="button" class="qty-btn" onclick="changeCartQty(${i.product.id}, 1)">+</button>
        </div>
        <span style="font-family:var(--font-display); font-weight:800; font-size:16px; min-width:64px; text-align:right; font-variant-numeric:tabular-nums;">$${(i.product.price * i.qty).toFixed(2)}</span>
        <button type="button" onclick="removeFromCart(${i.product.id})" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:12px; font-weight:600;" title="Remove">✕</button>
      </div>
    </div>
  `).join('');

  content.innerHTML = `
    <div class="checkout-container">
      <div style="border-bottom:1px solid #e2e8f0; padding-bottom:16px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <span style="font-size:12px; font-weight:700; text-transform:uppercase; color:#2563eb; letter-spacing:0.06em;">Monolith Studio Co. • Los Angeles</span>
          <h2 style="font-size:25px; font-weight:800; margin-top:2px; letter-spacing:-0.02em;">Review Your Order &amp; Checkout</h2>
        </div>
        <div style="background:#ecfdf5; border:1px solid #a7f3d0; color:#047857; font-size:12px; font-weight:600; padding:5px 12px; border-radius:99px;">
          ● In Stock • Dispatches in 24–48h
        </div>
      </div>

      <!-- Order Summary Card -->
      <div style="background:#f8f9fb; border:1px solid #e2e8f0; border-radius:12px; padding:18px 20px; margin-bottom:22px;">
        <div style="font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#64748b; margin-bottom:4px;">Order Summary</div>
        ${itemsHtml}
        <div style="display:flex; justify-content:space-between; padding-top:12px; font-size:13.5px; color:#475569;">
          <span>Tracked USPS / UPS / FedEx Studio Shipping (2–4 Business Days)</span>
          <strong style="color:#059669;">FREE ($0.00)</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding-top:6px; font-size:13px; color:#64748b;">
          <span>30-Day Studio Satisfaction Trial &amp; 1-Year CNC Hardware Warranty</span>
          <strong>Included</strong>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:baseline; padding-top:12px; margin-top:10px; border-top:1px solid #e2e8f0; font-size:18px; font-weight:800; color:#0f172a;">
          <span>Total</span>
          <span style="font-family:var(--font-display); font-size:22px; font-variant-numeric:tabular-nums;">$${subtotal.toFixed(2)} USD</span>
        </div>
      </div>

      <!-- Primary Express Stripe Checkout Card -->
      <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:12px; padding:22px; margin-bottom:16px; box-shadow:0 4px 16px rgba(15, 23, 42, 0.04);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <div style="font-weight:700; font-size:15px; color:#0f172a;">Express Checkout via Stripe</div>
          <span style="font-size:12px; color:#64748b;">🔒 256-Bit SSL • PCI-DSS Level 1</span>
        </div>

        <div class="form-group" style="margin-bottom:14px;">
          <label for="express-checkout-email" style="font-size:12.5px; color:#475569;">Email for Order Confirmation &amp; Carrier Tracking Link (Optional — pre-fills Stripe)</label>
          <input id="express-checkout-email" type="email" placeholder="you@example.com" />
        </div>

        <button type="button" onclick="goDirectStripeCheckout()" class="btn-stripe-primary">
          <span>Continue to Stripe Checkout — $${subtotal.toFixed(2)} USD</span>
          <span>→</span>
        </button>

        <div class="payment-method-badges">
          <span class="pm-badge">Apple Pay</span>
          <span class="pm-badge">Link 1-Click</span>
          <span class="pm-badge">Visa / Mastercard / Amex</span>
          <span class="pm-badge">Cash App Pay</span>
          <span class="pm-badge">Free Tracked US Shipping</span>
        </div>
      </div>

      <!-- Optional Expandable Pre-Registration Form -->
      <details style="border:1px solid #e2e8f0; border-radius:10px; padding:12px 16px; background:#f8f9fb;">
        <summary style="font-size:13px; font-weight:600; color:#475569; cursor:pointer; user-select:none;">
          Want to pre-register a custom shipping recipient or delivery notes before Stripe? (Optional)
        </summary>
        <form id="monolith-checkout-form" onsubmit="submitCheckout(event)" style="margin-top:14px; padding-top:12px; border-top:1px solid #e2e8f0;">
          <div class="form-grid">
            <div class="form-group">
              <label>First Name *</label>
              <input type="text" name="first_name" required placeholder="Alex" />
            </div>
            <div class="form-group">
              <label>Last Name *</label>
              <input type="text" name="last_name" required placeholder="Morgan" />
            </div>
            <div class="form-group full">
              <label>Email Address *</label>
              <input type="email" name="email" required placeholder="you@example.com" />
            </div>
            <div class="form-group full">
              <label>Street Address *</label>
              <input type="text" name="address" required placeholder="6515 S Crenshaw Blvd" />
            </div>
            <div class="form-group full">
              <label>Apt, Suite, Unit (Optional)</label>
              <input type="text" name="address2" placeholder="Apt 308 (Optional)" />
            </div>
            <div class="form-group">
              <label>City *</label>
              <input type="text" name="city" required placeholder="Los Angeles" />
            </div>
            <div class="form-group">
              <label>State / Province *</label>
              <input type="text" name="region" required placeholder="CA" />
            </div>
            <div class="form-group">
              <label>ZIP / Postal Code *</label>
              <input type="text" name="postal" required placeholder="90043" />
            </div>
            <div class="form-group">
              <label>Phone Number *</label>
              <input type="tel" name="phone" required placeholder="(213) 555-0194" />
            </div>
          </div>
          <button type="submit" class="btn-buy" style="margin-top:16px; padding:13px; width:100%; font-size:14px;">
            Save Delivery Manifest &amp; Continue to Stripe — $${subtotal.toFixed(2)} USD →
          </button>
        </form>
      </details>
    </div>
  `;

  modal.classList.add('open');
}

function resolveCheckoutUrl(primaryItem, totalAmount) {
  if (primaryItem && primaryItem.stripePaymentLink) {
    return primaryItem.stripePaymentLink;
  }
  const stripeLinks = STORE_CONFIG?.stripeCheckoutLinks || STORE_CONFIG?.waveCheckoutLinks;
  if (!stripeLinks) return '';
  const bySku = stripeLinks.bySku || {};
  const byTier = stripeLinks.byPriceTier || {};

  if (primaryItem && bySku[primaryItem.sku] && bySku[primaryItem.sku].trim()) {
    return bySku[primaryItem.sku].trim();
  }
  const tierKey = String(Math.round(totalAmount));
  if (byTier[tierKey] && byTier[tierKey].trim()) {
    return byTier[tierKey].trim();
  }
  return '';
}

async function goDirectStripeCheckout() {
  const totalAmount = CART.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const primaryProduct = CART[0]?.product;
  const checkoutUrl = resolveCheckoutUrl(primaryProduct, totalAmount);
  if (!checkoutUrl) return;

  const emailVal = (document.getElementById('express-checkout-email')?.value || '').trim();
  const orderId = 'ML-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  if (emailVal) {
    const orderPayload = {
      orderId,
      createdAt: new Date().toISOString(),
      customer: {
        first_name: 'Studio',
        last_name: 'Customer',
        email: emailVal,
        address: 'Stripe Checkout Address',
        city: 'Los Angeles',
        region: 'CA',
        postal: '90043',
        country: 'US'
      },
      items: CART.map(i => ({
        sku: i.product.sku,
        title: i.product.title,
        price: i.product.price,
        qty: i.qty,
        weightGrams: i.product.weightGrams
      })),
      totalAmount
    };
    try {
      const saved = JSON.parse(localStorage.getItem('monolith_orders') || '[]');
      saved.unshift(orderPayload);
      localStorage.setItem('monolith_orders', JSON.stringify(saved.slice(0, 30)));
    } catch (_) {}
  }

  const stripeParams = new URLSearchParams({
    client_reference_id: orderId
  });
  if (emailVal) {
    stripeParams.set('prefilled_email', emailVal);
  }
  const separator = checkoutUrl.includes('?') ? '&' : '?';
  window.location.href = `${checkoutUrl}${separator}${stripeParams.toString()}`;
}

async function submitCheckout(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const customer = {
    first_name: (fd.get('first_name') || '').trim(),
    last_name: (fd.get('last_name') || '').trim(),
    email: (fd.get('email') || '').trim(),
    phone: (fd.get('phone') || '').trim(),
    address: (fd.get('address') || '').trim(),
    address2: (fd.get('address2') || '').trim(),
    city: (fd.get('city') || '').trim(),
    region: (fd.get('region') || '').trim(),
    postal: (fd.get('postal') || '').trim(),
    country: 'US'
  };

  const totalAmount = CART.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const primaryProduct = CART[0]?.product;
  const orderId = 'ML-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  const orderPayload = {
    orderId,
    createdAt: new Date().toISOString(),
    customer,
    items: CART.map(i => ({
      sku: i.product.sku,
      title: i.product.title,
      price: i.product.price,
      qty: i.qty,
      weightGrams: i.product.weightGrams
    })),
    totalAmount
  };

  // Persist in localStorage for instant order lookup on /track
  try {
    const saved = JSON.parse(localStorage.getItem('monolith_orders') || '[]');
    saved.unshift(orderPayload);
    localStorage.setItem('monolith_orders', JSON.stringify(saved.slice(0, 30)));
  } catch (_) {}

  // Also notify backend /api/orders and Local Shipment Studio (http://localhost:8425/api/orders)
  try {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });
  } catch (_) {}

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1200);
    await fetch('http://localhost:8425/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
      signal: ctrl.signal
    });
    clearTimeout(timer);
  } catch (_) {}

  // Check if Stripe Payment Link or Wave Checkout link is configured for this SKU or price tier
  const checkoutUrl = resolveCheckoutUrl(primaryProduct, totalAmount);
  if (checkoutUrl) {
    if (checkoutUrl.includes('buy.stripe.com')) {
      const stripeParams = new URLSearchParams({
        prefilled_email: customer.email,
        client_reference_id: orderId
      });
      const separator = checkoutUrl.includes('?') ? '&' : '?';
      window.location.href = `${checkoutUrl}${separator}${stripeParams.toString()}`;
      return;
    }
    const params = new URLSearchParams({
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      address2: customer.address2,
      city: customer.city,
      region: customer.region,
      postal: customer.postal,
      country: 'US'
    });
    const separator = checkoutUrl.includes('?') ? '&' : '?';
    window.location.href = `${checkoutUrl}${separator}${params.toString()}`;
    return;
  }

  // Otherwise display the official Order Confirmation & Payment Invoice view
  const fullAddress = [
    customer.address,
    customer.address2,
    `${customer.city}, ${customer.region} ${customer.postal}`
  ].filter(Boolean).join(', ');

  CART = [];
  updateCartBadge();

  const content = document.getElementById('universal-modal-content');
  content.innerHTML = `
    <div class="checkout-container">
      <div style="background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; padding:18px 20px; border-radius:10px; margin-bottom:22px;">
        <div style="font-size:12px; font-weight:700; text-transform:uppercase;">Order Registered • <span style="font-family:var(--font-mono);">#${orderId}</span></div>
        <h2 style="font-size:22px; font-weight:800; margin-top:4px;">Thank You, ${customer.first_name}! Your Order is Confirmed.</h2>
        <p style="font-size:13.5px; margin-top:6px;">
          We have registered your shipping manifest for <strong>${primaryProduct ? primaryProduct.title : 'Monolith Hardware'}</strong> and sent your invoice &amp; order confirmation to <strong>${customer.email}</strong>.
        </p>
      </div>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:18px; margin-bottom:20px; font-size:13.5px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
          <div>
            <div style="color:#64748b; font-size:12px; font-weight:600; text-transform:uppercase;">Order Reference</div>
            <div style="font-family:var(--font-mono); font-weight:700; font-size:15px; margin-top:2px;">#${orderId}</div>
          </div>
          <div>
            <div style="color:#64748b; font-size:12px; font-weight:600; text-transform:uppercase;">Total Amount</div>
            <div style="font-weight:700; font-size:15px; margin-top:2px;">$${totalAmount.toFixed(2)} USD (Free Shipping)</div>
          </div>
          <div style="grid-column:1 / -1;">
            <div style="color:#64748b; font-size:12px; font-weight:600; text-transform:uppercase;">Verified Shipping Destination</div>
            <div style="font-weight:600; margin-top:2px;">${customer.first_name} ${customer.last_name} — ${fullAddress}</div>
            <div style="color:#475569; font-size:12.5px; margin-top:2px;">SMS / Tracking Phone: ${customer.phone}</div>
          </div>
        </div>
      </div>

      <div class="shipping-notice-banner">
        <strong>📦 Next Step — Fulfillment &amp; Carrier Tracking Dispatch</strong>
        Your CNC hardware parcel is scheduled for packing at our Los Angeles studio warehouse within 24–48 hours. As soon as your package is scanned by USPS, UPS, or FedEx, your live tracking number will be emailed to <strong>${customer.email}</strong>.
      </div>

      <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:18px;">
        <button class="btn-outline" onclick="openTrackModal('${orderId}')">Track Order #${orderId}</button>
        <button class="btn-buy" onclick="closeModal()">Return to Storefront</button>
      </div>
    </div>
  `;
}

function openTrackModal(prefillOrderId = '') {
  const modal = document.getElementById('universal-modal');
  const content = document.getElementById('universal-modal-content');

  content.innerHTML = `
    <div class="checkout-container">
      <span style="font-size:12px; font-weight:700; text-transform:uppercase; color:#2563eb; letter-spacing:0.06em;">Monolith Logistics &amp; Fulfillment</span>
      <h2 style="font-size:24px; font-weight:800; margin:4px 0 10px; letter-spacing:-0.02em;">Track Your Hardware Order</h2>
      <p style="font-size:14px; color:#475569; margin-bottom:18px;">
        Enter your Monolith Order ID (e.g. <code style="font-family:var(--font-mono); background:#f1f5f9; padding:2px 6px; border-radius:4px;">#ML-8F3K9A</code>) or email address to check your packing status and carrier tracking number.
      </p>
      <div style="display:flex; gap:10px; margin-bottom:20px;">
        <input id="track-input" type="text" value="${prefillOrderId}" placeholder="Order ID (e.g. ML-XXXXXX) or Email" style="flex:1; padding:12px 14px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; font-family:var(--font-sans);" />
        <button class="btn-buy" style="padding:12px 22px;" onclick="lookupOrder()">Check Status</button>
      </div>
      <div id="track-result"></div>
    </div>
  `;
  modal.classList.add('open');
  if (prefillOrderId) lookupOrder();
}

async function lookupOrder() {
  const q = (document.getElementById('track-input')?.value || '').trim().replace(/^#/, '').toUpperCase();
  const resultEl = document.getElementById('track-result');
  if (!q) return;

  // 1. Query Local Shipment Studio (http://localhost:8425) or storefront /api/shipments/track for live carrier tracking
  let liveOrder = null;
  const endpoints = [
    `http://localhost:8425/api/shipments/track?q=${encodeURIComponent(q)}`,
    `/api/shipments/track?q=${encodeURIComponent(q)}`
  ];
  for (const ep of endpoints) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch(ep, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        if (data && data.found && data.order) {
          liveOrder = data.order;
          break;
        }
      }
    } catch (_) {}
  }

  if (liveOrder) {
    const statusMap = {
      delivered: { label: 'Delivered', bg: '#dcfce7', color: '#166534' },
      in_transit: { label: `In Transit via ${liveOrder.carrier || 'Carrier'}`, bg: '#dbeafe', color: '#1e40af' },
      pending_fulfillment: { label: 'Preparing for Dispatch (Los Angeles Studio)', bg: '#eff6ff', color: '#1d4ed8' }
    };
    const badge = statusMap[liveOrder.status] || statusMap.pending_fulfillment;
    const trackingHtml = liveOrder.trackingNumber
      ? `<a href="${liveOrder.trackingUrl || '#'}" target="_blank" rel="noopener" style="color:#2563eb; font-family:var(--font-mono); font-weight:700; text-decoration:underline;">${liveOrder.carrier || 'FEDEX'} — ${liveOrder.trackingNumber}</a>`
      : 'Scheduled for carrier scan within 24–48 hours (USPS / UPS / FedEx)';

    resultEl.innerHTML = `
      <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
          <strong style="font-size:15px;">Order <span style="font-family:var(--font-mono);">${liveOrder.orderId}</span></strong>
          <span style="background:${badge.bg}; color:${badge.color}; font-size:12px; font-weight:700; padding:4px 10px; border-radius:99px;">${badge.label}</span>
        </div>
        <div style="font-size:13.5px; color:#334155; line-height:1.65;">
          <strong>Hardware Item:</strong> ${liveOrder.productName || 'Monolith CNC Hardware'}${liveOrder.sku ? ` (<code style="font-family:var(--font-mono);">${liveOrder.sku}</code>)` : ''}<br>
          <strong>Destination:</strong> ${[liveOrder.city, liveOrder.state, liveOrder.postalCode].filter(Boolean).join(', ')}<br>
          <strong>Live Carrier Tracking:</strong> ${trackingHtml}
        </div>
      </div>
    `;
    return;
  }

  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem('monolith_orders') || '[]');
  } catch (_) {}

  const match = saved.find(o => o.orderId.toUpperCase() === q || (o.customer?.email || '').toUpperCase() === q);
  if (match) {
    resultEl.innerHTML = `
      <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <strong style="font-size:15px;">Order <span style="font-family:var(--font-mono);">#${match.orderId}</span></strong>
          <span style="background:#eff6ff; color:#1d4ed8; font-size:12px; font-weight:700; padding:4px 10px; border-radius:99px;">Preparing for Dispatch (Los Angeles Studio)</span>
        </div>
        <div style="font-size:13.5px; color:#334155; line-height:1.6;">
          <strong>Customer:</strong> ${match.customer.first_name} ${match.customer.last_name} (${match.customer.email})<br>
          <strong>Destination:</strong> ${match.customer.address}, ${match.customer.city}, ${match.customer.region} ${match.customer.postal}<br>
          <strong>Items:</strong> ${match.items.map(i => `${i.qty}× ${i.title}`).join(', ')}<br>
          <strong>Carrier Tracking:</strong> Will be emailed automatically within 24–48 hours upon USPS/UPS/FedEx pickup.
        </div>
      </div>
    `;
  } else {
    resultEl.innerHTML = `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px; font-size:13.5px; color:#334155;">
        Order reference <strong>#${q}</strong> is queued in our Los Angeles fulfillment system. If you placed your order within the last 24 hours, your USPS/UPS/FedEx tracking link will be dispatched to your email shortly. For immediate assistance, email <strong>support@monolithstudio.co</strong>.
      </div>
    `;
  }
}

function openPolicyModal(type) {
  const modal = document.getElementById('universal-modal');
  const content = document.getElementById('universal-modal-content');
  const b = STORE_CONFIG?.brand || {};

  const policies = {
    terms: `
      <span style="font-size:12px; font-weight:700; text-transform:uppercase; color:#2563eb; letter-spacing:0.06em;">Legal &amp; Compliance</span>
      <h2 style="font-size:24px; font-weight:800; margin:4px 0 16px; letter-spacing:-0.02em;">Terms of Service</h2>
      <div style="font-size:14px; color:#334155; line-height:1.7; display:flex; flex-direction:column; gap:12px;">
        <p><strong>Effective Date:</strong> November 2026 • <strong>Operated By:</strong> Monolith Studio Co. (${b.address})</p>
        <p><strong>1. Scope of Products:</strong> Monolith Studio Co. designs, machines, and distributes precision CNC aluminum, titanium, and brass desktop hardware, mechanical keyboards, mice, watch cases, and studio lighting accessories. By placing an order on our storefront, you agree to these Terms of Service.</p>
        <p><strong>2. Pricing &amp; Billing:</strong> All prices are listed in US Dollars (USD) and include complimentary standard tracked shipping within the United States. Payments are processed securely through encrypted PCI-DSS Level 1 compliant Stripe payment gateways (Visa, Mastercard, Amex, Apple Pay, Link, Cash App Pay).</p>
        <p><strong>3. Order Fulfillment &amp; Shipping:</strong> In-stock hardware dispatches from our Los Angeles, California studio warehouse within 24–48 business hours. Customers receive an electronic order confirmation at checkout and a carrier tracking link via email upon parcel dispatch.</p>
        <p><strong>4. 1-Year Structural Hardware Warranty:</strong> All CNC-milled metal components, PCB assemblies, optical sensors, and LED light bars are covered by a 1-Year Manufacturer Warranty against defects in materials and workmanship.</p>
        <p><strong>5. Governing Law:</strong> These Terms are governed by the laws of the State of California, United States.</p>
      </div>
    `,
    returns: `
      <span style="font-size:12px; font-weight:700; text-transform:uppercase; color:#2563eb; letter-spacing:0.06em;">Customer Protection</span>
      <h2 style="font-size:24px; font-weight:800; margin:4px 0 16px; letter-spacing:-0.02em;">30-Day Return &amp; Refund Policy</h2>
      <div style="font-size:14px; color:#334155; line-height:1.7; display:flex; flex-direction:column; gap:12px;">
        <p><strong>30-Day Studio Satisfaction Guarantee</strong></p>
        <p>We stand behind the precision machining, finish, and performance of every piece of Monolith hardware. If you are not 100% satisfied with your purchase, you may return it within <strong>30 days of delivery</strong> for a full refund or exchange.</p>
        <p><strong>How to Initiate a Return:</strong></p>
        <ul style="padding-left:20px;">
          <li>Email <strong>${b.supportEmail}</strong> (or <strong>${b.secondaryEmail}</strong>) with your Order ID and reason for return.</li>
          <li>We will issue a prepaid USPS or UPS return shipping label within 1 business day.</li>
          <li>Items must be returned in original studio packaging with all included cables, tools, and accessories.</li>
        </ul>
        <p><strong>Refund Processing Time:</strong> Once your return package is received and inspected at our Los Angeles facility, your full refund is issued to your original payment method within 3–5 business days. Zero restocking fees apply.</p>
      </div>
    `,
    shipping: `
      <span style="font-size:12px; font-weight:700; text-transform:uppercase; color:#2563eb; letter-spacing:0.06em;">Logistics &amp; Delivery</span>
      <h2 style="font-size:24px; font-weight:800; margin:4px 0 16px; letter-spacing:-0.02em;">Shipping &amp; Delivery Policy</h2>
      <div style="font-size:14px; color:#334155; line-height:1.7; display:flex; flex-direction:column; gap:12px;">
        <p><strong>Complimentary Tracked US Shipping on All Orders</strong></p>
        <p>Every order placed with Monolith Studio Co. includes <strong>Free Standard Tracked Shipping ($0.00)</strong> across the United States.</p>
        <ul style="padding-left:20px;">
          <li><strong>Handling &amp; Packing Window:</strong> Orders are inspected, protective-packed, and handed to the carrier within 1–2 business days (24–48 hours) from our Los Angeles, CA warehouse (6515 S Crenshaw Blvd).</li>
          <li><strong>Carriers Used:</strong> USPS Ground Advantage / Priority Mail, UPS Ground, and FedEx Home Delivery.</li>
          <li><strong>Estimated Transit Time:</strong> 2–4 business days depending on destination state.</li>
          <li><strong>Live Tracking Notifications:</strong> A direct carrier tracking link is emailed to you the moment your shipping label is scanned into transit.</li>
        </ul>
      </div>
    `,
    privacy: `
      <span style="font-size:12px; font-weight:700; text-transform:uppercase; color:#2563eb; letter-spacing:0.06em;">Data Protection</span>
      <h2 style="font-size:24px; font-weight:800; margin:4px 0 16px; letter-spacing:-0.02em;">Privacy Policy</h2>
      <div style="font-size:14px; color:#334155; line-height:1.7; display:flex; flex-direction:column; gap:12px;">
        <p>Monolith Studio Co. respects your privacy and safeguards your personal data strictly for order fulfillment and customer support.</p>
        <p><strong>1. Data We Collect:</strong> When you purchase from our store, we collect your name, email address, shipping address, and phone number solely to ship your physical order and send carrier tracking updates.</p>
        <p><strong>2. Payment Security:</strong> All payment transactions are encrypted via 256-bit SSL and processed directly by Stripe (PCI-DSS Level 1 certified). Monolith Studio Co. never stores raw credit card numbers.</p>
        <p><strong>3. Zero Third-Party Selling:</strong> We never sell, rent, or trade customer personal information or email addresses to third-party advertisers.</p>
        <p><strong>4. Contact:</strong> For data access or deletion requests, email <strong>${b.supportEmail}</strong>.</p>
      </div>
    `,
    contact: `
      <span style="font-size:12px; font-weight:700; text-transform:uppercase; color:#2563eb; letter-spacing:0.06em;">Direct Studio Support</span>
      <h2 style="font-size:24px; font-weight:800; margin:4px 0 16px; letter-spacing:-0.02em;">Contact Information &amp; Studio Imprint</h2>
      <div style="font-size:14px; color:#334155; line-height:1.7; display:flex; flex-direction:column; gap:10px;">
        <p><strong>Legal Business Name:</strong> Monolith Studio Co.</p>
        <p><strong>Studio &amp; Fulfillment Address:</strong> ${b.address}</p>
        <p><strong>Primary Customer Support Email:</strong> <a href="mailto:${b.supportEmail}" style="color:#2563eb;">${b.supportEmail}</a></p>
        <p><strong>Direct Order &amp; Billing Desk:</strong> <a href="mailto:${b.secondaryEmail}" style="color:#2563eb;">${b.secondaryEmail}</a></p>
        <p><strong>Telephone Support:</strong> ${b.phone}</p>
        <p><strong>Operating Hours:</strong> ${b.hours}</p>
        <div style="margin-top:8px; padding:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; font-size:13px;">
          Need help with an existing order, VIA keymap configuration, or warranty claim? Include your Order ID in the subject line for priority same-day response from our Los Angeles support team.
        </div>
      </div>
    `
  };

  content.innerHTML = `<div class="checkout-container">${policies[type] || policies.contact}</div>`;
  modal.classList.add('open');
}

function closeModal() {
  const modal = document.getElementById('universal-modal');
  if (modal) modal.classList.remove('open');
}

window.addEventListener('DOMContentLoaded', initStore);
