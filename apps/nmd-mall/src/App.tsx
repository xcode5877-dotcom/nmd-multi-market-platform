import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, ToastProvider } from '@nmd/ui';

const LandingLayout = lazy(() => import('./layouts/LandingLayout'));
const MarketLayout = lazy(() => import('./layouts/MarketLayout'));
const MarketsPickerPage = lazy(() => import('./pages/MarketsPickerPage'));
const MarketHomePage = lazy(() => import('./pages/MarketHomePage'));
const MarketPage = lazy(() => import('./pages/MarketPage'));
const StoresPage = lazy(() => import('./pages/StoresPage'));
const OffersPage = lazy(() => import('./pages/OffersPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const JoinPage = lazy(() => import('./pages/JoinPage'));
const StorePreviewPage = lazy(() => import('./pages/StorePreviewPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));

const DEFAULT_BRANDING = {
  logoUrl: '/favicon.svg',
  primaryColor: '#7C3AED',
  secondaryColor: '#14B8A6',
  fontFamily: '"Cairo", system-ui, sans-serif',
  radiusScale: 1,
  layoutStyle: 'default' as const,
};

export default function App() {
  return (
    <ThemeProvider branding={DEFAULT_BRANDING} dir="rtl">
      <ToastProvider>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/" element={<Navigate to="/markets" replace />} />
            <Route path="/markets" element={<LandingLayout />}>
              <Route index element={<MarketsPickerPage />} />
            </Route>
            <Route path="/m/:marketSlug" element={<MarketLayout />}>
              <Route index element={<MarketHomePage />} />
              <Route path="market" element={<MarketPage />} />
            </Route>
            <Route path="/legacy" element={<LandingLayout />}>
              <Route path="stores" element={<StoresPage />} />
              <Route path="stores/store/:slug" element={<StorePreviewPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="offers" element={<OffersPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="join" element={<JoinPage />} />
            </Route>
          </Routes>
        </Suspense>
      </ToastProvider>
    </ThemeProvider>
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="grid gap-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
