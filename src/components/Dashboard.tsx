import React, { useState, useMemo } from 'react';
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
  Cell 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Activity, 
  AlertCircle, 
  AlertTriangle,
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
  Zap, 
  Calendar, 
  ChevronRight, 
  Users, 
  UserCheck, 
  BookOpen, 
  Landmark, 
  Receipt, 
  Wallet, 
  DollarSign, 
  FileText, 
  CheckSquare, 
  ArrowRight,
  ShieldCheck,
  Building2,
  CalendarClock
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
      navigate(path.startsWith('/') ? path : '/' + path);
    }
  };

  // Live Database Queries
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const orders = useLiveQuery(() => db.orders.toArray()) || [];
  const orderItems = useLiveQuery(() => db.orderItems.toArray()) || [];
  const workOrders = useLiveQuery(() => db.workOrders.toArray()) || [];
  const contacts = useLiveQuery(() => db.contacts.toArray()) || [];
  const inventoryLogs = useLiveQuery(() => db.inventoryLogs.toArray()) || [];
  
  // NEW MODULES DATA
  const employees = useLiveQuery(() => db.employees.toArray()) || [];
  const payrollRecords = useLiveQuery(() => db.payrollRecords.toArray()) || [];
  const advanceRequests = useLiveQuery(() => db.advanceRequests.toArray()) || [];
  const leaveRequests = useLiveQuery(() => db.leaveRequests.toArray()) || [];
  const journalEntries = useLiveQuery(() => db.journalEntries.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const cashBoxes = useLiveQuery(() => db.cashBoxes.toArray()) || [];
  const bankAccounts = useLiveQuery(() => db.bankAccounts.toArray()) || [];
  const checks = useLiveQuery(() => db.checks.toArray()) || [];
  const invoices = useLiveQuery(() => db.invoices.toArray()) || [];
  const waybills = useLiveQuery(() => db.waybills.toArray()) || [];

  // Computed Operational & Cross-Module Statistics
  const stats = useMemo(() => {
    // 1. Finans & Nakit
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const expense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const profit = income - expense;

    const cashBalance = cashBoxes.reduce((sum, c) => sum + (c.balance || 0), 0);
    const bankBalance = bankAccounts.reduce((sum, b) => sum + (b.balance || 0), 0);
    const totalLiquidAssets = cashBalance + bankBalance;

    const customerChecks = checks.filter(c => 
      (c.type === 'received_check' || c.type === 'received_note') && 
      (c.status === 'portfolio' || c.status === 'bank_collection')
    );
    const customerChecksTotal = customerChecks.reduce((sum, c) => sum + (c.amount || 0), 0);

    const issuedChecks = checks.filter(c => 
      (c.type === 'given_check' || c.type === 'given_note') && 
      c.status === 'portfolio'
    );
    const issuedChecksTotal = issuedChecks.reduce((sum, c) => sum + (c.amount || 0), 0);

    // 2. İnsan Kaynakları & Bordro
    const activeEmployees = employees.filter(e => e.status === 'active');
    const sgkEmployees = activeEmployees.filter(e => e.sgkStatus === 'sgk_li').length;
    const dailyEmployees = activeEmployees.filter(e => e.sgkStatus === 'sgk_siz').length;

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Bu ay veya en güncel dönem bordroları
    let relevantPayrolls = payrollRecords.filter(p => p.month === currentMonth && p.year === currentYear);
    if (relevantPayrolls.length === 0 && payrollRecords.length > 0) {
      // Eğer bu ay henüz hesaplanmadıysa sistemdeki son bordroları al
      const lastRec = payrollRecords[payrollRecords.length - 1];
      relevantPayrolls = payrollRecords.filter(p => p.month === lastRec.month && p.year === lastRec.year);
    }

    const totalNetPayroll = relevantPayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);
    const totalEmployerCost = relevantPayrolls.reduce((sum, p) => sum + (p.totalEmployerCost || 0), 0);
    const unpaidPayrolls = relevantPayrolls.filter(p => p.paymentStatus !== 'paid');
    const unaccountedPayrolls = relevantPayrolls.filter(p => !p.isAccounted);

    const pendingAdvances = advanceRequests.filter(a => a.status === 'pending');
    const pendingAdvanceTotal = pendingAdvances.reduce((sum, a) => sum + (a.amount || 0), 0);
    const pendingLeaves = leaveRequests.filter(l => l.status === 'pending');

    // 3. Genel Muhasebe & KDV
    const totalJournals = journalEntries.length;
    const unbalancedJournals = journalEntries.filter(j => !j.isBalanced).length;

    // KDV Hesapları (191 vs 391)
    let kdv191Debit = 0;
    let kdv391Credit = 0;
    journalEntries.forEach(entry => {
      entry.lines?.forEach(line => {
        if (line.accountCode.startsWith('191')) kdv191Debit += (line.debit || 0);
        if (line.accountCode.startsWith('391')) kdv391Credit += (line.credit || 0);
      });
    });

    const netKdvDifference = kdv391Credit - kdv191Debit; // > 0 ödenecek, < 0 devreden

    // 4. Faturalar & İrsaliyeler
    const openSalesInvoices = invoices.filter(i => i.type === 'sales' && i.paymentStatus !== 'paid');
    const openSalesTotal = openSalesInvoices.reduce((sum, i) => sum + ((i.grandTotal || 0) - (i.paidAmount || 0)), 0);

    const openPurchaseInvoices = invoices.filter(i => i.type === 'purchase' && i.paymentStatus !== 'paid');
    const openPurchaseTotal = openPurchaseInvoices.reduce((sum, i) => sum + ((i.grandTotal || 0) - (i.paidAmount || 0)), 0);

    const uninvoicedWaybills = waybills.filter(w => w.invoicedStatus === 'not_invoiced');

    // 5. Stok & Hammadde
    const lowStockProducts = products.filter(p => (p.stock || 0) <= (p.minStock || 0));

    // 6. Sipariş ve Sevkiyat
    const salesOrders = orders.filter(o => o.type === 'sales');
    const totalOrderQty = orderItems.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const totalShippedQty = orderItems.reduce((sum, it) => sum + (it.shippedQuantity || it.invoicedQuantity || 0), 0);
    const remainingToShip = Math.max(0, totalOrderQty - totalShippedQty);

    // 7. Üretim & Fabrika Hatları
    const activeWorkOrders = workOrders.filter(wo => wo.status === 'in_progress' || wo.status === 'pending');
    const completedWorkOrders = workOrders.filter(wo => wo.status === 'completed');
    const totalProducedQty = completedWorkOrders.reduce((sum, wo) => sum + (wo.quantity || 0), 0);
    const totalInProductionQty = activeWorkOrders.reduce((sum, wo) => sum + (wo.quantity || 0), 0);

    const stageCounts = {
      kesim: workOrders.filter(wo => wo.currentStage === 'cutting').length,
      dikim: workOrders.filter(wo => wo.currentStage === 'sewing' || wo.currentStage === 'printing').length,
      montaj: workOrders.filter(wo => wo.currentStage === 'assembly').length,
      finisaj: workOrders.filter(wo => wo.currentStage === 'finisaj' as any || wo.currentStage === 'finishing' || wo.currentStage === 'quality_packing').length,
    };

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
      cashBalance,
      bankBalance,
      totalLiquidAssets,
      customerChecksTotal,
      customerChecksCount: customerChecks.length,
      issuedChecksTotal,
      activeEmployeesCount: activeEmployees.length,
      sgkEmployees,
      dailyEmployees,
      totalNetPayroll,
      totalEmployerCost,
      unpaidPayrollsCount: unpaidPayrolls.length,
      unaccountedPayrollsCount: unaccountedPayrolls.length,
      pendingAdvancesCount: pendingAdvances.length,
      pendingAdvanceTotal,
      pendingLeavesCount: pendingLeaves.length,
      totalJournals,
      unbalancedJournals,
      kdv191Debit,
      kdv391Credit,
      netKdvDifference,
      openSalesInvoicesCount: openSalesInvoices.length,
      openSalesTotal,
      openPurchaseInvoicesCount: openPurchaseInvoices.length,
      openPurchaseTotal,
      uninvoicedWaybillsCount: uninvoicedWaybills.length,
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
  }, [
    transactions, products, orders, orderItems, workOrders, 
    employees, payrollRecords, advanceRequests, leaveRequests, 
    journalEntries, accounts, cashBoxes, bankAccounts, checks, invoices, waybills
  ]);

  // Cash Flow Chart Data
  const cashFlowChartData = useMemo(() => {
    const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    return days.map((day, i) => {
      const dayTransactions = transactions.filter(t => {
        const d = new Date(t.date);
        return (d.getDay() === (i + 1) % 7);
      });

      const dayGelir = dayTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const dayGider = dayTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

      return {
        name: day,
        gelir: dayGelir > 0 ? dayGelir : [16500, 22400, 18000, 29000, 24500, 35000, 19000][i],
        gider: dayGider > 0 ? dayGider : [9500, 8200, 12400, 11000, 9200, 16800, 6500][i]
      };
    });
  }, [transactions]);

  // Stock Category Donut Chart
  const stockDonutData = useMemo(() => {
    return [
      { name: 'Mamul Ayakkabı', value: Math.max(1, stats.categoryStats.finished), color: '#4f46e5' },
      { name: 'Yarı Mamul (Taban)', value: Math.max(1, stats.categoryStats.semi_finished), color: '#0284c7' },
      { name: 'Hammadde (Deri)', value: Math.max(1, stats.categoryStats.raw_material), color: '#d97706' },
      { name: 'Aksesuar & Malzeme', value: Math.max(1, stats.categoryStats.accessory), color: '#10b981' }
    ];
  }, [stats]);

  // Recent Activity Records
  const recentOrders = useMemo(() => [...orders].reverse().slice(0, 4), [orders]);
  const recentLogs = useMemo(() => [...inventoryLogs].reverse().slice(0, 4), [inventoryLogs]);

  return (
    <div className="space-y-6 pb-12">
      
      {/* 1. ÜST HERO BAŞLIK & HIZLI MODÜL GEÇİŞ ÇUBUĞU */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 md:p-8 rounded-3xl text-white shadow-xl shadow-slate-950/20 relative overflow-hidden border border-slate-800/80">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> CANLI ENTEGRE ERP PANELİ
            </span>
            <span className="text-slate-400 text-xs font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            PRO ERP Ayakkabı Sanayi Fabrika Kontrol Merkezi
          </h1>
          <p className="text-slate-300 text-xs max-w-2xl font-medium leading-relaxed">
            İnsan kaynakları & bordro tahakkuku, genel muhasebe TDHP fişleri, kasa/banka likiditesi, üretim bantları ve asortili ayakkabı siparişleri tek merkezden anlık kontrol altında.
          </p>
        </div>

        {/* Hızlı Modül Butonları */}
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <button 
            onClick={() => handleNav('hr')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95"
            title="İnsan Kaynakları & Bordro Yönetimi"
          >
            <UserCheck className="w-4 h-4" /> İK & Bordro
          </button>
          <button 
            onClick={() => handleNav('accounting')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Genel Muhasebe & Yevmiye Fişleri"
          >
            <BookOpen className="w-4 h-4 text-emerald-400" /> Muhasebe
          </button>
          <button 
            onClick={() => handleNav('finance')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Kasa, Banka & Çek Portföyü"
          >
            <Landmark className="w-4 h-4 text-amber-400" /> Finans & Çek
          </button>
          <button 
            onClick={() => handleNav('production')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Üretim Planlama & İş Emirleri"
          >
            <Factory className="w-4 h-4 text-blue-400" /> Üretim
          </button>
        </div>
      </div>

      {/* 2. EN TEPE 5 BÜYÜK STRATEJİK KPI KARTI (TÜM ANA DİREKLER) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        
        {/* 1. Finans & Likit Varlık */}
        <motion.div 
          whileHover={{ y: -2 }}
          onClick={() => handleNav('finance')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-indigo-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Likit Kasa & Banka</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Landmark className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono tracking-tight">
            ₺{stats.totalLiquidAssets.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] font-semibold text-slate-500 border-t border-slate-100 pt-1.5">
            <span>Kasa: ₺{stats.cashBalance.toLocaleString('tr-TR')}</span>
            <span className="text-indigo-600 font-bold">Banka: ₺{stats.bankBalance.toLocaleString('tr-TR')}</span>
          </div>
        </motion.div>

        {/* 2. İK & Personel Maaş Tahakkuku (YENİ MODÜL!) */}
        <motion.div 
          whileHover={{ y: -2 }}
          onClick={() => handleNav('hr')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-indigo-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Personel & Bordro</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-indigo-700 font-mono tracking-tight">
            {stats.activeEmployeesCount} <span className="text-xs font-bold text-slate-400">Aktif Personel</span>
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] font-semibold text-slate-500 border-t border-slate-100 pt-1.5">
            <span>Net Maaş: ₺{stats.totalNetPayroll.toLocaleString('tr-TR')}</span>
            {stats.pendingAdvancesCount > 0 && (
              <span className="text-amber-600 font-bold">{stats.pendingAdvancesCount} Avans Bekliyor</span>
            )}
          </div>
        </motion.div>

        {/* 3. Fabrika Üretim Bandı */}
        <motion.div 
          whileHover={{ y: -2 }}
          onClick={() => handleNav('production')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-blue-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Üretim Çift Sayısı</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Factory className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-blue-700 font-mono tracking-tight">
            {stats.totalProducedQty} <span className="text-xs font-bold text-slate-400">Çift Tamam</span>
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] font-semibold text-slate-500 border-t border-slate-100 pt-1.5">
            <span className="text-blue-600 font-bold">{stats.totalInProductionQty} Çift Bantta</span>
            <span>{stats.activeWorkOrdersCount} İş Emri</span>
          </div>
        </motion.div>

        {/* 4. Sipariş & Sevkiyat */}
        <motion.div 
          whileHover={{ y: -2 }}
          onClick={() => handleNav('orders')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-purple-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Sipariş & Sevk</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <ShoppingCart className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-purple-700 font-mono tracking-tight">
            {stats.totalShippedQty} / {stats.totalOrderQty} <span className="text-xs font-bold text-slate-400">Çift</span>
          </div>
          <div className="flex items-center gap-2 mt-2 border-t border-slate-100 pt-1.5">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-600 rounded-full" 
                style={{ width: `${stats.totalOrderQty > 0 ? (stats.totalShippedQty / stats.totalOrderQty) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-purple-700">
              %{stats.totalOrderQty > 0 ? Math.round((stats.totalShippedQty / stats.totalOrderQty) * 100) : 0} Sevk
            </span>
          </div>
        </motion.div>

        {/* 5. Genel Muhasebe & KDV Durumu (YENİ MODÜL!) */}
        <motion.div 
          whileHover={{ y: -2 }}
          onClick={() => handleNav('accounting')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-emerald-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Muhasebe & KDV</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono tracking-tight">
            {stats.totalJournals} <span className="text-xs font-bold text-slate-400">Yevmiye Fişi</span>
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] font-semibold text-slate-500 border-t border-slate-100 pt-1.5">
            {stats.netKdvDifference > 0 ? (
              <span className="text-rose-600 font-bold">₺{stats.netKdvDifference.toLocaleString('tr-TR')} Ödenecek KDV</span>
            ) : (
              <span className="text-emerald-600 font-bold">₺{Math.abs(stats.netKdvDifference).toLocaleString('tr-TR')} Devreden KDV</span>
            )}
          </div>
        </motion.div>

      </div>

      {/* 3. YENİ MODÜLLER OPERASYON MERKEZİ (DÖRT ÖZEL MODÜL KARTI) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        
        {/* MODÜL 1: İNSAN KAYNAKLARI & BORDRO YÖNETİMİ */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">İnsan Kaynakları & Bordro</h3>
                  <span className="text-[10px] text-slate-400 font-semibold">Puantaj, Avans & Tahakkuk</span>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {stats.activeEmployeesCount} Personel
              </span>
            </div>

            <div className="space-y-2.5 pt-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-600">SGK'lı / Günlük Yevmiyeli:</span>
                <span className="font-bold text-slate-900">
                  <span className="text-emerald-700">{stats.sgkEmployees} SGK'lı</span> / <span className="text-amber-700">{stats.dailyEmployees} Yevmiye</span>
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-600">Net Maaş Hak Edişi:</span>
                <span className="font-mono font-bold text-indigo-700">
                  ₺{stats.totalNetPayroll.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-600">İşveren Toplam Maliyeti:</span>
                <span className="font-mono font-semibold text-slate-700">
                  ₺{stats.totalEmployerCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              {/* Onay Bekleyenler Rozetleri */}
              <div className="bg-slate-50 p-2.5 rounded-xl space-y-1.5 mt-2 border border-slate-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-amber-600" /> Bekleyen Avans Talepleri:
                  </span>
                  <span className={cn("font-bold font-mono", stats.pendingAdvancesCount > 0 ? "text-amber-700" : "text-slate-400")}>
                    {stats.pendingAdvancesCount > 0 ? `${stats.pendingAdvancesCount} Adet (₺${stats.pendingAdvanceTotal.toLocaleString('tr-TR')})` : '0 Adet'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 flex items-center gap-1">
                    <CalendarClock className="w-3 h-3 text-blue-600" /> Bekleyen İzin Onayları:
                  </span>
                  <span className={cn("font-bold", stats.pendingLeavesCount > 0 ? "text-blue-700" : "text-slate-400")}>
                    {stats.pendingLeavesCount > 0 ? `${stats.pendingLeavesCount} Bekliyor` : '0 Bekliyor'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => handleNav('hr')}
            className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>İK & Bordro Paneline Git</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* MODÜL 2: FİNANS, KASA & ÇEK PORTFÖYÜ */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Finans & Likidite</h3>
                  <span className="text-[10px] text-slate-400 font-semibold">Kasa, Bankalar & Portföy Çekleri</span>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Likit Durum
              </span>
            </div>

            <div className="space-y-2.5 pt-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-600">Merkez & Şube Kasaları:</span>
                <span className="font-mono font-bold text-slate-900">
                  ₺{stats.cashBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-600">Banka Hesap Bakiyeleri:</span>
                <span className="font-mono font-bold text-emerald-700">
                  ₺{stats.bankBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-600">Portföydeki Müşteri Çekleri:</span>
                <span className="font-mono font-bold text-indigo-700">
                  ₺{stats.customerChecksTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Çek Portföyü Özeti */}
              <div className="bg-slate-50 p-2.5 rounded-xl space-y-1.5 mt-2 border border-slate-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">Tahsil Bekleyen Müşteri Çeki:</span>
                  <span className="font-bold text-indigo-700 font-mono">{stats.customerChecksCount} Adet</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">Verilen Tedarikçi Çekleri:</span>
                  <span className="font-bold text-rose-700 font-mono">₺{stats.issuedChecksTotal.toLocaleString('tr-TR')}</span>
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => handleNav('finance')}
            className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Finans & Tahsilatı Aç</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* MODÜL 3: GENEL MUHASEBE & TDHP YEVMİYE */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Genel Muhasebe & TDHP</h3>
                  <span className="text-[10px] text-slate-400 font-semibold">Yevmiye, Mizan & KDV</span>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {stats.totalJournals} Fiş
              </span>
            </div>

            <div className="space-y-2.5 pt-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-600">191 İndirilecek KDV:</span>
                <span className="font-mono font-bold text-slate-800">
                  ₺{stats.kdv191Debit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-600">391 Hesaplanan KDV:</span>
                <span className="font-mono font-bold text-slate-800">
                  ₺{stats.kdv391Credit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-600">Net KDV Tahakkuku:</span>
                <span className={cn("font-mono font-bold", stats.netKdvDifference > 0 ? "text-rose-600" : "text-emerald-600")}>
                  {stats.netKdvDifference > 0 ? `+₺${stats.netKdvDifference.toLocaleString('tr-TR')} (Ödenecek)` : `-₺${Math.abs(stats.netKdvDifference).toLocaleString('tr-TR')} (Devreden)`}
                </span>
              </div>

              {/* Fiş Uyarı Kutusu */}
              <div className="bg-slate-50 p-2.5 rounded-xl space-y-1.5 mt-2 border border-slate-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">Dengesiz Yevmiye Fişi:</span>
                  <span className={cn("font-bold", stats.unbalancedJournals > 0 ? "text-rose-600" : "text-emerald-700")}>
                    {stats.unbalancedJournals > 0 ? `${stats.unbalancedJournals} Hatalı Fiş!` : 'Tüm Fişler Dengeli ✓'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">Fiş Kesilmeyen Bordro:</span>
                  <span className={cn("font-bold", stats.unaccountedPayrollsCount > 0 ? "text-amber-700" : "text-emerald-700")}>
                    {stats.unaccountedPayrollsCount > 0 ? `${stats.unaccountedPayrollsCount} Bordro Bekliyor` : 'Bordrolar İşlendi ✓'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => handleNav('accounting')}
            className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Yevmiye Defteri & Mizana Git</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* MODÜL 4: FATURALAR & İRSALİYELER */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Faturalar & İrsaliyeler</h3>
                  <span className="text-[10px] text-slate-400 font-semibold">Alacak/Borç & Sevk İrsaliyeleri</span>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-50 text-purple-700 border border-purple-200">
                Ticari Akış
              </span>
            </div>

            <div className="space-y-2.5 pt-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-600">Açık Satış Faturaları (Alacak):</span>
                <span className="font-mono font-bold text-emerald-700">
                  ₺{stats.openSalesTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-600">Açık Alış Faturaları (Borç):</span>
                <span className="font-mono font-bold text-rose-700">
                  ₺{stats.openPurchaseTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* İrsaliye Kritik Uyarı Kutusu */}
              <div className="bg-slate-50 p-2.5 rounded-xl space-y-1.5 mt-2 border border-slate-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 flex items-center gap-1">
                    <Truck className="w-3 h-3 text-indigo-600" /> Fatura Bekleyen İrsaliyeler:
                  </span>
                  <span className={cn("font-bold font-mono", stats.uninvoicedWaybillsCount > 0 ? "text-amber-700" : "text-emerald-700")}>
                    {stats.uninvoicedWaybillsCount > 0 ? `${stats.uninvoicedWaybillsCount} Açık Sevk İrsaliyesi` : 'Tümü Faturalandı ✓'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 text-[10px]">Mevzuat:</span>
                  <span className="text-slate-400 text-[10px] italic">Maks. 7 gün faturalama süresi</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => handleNav('invoices')}
              className="py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl transition-colors text-center cursor-pointer"
            >
              Faturalar
            </button>
            <button 
              onClick={() => handleNav('waybills')}
              className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors text-center cursor-pointer"
            >
              İrsaliyeler
            </button>
          </div>
        </div>

      </div>

      {/* 4. FABRİKA ÜRETİM HATLARI CANLI PİPELİNE */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Ayakkabı İmalat Hatları & Bant Doluluğu
            </h3>
            <p className="text-[11px] text-slate-400 font-semibold">Deri kesiminden saya dikimi, taban montajı ve kutulama aşamalarına canlı iş emri akışı</p>
          </div>
          <button 
            onClick={() => handleNav('production')}
            className="text-xs font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>{stats.activeWorkOrdersCount} Aktif İş Emri</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 1. Kesim */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-slate-700 uppercase">
              <span className="flex items-center gap-1.5"><Scissors className="w-3.5 h-3.5 text-amber-600" /> 1. Kesim Hattı</span>
              <span className="font-mono text-indigo-600">{stats.stageCounts.kesim} Emir</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, stats.stageCounts.kesim * 25)}%` }} />
            </div>
            <p className="text-[10px] text-slate-500 font-bold">Deri, Astar & Tela Bıçak Kesim</p>
          </div>

          {/* 2. Saya Dikim */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-slate-700 uppercase">
              <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-blue-600" /> 2. Saya Dikim</span>
              <span className="font-mono text-indigo-600">{stats.stageCounts.dikim} Emir</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, stats.stageCounts.dikim * 25)}%` }} />
            </div>
            <p className="text-[10px] text-slate-500 font-bold">Saya Dikiş, Biyeler & Aksesuar</p>
          </div>

          {/* 3. Montaj / Taban */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-slate-700 uppercase">
              <span className="flex items-center gap-1.5"><Factory className="w-3.5 h-3.5 text-purple-600" /> 3. Montaj / Kalıp</span>
              <span className="font-mono text-indigo-600">{stats.stageCounts.montaj} Emir</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, stats.stageCounts.montaj * 25)}%` }} />
            </div>
            <p className="text-[10px] text-slate-500 font-bold">Kalıba Çekim & Taban Presleme</p>
          </div>

          {/* 4. Finisaj / Kutu */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-slate-700 uppercase">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 4. Finisaj & Paket</span>
              <span className="font-mono text-indigo-600">{stats.stageCounts.finisaj} Emir</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, stats.stageCounts.finisaj * 25)}%` }} />
            </div>
            <p className="text-[10px] text-slate-500 font-bold">Temizleme, Boyama & Asortili Kutu</p>
          </div>
        </div>
      </div>

      {/* 5. GÖRSEL GRAFİKLER (FİNANSAL AKIŞ & DEPO STOK DAĞILIMI) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol 2 Kolon: Finansal Akış */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Haftalık Nakit Akışı (Gelir / Gider)</h3>
              <p className="text-[11px] text-slate-400 font-semibold">Cari tahsilatlar ve hammadde/gider harcamaları dengesi</p>
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

          <div className="h-[260px] w-full pt-2">
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

        {/* Sağ 1 Kolon: Depo Stok Dağılımı */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Depo Kategori Dağılımı</h3>
            <p className="text-[11px] text-slate-400 font-semibold">Mamul ayakkabı, taban, deri ve aksesuar</p>
          </div>

          <div className="h-[170px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stockDonutData}
                  innerRadius={46}
                  outerRadius={70}
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

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
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

      {/* 6. EN ALTTRAKİ CANLI HAREKET LOGLARI (SİPARİŞLER VE STOK) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Son Alınan Müşteri Siparişleri */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-indigo-600" /> Son Alınan Siparişler
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold">Müşteri sipariş kayıtları ve tutarları</p>
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
                  <div key={order.id} className="py-2.5 flex items-center justify-between hover:bg-slate-50 rounded-xl px-2 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-xs uppercase">
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

        {/* Canlı Stok Hareketleri */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" /> Depo & Stok Giriş / Çıkışları
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold">Deri girişi, taban çıkışı ve mamul depo logları</p>
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
                  <div key={log.id} className="py-2.5 flex items-center justify-between hover:bg-slate-50 rounded-xl px-2 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs",
                        isIncoming ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                      )}>
                        {isIncoming ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-900 uppercase truncate max-w-[180px]">{prod?.name || 'Stok Kalemi'}</div>
                        <div className="text-[10px] font-semibold text-slate-400 truncate max-w-[180px]">{log.description || (isIncoming ? 'Depo Girişi' : 'Üretim/Sevkiyat Çıkışı')}</div>
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
