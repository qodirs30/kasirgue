import { useState, useEffect, useCallback } from 'react';
import { QrCode, Upload, Trash2, Check } from 'lucide-react';
import { db, getStoreProfile } from '@/lib/db';
import { compressImageAndConvertToBase64 } from '@/lib/format';
import { toast } from 'sonner';
import { LiquidButton } from '@/components/ui/liquid-glass-button';

export default function QRISPage() {
  const [qrisImage, setQrisImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    loadQris();
  }, []);

  async function loadQris() {
    try {
      const profile = await getStoreProfile();
      if (profile?.qrisImage) {
        setQrisImage(profile.qrisImage);
      }
    } catch {
      toast.error('Gagal memuat gambar QRIS');
    } finally {
      setLoading(false);
    }
  }

  async function saveQrisImage(base64: string) {
    try {
      const profile = await getStoreProfile();
      await db.storeProfile.put({
        id: 1,
        storeName: profile?.storeName || '',
        address: profile?.address || '',
        socialMedia: profile?.socialMedia || '',
        logo: profile?.logo || '',
        qrisImage: base64,
      });
      setQrisImage(base64);
      toast.success('Gambar QRIS berhasil disimpan!');
    } catch {
      toast.error('Gagal menyimpan gambar QRIS');
    }
  }

  async function handleFileUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Hanya file gambar yang diperbolehkan');
      return;
    }

    try {
      const base64 = await compressImageAndConvertToBase64(file, 800, 800);
      await saveQrisImage(base64);
      toast.success('QRIS berhasil diunggah dan dikompres otomatis');
    } catch {
      toast.error('Gagal memproses gambar');
    }
  }

  async function handleRemoveQris() {
    try {
      const profile = await getStoreProfile();
      await db.storeProfile.put({
        id: 1,
        storeName: profile?.storeName || '',
        address: profile?.address || '',
        socialMedia: profile?.socialMedia || '',
        logo: profile?.logo || '',
        qrisImage: '',
      });
      setQrisImage('');
      toast.success('Gambar QRIS berhasil dihapus');
    } catch {
      toast.error('Gagal menghapus gambar QRIS');
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-white/20 border-t-[hsl(var(--primary))] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-white/10">
            <QrCode className="w-6 h-6 text-emerald-400" />
          </div>
          Kelola QRIS
        </h1>
        <p className="text-slate-400 mt-2 ml-14">
          Unggah gambar QRIS untuk menerima pembayaran digital
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload zone */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
          <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-400" />
            Unggah Gambar QRIS
          </h3>

          <label
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              flex flex-col items-center justify-center gap-4 p-8
              border-2 border-dashed rounded-xl cursor-pointer
              transition-all duration-300 min-h-[240px]
              ${
                isDragOver
                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 scale-[1.02]'
                  : 'border-white/20 hover:border-[hsl(var(--primary))]/50 hover:bg-white/5'
              }
            `}
          >
            <div
              className={`
                w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
                ${isDragOver ? 'bg-[hsl(var(--primary))]/20' : 'bg-slate-800'}
              `}
            >
              <Upload
                className={`w-8 h-8 transition-all duration-300 ${
                  isDragOver ? 'text-[hsl(var(--primary))] scale-110' : 'text-slate-400'
                }`}
              />
            </div>
            <div className="text-center">
              <p className="text-white font-medium">
                {isDragOver ? 'Lepaskan untuk mengunggah' : 'Seret & lepas gambar di sini'}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                atau klik untuk memilih file
              </p>
              <p className="text-slate-500 text-xs mt-2">
                Format: PNG, JPG, JPEG • Maks: 5MB
              </p>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleInputChange}
              className="hidden"
            />
          </label>

          {/* Status indicator */}
          {qrisImage && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-300 text-sm">QRIS aktif dan siap digunakan</span>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
          <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
            <QrCode className="w-4 h-4 text-emerald-400" />
            Pratinjau QRIS
          </h3>

          <div className="aspect-square rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden">
            {qrisImage ? (
              <img
                src={qrisImage}
                alt="QRIS"
                className="w-full h-full object-contain p-4"
              />
            ) : (
              <div className="text-center p-6">
                <QrCode className="w-16 h-16 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Belum ada gambar QRIS</p>
                <p className="text-slate-600 text-xs mt-1">
                  Unggah gambar QRIS dari aplikasi bank Anda
                </p>
              </div>
            )}
          </div>

          {/* Remove button */}
          {qrisImage && (
            <LiquidButton
              onClick={handleRemoveQris}
              variant="destructive"
              size="default"
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 cursor-pointer font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Hapus QRIS
            </LiquidButton>
          )}
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
        <h3 className="text-white font-medium mb-3">💡 Tips Penggunaan QRIS</h3>
        <ul className="space-y-2 text-slate-400 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            Pastikan gambar QRIS jelas dan tidak buram agar mudah dipindai
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            Gambar QRIS akan ditampilkan saat pelanggan memilih metode pembayaran QRIS
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            Anda bisa mendapatkan gambar QRIS dari aplikasi bank atau e-wallet Anda
          </li>
        </ul>
      </div>
    </div>
  );
}
