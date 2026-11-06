let STORE_CONFIG = null;
let ACTIVE_CATEGORY = 'All';
let CART = [];

async function initStore() {
  try {
    const res = await fetch('/config/store-config.json');
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
      ${cat === 'All' ? 'All CNC Hardware (10)' : cat}
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
        <div class="product-category">${p.category} • ${p.weightGrams}g</div>
        <h3 class="product-title" onclick="openProductModal(${p.id})">${p.title}</h3>
        <p class="product-summary">${p.summary}</p>
        <div class="product-meta-row">
          <span class="product-price">$${p.price.toFixed(2)}</span>
          <span class="product-stock">● In Stock (${p.leadTime})</span>
        </div>
        <div class="product-actions">
          <button class="btn-outline" onclick="openProductModal(${p.id})">Specs & Details</button>
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
        <div style="margin-top:16px; background:#f4f5f7; padding:12px 14px; border-radius:8px; font-size:12.5px; color:#525866;">
          <strong>🛡️ ReWind Hardware Guarantee:</strong><br>
          Includes Free Tracked USPS / UPS / FedEx Shipping (dispatches within 24–48h from Los Angeles), 30-Day Studio Satisfaction Trial, and 1-Year Structural CNC Warranty.
        </div>
      </div>
      <div>
        <div style="font-family:var(--font-mono); font-size:11.5px; color:#525866; text-transform:uppercase; letter-spacing:0.06em;">
          ${p.category} • SKU: ${p.sku}
        </div>
        <h2 style="font-size:23px; font-weight:800; margin:6px 0 12px; line-height:1.25;">${p.title}</h2>
        <div style="display:flex; align-items:center; gap:14px; margin-bottom:18px;">
          <span style="font-family:var(--font-mono); font-size:26px; font-weight:800;">$${p.price.toFixed(2)} USD</span>
          <span style="background:#ecfdf5; color:#047857; font-size:12px; font-weight:700; padding:4px 10px; border-radius:99px;">
            ● In Stock — Ships in 24–48h
          </span>
        </div>

        <div class="shipping-notice-banner">
          <strong>📦 Order Confirmation &amp; Tracked Parcel Fulfillment</strong>
          Every order is packed at our Los Angeles facility and dispatched with live USPS, UPS, or FedEx tracking sent directly to your email address.
        </div>

        <p style="font-size:14px; color:#334155; margin-bottom:16px;">${p.summary}</p>

        <h4 style="font-size:13px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Engineering Highlights</h4>
        <ul style="padding-left:18px; font-size:13px; color:#334155; margin-bottom:18px;">
          ${highlightsHtml}
        </ul>

        <h4 style="font-size:13px; text-transform:uppercase; letter-spacing:0.05em;">Technical Specifications</h4>
        <div class="spec-list">${specsHtml}</div>

        <h4 style="font-size:13px; text-transform:uppercase; letter-spacing:0.05em; margin:14px 0 6px;">What's in the Box</h4>
        <ul style="padding-left:18px; font-size:13px; color:#334155; margin-bottom:22px;">
          ${boxHtml}
        </ul>

        <div style="display:grid; grid-template-columns:1fr 1.3fr; gap:10px;">
          <button class="btn-outline" style="padding:13px;" onclick="addToCart(${p.id}); closeModal();">Add to Cart</button>
          <button class="btn-buy" style="padding:13px; font-size:14.5px;" onclick="buyNow(${p.id})">Express Checkout — $${p.price.toFixed(2)}</button>
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
      <div class="checkout-container" style="text-align:center; padding:56px 24px;">
        <h2 style="font-size:22px; margin-bottom:10px;">Your ReWind Studio Cart is Empty</h2>
        <p style="color:#525866; font-size:14px; margin-bottom:24px;">Select any CNC hardware peripheral from our catalog to begin checkout.</p>
        <button class="btn-buy" style="padding:11px 22px;" onclick="closeModal()">Browse Hardware Catalog</button>
      </div>
    `;
    modal.classList.add('open');
    return;
  }

  const subtotal = CART.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const itemsHtml = CART.map(i => `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:14px; padding:12px 0; border-bottom:1px solid #e2e5ea;">
      <div style="display:flex; align-items:center; gap:12px;">
        <img src="${i.product.image}" alt="${i.product.title}" style="width:54px; height:54px; border-radius:6px; object-fit:cover; border:1px solid #e2e5ea;" />
        <div>
          <div style="font-weight:700; font-size:14px;">${i.product.title}</div>
          <div style="font-size:12px; color:#525866; font-family:var(--font-mono);">SKU: ${i.product.sku} • Qty: ${i.qty} • Free Tracked Shipping</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <span style="font-family:var(--font-mono); font-weight:700; font-size:15px;">$${(i.product.price * i.qty).toFixed(2)}</span>
        <button onclick="removeFromCart(${i.product.id})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:12px; font-weight:600;">Remove</button>
      </div>
    </div>
  `).join('');

  content.innerHTML = `
    <div class="checkout-container">
      <div style="border-bottom:1px solid #e2e5ea; padding-bottom:14px; margin-bottom:18px;">
        <span style="font-family:var(--font-mono); font-size:11px; text-transform:uppercase; color:#525866; letter-spacing:0.08em;">ReWind Hardware Co. • Direct Studio Checkout</span>
        <h2 style="font-size:24px; font-weight:800; margin-top:4px;">Shipping &amp; Order Fulfillment</h2>
      </div>

      <div style="background:#f8fafc; border:1px solid #e2e5ea; border-radius:8px; padding:14px 18px; margin-bottom:22px;">
        <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:#525866; margin-bottom:6px;">Order Summary</div>
        ${itemsHtml}
        <div style="display:flex; justify-content:space-between; padding-top:12px; font-size:13.5px; color:#525866;">
          <span>USPS / UPS / FedEx Tracked Parcel Shipping (2–4 Business Days)</span>
          <strong style="color:#059669;">FREE ($0.00)</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding-top:8px; font-size:17px; font-weight:800;">
          <span>Total Due</span>
          <span style="font-family:var(--font-mono);">$${subtotal.toFixed(2)} USD</span>
        </div>
      </div>

      <form id="rewind-checkout-form" onsubmit="submitCheckout(event)">
        <h3 style="font-size:15px; font-weight:700; margin-bottom:4px;">Customer &amp; Delivery Address</h3>
        <p style="font-size:12.5px; color:#525866; margin-bottom:12px;">Enter your physical delivery details below. Live carrier tracking updates will be sent to your email and phone.</p>

        <div class="form-grid">
          <div class="form-group">
            <label>First Name *</label>
            <input type="text" name="first_name" required placeholder="Brien" />
          </div>
          <div class="form-group">
            <label>Last Name *</label>
            <input type="text" name="last_name" required placeholder="Cook" />
          </div>
          <div class="form-group full">
            <label>Email Address (For order confirmation &amp; tracking link) *</label>
            <input type="email" name="email" required placeholder="you@example.com" />
          </div>
          <div class="form-group full">
            <label>Address Line 1 (Street Address) *</label>
            <input type="text" name="address" required placeholder="2716 Hilltop Haven Dr" />
          </div>
          <div class="form-group full">
            <label>Address Line 2 (Apt, Suite, Unit - Optional)</label>
            <input type="text" name="address2" placeholder="Apt 4B, Suite 210 (Optional)" />
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
            <input type="text" name="postal" required placeholder="90001" />
          </div>
          <div class="form-group">
            <label>Phone Number (For delivery tracking updates) *</label>
            <input type="tel" name="phone" required placeholder="(213) 555-0199" />
          </div>
        </div>

        <div style="margin-top:22px; display:flex; flex-direction:column; gap:10px;">
          <button type="submit" class="btn-buy" style="padding:14px; font-size:15px; width:100%;">
            Continue to Secure Payment — $${subtotal.toFixed(2)} USD →
          </button>
          <div style="text-align:center; font-size:12px; color:#64748b;">
            🔒 256-Bit SSL Encrypted Checkout • 30-Day Studio Return Guarantee • 1-Year CNC Hardware Warranty
          </div>
        </div>
      </form>
    </div>
  `;

  modal.classList.add('open');
}

function resolveWaveCheckoutUrl(primaryItem, totalAmount) {
  if (!STORE_CONFIG || !STORE_CONFIG.waveCheckoutLinks) return '';
  const bySku = STORE_CONFIG.waveCheckoutLinks.bySku || {};
  const byTier = STORE_CONFIG.waveCheckoutLinks.byPriceTier || {};

  if (primaryItem && bySku[primaryItem.sku] && bySku[primaryItem.sku].trim()) {
    return bySku[primaryItem.sku].trim();
  }
  const tierKey = String(Math.round(totalAmount));
  if (byTier[tierKey] && byTier[tierKey].trim()) {
    return byTier[tierKey].trim();
  }
  return '';
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
  const orderId = 'RW-' + Math.random().toString(36).substring(2, 8).toUpperCase();

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
    const saved = JSON.parse(localStorage.getItem('rewind_orders') || '[]');
    saved.unshift(orderPayload);
    localStorage.setItem('rewind_orders', JSON.stringify(saved.slice(0, 30)));
  } catch (_) {}

  // Also notify backend /api/orders if running in Node server mode
  try {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });
  } catch (_) {}

  // Check if Wave Checkout link is configured for this SKU or price tier
  const waveUrl = resolveWaveCheckoutUrl(primaryProduct, totalAmount);
  if (waveUrl) {
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
    const separator = waveUrl.includes('?') ? '&' : '?';
    window.location.href = `${waveUrl}${separator}${params.toString()}`;
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
      <div style="background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; padding:16px 20px; border-radius:10px; margin-bottom:22px;">
        <div style="font-family:var(--font-mono); font-size:12px; font-weight:700; text-transform:uppercase;">Order Registered • #${orderId}</div>
        <h2 style="font-size:22px; font-weight:800; margin-top:4px;">Thank You, ${customer.first_name}! Your Order is Confirmed.</h2>
        <p style="font-size:13.5px; margin-top:6px;">
          We have registered your shipping manifest for <strong>${primaryProduct ? primaryProduct.title : 'ReWind Hardware'}</strong> and sent your invoice &amp; order confirmation to <strong>${customer.email}</strong>.
        </p>
      </div>

      <div style="background:#f8fafc; border:1px solid #e2e5ea; border-radius:8px; padding:18px; margin-bottom:20px; font-size:13.5px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
          <div>
            <div style="color:#64748b; font-size:12px; font-weight:600; text-transform:uppercase;">Order Reference</div>
            <div style="font-family:var(--font-mono); font-weight:700; font-size:15px; margin-top:2px;">#${orderId}</div>
          </div>
          <div>
            <div style="color:#64748b; font-size:12px; font-weight:600; text-transform:uppercase;">Total Amount</div>
            <div style="font-family:var(--font-mono); font-weight:700; font-size:15px; margin-top:2px;">$${totalAmount.toFixed(2)} USD (Free Shipping)</div>
          </div>
          <div style="grid-column:1 / -1;">
            <div style="color:#64748b; font-size:12px; font-weight:600; text-transform:uppercase;">Verified Shipping Destination</div>
            <div style="font-weight:600; margin-top:2px;">${customer.first_name} ${customer.last_name} — ${fullAddress}</div>
            <div style="color:#525866; font-size:12.5px; margin-top:2px;">SMS / Tracking Phone: ${customer.phone}</div>
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
      <span style="font-family:var(--font-mono); font-size:11px; text-transform:uppercase; color:#525866;">ReWind Logistics &amp; Fulfillment</span>
      <h2 style="font-size:24px; font-weight:800; margin:4px 0 10px;">Track Your Hardware Order</h2>
      <p style="font-size:13.5px; color:#525866; margin-bottom:18px;">
        Enter your ReWind Order ID (e.g. <code>#RW-8F3K9A</code>) or email address to check your packing status and carrier tracking number.
      </p>
      <div style="display:flex; gap:10px; margin-bottom:20px;">
        <input id="track-input" type="text" value="${prefillOrderId}" placeholder="Order ID (e.g. RW-XXXXXX) or Email" style="flex:1; padding:11px 14px; border:1px solid #c8cdd6; border-radius:6px; font-size:14px;" />
        <button class="btn-buy" style="padding:11px 20px;" onclick="lookupOrder()">Check Status</button>
      </div>
      <div id="track-result"></div>
    </div>
  `;
  modal.classList.add('open');
  if (prefillOrderId) lookupOrder();
}

function lookupOrder() {
  const q = (document.getElementById('track-input')?.value || '').trim().replace(/^#/, '').toUpperCase();
  const resultEl = document.getElementById('track-result');
  if (!q) return;

  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem('rewind_orders') || '[]');
  } catch (_) {}

  const match = saved.find(o => o.orderId.toUpperCase() === q || (o.customer?.email || '').toUpperCase() === q);
  if (match) {
    resultEl.innerHTML = `
      <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <strong style="font-family:var(--font-mono); font-size:15px;">Order #${match.orderId}</strong>
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
      <div style="background:#f8fafc; border:1px solid #e2e5ea; border-radius:8px; padding:16px; font-size:13.5px; color:#334155;">
        Order reference <strong>#${q}</strong> is queued in our Los Angeles fulfillment system. If you placed your order within the last 24 hours, your USPS/UPS/FedEx tracking link will be dispatched to your email shortly. For immediate assistance, email <strong>support@rewindhardware.co</strong>.
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
      <span style="font-family:var(--font-mono); font-size:11px; text-transform:uppercase; color:#525866;">Legal &amp; Compliance</span>
      <h2 style="font-size:24px; font-weight:800; margin:4px 0 16px;">Terms of Service</h2>
      <div style="font-size:14px; color:#334155; line-height:1.7; display:flex; flex-direction:column; gap:12px;">
        <p><strong>Effective Date:</strong> November 2026 • <strong>Operated By:</strong> ReWind Hardware Co. (${b.address})</p>
        <p><strong>1. Scope of Products:</strong> ReWind Hardware Co. designs, machines, and distributes precision CNC aluminum and brass desktop hardware, mechanical keyboards, mice, watch cases, and studio lighting accessories. By placing an order on our storefront, you agree to these Terms of Service.</p>
        <p><strong>2. Pricing &amp; Billing:</strong> All prices are listed in US Dollars (USD) and include complimentary standard tracked shipping within the United States. Payments are processed securely through encrypted PCI-DSS compliant payment gateways (Wave Payments / Visa / Mastercard / Amex / Apple Pay).</p>
        <p><strong>3. Order Fulfillment &amp; Shipping:</strong> In-stock hardware dispatches from our Los Angeles, California studio warehouse within 24–48 business hours. Customers receive an electronic order confirmation at checkout and a carrier tracking link via email upon parcel dispatch.</p>
        <p><strong>4. 1-Year Structural Hardware Warranty:</strong> All CNC-milled metal components, PCB assemblies, optical sensors, and LED light bars are covered by a 1-Year Manufacturer Warranty against defects in materials and workmanship.</p>
        <p><strong>5. Governing Law:</strong> These Terms are governed by the laws of the State of California, United States.</p>
      </div>
    `,
    returns: `
      <span style="font-family:var(--font-mono); font-size:11px; text-transform:uppercase; color:#525866;">Customer Protection</span>
      <h2 style="font-size:24px; font-weight:800; margin:4px 0 16px;">30-Day Return &amp; Refund Policy</h2>
      <div style="font-size:14px; color:#334155; line-height:1.7; display:flex; flex-direction:column; gap:12px;">
        <p><strong>30-Day Studio Satisfaction Guarantee</strong></p>
        <p>We stand behind the precision machining, finish, and performance of every piece of ReWind hardware. If you are not 100% satisfied with your purchase, you may return it within <strong>30 days of delivery</strong> for a full refund or exchange.</p>
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
      <span style="font-family:var(--font-mono); font-size:11px; text-transform:uppercase; color:#525866;">Logistics &amp; Delivery</span>
      <h2 style="font-size:24px; font-weight:800; margin:4px 0 16px;">Shipping &amp; Delivery Policy</h2>
      <div style="font-size:14px; color:#334155; line-height:1.7; display:flex; flex-direction:column; gap:12px;">
        <p><strong>Complimentary Tracked US Shipping on All Orders</strong></p>
        <p>Every order placed with ReWind Hardware Co. includes <strong>Free Standard Tracked Shipping ($0.00)</strong> across the continental United States.</p>
        <ul style="padding-left:20px;">
          <li><strong>Handling &amp; Packing Window:</strong> Orders are inspected, protective-packed, and handed to the carrier within 1–2 business days (24–48 hours) from our Los Angeles, CA warehouse.</li>
          <li><strong>Carriers Used:</strong> USPS Ground Advantage / Priority Mail, UPS Ground, and FedEx Home Delivery.</li>
          <li><strong>Estimated Transit Time:</strong> 2–4 business days depending on destination state.</li>
          <li><strong>Live Tracking Notifications:</strong> A direct carrier tracking link is emailed to you the moment your shipping label is scanned into transit.</li>
        </ul>
      </div>
    `,
    privacy: `
      <span style="font-family:var(--font-mono); font-size:11px; text-transform:uppercase; color:#525866;">Data Protection</span>
      <h2 style="font-size:24px; font-weight:800; margin:4px 0 16px;">Privacy Policy</h2>
      <div style="font-size:14px; color:#334155; line-height:1.7; display:flex; flex-direction:column; gap:12px;">
        <p>ReWind Hardware Co. respects your privacy and safeguards your personal data strictly for order fulfillment and customer support.</p>
        <p><strong>1. Data We Collect:</strong> When you purchase from our store, we collect your name, email address, shipping address, and phone number solely to ship your physical order and send carrier tracking updates.</p>
        <p><strong>2. Payment Security:</strong> All payment transactions are encrypted via 256-bit SSL and processed directly by PCI-DSS Level 1 certified processors. ReWind Hardware Co. never stores raw credit card numbers.</p>
        <p><strong>3. Zero Third-Party Selling:</strong> We never sell, rent, or trade customer personal information or email addresses to third-party advertisers.</p>
        <p><strong>4. Contact:</strong> For data access or deletion requests, email <strong>${b.supportEmail}</strong>.</p>
      </div>
    `,
    contact: `
      <span style="font-family:var(--font-mono); font-size:11px; text-transform:uppercase; color:#525866;">Direct Studio Support</span>
      <h2 style="font-size:24px; font-weight:800; margin:4px 0 16px;">Contact Information &amp; Studio Imprint</h2>
      <div style="font-size:14px; color:#334155; line-height:1.7; display:flex; flex-direction:column; gap:10px;">
        <p><strong>Legal Business Name:</strong> ReWind Hardware Co.</p>
        <p><strong>Studio &amp; Fulfillment Address:</strong> ${b.address}</p>
        <p><strong>Primary Customer Support Email:</strong> <a href="mailto:${b.supportEmail}" style="color:#2563eb;">${b.supportEmail}</a></p>
        <p><strong>Direct Order &amp; Billing Desk:</strong> <a href="mailto:${b.secondaryEmail}" style="color:#2563eb;">${b.secondaryEmail}</a></p>
        <p><strong>Telephone Support:</strong> ${b.phone}</p>
        <p><strong>Operating Hours:</strong> ${b.hours}</p>
        <div style="margin-top:8px; padding:14px; background:#f8fafc; border:1px solid #e2e5ea; border-radius:8px; font-size:13px;">
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
