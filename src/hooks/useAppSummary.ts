import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

export function useAppSummary() {
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const cashBoxes = useLiveQuery(() => db.cashBoxes.toArray()) || [];
  const bankAccounts = useLiveQuery(() => db.bankAccounts.toArray()) || [];
  const employees = useLiveQuery(() => db.employees.toArray()) || [];
  const payrollRecords = useLiveQuery(() => db.payrollRecords.toArray()) || [];
  const advanceRequests = useLiveQuery(() => db.advanceRequests.toArray()) || [];
  const leaveRequests = useLiveQuery(() => db.leaveRequests.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const orders = useLiveQuery(() => db.orders.toArray()) || [];
  const orderItems = useLiveQuery(() => db.orderItems.toArray()) || [];
  const workOrders = useLiveQuery(() => db.workOrders.toArray()) || [];
  const journalEntries = useLiveQuery(() => db.journalEntries.toArray()) || [];
  const checks = useLiveQuery(() => db.checks.toArray()) || [];
  const invoices = useLiveQuery(() => db.invoices.toArray()) || [];
  const waybills = useLiveQuery(() => db.waybills.toArray()) || [];
  
  // Also expose these for components that need them
  const contacts = useLiveQuery(() => db.contacts.toArray()) || [];
  const inventoryLogs = useLiveQuery(() => db.inventoryLogs.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

  const stats = useMemo(() => {
    // 1. Finans & Nakit
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
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
    let relevantPayrolls = payrollRecords.filter(p => p.month === currentMonth && p.year === currentYear);
    if (relevantPayrolls.length === 0 && payrollRecords.length > 0) {
      const lastRec = payrollRecords[payrollRecords.length - 1];
      relevantPayrolls = payrollRecords.filter(p => p.month === lastRec.month && p.year === lastRec.year);
    }
    const totalNetPayroll = relevantPayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);
    const totalEmployerCost = relevantPayrolls.reduce((sum, p) => sum + (p.totalEmployerCost || 0), 0);
    const unpaidPayrolls = relevantPayrolls.filter(p => p.paymentStatus !== 'paid');
    const unaccountedPayrolls = relevantPayrolls.filter(p => !p.isAccounted);
    const pendingAdvances = advanceRequests.filter(a => a.status === 'pending');
    const pendingAdvanceTotal = pendingAdvances.reduce((sum, a) => sum + (a.amount || 0), 0);

    // 3. Genel Muhasebe & KDV
    const totalJournals = journalEntries.length;
    const unbalancedJournals = journalEntries.filter(j => !j.isBalanced).length;
    let kdv191Debit = 0;
    let kdv391Credit = 0;
    journalEntries.forEach(entry => {
      entry.lines?.forEach(line => {
        if (line.accountCode.startsWith('191')) kdv191Debit += (line.debit || 0);
        if (line.accountCode.startsWith('391')) kdv391Credit += (line.credit || 0);
      });
    });
    const netKdvDifference = kdv391Credit - kdv191Debit;

    // 4. Faturalar & İrsaliyeler
    const openSalesInvoices = invoices.filter(i => i.type === 'sales' && i.paymentStatus !== 'paid');
    const openSalesTotal = openSalesInvoices.reduce((sum, i) => sum + ((i.grandTotal || 0) - (i.paidAmount || 0)), 0);
    const openPurchaseInvoices = invoices.filter(i => i.type === 'purchase' && i.paymentStatus !== 'paid');
    const openPurchaseTotal = openPurchaseInvoices.reduce((sum, i) => sum + ((i.grandTotal || 0) - (i.paidAmount || 0)), 0);
    const uninvoicedWaybills = waybills.filter(w => w.invoicedStatus === 'not_invoiced');

    // 5. Stok & Hammadde
    const lowStockProducts = products.filter(p => (p.stock || 0) <= (p.minStock || 0));

    // 6. Sipariş ve Sevkiyat
    const salesOrdersCount = orders.filter(o => o.type === 'sales').length;
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
      income, expense, profit, cashBalance, bankBalance, totalLiquidAssets,
      customerChecksCount: customerChecks.length, customerChecksTotal,
      issuedChecksTotal,
      activeEmployeesCount: activeEmployees.length, sgkEmployees, dailyEmployees,
      totalNetPayroll, totalEmployerCost, unpaidPayrollsCount: unpaidPayrolls.length,
      unaccountedPayrollsCount: unaccountedPayrolls.length, pendingAdvancesCount: pendingAdvances.length,
      pendingAdvanceTotal,
      totalJournals, unbalancedJournals, netKdvDifference, kdv191Debit, kdv391Credit,
      openSalesInvoicesCount: openSalesInvoices.length, openSalesTotal, openPurchaseTotal,
      uninvoicedWaybillsCount: uninvoicedWaybills.length,
      lowStockProducts,
      salesOrdersCount, totalOrderQty, totalShippedQty, remainingToShip,
      activeWorkOrdersCount: activeWorkOrders.length, totalProducedQty, totalInProductionQty, stageCounts, categoryStats
    };
  }, [
    transactions, cashBoxes, bankAccounts, checks, employees, payrollRecords, advanceRequests,
    journalEntries, invoices, waybills, products, orders, orderItems, workOrders
  ]);

  const appSummary = useMemo(() => ({
    sirketFinansVeLikidite: {
      kasaBakiyeTL: stats.cashBalance,
      bankaBakiyeTL: stats.bankBalance,
      toplamLikitVarlikTL: stats.totalLiquidAssets,
      portfoyMusteriCekleriTL: stats.customerChecksTotal,
      portfoyCekAdedi: stats.customerChecksCount,
      verilenTedarikciCekleriTL: stats.issuedChecksTotal,
      toplamGelirTL: stats.income,
      toplamGiderTL: stats.expense,
      netKarZararTL: stats.profit
    },
    siparisVeSatisDurumu: {
      toplamSiparisAdedi: stats.salesOrdersCount,
      toplamSiparisUrunAdedi: stats.totalOrderQty,
      sevkEdilenUrunAdedi: stats.totalShippedQty,
      bekleyenSevkiyatAdedi: stats.remainingToShip,
      acikSatisFaturaTutariTL: stats.openSalesTotal,
      acikSatisFaturaAdedi: stats.openSalesInvoicesCount,
      faturalasmamisIrsaliyeSayisi: stats.uninvoicedWaybillsCount
    },
    stokVeUretim: {
      kritikStokAdedi: stats.lowStockProducts.length,
      kritikStoktakiUrunler: stats.lowStockProducts.slice(0, 5).map(p => ({
        kod: p.code,
        ad: p.name,
        mevcutStok: p.stock,
        minStok: p.minStock,
        birim: p.unit
      })),
      aktifIsEmriSayisi: stats.activeWorkOrdersCount,
      uretimdekiToplamAdet: stats.totalInProductionQty,
      tamamlananToplamUretimAdet: stats.totalProducedQty,
      uretimAsamaSayilari: stats.stageCounts
    },
    ikVeBordro: {
      toplamAktifPersonel: stats.activeEmployeesCount,
      sgkliPersonelSayisi: stats.sgkEmployees,
      sgksizGunlukPersonelSayisi: stats.dailyEmployees,
      toplamNetBordroTL: stats.totalNetPayroll,
      toplamIsverenMaliyetiTL: stats.totalEmployerCost,
      odenmemisBordroAdedi: stats.unpaidPayrollsCount,
      bekleyenAvansTalebiAdedi: stats.pendingAdvancesCount,
      bekleyenAvansTutariTL: stats.pendingAdvanceTotal
    },
    genelMuhasebe: {
      toplamYevmiyeFisSayisi: stats.totalJournals,
      dengesizFisSayisi: stats.unbalancedJournals,
      kdvDurumu: stats.netKdvDifference > 0 
        ? `Ödenecek KDV: ₺${stats.netKdvDifference.toFixed(2)}` 
        : `Devreden KDV: ₺${Math.abs(stats.netKdvDifference).toFixed(2)}`
    }
  }), [stats]);

  return {
    stats,
    appSummary,
    transactions,
    cashBoxes,
    bankAccounts,
    employees,
    payrollRecords,
    advanceRequests,
    leaveRequests,
    products,
    orders,
    orderItems,
    workOrders,
    journalEntries,
    checks,
    invoices,
    waybills,
    contacts,
    inventoryLogs,
    accounts
  };
}
