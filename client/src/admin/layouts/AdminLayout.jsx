import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Receipt, Users, Package, Tag, Boxes, Truck, Scale, DollarSign,
  Globe, BellRing, ShieldCheck, Settings, ChevronRight, Factory, HandCoins, Store,
  BarChart3
} from 'lucide-react';

const nav = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard },
];

// Target business architecture from Prompt 12 — mapped to existing routes
const domains = [
  {
    title: 'SALES',
    items: [
      { label: 'Orders', href: '/admin/orders', icon: Receipt },
      { label: 'Customers', href: '/admin/customers', icon: Users },
      { label: 'Issue Receipts', href: '/admin/issue-receipts', icon: Receipt },
      { label: 'VIP & Invitations', href: '/admin/vip-invitations', icon: Receipt },
    ],
  },
  {
    title: 'PRODUCTS',
    items: [
      { label: 'Products', href: '/admin/products', icon: Package },
      { label: 'Categories', href: '/admin/categories', icon: Tag },
      { label: 'Brands', href: '/admin/brands', icon: Tag },
    ],
  },
  {
    title: 'PURCHASING',
    items: [
      { label: 'Suppliers', href: '/admin/suppliers', icon: Factory },
      { label: 'Purchase Orders', href: '/admin/purchase-orders', icon: HandCoins },
    ],
  },
  {
    title: 'INVENTORY',
    items: [
      { label: 'Stock Overview', href: '/admin/stock', icon: Boxes },
      { label: 'Movements', href: '/admin/movements', icon: Boxes },
      { label: 'Warehouses & Shelves', href: '/admin/warehouses', icon: Boxes },
      { label: 'Opening Balance', href: '/admin/opening-balance', icon: Boxes },
      { label: 'Stock In', href: '/admin/stock-in', icon: Boxes },
      { label: 'Stock Out', href: '/admin/stock-out', icon: Boxes },
    ],
  },
  {
    title: 'PRICING',
    items: [
      { label: 'Retail Pricing', href: '/admin/pricing', icon: Scale },
      { label: 'VIP Pricing', href: '/admin/vip-pricing', icon: Scale },
      { label: 'Price Lists', href: '/admin/price-lists', icon: Scale },
      { label: 'Pricing Insights', href: '/admin/profitability', icon: DollarSign },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Picking & Packing', href: '/admin/picking', icon: Truck },
      { label: 'Delivery', href: '/admin/deliveries', icon: Truck },
      { label: 'Returns', href: '/admin/returns', icon: Truck },
      { label: 'Refunds', href: '/admin/refunds', icon: DollarSign },
    ],
  },
  {
    title: 'FINANCE',
    items: [
      { label: 'Accounting', href: '/admin/finance', icon: DollarSign },
      { label: 'Financial Insights', href: '/admin/profitability', icon: DollarSign },
      { label: 'Financial Periods', href: '/admin/financial-periods', icon: Scale },
      { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
      { label: 'Payments & Reconciliation', href: '/admin/payments', icon: HandCoins },
    ],
  },
  {
    title: 'WEBSITE',
    items: [
      { label: 'Site Config', href: '/admin/site-config', icon: Globe },
      { label: 'Publishing', href: '/admin/publishing', icon: Globe },
    ],
  },
  {
    title: 'NOTIFICATIONS',
    items: [
      { label: 'Notifications', href: '/admin/notifications', icon: BellRing },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { label: 'Users & Roles', href: '/admin/users', icon: ShieldCheck },
      { label: 'Audit Log', href: '/admin/audit', icon: Settings },
      { label: 'Integrations', href: '/admin/integrations', icon: Settings },
      { label: 'Settings', href: '/admin/settings', icon: Settings },
      // QR Engine belongs conceptually here (platform capability)
      // Not shown as main tab — preserved in integrations
    ],
  },
];

// Utility actions (not business domains) — footer / topbar only
const utilities = [
  { label: 'View Store', href: '/store', external: true, note: 'Opens customer site' },
];

// Role-aware filter: only show permitted domain groups.
// For this phase the filter uses existing permissionService backend rule.
function filterByRole(domains, userRole) {
  // Admin sees all; employee roles see only permitted groups
  if (userRole === 'admin' || userRole === 'super_admin') return domains;
  // Simplified: show Sales/Inventory/Operations for warehouse; Pricing/Finance for accountant; etc.
  // Full granular filter uses backend permissions per Prompt 12.
  return domains.filter(d => {
    const allowed = {
      sales: ['SALES'],
      warehouse: ['INVENTORY', 'OPERATIONS', 'SALES'],
      accountant: ['FINANCE', 'PRICING', 'OVERVIEW'],
      procurement: ['PURCHASING', 'PRODUCTS', 'INVENTORY'],
      driver: ['OPERATIONS'],
      website: ['WEBSITE', 'OVERVIEW'],
    };
    const roleKey = (userRole || '').toLowerCase().replace(/\s/g, '_');
    const permitted = allowed[roleKey] || allowed.admin || [];
    return permitted.includes(d.title);
  });
}

export default function AdminLayout() {
  const { pathname } = useLocation();
  const { permissions, loading, isAdmin } = useAdminAuth();
  // Real permission-aware sidebar: filter by current user permissions
  // userPerms is now provided by AdminAuthContext (useAdminAuth)
  const visibleDomains = (loading || !permissions) ? [] : (permissions.includes("*") ? domains : domains.filter(d => d.items.some(i => { const p = (i.href || "").split("/").pop() || i.label.toLowerCase().replace(/s/g,"_"); return !!(permissions.find(per => per.includes(p) || p.includes(per)) || p === "overview"); })));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        {loading ? (
          <div className="p-6 text-xs text-slate-500">Loading permissions...</div>
        ) : null}
        <div className="p-6">
          <div className="text-amber-400 font-extrabold text-xl tracking-tight">Comfort Sign</div>
          <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">Admin Panel</div>
        </div>
        <nav className="flex-1 px-3 space-y-6 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-4 text-xs text-slate-500">Loading permissions...</div>
          ) : (
            <>
              <Link to="/admin" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${pathname === '/admin' || pathname === '/admin/' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}>
                <LayoutDashboard size={18} /> Overview
              </Link>
              {visibleDomains.map((d) => (
            <div key={d.title}>
              <div className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{d.title}</div>
              <div className="space-y-0.5">
                {d.items.map((n) => {
                  const Icon = n.icon;
                  const active = pathname === n.href || pathname.startsWith(n.href + '/');
                  return (
                    <Link key={n.href} to={n.href} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${active ? 'bg-amber-500/10 text-amber-400' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}`}>
                      <Icon size={16} /> {n.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        </nav>
        {/* Utilities — not business domains */}
        <div className="p-3 border-t border-slate-800">
          <a href="http://localhost:5173" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-amber-400 transition">
            <Store size={14} /> View Store <ChevronRight size={12} />
          </a>
        </div>
        <div className="p-4 text-xs text-slate-500">v1.0 — Node Stack · Admin</div>
      </aside>
      {/* Main */}
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur border-b border-slate-800 px-6 py-3 flex items-center justify-between">
          <h1 className="font-bold text-lg text-slate-100">Admin — Business Domain Workspace</h1>
          <div className="text-xs text-slate-400">Port 5174 · Backend 5172</div>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
