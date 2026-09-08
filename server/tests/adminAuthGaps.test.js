/**
 * Admin auth-gap locks — mventor-ticket-068.
 * Every route in adminAI + recommendations must carry the adminAuth handle.
 * Pure router-stack inspection (no HTTP, no DB writes); fails loudly if a
 * future route is added to these routers without auth.
 */
const adminAuth = require('../middleware/adminAuth');
const adminAI = require('../routes/adminAI');
const recommendations = require('../routes/recommendations');

function routesOf(router) {
  return router.stack
    .filter(l => l.route)
    .map(l => ({ path: l.route.path, methods: Object.keys(l.route.methods), handles: l.route.stack.map(s => s.handle) }));
}

describe('admin auth gaps (068)', () => {
  test('adminAI exposes 5 routes, all behind adminAuth', () => {
    const routes = routesOf(adminAI);
    expect(routes.length).toBe(5);
    for (const r of routes) {
      expect(r.handles).toContain(adminAuth);
    }
  });
  test('adminAI mutations additionally require a permission layer', () => {
    const byKey = Object.fromEntries(routesOf(adminAI).map(r => [`${r.methods[0].toUpperCase()} ${r.path}`, r]));
    expect(byKey['POST /models/select'].handles.length).toBeGreaterThanOrEqual(3);
    expect(byKey['PUT /settings'].handles.length).toBeGreaterThanOrEqual(3);
  });
  test('recommendations single route behind adminAuth', () => {
    const routes = routesOf(recommendations);
    expect(routes.length).toBe(1);
    expect(routes[0].handles).toContain(adminAuth);
  });
  test('adminAuth itself 401s without a session', () => {
    const res = { statusCode: 0, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    let nexted = false;
    adminAuth({ session: {} }, res, () => { nexted = true; });
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(401);
  });
});
