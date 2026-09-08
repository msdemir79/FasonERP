import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { 
  Landmark, 
  Wallet, 
  CreditCard, 
  Search, 
  Printer, 
  FileDown, 
  Filter, 
  Calendar, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { printTabularReport } from '../../lib/printService';
import { exportToCsv } from '../../lib/exportService';
import { cn } from '../../lib/utils';
import type { CheckNote, CheckStatus } from '../../types';

export default function FinanceReport() {
  const [activeTab, setActiveTab] = useState<'liquidity' | 'checks'>('liquidity');
  const [searchTerm, setSearchTerm] = useState('');
  const [checkTypeFilter, setCheckTypeFilter] = useState<'all' | 'received' | 'given'>('all');
  const [checkStatusFilter, setCheckStatusFilter] = useState<string>('all');

  // Queries
  const cashBoxes = useLiveQuery(() => db.cashBoxes.toArray()) || [];
  const bankAccounts = useLiveQuery(() => db.bankAccounts.toArray()) || [];
  const checks = useLiveQuery(() => db.checks.orderBy('dueDate').toArray()) || [];
  const contacts = useLiveQuery(() => db.contacts.toArray()) || [];

  const contactMap = useMemo(() => {
    return new Map(contacts.map(c => [c.id!, c.name]));
  }, [contacts]);

  // Statistics
  const stats = useMemo(() => {
    const totalCash = cashBoxes.reduce((sum, c) => sum + (c.balance || 0), 0);
    const totalBank = bankAccounts.reduce((sum, b) => sum + (b.balance || 0), 0);
    const totalLiquidity = totalCash + totalBank;

    // Checks stats
    const activeCustomerChecks = checks.filter(c => c.type.startsWith('received') && (c.status === 'portfolio' || c.status === 'bank_collection'));
    const activeSupplierChecks = checks.filter(c => c.type.startsWith('given') && c.status === 'portfolio');

    const totalCustomerChecks = activeCustomerChecks.reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalSupplierChecks = activeSupplierChecks.reduce((sum, c) => sum + (c.amount || 0), 0);

    const now = new Date();
    const upcomingChecks = checks.filter(c => {
      if (c.status !== 'portfolio' && c.status !== 'bank_collection') return false;
      const due = new Date(c.dueDate);
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 15;
    });

    return {
      totalCash,
      totalBank,
      totalLiquidity,
      totalCustomerChecks,
      totalSupplierChecks,
      netPosition: totalLiquidity + totalCustomerChecks - totalSupplierChecks,
      upcomingChecksCount: upcomingChecks.length
    };
  }, [cashBoxes, bankAccounts, checks]);

  // Filtered checks
  const filteredChecks = useMemo(() => {
    return checks.filter(c => {
      const contactName = contactMap.get(c.contactId) || c.contactName || c.drawer || '';
      const matchesSearch = 
        (c.serialNumber || c.portfolioNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.bankName || '').toLowerCase().includes(searchTerm.toLowerCase());

      const isReceived = c.type.startsWith('received');
      const isGiven = c.type.startsWith('given');
      const matchesType = 
        checkTypeFilter === 'all' || 
        (checkTypeFilter === 'received' && isReceived) || 
        (checkTypeFilter === 'given' && isGiven);
      const matchesStatus = checkStatusFilter === 'all' || c.status === checkStatusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [checks, searchTerm, checkTypeFilter, checkStatusFilter, contactMap]);

  // Print Liquidity Report
  const handlePrintLiquidity = () => {
    const headers = ['HESAP TÜRÜ', 'HESAP / KASA ADI', 'DETAY / IBAN / ŞUBE', 'PARA BİRİMİ', 'BAKİYE (₺)'];
    const rows = [
      ...cashBoxes.map(c => [
        'KASA',
        c.name,
        c.code || 'Nakit Kasa',
        c.currency || 'TRY',
        c.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })
      ]),
      ...bankAccounts.map(b => [
        'BANKA',
        b.bankName,
        `${b.branchName || ''} - IBAN: ${b.iban || '-'}`,
        b.currency || 'TRY',
        b.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })
      ])
    ];

    printTabularReport(
      'Nakit & Banka Likidite Durum Raporu',
      'Şirket mevcut kasa ve banka mevduat bakiyeleri genel dökümü',
      headers,
      rows,
      [
        { label: 'Kasa Nakit Toplamı', value: `₺${stats.totalCash.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` },
        { label: 'Banka Mevduat Toplamı', value: `₺${stats.totalBank.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` },
        { label: 'Genel Likidite Toplamı', value: `₺${stats.totalLiquidity.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` }
      ]
    );
  };

  // Print Checks Report
  const handlePrintChecks = () => {
    if (filteredChecks.length === 0) return;

    const headers = ['TÜR', 'ÇEK NO', 'BANKA / ŞUBE', 'KEŞİDECİ / CARİ', 'VADE TARİHİ', 'KALAN GÜN', 'TUTAR (₺)', 'DURUM'];
    const now = new Date();
    const rows = filteredChecks.map(c => {
      const due = new Date(c.dueDate);
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const contactName = contactMap.get(c.contactId) || c.contactName || c.drawerName || '-';

      return [
        c.type === 'received' ? 'Alınan Çek' : 'Verilen Çek',
        c.checkNumber || '-',
        `${c.bankName || ''} ${c.branch ? `(${c.branch})` : ''}`,
        contactName,
        due.toLocaleDateString('tr-TR'),
        diffDays < 0 ? `Geçti (${Math.abs(diffDays)} gün)` : `${diffDays} gün`,
        c.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 }),
        c.status.toUpperCase()
      ];
    });

    printTabularReport(
      'Çek & Senet Portföy ve Vade Takvimi',
      'Müşteri portföy çekleri ve ödenecek borç çekleri vade dökümü',
      headers,
      rows,
      [
        { label: 'Alınan Müşteri Çekleri', value: `₺${stats.totalCustomerChecks.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` },
        { label: 'Verilen Tedarikçi Çekleri', value: `₺${stats.totalSupplierChecks.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` },
        { label: 'Net Likidite Pozisyonu', value: `₺${stats.netPosition.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` }
      ]
    );
  };

  // Export to Excel CSV
  const handleExportChecksCsv = () => {
    if (filteredChecks.length === 0) return;

    const headers = [
      'Çek Türü',
      'Çek Numarası',
      'Banka Adı',
      'Şube',
      'Keşideci / Cari Hesap',
      'Vade Tarihi',
      'Tutar (TL)',
      'Para Birimi',
      'Durum'
    ];

    const rows = filteredChecks.map(c => [
      c.type === 'received' ? 'Alınan Çek (Müşteri)' : 'Verilen Çek (Tedarikçi)',
      c.checkNumber || '',
      c.bankName || '',
      c.branch || '',
      contactMap.get(c.contactId) || c.contactName || c.drawerName || '',
      new Date(c.dueDate).toLocaleDateString('tr-TR'),
      c.amount.toFixed(2),
      c.currency || 'TRY',
      c.status
    ]);

    exportToCsv('Cek_Portfoy_Raporu.csv', headers, rows);
  };

  return (
    <div className="space-y-6">
      
      {/* Üst Bar & Sekme Seçimi */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('liquidity')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer",
              activeTab === 'liquidity' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Wallet className="w-4 h-4 text-emerald-600" />
            Kasa & Banka Likidite Durumu
          </button>
          <button
            onClick={() => setActiveTab('checks')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer",
              activeTab === 'checks' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <CreditCard className="w-4 h-4 text-indigo-600" />
            Çek & Senet Vade Takvimi ({checks.length})
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={activeTab === 'liquidity' ? handlePrintLiquidity : handlePrintChecks}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            Yazdır (A4)
          </button>
          {activeTab === 'checks' && (
            <button
              onClick={handleExportChecksCsv}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              Excel'e Aktar
            </button>
          )}
        </div>

      </div>

      {/* KPI Kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Nakit & Banka Toplamı</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            ₺{stats.totalLiquidity.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            Kasa: ₺{stats.totalCash.toLocaleString('tr-TR')} • Banka: ₺{stats.totalBank.toLocaleString('tr-TR')}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Alınan Müşteri Çekleri</span>
            <ArrowDownLeft className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700 font-mono">
            ₺{stats.totalCustomerChecks.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            Portföyde / Tahsildeki Çekler
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Verilen Borç Çekleri</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700 font-mono">
            ₺{stats.totalSupplierChecks.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            Ödenecek Tedarikçi Çekleri
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Net Likidite Pozisyonu</span>
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <div className={cn(
            "text-2xl font-black font-mono",
            stats.netPosition >= 0 ? "text-purple-800" : "text-rose-700"
          )}>
            ₺{stats.netPosition.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            (Nakit + Alınan Çek) - Borç Çeki
          </div>
        </div>

      </div>

      {/* Tab 1: Likidite Tabloları */}
      {activeTab === 'liquidity' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Kasa Bakiyeleri */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Wallet className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Nakit Kasalar
                </h3>
              </div>
              <span className="text-xs font-black text-emerald-700 font-mono">
                ₺{stats.totalCash.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-2.5 px-4">Kasa Adı</th>
                  <th className="py-2.5 px-4">Kod</th>
                  <th className="py-2.5 px-4 text-right">Bakiye</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashBoxes.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{c.code || '-'}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                      ₺{c.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Banka Hesap Bakiyeleri */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Landmark className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Banka Mevduat Hesapları
                </h3>
              </div>
              <span className="text-xs font-black text-blue-700 font-mono">
                ₺{stats.totalBank.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-2.5 px-4">Banka & Şube</th>
                  <th className="py-2.5 px-4">IBAN</th>
                  <th className="py-2.5 px-4 text-right">Bakiye</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bankAccounts.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{b.bankName}</div>
                      <div className="text-[10px] text-slate-400">{b.branchName || 'Merkez'}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-600">{b.iban || '-'}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                      ₺{b.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* Tab 2: Çek Vade Takvimi */}
      {activeTab === 'checks' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Çek no, keşideci, banka ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-52"
                />
              </div>

              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setCheckTypeFilter('all')}
                  className={cn(
                    "px-3 py-1 font-bold rounded-lg transition-all cursor-pointer",
                    checkTypeFilter === 'all' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"
                  )}
                >
                  Tümü
                </button>
                <button
                  onClick={() => setCheckTypeFilter('received')}
                  className={cn(
                    "px-3 py-1 font-bold rounded-lg transition-all cursor-pointer",
                    checkTypeFilter === 'received' ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600"
                  )}
                >
                  Alınan Çekler
                </button>
                <button
                  onClick={() => setCheckTypeFilter('given')}
                  className={cn(
                    "px-3 py-1 font-bold rounded-lg transition-all cursor-pointer",
                    checkTypeFilter === 'given' ? "bg-white text-rose-700 shadow-xs" : "text-slate-600"
                  )}
                >
                  Verilen Çekler
                </button>
              </div>
            </div>

            <span className="text-xs font-bold text-slate-500">
              {filteredChecks.length} Çek Kaydı Listeleniyor
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-3 px-3">Tür</th>
                  <th className="py-3 px-3">Çek No</th>
                  <th className="py-3 px-3">Banka & Şube</th>
                  <th className="py-3 px-3">Keşideci / Cari</th>
                  <th className="py-3 px-3">Vade Tarihi</th>
                  <th className="py-3 px-3">Kalan Gün</th>
                  <th className="py-3 px-3 text-right">Tutar</th>
                  <th className="py-3 px-3 text-center">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredChecks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 font-bold">
                      Kayıtlı çek/senet bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredChecks.map(c => {
                    const due = new Date(c.dueDate);
                    const now = new Date();
                    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue = diffDays < 0;
                    const isUpcoming = diffDays >= 0 && diffDays <= 7;
                    const isReceived = c.type.startsWith('received');

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3">
                          {isReceived ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                              <ArrowDownLeft className="w-3 h-3" /> Müşteri
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                              <ArrowUpRight className="w-3 h-3" /> Tedarikçi
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-700">
                          {c.serialNumber || c.portfolioNumber || '-'}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800">{c.bankName}</div>
                          <div className="text-[10px] text-slate-400">{c.branchName || '-'}</div>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800">
                          {contactMap.get(c.contactId) || c.contactName || c.drawer || '-'}
                        </td>
                        <td className="py-3 px-3 font-mono font-medium text-slate-700">
                          {due.toLocaleDateString('tr-TR')}
                        </td>
                        <td className="py-3 px-3">
                          {isOverdue ? (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                              {Math.abs(diffDays)} gün geçti
                            </span>
                          ) : isUpcoming ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                              {diffDays} gün kaldı
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-600">
                              {diffDays} gün
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-slate-900">
                          ₺{c.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-100 text-slate-700">
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
}
