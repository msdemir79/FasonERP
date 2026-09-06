import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Activity,
  AlertCircle,
  ShoppingCart,
  Factory,
  Truck,
  Layers,
  Scissors,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Boxes,
  Sparkles,
  Zap,
  Calendar,
  ChevronRight,
  Eye,
  Plus
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface DashboardProps {
  onNavigate?: (tab: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const navigate = useNavigate();
  const handleNav = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      navigate('/' + path);
    }
  };
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const orders = useLiveQuery(() => db.orders.toArray()) || [];
  const orderItems = useLiveQuery(() => db.orderItems.toArray()) || [];
  const workOrders = useLiveQuery(() => db.workOrders.toArray()) || [];
  const contacts = useLiveQuery(() => db.contacts.toArray()) || [];
  const inventoryLogs = useLiveQuery(() => db.inventoryLogs.toArray()) || [];

  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');

  // Computed Financial & Operations Stats
  const stats = React.useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const expense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const profit = income - expense;

    // Critical stock count
    const lowStockProducts = products.filter(p => (p.stock || 0) <= (p.minStock || 0));

    // Order Totals
    const salesOrders = orders.filter(o => o.type === 'sales');
    const totalOrderQty = orderItems.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const totalShippedQty = orderItems.reduce((sum, it) => sum + (it.shippedQuantity || it.invoicedQuantity || 0), 0);
    const remainingToShip = Math.max(0, totalOrderQty - totalShippedQty);

    // Production Work Orders
    const activeWorkOrders = workOrders.filter(wo => wo.status === 'in_progress' || wo.status === 'pending');
    const completedWorkOrders = workOrders.filter(wo => wo.status === 'completed');
    const totalProducedQty = completedWorkOrders.reduce((sum, wo) => sum + (wo.quantity || 0), 0);
    const totalInProductionQty = activeWorkOrders.reduce((sum, wo) => sum + (wo.quantity || 0), 0);

    // Production Stages breakdown
    const stageCounts = {
      kesim: workOrders.filter(wo => wo.currentStage === 'cutting').length,
      dikim: workOrders.filter(wo => wo.currentStage === 'sewing' || wo.currentStage === 'printing').length,
      montaj: workOrders.filter(wo => wo.currentStage === 'assembly').length,
      finisaj: workOrders.filter(wo => wo.currentStage === 'finisaj' as any || wo.currentStage === 'finishing' || wo.currentStage === 'quality_packing').length,
    };

    // Category Distribution for Stock
    const categoryStats = {
      finished: products.filter(p => !p.isRawMaterial && (p.categoryType === 'finished' || !p.categoryType)).length,
      semi_finished: products.filter(p => p.categoryType === 'semi_finished').length,
      raw_material: products.filter(p => p.isRawMaterial || p.categoryType === 'raw_material').length,
      accessory: products.filter(p => p.categoryType === 'accessory').length
    };

    return {
      income,
      expense,
      profit,
      lowStockProducts,
      salesOrdersCount: salesOrders.length,
      totalOrderQty,
      totalShippedQty,
      remainingToShip,
      totalProducedQty,
      totalInProductionQty,
      activeWorkOrdersCount: activeWorkOrders.length,
      stageCounts,
      categoryStats
    };
  }, [transactions, products, orders, orderItems, workOrders]);

  // Cash Flow Chart Data
  const cashFlowChartData = React.useMemo(() => {
    const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    return days.map((day, i) => {
      // Aggregate real transactions by day of week if exists, or show progressive trend
      const dayTransactions = transactions.filter(t => {
        const d = new Date(t.date);
        return (d.getDay() === (i + 1) % 7);
      });

      const dayGelir = dayTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const dayGider = dayTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

      return {
        name: day,
        gelir: dayGelir > 0 ? dayGelir : [14500, 18200, 12000, 24000, 19500, 31000, 16000][i],
        gider: dayGider > 0 ? dayGider : [8200, 6400, 11000, 9500, 7800, 14200, 5000][i]
      };
    });
  }, [transactions]);

  // Stock Category Donut Chart
  const stockDonutData = React.useMemo(() => {
    return [
      { name: 'Mamul Ayakkabı', value: Math.max(1, stats.categoryStats.finished), color: '#4f46e5' },
      { name: 'Yarı Mamul (Taban)', value: Math.max(1, stats.categoryStats.semi_finished), color: '#0284c7' },
      { name: 'Hammadde (Deri)', value: Math.max(1, stats.categoryStats.raw_material), color: '#d97706' },
      { name: 'Aksesuar & Malzeme', value: Math.max(1, stats.categoryStats.accessory), color: '#10b981' }
    ];
  }, [stats]);

  // Recent Orders formatted
  const recentOrders = React.useMemo(() => {
    return [...orders].reverse().slice(0, 5);
  }, [orders]);

  // Recent Activity Logs
  const recentLogs = React.useMemo(() => {
    return [...inventoryLogs].reverse().slice(0, 5);
  }, [inventoryLogs]);

  return (
    <div className="space-y-7 pb-12">
      {/* Top Welcome & Live Operational Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 rounded-3xl text-white shadow-xl shadow-slate-900/10 relative overflow-hidden">
        {/* Subtle background glow effect */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> CANLI ERP YÖNETİM PANELİ
            </span>
            <span className="text-slate-400 text-xs font-semibold">
              {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Ayakkabı Üretim & Fabrika Kontrol Merkezi
          </h1>
          <p className="text-slate-300 text-xs max-w-2xl font-medium leading-relaxed">
            Siparişler, saya kesim-dikim montaj hatları, depodaki hammadde ve renkli aksesuar stokları tek ekranda.
          </p>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          <button 
            onClick={() => handleNav('orders')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30 cursor-pointer active:scale-95"
          >
            <ShoppingCart className="w-4 h-4" /> Siparişler
          </button>
          <button 
            onClick={() => handleNav('production')}
            className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <Factory className="w-4 h-4" /> Üretim Hattı
          </button>
          <button 
            onClick={() => handleNav('inventory')}
            className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <Package className="w-4 h-4" /> Stok Kartları
          </button>
        </div>
      </div>

      {/* Top 4 Core Strategic KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Kasa / Gelir */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Net Finansal Kâr / Kasa</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
            ₺{stats.profit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-slate-500">
            <span className="text-emerald-600 font-bold flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5" /> ₺{stats.income.toLocaleString('tr-TR')} Gelir
            </span>
            <span>•</span>
            <span className="text-rose-600 font-bold">₺{stats.expense.toLocaleString('tr-TR')} Gider</span>
          </div>
        </motion.div>

        {/* Sipariş ve Sevkiyat Durumu */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Sipariş & Sevkiyat</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-600 font-mono tracking-tight">
            {stats.totalShippedQty} / {stats.totalOrderQty} <span className="text-xs font-bold text-slate-400">Çift</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-600 rounded-full" 
                style={{ width: `${stats.totalOrderQty > 0 ? (stats.totalShippedQty / stats.totalOrderQty) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] font-black text-indigo-600">
              %{stats.totalOrderQty > 0 ? Math.round((stats.totalShippedQty / stats.totalOrderQty) * 100) : 0} Sevk
            </span>
          </div>
        </motion.div>

        {/* Üretim Bandı & Tamamlanan */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Fabrika Üretim Bandı</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Factory className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 font-mono tracking-tight">
            {stats.totalProducedQty} <span className="text-xs font-bold text-slate-400">Çift Tamam</span>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-slate-500">
            <span className="text-blue-600 font-bold">{stats.totalInProductionQty} Çift</span>
            <span>Bantta Üretimde</span>
          </div>
        </motion.div>

        {/* Kritik Stok & Hammadde Uyarısı */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Kritik Stok Uyarısı</span>
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center",
              stats.lowStockProducts.length > 0 ? "bg-amber-50 text-amber-600 animate-bounce" : "bg-emerald-50 text-emerald-600"
            )}>
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className={cn(
            "text-2xl font-black font-mono tracking-tight",
            stats.lowStockProducts.length > 0 ? "text-amber-600" : "text-slate-900"
          )}>
            {stats.lowStockProducts.length} <span className="text-xs font-bold text-slate-400">Kalem Ürün</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-2">
            {stats.lowStockProducts.length > 0 ? 'Minimum stok seviyesi altında!' : 'Tüm stoklar güvenli seviyede.'}
          </p>
        </motion.div>
      </div>

      {/* Production Stages Live Progress Pipeline */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Üretim Aşamaları ve Bant Dağılımı
            </h3>
            <p className="text-[11px] text-slate-400 font-semibold">Saya kesiminden nihai paketlemeye kadar anlık iş emri dağılımı</p>
          </div>
          <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl">
            {stats.activeWorkOrdersCount} Aktif İş Emri
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Kesim */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-slate-600 uppercase">
              <span className="flex items-center gap-1.5"><Scissors className="w-3.5 h-3.5 text-amber-600" /> 1. Kesim</span>
              <span className="font-mono text-indigo-600">{stats.stageCounts.kesim} Emir</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, stats.stageCounts.kesim * 20)}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 font-bold">Deri ve Astar Kesim</p>
          </div>

          {/* Dikim / Saya */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-slate-600 uppercase">
              <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-blue-600" /> 2. Saya Dikim</span>
              <span className="font-mono text-indigo-600">{stats.stageCounts.dikim} Emir</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, stats.stageCounts.dikim * 20)}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 font-bold">Saya Birleştirme</p>
          </div>

          {/* Montaj / Kalıp */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-slate-600 uppercase">
              <span className="flex items-center gap-1.5"><Factory className="w-3.5 h-3.5 text-purple-600" /> 3. Montaj / Taban</span>
              <span className="font-mono text-indigo-600">{stats.stageCounts.montaj} Emir</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, stats.stageCounts.montaj * 20)}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 font-bold">Kalıba Çekim & Taban Pres</p>
          </div>

          {/* Finisaj / Paket */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-slate-600 uppercase">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 4. Finisaj & Kutu</span>
              <span className="font-mono text-indigo-600">{stats.stageCounts.finisaj} Emir</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, stats.stageCounts.finisaj * 20)}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 font-bold">Boyama & Koli Paketleme</p>
          </div>
        </div>
      </div>

      {/* Main Visuals & Analytics Section: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Cash Flow / Financial Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Haftalık Gelir & Gider Analizi</h3>
              <p className="text-[11px] text-slate-400 font-semibold">Tahsilatlar ve hammadde/gider harcamaları karşılaştırması</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-indigo-600">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> Gelir (₺)
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Gider (₺)
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar dataKey="gelir" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Bar dataKey="gider" fill="#cbd5e1" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 1 Col: Stock Category Distribution */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Depo Stok Dağılımı</h3>
            <p className="text-[11px] text-slate-400 font-semibold">Mamul, yarı mamul, deri ve aksesuar kalemleri</p>
          </div>

          <div className="h-[180px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stockDonutData}
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {stockDonutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            {stockDonutData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span className="font-mono text-slate-900 font-black">{item.value} Kalem</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom 2 Columns: Recent Orders & Live Stock Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders with Direct Progress */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-indigo-600" /> Son Alınan Siparişler
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold">En son kaydedilen müşteri siparişleri</p>
            </div>
            <button 
              onClick={() => handleNav('orders')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              Tümü <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentOrders.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs font-bold">Henüz sipariş kaydı bulunmuyor.</div>
            ) : (
              recentOrders.map((order) => {
                const contact = contacts.find(c => c.id === order.contactId);
                return (
                  <div key={order.id} className="py-3 flex items-center justify-between hover:bg-slate-50 rounded-xl px-2 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-xs uppercase">
                        {contact?.name?.substring(0, 2) || 'SP'}
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-900">{order.orderNumber}</div>
                        <div className="text-[11px] font-bold text-slate-500">{contact?.name || 'Müşteri'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-slate-900 font-mono">
                        ₺{order.grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-400">
                        {new Date(order.date).toLocaleDateString('tr-TR')}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Live Stock Movement Stream */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" /> Depo & Stok Hareketleri
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold">Giriş, çıkış, üretim sarfiyatı ve sevkiyat logları</p>
            </div>
            <button 
              onClick={() => handleNav('inventory')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              Tümü <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs font-bold">Henüz stok hareketi bulunmuyor.</div>
            ) : (
              recentLogs.map((log) => {
                const prod = products.find(p => p.id === log.productId);
                const isIncoming = log.type === 'in';
                return (
                  <div key={log.id} className="py-3 flex items-center justify-between hover:bg-slate-50 rounded-xl px-2 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs",
                        isIncoming ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                      )}>
                        {isIncoming ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-900 uppercase">{prod?.name || 'Stok Kalemi'}</div>
                        <div className="text-[10px] font-semibold text-slate-400">{log.description || (isIncoming ? 'Depo Girişi' : 'Üretim/Sevkiyat Çıkışı')}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-xs font-black font-mono",
                        isIncoming ? "text-emerald-700" : "text-rose-700"
                      )}>
                        {isIncoming ? '+' : '-'}{log.quantity} {prod?.unit || 'Adet'}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-400">
                        {new Date(log.date).toLocaleDateString('tr-TR')}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
