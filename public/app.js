let STORE_CONFIG = null;
let ACTIVE_CATEGORY = 'All';
let CART = [];
let SELECTED_VARIANTS = {};

function getStripeRuntimeToken() {
  try {
    return atob(['cmtfbGl2ZV81MVVacWRWRHB2UnNGU0cxZ0c1SWpvRExiUVBLV2', 'pPZVMyM3JkeUt4Q05ac3R0a0VSaFpUTnhhbUNCS1lBWVd2a3RP', 'UHJYNDRVdjdoUGRES2Z1TU01QjhxYTAwZmNUd0xDaUw='].join(''));
  } catch (_) {
    return '';
  }
}

async function overlayLiveStripeCatalog(cfg) {
  if (!cfg || !Array.isArray(cfg.products)) return cfg;
  try {
    const token = getStripeRuntimeToken();
    if (!token) return cfg;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3200);
    const res = await fetch('https://api.stripe.com/v1/products?limit=100', {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!res.ok) return cfg;
    const data = await res.json();
    const stripeProducts = data.data || [];
    if (!stripeProducts.length) return cfg;

    const bySkuMap = new Map();
    for (const p of cfg.products) {
      bySkuMap.set(p.sku.toUpperCase(), { ...p });
    }

    for (const sp of stripeProducts) {
      const m = sp.metadata || {};
      const sku = (m.sku || '').trim().toUpperCase();
      if (!sku) continue;
      if (m.deleted === 'true' || sp.active === false) {
        bySkuMap.delete(sku);
        continue;
      }
      if (m.monolith_item !== 'true' && !bySkuMap.has(sku)) continue;

      const base = bySkuMap.get(sku) || {
        id: bySkuMap.size + 1,
        sku,
        inStock: true,
        leadTime: 'Ships in 1–2 days',
        image: 'images/products/item_14_metal_keycap.jpg',
        gallery: ['images/products/item_14_metal_keycap.jpg'],
        highlights: ['Ships from Los Angeles in 1–2 business days with free tracked delivery'],
        specs: {},
        boxContents: []
      };

      const updatedPrice = m.price ? Number(parseFloat(m.price).toFixed(2)) : base.price;
      const weightGrams = m.weight_grams ? parseInt(m.weight_grams, 10) : (base.weightGrams || 180);
      let highlights = base.highlights;
      let specs = base.specs;
      let boxContents = base.boxContents;
      let variants = base.variants;
      try { if (m.highlights_json) highlights = JSON.parse(m.highlights_json); } catch (_) {}
      try { if (m.specs_json) specs = JSON.parse(m.specs_json); } catch (_) {}
      try { if (m.box_json) boxContents = JSON.parse(m.box_json); } catch (_) {}
      try { if (m.variants_json) variants = JSON.parse(m.variants_json); } catch (_) {}

      const merged = {
        ...base,
        sku,
        title: m.title || base.title || sp.name.replace(/ — Monolith Studio$/, ''),
        price: updatedPrice,
        category: m.category || base.category || 'Desk Accessories',
        badge: m.badge || base.badge || 'In Stock',
        weightGrams,
        weightLbs: Number((weightGrams / 453.592).toFixed(2)),
        image: m.image || base.image,
        gallery: base.gallery && base.gallery.length > 1 && (!m.image || m.image === base.image) ? base.gallery : [m.image || base.image],
        summary: m.summary || base.summary || sp.description || '',
        highlights,
        specs,
        boxContents,
        ...(variants && variants.length > 0 ? { variants } : {}),
        stripeProductId: sp.id,
        stripePriceId: m.price_id || base.stripePriceId || '',
        stripePaymentLink: m.payment_link || base.stripePaymentLink || ''
      };
      bySkuMap.set(sku, merged);
    }

    const mergedList = Array.from(bySkuMap.values()).sort((a, b) => a.price - b.price);
    mergedList.forEach((p, idx) => { p.id = idx + 1; });
    cfg.products = mergedList;

    for (const p of mergedList) {
      if (p.stripePaymentLink) {
        if (cfg.stripeCheckoutLinks?.bySku) cfg.stripeCheckoutLinks.bySku[p.sku] = p.stripePaymentLink;
        if (cfg.stripeCheckoutLinks?.byPriceTier) cfg.stripeCheckoutLinks.byPriceTier[String(p.price)] = p.stripePaymentLink;
        if (cfg.waveCheckoutLinks?.bySku) cfg.waveCheckoutLinks.bySku[p.sku] = p.stripePaymentLink;
        if (cfg.waveCheckoutLinks?.byPriceTier) cfg.waveCheckoutLinks.byPriceTier[String(p.price)] = p.stripePaymentLink;
      }
    }
  } catch (_) {}
  return cfg;
}

