import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';

// Eager load: Login and Layout (needed immediately)
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './admin/AdminLayout';

// Lazy load all admin pages for code splitting
const Overview = lazy(() => import('./admin/pages/Overview'));
const DashboardDetailPage = lazy(() => import('./admin/pages/DashboardDetailPage'));
const RevenueDetail = lazy(() => import('./admin/pages/RevenueDetail'));
const ProductsList = lazy(() => import('./admin/pages/ProductsList'));
const KashierPage = lazy(() => import('./admin/pages/KashierPage'));
const ProductsTrash = lazy(() => import('./admin/pages/ProductsTrash'));
const CategoriesList = lazy(() => import('./admin/pages/CategoriesList'));
const BrandsList = lazy(() => import('./admin/pages/BrandsList'));
const OrdersList = lazy(() => import('./admin/pages/OrdersList'));
const FeaturedList = lazy(() => import('./admin/pages/FeaturedList'));
const InventoryDashboard = lazy(() => import('./admin/pages/InventoryDashboard'));
const MovementsList = lazy(() => import('./admin/pages/MovementsList'));
const ProductForm = lazy(() => import('./admin/pages/ProductForm'));
const WarehousesList = lazy(() => import('./admin/pages/WarehousesList'));
const SupplyOrdersList = lazy(() => import('./admin/pages/SupplyOrdersList'));
const IssueOrdersList = lazy(() => import('./admin/pages/IssueOrdersList'));
const FinancialPeriods = lazy(() => import('./admin/pages/FinancialPeriods'));
const PriceLists = lazy(() => import('./admin/pages/PriceLists'));
const PackingDashboard = lazy(() => import('./admin/pages/PackingDashboard'));
const ShippingDashboard = lazy(() => import('./admin/pages/ShippingDashboard'));
const CustomersList = lazy(() => import('./admin/pages/CustomersList'));
const CustomerProfile = lazy(() => import('./admin/pages/CustomerProfile'));
const CategoryView = lazy(() => import('./admin/pages/CategoryView'));
const SuppliersList = lazy(() => import('./admin/pages/SuppliersList'));
const SupplierDetail = lazy(() => import('./admin/pages/SupplierDetail'));
const PurchaseOrdersList = lazy(() => import('./admin/pages/PurchaseOrdersList'));
const ReportsDashboard = lazy(() => import('./admin/pages/ReportsDashboard'));
const SettingsPage = lazy(() => import('./admin/pages/SettingsPage'));
const IntegrationsPage = lazy(() => import('./admin/pages/IntegrationsPage'));
const EventsList = lazy(() => import('./admin/pages/EventsList'));
const UsersList = lazy(() => import('./admin/pages/UsersList'));
const PricingEngine = lazy(() => import('./admin/pages/PricingEngine'));
const PricingProfit = lazy(() => import('./admin/pages/PricingProfit'));
const NotificationsPage = lazy(() => import('./admin/pages/NotificationsPage'));
const SiteConfig = lazy(() => import('./admin/pages/SiteConfig'));
const PickingDashboard = lazy(() => import('./admin/pages/PickingDashboard'));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading page...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <div className="flex flex-col min-h-screen">
        <Routes>
        {/* Admin login (standalone, no sidebar) */}
        <Route path="/" element={<AdminLogin />} />

        {/* Admin dashboard (modular layout with sidebar) */}
        <Route element={<AdminLayout />}>
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<PageLoader />}>
                <Overview />
              </Suspense>
            }
          />
          <Route
            path="/pricing-engine"
            element={
              <Suspense fallback={<PageLoader />}>
                <PricingEngine />
              </Suspense>
            }
          />
          <Route
            path="/pricing-engine/profits"
            element={
              <Suspense fallback={<PageLoader />}>
                <PricingProfit />
              </Suspense>
            }
          />
          <Route
            path="/dashboard-detail/revenue"
            element={
              <Suspense fallback={<PageLoader />}>
                <RevenueDetail />
              </Suspense>
            }
          />
          <Route
            path="/dashboard-detail/:metric"
            element={
              <Suspense fallback={<PageLoader />}>
                <DashboardDetailPage />
              </Suspense>
            }
          />
          <Route
            path="/products"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProductsList />
              </Suspense>
            }
          />
          <Route
            path="/products/trash"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProductsTrash />
              </Suspense>
            }
          />
          <Route
            path="/products/new"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProductForm />
              </Suspense>
            }
          />
          <Route
            path="/products/:id/edit"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProductForm />
              </Suspense>
            }
          />
          <Route
            path="/featured"
            element={
              <Suspense fallback={<PageLoader />}>
                <FeaturedList />
              </Suspense>
            }
          />
          <Route
            path="/categories"
            element={
              <Suspense fallback={<PageLoader />}>
                <CategoriesList />
              </Suspense>
            }
          />
          <Route
            path="/categories/:id"
            element={
              <Suspense fallback={<PageLoader />}>
                <CategoryView />
              </Suspense>
            }
          />
          <Route
            path="/brands"
            element={
              <Suspense fallback={<PageLoader />}>
                <BrandsList />
              </Suspense>
            }
          />
          <Route
            path="/orders"
            element={
              <Suspense fallback={<PageLoader />}>
                <OrdersList />
              </Suspense>
            }
          />

          {/* ERP Routes — Inventory */}
          <Route
            path="/inventory"
            element={
              <Suspense fallback={<PageLoader />}>
                <InventoryDashboard />
              </Suspense>
            }
          />
          <Route
            path="/inventory/movement"
            element={
              <Suspense fallback={<PageLoader />}>
                <MovementsList />
              </Suspense>
            }
          />
          <Route
            path="/inventory/warehouses"
            element={
              <Suspense fallback={<PageLoader />}>
                <WarehousesList />
              </Suspense>
            }
          />
          <Route
            path="/erp/supply-orders"
            element={
              <Suspense fallback={<PageLoader />}>
                <SupplyOrdersList />
              </Suspense>
            }
          />
          <Route
            path="/erp/issue-orders"
            element={
              <Suspense fallback={<PageLoader />}>
                <IssueOrdersList />
              </Suspense>
            }
          />
          <Route
            path="/erp/financial-periods"
            element={
              <Suspense fallback={<PageLoader />}>
                <FinancialPeriods />
              </Suspense>
            }
          />
          <Route
            path="/erp/price-lists"
            element={
              <Suspense fallback={<PageLoader />}>
                <PriceLists />
              </Suspense>
            }
          />
          <Route
            path="/erp/packing"
            element={
              <Suspense fallback={<PageLoader />}>
                <PackingDashboard />
              </Suspense>
            }
          />
          <Route
            path="/erp/picking"
            element={
              <Suspense fallback={<PageLoader />}>
                <PickingDashboard />
              </Suspense>
            }
          />
          <Route
            path="/erp/shipping"
            element={
              <Suspense fallback={<PageLoader />}>
                <ShippingDashboard />
              </Suspense>
            }
          />
          <Route
            path="/erp/customers"
            element={
              <Suspense fallback={<PageLoader />}>
                <CustomersList />
              </Suspense>
            }
          />
          <Route
            path="/erp/customers/:id"
            element={
              <Suspense fallback={<PageLoader />}><CustomerProfile /></Suspense>
            }
          />
          {/* ERP Routes — Remaining Modules */}
          <Route
            path="/erp/suppliers"
            element={
              <Suspense fallback={<PageLoader />}>
                <SuppliersList />
              </Suspense>
            }
          />
          <Route
            path="/erp/suppliers/:id"
            element={
              <Suspense fallback={<PageLoader />}>
                <SupplierDetail />
              </Suspense>
            }
          />
          <Route
            path="/erp/purchase-orders"
            element={
              <Suspense fallback={<PageLoader />}>
                <PurchaseOrdersList />
              </Suspense>
            }
          />
          <Route
            path="/erp/reports"
            element={
              <Suspense fallback={<PageLoader />}>
                <ReportsDashboard />
              </Suspense>
            }
          />
          <Route
            path="/erp/kashier"
            element={
              <Suspense fallback={<PageLoader />}>
                <KashierPage />
              </Suspense>
            }
          />
          <Route
            path="/erp/settings"
            element={
              <Suspense fallback={<PageLoader />}>
                <SettingsPage />
              </Suspense>
            }
          />
          <Route
            path="/erp/integrations"
            element={
              <Suspense fallback={<PageLoader />}>
                <IntegrationsPage />
              </Suspense>
            }
          />
          <Route
            path="/erp/events"
            element={
              <Suspense fallback={<PageLoader />}>
                <EventsList />
              </Suspense>
            }
          />
          <Route
            path="/erp/users"
            element={
              <Suspense fallback={<PageLoader />}>
                <UsersList />
              </Suspense>
            }
          />
          <Route
            path="/erp/notifications"
            element={
              <Suspense fallback={<PageLoader />}>
                <NotificationsPage />
              </Suspense>
            }
          />

          {/* Site Config (homepage · AI · announcements · hero · welcome slides) */}
          <Route
            path="/site-config"
            element={
              <Suspense fallback={<PageLoader />}>
                <SiteConfig />
              </Suspense>
            }
          />
          <Route
            path="/site-config/:tab"
            element={
              <Suspense fallback={<PageLoader />}>
                <SiteConfig />
              </Suspense>
            }
          />
          <Route
            path="*"
            element={
              <div className="p-12 text-center">
                <h1 className="text-2xl font-bold text-gray-900">404</h1>
                <p className="text-sm text-gray-500 mt-2">Page not found</p>
              </div>
            }
          />
        </Route>
      </Routes>
    </div>
  </ErrorBoundary>
  );
}

export default App;
