import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Store, QrCode, Package, Palette, BarChart3, ArrowLeft, Menu, X } from 'lucide-react';
import { getStoreProfile } from '@/lib/db';

const navLinks = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/admin/profil', label: 'Profil Toko', icon: Store },
  { to: '/admin/qris', label: 'QRIS', icon: QrCode },
  { to: '/admin/produk', label: 'Produk', icon: Package },
  { to: '/admin/tema', label: 'Tema', icon: Palette },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [storeProfile, setStoreProfile] = useState<{ storeName?: string; logo?: string } | null>(null);
  const location = useLocation();

  useEffect(() => {
    getStoreProfile().then((profile) => {
      if (profile) {
        setStoreProfile(profile);
      }
    });
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-white/10
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="flex items-center justify-between p-5 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              {storeProfile?.logo ? (
                <img
                  src={storeProfile.logo}
                  alt="Logo"
                  className="w-10 h-10 rounded-xl object-contain bg-white/5 p-1 flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Store className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-white font-bold text-sm truncate">{storeProfile?.storeName || 'Kasir Lokal'}</h2>
                <p className="text-slate-400 text-xs">Panel Admin</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer group ${
                    isActive
                      ? 'bg-[hsl(var(--primary))] text-white shadow-lg shadow-[hsl(var(--primary))]/25'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <link.icon className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
                <span>{link.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Back to home */}
          <div className="p-3 border-t border-white/10">
            <NavLink
              to="/"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200 cursor-pointer group"
            >
              <ArrowLeft className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:-translate-x-1" />
              <span>Kembali ke Kasir</span>
            </NavLink>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-white font-semibold text-sm">{storeProfile?.storeName || 'Kasir Lokal'}</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