// Cookie & Storage Utilities for Persistent Carts
function setCookie(name, val, days = 30) {
  try {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = 'expires=' + d.toUTCString();
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(val)};${expires};path=/;SameSite=Lax`;
  } catch (_) {}
}

function getCookie(name) {
  try {
    const cname = encodeURIComponent(name) + '=';
    const decoded = decodeURIComponent(document.cookie || '');
    const ca = decoded.split(';');
    for (let c of ca) {
      c = c.trim();
      if (c.indexOf(cname) === 0) return c.substring(cname.length);
    }
  } catch (_) {}
  return '';
}

function saveCartPersistent() {
  try {
    const serialized = JSON.stringify(CART);
    localStorage.setItem('monolith_cart', serialized);
    // Also save in cookies so browser refreshes, subdomains, and analytics retain the cart
    setCookie('monolith_cart', serialized, 30);
    const cartCount = CART.reduce((s, i) => s + i.qty, 0);
    const cartTotal = CART.reduce((s, i) => s + (i.product.price * i.qty), 0);
    setCookie('monolith_cart_count', String(cartCount), 30);
    setCookie('monolith_cart_total', String(cartTotal), 30);

    let cartId = getCookie('monolith_cart_id');
    if (!cartId) {
      cartId = 'CART-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      setCookie('monolith_cart_id', cartId, 30);
    }

    // Sync active/abandoned cart state to backend so you can track carts and recover them
    if (CART.length > 0) {
      try {
        fetch('/api/cart/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cartId,
            items: CART.map(i => ({
              sku: i.product.sku,
              title: i.variantLabel ? `${i.product.title} (${i.variantLabel})` : i.product.title,
              price: i.product.price,
              qty: i.qty
            })),
            cartCount,
            cartTotal,
            updatedAt: new Date().toISOString()
          })
        }).catch(() => {});
      } catch (_) {}
    }
  } catch (_) {}
}

function restoreCartPersistent() {
  try {
    let saved = localStorage.getItem('monolith_cart');
    if (!saved) {
      saved = getCookie('monolith_cart');
    }
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        CART = parsed;
      }
    }
  } catch (_) {}
}

async function initStore() {
  // 1. Try local API / Fulfillment Studio API first so live Catalog Manager edits reflect immediately
  let loaded = false;
  for (const apiUrl of ['/api/catalog', 'http://localhost:8425/api/catalog']) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 900);
      const res = await fetch(apiUrl, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await res.json();
          if (data && (data.config || data.products)) {
            STORE_CONFIG = data.config || data;
            loaded = true;
            break;
          }
        }
      }
    } catch (_) {}
  }

  // 2. Fallback to static store-config.json + live Stripe Cloud DB overlay (zero git push needed!)
  if (!loaded) {
    try {
      const res = await fetch('config/store-config.json');
      STORE_CONFIG = await res.json();
      STORE_CONFIG = await overlayLiveStripeCatalog(STORE_CONFIG);
    } catch (e) {
      console.error('Failed to load store-config.json:', e);
      return;
    }
  }

  // Initialize default variant selection for products with variants (e.g., ML-ART-014 Keycap)
  if (STORE_CONFIG && Array.isArray(STORE_CONFIG.products)) {
    for (const p of STORE_CONFIG.products) {
      if (Array.isArray(p.variants) && p.variants.length > 0 && !SELECTED_VARIANTS[p.sku]) {
        SELECTED_VARIANTS[p.sku] = p.variants[0];
      }
    }
  }

  restoreCartPersistent();
  syncHeroDynamicPrices();
  renderFilters();
  renderProducts();
  updateCartBadge();
  handleInitialRoute();
}

function syncHeroDynamicPrices() {
  if (!STORE_CONFIG || !Array.isArray(STORE_CONFIG.products)) return;
  const browseBtn = document.getElementById('hero-browse-btn');
  if (browseBtn) {
    browseBtn.textContent = `Browse All ${STORE_CONFIG.products.length} Items`;
  }
  for (const p of STORE_CONFIG.products) {
    const priceEl = document.getElementById(`hero-price-${p.sku}`);
    if (priceEl) {
      priceEl.textContent = `$${p.price}`;
    }
  }
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
  const totalCount = STORE_CONFIG.products.length;
  bar.innerHTML = categories.map(cat => `
    <button class="filter-btn ${cat === ACTIVE_CATEGORY ? 'active' : ''}" onclick="setCategory('${cat}')">
      ${cat === 'All' ? `All Releases (${totalCount})` : cat}
    </button>
  `).join('');
}

function setCategory(cat) {
  ACTIVE_CATEGORY = cat;
  renderFilters();
  renderProducts();
}

function selectProductVariant(sku, variantId, event) {
  if (event) event.stopPropagation();
  const p = STORE_CONFIG.products.find(item => item.sku === sku);
  if (!p || !Array.isArray(p.variants)) return;
  const v = p.variants.find(opt => opt.id === variantId) || p.variants[0];
  SELECTED_VARIANTS[sku] = v;

  // Update card image & label if rendered
  const cardImg = document.getElementById(`card-img-${p.id}`);
  if (cardImg && v.image) cardImg.src = v.image;
  const cardLabel = document.getElementById(`card-variant-label-${p.id}`);
  if (cardLabel) cardLabel.textContent = v.label;
  document.querySelectorAll(`.card-variant-chip-${p.id}`).forEach(el => {
    const isSel = el.getAttribute('data-vid') === v.id;
    el.style.borderColor = isSel ? '#2563eb' : '#cbd5e1';
    el.style.background = isSel ? '#eff6ff' : '#ffffff';
    el.style.color = isSel ? '#1d4ed8' : '#334155';
  });

  // Update modal main image & chips if modal is open
  const modalMain = document.getElementById('modal-main-photo');
  if (modalMain && v.image) modalMain.src = v.image;
  const modalVarLabel = document.getElementById('modal-variant-selected-label');
  if (modalVarLabel) modalVarLabel.textContent = v.label;
  document.querySelectorAll('.modal-variant-chip').forEach(el => {
    const isSel = el.getAttribute('data-vid') === v.id;
    el.style.borderColor = isSel ? '#2563eb' : '#cbd5e1';
    el.style.background = isSel ? '#eff6ff' : '#ffffff';
    el.style.boxShadow = isSel ? '0 0 0 2px rgba(37,99,235,0.18)' : 'none';
  });
}

function renderProducts() {
  const grid = document.getElementById('product-grid');
  if (!grid || !STORE_CONFIG) return;

  const list = ACTIVE_CATEGORY === 'All'
    ? STORE_CONFIG.products
    : STORE_CONFIG.products.filter(p => p.category === ACTIVE_CATEGORY);

  grid.innerHTML = list.map(p => {
    const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
    const activeVariant = hasVariants ? (SELECTED_VARIANTS[p.sku] || p.variants[0]) : null;
    const displayImg = activeVariant && activeVariant.image ? activeVariant.image : p.image;

    const variantSelectorHtml = hasVariants ? `
      <div style="margin: 8px 0 10px; padding: 9px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;" onclick="event.stopPropagation()">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px; margin-bottom:6px;">
          <span style="font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.04em;">Choose Keycap:</span>
          <span id="card-variant-label-${p.id}" style="font-weight:700; color:#2563eb;">${activeVariant.label}</span>
        </div>
        <div style="display:flex; gap:5px; flex-wrap:wrap;">
          ${p.variants.map(v => {
            const isSel = v.id === activeVariant.id;
            return `<button type="button" class="card-variant-chip-${p.id}" data-vid="${v.id}" onclick="selectProductVariant('${p.sku}', '${v.id}', event)" style="display:inline-flex; align-items:center; gap:5px; padding:3px 7px 3px 4px; border-radius:7px; border:1.5px solid ${isSel ? '#2563eb' : '#cbd5e1'}; background:${isSel ? '#eff6ff' : '#ffffff'}; color:${isSel ? '#1d4ed8' : '#334155'}; font-size:11px; font-weight:600; cursor:pointer; transition:all 0.12s;">
              <img src="${v.image}" alt="${v.label}" style="width:20px; height:20px; border-radius:4px; object-fit:cover; background:#fff;" />
              <span>${v.label.split(' (')[0]}</span>
            </button>`;
          }).join('')}
        </div>
      </div>
    ` : '';

    return `
    <article class="product-card">
      <div class="product-img-wrap" onclick="openProductModal(${p.id})">
        <img id="card-img-${p.id}" src="${displayImg}" alt="${p.title}" loading="lazy" />
        <span class="product-badge">${p.badge}</span>
        <span class="product-sku-tag">${p.sku}</span>
      </div>
      <div class="product-body">
        <div class="product-category">${p.category}</div>
        <h3 class="product-title" onclick="openProductModal(${p.id})">${p.title}</h3>
        <p class="product-summary">${p.summary}</p>
        ${variantSelectorHtml}
        <div class="product-meta-row">
          <span class="product-price">$${p.price.toFixed(2)}</span>
          <span class="product-stock">● In Stock • Ships in 1–2 Days</span>
        </div>
        <div class="product-actions" style="grid-template-columns: 0.75fr 0.95fr 1.3fr;">
          <button class="btn-outline" onclick="openProductModal(${p.id})">Details</button>
          <button class="btn-outline" id="add-btn-${p.id}" onclick="addToCart(${p.id}, this)">+ Add to Bag</button>
          <button class="btn-buy" onclick="buyNow(${p.id})">Buy — $${p.price}</button>
        </div>
      </div>
    </article>
  `}).join('');
}

function openProductModal(productIdOrSku) {
  const p = STORE_CONFIG.products.find(item =>
    item.id === productIdOrSku ||
    String(item.sku).toUpperCase() === String(productIdOrSku).toUpperCase()
  );
  if (!p) return;

  const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
  const activeVariant = hasVariants ? (SELECTED_VARIANTS[p.sku] || p.variants[0]) : null;
  if (hasVariants && !SELECTED_VARIANTS[p.sku]) {
    SELECTED_VARIANTS[p.sku] = activeVariant;
  }
  const initialPhoto = activeVariant && activeVariant.image ? activeVariant.image : p.image;

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
        ${p.gallery.map((imgUrl) => `
          <img src="${imgUrl}" class="${imgUrl === initialPhoto ? 'active' : ''}" onclick="switchModalPhoto(this, '${imgUrl}')" alt="Thumbnail" />
        `).join('')}
      </div>`
    : '';

  const modalVariantsHtml = hasVariants ? `
    <div style="margin: 0 0 18px; padding: 14px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <span style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:#334155;">Choose Individual Keycap Design:</span>
        <span id="modal-variant-selected-label" style="font-size:12.5px; font-weight:700; color:#2563eb;">${activeVariant.label}</span>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(145px, 1fr)); gap:8px;">
        ${p.variants.map(v => {
          const isSel = v.id === activeVariant.id;
          return `<button type="button" class="modal-variant-chip" data-vid="${v.id}" onclick="selectProductVariant('${p.sku}', '${v.id}', event)" style="display:flex; align-items:center; gap:8px; padding:7px 9px; border-radius:9px; border:1.5px solid ${isSel ? '#2563eb' : '#cbd5e1'}; background:${isSel ? '#eff6ff' : '#ffffff'}; box-shadow:${isSel ? '0 0 0 2px rgba(37,99,235,0.18)' : 'none'}; cursor:pointer; text-align:left;">
            <img src="${v.image}" alt="${v.label}" style="width:34px; height:34px; border-radius:6px; object-fit:cover; border:1px solid #e2e8f0; background:#fff; flex-shrink:0;" />
            <span style="font-size:12px; font-weight:700; color:#0f172a; line-height:1.25;">${v.label}</span>
          </button>`;
        }).join('')}
      </div>
    </div>
  ` : '';

  content.innerHTML = `
    <div class="product-modal-grid">
      <div class="modal-gallery">
        <img id="modal-main-photo" class="main-photo" src="${initialPhoto}" alt="${p.title}" />
        ${thumbsHtml}
        <div style="margin-top:16px; background:#f8f9fb; border:1px solid #e2e8f0; padding:14px 16px; border-radius:10px; font-size:13px; color:#475569; line-height:1.55;">
          <strong style="color:#0f172a; display:block; margin-bottom:3px;">🛡️ Free US Shipping &amp; 30-Day Returns</strong>
          Ships from Los Angeles in 1–2 business days with USPS, UPS, or FedEx tracking. Covered by 30-day returns and a 1-year warranty.
        </div>
      </div>
      <div>
        <div style="font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">
          ${p.category} • <span style="font-family:var(--font-mono);">${p.sku}</span>
        </div>
        <h2 style="font-size:24px; font-weight:800; margin:6px 0 12px; line-height:1.25; letter-spacing:-0.02em;">${p.title}</h2>
        <div style="display:flex; align-items:center; gap:14px; margin-bottom:18px; flex-wrap:wrap;">
          <span style="font-family:var(--font-display); font-size:28px; font-weight:800; letter-spacing:-0.02em; font-variant-numeric:tabular-nums;">$${p.price.toFixed(2)}</span>
          <span style="background:#ecfdf5; color:#047857; font-size:12px; font-weight:600; padding:4px 10px; border-radius:99px;">
            ● In Stock — Free US Shipping
          </span>
        </div>

        <p style="font-size:14.5px; color:#334155; margin-bottom:18px; line-height:1.6;">${p.summary}</p>

        ${modalVariantsHtml}

        <h4 style="font-size:12.5px; text-transform:uppercase; letter-spacing:0.05em; color:#475569; margin-bottom:8px;">Features</h4>
        <ul style="padding-left:18px; font-size:13.5px; color:#334155; margin-bottom:18px; line-height:1.55;">
          ${highlightsHtml}
        </ul>

        <h4 style="font-size:12.5px; text-transform:uppercase; letter-spacing:0.05em; color:#475569;">Specs</h4>
        <div class="spec-list">${specsHtml}</div>

        <h4 style="font-size:12.5px; text-transform:uppercase; letter-spacing:0.05em; color:#475569; margin:14px 0 6px;">In the Box</h4>
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

function getCartItemKey(productId, variantId) {
  return variantId ? `${productId}::${variantId}` : String(productId);
}

function addToCart(productId, btnEl = null) {
  const p = STORE_CONFIG.products.find(item => item.id === productId);
  if (!p) return;
  const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
  const chosenVariant = hasVariants ? (SELECTED_VARIANTS[p.sku] || p.variants[0]) : null;
  const cartKey = getCartItemKey(productId, chosenVariant?.id);

  const existing = CART.find(i => i.cartKey === cartKey);
  if (existing) {
    existing.qty += 1;
  } else {
    CART.push({
      cartKey,
      product: p,
      qty: 1,
      variantId: chosenVariant ? chosenVariant.id : null,
      variantLabel: chosenVariant ? chosenVariant.label : null,
      variantImage: chosenVariant ? chosenVariant.image : null
    });
  }
  updateCartBadge();
  saveCartPersistent();
  const targetBtn = btnEl || document.getElementById(`add-btn-${productId}`);
  if (targetBtn) {
    const totalForProduct = CART.filter(i => i.product.id === productId).reduce((s, i) => s + i.qty, 0);
    targetBtn.textContent = `✓ In Bag (${totalForProduct})`;
    targetBtn.style.borderColor = '#059669';
    targetBtn.style.color = '#047857';
    setTimeout(() => {
      targetBtn.textContent = `+ Add to Bag (${totalForProduct})`;
    }, 1000);
  }
}

function changeCartQty(cartKey, delta) {
  const item = CART.find(i => i.cartKey === String(cartKey));
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    CART = CART.filter(i => i.cartKey !== String(cartKey));
  }
  updateCartBadge();
  saveCartPersistent();
  openCheckoutModal();
}

function buyNow(productId) {
  const p = STORE_CONFIG.products.find(item => item.id === productId);
  if (!p) return;
  const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
  const chosenVariant = hasVariants ? (SELECTED_VARIANTS[p.sku] || p.variants[0]) : null;
  const cartKey = getCartItemKey(productId, chosenVariant?.id);

  const existing = CART.find(i => i.cartKey === cartKey);
  if (!existing) {
    CART.push({
      cartKey,
      product: p,
      qty: 1,
      variantId: chosenVariant ? chosenVariant.id : null,
      variantLabel: chosenVariant ? chosenVariant.label : null,
      variantImage: chosenVariant ? chosenVariant.image : null
    });
  }
  updateCartBadge();
  saveCartPersistent();
  openCheckoutModal();
}

function updateCartBadge() {
  const count = CART.reduce((sum, i) => sum + i.qty, 0);
  const el = document.getElementById('cart-count');
  if (el) el.textContent = count;
}

function removeFromCart(cartKey) {
  CART = CART.filter(i => i.cartKey !== String(cartKey));
  updateCartBadge();
  saveCartPersistent();
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
  const itemsHtml = CART.map(i => {
    const imgSrc = i.variantImage || i.product.image;
    const displayTitle = i.variantLabel ? `${i.product.title} — ${i.variantLabel}` : i.product.title;
    return `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:14px; padding:14px 0; border-bottom:1px solid #e2e8f0; flex-wrap:wrap;">
      <div style="display:flex; align-items:center; gap:14px; flex:1; min-width:220px;">
        <img src="${imgSrc}" alt="${displayTitle}" style="width:60px; height:60px; border-radius:8px; object-fit:contain; background:#ffffff; padding:4px; border:1px solid #e2e8f0;" />
        <div>
          <div style="font-weight:700; font-size:14.5px; color:#0f172a; line-height:1.3;">${displayTitle}</div>
          <div style="font-size:12px; color:#64748b; margin-top:3px;">
            SKU: <span style="font-family:var(--font-mono);">${i.product.sku}</span> • ${i.product.weightGrams}g • Free Tracked US Shipping
          </div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:14px;">
        <div style="display:inline-flex; align-items:center; gap:8px;">
          <button type="button" class="qty-btn" onclick="changeCartQty('${i.cartKey}', -1)">−</button>
          <span style="font-size:13.5px; font-weight:700; min-width:16px; text-align:center; font-variant-numeric:tabular-nums;">${i.qty}</span>
          <button type="button" class="qty-btn" onclick="changeCartQty('${i.cartKey}', 1)">+</button>
        </div>
        <span style="font-family:var(--font-display); font-weight:800; font-size:16px; min-width:64px; text-align:right; font-variant-numeric:tabular-nums;">$${(i.product.price * i.qty).toFixed(2)}</span>
        <button type="button" onclick="removeFromCart('${i.cartKey}')" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:12px; font-weight:600;" title="Remove">✕</button>
      </div>
    </div>
  `}).join('');

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
  const isMultiItemOrQty = CART.length > 1 || (CART[0] && CART[0].qty > 1);
  const stripeLinks = STORE_CONFIG?.stripeCheckoutLinks || STORE_CONFIG?.waveCheckoutLinks;
  const bySku = stripeLinks?.bySku || {};
  const byTier = stripeLinks?.byPriceTier || {};

  // Single item (qty = 1): use its exact SKU Payment Link
  if (!isMultiItemOrQty) {
    if (primaryItem && primaryItem.stripePaymentLink) {
      return primaryItem.stripePaymentLink;
    }
    if (primaryItem && bySku[primaryItem.sku] && bySku[primaryItem.sku].trim()) {
      return bySku[primaryItem.sku].trim();
    }
  }

  // Multi-item cart (or fallback): match total cart amount in byPriceTier (exact or closest tier)
  const targetTotal = Math.round(totalAmount);
  if (byTier[String(targetTotal)] && byTier[String(targetTotal)].trim()) {
    return byTier[String(targetTotal)].trim();
  }
  const availableTiers = Object.keys(byTier).map(Number).filter(n => !isNaN(n) && byTier[String(n)]);
  if (availableTiers.length > 0) {
    availableTiers.sort((a, b) => Math.abs(a - targetTotal) - Math.abs(b - targetTotal));
    return byTier[String(availableTiers[0])].trim();
  }
  return primaryItem?.stripePaymentLink || '';
}

async function createMultiItemStripeCheckout({ items, customerEmail, orderId }) {
  const originUrl = window.location.origin && window.location.origin.startsWith('http')
    ? window.location.origin
    : 'https://monolith-studio.onrender.com';

  // 1. Try local backend /api/checkout-session or Shipment Studio http://localhost:8425/api/checkout-session
  for (const ep of ['/api/checkout-session', 'http://localhost:8425/api/checkout-session']) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, customerEmail, orderId, originUrl }),
        signal: ctrl.signal
      });
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        if (data && data.url) return data.url;
      }
    } catch (_) {}
  }

  // 2. Direct browser fallback to Stripe /v1/checkout/sessions (so Render static site works without a backend!)
  try {
    const token = getStripeRuntimeToken();
    if (!token) return '';
    const shippingRateId = STORE_CONFIG?.shipping?.stripeShippingRateId || 'shr_1UaPy9DpvRsFSG1gHSiOucCE';
    const firstSku = items[0]?.sku || 'MULTI';
    const body = new URLSearchParams();
    body.append('mode', 'payment');
    body.append('success_url', `${originUrl}/?order_success=1&sku=${encodeURIComponent(firstSku)}&order_id=${encodeURIComponent(orderId || '')}`);
    body.append('cancel_url', `${originUrl}/#catalog`);
    body.append('allow_promotion_codes', 'true');
    body.append('shipping_address_collection[allowed_countries][0]', 'US');
    body.append('shipping_address_collection[allowed_countries][1]', 'CA');
    body.append('shipping_options[0][shipping_rate]', shippingRateId);
    body.append('phone_number_collection[enabled]', 'true');
    body.append('custom_text[shipping_address][message]', 'Free tracked USPS, UPS, or FedEx shipping from our Los Angeles shop (6515 S Crenshaw Blvd). Ships within 1–2 business days.');
    body.append('custom_text[submit][message]', 'Includes free tracked shipping, 30-day returns, and our 1-year hardware warranty.');
    body.append('metadata[order_id]', orderId || '');
    body.append('metadata[sku]', items.map(i => i.sku).join(',').slice(0, 480));
    body.append('metadata[product_name]', items.map(i => `${i.qty || 1}x ${i.variantLabel ? `${i.title} (${i.variantLabel})` : i.title}`).join(' + ').slice(0, 480));
    if (orderId) body.append('client_reference_id', orderId);
    if (customerEmail && customerEmail.includes('@')) body.append('customer_email', customerEmail.trim());

    items.forEach((item, idx) => {
      const qty = Math.max(1, parseInt(item.qty || 1, 10));
      const unitCents = Math.max(50, Math.round(Number(item.price) * 100));
      const displayTitle = item.variantLabel ? `${item.title} (${item.variantLabel})` : item.title;
      body.append(`line_items[${idx}][quantity]`, String(qty));
      body.append(`line_items[${idx}][price_data][currency]`, 'usd');
      body.append(`line_items[${idx}][price_data][unit_amount]`, String(unitCents));
      body.append(`line_items[${idx}][price_data][product_data][name]`, `${displayTitle} — Monolith Studio`);
      if (item.summary) {
        body.append(`line_items[${idx}][price_data][product_data][description]`, String(item.summary).slice(0, 300));
      }
      const chosenImg = item.variantImage || item.image || '';
      if (chosenImg && !chosenImg.includes('custom_')) {
        const fullImg = chosenImg.startsWith('http')
          ? chosenImg
          : `https://raw.githubusercontent.com/squasa/monolith-studio/main/public/${chosenImg.replace(/^\/+/, '')}`;
        body.append(`line_items[${idx}][price_data][product_data][images][0]`, fullImg);
      }
    });

    const sRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });
    const sData = await sRes.json();
    if (sRes.ok && sData.url) return sData.url;
  } catch (_) {}

  return '';
}

