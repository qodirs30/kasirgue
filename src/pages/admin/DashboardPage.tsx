import { useState, useEffect, useMemo } from 'react';
import { liveQuery } from 'dexie';
import { db, type Transaction, type Product, getLowStockProducts } from '@/lib/db';
import { formatRupiah } from '@/lib/format';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, ShoppingBag, Package, AlertTriangle, FileDown, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';

type Period = 'today' | 'week' | 'month' | 'year';

interface PeriodOption {
  key: Period;
  label: string;
}

const periodOptions: PeriodOption[] = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'week', label: 'Minggu Ini' },
  { key: 'month', label: 'Bulan Ini' },
  { key: 'year', label: 'Tahun Ini' },
];

function getStartDate(period: Period): Date {
  const now = new Date();
  const start = new Date(now);

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
  }

  return start;
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(date);
}

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<string>('date-desc');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  useEffect(() => {
    const subTx = liveQuery(() => db.transactions.toArray()).subscribe({
      next: (data) => {
        setTransactions(data);
        setLoading(false);
      },
      error: (err) => {
        console.error(err);
        toast.error('Gagal memuat transaksi');
      }
    });

    const subProd = liveQuery(() => db.products.toArray()).subscribe({
      next: (data) => {
        setProducts(data);
      },
      error: (err) => console.error(err)
    });

    const subLow = liveQuery(() => getLowStockProducts()).subscribe({
      next: (data) => {
        setLowStockProducts(data);
      },
      error: (err) => console.error(err)
    });

    return () => {
      subTx.unsubscribe();
      subProd.unsubscribe();
      subLow.unsubscribe();
    };
  }, []);

  // Filtered transactions by period
  const filteredTransactions = useMemo(() => {
    const startDate = getStartDate(period);
    return transactions.filter(
      (t) => t.status === 'completed' && new Date(t.timestamp) >= startDate
    );
  }, [transactions, period]);

  // Summary stats
  const stats = useMemo(() => {
    const totalRevenue = filteredTransactions.reduce((sum, t) => sum + t.total, 0);
    const totalTransactions = filteredTransactions.length;
    const totalProducts = products.length;
    const lowStockCount = lowStockProducts.length;
    const totalProfit = filteredTransactions.reduce((sum, t) => {
      const itemProfit = t.items.reduce((s, item) => s + (item.price - (item.buyPrice || 0)) * item.quantity, 0);
      return sum + (itemProfit - t.discount);
    }, 0);

    return { totalRevenue, totalTransactions, totalProducts, lowStockCount, totalProfit };
  }, [filteredTransactions, products, lowStockProducts]);

  // Sales chart data
  const salesChartData = useMemo(() => {
    const startDate = getStartDate(period);
    const now = new Date();
    const dataMap = new Map<string, { date: string; pendapatan: number; transaksi: number }>();

    if (period === 'today') {
      // Hourly breakdown
      for (let h = 0; h <= 23; h++) {
        const label = `${h.toString().padStart(2, '0')}:00`;
        dataMap.set(label, { date: label, pendapatan: 0, transaksi: 0 });
      }
      filteredTransactions.forEach((t) => {
        const hour = new Date(t.timestamp).getHours();
        const label = `${hour.toString().padStart(2, '0')}:00`;
        const entry = dataMap.get(label)!;
        entry.pendapatan += t.total;
        entry.transaksi += 1;
      });
    } else if (period === 'week') {
      const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + d);
        const label = days[d];
        dataMap.set(label, { date: label, pendapatan: 0, transaksi: 0 });
      }
      filteredTransactions.forEach((t) => {
        const day = new Date(t.timestamp).getDay();
        const label = days[day];
        const entry = dataMap.get(label)!;
        entry.pendapatan += t.total;
        entry.transaksi += 1;
      });
    } else if (period === 'month') {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(now.getFullYear(), now.getMonth(), d);
        const label = formatShortDate(date);
        dataMap.set(label, { date: label, pendapatan: 0, transaksi: 0 });
      }
      filteredTransactions.forEach((t) => {
        const date = new Date(t.timestamp);
        const label = formatShortDate(date);
        const entry = dataMap.get(label);
        if (entry) {
          entry.pendapatan += t.total;
          entry.transaksi += 1;
        }
      });
    } else {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      months.forEach((m) => {
        dataMap.set(m, { date: m, pendapatan: 0, transaksi: 0 });
      });
      filteredTransactions.forEach((t) => {
        const month = months[new Date(t.timestamp).getMonth()];
        const entry = dataMap.get(month)!;
        entry.pendapatan += t.total;
        entry.transaksi += 1;
      });
    }

    return Array.from(dataMap.values());
  }, [filteredTransactions, period]);

  // Top 5 selling products
  const topProducts = useMemo(() => {
    const productSales = new Map<string, { name: string; total: number }>();

    filteredTransactions.forEach((t) => {
      t.items.forEach((item) => {
        const existing = productSales.get(item.name) || { name: item.name, total: 0 };
        existing.total += item.quantity;
        productSales.set(item.name, existing);
      });
    });

    return Array.from(productSales.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredTransactions]);

  // Revenue vs COGS data
  const revenueCOGS = useMemo(() => {
    const dataMap = new Map<string, { date: string; pendapatan: number; modal: number }>();

    if (period === 'today') {
      for (let h = 0; h <= 23; h++) {
        const label = `${h.toString().padStart(2, '0')}:00`;
        dataMap.set(label, { date: label, pendapatan: 0, modal: 0 });
      }
      filteredTransactions.forEach((t) => {
        const hour = new Date(t.timestamp).getHours();
        const label = `${hour.toString().padStart(2, '0')}:00`;
        const entry = dataMap.get(label)!;
        entry.pendapatan += t.total;
        entry.modal += t.items.reduce((sum, i) => sum + i.buyPrice * i.quantity, 0);
      });
    } else if (period === 'week') {
      const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      for (let d = 0; d < 7; d++) {
        dataMap.set(days[d], { date: days[d], pendapatan: 0, modal: 0 });
      }
      filteredTransactions.forEach((t) => {
        const day = new Date(t.timestamp).getDay();
        const label = days[day];
        const entry = dataMap.get(label)!;
        entry.pendapatan += t.total;
        entry.modal += t.items.reduce((sum, i) => sum + i.buyPrice * i.quantity, 0);
      });
    } else if (period === 'month') {
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(now.getFullYear(), now.getMonth(), d);
        const label = formatShortDate(date);
        dataMap.set(label, { date: label, pendapatan: 0, modal: 0 });
      }
      filteredTransactions.forEach((t) => {
        const date = new Date(t.timestamp);
        const label = formatShortDate(date);
        const entry = dataMap.get(label);
        if (entry) {
          entry.pendapatan += t.total;
          entry.modal += t.items.reduce((sum, i) => sum + i.buyPrice * i.quantity, 0);
        }
      });
    } else {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      months.forEach((m) => {
        dataMap.set(m, { date: m, pendapatan: 0, modal: 0 });
      });
      filteredTransactions.forEach((t) => {
        const months2 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const month = months2[new Date(t.timestamp).getMonth()];
        const entry = dataMap.get(month)!;
        entry.pendapatan += t.total;
        entry.modal += t.items.reduce((sum, i) => sum + i.buyPrice * i.quantity, 0);
      });
    }

    return Array.from(dataMap.values());
  }, [filteredTransactions, period]);

  // Best selling days calculation
  const bestDays = useMemo(() => {
    const daysName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const daysTotal = Array(7).fill(0).map((_, i) => ({ day: daysName[i], total: 0, count: 0 }));
    
    filteredTransactions.forEach((t) => {
      const dayIndex = new Date(t.timestamp).getDay();
      if (dayIndex >= 0 && dayIndex < 7) {
        daysTotal[dayIndex].total += t.total;
        daysTotal[dayIndex].count += 1;
      }
    });

    return daysTotal.sort((a, b) => b.total - a.total);
  }, [filteredTransactions]);

  // Filtered transactions that have discounts
  const discountTransactions = useMemo(() => {
    return filteredTransactions.filter(t => t.discount > 0);
  }, [filteredTransactions]);

  // Filtered and sorted transactions list specifically for the detail table
  const tableTransactions = useMemo(() => {
    let list = [...filteredTransactions];
    
    // Apply payment method filter
    if (paymentFilter !== 'all') {
      list = list.filter(t => (t.paymentMethod || 'cash') === paymentFilter);
    }
    
    // Apply sort key
    list.sort((a, b) => {
      const aCOGS = a.items.reduce((s, i) => s + (i.buyPrice || 0) * i.quantity, 0);
      const bCOGS = b.items.reduce((s, i) => s + (i.buyPrice || 0) * i.quantity, 0);
      const aProfit = a.total - aCOGS;
      const bProfit = b.total - bCOGS;
      
      switch (sortKey) {
        case 'date-asc':
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        case 'date-desc':
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        case 'discount-asc':
          return a.discount - b.discount;
        case 'discount-desc':
          return b.discount - a.discount;
        case 'revenue-asc':
          return a.total - b.total;
        case 'revenue-desc':
          return b.total - a.total;
        case 'profit-asc':
          return aProfit - bProfit;
        case 'profit-desc':
          return bProfit - aProfit;
        default:
          return 0;
      }
    });
    
    return list;
  }, [filteredTransactions, sortKey, paymentFilter]);

  const handleExportPDF = async () => {
    try {
      const profile = await db.storeProfile.get(1);
      const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
      });

      // Colors & Fonts
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(20);
      
      // Header Section
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(profile?.storeName || 'KASIR GUE', 14, 20);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      if (profile?.address) {
        doc.text(profile.address, 14, 25);
      }
      
      // Title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('LAPORAN ANALISA PENJUALAN & LABA RUGI', 14, 38);
      
      // Period
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      const periodLabel = periodOptions.find(o => o.key === period)?.label || period;
      doc.text(`Periode Laporan: ${periodLabel} (${new Date().toLocaleDateString('id-ID')})`, 14, 43);

      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(14, 47, 196, 47);

      // Section 1: Financial summary
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text('1. Ringkasan Keuangan', 14, 55);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      
      const totalCOGS = filteredTransactions.reduce((sum, t) => {
        return sum + t.items.reduce((s, i) => s + (i.buyPrice || 0) * i.quantity, 0);
      }, 0);

      // Simple Table
      let y = 62;
      const drawRow = (label: string, val: string, isBold = false) => {
        doc.setFont('Helvetica', isBold ? 'bold' : 'normal');
        doc.text(label, 16, y);
        doc.text(val, 120, y);
        doc.line(14, y + 2, 196, y + 2);
        y += 8;
      };
      
      drawRow('Total Pendapatan (Omset)', formatRupiah(stats.totalRevenue));
      drawRow('Total Modal (HPP / COGS)', formatRupiah(totalCOGS));
      drawRow('Total Keuntungan Bersih (Laba)', formatRupiah(stats.totalProfit), true);
      drawRow('Total Transaksi Sukses', stats.totalTransactions.toString());
      drawRow('Total Varian Produk Aktif', stats.totalProducts.toString());

      y += 5;
      
      // Section 2: Top Selling Products
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('2. Produk Terlaris (Top 5)', 14, y);
      y += 8;

      doc.setFont('Helvetica', 'bold');
      doc.text('Nama Produk', 16, y);
      doc.text('Jumlah Terjual', 120, y);
      doc.line(14, y + 2, 196, y + 2);
      y += 8;

      doc.setFont('Helvetica', 'normal');
      topProducts.forEach((p) => {
        doc.text(p.name, 16, y);
        doc.text(`${p.total} unit`, 120, y);
        doc.line(14, y + 2, 196, y + 2);
        y += 8;
      });

      if (topProducts.length === 0) {
        doc.text('Belum ada data produk terjual pada periode ini.', 16, y);
        y += 8;
      }

      y += 5;

      // Section 3: Restock Recommendations
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('3. Rekomendasi Saran Belanja (Stok Menipis)', 14, y);
      y += 8;

      doc.text('Nama Produk', 16, y);
      doc.text('Stok Saat Ini', 100, y);
      doc.text('Rekomendasi Belanja', 140, y);
      doc.line(14, y + 2, 196, y + 2);
      y += 8;

      doc.setFont('Helvetica', 'normal');
      lowStockProducts.forEach((p) => {
        doc.text(p.name, 16, y);
        doc.text(`${p.stock} unit`, 100, y);
        doc.setTextColor(16, 185, 129); // emerald-500
        doc.text(`+${30 - p.stock} unit`, 140, y);
        doc.setTextColor(30, 41, 59); // reset slate
        doc.line(14, y + 2, 196, y + 2);
        y += 8;
      });

      if (lowStockProducts.length === 0) {
        doc.text('Semua stok produk aman (di atas 5 unit).', 16, y);
        y += 8;
      }

      doc.save(`laporan-bisnis-${periodLabel.replace(' ', '-')}-${Date.now()}.pdf`);
      toast.success('Laporan PDF berhasil di-ekspor!');
    } catch (e) {
      console.error(e);
      toast.error('Gagal mengekspor laporan PDF');
    }
  };

  const summaryCards = [
    {
      label: 'Total Pendapatan',
      value: formatRupiah(stats.totalRevenue),
      icon: DollarSign,
      gradient: 'from-emerald-500 to-teal-600',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
    },
    {
      label: 'Total Keuntungan (Laba)',
      value: formatRupiah(stats.totalProfit),
      icon: TrendingUp,
      gradient: 'from-cyan-500 to-blue-600',
      iconBg: 'bg-cyan-500/20',
      iconColor: 'text-cyan-400',
    },
    {
      label: 'Total Transaksi',
      value: stats.totalTransactions.toString(),
      icon: ShoppingBag,
      gradient: 'from-blue-500 to-indigo-600',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
    },
    {
      label: 'Total Produk',
      value: stats.totalProducts.toString(),
      icon: Package,
      gradient: 'from-violet-500 to-purple-600',
      iconBg: 'bg-violet-500/20',
      iconColor: 'text-violet-400',
    },
    {
      label: 'Stok Menipis',
      value: stats.lowStockCount.toString(),
      icon: AlertTriangle,
      gradient: 'from-amber-500 to-orange-600',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
    },
  ];

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-white/10">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
            Dashboard
          </h1>
          <p className="text-slate-400 mt-1 ml-14">Ringkasan performa bisnis Anda</p>
        </div>
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-xl transition-all duration-200 cursor-pointer self-start sm:self-auto"
        >
          <FileDown className="w-4 h-4" />
          <span className="text-sm">Ekspor PDF</span>
        </button>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2 bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-1 w-fit">
        {periodOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setPeriod(opt.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
              period === opt.key
                ? 'bg-[hsl(var(--primary))] text-white shadow-lg shadow-[hsl(var(--primary))]/25'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-5 relative overflow-hidden group hover:border-white/20 transition-all duration-300"
          >
            {/* Gradient background decoration */}
            <div
              className={`absolute -top-12 -right-12 w-24 h-24 rounded-full bg-gradient-to-br ${card.gradient} opacity-10 group-hover:opacity-20 transition-opacity duration-300`}
            />

            <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center mb-3`}>
              <card.icon className={`w-5 h-5 ${card.iconColor}`} />
            </div>
            <p className="text-white font-bold text-lg md:text-xl truncate">{card.value}</p>
            <p className="text-slate-400 text-xs mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales bar chart */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
          <h3 className="text-white font-medium mb-4">Grafik Penjualan</h3>
          <div className="h-64">
            {salesChartData.some((d) => d.pendapatan > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval={period === 'month' ? 4 : undefined}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#fff',
                    }}
                    formatter={(value: any) => [formatRupiah(Number(value || 0)), 'Pendapatan']}
                  />
                  <Bar
                    dataKey="pendapatan"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Belum ada data penjualan</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top 5 products */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
          <h3 className="text-white font-medium mb-4">Top 5 Produk Terlaris</h3>
          <div className="h-64">
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                    tick={{ fill: '#94a3b8' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#fff',
                    }}
                    formatter={(value: any) => [`${value || 0} terjual`, 'Jumlah']}
                  />
                  <Bar
                    dataKey="total"
                    fill="hsl(var(--secondary))"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Belum ada data produk terlaris</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Revenue vs COGS */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
        <h3 className="text-white font-medium mb-4">Pendapatan vs Modal (HPP)</h3>
        <div className="h-72">
          {revenueCOGS.some((d) => d.pendapatan > 0 || d.modal > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueCOGS}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={period === 'month' ? 4 : undefined}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                  formatter={(value: any, name: any) => [
                    formatRupiah(Number(value || 0)),
                    name === 'pendapatan' ? 'Pendapatan' : 'Modal (HPP)',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="pendapatan"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
                />
                <Line
                  type="monotone"
                  dataKey="modal"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#f97316' }}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
              <div className="text-center">
                <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Belum ada data untuk ditampilkan</p>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }} />
            <span className="text-slate-400 text-xs">Pendapatan</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-slate-400 text-xs">Modal (HPP)</span>
          </div>
        </div>
      </div>

      {/* ── Section: Detail Penjualan Hari Terlaris & Diskon ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Hari Paling Laris */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6 flex flex-col">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2">
            <span className="text-emerald-400">📅</span>
            Analisis Hari Terlaris
          </h3>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px]">
            {bestDays.map((item, idx) => (
              <div key={item.day} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs font-mono w-5">#{idx + 1}</span>
                  <span className="text-white text-sm font-medium">{item.day}</span>
                </div>
                <div className="text-right">
                  <span className="text-primary text-sm font-bold block" style={{ color: 'hsl(var(--primary))' }}>{formatRupiah(item.total)}</span>
                  <span className="text-slate-400 text-[10px]">{item.count} transaksi</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Riwayat Diskon Produk */}
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6 flex flex-col">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2">
            <span className="text-red-400">🏷️</span>
            Riwayat Diskon Produk Diberikan
          </h3>
          <div className="overflow-y-auto max-h-[300px] space-y-2 pr-1 flex-1">
            {discountTransactions.length > 0 ? (
              discountTransactions.map((t) => (
                <div key={t.id} className="p-3 bg-slate-800/40 border border-white/5 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-slate-300 font-bold">{new Date(t.timestamp).toLocaleDateString('id-ID')}</span>
                      <span className="text-slate-500">{new Date(t.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-slate-400 truncate max-w-sm">
                      {t.items.map(i => `${i.name} (${i.quantity}x)`).join(', ')}
                    </p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-red-400 font-semibold bg-red-500/10 px-2 py-0.5 rounded block w-fit sm:ml-auto">
                      Potongan: -{formatRupiah(t.discount)}
                    </span>
                    <span className="text-slate-400 text-[10px] block mt-1">
                      Total Belanja: {formatRupiah(t.total)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-sm text-center py-12">Belum ada transaksi dengan diskon.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Section: Riwayat Transaksi Lengkap ── */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="text-white font-medium flex items-center gap-2">
            <span>📋</span>
            Daftar Transaksi Lengkap (Laba & Rugi)
          </h3>
          
          {/* Controls Panel */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Pembayaran */}
            <div className="flex items-center gap-1.5 bg-slate-800/60 border border-white/10 rounded-xl px-3 py-1.5">
              <span className="text-[10px] text-slate-400 font-medium">Metode:</span>
              <select 
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="bg-transparent text-white text-xs outline-none cursor-pointer pr-2 border-none"
              >
                <option value="all" className="bg-slate-950 text-white">Semua</option>
                <option value="cash" className="bg-slate-950 text-white">Tunai (Cash)</option>
                <option value="qris" className="bg-slate-950 text-white">QRIS</option>
              </select>
            </div>

            {/* Sort Key */}
            <div className="flex items-center gap-1.5 bg-slate-800/60 border border-white/10 rounded-xl px-3 py-1.5">
              <span className="text-[10px] text-slate-400 font-medium">Urutan:</span>
              <select 
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="bg-transparent text-white text-xs outline-none cursor-pointer pr-2 border-none"
              >
                <option value="date-desc" className="bg-slate-950 text-white">Waktu: Terbaru → Terlama</option>
                <option value="date-asc" className="bg-slate-950 text-white">Waktu: Terlama → Terbaru</option>
                <option value="discount-desc" className="bg-slate-950 text-white">Diskon: Terbesar → Terkecil</option>
                <option value="discount-asc" className="bg-slate-950 text-white">Diskon: Terkecil → Terbesar</option>
                <option value="revenue-desc" className="bg-slate-950 text-white">Nominal: Terbesar → Terkecil</option>
                <option value="revenue-asc" className="bg-slate-950 text-white">Nominal: Terkecil → Terbesar</option>
                <option value="profit-desc" className="bg-slate-950 text-white">Laba: Terbesar → Terkecil</option>
                <option value="profit-asc" className="bg-slate-950 text-white">Laba: Terkecil → Terbesar</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto pr-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 font-semibold sticky top-0 bg-slate-900/90 py-2">
                <th className="py-3 px-2">Tanggal & Jam</th>
                <th className="py-3 px-2">Detail Produk</th>
                <th className="py-3 px-2 text-center">Metode</th>
                <th className="py-3 px-2 text-right">Subtotal</th>
                <th className="py-3 px-2 text-right">Diskon</th>
                <th className="py-3 px-2 text-right">Pendapatan</th>
                <th className="py-3 px-2 text-right">Modal (HPP)</th>
                <th className="py-3 px-2 text-right">Laba/Rugi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {tableTransactions.map((t) => {
                const totalCOGS = t.items.reduce((s, i) => s + (i.buyPrice || 0) * i.quantity, 0);
                const profit = t.total - totalCOGS;
                
                return (
                  <tr key={t.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-2 whitespace-nowrap">
                      <div>{new Date(t.timestamp).toLocaleDateString('id-ID')}</div>
                      <div className="text-[10px] text-slate-500">{new Date(t.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="py-3 px-2 max-w-[200px] truncate">
                      {t.items.map(i => `${i.name} (${i.quantity}x)`).join(', ')}
                    </td>
                    <td className="py-3 px-2 text-center whitespace-nowrap">
                      {t.paymentMethod === 'qris' ? (
                        <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded text-[10px] font-medium">
                          📱 QRIS
                        </span>
                      ) : (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-medium">
                          💵 Tunai
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right font-mono">{formatRupiah(t.subtotal)}</td>
                    <td className="py-3 px-2 text-right font-mono text-red-400">
                      {t.discount > 0 ? `-${formatRupiah(t.discount)}` : '-'}
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-semibold text-white">{formatRupiah(t.total)}</td>
                    <td className="py-3 px-2 text-right font-mono text-slate-400">{formatRupiah(totalCOGS)}</td>
                    <td className={`py-3 px-2 text-right font-mono font-semibold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {profit >= 0 ? '+' : ''}{formatRupiah(profit)}
                    </td>
                  </tr>
                );
              })}
              {tableTransactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Tidak ada transaksi yang cocok dengan kriteria filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low stock alert section */}
      {lowStockProducts.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl p-6">
          <h3 className="text-amber-200 font-medium mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Produk Stok Menipis (≤ 5) & Saran Belanja
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 bg-slate-900/50 border border-white/10 rounded-xl p-3"
              >
                {p.photo ? (
                  <img src={p.photo} alt={p.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-slate-600" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">{p.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-red-400 text-xs font-semibold">Stok: {p.stock}</p>
                    <p className="text-emerald-400 text-xs font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      Belanja: +{30 - p.stock}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
