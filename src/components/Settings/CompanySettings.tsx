import React, { useState } from 'react';
import { Building2, Save, Check, Database, Download, Upload, AlertTriangle, RefreshCw, FileText } from 'lucide-react';
import { db, seedDatabase } from '../../db';
import type { AppSettings, CompanySettings as CompanySettingsType } from '../../types';

interface CompanySettingsProps {
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => Promise<void>;
}

export default function CompanySettings({ settings, onSave }: CompanySettingsProps) {
  const [comp, setComp] = useState<CompanySettingsType>(settings.company || {
    companyName: 'ProERP Ayakkabı San. ve Tic. Ltd. Şti.',
    companyTitle: 'ProERP Ayakkabı İmalat Sanayi ve Ticaret Limited Şirketi',
    taxOffice: 'Güngören Vergi Dairesi',
    taxNumber: '7340981245',
    tradeRegistryNo: '458921-5',
    phone: '+90 212 555 44 33',
    email: 'info@proerp-shoes.com',
    website: 'https://proerp-shoes.com',
    address: 'Sanayi Cad. Ayakkabıcılar Sanayi Sitesi No: 42 Kat: 3 Güngören',
    city: 'İstanbul / TÜRKİYE',
    bankName: 'Garanti BBVA - Merter Kurumsal',
    iban: 'TR12 0006 2000 1234 5678 9012 34'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated: AppSettings = {
        ...settings,
        company: comp
      };
      await onSave(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Firma ayarları kaydedilemedi:', err);
      alert('Firma bilgileri kaydedilirken hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  // Full Database Backup to JSON
  const handleExportBackup = async () => {
    setIsBackingUp(true);
    try {
      const dump = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        products: await db.products.toArray(),
        contacts: await db.contacts.toArray(),
        orders: await db.orders.toArray(),
        orderItems: await db.orderItems.toArray(),
        invoices: await db.invoices.toArray(),
        invoiceItems: await db.invoiceItems.toArray(),
        waybills: await db.waybills.toArray(),
        waybillItems: await db.waybillItems.toArray(),
        recipes: await db.recipes.toArray(),
        workOrders: await db.workOrders.toArray(),
        transactions: await db.transactions.toArray(),
        bankAccounts: await db.bankAccounts.toArray(),
        cashBoxes: await db.cashBoxes.toArray(),
        checks: await db.checks.toArray(),
        accounts: await db.accounts.toArray(),
        journalEntries: await db.journalEntries.toArray(),
        employees: await db.employees.toArray(),
        attendanceRecords: await db.attendanceRecords.toArray(),
        leaveRequests: await db.leaveRequests.toArray(),
        payrollRecords: await db.payrollRecords.toArray(),
        assortmentTemplates: await db.assortmentTemplates.toArray(),
        settings: await db.settings.toArray()
      };

      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ProERP_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Yedekleme hatası:', err);
      alert('Veritabanı yedeği alınırken bir sorun oluştu.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Restore Database from JSON
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('DİKKAT: Yedeği geri yüklemek mevcut tüm veritabanı kayıtlarının üzerine yazabilir. Devam etmek istiyor musunuz?')) {
      e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      await db.transaction('rw', [
        db.products, db.contacts, db.orders, db.orderItems, db.invoices, db.invoiceItems,
        db.waybills, db.waybillItems, db.recipes, db.workOrders, db.transactions,
        db.bankAccounts, db.cashBoxes, db.checks, db.accounts, db.journalEntries,
        db.employees, db.attendanceRecords, db.leaveRequests,
        db.payrollRecords, db.assortmentTemplates, db.settings
      ], async () => {
        if (data.products) { await db.products.clear(); await db.products.bulkAdd(data.products); }
        if (data.contacts) { await db.contacts.clear(); await db.contacts.bulkAdd(data.contacts); }
        if (data.orders) { await db.orders.clear(); await db.orders.bulkAdd(data.orders); }
        if (data.orderItems) { await db.orderItems.clear(); await db.orderItems.bulkAdd(data.orderItems); }
        if (data.invoices) { await db.invoices.clear(); await db.invoices.bulkAdd(data.invoices); }
        if (data.invoiceItems) { await db.invoiceItems.clear(); await db.invoiceItems.bulkAdd(data.invoiceItems); }
        if (data.waybills) { await db.waybills.clear(); await db.waybills.bulkAdd(data.waybills); }
        if (data.waybillItems) { await db.waybillItems.clear(); await db.waybillItems.bulkAdd(data.waybillItems); }
        if (data.recipes) { await db.recipes.clear(); await db.recipes.bulkAdd(data.recipes); }
        if (data.workOrders) { await db.workOrders.clear(); await db.workOrders.bulkAdd(data.workOrders); }
        if (data.transactions) { await db.transactions.clear(); await db.transactions.bulkAdd(data.transactions); }
        if (data.bankAccounts) { await db.bankAccounts.clear(); await db.bankAccounts.bulkAdd(data.bankAccounts); }
        if (data.cashBoxes) { await db.cashBoxes.clear(); await db.cashBoxes.bulkAdd(data.cashBoxes); }
        if (data.checks) { await db.checks.clear(); await db.checks.bulkAdd(data.checks); }
        if (data.accounts) { await db.accounts.clear(); await db.accounts.bulkAdd(data.accounts); }
        if (data.journalEntries) { await db.journalEntries.clear(); await db.journalEntries.bulkAdd(data.journalEntries); }
        if (data.employees) { await db.employees.clear(); await db.employees.bulkAdd(data.employees); }
        if (data.attendanceRecords) { await db.attendanceRecords.clear(); await db.attendanceRecords.bulkAdd(data.attendanceRecords); }
        if (data.leaveRequests) { await db.leaveRequests.clear(); await db.leaveRequests.bulkAdd(data.leaveRequests); }
        if (data.payrollRecords) { await db.payrollRecords.clear(); await db.payrollRecords.bulkAdd(data.payrollRecords); }
        if (data.assortmentTemplates) { await db.assortmentTemplates.clear(); await db.assortmentTemplates.bulkAdd(data.assortmentTemplates); }
        if (data.settings) { await db.settings.clear(); await db.settings.bulkAdd(data.settings); }
      });

      alert('Yedek başarıyla geri yüklendi! Sayfa yenilenecek.');
      window.location.reload();
    } catch (err) {
      console.error('Geri yükleme hatası:', err);
      alert('Yedek dosyası okunamadı veya biçimi geçersiz.');
    } finally {
      e.target.value = '';
    }
  };

  // Re-seed Database with demo data
  const handleResetToDemo = async () => {
    if (!confirm('DİKKAT: Tüm veritabanı sıfırlanacak ve zengin hazır ayakkabı demo verileri yüklenecektir. Devam etmek istiyor musunuz?')) {
      return;
    }

    setIsResetting(true);
    try {
      await seedDatabase();
      alert('Sistem demo verileriyle başarıyla sıfırlandı!');
      window.location.reload();
    } catch (err) {
      console.error('Sıfırlama hatası:', err);
      alert('Demo verileri yüklenirken bir hata oluştu.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-8">
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Firma künye ve antet bilgileri başarıyla kaydedildi.</span>
          </div>
        </div>
      )}

      {/* SECTION 1: FİRMA KİMLİK VE ANTET BİLGİLERİ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold uppercase tracking-wider">Firma Künyesi & İrsaliye/Fatura Anteti</h3>
              <p className="text-slate-400 text-xs font-medium">Resmi fatura, sevk irsaliyesi ve sipariş çıktılarında basılacak bilgiler</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Firma Kısa Adı (Ticari Marka)</label>
              <input
                type="text"
                required
                value={comp.companyName || ''}
                onChange={e => setComp({ ...comp, companyName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resmi Ticari Ünvan</label>
              <input
                type="text"
                required
                value={comp.companyTitle || ''}
                onChange={e => setComp({ ...comp, companyTitle: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vergi Dairesi</label>
              <input
                type="text"
                value={comp.taxOffice || ''}
                onChange={e => setComp({ ...comp, taxOffice: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vergi Kimlik Numarası (VKN)</label>
              <input
                type="text"
                value={comp.taxNumber || ''}
                onChange={e => setComp({ ...comp, taxNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Telefon</label>
              <input
                type="text"
                value={comp.phone || ''}
                onChange={e => setComp({ ...comp, phone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">E-Posta</label>
              <input
                type="email"
                value={comp.email || ''}
                onChange={e => setComp({ ...comp, email: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Firma Adresi</label>
              <textarea
                rows={2}
                value={comp.address || ''}
                onChange={e => setComp({ ...comp, address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Banka & Şube</label>
              <input
                type="text"
                value={comp.bankName || ''}
                onChange={e => setComp({ ...comp, bankName: e.target.value })}
                placeholder="Örn: Garanti BBVA Merter"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">IBAN Numarası</label>
              <input
                type="text"
                value={comp.iban || ''}
                onChange={e => setComp({ ...comp, iban: e.target.value })}
                placeholder="TRXX 0000 0000 0000 0000 00"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Kaydediliyor...' : 'Firma Bilgilerini Kaydet'}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: VERİTABANI YÖNETİMİ, YEDEKLEME VE SIFIRLAMA */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center text-white shadow-md">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold uppercase tracking-wider">Veritabanı Yedekleme & Sistem Araçları</h3>
              <p className="text-slate-400 text-xs font-medium">Tam JSON veritabanı yedeği alma, geri yükleme ve demo veri yükleyici</p>
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Backup */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Download className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Tam Veritabanı Yedeği</h4>
              <p className="text-[11px] text-slate-500">Stoklar, siparişler, irsaliyeler, cariler ve ayarları tek bir JSON dosyasında bilgisayarınıza indirir.</p>
            </div>

            <button
              type="button"
              onClick={handleExportBackup}
              disabled={isBackingUp}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              {isBackingUp ? 'İndiriliyor...' : 'Yedeği İndir (JSON)'}
            </button>
          </div>

          {/* Restore */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Yedekten Geri Yükle</h4>
              <p className="text-[11px] text-slate-500">Daha önce aldığınız bir ProERP JSON yedek dosyasını sisteme yükleyerek verileri yeniler.</p>
            </div>

            <label className="w-full bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs">
              <Upload className="w-4 h-4" />
              Yedek Dosyası Seç
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>

          {/* Reset Demo */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                <RefreshCw className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Fabrika / Demo Verisi</h4>
              <p className="text-[11px] text-slate-500">Tüm tabloları sıfırlar ve zengin ayakkabı imalat demo verilerini (ürünler, reçeteler, cariler) tekrar yükler.</p>
            </div>

            <button
              type="button"
              onClick={handleResetToDemo}
              disabled={isResetting}
              className="w-full bg-slate-900 hover:bg-rose-600 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
              {isResetting ? 'Yükleniyor...' : 'Demo Verilerini Yükle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
