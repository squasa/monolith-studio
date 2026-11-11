const express = require('express');
const fs = require('fs');
const path = require('path');
const catalogService = require('./catalog_sync_service');

const app = express();
const PORT = parseInt(process.env.PORT || '3030', 10);

app.use(express.json({ limit: '15mb' }));

// CORS headers for local studio integration
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Dynamic /config/store-config.json route
app.get('/config/store-config.json', async (req, res) => {
  try {
    const cfg = await catalogService.readCatalogConfigLive();
    res.json(cfg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Catalog & Price Manager API endpoints
app.get('/api/catalog', async (req, res) => {
  try {
    const config = await catalogService.readCatalogConfigLive();
    res.json({ ok: true, config });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/catalog/price', async (req, res) => {
  try {
    const result = await catalogService.updateItemPrice(req.body || {});
    res.json(result);
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post('/api/catalog/item', async (req, res) => {
  try {
    const result = await catalogService.upsertCatalogItem(req.body || {});
    res.json(result);
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.delete('/api/catalog/item', async (req, res) => {
  try {
    const result = await catalogService.deleteCatalogItem(req.body || {});
    res.json(result);
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post('/api/catalog/deploy', (req, res) => {
  try {
    const result = catalogService.deployCatalogToGitHub();
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Multi-item Stripe Checkout Session creator
app.post('/api/checkout-session', async (req, res) => {
  try {
    const result = await catalogService.createMultiItemCheckoutSession(req.body || {});
    res.json(result);
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Separate Admin Panel / Catalog & Ship Manager routes
app.get(['/manage', '/admin', '/admin.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manage.html'));
});

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// In-memory + file order log
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const SHIPMENT_STUDIO_URL = process.env.SHIPMENT_STUDIO_URL || 'http://localhost:8425';

app.post('/api/orders', async (req, res) => {
  try {
    const order = req.body;
    let existing = [];
    if (fs.existsSync(ORDERS_FILE)) {
      existing = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    }
    existing.unshift(order);
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(existing.slice(0, 200), null, 2));

    // Forward order to Local Shipment Studio (http://localhost:8425/api/orders) if running
    try {
      await fetch(`${SHIPMENT_STUDIO_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
    } catch (_) {}

    res.json({ ok: true, orderId: order.orderId });
  } catch (e) {
    res.json({ ok: true });
  }
});

app.get('/api/shipments/track', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ found: false });

  try {
    const studioRes = await fetch(`${SHIPMENT_STUDIO_URL}/api/shipments/track?q=${encodeURIComponent(q)}`);
    if (studioRes.ok) {
      const data = await studioRes.json();
      return res.json(data);
    }
  } catch (_) {}

  return res.status(404).json({ found: false });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', store: 'Monolith Studio Co.' });
});

// Clean SPA policy & tracking routes
const spaRoutes = ['/terms', '/returns', '/shipping', '/privacy', '/contact', '/track'];
for (const route of spaRoutes) {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[Monolith Studio Co.] Storefront live at http://localhost:${PORT}`);
});