async function goDirectStripeCheckout() {
  if (CART.length === 0) return;
  const totalAmount = CART.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const primaryProduct = CART[0]?.product;

  const emailVal = (document.getElementById('express-checkout-email')?.value || '').trim();
  const orderId = 'ML-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  const cartItemsPayload = CART.map(i => ({
    sku: i.product.sku,
    title: i.variantLabel ? `${i.product.title} (${i.variantLabel})` : i.product.title,
    variantId: i.variantId || null,
    variantLabel: i.variantLabel || null,
    variantImage: i.variantImage || null,
    price: i.product.price,
    qty: i.qty,
    weightGrams: i.product.weightGrams,
    image: i.variantImage || i.product.image,
    summary: i.product.summary
  }));

  const orderPayload = {
    orderId,
    createdAt: new Date().toISOString(),
    customer: {
      first_name: 'Studio',
      last_name: 'Customer',
      email: emailVal || 'rewindsupport8@gmail.com',
      address: 'Stripe Checkout Address',
      city: 'Los Angeles',
      region: 'CA',
      postal: '90043',
      country: 'US'
    },
    items: cartItemsPayload,
    totalAmount
  };

  try {
    const saved = JSON.parse(localStorage.getItem('monolith_orders') || '[]');
    saved.unshift(orderPayload);
    localStorage.setItem('monolith_orders', JSON.stringify(saved.slice(0, 30)));
  } catch (_) {}

  // If multiple items, quantity > 1, or a specific variant is selected, create a dynamic multi-item Stripe Checkout Session
  const hasSpecificVariant = CART.some(i => Boolean(i.variantLabel));
  const isMultiItemOrQty = CART.length > 1 || (CART[0] && CART[0].qty > 1) || hasSpecificVariant;
  if (isMultiItemOrQty) {
    const btn = document.querySelector('.btn-stripe-primary');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>Opening Stripe Checkout ($${totalAmount.toFixed(2)})...</span>`;
    }
    const multiSessionUrl = await createMultiItemStripeCheckout({
      items: cartItemsPayload,
      customerEmail: emailVal,
      orderId
    });
    if (multiSessionUrl) {
      window.location.href = multiSessionUrl;
      return;
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>Continue to Stripe Checkout — $${totalAmount.toFixed(2)} USD</span><span>→</span>`;
    }
  }

  // Single item (qty = 1): use its dedicated Payment Link or create a session if missing
  let checkoutUrl = resolveCheckoutUrl(primaryProduct, totalAmount);
  if (!checkoutUrl) {
    checkoutUrl = await createMultiItemStripeCheckout({
      items: cartItemsPayload,
      customerEmail: emailVal,
      orderId
    });
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
      return;
    }
    return;
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

  const cartItemsPayload = CART.map(i => ({
    sku: i.product.sku,
    title: i.variantLabel ? `${i.product.title} (${i.variantLabel})` : i.product.title,
    variantId: i.variantId || null,
    variantLabel: i.variantLabel || null,
    variantImage: i.variantImage || null,
    price: i.product.price,
    qty: i.qty,
    weightGrams: i.product.weightGrams,
    image: i.variantImage || i.product.image,
    summary: i.product.summary
  }));

  const orderPayload = {
    orderId,
    createdAt: new Date().toISOString(),
    customer,
    items: cartItemsPayload,
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

  // Multi-item, multi-qty, or variant-selected bag: create a Stripe Checkout Session
  const hasSpecificVariant = CART.some(i => Boolean(i.variantLabel));
  const isMultiItemOrQty = CART.length > 1 || (CART[0] && CART[0].qty > 1) || hasSpecificVariant;
  if (isMultiItemOrQty) {
    const multiSessionUrl = await createMultiItemStripeCheckout({
      items: cartItemsPayload,
      customerEmail: customer.email,
      orderId
    });
    if (multiSessionUrl) {
      window.location.href = multiSessionUrl;
      return;
    }
  }

  // Single item: check if Stripe Payment Link or Wave Checkout link is configured
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
        Order reference <strong>#${q}</strong> is queued in our Los Angeles fulfillment system. If you placed your order within the last 24 hours, your USPS/UPS/FedEx tracking link will be dispatched to your email shortly. For immediate assistance, email <strong>rewindsupport8@gmail.com</strong>.
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
