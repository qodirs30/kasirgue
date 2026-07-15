import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import { Store, MapPin, Share2, Image, Save, Printer, FileDown } from 'lucide-react';
import { db, getStoreProfile } from '@/lib/db';
import { compressImageAndConvertToBase64 } from '@/lib/format';
import { toast } from 'sonner';
import { LiquidButton } from '@/components/ui/liquid-glass-button';

export default function StoreProfilePage() {
  const [formData, setFormData] = useState({
    storeName: '',
    address: '',
    socialMedia: '',
    logo: '',
    receiptPaperSize: 'auto' as 'auto' | '58mm' | '80mm',
    receiptFontSize: 'medium' as 'small' | 'medium' | 'large',
    receiptShowLogo: true,
    receiptShowSocial: true,
    receiptFooterNote: 'Terima kasih atas kunjungan Anda!',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const profile = await getStoreProfile();
      if (profile) {
        setFormData({
          storeName: profile.storeName || '',
          address: profile.address || '',
          socialMedia: profile.socialMedia || '',
          logo: profile.logo || '',
          receiptPaperSize: (profile as any).receiptPaperSize || 'auto',
          receiptFontSize: (profile as any).receiptFontSize || 'medium',
          receiptShowLogo: (profile as any).receiptShowLogo !== false,
          receiptShowSocial: (profile as any).receiptShowSocial !== false,
          receiptFooterNote: (profile as any).receiptFooterNote || 'Terima kasih atas kunjungan Anda!',
        });
      }
    } catch {
      toast.error('Gagal memuat profil toko');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'image/png') {
      toast.error('Hanya file PNG yang diperbolehkan');
      return;
    }

    try {
      const base64 = await compressImageAndConvertToBase64(file, 600, 600);
      setFormData((prev) => ({ ...prev, logo: base64 }));
      toast.success('Logo berhasil diunggah dan dikompres otomatis');
    } catch {
      toast.error('Gagal mengunggah logo');
    }
  }

  async function handleSave() {
    if (!formData.storeName.trim()) {
      toast.error('Nama toko wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const existing = await getStoreProfile();
      await db.storeProfile.put({
        id: 1,
        storeName: formData.storeName.trim(),
        address: formData.address.trim(),
        socialMedia: formData.socialMedia.trim(),
        logo: formData.logo,
        qrisImage: existing?.qrisImage || '',
        receiptPaperSize: formData.receiptPaperSize,
        receiptFontSize: formData.receiptFontSize,
        receiptShowLogo: formData.receiptShowLogo,
        receiptShowSocial: formData.receiptShowSocial,
        receiptFooterNote: formData.receiptFooterNote,
      } as any);
      toast.success('Profil toko & pengaturan printer berhasil disimpan!');
    } catch {
      toast.error('Gagal menyimpan profil toko');
    } finally {
      setSaving(false);
    }
  }

  const testPDF = () => {
    try {
      const paperSize = formData.receiptPaperSize;
      const fontSizeSetting = formData.receiptFontSize;
      
      const width = paperSize === '58mm' ? 58 : 80;
      const baseHeight = paperSize === '58mm' ? 85 : 95;
      const height = baseHeight + (2 * 9.5); // Mock receipt always has 2 items
      
      const doc = new jsPDF({
        unit: 'mm',
        format: [width, height],
      });

      let sizeStore = 13;
      let sizeBody = 9.5;
      let sizeSmall = 8;
      
      if (fontSizeSetting === 'small') {
        sizeStore = 11;
        sizeBody = 8;
        sizeSmall = 7;
      } else if (fontSizeSetting === 'large') {
        sizeStore = 16;
        sizeBody = 11.5;
        sizeSmall = 9.5;
      }
      
      doc.setFont('Helvetica', 'normal');
      let y = 8;
      
      if (formData.receiptShowLogo && formData.logo) {
        try {
          const logoSize = paperSize === '58mm' ? 12 : 16;
          const logoX = (width - logoSize) / 2;
          doc.addImage(formData.logo, 'PNG', logoX, y, logoSize, logoSize);
          y += logoSize + 4;
        } catch (e) {
          console.error("Failed to add logo to PDF: ", e);
        }
      }

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(sizeStore);
      doc.text(formData.storeName || 'KASIR GUE', width / 2, y, { align: 'center' });

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(sizeBody);

      if (formData.receiptShowSocial) {
        if (formData.address) {
          y += 5;
          doc.setFontSize(sizeSmall);
          doc.text(formData.address, width / 2, y, { align: 'center', maxWidth: width - 10 });
        }

        if (formData.socialMedia) {
          y += 4.5;
          doc.setFontSize(sizeSmall);
          doc.text(formData.socialMedia, width / 2, y, { align: 'center' });
        }
      }

      const divLine = paperSize === '58mm' ? '---------------------------------------' : '---------------------------------------------------';
      const marginX = paperSize === '58mm' ? 4 : 6;
      const rightAlignX = width - marginX;

      y += 5;
      doc.setFontSize(sizeSmall);
      doc.text(divLine, width / 2, y, { align: 'center' });
      y += 4.5;
      doc.text(new Date().toLocaleDateString('id-ID') + ', ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), width / 2, y, { align: 'center' });
      y += 4;
      doc.text(divLine, width / 2, y, { align: 'center' });

      // Mock Items
      doc.setFontSize(sizeBody);
      y += 5;
      doc.setFont('Helvetica', 'bold');
      doc.text('Kopi Susu Gula Aren', marginX, y);
      y += 4.5;
      doc.setFont('Helvetica', 'normal');
      doc.text('2 x Rp 15.000', marginX, y);
      doc.text('Rp 30.000', rightAlignX, y, { align: 'right' });

      y += 5;
      doc.setFont('Helvetica', 'bold');
      doc.text('Roti Bakar Cokelat', marginX, y);
      y += 4.5;
      doc.setFont('Helvetica', 'normal');
      doc.text('1 x Rp 20.000', marginX, y);
      doc.text('Rp 20.000', rightAlignX, y, { align: 'right' });

      y += 5;
      doc.setFontSize(sizeSmall);
      doc.text(divLine, width / 2, y, { align: 'center' });

      // Mock Totals
      doc.setFontSize(sizeBody);
      y += 5;
      doc.text('Subtotal:', marginX, y);
      doc.text('Rp 50.000', rightAlignX, y, { align: 'right' });

      y += 5;
      doc.text('Diskon:', marginX, y);
      doc.text('-Rp 5.000', rightAlignX, y, { align: 'right' });

      y += 5.5;
      doc.setFont('Helvetica', 'bold');
      doc.text('TOTAL:', marginX, y);
      doc.text('Rp 45.000', rightAlignX, y, { align: 'right' });
      doc.setFont('Helvetica', 'normal');

      y += 5;
      doc.setFontSize(sizeSmall);
      doc.text('Metode: Tunai', marginX, y);

      y += 4.5;
      doc.text('Diterima:', marginX, y);
      doc.text('Rp 50.000', rightAlignX, y, { align: 'right' });

      y += 4.5;
      doc.text('Kembalian:', marginX, y);
      doc.text('Rp 5.000', rightAlignX, y, { align: 'right' });

      y += 5;
      doc.setFontSize(sizeSmall);
      doc.text(divLine, width / 2, y, { align: 'center' });

      y += 5;
      doc.setFontSize(sizeBody);
      doc.setFont('Helvetica', 'oblique');
      doc.text(formData.receiptFooterNote || 'Terima kasih atas kunjungan Anda!', width / 2, y, { align: 'center', maxWidth: width - 8 });

      doc.save('uji-coba-struk.pdf');
      toast.success('Uji coba PDF berhasil disimpan!');
    } catch (e) {
      console.error(e);
      toast.error('Gagal membuat PDF');
    }
  };

  const testPrint = () => {
    window.print();
  };

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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10">
            <Store className="w-6 h-6 text-indigo-400" />
          </div>
          Profil Toko
        </h1>
        <p className="text-slate-400 mt-2 ml-14">Atur informasi toko Anda</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Nama Toko */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
              <Store className="w-4 h-4 text-indigo-400" />
              Nama Toko
            </label>
            <input
              type="text"
              value={formData.storeName}
              onChange={(e) => setFormData((prev) => ({ ...prev, storeName: e.target.value }))}
              placeholder="Masukkan nama toko..."
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50 focus:border-[hsl(var(--primary))]/50 transition-all"
            />
          </div>

          {/* Alamat */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
              <MapPin className="w-4 h-4 text-emerald-400" />
              Alamat
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Masukkan alamat toko..."
              rows={3}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50 focus:border-[hsl(var(--primary))]/50 transition-all resize-none"
            />
          </div>

          {/* Media Sosial */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
              <Share2 className="w-4 h-4 text-sky-400" />
              Media Sosial
            </label>
            <input
              type="text"
              value={formData.socialMedia}
              onChange={(e) => setFormData((prev) => ({ ...prev, socialMedia: e.target.value }))}
              placeholder="@instagram atau link sosial media..."
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50 focus:border-[hsl(var(--primary))]/50 transition-all"
            />
          </div>

          {/* Upload Logo */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
              <Image className="w-4 h-4 text-amber-400" />
              Logo Toko (PNG)
            </label>
            <div className="flex items-center gap-4">
              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 border border-dashed border-white/20 rounded-lg text-slate-400 hover:text-white hover:border-[hsl(var(--primary))]/50 hover:bg-slate-800/80 transition-all cursor-pointer">
                <Image className="w-5 h-5" />
                <span className="text-sm">Pilih file PNG...</span>
                <input
                  type="file"
                  accept="image/png"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
              {formData.logo && (
                <button
                  onClick={() => setFormData((prev) => ({ ...prev, logo: '' }))}
                  className="px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                >
                  Hapus
                </button>
              )}
            </div>
          </div>

          {/* Pengaturan Printer & Nota */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-4">
              <Printer className="w-4 h-4 text-indigo-400" />
              Pengaturan Printer & Nota
            </h3>
            
            <div className="space-y-5">
              {/* Paper Size Preset */}
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-2.5">
                  Lebar Kertas Struk
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'auto', label: 'Otomatis (Fit)' },
                    { value: '58mm', label: '58mm (Kecil/EDC)' },
                    { value: '80mm', label: '80mm (Besar)' }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, receiptPaperSize: opt.value as any }))}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                        formData.receiptPaperSize === opt.value
                          ? 'bg-[hsl(var(--primary))]/20 border-[hsl(var(--primary))] text-white'
                          : 'bg-slate-800/50 border-white/10 text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size Preset */}
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-2.5">
                  Ukuran Tulisan Struk
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'small', label: 'Kecil' },
                    { value: 'medium', label: 'Sedang (Bawaan)' },
                    { value: 'large', label: 'Besar' }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, receiptFontSize: opt.value as any }))}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                        formData.receiptFontSize === opt.value
                          ? 'bg-[hsl(var(--primary))]/20 border-[hsl(var(--primary))] text-white'
                          : 'bg-slate-800/50 border-white/10 text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.receiptShowLogo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, receiptShowLogo: e.target.checked }))}
                    className="w-4 h-4 rounded border-white/10 bg-slate-800 text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/50 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-300">Tampilkan Logo</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.receiptShowSocial}
                    onChange={(e) => setFormData((prev) => ({ ...prev, receiptShowSocial: e.target.checked }))}
                    className="w-4 h-4 rounded border-white/10 bg-slate-800 text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/50 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-300">Tampilkan Alamat & Medsos</span>
                </label>
              </div>

              {/* Footer Note */}
              <div className="pt-2">
                <label className="text-xs font-medium text-slate-400 block mb-2">
                  Catatan Kaki Struk (Footer)
                </label>
                <input
                  type="text"
                  value={formData.receiptFooterNote}
                  onChange={(e) => setFormData((prev) => ({ ...prev, receiptFooterNote: e.target.value }))}
                  placeholder="Terima kasih atas kunjungan Anda!..."
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50 focus:border-[hsl(var(--primary))]/50 transition-all text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview section */}
        <div className="space-y-6">
          {/* Logo preview */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Pratinjau Logo</h3>
            <div className="aspect-square rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden">
              {formData.logo ? (
                <img
                  src={formData.logo}
                  alt="Logo Toko"
                  className="w-full h-full object-contain p-4"
                />
              ) : (
                <div className="text-center">
                  <Image className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">Belum ada logo</p>
                </div>
              )}
            </div>
          </div>

          {/* Receipt preview and testing */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Pratinjau Struk Belanja</h3>
            
            {/* The Monospace Receipt Paper Preview */}
            <div 
              className="rounded-xl bg-white text-black p-4 text-left font-mono shadow-inner mx-auto border border-slate-200 select-none transition-all duration-200"
              style={{
                maxWidth: formData.receiptPaperSize === '58mm' ? '200px' : '260px',
                fontSize: formData.receiptFontSize === 'small' ? '9px' : formData.receiptFontSize === 'large' ? '13px' : '11px',
                lineHeight: '1.4'
              }}
            >
              {/* Header Logo */}
              {formData.receiptShowLogo && (
                formData.logo ? (
                  <img
                    src={formData.logo}
                    alt="Store Logo"
                    className="w-10 h-10 object-contain mx-auto mb-2"
                  />
                ) : (
                  <div className="w-10 h-10 bg-slate-100 border border-slate-300 rounded-lg flex items-center justify-center mx-auto mb-2 text-slate-400 text-[8px]">
                    [LOGO]
                  </div>
                )
              )}

              {/* Store details */}
              <p className="font-bold text-center leading-tight">
                {formData.storeName || 'NAMA TOKO'}
              </p>
              {formData.receiptShowSocial && (
                <>
                  {formData.address && (
                    <p className="text-center text-[9px] mt-0.5 leading-tight">{formData.address}</p>
                  )}
                  {formData.socialMedia && (
                    <p className="text-center text-[9px] mt-0.5 leading-tight">{formData.socialMedia}</p>
                  )}
                </>
              )}

              <p className="border-t border-dashed border-slate-300 my-2" />

              <p className="text-center text-[9px]">
                {new Date().toLocaleDateString('id-ID')} {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </p>

              <p className="border-t border-dashed border-slate-300 my-2" />

              {/* Mock items list */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <div>
                    <span>Kopi Susu Gula Aren</span>
                    <br />
                    <span className="text-[9px] text-slate-500">2 × Rp 15.000</span>
                  </div>
                  <span className="font-medium">Rp 30.000</span>
                </div>
                <div className="flex justify-between">
                  <div>
                    <span>Roti Bakar Cokelat</span>
                    <br />
                    <span className="text-[9px] text-slate-500">1 × Rp 20.000</span>
                  </div>
                  <span className="font-medium">Rp 20.000</span>
                </div>
              </div>

              <p className="border-t border-dashed border-slate-300 my-2" />

              {/* Mock totals */}
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>Rp 50.000</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Diskon</span>
                  <span>-Rp 5.000</span>
                </div>
                <div className="flex justify-between font-bold border-t border-dashed border-slate-300 pt-1 mt-1">
                  <span>TOTAL</span>
                  <span>Rp 45.000</span>
                </div>
              </div>

              <p className="border-t border-dashed border-slate-300 my-2" />
              <p className="text-center italic">
                {formData.receiptFooterNote || 'Terima kasih atas kunjungan Anda!'}
              </p>
            </div>

            {/* Test action buttons */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <LiquidButton
                onClick={testPrint}
                variant="default"
                size="default"
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Uji Print
              </LiquidButton>
              <LiquidButton
                onClick={testPDF}
                variant="default"
                size="default"
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                Uji PDF
              </LiquidButton>
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <LiquidButton
          onClick={handleSave}
          disabled={saving}
          variant="primary"
          size="lg"
          className="flex items-center gap-2 px-6 py-3 font-semibold cursor-pointer"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Menyimpan...' : 'Simpan Profil'}
        </LiquidButton>
      </div>

      {/* ── Print-Only Receipt (rendered via React Portal directly under body for perfect clean printing) ──────────────── */}
      {createPortal(
        <div 
          className="print-receipt hidden print:block bg-white text-black font-mono mx-auto"
          style={{
            width: '100%',
            maxWidth: formData.receiptPaperSize === '58mm' 
              ? '48mm' 
              : formData.receiptPaperSize === '80mm' 
                ? '76mm' 
                : '76mm',
            fontSize: formData.receiptFontSize === 'small' 
              ? '9px' 
              : formData.receiptFontSize === 'large' 
                ? '13px' 
                : '11px',
            lineHeight: '1.4',
            padding: '2mm'
          }}
        >
          {/* Store Header */}
          {formData.receiptShowLogo && (
            <div className="text-center mb-3">
              {formData.logo && (
                <img
                  src={formData.logo}
                  alt=""
                  className="w-12 h-12 mx-auto mb-1 object-contain"
                />
              )}
              <p className="font-bold text-base">
                {formData.storeName || 'Kasir Gue'}
              </p>
              {formData.receiptShowSocial && (
                <>
                  {formData.address && (
                    <p className="text-xs">{formData.address}</p>
                  )}
                  {formData.socialMedia && (
                    <p className="text-xs">{formData.socialMedia}</p>
                  )}
                </>
              )}
            </div>
          )}

          {!formData.receiptShowLogo && (
            <div className="text-center mb-3">
              <p className="font-bold text-base">
                {formData.storeName || 'Kasir Gue'}
              </p>
              {formData.receiptShowSocial && (
                <>
                  {formData.address && (
                    <p className="text-xs">{formData.address}</p>
                  )}
                  {formData.socialMedia && (
                    <p className="text-xs">{formData.socialMedia}</p>
                  )}
                </>
              )}
            </div>
          )}

          <p className="border-t border-dashed border-black my-2" />

          <p className="text-xs text-center">
            {new Date().toLocaleDateString('id-ID')} {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </p>

          <p className="border-t border-dashed border-black my-2" />

          {/* Items */}
          <div className="flex justify-between text-xs mb-1">
            <div>
              <span>Kopi Susu Gula Aren</span>
              <br />
              <span className="text-[10px]">2 × Rp 15.000</span>
            </div>
            <span className="font-medium">Rp 30.000</span>
          </div>
          <div className="flex justify-between text-xs mb-1">
            <div>
              <span>Roti Bakar Cokelat</span>
              <br />
              <span className="text-[10px]">1 × Rp 20.000</span>
            </div>
            <span className="font-medium">Rp 20.000</span>
          </div>

          <p className="border-t border-dashed border-black my-2" />

          <div className="text-xs space-y-0.5">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>Rp 50.000</span>
            </div>
            <div className="flex justify-between">
              <span>Diskon</span>
              <span>-Rp 5.000</span>
            </div>
            <div className="flex justify-between font-bold text-sm border-t border-dashed border-black pt-1 mt-1">
              <span>Total</span>
              <span>Rp 45.000</span>
            </div>
            <div className="flex justify-between">
              <span>Metode</span>
              <span>Tunai</span>
            </div>
            <div className="flex justify-between">
              <span>Diterima</span>
              <span>Rp 50.000</span>
            </div>
            <div className="flex justify-between">
              <span>Kembalian</span>
              <span>Rp 5.000</span>
            </div>
          </div>

          <p className="border-t border-dashed border-black my-2" />

          <p className="text-center text-xs italic">
            {formData.receiptFooterNote || 'Terima kasih atas kunjungan Anda!'}
          </p>
        </div>,
        document.body
      )}
    </div>
  );
}
