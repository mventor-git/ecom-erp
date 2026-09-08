/**
 * Advisory Recommendation Engine (Phase 60 — advisory only, NOT orders)
 * Read-only endpoint: uses pricingManager + inventory_movements + products.
 * Returns forecasts clearly labeled; offers 0/5/10/15% advisory only.
 * Zero destructive DB mutations.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const pricing = require('../routes/pricingManager');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');

router.get('/', adminAuth, requirePermission('reports.read'), async (req, res) => {
  try {
    // Read-only advisory forecasts — no mutations, no order changes
    const products = db.prepare('SELECT id, name, price, cost_price, sale_price_list FROM products WHERE deleted_at IS NULL').all();
    const movements = db.prepare('SELECT product_id, SUM(qty_change) as qty FROM inventory_movements GROUP BY product_id').all();
    const qtyMap = {};
    movements.forEach(m => qtyMap[m.product_id] = m.qty);

    const recommendations = products.map(p => {
      const qty = qtyMap[p.id] || 0;
      const retail = p.price || 0;
      const wholesale = p.cost_price || 0;
      const profitMargin = retail > wholesale ? ((retail - wholesale) / retail) : 0;
      const advisoryOffers = [0, 5, 10, 15]; // advisory discount % only
      return {
        product_id: p.id,
        name: p.name,
        current_price: retail,
        cost_price: wholesale,
        inventory_qty: qty,
        advisory_forecast: {
          label: 'ADVISORY (not an order change)', // clearly labeled
          profit_margin_pct: Math.round(profitMargin * 100),
          recommended_offer_pct: profitMargin > 0.25 ? 5 : profitMargin > 0.1 ? 10 : 0,
          advisory_offers: advisoryOffers,
        },
        mock_note: 'Recommendation endpoint advisory only — no automatic price/order mutation',
      };
    });
    res.json({ advisory: true, recommendations, note: 'Forecast labels clearly shown — NOT orders' });
  } catch (err) {
    res.status(500).json({ error: err.message, advisory: true });
  }
});

module.exports = router;
