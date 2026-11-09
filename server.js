const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT || '3030', 10);

app.use(express.json());

// Dynamic /config/store-config.json route that overlays WAVE_LINK_* env vars if set
app.get('/config/store-config.json', (req, res) => {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'public', 'config', 'store-config.json'), 'utf8');
    const cfg = JSON.parse(raw);

    const tiers = ['20', '30', '40', '50', '60', '70', '80', '90', '120', '150'];
    for (const t of tiers) {
      if (process.env[`WAVE_LINK_${t}`]) {
        cfg.waveCheckoutLinks.byPriceTier[t] = process.env[`WAVE_LINK_${t}`];
      }
    }
    res.json(cfg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// In-memory + file order log
const ORDERS_FILE = path.join(__dirname, 'orders.json');
app.post('/api/orders', (req, res) => {
  try {
    const order = req.body;
    let existing = [];
    if (fs.existsSync(ORDERS_FILE)) {
      existing = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    }
    existing.unshift(order);
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(existing.slice(0, 200), null, 2));
    res.json({ ok: true, orderId: order.orderId });
  } catch (e) {
    res.json({ ok: true });
  }
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
