import { useState, useEffect } from 'react';
import { db, type Product, getCategories, getLowStockProducts } from '@/lib/db';
import { formatRupiah, compressImageAndConvertToBase64 } from '@/lib/format';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { Plus, Search, Package, Edit, Trash2, AlertTriangle, FileDown, ImageIcon, X } from 'lucide-react';

interface ProductFormData {
  name: string;
  sku: string;
  stock: number;
  buyPrice: number;
  sellPrice: number;
  photo: string;
  category: string;
  notes: string;
}

const emptyForm: ProductFormData = {
  name: '',
  sku: '',
  stock: 0,
  buyPrice: 0,
  sellPrice: 0,
  photo: '',
  category: '',
  notes: '',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(emptyForm);
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [prods, cats, lowStock] = await Promise.all([
        db.products.toArray(),
        getCategories(),
        getLowStockProducts(),
      ]);
      setProducts(prods);
      setCategories(cats);
      setLowStockProducts(lowStock);
    } catch {
      toast.error('Gagal memuat data produk');
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingProduct(null);
    setFormData(emptyForm);
    setShowNewCategoryInput(false);
    setNewCategory('');
    setModalOpen(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      stock: product.stock,
      buyPrice: product.buyPrice,
      sellPrice: product.sellPrice,
      photo: product.photo,
      category: product.category,
      notes: product.notes,
    });
    setShowNewCategoryInput(false);
    setNewCategory('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error('Nama produk wajib diisi');
      return;
    }
    if (formData.sellPrice <= 0) {
      toast.error('Harga jual harus lebih dari 0');
      return;
    }

    setSaving(true);
    try {
      const categoryToUse = showNewCategoryInput && newCategory.trim()
        ? newCategory.trim()
        : formData.category;

      const productData = {
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        stock: Number(formData.stock),
        buyPrice: Number(formData.buyPrice),
        sellPrice: Number(formData.sellPrice),
        photo: formData.photo,
        category: categoryToUse,
        notes: formData.notes.trim(),
      };

      if (editingProduct?.id) {
        await db.products.update(editingProduct.id, productData);
        toast.success('Produk berhasil diperbarui!');
      } else {
        await db.products.add({
          ...productData,
          createdAt: new Date(),
        });
        toast.success('Produk berhasil ditambahkan!');
      }

      setModalOpen(false);
      await loadData();
    } catch {
      toast.error('Gagal menyimpan produk');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    try {
      await db.products.delete(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" berhasil dihapus`);
      setDeleteTarget(null);
      await loadData();
    } catch {
      toast.error('Gagal menghapus produk');
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Hanya file gambar yang diperbolehkan');
      return;
    }

    try {
      const base64 = await compressImageAndConvertToBase64(file, 600, 600);
      setFormData((prev) => ({ ...prev, photo: base64 }));
      toast.success('Foto berhasil diunggah dan dikompres otomatis');
    } catch {
      toast.error('Gagal mengunggah foto');
    }
  }

  const handleExportCatalog = async () => {
    try {
      const profile = await db.storeProfile.get(1);
      const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
      });

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(profile?.storeName || 'KATALOG PRODUK', 14, 20);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      if (profile?.address) {
        doc.text(profile.address, 14, 25);
      }

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('DAFTAR KATALOG PRODUK AKTIF', 14, 35);
      
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(14, 38, 196, 38);

      let y = 46;
      let pageHeight = doc.internal.pageSize.height;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);

      // Header row
      doc.text('Foto', 16, y);
      doc.text('Detail Produk', 45, y);
      doc.text('Kategori', 110, y);
      doc.text('Stok', 145, y);
      doc.text('Harga Jual', 165, y);
      
      doc.line(14, y + 2, 196, y + 2);
      y += 10;

      doc.setFont('Helvetica', 'normal');
      products.forEach((product) => {
        // Check page height limit to insert page break
        if (y > pageHeight - 25) {
          doc.addPage();
          y = 20;
          doc.setFont('Helvetica', 'bold');
          doc.text('Foto', 16, y);
          doc.text('Detail Produk', 45, y);
          doc.text('Kategori', 110, y);
          doc.text('Stok', 145, y);
          doc.text('Harga Jual', 165, y);
          doc.line(14, y + 2, 196, y + 2);
          y += 10;
          doc.setFont('Helvetica', 'normal');
        }

        // Draw image
        if (product.photo) {
          try {
            doc.addImage(product.photo, 'PNG', 16, y - 6, 12, 12);
          } catch (e) {
            // Draw placeholder box
            doc.rect(16, y - 6, 12, 12, 'S');
          }
        } else {
          doc.rect(16, y - 6, 12, 12, 'S');
          doc.setFontSize(6);
          doc.text('No Photo', 17, y + 1);
          doc.setFontSize(10);
        }

        doc.setFont('Helvetica', 'bold');
        doc.text(product.name, 45, y - 2);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`SKU: ${product.sku}`, 45, y + 3);
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);

        doc.text(product.category, 110, y);
        doc.text(`${product.stock} unit`, 145, y);
        doc.text(formatRupiah(product.sellPrice), 165, y);

        doc.line(14, y + 6, 196, y + 6);
        y += 18;
      });

      doc.save(`katalog-produk-${Date.now()}.pdf`);
      toast.success('Katalog PDF berhasil diexport!');
    } catch (e) {
      console.error(e);
      toast.error('Gagal mengekspor katalog');
    }
  };

  // Filtered products
  const filteredProducts = products.filter((p) => {
    const matchSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = !filterCategory || p.category === filterCategory;
    return matchSearch && matchCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-white/20 border-t-[hsl(var(--primary))] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Low stock alert */}
      {lowStockProducts.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-200 font-medium text-sm">Peringatan Stok Menipis</p>
            <p className="text-amber-300/70 text-xs mt-1">
              {lowStockProducts.length} produk memiliki stok ≤ 5:{' '}
              {lowStockProducts.map((p) => p.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-white/10">
              <Package className="w-6 h-6 text-blue-400" />
            </div>
            Manajemen Produk
          </h1>
          <p className="text-slate-400 mt-1 ml-14">{products.length} produk terdaftar</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCatalog}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-xl transition-all duration-200 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Ekspor Katalog</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-medium rounded-xl shadow-lg shadow-[hsl(var(--primary))]/25 transition-all duration-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Tambah Produk</span>
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari produk berdasarkan nama atau SKU..."
            className="w-full bg-slate-800 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50 transition-all text-sm"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50 transition-all text-sm cursor-pointer min-w-[160px]"
        >
          <option value="">Semua Kategori</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Product grid */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-12 text-center">
          <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg font-medium">
            {searchQuery || filterCategory ? 'Produk tidak ditemukan' : 'Belum ada produk'}
          </p>
          <p className="text-slate-500 text-sm mt-1">
            {searchQuery || filterCategory
              ? 'Coba ubah filter pencarian'
              : 'Mulai tambahkan produk pertama Anda'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl overflow-hidden group hover:border-white/20 transition-all duration-300"
            >
              {/* Product photo */}
              <div className="aspect-square bg-slate-800 relative overflow-hidden">
                {product.photo ? (
                  <img
                    src={product.photo}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-slate-600" />
                  </div>
                )}

                {/* Category badge */}
                {product.category && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 bg-[hsl(var(--primary))]/80 backdrop-blur text-white text-xs font-medium rounded-full">
                    {product.category}
                  </span>
                )}

                {/* Stock warning */}
                {product.stock <= 5 && (
                  <span className="absolute top-3 right-3 px-2 py-1 bg-red-500/80 backdrop-blur text-white text-xs font-medium rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {product.stock}
                  </span>
                )}
              </div>

              {/* Product info */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="text-white font-semibold text-sm truncate">{product.name}</h3>
                  {product.sku && (
                    <p className="text-slate-500 text-xs mt-0.5 font-mono">SKU: {product.sku}</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[hsl(var(--primary))] font-bold text-sm">
                      {formatRupiah(product.sellPrice)}
                    </p>
                    <p className="text-slate-500 text-xs">
                      Beli: {formatRupiah(product.buyPrice)}
                    </p>
                  </div>
                  <div className={`text-right ${product.stock <= 5 ? 'text-red-400' : 'text-slate-400'}`}>
                    <p className="text-xs">Stok</p>
                    <p className="font-bold text-sm">{product.stock}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => openEditModal(product)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-lg transition-all text-xs cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(product)}
                    className="flex items-center justify-center px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================== ADD/EDIT MODAL ==================== */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="bg-slate-900 rounded-2xl border border-white/10 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nama Produk */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nama Produk <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Masukkan nama produk..."
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50 transition-all text-sm"
                />
              </div>

              {/* SKU & Stok */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                    placeholder="SKU-001"
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50 transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Stok</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData((prev) => ({ ...prev, stock: Number(e.target.value) }))}
                    min={0}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50 transition-all text-sm"
                  />
                </div>
              </div>

              {/* Harga Beli & Harga Jual */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Harga Beli (Rp)
                  </label>
                  <input
                    type="number"
                    value={formData.buyPrice}
                    onChange={(e) => setFormData((prev) => ({ ...prev, buyPrice: Number(e.target.value) }))}
                    min={0}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50 transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Harga Jual (Rp) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.sellPrice}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sellPrice: Number(e.target.value) }))}
                    min={0}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50 transition-all text-sm"
                  />
                </div>
              </div>

              {/* Foto */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Foto Produk
                </label>
                <div className="flex items-center gap-3">
                  {formData.photo ? (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
                      <img
                        src={formData.photo}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => setFormData((prev) => ({ ...prev, photo: '' }))}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-8 h-8 text-slate-600" />
                    </div>
                  )}
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 border border-dashed border-white/20 rounded-lg text-slate-400 hover:text-white hover:border-[hsl(var(--primary))]/50 transition-all cursor-pointer text-sm">
                    <ImageIcon className="w-4 h-4" />
                    Pilih Foto
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Kategori */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Kategori</label>
                {showNewCategoryInput ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Nama kategori baru..."
                      className="flex-1 bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50 transition-all text-sm"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        setShowNewCategoryInput(false);
                        setNewCategory('');
                      }}
                      className="p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                      className="flex-1 bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50 transition-all text-sm cursor-pointer"
                    >
                      <option value="">Pilih Kategori</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowNewCategoryInput(true)}
                      className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
                      title="Tambah kategori baru"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Catatan</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Catatan tambahan (opsional)..."
                  rows={3}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50 transition-all resize-none text-sm"
                />
              </div>

              {/* Margin info */}
              {formData.buyPrice > 0 && formData.sellPrice > 0 && (
                <div className="bg-slate-800/50 border border-white/10 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Margin Keuntungan:</span>
                    <span className={`font-bold ${formData.sellPrice > formData.buyPrice ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatRupiah(formData.sellPrice - formData.buyPrice)}
                      {' '}
                      ({((formData.sellPrice - formData.buyPrice) / formData.buyPrice * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-white/10">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer text-sm font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-medium rounded-xl shadow-lg shadow-[hsl(var(--primary))]/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
              >
                {saving ? 'Menyimpan...' : editingProduct ? 'Simpan Perubahan' : 'Tambah Produk'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DELETE CONFIRMATION MODAL ==================== */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="bg-slate-900 rounded-2xl border border-white/10 p-6 max-w-sm w-full">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-7 h-7 text-red-400" />
              </div>
              <h3 className="text-white font-bold text-lg">Hapus Produk?</h3>
              <p className="text-slate-400 text-sm mt-2">
                Apakah Anda yakin ingin menghapus{' '}
                <span className="text-white font-medium">"{deleteTarget.name}"</span>?
                <br />
                Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer text-sm font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-all cursor-pointer text-sm"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
