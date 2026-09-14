import { db } from '../db';
import { BarcodeTemplate, LabelPresetSize } from '../types';
import { INITIAL_BARCODE_TEMPLATES } from '../data/initialBarcodeTemplates';
import { printHtml } from '../lib/printService';
import { encodeCode128 } from '../lib/barcodeGenerator';

export interface SampleLabelData {
  companyName?: string;
  productCode?: string;
  productName?: string;
  color?: string;
  material?: string;
  size?: string;
  assortmentMatrix?: { [size: string]: number };
  totalPairs?: number;
  barcode?: string;
  price?: number;
  currency?: string;
  orderNumber?: string;
  customerName?: string;
  boxNumber?: number;
  totalBoxes?: number;
  weightKg?: number;
  desi?: number;
  productImage?: string;
  customNote?: string;
}

export const barcodeTemplateService = {
  async getAll(): Promise<BarcodeTemplate[]> {
    return await db.barcodeTemplates.toArray();
  },

  async getById(id: number): Promise<BarcodeTemplate | undefined> {
    return await db.barcodeTemplates.get(id);
  },

  async create(template: Omit<BarcodeTemplate, 'id'>): Promise<number> {
    return await db.barcodeTemplates.add({
      ...template,
      createdAt: new Date(),
      updatedAt: new Date()
    } as any) as number;
  },

  async update(id: number, updates: Partial<BarcodeTemplate>): Promise<number> {
    return await db.barcodeTemplates.update(id, {
      ...updates,
      updatedAt: new Date()
    });
  },

  async delete(id: number): Promise<void> {
    await db.barcodeTemplates.delete(id);
  },

  async duplicate(id: number): Promise<number | null> {
    const original = await db.barcodeTemplates.get(id);
    if (!original) return null;

    const copy: Omit<BarcodeTemplate, 'id'> = {
      ...original,
      name: `${original.name} (Kopya)`,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    delete (copy as any).id;
    return await db.barcodeTemplates.add(copy as any) as number;
  },

  async resetDefaults(): Promise<void> {
    await db.barcodeTemplates.clear();
    await db.barcodeTemplates.bulkAdd(INITIAL_BARCODE_TEMPLATES as any);
  },

  getDimensionsForPreset(preset: LabelPresetSize, customW = 100, customH = 150): { width: number; height: number } {
    if (preset === 'custom') {
      return { width: Math.max(20, customW || 100), height: Math.max(15, customH || 150) };
    }
    const parts = preset.split('x').map(Number);
    return { width: parts[0] || 100, height: parts[1] || 150 };
  },

  renderBarcodeSvgString(value: string, height = 40): string {
    try {
      const { modules } = encodeCode128(value);
      const moduleWidth = 2;
      const totalWidth = modules.length * moduleWidth;

      let rects = '';
      let x = 0;
      for (let i = 0; i < modules.length; i++) {
        if (modules[i]) {
          rects += `<rect x="${x}" y="0" width="${moduleWidth}" height="${height}" fill="#000000" />`;
        }
        x += moduleWidth;
      }

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" style="width: 100%; max-height: ${height}px; height: ${height}px; display: block;" preserveAspectRatio="none">${rects}</svg>`;
    } catch {
      return `<div style="font-family: monospace; font-weight: bold; border: 1px solid black; padding: 4px; text-align: center;">*${value}*</div>`;
    }
  },

  generateLabelHtml(template: BarcodeTemplate, data: SampleLabelData): string {
    const { widthMm, heightMm, config } = template;
    const isLandscape = template.orientation === 'landscape';
    const effectiveW = isLandscape ? Math.max(widthMm, heightMm) : Math.min(widthMm, heightMm);
    const effectiveH = isLandscape ? Math.min(widthMm, heightMm) : Math.max(widthMm, heightMm);

    const barcodeVal = data.barcode || '8690123456789';
    const barcodeSvg = barcodeTemplateService.renderBarcodeSvgString(barcodeVal, config.barcodeHeight || 36);

    const assortmentEntries = Object.entries(data.assortmentMatrix || {
      '40': 1, '41': 2, '42': 3, '43': 3, '44': 2, '45': 1
    });

    const isSmallLabel = effectiveH <= 45 || effectiveW <= 60;
    const is100x150 = (widthMm === 100 && heightMm === 150) || (widthMm === 150 && heightMm === 100);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${template.name} - ${barcodeVal}</title>
        <style>
          @page {
            size: ${effectiveW}mm ${effectiveH}mm;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #000000;
            line-height: 1.15;
          }
          .thermal-page {
            width: ${effectiveW}mm;
            height: ${effectiveH}mm;
            max-width: ${effectiveW}mm;
            max-height: ${effectiveH}mm;
            padding: ${isSmallLabel ? '2mm' : '3.5mm'};
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
            background: #ffffff;
            border: ${config.borderStyle === 'solid' ? '1.5px solid #000' : config.borderStyle === 'dashed' ? '1.5px dashed #000' : 'none'};
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #000;
            padding-bottom: 1.5mm;
            margin-bottom: 1.5mm;
          }
          .company-title {
            font-weight: 900;
            font-size: ${isSmallLabel ? '8pt' : '11pt'};
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .product-title {
            font-weight: 900;
            font-size: ${isSmallLabel ? '9pt' : '13pt'};
            text-transform: uppercase;
            line-height: 1.1;
          }
          .product-code {
            font-weight: 900;
            font-family: monospace;
            font-size: ${isSmallLabel ? '8pt' : '11pt'};
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1.5mm;
            margin: 1mm 0;
            font-size: ${isSmallLabel ? '7pt' : '9pt'};
          }
          .meta-box {
            border: 1px solid #000;
            padding: 1mm 1.5mm;
            border-radius: 1mm;
          }
          .meta-label {
            font-size: 6pt;
            font-weight: 800;
            text-transform: uppercase;
            color: #333;
            display: block;
          }
          .meta-val {
            font-weight: 900;
            font-size: ${isSmallLabel ? '8pt' : '10pt'};
            text-transform: uppercase;
          }
          .assortment-table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5mm 0;
            text-align: center;
            font-size: ${isSmallLabel ? '7pt' : '8.5pt'};
          }
          .assortment-table th {
            background: #000;
            color: #fff;
            padding: 1mm;
            font-weight: 900;
            border: 1px solid #000;
          }
          .assortment-table td {
            border: 1px solid #000;
            padding: 1mm;
            font-weight: 900;
          }
          .barcode-section {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin: 1mm 0;
            padding: 1mm;
            border: 1px solid #000;
            border-radius: 1mm;
          }
          .barcode-text {
            font-family: monospace;
            font-weight: 900;
            font-size: ${isSmallLabel ? '7pt' : '10pt'};
            letter-spacing: 1px;
            margin-top: 0.5mm;
          }
          .logistics-icons {
            display: flex;
            gap: 3mm;
            align-items: center;
            justify-content: flex-end;
          }
          .piktogram {
            border: 1.5px solid #000;
            padding: 1mm;
            border-radius: 1mm;
            font-weight: 900;
            font-size: 8pt;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .footer-note {
            font-size: 6pt;
            font-weight: 800;
            text-transform: uppercase;
            border-top: 1px solid #000;
            padding-top: 1mm;
            margin-top: 1mm;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="thermal-page">
          <!-- 1. Header -->
          ${config.showCompanyHeader ? `
            <div class="header-row">
              <span class="company-title">${config.companyHeaderText || data.companyName || 'PROERP AYAKKABI SANAYİ'}</span>
              ${config.showBoxSerial && data.boxNumber ? `
                <div style="background: #000; color: #fff; font-weight: 900; font-size: ${isSmallLabel ? '7pt' : '9pt'}; padding: 0.8mm 2mm; border-radius: 1mm;">
                  KOLİ: ${data.boxNumber} / ${data.totalBoxes || 1}
                </div>
              ` : ''}
            </div>
          ` : ''}

          <!-- 2. Product Info & Image -->
          <div style="display: flex; gap: 2mm; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1;">
              ${config.showProductCode ? `<div class="product-code">KOD: ${data.productCode || 'AYK-2026-01'}</div>` : ''}
              ${config.showProductName ? `<div class="product-title">${data.productName || 'HAKİKİ DERİ ERKEK KLASİK'}</div>` : ''}
            </div>
            ${config.showProductImage && data.productImage ? `
              <div style="width: ${config.imageSizeMm || 22}mm; height: ${config.imageSizeMm || 22}mm; border: 1px solid #000; border-radius: 1mm; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; ${config.imagePosition === 'top' ? 'margin: 0 auto 1mm auto;' : ''}">
                <img src="${data.productImage}" style="width: 100%; height: 100%; object-fit: ${config.imageFit || 'contain'};" />
              </div>
            ` : ''}
          </div>

          <!-- 3. Details: Color, Material, Size, Price -->
          <div class="meta-grid">
            ${config.showColor ? `
              <div class="meta-box">
                <span class="meta-label">RENK / VARYANT:</span>
                <span class="meta-val">${data.color || 'SİYAH / BLACK'}</span>
              </div>
            ` : ''}

            ${config.showMaterial ? `
              <div class="meta-box">
                <span class="meta-label">SAYA / MALZEME:</span>
                <span class="meta-val">${data.material || 'HAKİKİ DANA DERİSİ'}</span>
              </div>
            ` : ''}

            ${data.size ? `
              <div class="meta-box" style="background: #f0f0f0;">
                <span class="meta-label">BEDEN / NUMARA:</span>
                <span class="meta-val" style="font-size: ${isSmallLabel ? '10pt' : '14pt'};">NO: ${data.size}</span>
              </div>
            ` : ''}

            ${config.showPrice && data.price ? `
              <div class="meta-box">
                <span class="meta-label">TAVSİYE EDİLEN FİYAT:</span>
                <span class="meta-val">₺${data.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${config.priceCurrency || 'TL'}</span>
              </div>
            ` : ''}
          </div>

          <!-- 4. Assortment Matrix (For Carton & Box) -->
          ${config.showAssortmentTable && assortmentEntries.length > 0 ? `
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 6.5pt; font-weight: 900; margin-bottom: 0.5mm;">
                <span>ASORTİ / BEDEN DAĞILIMI</span>
                <span>TOPLAM: ${data.totalPairs || assortmentEntries.reduce((a, b) => a + b[1], 0)} ÇİFT</span>
              </div>
              <table class="assortment-table">
                <thead>
                  <tr>
                    ${assortmentEntries.map(([s]) => `<th>${s}</th>`).join('')}
                    <th style="background: #333;">TOP</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    ${assortmentEntries.map(([, qty]) => `<td>${qty}</td>`).join('')}
                    <td style="background: #f0f0f0;">${data.totalPairs || assortmentEntries.reduce((a, b) => a + b[1], 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- 5. Order & Logistics Header -->
          ${(config.showOrderInfo || config.showWeightDesi || config.showLogisticsIcons) ? `
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 1mm 0; margin: 1mm 0; font-size: 7.5pt;">
              <div>
                ${config.showOrderInfo ? `<div><strong>SİPARİŞ / MÜŞTERİ:</strong> ${data.orderNumber || 'SIP-2026-0042'} - ${data.customerName || 'METRO AYAKKABI'}</div>` : ''}
                ${config.showWeightDesi ? `<div><strong>AĞIRLIK:</strong> ${data.weightKg || '14.5'} KG | <strong>DESİ:</strong> ${data.desi || '18'} DM³</div>` : ''}
              </div>
              ${config.showLogisticsIcons ? `
                <div class="logistics-icons">
                  <span class="piktogram" title="Kırılabilir">🍷</span>
                  <span class="piktogram" title="Kuru Tutunuz">☔</span>
                  <span class="piktogram" title="Bu Yön Yukarı">⬆️⬆️</span>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <!-- 6. Main Barcode Section -->
          ${config.showBarcode ? `
            <div class="barcode-section">
              ${barcodeSvg}
              ${config.showBarcodeText ? `<div class="barcode-text">_${barcodeVal}_</div>` : ''}
            </div>
          ` : ''}

          <!-- 7. Footer Note -->
          ${config.showCustomNote ? `
            <div class="footer-note">
              ${config.customNoteText || data.customNote || 'PROERP STANDARD THERMAL BARCODE SYSTEM'}
            </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;
  },

  async printDirect(template: BarcodeTemplate, data: SampleLabelData): Promise<void> {
    const html = barcodeTemplateService.generateLabelHtml(template, data);
    const { widthMm, heightMm } = template;
    const isLandscape = template.orientation === 'landscape';
    const effectiveW = isLandscape ? Math.max(widthMm, heightMm) : Math.min(widthMm, heightMm);
    const effectiveH = isLandscape ? Math.min(widthMm, heightMm) : Math.max(widthMm, heightMm);

    await printHtml(html, {
      title: `${template.name}_${data.barcode || 'label'}`,
      widthMm: effectiveW,
      heightMm: effectiveH
    });
  }
};
