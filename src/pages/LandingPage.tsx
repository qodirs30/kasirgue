import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShoppingCart, AlertTriangle, Download, Upload, Lock } from 'lucide-react';
import { getLowStockProducts, getStoreProfile, type StoreProfile } from '@/lib/db';
import { exportAllData, importAllData } from '@/lib/export-import';
import { toast } from 'sonner';
import { LiquidButton } from '@/components/ui/liquid-glass-button';

export default function LandingPage() {
  const [lowStockCount, setLowStockCount] = useState(0);
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  
  // Password validation state
  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('pos_authenticated') === 'true';
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  const [showDonationPopup, setShowDonationPopup] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);

  useEffect(() => {
    getLowStockProducts(5).then(items => setLowStockCount(items.length));
    getStoreProfile().then(p => { if (p) setProfile(p); });
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const now = Date.now();

      // 1. Check license status (pop-up suppression)
      const licenseExpiry = Number(localStorage.getItem('qodir_license_unlocked_until') || '0');
      const isLicensed = now < licenseExpiry;

      if (!isLicensed) {
        // Check if 3 days have passed since last popup
        const lastDonationPopup = localStorage.getItem('qodir_last_donation_popup');
        const threeDays = 3 * 24 * 60 * 60 * 1000;
        if (!lastDonationPopup || (now - Number(lastDonationPopup)) > threeDays) {
          // Trigger donation popup after 1.5 seconds delay
          const timer = setTimeout(() => {
            setShowDonationPopup(true);
          }, 1500);
          return () => clearTimeout(timer);
        }
      }

      // 2. Check backup reminder (if donation is not showing)
      const lastBackup = localStorage.getItem('last_backup_time');
      const oneDay = 24 * 60 * 60 * 1000;
      if (!lastBackup || (now - Number(lastBackup)) > oneDay) {
        const timer = setTimeout(() => {
          // Only show backup reminder if donation popup is NOT active
          const lastDonationPopup = localStorage.getItem('qodir_last_donation_popup');
          const threeDays = 3 * 24 * 60 * 60 * 1000;
          if (now < licenseExpiry || !(!lastDonationPopup || (now - Number(lastDonationPopup)) > threeDays)) {
            setShowBackupReminder(true);
          }
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [isAuthenticated]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'qodirs') {
      setIsAuthenticated(true);
      sessionStorage.setItem('pos_authenticated', 'true');
      toast.success('Akses diterima, selamat datang!');
    } else {
      toast.error('Password salah!');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importAllData(file);
    if (result.success) {
      toast.success(result.message);
      window.location.reload();
    } else {
      toast.error(result.message);
    }
    e.target.value = '';
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // ── Password Screen ────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Animated background orbs */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 w-full max-w-md p-8 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Akses Terkunci</h2>
          <p className="text-slate-400 text-sm mb-6">Silakan traktir Mas Qodir kopi untuk mendapatkan password akses.</p>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="Masukkan password..."
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full bg-slate-800/80 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-white placeholder-slate-500 text-center outline-none transition-all"
              autoFocus
            />
            <LiquidButton
              type="submit"
              variant="primary"
              size="lg"
              className="w-full py-2.5 font-bold cursor-pointer"
            >
              Masuk
            </LiquidButton>
          </form>

          <div className="mt-6 border-t border-white/10 pt-6">
            <p className="text-xs text-slate-500 mb-3">Lupa atau tidak tahu password?</p>
            <a
              href="https://wa.me/6282224000513?text=Halo%20Mas%20Qodir,%20minta%20password%20aplikasi%20kasir%20dong"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50 text-emerald-400 font-semibold rounded-lg text-sm transition-all"
            >
              Hubungi Qodirs
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Landing Screen ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl" />

      {/* Logo & Title */}
      <div className="relative z-10 text-center mb-12 animate-fade-in">
        {profile?.logo ? (
          <img src={profile.logo} alt="Logo" className="w-24 h-24 mx-auto mb-4 rounded-2xl shadow-2xl shadow-indigo-500/30 object-contain bg-white/10 p-2" />
        ) : (
          <img src="/logo.svg" alt="Logo" className="w-24 h-24 mx-auto mb-4 rounded-2xl shadow-2xl shadow-indigo-500/30 object-contain bg-slate-900/50 border border-white/10 p-2" />
        )}
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">
          {profile?.storeName || 'Kasir Gue'}
        </h1>
        <p className="text-slate-400 text-lg">Sistem Kasir Lokal</p>
      </div>

      {/* Navigation Cards */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mb-8">
        {/* Admin Card */}
        <Link
          to="/admin"
          className="group relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 transition-all duration-500 hover:bg-white/10 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/20 hover:-translate-y-1"
        >
          {lowStockCount > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-bounce">
              {lowStockCount}
            </div>
          )}
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Admin</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Kelola profil toko, produk, lihat analisa penjualan & laporan keuangan
          </p>
          {lowStockCount > 0 && (
            <div className="mt-3 flex items-center gap-2 text-amber-400 text-xs">
              <AlertTriangle className="w-3 h-3" />
              <span>{lowStockCount} produk stok menipis</span>
            </div>
          )}
        </Link>

        {/* Cashier Card */}
        <Link
          to="/kasir"
          className="group relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 transition-all duration-500 hover:bg-white/10 hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/20 hover:-translate-y-1"
        >
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-cyan-500/30">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Kasir</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Mulai transaksi, kelola keranjang belanja, proses pembayaran & cetak struk
          </p>
        </Link>
      </div>

      {/* Data Management */}
      <div className="relative z-10 flex gap-4">
        <LiquidButton
          variant="outline"
          size="lg"
          onClick={() => { exportAllData(); toast.success('Data berhasil di-export!'); }}
          className="text-white border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/10 cursor-pointer animate-fade-in"
        >
          <span className="flex items-center gap-2">
            <Download className="w-4 h-4 text-indigo-400" />
            Export Data
          </span>
        </LiquidButton>
        <LiquidButton
          variant="outline"
          size="lg"
          onClick={triggerFileInput}
          className="text-white border border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/10 cursor-pointer animate-fade-in"
        >
          <span className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-cyan-400" />
            Import Data
          </span>
        </LiquidButton>
        <input
          type="file"
          ref={fileInputRef}
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-12 text-center text-slate-600 text-xs">
        <p>100% Lokal · Data tersimpan di browser</p>
      </div>

      {/* ── Modal Pop-up: Traktir Kopi Qodir (Donation) ── */}
      {showDonationPopup && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <span className="text-2xl">☕</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Traktir Kopi Bos!</h3>
            <p className="text-slate-300 text-xs leading-relaxed mb-5">
              Halo bos! Web Kasir Lokal ini bermanfaat banget kan? Bikin sistem handal kayak gini pusing lho, apalagi tiap tahun Mas Qodir harus perpanjang sewa domain biar tetap online. Kalau web ini membantu kelancaran bisnismu, yuk dukung kelangsungan sistem dengan traktir kopi susu Mas Qodir!
            </p>

            {/* QRIS Code Image */}
            <div className="bg-white p-3 rounded-xl inline-block mb-5 shadow-lg max-w-[200px]">
              <img
                src="/qris_qodirs.jpeg"
                alt="QRIS Qodirs"
                className="w-full h-auto object-contain rounded-lg"
              />
              <p className="text-[9px] text-slate-800 font-bold mt-1 font-sans">QRIS: QODIR</p>
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <LiquidButton
                  onClick={() => {
                    localStorage.setItem('qodir_last_donation_popup', Date.now().toString());
                    setShowDonationPopup(false);
                    toast.info('Siap bos! Diingatkan lagi 3 hari kemudian ya.');
                  }}
                  variant="default"
                  size="default"
                  className="w-full py-2.5 font-medium text-xs cursor-pointer animate-fade-in"
                >
                  Maaf, skip dulu
                </LiquidButton>
                
                <a
                  href="https://wa.me/6282224000513?text=Halo%20Mas%20Qodir,%20gw%20udah%20traktir%20kopi%20nih!%20Minta%20PIN%20aktivasi%20Web%20Kasir%20Lokal%20dong"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowPinInput(true)}
                  className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50 text-emerald-400 font-semibold rounded-full text-xs transition-all duration-200"
                >
                  Sudah gw traktir
                </a>
              </div>

              {/* Pin entry box appears when they click already treated */}
              {showPinInput && (
                <div className="mt-4 p-4 border border-white/5 bg-slate-800/50 rounded-xl space-y-2 animate-in slide-in-from-top-4 duration-200 text-left">
                  <p className="text-slate-300 text-[10px]">Masukkan PIN aktivasi yang dikirim Mas Qodir:</p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Masukkan PIN 6 digit..."
                      value={pinInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPinInput(val);
                        if (val === '020899') {
                          const nextYear = Date.now() + 365 * 24 * 60 * 60 * 1000;
                          localStorage.setItem('qodir_license_unlocked_until', nextYear.toString());
                          setShowDonationPopup(false);
                          setShowPinInput(false);
                          setPinInput('');
                          toast.success('Terima kasih banyak bos! Lisensi premium aktif selama 1 tahun bebas pop-up.');
                        }
                      }}
                      className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-600 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                    <LiquidButton
                      onClick={() => {
                        if (pinInput === '020899') {
                          const nextYear = Date.now() + 365 * 24 * 60 * 60 * 1000;
                          localStorage.setItem('qodir_license_unlocked_until', nextYear.toString());
                          setShowDonationPopup(false);
                          setShowPinInput(false);
                          setPinInput('');
                          toast.success('Terima kasih banyak bos! Lisensi premium aktif selama 1 tahun bebas pop-up.');
                        } else {
                          toast.error('PIN tidak valid! Silakan hubungi Mas Qodir.');
                        }
                      }}
                      variant="primary"
                      size="default"
                      className="py-2 px-3 text-xs font-semibold cursor-pointer"
                    >
                      Kirim
                    </LiquidButton>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Pop-up: Pengingat Backup Data (1 Day Reminder) ── */}
      {showBackupReminder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <Download className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Backup Data Anda</h3>
            <p className="text-slate-300 text-xs leading-relaxed mb-5">
              PENTING: Anda belum mencadangkan data hari ini. Silakan backup/export semua data transaksi lokal Anda untuk menghindari resiko kehilangan data jika browser dibersihkan.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <LiquidButton
                onClick={() => {
                  setShowBackupReminder(false);
                  localStorage.setItem('last_backup_time', Date.now().toString());
                  toast.info('Pengingat ditunda. Kami akan mengingatkan Anda lagi besok.');
                }}
                variant="default"
                size="default"
                className="w-full py-2.5 font-medium text-xs cursor-pointer"
              >
                Nanti Saja
              </LiquidButton>
              <LiquidButton
                onClick={() => {
                  exportAllData();
                  localStorage.setItem('last_backup_time', Date.now().toString());
                  setShowBackupReminder(false);
                  toast.success('Backup selesai! Data cadangan berhasil diunduh.');
                }}
                variant="primary"
                size="default"
                className="w-full py-2.5 font-bold text-xs cursor-pointer"
              >
                Backup Sekarang
              </LiquidButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
