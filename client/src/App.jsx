import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import { getPublicSetting } from './api/settings';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AIAssistant from './components/AIAssistant';
import WishlistDrawer from './components/WishlistDrawer';
import CartToast from './components/CartToast';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DeviceProvider } from './context/DeviceContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { WishlistProvider } from './context/WishlistContext';
import { LanguageProvider } from './i18n';

/* Admin routes moved to client-admin (5174); Customer App (5173) remains isolated */
const WelcomePage = lazy(() => import('./pages/WelcomePage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const SuccessPage = lazy(() => import('./pages/SuccessPage'));
const CancelPage = lazy(() => import('./pages/CancelPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const OrderTrackerPage = lazy(() => import('./pages/OrderTrackerPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

/* Layout wrapper for public pages (navbar + footer) */
function PublicLayout() {
  return (
    <>
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

/* Layout wrapper for welcome page (no navbar/footer) */
function WelcomeLayout() {
  return <Outlet />;
}

function App() {
  // Brand truth: browser tab title + favicon follow Site Config → Brand & Identity
  useEffect(() => {
    getPublicSetting('store_name', '').then(name => { if (name) document.title = name; }).catch(() => {});
    getPublicSetting('site_logo_url', '').then(url => {
      const link = document.querySelector("link[rel~='icon']");
      if (url) {
        let l = link;
        if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); }
        // cache-buster so a replaced logo is picked up immediately
        l.href = url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now();
      } else if (link) {
        link.remove(); // no logo configured — show no tab icon at all
      }
    }).catch(() => {});
  }, []);
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
        <CurrencyProvider>
          <DeviceProvider>
            <AuthProvider>
              <WishlistProvider>
            <div className="flex flex-col min-h-screen dark:bg-dark-950 dark:text-gray-100">
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* ── Welcome page (no navbar/footer) ── */}
                  <Route element={<WelcomeLayout />}>
                    <Route path="/" element={<WelcomePage />} />
                  </Route>

                  {/* ── Public pages (with navbar + footer) ── */}
                  <Route element={<PublicLayout />}>
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/products" element={<ProductsPage />} />
                    <Route path="/products/:id" element={<ProductDetailPage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/checkout/success" element={<SuccessPage />} />
                    <Route path="/checkout/cancel" element={<CancelPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="/track-orders" element={<OrderTrackerPage />} />
                    <Route path="/account/verify" element={<OnboardingPage />} />
                  </Route>

                  {/* Admin routes served by client-admin (5174); Customer (5173) isolated */}

                </Routes>
              </Suspense>

              {/* Global floating AI assistant — visible on every page */}
              <AIAssistant />

              {/* Global wishlist drawer */}
              <WishlistDrawer />

              {/* Added-to-cart toast (amount + View Cart) */}
              <CartToast />
            </div>
              </WishlistProvider>
            </AuthProvider>
          </DeviceProvider>
        </CurrencyProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
