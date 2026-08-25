import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { erpService } from '../../services/erpService';
import { 
  Package, 
  Search, 
  Palette, 
  Ruler, 
  Printer, 
  ChevronDown, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  Box, 
  Layers, 
  Filter, 
  Copy, 
  Check, 
  BarChart3, 
  ArrowUpDown, 
  Building2, 
  MapPin,
  Maximize2,
  Minimize2,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { printHtml } from '../../lib/printService';
import type { Product, AssortmentTemplate } from '../../types';

export default function StockDetailReport() {
  const products = useLiveQuery(() => db.products.toArray());
  const templates = useLiveQuery(() => db.assortmentTemplates.toArray());

  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [selectedBrand, setSelectedBrand] = React.useState<string>('all');
  const [filterType, setFilterType] = React.useState<'all' | 'footwear' | 'broken' | 'critical' | 'out_of_stock'>('all');
  const [sortBy, setSortBy] = React.useState<'name' | 'code' | 'stock_desc' | 'stock_asc'>('name');
  const [expandedProductIds, setExpandedProductIds] = React.useState<Record<number, boolean>>({});
  const [copiedBarcode, setCopiedBarcode] = React.useState<string | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncSuccess, setSyncSuccess] = React.useState(false);

  // Auto-sync variant stocks on load
  React.useEffect(() => {
    erpService.syncProductVariantStocks().catch(err => console.error('Sync error:', err));
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await erpService.syncProductVariantStocks();
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
    } catch (e) {
      console.error(e);
      alert('Stok senkronizasyonu sırasında hata oluştu.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Derive categories and brands
  const categories = React.useMemo(() => {
    if (!products) return [];
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const brands = React.useMemo(() => {
    if (!products) return [];
    const set = new Set<string>();
    products.forEach(p => {
      if (p.brand) set.add(p.brand);
    });
    return Array.from(set);
  }, [products]);

  // Process and filter products
  const processedProducts = React.useMemo(() => {
    if (!products) return [];

    // Map template map for quick lookup
    const templateMap = new Map<number, AssortmentTemplate>();
    templates?.forEach(t => {
      if (t.id) templateMap.set(t.id, t);
    });

    const list = products.map(p => {
      const isFootwear = p.isFootwear || (p.variantBarcodes && p.variantBarcodes.length > 0) || (p.colors && p.colors.length > 0);
      const template = p.assortmentTemplateId ? templateMap.get(p.assortmentTemplateId) : undefined;
      const templateItems = p.assortment || template?.items || [];
      const templateMultiplier = p.multiplier || templateItems.reduce((acc, curr) => acc + curr.quantity, 0) || 1;

      // Determine all unique colors
      const colorSet = new Set<string>();
      if (p.colors && p.colors.length > 0) {
        p.colors.forEach(c => colorSet.add(c));
      }
      if (p.variantBarcodes && p.variantBarcodes.length > 0) {
        p.variantBarcodes.forEach(v => {
          if (v.color) colorSet.add(v.color);
        });
      }
      if (p.colorBoxBarcodes && p.colorBoxBarcodes.length > 0) {
        p.colorBoxBarcodes.forEach(b => {
          if (b.color) colorSet.add(b.color);
        });
      }
      if (colorSet.size === 0) {
        colorSet.add('Standart');
      }

      const colorsList = Array.from(colorSet);

      // Process color rows
      let totalCalculatedStock = 0;
      let hasBrokenSize = false;

      const colorRows = colorsList.map(color => {
        // Color image
        const colorImage = p.colorImages?.find(ci => ci.color === color)?.image || p.image;
        // Color box barcode
        const boxBarcode = p.colorBoxBarcodes?.find(b => b.color === color)?.barcode;

        // Variants for this color
        const colorVariants = p.variantBarcodes?.filter(v => v.color === color) || [];
        
        // Build sizes list for this color
        const sizeMap = new Map<string, { size: string; barcode?: string; stock: number; templateRatio?: number }>();

        // 1. Add from template / product assortment
        templateItems.forEach(item => {
          sizeMap.set(item.size, {
            size: item.size,
            stock: 0,
            templateRatio: item.quantity
          });
        });

        // 2. Add / merge from variantBarcodes
        colorVariants.forEach(v => {
          const existing = sizeMap.get(v.size);
          if (existing) {
            existing.barcode = v.barcode;
            existing.stock = v.stock || 0;
          } else {
            sizeMap.set(v.size, {
              size: v.size,
              barcode: v.barcode,
              stock: v.stock || 0,
              templateRatio: 0
            });
          }
        });

        // If no variants and no template, create a single standard size entry
        if (sizeMap.size === 0) {
          sizeMap.set('Standart', {
            size: 'Standart',
            barcode: boxBarcode || p.code,
            stock: p.stock || 0,
            templateRatio: 1
          });
        }

        const sizeList = Array.from(sizeMap.values()).sort((a, b) => {
          const numA = parseFloat(a.size);
          const numB = parseFloat(b.size);
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
          }
          return a.size.localeCompare(b.size);
        });

        const colorTotalStock = sizeList.reduce((acc, curr) => acc + (curr.stock || 0), 0);
        totalCalculatedStock += colorTotalStock;

        // Check if color has broken size (some sizes > 0, some sizes === 0)
        const sizesWithStock = sizeList.filter(s => (s.stock || 0) > 0);
        const sizesWithoutStock = sizeList.filter(s => (s.stock || 0) === 0);
        const isColorBroken = sizeList.length > 1 && sizesWithStock.length > 0 && sizesWithoutStock.length > 0;
        if (isColorBroken) {
          hasBrokenSize = true;
        }

        const estimatedBoxes = templateMultiplier > 0 ? (colorTotalStock / templateMultiplier) : 0;

        return {
          color,
          colorImage,
          boxBarcode,
          sizeList,
          colorTotalStock,
          estimatedBoxes,
          isColorBroken,
          sizesWithStockCount: sizesWithStock.length,
          sizesWithoutStockCount: sizesWithoutStock.length,
          totalSizesCount: sizeList.length
        };
      });

      // Overall stock: if no variants at all, fallback to product.stock
      const finalStock = (p.variantBarcodes && p.variantBarcodes.length > 0) ? totalCalculatedStock : p.stock;
      const isCritical = finalStock <= (p.minStock || 0);
      const isOutOfStock = finalStock <= 0;

      return {
        ...p,
        isFootwear,
        templateName: template?.name || (templateItems.length > 0 ? 'Özel Asorti' : 'Standart'),
        templateMultiplier,
        templateItems,
        colorRows,
        finalStock,
        hasBrokenSize,
        isCritical,
        isOutOfStock,
        totalColorsCount: colorRows.length
      };
    });

    // Apply filtering
    return list.filter(p => {
      // Search term
      const search = searchTerm.toLowerCase().trim();
      if (search) {
        const matchCode = p.code.toLowerCase().includes(search);
        const matchName = p.name.toLowerCase().includes(search);
        const matchBrand = p.brand?.toLowerCase().includes(search);
        const matchCategory = p.category?.toLowerCase().includes(search);
        const matchColor = p.colorRows.some(c => c.color.toLowerCase().includes(search));
        const matchBarcode = p.colorRows.some(c => 
          (c.boxBarcode && c.boxBarcode.toLowerCase().includes(search)) ||
          c.sizeList.some(s => s.barcode && s.barcode.toLowerCase().includes(search))
        );
        if (!matchCode && !matchName && !matchBrand && !matchCategory && !matchColor && !matchBarcode) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }

      // Brand filter
      if (selectedBrand !== 'all' && p.brand !== selectedBrand) {
        return false;
      }

      // Filter type
      if (filterType === 'footwear' && !p.isFootwear) return false;
      if (filterType === 'broken' && !p.hasBrokenSize) return false;
      if (filterType === 'critical' && !p.isCritical) return false;
      if (filterType === 'out_of_stock' && !p.isOutOfStock) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'tr');
      if (sortBy === 'code') return a.code.localeCompare(b.code, 'tr');
      if (sortBy === 'stock_desc') return b.finalStock - a.finalStock;
      if (sortBy === 'stock_asc') return a.finalStock - b.finalStock;
      return 0;
    });
  }, [products, templates, searchTerm, selectedCategory, selectedBrand, filterType, sortBy]);

  // Expand all / collapse all
  const areAllExpanded = React.useMemo(() => {
    if (processedProducts.length === 0) return false;
    return processedProducts.every(p => p.id && expandedProductIds[p.id] !== false);
  }, [processedProducts, expandedProductIds]);

  const toggleExpandAll = () => {
    if (areAllExpanded) {
      // Collapse all
      const newMap: Record<number, boolean> = {};
      processedProducts.forEach(p => {
        if (p.id) newMap[p.id] = false;
      });
      setExpandedProductIds(newMap);
    } else {
      // Expand all
      const newMap: Record<number, boolean> = {};
      processedProducts.forEach(p => {
        if (p.id) newMap[p.id] = true;
      });
      setExpandedProductIds(newMap);
    }
  };

  const toggleProductExpand = (id?: number) => {
    if (!id) return;
    setExpandedProductIds(prev => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id]
    }));
  };

  const isProductExpanded = (id?: number) => {
    if (!id) return true;
    // Default to true (expanded) for convenience unless explicitly collapsed
    return expandedProductIds[id] !== false;
  };

  // Copy barcode helper
  const handleCopyBarcode = (barcode: string) => {
    navigator.clipboard.writeText(barcode);
    setCopiedBarcode(barcode);
    setTimeout(() => setCopiedBarcode(null), 2000);
  };

  // Summary Metrics
  const summaryStats = React.useMemo(() => {
    if (!processedProducts) return { totalProducts: 0, totalColors: 0, totalStock: 0, brokenColorsCount: 0, criticalCount: 0 };
    let totalStock = 0;
    let totalColors = 0;
    let brokenColorsCount = 0;
    let criticalCount = 0;

    processedProducts.forEach(p => {
      totalStock += p.finalStock;
      totalColors += p.colorRows.length;
      if (p.isCritical) criticalCount++;
      p.colorRows.forEach(c => {
        if (c.isColorBroken) brokenColorsCount++;
      });
    });

    return {
      totalProducts: processedProducts.length,
      totalColors,
      totalStock,
      brokenColorsCount,
      criticalCount
    };
  }, [processedProducts]);

  // Comprehensive Printable Tabular Report (HTML)
  const handlePrint = () => {
    if (!processedProducts || processedProducts.length === 0) {
      alert('Yazdırılacak ürün bulunamadı.');
      return;
    }

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; width: 100%; padding: 4px;">
        
        <!-- Header -->
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div style="font-size: 10px; font-weight: 800; color: #4f46e5; letter-spacing: 0.1em; text-transform: uppercase;">PROERP ENVANTER & ASORTİ ANALİZİ</div>
            <h1 style="font-size: 20px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin: 2px 0 0 0;">Stok Detay & Asorti Raporu</h1>
            <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0;">Üst satır stok bilgisi, her renk için ayrı satır ve asorti beden dökümü</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; font-weight: 700; color: #64748b;">Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
            <div style="font-size: 11px; font-weight: 800; color: #0f172a; margin-top: 2px;">Toplam: ${summaryStats.totalProducts} Model • ${summaryStats.totalColors} Renk • ${summaryStats.totalStock} Adet/Çift</div>
          </div>
        </div>

        <!-- KPI summary row -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px;">
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Toplam Model</div>
            <div style="font-size: 15px; font-weight: 900; color: #0f172a;">${summaryStats.totalProducts}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px;">
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Renk Varyantı</div>
            <div style="font-size: 15px; font-weight: 900; color: #4f46e5;">${summaryStats.totalColors}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px;">
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Toplam Stok</div>
            <div style="font-size: 15px; font-weight: 900; color: #059669;">${summaryStats.totalStock}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px;">
            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Kırık Bedenli Renk</div>
            <div style="font-size: 15px; font-weight: 900; color: #e11d48;">${summaryStats.brokenColorsCount}</div>
          </div>
        </div>

        <!-- Products List -->
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${processedProducts.map(p => `
            <div style="border: 1.5px solid #cbd5e1; border-radius: 8px; overflow: hidden; page-break-inside: avoid; margin-bottom: 12px;">
              
              <!-- ÜST SATIR: Ana Ürün & Stok Bilgisi -->
              <div style="background: #0f172a; color: white; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="background: #4f46e5; color: white; font-weight: 800; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${p.code}</span>
                  <span style="font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.02em;">${p.name}</span>
                  ${p.brand ? `<span style="background: rgba(255,255,255,0.15); font-size: 9px; padding: 1px 6px; border-radius: 3px;">${p.brand}</span>` : ''}
                  ${p.category ? `<span style="background: rgba(255,255,255,0.15); font-size: 9px; padding: 1px 6px; border-radius: 3px;">${p.category}</span>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="font-size: 10px; color: #94a3b8;">Şablon: <b>${p.templateName} (${p.templateMultiplier} Çift/Koli)</b></span>
                  ${p.shelf ? `<span style="font-size: 10px; color: #94a3b8;">Raf: <b>${p.shelf} ${p.location ? '/' + p.location : ''}</b></span>` : ''}
                  <span style="background: #ffffff; color: #0f172a; font-weight: 900; font-size: 12px; padding: 2px 8px; border-radius: 4px; font-family: monospace;">
                    TOPLAM: ${p.finalStock} ${p.unit || 'Çift'}
                  </span>
                </div>
              </div>

              <!-- ALT DETAYI: Her Renk İçin Ayrı Satır ve Asorti -->
              <div style="background: #ffffff; padding: 8px;">
                ${p.colorRows.map((c, cIdx) => `
                  <div style="margin-bottom: ${cIdx === p.colorRows.length - 1 ? '0' : '10px'}; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background: #fafafa;">
                    
                    <!-- Renk Başlığı Satırı -->
                    <div style="background: #f1f5f9; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: 800; font-size: 11px; color: #1e293b; text-transform: uppercase;">🎨 RENK: ${c.color}</span>
                        ${c.boxBarcode ? `<span style="font-size: 9px; font-family: monospace; background: #e0e7ff; color: #3730a3; padding: 1px 5px; border-radius: 3px;">Barkod: ${c.boxBarcode}</span>` : ''}
                        ${c.isColorBroken ? `<span style="font-size: 9px; background: #fee2e2; color: #991b1b; font-weight: 800; padding: 1px 6px; border-radius: 3px;">⚠️ KIRIK BEDEN</span>` : ''}
                      </div>
                      <div style="font-size: 11px; font-weight: 800; color: #0f172a;">
                        Renk Stoğu: <span style="font-size: 12px; color: #4f46e5; font-family: monospace;">${c.colorTotalStock} ${p.unit || 'Çift'}</span>
                        ${c.estimatedBoxes > 0 ? `<span style="font-size: 9px; color: #64748b; margin-left: 4px;">(~${c.estimatedBoxes.toFixed(1)} Koli)</span>` : ''}
                      </div>
                    </div>

                    <!-- Asorti Beden Tablosu -->
                    <div style="padding: 6px;">
                      <table style="width: 100%; border-collapse: collapse; font-size: 10px; text-align: center;">
                        <thead>
                          <tr style="background: #e2e8f0; color: #475569; font-weight: 800; font-size: 9px; text-transform: uppercase;">
                            <th style="padding: 4px 6px; text-align: left; border: 1px solid #cbd5e1; width: 80px;">Ölçüt</th>
                            ${c.sizeList.map(s => `
                              <th style="padding: 4px 6px; border: 1px solid #cbd5e1; font-weight: 900; color: #0f172a;">${s.size}</th>
                            `).join('')}
                            <th style="padding: 4px 6px; border: 1px solid #cbd5e1; background: #cbd5e1; color: #0f172a; font-weight: 900; width: 70px;">TOPLAM</th>
                          </tr>
                        </thead>
                        <tbody>
                          <!-- Asorti Oranı (Şablon) -->
                          ${p.isFootwear && c.sizeList.some(s => (s.templateRatio || 0) > 0) ? `
                            <tr style="background: #ffffff;">
                              <td style="padding: 4px 6px; text-align: left; font-weight: 700; color: #64748b; border: 1px solid #e2e8f0; background: #f8fafc;">
                                Koli Asortisi
                              </td>
                              ${c.sizeList.map(s => `
                                <td style="padding: 4px 6px; border: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">
                                  ${s.templateRatio || '-'}
                                </td>
                              `).join('')}
                              <td style="padding: 4px 6px; border: 1px solid #e2e8f0; background: #f1f5f9; font-weight: 800; color: #334155;">
                                ${p.templateMultiplier}
                              </td>
                            </tr>
                          ` : ''}
                          <!-- Mevcut Stok -->
                          <tr style="background: #ffffff;">
                            <td style="padding: 5px 6px; text-align: left; font-weight: 800; color: #0f172a; border: 1px solid #cbd5e1; background: #f8fafc;">
                              Mevcut Stok
                            </td>
                            ${c.sizeList.map(s => `
                              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: 900; font-size: 11px; font-family: monospace; background: ${s.stock === 0 ? '#fff1f2' : '#f0fdf4'}; color: ${s.stock === 0 ? '#e11d48' : '#15803d'};">
                                ${s.stock}
                              </td>
                            `).join('')}
                            <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #e0e7ff; font-weight: 900; font-size: 12px; font-family: monospace; color: #3730a3;">
                              ${c.colorTotalStock}
                            </td>
                          </tr>
                          <!-- Beden Barkodu -->
                          <tr style="background: #f8fafc;">
                            <td style="padding: 3px 6px; text-align: left; font-weight: 700; font-size: 8px; color: #94a3b8; border: 1px solid #e2e8f0;">
                              Beden Barkod
                            </td>
                            ${c.sizeList.map(s => `
                              <td style="padding: 3px 4px; border: 1px solid #e2e8f0; font-size: 8px; font-family: monospace; color: #64748b;">
                                ${s.barcode ? s.barcode.slice(-8) : '-'}
                              </td>
                            `).join('')}
                            <td style="padding: 3px 6px; border: 1px solid #e2e8f0; font-size: 8px; color: #94a3b8;">
                              -
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                  </div>
                `).join('')}
              </div>

            </div>
          `).join('')}
        </div>

        <!-- Footer -->
        <div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between;">
          <span>ProERP Ayakkabı & Üretim Yönetim Sistemi • Stok Detay Raporu</span>
          <span>Yazdırıldı: ${new Date().toLocaleString('tr-TR')}</span>
        </div>

      </div>
    `;

    printHtml(html, { title: 'ProERP Stok Detay & Asorti Raporu' });
  };

  return (
    <div className="space-y-6" id="stock-detail-report-container">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              Envanter & Varyant Dağılımı
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Asorti / Renk Matrisi
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
            Stok Detay & Asorti Raporu
          </h2>
          <p className="text-slate-500 text-xs font-medium">
            Üst satırda ana ürün ve stok bilgisi, alt detayında her renk için ayrı satır ve asorti beden dökümü.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={handleManualSync}
            disabled={isSyncing}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 border rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs",
              syncSuccess 
                ? "bg-emerald-50 border-emerald-300 text-emerald-700" 
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
            title="Model ve varyant stoklarını asorti oranlarına göre eşitle / düzelt"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin text-indigo-600", syncSuccess && "text-emerald-600")} />
            <span>{isSyncing ? "Senkronize Ediliyor..." : syncSuccess ? "Stoklar Eşitlendi ✓" : "Stokları Eşitle / Onar"}</span>
          </button>

          <button 
            onClick={toggleExpandAll}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-all shadow-xs"
            title={areAllExpanded ? "Tüm modellerin alt detayını kapat" : "Tüm modellerin alt detayını aç"}
          >
            {areAllExpanded ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Tümünü Daralt</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Tümünü Genişlet</span>
              </>
            )}
          </button>

          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
          >
            <Printer className="w-4 h-4" /> 
            <span>Raporu Yazdır / PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Toplam Model</div>
            <div className="text-xl font-black text-slate-900 tracking-tight font-mono">{summaryStats.totalProducts}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Renk Varyantı</div>
            <div className="text-xl font-black text-indigo-600 tracking-tight font-mono">{summaryStats.totalColors} <span className="text-xs text-slate-400 font-normal">Renk</span></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Toplam Stok</div>
            <div className="text-xl font-black text-emerald-700 tracking-tight font-mono">{summaryStats.totalStock} <span className="text-xs text-slate-400 font-normal">Çift/Adet</span></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-rose-500">Kırık Bedenli Renk</div>
            <div className="text-xl font-black text-rose-600 tracking-tight font-mono">{summaryStats.brokenColorsCount} <span className="text-xs text-slate-400 font-normal">Renk</span></div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search Input */}
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="MODEL ADI, KOD, RENK VEYA BARKOD ARA..." 
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-bold uppercase tracking-wider text-slate-800 placeholder:text-slate-400 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {categories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">Tüm Kategoriler</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            {brands.length > 0 && (
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">Tüm Markalar</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            )}

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="name">Sırala: İsim (A-Z)</option>
              <option value="code">Sırala: Ürün Kodu</option>
              <option value="stock_desc">Sırala: Stok (Azalan)</option>
              <option value="stock_asc">Sırala: Stok (Artan)</option>
            </select>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filtre:
          </span>

          <button
            onClick={() => setFilterType('all')}
            className={cn(
              "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
              filterType === 'all' 
                ? "bg-slate-900 text-white shadow-xs" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            Tüm Ürünler ({products?.length || 0})
          </button>

          <button
            onClick={() => setFilterType('footwear')}
            className={cn(
              "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
              filterType === 'footwear' 
                ? "bg-indigo-600 text-white shadow-xs" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            Ayakkabı / Asortili Modeller
          </button>

          <button
            onClick={() => setFilterType('broken')}
            className={cn(
              "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1",
              filterType === 'broken' 
                ? "bg-rose-600 text-white shadow-xs" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            <AlertTriangle className="w-3 h-3" />
            Kırık Bedenler ({summaryStats.brokenColorsCount})
          </button>

          <button
            onClick={() => setFilterType('critical')}
            className={cn(
              "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
              filterType === 'critical' 
                ? "bg-amber-600 text-white shadow-xs" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            Kritik Stok (&le; Min Stok)
          </button>

          <button
            onClick={() => setFilterType('out_of_stock')}
            className={cn(
              "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
              filterType === 'out_of_stock' 
                ? "bg-slate-800 text-white shadow-xs" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            Tükenenler (0 Stok)
          </button>
        </div>
      </div>

      {/* Main Stock & Color-Assortment List */}
      <div className="space-y-4">
        {processedProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700 uppercase tracking-wider">Kriterlere Uygun Kayıt Bulunamadı</h3>
            <p className="text-xs text-slate-400 mt-1">Arama kelimenizi veya filtre seçimlerinizi değiştirerek tekrar deneyebilirsiniz.</p>
          </div>
        ) : (
          processedProducts.map((p) => {
            const isExpanded = isProductExpanded(p.id);

            return (
              <div 
                key={p.id || p.code}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all hover:border-slate-300"
                id={`product-card-${p.id}`}
              >
                {/* ════════════════════════════════════════════════════════════════
                    ÜST SATIR: Ana Stok & Model Kart Başlığı
                   ════════════════════════════════════════════════════════════════ */}
                <div 
                  onClick={() => toggleProductExpand(p.id)}
                  className={cn(
                    "p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer transition-colors select-none",
                    isExpanded ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50/80 text-slate-900"
                  )}
                >
                  {/* Left: Product Info */}
                  <div className="flex items-center gap-3.5">
                    {/* Thumbnail Image */}
                    <div className={cn(
                      "w-14 h-14 rounded-xl border flex items-center justify-center overflow-hidden shrink-0 transition-all",
                      isExpanded 
                        ? "bg-slate-800 border-slate-700" 
                        : "bg-slate-100 border-slate-200"
                    )}>
                      {p.image ? (
                        <img 
                          src={p.image} 
                          alt={p.name} 
                          className="w-full h-full object-contain p-1" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Package className={cn("w-6 h-6", isExpanded ? "text-slate-400" : "text-slate-400")} />
                      )}
                    </div>

                    <div>
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-md font-mono text-xs font-black tracking-wider uppercase",
                          isExpanded ? "bg-indigo-500 text-white" : "bg-indigo-50 text-indigo-700"
                        )}>
                          {p.code}
                        </span>

                        {p.brand && (
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                            isExpanded ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                          )}>
                            {p.brand}
                          </span>
                        )}

                        {p.category && (
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                            isExpanded ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                          )}>
                            {p.category}
                          </span>
                        )}

                        {p.hasBrokenSize && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Kırık Beden
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-base sm:text-lg font-black uppercase tracking-tight">
                        {p.name}
                      </h3>

                      {/* Sub-meta details */}
                      <div className={cn(
                        "flex flex-wrap items-center gap-3 text-[11px] font-medium mt-1",
                        isExpanded ? "text-slate-400" : "text-slate-500"
                      )}>
                        {p.shelf && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            Raf: <b className={isExpanded ? "text-slate-200" : "text-slate-700"}>{p.shelf} {p.location ? `(${p.location})` : ''}</b>
                          </span>
                        )}
                        <span>•</span>
                        <span>
                          Şablon: <b className={isExpanded ? "text-slate-200" : "text-slate-700"}>{p.templateName} ({p.templateMultiplier} {p.secondaryUnit || 'Çift'}/Koli)</b>
                        </span>
                        <span>•</span>
                        <span>
                          Renk Sayısı: <b className={isExpanded ? "text-indigo-400" : "text-indigo-600"}>{p.totalColorsCount} Renk</b>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Stock Figures & Accordion Indicator */}
                  <div className="flex items-center justify-between lg:justify-end gap-6 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-700/50">
                    <div className="text-left lg:text-right">
                      <div className={cn(
                        "text-[10px] font-bold uppercase tracking-widest",
                        isExpanded ? "text-slate-400" : "text-slate-400"
                      )}>
                        Toplam Mevcut Stok
                      </div>
                      <div className="flex items-baseline gap-1.5 lg:justify-end">
                        <span className={cn(
                          "text-2xl font-black font-mono tracking-tight",
                          p.finalStock <= 0 
                            ? "text-rose-500" 
                            : p.isCritical 
                              ? "text-amber-400" 
                              : isExpanded ? "text-emerald-400" : "text-emerald-600"
                        )}>
                          {p.finalStock}
                        </span>
                        <span className={cn("text-xs font-bold uppercase", isExpanded ? "text-slate-300" : "text-slate-500")}>
                          {p.unit || 'Çift'}
                        </span>
                      </div>

                      {p.multiplier && p.multiplier > 1 && (
                        <div className={cn("text-[10px] font-medium font-mono", isExpanded ? "text-slate-400" : "text-slate-400")}>
                          ~{(p.finalStock / p.multiplier).toFixed(1)} Koli
                        </div>
                      )}
                    </div>

                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-200 shrink-0",
                      isExpanded ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"
                    )}>
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* ════════════════════════════════════════════════════════════════
                    ALT DETAYI: Her Renk İçin Ayrı Satır ve Asorti Beden Dökümü
                   ════════════════════════════════════════════════════════════════ */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                          <Palette className="w-4 h-4 text-indigo-600" />
                          Renk & Asorti Dağılımı ({p.colorRows.length} Renk)
                        </h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Beden bazında anlık envanter
                        </span>
                      </div>

                      {/* Color Rows */}
                      <div className="space-y-3.5">
                        {p.colorRows.map((c, cIdx) => (
                          <div 
                            key={`${p.id}-${c.color}-${cIdx}`}
                            className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden"
                          >
                            {/* Renk Başlık Satırı */}
                            <div className="p-3 sm:px-4 bg-slate-100/70 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                {/* Color Swatch / Mini image */}
                                {c.colorImage ? (
                                  <div className="w-9 h-9 rounded-lg border border-slate-200 bg-white overflow-hidden shrink-0 flex items-center justify-center">
                                    <img 
                                      src={c.colorImage} 
                                      alt={c.color} 
                                      className="w-full h-full object-contain p-0.5" 
                                      referrerPolicy="no-referrer" 
                                    />
                                  </div>
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-black text-xs shrink-0">
                                    {c.color.slice(0, 2).toUpperCase()}
                                  </div>
                                )}

                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-black uppercase tracking-tight text-slate-900">
                                      {c.color}
                                    </span>
                                    {c.isColorBroken && (
                                      <span className="text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200 px-2 py-0.5 rounded flex items-center gap-1">
                                        <AlertTriangle className="w-2.5 h-2.5" />
                                        Kırık Beden ({c.sizesWithoutStockCount} Beden 0)
                                      </span>
                                    )}
                                    {!c.isColorBroken && c.colorTotalStock > 0 && (
                                      <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
                                        <CheckCircle2 className="w-2.5 h-2.5" />
                                        Tam Seri
                                      </span>
                                    )}
                                  </div>

                                  {/* Koli Barkodu */}
                                  {c.boxBarcode && (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">Koli Barkodu:</span>
                                      <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50/80 px-1.5 py-0.2 rounded border border-indigo-100">
                                        {c.boxBarcode}
                                      </span>
                                      <button 
                                        onClick={() => handleCopyBarcode(c.boxBarcode!)}
                                        className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5"
                                        title="Barkodu Kopyala"
                                      >
                                        {copiedBarcode === c.boxBarcode ? (
                                          <Check className="w-3 h-3 text-emerald-600" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Renk Toplam Stoğu */}
                              <div className="flex items-center gap-4 self-end sm:self-center">
                                <div className="text-right">
                                  <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                    Renk Stoğu
                                  </div>
                                  <div className="flex items-baseline gap-1">
                                    <span className={cn(
                                      "text-lg font-black font-mono",
                                      c.colorTotalStock <= 0 ? "text-rose-600" : "text-slate-900"
                                    )}>
                                      {c.colorTotalStock}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                                      {p.unit || 'Çift'}
                                    </span>
                                    {c.estimatedBoxes > 0 && (
                                      <span className="text-[10px] text-slate-400 font-mono font-medium ml-1">
                                        (~{c.estimatedBoxes.toFixed(1)} Koli)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Asorti Beden Dağılım Matrisi / Tablosu */}
                            <div className="p-3 overflow-x-auto">
                              <table className="w-full text-center border-collapse min-w-[500px]">
                                <thead>
                                  <tr className="bg-slate-100/90 text-slate-600 text-[10px] font-black uppercase tracking-wider border border-slate-200">
                                    <th className="py-2 px-3 text-left w-32 border-r border-slate-200 bg-slate-200/70">
                                      Beden / Numara
                                    </th>
                                    {c.sizeList.map((s, sIdx) => (
                                      <th 
                                        key={`${s.size}-${sIdx}`}
                                        className="py-2 px-3 border-r border-slate-200 last:border-r-0 font-mono text-xs font-black text-slate-900"
                                      >
                                        {s.size}
                                      </th>
                                    ))}
                                    <th className="py-2 px-3 bg-indigo-50/80 text-indigo-900 border-l border-indigo-100 font-black w-24">
                                      TOPLAM
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {/* Asorti Şablon Dağılımı (Koli içi standart oranı) */}
                                  {p.isFootwear && c.sizeList.some(s => (s.templateRatio || 0) > 0) && (
                                    <tr className="border-b border-slate-100 text-xs text-slate-500 bg-slate-50/40">
                                      <td className="py-2 px-3 text-left font-bold text-[10px] uppercase tracking-wider text-slate-400 border-r border-slate-200 bg-slate-50">
                                        Koli Şablonu
                                      </td>
                                      {c.sizeList.map((s, sIdx) => (
                                        <td 
                                          key={`ratio-${s.size}-${sIdx}`}
                                          className="py-2 px-3 border-r border-slate-100 last:border-r-0 font-mono font-bold text-slate-400"
                                        >
                                          {s.templateRatio || '-'}
                                        </td>
                                      ))}
                                      <td className="py-2 px-3 border-l border-indigo-100 bg-indigo-50/40 font-mono font-black text-indigo-600">
                                        {p.templateMultiplier}
                                      </td>
                                    </tr>
                                  )}

                                  {/* Mevcut Stok Satırı */}
                                  <tr className="border-b border-slate-200 bg-white">
                                    <td className="py-2.5 px-3 text-left font-black text-xs uppercase tracking-wider text-slate-900 border-r border-slate-200 bg-slate-50/80">
                                      Mevcut Stok
                                    </td>
                                    {c.sizeList.map((s, sIdx) => {
                                      const isZero = (s.stock || 0) === 0;
                                      return (
                                        <td 
                                          key={`stock-${s.size}-${sIdx}`}
                                          className={cn(
                                            "py-2.5 px-3 border-r border-slate-200 last:border-r-0 font-mono text-sm font-black transition-colors",
                                            isZero 
                                              ? "bg-rose-50/80 text-rose-600" 
                                              : "bg-emerald-50/40 text-emerald-800"
                                          )}
                                        >
                                          {isZero ? (
                                            <div className="flex flex-col items-center">
                                              <span>0</span>
                                              <span className="text-[8px] font-bold text-rose-500 uppercase tracking-tighter">
                                                Tükendi
                                              </span>
                                            </div>
                                          ) : (
                                            <span>{s.stock}</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                    <td className="py-2.5 px-3 border-l border-indigo-200 bg-indigo-50 font-mono text-base font-black text-indigo-700">
                                      {c.colorTotalStock}
                                    </td>
                                  </tr>

                                  {/* Beden Tekil Barkodu */}
                                  <tr className="text-[10px] text-slate-400 bg-slate-50/30">
                                    <td className="py-1.5 px-3 text-left font-bold text-[9px] uppercase tracking-wider text-slate-400 border-r border-slate-200">
                                      Beden Barkodu
                                    </td>
                                    {c.sizeList.map((s, sIdx) => (
                                      <td 
                                        key={`bc-${s.size}-${sIdx}`}
                                        className="py-1.5 px-2 border-r border-slate-100 last:border-r-0 font-mono text-[9px]"
                                      >
                                        {s.barcode ? (
                                          <span 
                                            onClick={() => handleCopyBarcode(s.barcode!)}
                                            className="cursor-pointer hover:text-indigo-600 hover:underline inline-flex items-center gap-0.5"
                                            title={`Kopyalamak için tıkla: ${s.barcode}`}
                                          >
                                            {s.barcode.length > 10 ? `...${s.barcode.slice(-7)}` : s.barcode}
                                            {copiedBarcode === s.barcode && <Check className="w-2.5 h-2.5 text-emerald-600" />}
                                          </span>
                                        ) : (
                                          <span className="text-slate-300">-</span>
                                        )}
                                      </td>
                                    ))}
                                    <td className="py-1.5 px-3 border-l border-indigo-100 bg-indigo-50/20 text-slate-400 text-[9px]">
                                      {c.sizeList.length} Beden
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
