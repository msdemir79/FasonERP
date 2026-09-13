import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Package, Search, AlertTriangle, Eye, Printer, FileDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { printTabularReport } from '../../lib/printService';
import { exportToCsv } from '../../lib/exportService';

export default function StockSummaryReport() {
  const products = useLiveQuery(() => db.products.toArray());
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredProducts = React.useMemo(() => {
    if (!products) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.brand?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const handlePrint = () => {
    if (!filteredProducts || filteredProducts.length === 0) return;

    const headers = ['KOD', 'ÜRÜN / MODEL', 'MARKA', 'KATEGORİ', 'STOK MİKTARI', 'BİRİM', 'DURUM'];
    const rows = filteredProducts.map(p => [
      p.code,
      p.name,
      p.brand || '-',
      p.category || 'Genel',
      p.stock.toString(),
      p.unit,
      p.stock <= p.minStock ? 'KRİTİK' : 'NORMAL'
    ]);
    const totalStock = filteredProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
    const criticalCount = filteredProducts.filter(p => p.stock <= p.minStock).length;
    
    printTabularReport(
      'Stok Özet Raporu',
      'Genel stok durumu, miktar özetleri ve kritik seviye kontrolleri',
      headers,
      rows,
      [
        { label: 'Toplam Model Sayısı', value: filteredProducts.length },
        { label: 'Toplam Stok Adedi', value: totalStock },
        { label: 'Kritik Stok Uyarısı', value: `${criticalCount} Model` }
      ]
    );
  };

  const handleExportExcel = () => {
    if (!filteredProducts || filteredProducts.length === 0) return;
    const headers = ['Ürün Kodu', 'Ürün / Model Adı', 'Marka', 'Kategori', 'Stok Miktarı', 'Birim', 'Kritik Seviye', 'Durum'];
    const rows = filteredProducts.map(p => [
      p.code,
      p.name,
      p.brand || '-',
      p.category || 'Genel',
      p.stock,
      p.unit,
      p.minStock || 0,
      p.stock <= (p.minStock || 0) ? 'KRİTİK STOK' : 'NORMAL'
    ]);
    exportToCsv('Stok_Ozet_Raporu.csv', headers, rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Stok Özet Raporu</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Genel stok durumunu ve miktar özetlerini görüntüleyin.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 dark:bg-slate-800/50 transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" /> Yazdır
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
          >
            <FileDown className="w-4 h-4" /> Excel'e Aktar
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="ARAMA YAP..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 text-[10px] font-bold uppercase tracking-widest transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="printable-table">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                <th className="px-6 py-3">Kod</th>
                <th className="px-6 py-3">Ürün/Model</th>
                <th className="px-6 py-3">Kategori</th>
                <th className="px-6 py-3 text-right">Miktar</th>
                <th className="px-6 py-3 text-right">Birim</th>
                <th className="px-6 py-3 text-right">Durum</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-600 divide-y divide-slate-50">
              {(!products || products.length === 0) && (
                <tr key="empty-summary">
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                    Gösterilecek veri bulunamadı.
                  </td>
                </tr>
              )}
              {filteredProducts.map((p) => (
                <tr 
                  key={p.id}
                  className="hover:bg-slate-50 dark:bg-slate-800/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className="font-mono text-[11px] font-bold text-slate-600">
                      {p.code}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px]">{p.name}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">{p.brand}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600">
                      {p.category || 'Genel'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={cn(
                      "font-bold font-mono",
                      p.stock <= p.minStock ? "text-rose-600" : "text-slate-900 dark:text-slate-100"
                    )}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                     <span className="text-slate-400 text-[10px] uppercase font-bold">{p.unit}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {p.stock <= p.minStock ? (
                      <span className="flex items-center justify-end gap-1 text-[10px] font-bold text-amber-600 uppercase">
                        <AlertTriangle className="w-3 h-3" /> Kritik
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">Normal</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
