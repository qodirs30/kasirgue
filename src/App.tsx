import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/lib/theme';
import LandingPage from '@/pages/LandingPage';
import AdminLayout from '@/pages/admin/AdminLayout';
import StoreProfilePage from '@/pages/admin/StoreProfilePage';
import QRISPage from '@/pages/admin/QRISPage';
import ThemePage from '@/pages/admin/ThemePage';
import ProductsPage from '@/pages/admin/ProductsPage';
import DashboardPage from '@/pages/admin/DashboardPage';
import CashierPage from '@/pages/cashier/CashierPage';

function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="profil" element={<StoreProfilePage />} />
              <Route path="qris" element={<QRISPage />} />
              <Route path="tema" element={<ThemePage />} />
              <Route path="produk" element={<ProductsPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
            </Route>
            <Route path="/kasir" element={<CashierPage />} />
          </Routes>
        </HashRouter>
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
