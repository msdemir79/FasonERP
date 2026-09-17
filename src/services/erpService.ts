import { db } from '../db';
import { accountingService } from './accountingService';
import type { 
  Contact,
  EntityType,
  Transaction, 
  WorkOrder, 
  InventoryLog, 
  Product, 
  Recipe, 
  AppSettings, 
  BarcodeVariant, 
  Order, 
  OrderItem, 
  OrderStatus,
  InvoicingStatus,
  ProductionStage,
  WorkOrderStageLog,
  MrpCalculationResult,
  MrpRequirementItem,
  MaterialReadinessStatus,
  Invoice,
  InvoiceItem,
  InvoiceType,
  InvoiceStatus,
  InvoiceScenario,
  Waybill,
  WaybillItem,
  WaybillType,
  WaybillStatus,
  WaybillScenario
} from '../types';

export const PRODUCTION_STAGES_CONFIG: {
  id: ProductionStage;
  label: string;
  shortLabel: string;
  description: string;
  order: number;
  color: string;
}[] = [
  { id: 'planning', label: '1. Planlama & Reçete', shortLabel: 'Planlama', description: 'Reçete ve hammadde tahsisi', order: 1, color: 'text-sky-600 bg-sky-50 border-sky-200' },
  { id: 'cutting', label: '2. Kesim (Saya & Taban)', shortLabel: 'Kesim', description: 'Deri, astar ve taban kesimi', order: 2, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'printing', label: '3. Baskı, Nakış & Lazer', shortLabel: 'Baskı/Nakış', description: 'Logo, desen ve lazer işlemleri', order: 3, color: 'text-violet-600 bg-violet-50 border-violet-200' },
  { id: 'sewing', label: '4. Saya Dikim & Çatım', shortLabel: 'Dikim/Saya', description: 'Saya parçalarının montajı ve dikimi', order: 4, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { id: 'assembly', label: '5. Montaj & Kalıplama', shortLabel: 'Montaj/Kalıp', description: 'Kalıba çekme ve tabanlama montajı', order: 5, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { id: 'finishing', label: '6. Finisaj & Temizlik', shortLabel: 'Finisaj', description: 'Boya, parlatma, temizlik ve rötuş', order: 6, color: 'text-teal-600 bg-teal-50 border-teal-200' },
  { id: 'quality_packing', label: '7. Kalite Kontrol & Paketleme', shortLabel: 'Kalite/Paket', description: 'Son kontrol, kutulama ve kolileme', order: 7, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'completed', label: '8. Üretim Tamamlandı (Depo)', shortLabel: 'Tamamlandı', description: 'Mamul depoya giriş yapıldı', order: 8, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
];

/**
 * Quantities in shoe manufacturing (meters, pairs, dm2, kg) should be clean and rounded up/properly formatted.
 * E.g., removes floating point artifacts like 0.3999999999999986 and cleanly rounds up to 0.40.
 */
export function roundUpQuantity(val: number, decimals: number = 2): number {
  if (val === undefined || val === null || isNaN(val)) return 0;
  if (val === 0) return 0;
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  // Protect micro-measurements (< 0.01) if any
  const effDecimals = (absVal > 0 && absVal < 0.01) ? 4 : decimals;
  // Clean IEEE 754 precision float noise (e.g. 0.3999999999999986 -> 0.40)
  const clean = Math.round(absVal * 1000000) / 1000000;
  const factor = Math.pow(10, effDecimals);
  const rounded = Math.ceil(clean * factor) / factor;
  return isNegative ? -rounded : rounded;
}

export function formatQuantity(val: number): string {
  if (val === undefined || val === null || isNaN(val)) return '0';
  if (val === 0) return '0';
  const isNegative = val < 0;
  const rounded = roundUpQuantity(Math.abs(val), 2);
  
  let formatted: string;
  if (Number.isInteger(rounded)) {
    formatted = rounded.toLocaleString('tr-TR');
  } else {
    formatted = rounded.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Calculates the next sequential contact code based on existing contacts and type.
 * Müşteri (customer): CAR-001, CAR-002, CAR-003, ... (remembers highest number, e.g. CAR-004 -> CAR-005)
 * Tedarikçi (supplier): TED-001, TED-002, TED-003, ...
 */
export function getNextContactCode(
  contacts: { code?: string }[],
  type: EntityType = 'customer'
): { nextCode: string; maxNumber: number; lastCode?: string; prefix: string } {
  const prefix = type === 'supplier' ? 'TED-' : 'CAR-';
  const regex = new RegExp(`^${prefix}0*(\\d+)$`, 'i');
  const altRegex = type === 'supplier' 
    ? /^TED[-_]?0*(\d+)$/i 
    : /^(?:CAR|MUS)[-_]?0*(\d+)$/i;

  let maxNum = 0;
  let lastCode: string | undefined = undefined;

  for (const c of contacts) {
    if (!c.code) continue;
    const trimmed = c.code.trim();
    const match = trimmed.match(regex) || trimmed.match(altRegex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
        lastCode = trimmed;
      }
    }
  }

  const nextSeq = (maxNum + 1).toString().padStart(3, '0');
  return {
    nextCode: `${prefix}${nextSeq}`,
    maxNumber: maxNum,
    lastCode,
    prefix
  };
}

export const erpService = {
  // --- Accounting & Contacts ---
  async addContact(contact: Omit<Contact, 'id'>) {
    return await db.transaction('rw', [db.contacts, db.transactions, db.accounts], async () => {
      let code = contact.code?.trim();
      if (!code) {
        const allContacts = await db.contacts.toArray();
        code = getNextContactCode(allContacts, contact.type).nextCode;
      }

      const initialBalance = Number(contact.balance) || 0;
      const contactId = await db.contacts.add({
        ...contact,
        code,
        balance: initialBalance,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      if (initialBalance !== 0) {
        await db.transactions.add({
          contactId,
          type: initialBalance > 0 ? 'income' : 'expense',
          amount: Math.abs(initialBalance),
          description: 'Açılış / Devir Bakiyesi',
          category: 'Açılış Bakiyesi',
          date: new Date(),
          documentNo: 'DVR-' + contactId
        });
      }

      // Otomatik TDHP Muhasebe Hesabı Açılışı:
      if (contact.accountCode?.trim()) {
        try {
          const typeName = contact.type === 'customer' ? 'Müşteri' : contact.type === 'supplier' ? 'Tedarikçi' : 'Cari';
          await accountingService.registerAccountFromCode({
            code: contact.accountCode.trim(),
            name: contact.name.trim(),
            type: contact.type === 'supplier' ? 'liability' : 'asset',
            currency: contact.currency || 'TRY',
            sourceModule: 'contact',
            description: `${contact.name.trim()} (${typeName} Cari Hesabı)`
          });
        } catch (err) {
          console.error('Cari muhasebe hesabı otomatik oluşturulamadı:', err);
        }
      }

      return contactId;
    });
  },

  async updateContact(id: number, contact: Partial<Contact>) {
    const res = await db.contacts.update(id, {
      ...contact,
      updatedAt: new Date()
    });

    const fullContact = await db.contacts.get(id);
    if (fullContact && fullContact.accountCode?.trim()) {
      try {
        const typeName = fullContact.type === 'customer' ? 'Müşteri' : fullContact.type === 'supplier' ? 'Tedarikçi' : 'Cari';
        await accountingService.registerAccountFromCode({
          code: fullContact.accountCode.trim(),
          name: fullContact.name.trim(),
          type: fullContact.type === 'supplier' ? 'liability' : 'asset',
          currency: fullContact.currency || 'TRY',
          sourceModule: 'contact',
          description: `${fullContact.name.trim()} (${typeName} Cari Hesabı)`
        });
      } catch (err) {
        console.error('Cari güncelleme muhasebe senkronizasyon hatası:', err);
      }
    }
    return res;
  },

  async deleteContact(id: number) {
    return await db.transaction('rw', [db.contacts, db.transactions, db.orders, db.orderItems], async () => {
      const orderCount = await db.orders.where('contactId').equals(id).count();
      if (orderCount > 0) {
        throw new Error(`Bu cariye ait ${orderCount} adet sipariş/fatura kaydı bulunmaktadır. Önce siparişleri silmeli veya arşivlemelisiniz.`);
      }
      await db.transactions.where('contactId').equals(id).delete();
      return await db.contacts.delete(id);
    });
  },

  async recordContactTransaction(data: {
    contactId: number;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    category?: string;
    paymentMethod?: 'cash' | 'bank_transfer' | 'credit_card' | 'check' | 'other';
    documentNo?: string;
    date?: Date;
  }) {
    return await db.transaction('rw', [db.transactions, db.contacts], async () => {
      const contact = await db.contacts.get(data.contactId);
      if (!contact) throw new Error('Cari bulunamadı');

      const txDate = data.date || new Date();
      const transactionId = await db.transactions.add({
        contactId: data.contactId,
        type: data.type,
        amount: data.amount,
        description: data.description,
        category: data.category || (data.type === 'income' ? 'Tahsilat' : 'Ödeme'),
        paymentMethod: data.paymentMethod || 'cash',
        documentNo: data.documentNo,
        date: txDate
      });

      // Update contact balance:
      // For a customer: income (collection) decreases balance (or settles debt), expense increases it
      // For general balance tracking:
      // Balance > 0 means our receivable (Customer owes us)
      // If income (tahsilat aldık) -> balance decreases
      // If expense (tedarikçiye ödeme yaptık) -> balance increases towards 0 (reduces payable)
      let newBalance = contact.balance;
      if (contact.type === 'customer') {
        newBalance = data.type === 'income' ? contact.balance - data.amount : contact.balance + data.amount;
      } else if (contact.type === 'supplier') {
        newBalance = data.type === 'expense' ? contact.balance + data.amount : contact.balance - data.amount;
      } else {
        newBalance = data.type === 'income' ? contact.balance - data.amount : contact.balance + data.amount;
      }

      await db.contacts.update(data.contactId, {
        balance: newBalance,
        updatedAt: new Date()
      });

      return transactionId;
    });
  },

  async addTransaction(transaction: Transaction) {
    return await db.transaction('rw', [db.transactions, db.contacts], async () => {
      const id = await db.transactions.add({
        ...transaction,
        amount: Number(transaction.amount) || 0,
        date: transaction.date ? new Date(transaction.date) : new Date()
      });
      
      if (transaction.contactId) {
        const contact = await db.contacts.get(transaction.contactId);
        if (contact) {
          let newBalance = contact.balance;
          const numAmount = Number(transaction.amount) || 0;
          if (contact.type === 'customer') {
            newBalance = transaction.type === 'income' ? contact.balance - numAmount : contact.balance + numAmount;
          } else if (contact.type === 'supplier') {
            newBalance = transaction.type === 'expense' ? contact.balance + numAmount : contact.balance - numAmount;
          } else {
            newBalance = transaction.type === 'income' ? contact.balance - numAmount : contact.balance + numAmount;
          }
          
          await db.contacts.update(transaction.contactId, { balance: newBalance, updatedAt: new Date() });
        }
      }
      return id;
    });
  },

  async updateTransaction(id: number, data: Partial<Transaction>) {
    return await db.transaction('rw', [db.transactions, db.contacts], async () => {
      const oldTx = await db.transactions.get(id);
      if (!oldTx) throw new Error('Güncellenecek finansal hareket bulunamadı');

      const targetContactId = data.contactId !== undefined ? data.contactId : oldTx.contactId;
      const targetType = data.type !== undefined ? data.type : oldTx.type;
      const targetAmount = data.amount !== undefined ? Number(data.amount) : oldTx.amount;

      // 1. If old transaction was attached to a contact, revert its previous impact
      if (oldTx.contactId) {
        const oldContact = await db.contacts.get(oldTx.contactId);
        if (oldContact) {
          let revertedBalance = oldContact.balance;
          if (oldContact.type === 'customer') {
            revertedBalance = oldTx.type === 'income' 
              ? oldContact.balance + oldTx.amount 
              : oldContact.balance - oldTx.amount;
          } else if (oldContact.type === 'supplier') {
            revertedBalance = oldTx.type === 'expense' 
              ? oldContact.balance - oldTx.amount 
              : oldContact.balance + oldTx.amount;
          } else {
            revertedBalance = oldTx.type === 'income' 
              ? oldContact.balance + oldTx.amount 
              : oldContact.balance - oldTx.amount;
          }
          await db.contacts.update(oldTx.contactId, { balance: revertedBalance, updatedAt: new Date() });
        }
      }

      // 2. If new/target transaction has a contact, apply the new impact
      if (targetContactId) {
        const targetContact = await db.contacts.get(targetContactId);
        if (targetContact) {
          let appliedBalance = targetContact.balance;
          if (targetContact.type === 'customer') {
            appliedBalance = targetType === 'income' 
              ? targetContact.balance - targetAmount 
              : targetContact.balance + targetAmount;
          } else if (targetContact.type === 'supplier') {
            appliedBalance = targetType === 'expense' 
              ? targetContact.balance + targetAmount 
              : targetContact.balance - targetAmount;
          } else {
            appliedBalance = targetType === 'income' 
              ? targetContact.balance - targetAmount 
              : targetContact.balance + targetAmount;
          }
          await db.contacts.update(targetContactId, { balance: appliedBalance, updatedAt: new Date() });
        }
      }

      // 3. Update the transaction in DB
      await db.transactions.update(id, {
        ...data,
        amount: targetAmount,
        type: targetType,
        contactId: targetContactId,
        date: data.date ? new Date(data.date) : oldTx.date
      });

      return id;
    });
  },

  async deleteTransaction(id: number) {
    return await db.transaction('rw', [db.transactions, db.contacts], async () => {
      const oldTx = await db.transactions.get(id);
      if (!oldTx) throw new Error('Silinecek finansal hareket bulunamadı');

      if (oldTx.contactId) {
        const contact = await db.contacts.get(oldTx.contactId);
        if (contact) {
          let revertedBalance = contact.balance;
          if (contact.type === 'customer') {
            revertedBalance = oldTx.type === 'income' 
              ? contact.balance + oldTx.amount 
              : contact.balance - oldTx.amount;
          } else if (contact.type === 'supplier') {
            revertedBalance = oldTx.type === 'expense' 
              ? contact.balance - oldTx.amount 
              : contact.balance + oldTx.amount;
          } else {
            revertedBalance = oldTx.type === 'income' 
              ? contact.balance + oldTx.amount 
              : contact.balance - oldTx.amount;
          }
          await db.contacts.update(oldTx.contactId, { balance: revertedBalance, updatedAt: new Date() });
        }
      }

      await db.transactions.delete(id);
      return true;
    });
  },

  async recalculateContactBalance(contactId: number) {
    return await db.transaction('rw', [db.contacts, db.invoices, db.transactions], async () => {
      const contact = await db.contacts.get(contactId);
      if (!contact) return 0;

      const invoices = await db.invoices.where('contactId').equals(contactId).toArray();
      const transactions = await db.transactions.where('contactId').equals(contactId).toArray();

      let debit = 0;
      let credit = 0;

      // Invoices (only issued / non-cancelled)
      for (const inv of invoices) {
        if (inv.status === 'cancelled' || inv.status === 'draft') continue;
        if (inv.type === 'sales') {
          debit += inv.grandTotal;
        } else {
          credit += inv.grandTotal;
        }
      }

      // Transactions (Tahsilat / Ödeme / Açılış)
      for (const tx of transactions) {
        const isIncome = tx.type === 'income';
        const isOpening = tx.category === 'Açılış Bakiyesi' || tx.description.includes('Açılış');
        if (isOpening) {
          if (tx.amount > 0 && isIncome) debit += tx.amount;
          else credit += tx.amount;
        } else if (isIncome) {
          credit += tx.amount;
        } else {
          debit += tx.amount;
        }
      }

      const calculatedBalance = debit - credit;
      await db.contacts.update(contactId, {
        balance: calculatedBalance,
        updatedAt: new Date()
      });

      return calculatedBalance;
    });
  },

  // --- Production & Work Orders ---
  computeAssortmentDistribution(
    product: any,
    quantity: number,
    specificSize?: string,
    templateItems?: { size: string; quantity: number }[]
  ): { size: string; quantity: number }[] {
    if (specificSize && specificSize.trim() !== '') {
      return [{ size: specificSize.trim(), quantity }];
    }

    // 1. Direct product assortment
    if (product?.assortment && product.assortment.length > 0) {
      const totalAssort = product.assortment.reduce((s: number, a: any) => s + (Number(a.quantity) || 0), 0);
      if (totalAssort > 0) {
        const ratio = quantity / totalAssort;
        let sum = 0;
        const items = product.assortment.map((a: any) => {
          const q = Math.round((Number(a.quantity) || 0) * ratio);
          sum += q;
          return { size: String(a.size), quantity: q };
        });
        const diff = quantity - sum;
        if (diff !== 0 && items.length > 0) {
          items[items.length - 1].quantity += diff;
        }
        return items;
      }
    }

    // 2. Assortment template items
    if (templateItems && templateItems.length > 0) {
      const totalAssort = templateItems.reduce((s: number, a: any) => s + (Number(a.quantity) || 0), 0);
      if (totalAssort > 0) {
        const ratio = quantity / totalAssort;
        let sum = 0;
        const items = templateItems.map((a: any) => {
          const q = Math.round((Number(a.quantity) || 0) * ratio);
          sum += q;
          return { size: String(a.size), quantity: q };
        });
        const diff = quantity - sum;
        if (diff !== 0 && items.length > 0) {
          items[items.length - 1].quantity += diff;
        }
        return items;
      }
    }

    // 3. Variant barcodes size set
    if (product?.variantBarcodes && product.variantBarcodes.length > 0) {
      const uniqueSizes: string[] = Array.from(new Set<string>(product.variantBarcodes.map((v: any) => String(v.size)).filter(Boolean)));
      if (uniqueSizes.length > 0) {
        uniqueSizes.sort((a: string, b: string) => {
          const na = parseFloat(a);
          const nb = parseFloat(b);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          return a.localeCompare(b);
        });

        const count = uniqueSizes.length;
        let weights: number[] = [];
        if (count === 5) weights = [1, 2, 2, 2, 1];
        else if (count === 6) weights = [1, 2, 2, 2, 2, 1];
        else if (count === 4) weights = [1, 2, 2, 1];
        else weights = new Array(count).fill(1);

        const totalWeight = weights.reduce((s, w) => s + w, 0);
        let allocated = 0;
        const items: { size: string; quantity: number }[] = uniqueSizes.map((size, idx) => {
          const q = Math.round(quantity * (weights[idx] / totalWeight));
          allocated += q;
          return { size, quantity: q };
        });
        const diff = quantity - allocated;
        if (diff !== 0 && items.length > 0) {
          items[Math.floor(items.length / 2)].quantity += diff;
        }
        return items;
      }
    }

    // 4. Default standard 40-44 classic shoe distribution (Standard ratio: 1/8, 2/8, 2/8, 2/8, 1/8)
    const defaultSizes = ['40', '41', '42', '43', '44'];
    const weights = [1, 2, 2, 2, 1];
    const totalWeight = 8;
    let allocated = 0;
    const items = defaultSizes.map((size, idx) => {
      const q = Math.round(quantity * (weights[idx] / totalWeight));
      allocated += q;
      return { size, quantity: q };
    });
    const diff = quantity - allocated;
    if (diff !== 0 && items.length > 2) {
      items[2].quantity += diff;
    }
    return items;
  },

  generateDefaultStages(): WorkOrderStageLog[] {
    return PRODUCTION_STAGES_CONFIG.map(st => ({
      stage: st.id,
      stageName: st.label,
      status: st.id === 'planning' ? 'in_progress' : 'pending',
      startedAt: st.id === 'planning' ? new Date() : undefined
    }));
  },

  async createWorkOrder(data: {
    productId: number;
    quantity: number;
    orderId?: number;
    orderItemId?: number;
    orderNumber?: string;
    customerName?: string;
    customerCode?: string;
    orderDate?: Date | string;
    documentNo?: string;
    moldCode?: string;
    moldGroup?: string;
    color?: string;
    size?: string;
    assortmentBreakdown?: { size: string; quantity: number }[];
    targetDate?: Date;
    notes?: string;
    operator?: string;
  }) {
    return await db.transaction('rw', [db.workOrders, db.recipes, db.products, db.assortmentTemplates], async () => {
      const recipe = await db.recipes.where('productId').equals(data.productId).first();
      const prod = await db.products.get(data.productId);
      
      // Determine initial material status
      let materialStatus: MaterialReadinessStatus = 'no_recipe';
      if (recipe && recipe.ingredients.length > 0) {
        materialStatus = 'pending_mrp';
      }

      const defaultStages = this.generateDefaultStages();

      // Compute assortment breakdown if not passed
      let computedAssortment = data.assortmentBreakdown;
      if (!computedAssortment || computedAssortment.length === 0) {
        let templateItems: { size: string; quantity: number }[] | undefined = undefined;
        if (prod?.assortmentTemplateId) {
          const tmpl = await db.assortmentTemplates.get(prod.assortmentTemplateId);
          templateItems = tmpl?.items;
        }
        computedAssortment = this.computeAssortmentDistribution(prod, data.quantity, data.size, templateItems);
      }

      // Preliminary add to get ID
      const initialId = await db.workOrders.add({
        productId: data.productId,
        quantity: data.quantity,
        status: 'pending',
        currentStage: 'planning',
        stages: defaultStages,
        createdAt: new Date(),
        targetDate: data.targetDate,
        orderId: data.orderId,
        orderItemId: data.orderItemId,
        orderNumber: data.orderNumber,
        customerName: data.customerName,
        customerCode: data.customerCode,
        orderDate: data.orderDate || new Date(),
        documentNo: data.documentNo || prod?.documentNo,
        moldCode: data.moldCode || prod?.moldCode,
        moldGroup: data.moldGroup || prod?.moldGroup,
        color: data.color,
        size: data.size,
        assortmentBreakdown: computedAssortment,
        notes: data.notes,
        operator: data.operator,
        materialStatus,
        recipeId: recipe?.id,
        barcode: `WO-${Date.now().toString().slice(-6)}`
      });

      // Update with standardized barcode containing the work order ID
      const formattedBarcode = `WO-${initialId.toString().padStart(6, '0')}`;
      await db.workOrders.update(initialId, { barcode: formattedBarcode });

      return initialId;
    });
  },

  async createWorkOrdersFromOrder(orderId: number) {
    return await db.transaction('rw', [db.orders, db.orderItems, db.workOrders, db.products, db.contacts, db.recipes, db.assortmentTemplates], async () => {
      const order = await db.orders.get(orderId);
      if (!order) throw new Error('Sipariş bulunamadı');
      
      const contact = await db.contacts.get(order.contactId);
      const items = await db.orderItems.where('orderId').equals(orderId).toArray();
      const existingWOs = await db.workOrders.where('orderId').equals(orderId).toArray();
      
      const createdIds: number[] = [];

      for (const item of items) {
        const product = await db.products.get(item.productId);
        if (!product || product.isRawMaterial) continue; // Only produce finished/semi-finished goods

        // Check if an existing active work order exists for this item
        const alreadyExists = existingWOs.some(w => 
          w.productId === item.productId && 
          w.orderItemId === item.id &&
          w.status !== 'cancelled'
        );
        if (alreadyExists) continue;

        const recipe = await db.recipes.where('productId').equals(item.productId).first();
        const materialStatus: MaterialReadinessStatus = recipe ? 'pending_mrp' : 'no_recipe';

        const defaultStages = this.generateDefaultStages();

        // Calculate size distribution
        let templateItems: { size: string; quantity: number }[] | undefined = undefined;
        if (product.assortmentTemplateId) {
          const tmpl = await db.assortmentTemplates.get(product.assortmentTemplateId);
          templateItems = tmpl?.items;
        }
        const assortmentBreakdown = this.computeAssortmentDistribution(product, item.quantity, item.size, templateItems);

        const woId = await db.workOrders.add({
          productId: item.productId,
          quantity: item.quantity,
          status: 'pending',
          currentStage: 'planning',
          stages: defaultStages,
          createdAt: new Date(),
          targetDate: order.deliveryDate,
          orderId: order.id,
          orderItemId: item.id,
          orderNumber: order.orderNumber,
          customerName: contact?.name,
          customerCode: contact?.code,
          orderDate: order.date,
          documentNo: product.documentNo,
          moldCode: product.moldCode,
          moldGroup: product.moldGroup,
          color: item.color,
          size: item.size,
          assortmentBreakdown,
          notes: `Sipariş: ${order.orderNumber} - ${item.color || ''} ${item.size ? 'Beden: ' + item.size : ''}`,
          materialStatus,
          recipeId: recipe?.id,
          barcode: `WO-${Date.now().toString().slice(-6)}`
        });

        const formattedBarcode = `WO-${woId.toString().padStart(6, '0')}`;
        await db.workOrders.update(woId, { barcode: formattedBarcode });
        createdIds.push(woId);
      }

      return createdIds;
    });
  },

  async startWorkOrder(id: number, operator?: string) {
    const order = await db.workOrders.get(id);
    if (!order) throw new Error('İş emri bulunamadı');

    const updatedStages = (order.stages || this.generateDefaultStages()).map(st => {
      if (st.stage === 'cutting') {
        return { ...st, status: 'in_progress' as const, startedAt: new Date(), operator: operator || st.operator };
      }
      if (st.stage === 'planning') {
        return { ...st, status: 'completed' as const, completedAt: new Date() };
      }
      return st;
    });

    return await db.workOrders.update(id, { 
      status: 'in_progress',
      currentStage: 'cutting',
      stages: updatedStages,
      operator: operator || order.operator
    });
  },

  async advanceWorkOrderStage(
    id: number, 
    targetStage?: ProductionStage, 
    options?: { operator?: string; scrapQuantity?: number; notes?: string }
  ) {
    return await db.transaction('rw', [db.workOrders, db.products, db.inventoryLogs, db.recipes], async () => {
      const order = await db.workOrders.get(id);
      if (!order) throw new Error('İş emri bulunamadı');
      if (order.status === 'completed') throw new Error('Bu iş emri zaten tamamlandı!');

      const stageOrderList: ProductionStage[] = [
        'planning',
        'cutting',
        'printing',
        'sewing',
        'assembly',
        'finishing',
        'quality_packing',
        'completed'
      ];

      const currentIdx = stageOrderList.indexOf(order.currentStage);
      let nextStage: ProductionStage;

      if (targetStage) {
        nextStage = targetStage;
      } else {
        const nextIdx = Math.min(stageOrderList.length - 1, currentIdx + 1);
        nextStage = stageOrderList[nextIdx];
      }

      const now = new Date();
      let stages = order.stages && order.stages.length > 0 ? [...order.stages] : this.generateDefaultStages();

      // Mark current stage completed
      stages = stages.map(s => {
        if (s.stage === order.currentStage) {
          return {
            ...s,
            status: 'completed' as const,
            completedAt: now,
            operator: options?.operator || s.operator || order.operator,
            scrapQuantity: options?.scrapQuantity !== undefined ? options.scrapQuantity : s.scrapQuantity,
            notes: options?.notes || s.notes
          };
        }
        if (s.stage === nextStage) {
          const newStatus: 'completed' | 'in_progress' = nextStage === 'completed' ? 'completed' : 'in_progress';
          return {
            ...s,
            status: newStatus,
            startedAt: s.startedAt || now,
            completedAt: nextStage === 'completed' ? now : undefined,
            operator: options?.operator || s.operator || order.operator
          };
        }
        return s;
      });

      // If moving past planning for the first time, consume materials if not already consumed
      if (order.currentStage === 'planning' && nextStage !== 'planning' && order.materialStatus !== 'materials_consumed') {
        const allProductRecipes = await db.recipes.where('productId').equals(order.productId).toArray();
        const recipe = allProductRecipes.find(r => order.color && r.targetColor === order.color) ||
                       allProductRecipes.find(r => !r.targetColor || r.targetColor === 'all' || r.targetColor === 'Genel') ||
                       allProductRecipes[0];

        if (recipe && recipe.ingredients.length > 0) {
          const finishedProduct = await db.products.get(order.productId);
          let assortment = finishedProduct?.assortment;
          if ((!assortment || assortment.length === 0) && finishedProduct?.assortmentTemplateId) {
            const tmpl = await db.assortmentTemplates.get(finishedProduct.assortmentTemplateId);
            if (tmpl) assortment = tmpl.items;
          }

          for (const ing of recipe.ingredients) {
            const raw = await db.products.get(ing.productId);
            if (!raw) continue;

            const totalNeeded = ing.quantity * order.quantity;
            let logDetail = '';

            const isMatrixItem = ing.isMatrixMatched || 
                                 raw.categoryType === 'semi_finished' || 
                                 raw.isFootwear || 
                                 (raw.variantBarcodes && raw.variantBarcodes.length > 0 && raw.variantBarcodes.some(v => v.size && v.size !== 'Standart'));

            if (isMatrixItem && raw.variantBarcodes && raw.variantBarcodes.length > 0) {
              let variants = [...raw.variantBarcodes];
              const targetIngColor = ing.color || order.color || (raw.colors && raw.colors.length > 0 ? raw.colors[0] : (variants[0]?.color || 'Genel'));

              if (order.size && order.size.trim() !== '' && !['Asorti', 'Tüm Bedenler', 'Standart'].includes(order.size.trim())) {
                const targetSize = order.size.trim();
                const neededForSize = ing.quantity * order.quantity;
                let targetVar = variants.find(v => v.size === targetSize && (v.color === targetIngColor || !targetIngColor || v.color === 'Genel'));
                if (!targetVar) targetVar = variants.find(v => v.size === targetSize);
                if (targetVar) {
                  targetVar.stock = Math.max(0, (targetVar.stock || 0) - neededForSize);
                }
                logDetail = ` [${targetIngColor ? targetIngColor + ' ' : ''}Beden ${targetSize}: -${neededForSize} ${raw.unit || 'Çift'}]`;
              } else if (assortment && assortment.length > 0) {
                const totalRatio = assortment.reduce((sum, it) => sum + (it.quantity || 0), 0);
                if (totalRatio > 0) {
                  let allocated = 0;
                  const sizeLogParts: string[] = [];
                  assortment.forEach((it, idx) => {
                    const isLast = idx === assortment.length - 1;
                    const shoeSizeQty = isLast ? Math.max(0, order.quantity - allocated) : Math.round((order.quantity * (it.quantity || 1)) / totalRatio);
                    allocated += shoeSizeQty;
                    const componentSizeQty = shoeSizeQty * ing.quantity;

                    let matchVar = variants.find(v => v.size === it.size && (v.color === targetIngColor || !targetIngColor || v.color === 'Genel'));
                    if (!matchVar) matchVar = variants.find(v => v.size === it.size);
                    if (matchVar) {
                      matchVar.stock = Math.max(0, (matchVar.stock || 0) - componentSizeQty);
                    }
                    sizeLogParts.push(`${it.size}(-${componentSizeQty})`);
                  });
                  logDetail = ` [${targetIngColor ? targetIngColor + ' ' : ''}Asorti Matrisi: ${sizeLogParts.join(', ')}]`;
                }
              } else {
                const targetVariants = variants.filter(v => v.color === targetIngColor);
                const ev = targetVariants.length > 0 ? targetVariants : variants;
                const count = ev.length || 1;
                let allocated = 0;
                ev.forEach((v, idx) => {
                  const isLast = idx === count - 1;
                  const sizeQty = isLast ? Math.max(0, totalNeeded - allocated) : Math.round(totalNeeded / count);
                  allocated += sizeQty;
                  v.stock = Math.max(0, (v.stock || 0) - sizeQty);
                });
                logDetail = ` [${targetIngColor ? targetIngColor + ' ' : ''}-${totalNeeded} ${raw.unit || 'Çift'}]`;
              }

              const calculatedTotalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
              await db.products.update(ing.productId, {
                variantBarcodes: variants,
                stock: calculatedTotalStock
              });
            } else {
              const updatedStock = Math.max(0, roundUpQuantity(raw.stock - totalNeeded, 2));
              await db.products.update(ing.productId, { stock: updatedStock });
              logDetail = ` [${ing.color ? ing.color + ' ' : ''}-${totalNeeded} ${raw.unit || 'Adet'}]`;
            }

            await db.inventoryLogs.add({
              productId: ing.productId,
              type: 'production_out',
              quantity: totalNeeded,
              date: now,
              description: `#${order.barcode} Üretim başlangıcı için harcandı${logDetail}`
            });
          }
        }
      }

      // If next stage is COMPLETED, finish goods are added to stock
      if (nextStage === 'completed') {
        const product = await db.products.get(order.productId);
        if (product) {
          const isFootwearOrVariants = product.isFootwear || (product.variantBarcodes && product.variantBarcodes.length > 0);
          let logDetail = '';

          if (isFootwearOrVariants) {
            let variants = product.variantBarcodes ? [...product.variantBarcodes] : [];
            const effectiveColor = order.color || (product.colors && product.colors.length > 0 ? product.colors[0] : (variants[0]?.color || 'Genel'));

            let assortment = product.assortment;
            if ((!assortment || assortment.length === 0) && product.assortmentTemplateId) {
              const tmpl = await db.assortmentTemplates.get(product.assortmentTemplateId);
              if (tmpl) assortment = tmpl.items;
            }

            if (order.size && order.size.trim() !== '' && !['Asorti', 'Tüm Bedenler', 'Standart'].includes(order.size.trim())) {
              const targetSize = order.size.trim();
              let targetVar = variants.find(v => v.size === targetSize && v.color === effectiveColor);
              if (!targetVar) targetVar = variants.find(v => v.size === targetSize);
              if (targetVar) {
                targetVar.stock = (targetVar.stock || 0) + order.quantity;
              } else {
                variants.push({ size: targetSize, color: effectiveColor, barcode: '', stock: order.quantity });
              }
              logDetail = ` [${effectiveColor ? effectiveColor + ' ' : ''}Beden ${targetSize}: +${order.quantity}]`;
            } else if (assortment && assortment.length > 0) {
              const totalRatio = assortment.reduce((sum, it) => sum + (it.quantity || 0), 0);
              if (totalRatio > 0) {
                let allocated = 0;
                assortment.forEach((it, idx) => {
                  const isLast = idx === assortment.length - 1;
                  const sizeQty = isLast ? Math.max(0, order.quantity - allocated) : Math.round((order.quantity * (it.quantity || 1)) / totalRatio);
                  allocated += sizeQty;
                  let matchVar = variants.find(v => v.size === it.size && v.color === effectiveColor);
                  if (matchVar) {
                    matchVar.stock = (matchVar.stock || 0) + sizeQty;
                  } else {
                    variants.push({ size: it.size, color: effectiveColor, barcode: '', stock: sizeQty });
                  }
                });
                logDetail = ` [${effectiveColor ? effectiveColor + ' ' : ''}Asortili Giriş: +${order.quantity} ${product.unit || 'Çift'}]`;
              }
            } else {
              const targetVariants = variants.filter(v => v.color === effectiveColor);
              const ev = targetVariants.length > 0 ? targetVariants : variants;
              const count = ev.length || 1;
              let allocated = 0;
              ev.forEach((v, idx) => {
                const isLast = idx === count - 1;
                const sizeQty = isLast ? Math.max(0, order.quantity - allocated) : Math.round(order.quantity / count);
                allocated += sizeQty;
                v.stock = (v.stock || 0) + sizeQty;
              });
            }

            const calculatedTotalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
            await db.products.update(order.productId, {
              variantBarcodes: variants,
              stock: calculatedTotalStock
            });
          } else {
            await db.products.update(order.productId, {
              stock: product.stock + order.quantity
            });
          }

          await db.inventoryLogs.add({
            productId: order.productId,
            type: 'production_in',
            quantity: order.quantity,
            date: now,
            description: `#${order.barcode} Üretimi tamamlandı ve depoya alındı${logDetail}`
          });
        }

        await db.workOrders.update(id, {
          status: 'completed',
          currentStage: 'completed',
          completedAt: now,
          stages,
          materialStatus: 'materials_consumed'
        });
      } else {
        await db.workOrders.update(id, {
          status: 'in_progress',
          currentStage: nextStage,
          stages,
          operator: options?.operator || order.operator
        });
      }

      return { nextStage, order };
    });
  },

  async scanWorkOrderBarcode(scannedCode: string, operatorName?: string) {
    const cleanCode = scannedCode.trim().toUpperCase();
    if (!cleanCode) throw new Error('Lütfen geçerli bir barkod okutun.');

    // Look for matching work order by barcode or ID
    let workOrder = await db.workOrders.where('barcode').equals(cleanCode).first();
    
    // Check if it's formatted like WO-123 or just numeric
    if (!workOrder) {
      if (cleanCode.startsWith('WO-')) {
        const numPart = parseInt(cleanCode.replace('WO-', ''), 10);
        if (!isNaN(numPart)) {
          workOrder = await db.workOrders.get(numPart);
        }
      } else if (!isNaN(Number(cleanCode))) {
        workOrder = await db.workOrders.get(Number(cleanCode));
      }
    }

    if (!workOrder) {
      throw new Error(`[${cleanCode}] barkoduna ait iş emri bulunamadı.`);
    }

    if (workOrder.status === 'completed') {
      return {
        success: false,
        isCompleted: true,
        workOrder,
        message: `#${workOrder.barcode} nolu iş emri zaten tamamlanmıştır.`
      };
    }

    const previousStage = workOrder.currentStage;
    const result = await this.advanceWorkOrderStage(workOrder.id!, undefined, {
      operator: operatorName || 'Barkod Operatörü'
    });

    const product = await db.products.get(workOrder.productId);

    return {
      success: true,
      workOrder: result.order,
      product,
      previousStage,
      newStage: result.nextStage,
      message: `#${workOrder.barcode} (${product?.name || 'Ürün'}) başarıyla [${previousStage}] aşamasından [${result.nextStage}] aşamasına geçirildi.`
    };
  },

  // --- Material Requirements Planning (MRP) ---
  async calculateMRP(targetWorkOrderIds?: number[]): Promise<MrpCalculationResult> {
    let workOrdersToAnalyze: WorkOrder[] = [];

    if (targetWorkOrderIds && targetWorkOrderIds.length > 0) {
      const fetched = await db.workOrders.bulkGet(targetWorkOrderIds);
      workOrdersToAnalyze = fetched.filter((w): w is WorkOrder => Boolean(w) && w.status !== 'completed' && w.status !== 'cancelled');
    } else {
      // Analyze all active / pending work orders
      workOrdersToAnalyze = await db.workOrders
        .filter(w => w.status === 'pending' || w.status === 'in_progress')
        .toArray();
    }

    const products = await db.products.toArray();
    const recipes = await db.recipes.toArray();
    const contacts = await db.contacts.toArray();
    const assortmentTemplates = await db.assortmentTemplates.toArray();
    const allOrders = await db.orders.toArray();
    const allOrderItems = await db.orderItems.toArray();

    const productMap = new Map(products.map(p => [p.id!, p]));
    const templateMap = new Map(assortmentTemplates.map(t => [t.id!, t]));
    const supplierMap = new Map(contacts.filter(c => c.type === 'supplier' || c.type === 'both').map(c => [c.id!, c.name]));
    const orderMap = new Map(allOrders.map(o => [o.id!, o]));

    // Identify active / open Purchase Orders (not cancelled)
    const activePurchaseOrders = allOrders.filter(o => o.type === 'purchase' && o.status !== 'cancelled');
    const activePOIds = new Set(activePurchaseOrders.map(o => o.id!));
    const activePurchaseOrderItems = allOrderItems.filter(i => activePOIds.has(i.orderId));

    // Helper to find best recipe for a work order
    const getRecipeForWO = (productId: number, color?: string) => {
      const allProductRecipes = recipes.filter(r => r.productId === productId);
      if (allProductRecipes.length === 0) return null;
      if (color) {
        const exactMatch = allProductRecipes.find(r => r.targetColor && r.targetColor.toLowerCase() === color.toLowerCase());
        if (exactMatch) return exactMatch;
      }
      const genericMatch = allProductRecipes.find(r => !r.targetColor || r.targetColor === 'all' || r.targetColor === 'Genel');
      if (genericMatch) return genericMatch;
      return allProductRecipes[0];
    };

    // Aggregate requirements per (rawMaterialId + color)
    const rawMaterialNeeds = new Map<string, {
      rawMaterialId: number;
      color?: string;
      isMatrixMatched?: boolean;
      requiredQuantity: number;
      sizeNeedsMap: Map<string, number>;
      affectedWorkOrderIds: number[];
    }>();

    for (const wo of workOrdersToAnalyze) {
      const recipe = getRecipeForWO(wo.productId, wo.color);
      if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) continue;

      // Resolve size breakdown of this work order
      let woSizes: { size: string; quantity: number }[] = [];
      if (wo.assortmentBreakdown && wo.assortmentBreakdown.length > 0) {
        woSizes = wo.assortmentBreakdown;
      } else if (wo.size && wo.size.trim() !== '') {
        woSizes = [{ size: wo.size.trim(), quantity: wo.quantity }];
      } else {
        const finishedProduct = productMap.get(wo.productId);
        if (finishedProduct?.assortment && finishedProduct.assortment.length > 0) {
          const totalAssort = finishedProduct.assortment.reduce((s, a) => s + (a.quantity || 0), 0);
          const ratio = totalAssort > 0 ? (wo.quantity / totalAssort) : 1;
          woSizes = finishedProduct.assortment.map(a => ({
            size: a.size,
            quantity: Math.round(a.quantity * ratio)
          }));
        } else if (finishedProduct?.assortmentTemplateId) {
          const tmpl = templateMap.get(finishedProduct.assortmentTemplateId);
          if (tmpl && tmpl.items.length > 0) {
            const totalAssort = tmpl.items.reduce((s, a) => s + (a.quantity || 0), 0);
            const ratio = totalAssort > 0 ? (wo.quantity / totalAssort) : 1;
            woSizes = tmpl.items.map(a => ({
              size: a.size,
              quantity: Math.round(a.quantity * ratio)
            }));
          }
        }
      }

      for (const ing of recipe.ingredients) {
        const rawProduct = productMap.get(ing.productId);
        if (!rawProduct) continue;

        const isSizeMatrix = Boolean(
          ing.isMatrixMatched ||
          rawProduct.hasSizeVariants ||
          rawProduct.isFootwear ||
          ['Taban', 'Mostra', 'Fuspet', 'Salpa', 'Saya', 'Kalıp'].includes(rawProduct.subType || '')
        );

        const totalIngNeeded = ing.quantity * wo.quantity;
        const ingColor = ing.color || wo.color || '';
        const key = `${ing.productId}__${ingColor || 'ALL'}`;

        let existing = rawMaterialNeeds.get(key);
        if (!existing) {
          existing = {
            rawMaterialId: ing.productId,
            color: ingColor || undefined,
            isMatrixMatched: isSizeMatrix,
            requiredQuantity: 0,
            sizeNeedsMap: new Map<string, number>(),
            affectedWorkOrderIds: []
          };
          rawMaterialNeeds.set(key, existing);
        }

        existing.requiredQuantity += totalIngNeeded;
        if (!existing.affectedWorkOrderIds.includes(wo.id!)) {
          existing.affectedWorkOrderIds.push(wo.id!);
        }

        if (isSizeMatrix && woSizes.length > 0) {
          existing.isMatrixMatched = true;
          for (const s of woSizes) {
            const sizeKey = s.size.trim();
            const sizeQtyNeeded = s.quantity * ing.quantity;
            existing.sizeNeedsMap.set(sizeKey, (existing.sizeNeedsMap.get(sizeKey) || 0) + sizeQtyNeeded);
          }
        }
      }
    }

    const mrpItems: MrpRequirementItem[] = [];
    let shortageCount = 0;
    let totalShortageCost = 0;

    for (const [key, data] of rawMaterialNeeds.entries()) {
      const rawProduct = productMap.get(data.rawMaterialId);
      if (!rawProduct) continue;

      let currentStock = 0;
      let onOrderQuantity = 0;
      let grossShortageQuantity = 0;
      let shortageQuantity = 0;
      let sizeBreakdownList: { size: string; required: number; currentStock: number; onOrderQuantity?: number; shortage: number }[] | undefined = undefined;

      const hasMatrix = data.sizeNeedsMap.size > 0;

      // Filter matching active purchase order items for this rawMaterialId and color
      const matchingPOItems = activePurchaseOrderItems.filter(poi => {
        if (poi.productId !== data.rawMaterialId) return false;
        if (data.color && data.color.trim() !== '') {
          if (poi.color && poi.color.trim() !== '' && poi.color.trim().toLowerCase() !== data.color.trim().toLowerCase()) {
            return false;
          }
        }
        return true;
      });

      // Aggregate POs info for this item
      const activePOsForThisItem: {
        orderId: number;
        orderNumber: string;
        supplierName?: string;
        quantity: number;
        date: Date | string;
        status: OrderStatus;
      }[] = [];

      const poAggMap = new Map<number, number>();
      for (const poi of matchingPOItems) {
        const remaining = Math.max(0, (poi.quantity || 0) - (poi.shippedQuantity || 0));
        if (remaining > 0) {
          poAggMap.set(poi.orderId, (poAggMap.get(poi.orderId) || 0) + remaining);
        }
      }
      for (const [poId, qty] of poAggMap.entries()) {
        const po = orderMap.get(poId);
        if (po) {
          activePOsForThisItem.push({
            orderId: po.id!,
            orderNumber: po.orderNumber,
            supplierName: supplierMap.get(po.contactId) || 'Tedarikçi',
            quantity: qty,
            date: po.date,
            status: po.status
          });
        }
      }

      if (hasMatrix) {
        sizeBreakdownList = [];
        for (const [size, reqQtyForSize] of data.sizeNeedsMap.entries()) {
          let sizeStock = 0;
          if (rawProduct.variantBarcodes && rawProduct.variantBarcodes.length > 0) {
            const matchingVariants = rawProduct.variantBarcodes.filter(v => 
              (!data.color || !v.color || v.color.toLowerCase() === (data.color || '').toLowerCase()) &&
              (v.size && v.size.toString().trim() === size.toString().trim())
            );
            sizeStock = matchingVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
          }
          sizeStock = roundUpQuantity(sizeStock, 2);

          // Find open PO quantity for this specific size
          const sizeMatchingPOItems = matchingPOItems.filter(poi => 
            poi.size && poi.size.toString().trim() === size.toString().trim()
          );
          const sizeOnOrder = roundUpQuantity(
            sizeMatchingPOItems.reduce((sum, poi) => sum + Math.max(0, (poi.quantity || 0) - (poi.shippedQuantity || 0)), 0),
            2
          );

          const roundedReq = roundUpQuantity(reqQtyForSize, 2);
          const sizeShortage = Math.max(0, roundUpQuantity(roundedReq - sizeStock - sizeOnOrder, 2));

          sizeBreakdownList.push({
            size,
            required: roundedReq,
            currentStock: sizeStock,
            onOrderQuantity: sizeOnOrder,
            shortage: sizeShortage
          });
        }

        // Sort size breakdown naturally
        sizeBreakdownList.sort((a, b) => {
          const na = parseFloat(a.size);
          const nb = parseFloat(b.size);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          return a.size.localeCompare(b.size);
        });

        // Totals from size breakdown
        const totalReqFromSizes = sizeBreakdownList.reduce((s, x) => s + x.required, 0);
        const totalStockFromSizes = sizeBreakdownList.reduce((s, x) => s + x.currentStock, 0);
        const totalOnOrderFromSizes = sizeBreakdownList.reduce((s, x) => s + (x.onOrderQuantity || 0), 0);
        const totalShortageFromSizes = sizeBreakdownList.reduce((s, x) => s + x.shortage, 0);

        currentStock = totalStockFromSizes;
        onOrderQuantity = totalOnOrderFromSizes;
        grossShortageQuantity = Math.max(0, roundUpQuantity(totalReqFromSizes - currentStock, 2));
        shortageQuantity = totalShortageFromSizes;
        
        // If rawProduct has stock at header level but variantBarcodes didn't have size stock
        if (currentStock === 0 && (rawProduct.stock || 0) > 0 && (!rawProduct.variantBarcodes || rawProduct.variantBarcodes.length === 0)) {
          currentStock = rawProduct.stock;
          grossShortageQuantity = Math.max(0, roundUpQuantity(totalReqFromSizes - currentStock, 2));
          shortageQuantity = Math.max(0, roundUpQuantity(totalReqFromSizes - currentStock - onOrderQuantity, 2));
        }
      } else {
        // Non-matrix stock and PO check
        currentStock = rawProduct.stock || 0;
        if (data.color && rawProduct.variantBarcodes && rawProduct.variantBarcodes.length > 0) {
          const colorVariants = rawProduct.variantBarcodes.filter(v => v.color && v.color.toLowerCase() === (data.color || '').toLowerCase());
          if (colorVariants.length > 0) {
            currentStock = colorVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
          }
        }
        currentStock = roundUpQuantity(currentStock, 2);

        onOrderQuantity = roundUpQuantity(
          matchingPOItems.reduce((sum, poi) => sum + Math.max(0, (poi.quantity || 0) - (poi.shippedQuantity || 0)), 0),
          2
        );

        const reqQty = roundUpQuantity(data.requiredQuantity, 2);
        grossShortageQuantity = Math.max(0, roundUpQuantity(reqQty - currentStock, 2));
        shortageQuantity = Math.max(0, roundUpQuantity(reqQty - currentStock - onOrderQuantity, 2));
      }

      const buyingPrice = rawProduct.buyingPrice || 0;
      const estimatedCost = roundUpQuantity(shortageQuantity * buyingPrice, 2);

      // Automatically heal floating point precision artifact in DB if detected
      if (rawProduct.id && Math.abs((rawProduct.stock || 0) - currentStock) > 0.00000001 && (!rawProduct.variantBarcodes || rawProduct.variantBarcodes.length === 0)) {
        db.products.update(rawProduct.id, { stock: currentStock }).catch(() => {});
      }

      let itemStatus: 'sufficient' | 'shortage' | 'po_created' = 'sufficient';
      if (shortageQuantity > 0) {
        itemStatus = 'shortage';
        shortageCount++;
        totalShortageCost += estimatedCost;
      } else if (grossShortageQuantity > 0 && onOrderQuantity > 0) {
        itemStatus = 'po_created';
      } else {
        itemStatus = 'sufficient';
      }

      const preferredSupplierId = rawProduct.preferredSupplierId;
      const preferredSupplierName = preferredSupplierId ? (rawProduct.preferredSupplierName || supplierMap.get(preferredSupplierId)) : undefined;

      mrpItems.push({
        rawMaterialId: data.rawMaterialId,
        rawMaterialName: rawProduct.name,
        rawMaterialCode: rawProduct.code,
        color: data.color,
        categoryType: rawProduct.categoryType,
        subType: rawProduct.subType,
        isMatrixMatched: data.isMatrixMatched,
        hasSizeMatrix: hasMatrix,
        sizeBreakdown: sizeBreakdownList,
        unit: rawProduct.unit || 'Çift',
        currentStock,
        requiredQuantity: roundUpQuantity(data.requiredQuantity, 2),
        onOrderQuantity,
        grossShortageQuantity,
        shortageQuantity,
        status: itemStatus,
        activePurchaseOrders: activePOsForThisItem,
        buyingPrice,
        estimatedCost,
        preferredSupplierId,
        preferredSupplierName,
        workOrderCount: data.affectedWorkOrderIds.length,
        affectedWorkOrderIds: data.affectedWorkOrderIds
      });
    }

    // Sort: shortages first, then po_created, then sufficient
    mrpItems.sort((a, b) => {
      const orderMap: Record<string, number> = { shortage: 0, po_created: 1, sufficient: 2 };
      const scoreA = orderMap[a.status] ?? 3;
      const scoreB = orderMap[b.status] ?? 3;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return b.shortageQuantity - a.shortageQuantity;
    });

    // Update material readiness on work orders
    for (const wo of workOrdersToAnalyze) {
      const recipe = getRecipeForWO(wo.productId, wo.color);
      if (!recipe) {
        await db.workOrders.update(wo.id!, { materialStatus: 'no_recipe' });
        continue;
      }
      
      let hasShortage = false;
      let hasPoCreated = false;

      for (const ing of recipe.ingredients) {
        const ingColor = ing.color || wo.color || '';
        const item = mrpItems.find(m => m.rawMaterialId === ing.productId && (m.color || '') === ingColor);
        if (item) {
          if (item.status === 'shortage') {
            hasShortage = true;
          } else if (item.status === 'po_created') {
            hasPoCreated = true;
          }
        }
      }

      let newStatus: MaterialReadinessStatus = 'materials_ready';
      if (hasShortage) {
        newStatus = 'materials_shortage';
      } else if (hasPoCreated) {
        newStatus = 'po_created';
      } else {
        newStatus = 'materials_ready';
      }
      await db.workOrders.update(wo.id!, { materialStatus: newStatus });
    }

    return {
      calculatedAt: new Date(),
      totalWorkOrders: workOrdersToAnalyze.length,
      totalRequiredMaterialsCount: mrpItems.length,
      shortageItemsCount: shortageCount,
      totalShortageCost,
      items: mrpItems
    };
  },

  // Multi-supplier purchase order split from MRP
  async createPurchaseOrdersBySupplierFromMRP(
    shortageItems: { 
      rawMaterialId: number; 
      quantity: number; 
      color?: string;
      sizeBreakdown?: { size: string; quantity: number }[];
      unitPrice?: number; 
      supplierId?: number;
    }[],
    defaultSupplierContactId?: number,
    notes?: string
  ): Promise<{
    ordersCreated: {
      orderId: number;
      orderNumber: string;
      supplierId: number;
      supplierName: string;
      itemCount: number;
      grandTotal: number;
    }[];
    totalOrdersCount: number;
    totalGrandTotal: number;
  }> {
    if (!shortageItems || shortageItems.length === 0) {
      throw new Error('Satın alma siparişi için en az bir hammadde seçilmelidir.');
    }

    return await db.transaction('rw', [db.orders, db.orderItems, db.contacts, db.products, db.workOrders], async () => {
      const allContacts = await db.contacts.toArray();
      const allProducts = await db.products.toArray();
      const productMap = new Map(allProducts.map(p => [p.id!, p]));
      const contactMap = new Map(allContacts.map(c => [c.id!, c]));

      // Fallback supplier if none specified
      let fallbackSupplier = allContacts.find(c => c.type === 'supplier' || c.type === 'both');
      if (!fallbackSupplier) {
        const fallbackId = await db.contacts.add({
          name: 'Genel Hammadde Tedarikçisi',
          type: 'supplier',
          balance: 0
        });
        fallbackSupplier = { id: fallbackId, name: 'Genel Hammadde Tedarikçisi', type: 'supplier', balance: 0 };
        contactMap.set(fallbackId, fallbackSupplier);
      }

      // Group items by supplier ID
      const supplierGroups = new Map<number, { 
        rawMaterialId: number; 
        quantity: number; 
        color?: string;
        sizeBreakdown?: { size: string; quantity: number }[];
        unitPrice?: number;
      }[]>();

      // Track supplier assignment per raw material to update products
      const rawMaterialSupplierMap = new Map<number, number>();

      for (const item of shortageItems) {
        const raw = productMap.get(item.rawMaterialId);
        let targetSupplierId = item.supplierId;
        
        if (!targetSupplierId && raw?.preferredSupplierId) {
          targetSupplierId = raw.preferredSupplierId;
        }
        if (!targetSupplierId && defaultSupplierContactId) {
          targetSupplierId = defaultSupplierContactId;
        }
        if (!targetSupplierId) {
          targetSupplierId = fallbackSupplier.id!;
        }

        rawMaterialSupplierMap.set(item.rawMaterialId, targetSupplierId);

        const group = supplierGroups.get(targetSupplierId) || [];
        group.push(item);
        supplierGroups.set(targetSupplierId, group);
      }

      // Automatically remember preferred suppliers on products
      for (const [rawId, supId] of rawMaterialSupplierMap.entries()) {
        const sup = contactMap.get(supId);
        if (sup) {
          await db.products.update(rawId, {
            preferredSupplierId: supId,
            preferredSupplierName: sup.name
          });
        }
      }

      const ordersCreated: {
        orderId: number;
        orderNumber: string;
        supplierId: number;
        supplierName: string;
        itemCount: number;
        grandTotal: number;
      }[] = [];

      let overallGrandTotal = 0;
      let orderIndex = 0;
      const timestamp = Date.now().toString().slice(-5);

      for (const [supplierId, groupItems] of supplierGroups.entries()) {
        orderIndex++;
        const supplier = contactMap.get(supplierId) || fallbackSupplier;
        let subtotal = 0;
        const orderItemsData: Omit<OrderItem, 'id' | 'orderId'>[] = [];

        for (const it of groupItems) {
          const raw = productMap.get(it.rawMaterialId);
          if (!raw) continue;

          const price = it.unitPrice !== undefined ? it.unitPrice : (raw.buyingPrice || 0);

          const validSizes = it.sizeBreakdown?.filter(s => (s.quantity || 0) > 0);
          if (validSizes && validSizes.length > 0) {
            // Create size-specific purchase order line items (e.g. 40-100, 41-200, 42-200, 43-200, 44-100)
            for (const sb of validSizes) {
              const lineQty = roundUpQuantity(sb.quantity, 2);
              const lineNet = price * lineQty;
              const lineTotal = lineNet * 1.20; // 20% VAT
              subtotal += lineNet;

              orderItemsData.push({
                productId: it.rawMaterialId,
                color: it.color,
                size: sb.size,
                quantity: lineQty,
                shippedQuantity: 0,
                unitPrice: price,
                taxRate: 20,
                discountRate: 0,
                total: lineTotal
              });
            }
          } else {
            const lineQty = roundUpQuantity(it.quantity, 2);
            const lineNet = price * lineQty;
            const lineTotal = lineNet * 1.20; // 20% VAT
            subtotal += lineNet;

            orderItemsData.push({
              productId: it.rawMaterialId,
              color: it.color,
              quantity: lineQty,
              shippedQuantity: 0,
              unitPrice: price,
              taxRate: 20,
              discountRate: 0,
              total: lineTotal
            });
          }
        }

        if (orderItemsData.length === 0) continue;

        const taxAmount = subtotal * 0.20;
        const grandTotal = subtotal + taxAmount;
        overallGrandTotal += grandTotal;

        // Clean short supplier prefix
        const supplierTag = supplier.name.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'TED');
        const orderNumber = `PO-MRP-${supplierTag}-${timestamp}-${orderIndex}`;

        const matrixSummaries = groupItems
          .map(it => {
            const raw = productMap.get(it.rawMaterialId);
            if (!raw) return '';
            const colorStr = it.color ? ` (Renk: ${it.color})` : '';
            const validSizes = it.sizeBreakdown?.filter(s => (s.quantity || 0) > 0);
            if (validSizes && validSizes.length > 0) {
              const assortStr = validSizes.map(s => `${s.size}:${s.quantity}`).join(', ');
              return `${raw.name}${colorStr} - Asorti: [${assortStr} ${raw.unit || 'Çift'}] (Toplam: ${it.quantity} ${raw.unit || 'Çift'})`;
            }
            return `${raw.name}${colorStr} - ${it.quantity} ${raw.unit || 'Adet'}`;
          })
          .filter(Boolean)
          .join('\n');

        const orderData: Omit<Order, 'id'> = {
          type: 'purchase',
          orderNumber,
          contactId: supplierId,
          date: new Date(),
          status: 'confirmed',
          totalAmount: subtotal,
          taxAmount,
          discountAmount: 0,
          grandTotal,
          notes: notes || `MRP Otomatik Sipariş:\n${matrixSummaries}`,
          currency: 'TRY'
        };

        const orderId = await db.orders.add(orderData as Order);
        const itemsWithOrderId = orderItemsData.map(it => ({ ...it, orderId }));
        await db.orderItems.bulkAdd(itemsWithOrderId as OrderItem[]);

        ordersCreated.push({
          orderId,
          orderNumber,
          supplierId,
          supplierName: supplier.name,
          itemCount: orderItemsData.length,
          grandTotal
        });
      }

      return {
        ordersCreated,
        totalOrdersCount: ordersCreated.length,
        totalGrandTotal: overallGrandTotal
      };
    });
  },

  async createPurchaseOrderFromMRP(
    shortageItems: { 
      rawMaterialId: number; 
      quantity: number; 
      color?: string;
      sizeBreakdown?: { size: string; quantity: number }[];
      unitPrice?: number;
    }[],
    supplierContactId?: number,
    notes?: string
  ) {
    if (!shortageItems || shortageItems.length === 0) {
      throw new Error('Satın alma siparişi için en az bir hammadde seçilmelidir.');
    }

    return await db.transaction('rw', [db.orders, db.orderItems, db.contacts, db.products], async () => {
      // Find or fallback supplier contact
      let contactId = supplierContactId;
      if (!contactId) {
        const firstSupplier = await db.contacts.where('type').equals('supplier').first();
        if (firstSupplier) {
          contactId = firstSupplier.id;
        } else {
          // Create default supplier if none exists
          contactId = await db.contacts.add({
            name: 'Genel Hammadde Tedarikçisi',
            type: 'supplier',
            balance: 0
          });
        }
      }

      let subtotal = 0;
      const orderItemsData: Omit<OrderItem, 'id' | 'orderId'>[] = [];

      for (const item of shortageItems) {
        const raw = await db.products.get(item.rawMaterialId);
        if (!raw) continue;

        const price = item.unitPrice !== undefined ? item.unitPrice : (raw.buyingPrice || 0);

        const validSizes = item.sizeBreakdown?.filter(s => (s.quantity || 0) > 0);
        if (validSizes && validSizes.length > 0) {
          for (const sb of validSizes) {
            const lineQty = roundUpQuantity(sb.quantity, 2);
            const lineNet = price * lineQty;
            const lineTotal = lineNet * 1.20;
            subtotal += lineNet;

            orderItemsData.push({
              productId: item.rawMaterialId,
              color: item.color,
              size: sb.size,
              quantity: lineQty,
              shippedQuantity: 0,
              unitPrice: price,
              taxRate: 20,
              discountRate: 0,
              total: lineTotal
            });
          }
        } else {
          const lineQty = roundUpQuantity(item.quantity, 2);
          const lineNet = price * lineQty;
          const lineTotal = lineNet * 1.20;
          subtotal += lineNet;

          orderItemsData.push({
            productId: item.rawMaterialId,
            color: item.color,
            quantity: lineQty,
            shippedQuantity: 0,
            unitPrice: price,
            taxRate: 20,
            discountRate: 0,
            total: lineTotal
          });
        }
      }

      const taxAmount = subtotal * 0.20;
      const grandTotal = subtotal + taxAmount;
      const orderNumber = `PO-MRP-${Date.now().toString().slice(-6)}`;

      const orderData: Omit<Order, 'id'> = {
        type: 'purchase',
        orderNumber,
        contactId: contactId!,
        date: new Date(),
        status: 'confirmed',
        totalAmount: subtotal,
        taxAmount,
        discountAmount: 0,
        grandTotal,
        notes: notes || 'MRP (Malzeme İhtiyaç Planlama) tarafından otomatik oluşturulan hammadde tedarik siparişi.',
        currency: 'TRY'
      };

      const orderId = await db.orders.add(orderData as Order);
      const itemsWithOrderId = orderItemsData.map(it => ({ ...it, orderId }));
      await db.orderItems.bulkAdd(itemsWithOrderId as OrderItem[]);

      return { orderId, orderNumber, grandTotal };
    });
  },

  async completeWorkOrder(id: number) {
    return await this.advanceWorkOrderStage(id, 'completed');
  },

  // --- Inventory & Purchasing ---
  async adjustStock(productId: number, quantity: number, type: 'in' | 'out', description: string, variant?: { color?: string; size?: string }) {
    return await db.transaction('rw', [db.products, db.inventoryLogs], async () => {
      const product = await db.products.get(productId);
      if (!product) throw new Error('Ürün bulunamadı');

      const newStock = type === 'in' ? product.stock + quantity : Math.max(0, product.stock - quantity);
      
      let updatedVariantBarcodes = product.variantBarcodes;
      let logDesc = description;

      if (variant && variant.color && variant.size && product.variantBarcodes && product.variantBarcodes.length > 0) {
        logDesc = `${description} [${variant.color} / ${variant.size}: ${type === 'in' ? '+' : '-'}${quantity}]`;
        updatedVariantBarcodes = product.variantBarcodes.map(vb => {
          if (vb.color.toLowerCase() === variant.color!.toLowerCase() && vb.size.toLowerCase() === variant.size!.toLowerCase()) {
            const vStock = (vb.stock || 0) + (type === 'in' ? quantity : -quantity);
            return { ...vb, stock: Math.max(0, vStock) };
          }
          return vb;
        });
      }

      await db.products.update(productId, { 
        stock: newStock,
        ...(updatedVariantBarcodes ? { variantBarcodes: updatedVariantBarcodes } : {})
      });
      
      await db.inventoryLogs.add({
        productId,
        type,
        quantity,
        date: new Date(),
        description: logDesc
      });
    });
  },

  async adjustInventoryQuantity(
    productId: number,
    quantityDiff: number,
    description: string,
    variant?: { color?: string; size?: string }
  ) {
    const type = quantityDiff >= 0 ? 'in' : 'out';
    return await this.adjustStock(productId, Math.abs(quantityDiff), type, description, variant);
  },

  async transitionWorkOrderStage(
    id: number,
    targetStage?: ProductionStage,
    options?: { operator?: string; scrapQuantity?: number; notes?: string }
  ) {
    return await this.advanceWorkOrderStage(id, targetStage, options);
  },

  async addProduct(product: any) {
    const id = await db.products.add({
      ...product,
      stock: product.stock || 0
    });
    // Otomatik TDHP Muhasebe Hesapları Senkronizasyonu (Stok, Satış Geliri, Alış/Maliyet)
    await this.syncProductAccountingAccounts({ ...product, id });
    return id;
  },

  async updateProduct(id: number, product: any) {
    const res = await db.products.update(id, product);
    const fullProduct = await db.products.get(id);
    if (fullProduct) {
      await this.syncProductAccountingAccounts(fullProduct);
    }
    return res;
  },

  async syncProductAccountingAccounts(product: any) {
    try {
      const code = product.code ? `${product.code} - ` : '';
      // 1. Envanter / Stok Hesabı (örn. 150.01.001, 152.01.001, 153.01.001)
      if (product.accountingCode?.trim()) {
        await accountingService.registerAccountFromCode({
          code: product.accountingCode.trim(),
          name: `${code}${product.name} (Stok)`,
          type: 'asset',
          sourceModule: 'product',
          description: `Stok Envanter Hesabı (${product.code || ''})`
        });
      }
      // 2. Satış Gelir Hesabı (örn. 600.01.001, 600.20.001)
      if (product.salesAccountCode?.trim()) {
        await accountingService.registerAccountFromCode({
          code: product.salesAccountCode.trim(),
          name: `${code}${product.name} (Satış Geliri)`,
          type: 'revenue',
          sourceModule: 'product',
          description: `Satış Gelir Hesabı (${product.code || ''})`
        });
      }
      // 3. Alış / Maliyet Hesabı (örn. 150.01.001 veya 620.01.001)
      if (product.purchaseAccountCode?.trim()) {
        await accountingService.registerAccountFromCode({
          code: product.purchaseAccountCode.trim(),
          name: `${code}${product.name} (Alış/Maliyet)`,
          sourceModule: 'product',
          description: `Alış / Maliyet Hesabı (${product.code || ''})`
        });
      }
    } catch (err) {
      console.error('Ürün muhasebe hesapları senkronizasyon hatası:', err);
    }
  },

  async saveRecipe(recipe: Recipe) {
    const targetColor = recipe.targetColor && recipe.targetColor !== 'all' ? recipe.targetColor.trim() : undefined;
    
    // Find if a recipe already exists for this specific productId and targetColor
    const allRecipes = await db.recipes.where('productId').equals(recipe.productId).toArray();
    const existing = allRecipes.find(r => {
      const rColor = r.targetColor && r.targetColor !== 'all' ? r.targetColor.trim() : undefined;
      return rColor === targetColor;
    });

    if (existing && existing.id) {
      await db.recipes.update(existing.id, {
        ...recipe,
        targetColor,
        updatedAt: new Date()
      });
      return existing.id;
    }

    return await db.recipes.add({
      ...recipe,
      targetColor,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  },

  async addRecipe(recipe: Recipe) {
    return await this.saveRecipe(recipe);
  },

  async deleteRecipe(id: number) {
    return await db.recipes.delete(id);
  },

  // --- BOM (Product Recipe) & Automatic Material Deduction ---
  async previewRecipeConsumption(params: {
    productId: number;
    quantity: number;
    color?: string;
    size?: string;
  }) {
    const { productId, quantity, color, size } = params;
    const allProductRecipes = await db.recipes.where('productId').equals(productId).toArray();
    const recipe = allProductRecipes.find(r => color && r.targetColor === color) ||
                   allProductRecipes.find(r => !r.targetColor || r.targetColor === 'all' || r.targetColor === 'Genel') ||
                   allProductRecipes[0];

    if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
      return {
        hasRecipe: false,
        recipeName: '',
        ingredients: [],
        allSufficient: true
      };
    }

    const finishedProduct = await db.products.get(productId);
    const ingredientPreviews = [];
    let allSufficient = true;

    for (const ing of recipe.ingredients) {
      const raw = await db.products.get(ing.productId);
      if (!raw) continue;

      const totalNeeded = Number((ing.quantity * quantity).toFixed(3));
      const currentStock = raw.stock || 0;
      const isSufficient = currentStock >= totalNeeded;
      if (!isSufficient) allSufficient = false;

      ingredientPreviews.push({
        productId: raw.id!,
        name: raw.name,
        code: raw.code,
        categoryType: raw.categoryType,
        subType: raw.subType || ing.partName,
        department: ing.department,
        partName: ing.partName,
        unit: raw.unit || ing.unit || 'Adet',
        quantityPerPair: ing.quantity,
        totalNeeded,
        currentStock,
        remainingStockAfter: currentStock - totalNeeded,
        isSufficient,
        isMatrixMatched: !!ing.isMatrixMatched
      });
    }

    return {
      hasRecipe: true,
      recipeId: recipe.id,
      recipeName: recipe.name || `${finishedProduct?.name} BOM Reçetesi`,
      targetColor: recipe.targetColor,
      finishedProduct,
      quantity,
      ingredients: ingredientPreviews,
      allSufficient
    };
  },

  async consumeRecipeMaterialsDirectly(params: {
    productId: number;
    quantity: number;
    color?: string;
    size?: string;
    operator?: string;
    notes?: string;
    orderBarcode?: string;
  }) {
    const { productId, quantity, color, size, operator, notes, orderBarcode } = params;
    
    return await db.transaction('rw', [db.products, db.inventoryLogs, db.recipes, db.assortmentTemplates], async () => {
      const allProductRecipes = await db.recipes.where('productId').equals(productId).toArray();
      const recipe = allProductRecipes.find(r => color && r.targetColor === color) ||
                     allProductRecipes.find(r => !r.targetColor || r.targetColor === 'all' || r.targetColor === 'Genel') ||
                     allProductRecipes[0];

      if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
        throw new Error('Bu model için tanımlı bir BOM (ürün reçetesi) bulunamadı.');
      }

      const finishedProduct = await db.products.get(productId);
      if (!finishedProduct) throw new Error('Mamul ayakkabı ürünü bulunamadı.');

      const now = new Date();
      const consumedList: any[] = [];

      for (const ing of recipe.ingredients) {
        const raw = await db.products.get(ing.productId);
        if (!raw) continue;

        const totalNeeded = Number((ing.quantity * quantity).toFixed(3));
        let logDetail = '';

        // Check if semi-finished or footwear matrix item (like soles)
        const isMatrixItem = ing.isMatrixMatched || 
                             raw.categoryType === 'semi_finished' || 
                             raw.isFootwear || 
                             (raw.variantBarcodes && raw.variantBarcodes.length > 0 && raw.variantBarcodes.some(v => v.size && v.size !== 'Standart'));

        if (isMatrixItem && raw.variantBarcodes && raw.variantBarcodes.length > 0) {
          let variants = [...raw.variantBarcodes];
          const targetIngColor = ing.color || color || (raw.colors && raw.colors.length > 0 ? raw.colors[0] : (variants[0]?.color || 'Genel'));

          if (size && size.trim() !== '' && !['Asorti', 'Tüm Bedenler', 'Standart'].includes(size.trim())) {
            const targetSize = size.trim();
            let targetVar = variants.find(v => v.size === targetSize && (v.color === targetIngColor || !targetIngColor || v.color === 'Genel'));
            if (!targetVar) targetVar = variants.find(v => v.size === targetSize);
            if (targetVar) {
              targetVar.stock = Math.max(0, (targetVar.stock || 0) - totalNeeded);
            }
            logDetail = ` [${targetIngColor ? targetIngColor + ' ' : ''}Beden ${targetSize}: -${totalNeeded} ${raw.unit || 'Çift'}]`;
          } else {
            // General or assortment deduction
            const count = variants.length || 1;
            let allocated = 0;
            variants.forEach((v, idx) => {
              const isLast = idx === count - 1;
              const sizeQty = isLast ? Math.max(0, totalNeeded - allocated) : Math.round(totalNeeded / count);
              allocated += sizeQty;
              v.stock = Math.max(0, (v.stock || 0) - sizeQty);
            });
            logDetail = ` [${targetIngColor ? targetIngColor + ' ' : ''}-${totalNeeded} ${raw.unit || 'Çift'}]`;
          }

          const calculatedTotalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
          await db.products.update(ing.productId, {
            variantBarcodes: variants,
            stock: calculatedTotalStock
          });
        } else {
          // Standard raw material (leather dm2, lining dm2, laces, box, glue)
          const newStock = Math.max(0, roundUpQuantity((raw.stock || 0) - totalNeeded, 2));
          await db.products.update(ing.productId, { stock: newStock });
          logDetail = ` [${ing.partName || raw.subType || ''}: -${totalNeeded} ${raw.unit || 'Birim'}]`;
        }

        await db.inventoryLogs.add({
          productId: ing.productId,
          type: 'production_out',
          quantity: totalNeeded,
          date: now,
          description: `Otomatik BOM Sarfiyatı: ${finishedProduct.name} (${quantity} ${finishedProduct.unit || 'Çift'}) ${orderBarcode ? '#' + orderBarcode : ''}${logDetail}${operator ? ' | Operatör: ' + operator : ''}`
        });

        const refreshedRaw = await db.products.get(ing.productId);
        consumedList.push({
          productId: ing.productId,
          name: raw.name,
          code: raw.code,
          unit: raw.unit || 'Adet',
          quantityPerPair: ing.quantity,
          totalConsumed: totalNeeded,
          remainingStock: refreshedRaw?.stock || 0,
          details: logDetail
        });
      }

      // Add finished product to stock (production_in)
      const finishedCurrentStock = finishedProduct.stock || 0;
      const newFinishedStock = finishedCurrentStock + quantity;
      
      // Update variant stock if applicable
      let updatedVariants = finishedProduct.variantBarcodes ? [...finishedProduct.variantBarcodes] : undefined;
      if (updatedVariants && updatedVariants.length > 0) {
        if (size && size.trim() !== '' && !['Asorti', 'Tüm Bedenler', 'Standart'].includes(size.trim())) {
          let vMatch = updatedVariants.find(v => v.size === size.trim());
          if (vMatch) {
            vMatch.stock = (vMatch.stock || 0) + quantity;
          }
        } else {
          const count = updatedVariants.length;
          let alloc = 0;
          updatedVariants.forEach((v, idx) => {
            const isLast = idx === count - 1;
            const q = isLast ? Math.max(0, quantity - alloc) : Math.round(quantity / count);
            alloc += q;
            v.stock = (v.stock || 0) + q;
          });
        }
      }

      await db.products.update(productId, {
        stock: newFinishedStock,
        ...(updatedVariants ? { variantBarcodes: updatedVariants } : {})
      });

      await db.inventoryLogs.add({
        productId,
        type: 'production_in',
        quantity,
        date: now,
        description: `Üretim Tamamlandı & Mamul Stoğa Giriş: ${finishedProduct.name} (+${quantity} ${finishedProduct.unit || 'Çift'})${orderBarcode ? ' | Takip No: ' + orderBarcode : ''}${operator ? ' | Usta: ' + operator : ''}`
      });

      return {
        success: true,
        finishedProduct: {
          productId,
          name: finishedProduct.name,
          code: finishedProduct.code,
          quantityAdded: quantity,
          newStock: newFinishedStock
        },
        consumedIngredients: consumedList,
        timestamp: now
      };
    });
  },

  // --- Management & Setup ---
  async clearAllProducts() {
    return await db.transaction('rw', [db.products, db.inventoryLogs, db.recipes, db.workOrders, db.contacts, db.transactions], async () => {
      await db.products.clear();
      await db.inventoryLogs.clear();
      await db.recipes.clear();
      await db.workOrders.clear();
      await db.contacts.clear();
      await db.transactions.clear();
    });
  },

  async clearAllTemplates() {
    return await db.assortmentTemplates.clear();
  },

  async addAssortmentTemplate(template: { name: string, items: { size: string, quantity: number }[] }) {
    return await db.assortmentTemplates.add(template);
  },

  async updateAssortmentTemplate(id: number, template: { name: string, items: { size: string, quantity: number }[] }) {
    return await db.assortmentTemplates.update(id, template);
  },

  async deleteAssortmentTemplate(id: number) {
    return await db.assortmentTemplates.delete(id);
  },

  // --- Barcode & Modular Settings ---
  async getSystemSettings(): Promise<AppSettings> {
    const settings = await db.settings.get('global_settings') || await db.settings.get('global_barcode');
    const defaultSettings: AppSettings = {
      id: 'global_settings',
      barcodeType: 'CODE-128',
      barcodePrefix: '869',
      nextBarcodeSequence: 1000000,
      company: {
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
        iban: 'TR12 0006 2000 1234 5678 9012 34',
        currency: 'TRY'
      },
      stock: {
        barcodeType: 'CODE-128',
        barcodePrefix: '869',
        nextBarcodeSequence: 1000000,
        autoBarcodeOnProductCreate: true,
        defaultCriticalStockThreshold: 10,
        defaultShoeSizes: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46']
      },
      order: {
        salesOrderPrefix: 'SIP-2026-',
        purchaseOrderPrefix: 'SAT-2026-',
        waybillSalesPrefix: 'IRS-2026-',
        waybillPurchasePrefix: 'GIR-2026-',
        invoiceSalesPrefix: 'EFT-2026-',
        invoicePurchasePrefix: 'ALS-2026-',
        defaultVatRate: 20,
        defaultCurrency: 'TRY',
        defaultPaymentTermDays: 30,
        autoCreateWorkOrdersOnConfirm: true,
        autoDeductStockOnWaybill: true
      },
      production: {
        workOrderPrefix: 'WO-',
        defaultDailyCapacityPairs: 650,
        scrapTolerancePercentage: 2,
        autoConsumeMaterialsOnStart: true
      },
      finance: {
        defaultCurrency: 'TRY',
        checkAlertDaysBeforeDue: 7,
        defaultCustomerAccountCode: '120.01',
        defaultSupplierAccountCode: '320.01',
        defaultFinishedStockAccountCode: '157.01',
        defaultRawMaterialAccountCode: '150.01',
        defaultSalesRevenueAccountCode: '600.01',
        defaultVatCalculatedAccountCode: '391.01',
        defaultVatDeductibleAccountCode: '191.01'
      },
      hr: {
        weeklyWorkHours: 45,
        dailyWorkHours: 8,
        overtimeWeekdayMultiplier: 1.5,
        overtimeWeekendMultiplier: 2.0,
        annualLeaveBaseDays: 14,
        sgkEmployeeRate: 14,
        unemploymentEmployeeRate: 1,
        sgkEmployerRate: 15.5,
        unemploymentEmployerRate: 2
      }
    };

    if (!settings) {
      await db.settings.put(defaultSettings);
      return defaultSettings;
    }

    return {
      ...defaultSettings,
      ...settings,
      company: { ...defaultSettings.company, ...settings.company },
      stock: { ...defaultSettings.stock, ...settings.stock },
      order: { ...defaultSettings.order, ...settings.order },
      production: { ...defaultSettings.production, ...settings.production },
      finance: { ...defaultSettings.finance, ...settings.finance },
      hr: { ...defaultSettings.hr, ...settings.hr },
    };
  },

  async updateSystemSettings(settings: AppSettings) {
    const updated = {
      ...settings,
      id: 'global_settings',
      barcodeType: settings.stock?.barcodeType || settings.barcodeType || 'CODE-128',
      barcodePrefix: settings.stock?.barcodePrefix || settings.barcodePrefix || '869',
      nextBarcodeSequence: settings.stock?.nextBarcodeSequence || settings.nextBarcodeSequence || 1000000
    };
    await db.settings.put(updated);
    await db.settings.put({
      id: 'global_barcode',
      barcodeType: updated.barcodeType,
      barcodePrefix: updated.barcodePrefix,
      nextBarcodeSequence: updated.nextBarcodeSequence
    });
    return updated;
  },

  async getBarcodeSettings(): Promise<AppSettings> {
    return await this.getSystemSettings();
  },

  async updateBarcodeSettings(settings: AppSettings) {
    return await this.updateSystemSettings(settings);
  },

  async generateAutomatedBarcodes(product: Partial<Product>) {
    const settings = await this.getBarcodeSettings();
    let nextSeq = settings.nextBarcodeSequence || 1000000;
    const prefix = settings.barcodePrefix || '';
    
    const generateBarcode = () => {
      let code = `${prefix}${nextSeq}`;
      if (settings.barcodeType === 'EAN-13') {
        const numPart = `${nextSeq}`.padStart(Math.max(0, 12 - prefix.length), '0');
        const raw12 = `${prefix}${numPart}`.slice(0, 12).padStart(12, '0');
        let sum = 0;
        for (let i = 0; i < 12; i++) {
          sum += parseInt(raw12[i], 10) * (i % 2 === 0 ? 1 : 3);
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        code = `${raw12}${checkDigit}`;
      }
      nextSeq++;
      return code;
    };

    const colorBoxBarcodes: { color: string, barcode: string }[] = [];
    const variantBarcodes: BarcodeVariant[] = [];

    const effectiveColors = product.colors && product.colors.length > 0 ? product.colors : ['Genel'];

    if ((product.isFootwear || product.hasSizeVariants) && product.assortment && product.assortment.length > 0) {
      for (const color of effectiveColors) {
        // One box barcode per color
        colorBoxBarcodes.push({
          color: color,
          barcode: generateBarcode()
        });

        // Variant barcodes
        for (const item of product.assortment) {
          variantBarcodes.push({
            size: item.size,
            color: color,
            barcode: generateBarcode(),
            stock: 0
          });
        }
      }
    } else {
      // General item or items without assortment
      for (const color of effectiveColors) {
        colorBoxBarcodes.push({ color: color, barcode: generateBarcode() });
      }
    }

    await this.updateBarcodeSettings({ ...settings, nextBarcodeSequence: nextSeq });

    return { colorBoxBarcodes, variantBarcodes };
  },

  async deleteProduct(id: number) {
    const logs = await db.inventoryLogs.where('productId').equals(id).count();
    if (logs > 0) {
      throw new Error('Bu ürünün stok hareketleri bulunmaktadır. Silmeden önce hareketleri silmelisiniz.');
    }
    
    const recipes = await db.recipes.where('productId').equals(id).count();
    if (recipes > 0) {
      throw new Error('Bu ürün bir reçeteye tanımlıdır. Önce reçeteyi silmelisiniz.');
    }

    return await db.products.delete(id);
  },

  // --- Order Management ---
  async createOrder(order: Omit<Order, 'id'>, items: Omit<OrderItem, 'id' | 'orderId'>[]) {
    return await db.transaction('rw', [db.orders, db.orderItems, db.workOrders, db.recipes, db.products, db.contacts], async () => {
      const orderId = await db.orders.add(order as Order);
      const itemsWithOrderId = items.map(item => ({ ...item, orderId }));
      await db.orderItems.bulkAdd(itemsWithOrderId as OrderItem[]);

      // If it's a confirmed sales order, automatically create work orders for manufactured items
      if (order.type === 'sales' && order.status === 'confirmed') {
        try {
          await this.createWorkOrdersFromOrder(orderId);
        } catch (err) {
          console.warn('Otomatik iş emri oluşturulurken uyarı:', err);
        }
      }

      return orderId;
    });
  },

  async canModifyOrDeleteOrder(id: number | string): Promise<{ canModify: boolean; reason?: string; invoices: any[]; waybills: any[] }> {
    const numId = Number(id);
    const allInvoices = await db.invoices.toArray();
    const activeInvoices = allInvoices.filter(inv => 
      (inv.orderId === id || (inv.orderId !== undefined && !isNaN(numId) && Number(inv.orderId) === numId)) && 
      inv.status !== 'cancelled'
    );

    const allWaybills = await db.waybills.toArray();
    const activeWaybills = allWaybills.filter(wb => 
      (wb.orderId === id || (wb.orderId !== undefined && !isNaN(numId) && Number(wb.orderId) === numId)) && 
      wb.status !== 'cancelled'
    );

    if (activeInvoices.length > 0) {
      const invNumbers = activeInvoices.map(i => i.invoiceNumber).join(', ');
      return {
        canModify: false,
        reason: `Bu siparişe bağlı oluşturulmuş aktif fatura (${invNumbers}) bulunmaktadır. Sipariş üzerinde değişiklik yapmak veya silmek için önce ilgili faturayı iptal etmeli ya da silmelisiniz.`,
        invoices: activeInvoices,
        waybills: activeWaybills
      };
    }

    if (activeWaybills.length > 0) {
      const wbNumbers = activeWaybills.map(w => w.waybillNumber).join(', ');
      return {
        canModify: false,
        reason: `Bu siparişe bağlı oluşturulmuş aktif irsaliye (${wbNumbers}) bulunmaktadır. Sipariş üzerinde değişiklik yapmak veya silmek için önce ilgili irsaliyeyi iptal etmeli ya da silmelisiniz.`,
        invoices: activeInvoices,
        waybills: activeWaybills
      };
    }

    return { canModify: true, invoices: [], waybills: [] };
  },

  async updateOrder(id: number, order: Partial<Order>, items?: Omit<OrderItem, 'id' | 'orderId'>[]) {
    const check = await this.canModifyOrDeleteOrder(id);
    if (!check.canModify) {
      throw new Error(check.reason);
    }

    return await db.transaction('rw', [db.orders, db.orderItems, db.workOrders, db.recipes, db.products, db.contacts, db.assortmentTemplates], async () => {
      await db.orders.update(id, order);
      if (items) {
        // Remove existing work orders if items are changed to re-synchronize
        await db.workOrders.where('orderId').equals(id).delete();
        await db.orderItems.where('orderId').equals(id).delete();
        const itemsWithOrderId = items.map(item => ({ ...item, orderId: id }));
        await db.orderItems.bulkAdd(itemsWithOrderId as OrderItem[]);
      }

      // If sales order is confirmed, recreate work orders
      const currentOrder = await db.orders.get(id);
      if (currentOrder && currentOrder.type === 'sales' && currentOrder.status === 'confirmed') {
        try {
          await this.createWorkOrdersFromOrder(id);
        } catch (err) {
          console.warn('İş emri senkronizasyon uyarısı:', err);
        }
      }
    });
  },

  async deleteOrder(id: number | string) {
    const numId = Number(id);
    const check = await this.canModifyOrDeleteOrder(id);
    if (!check.canModify) {
      throw new Error(check.reason);
    }

    return await db.transaction('rw', [db.orders, db.orderItems, db.workOrders], async () => {
      // 1. Delete associated work orders
      const allWOs = await db.workOrders.toArray();
      const targetWOs = allWOs.filter(wo => wo.orderId === id || (wo.orderId !== undefined && !isNaN(numId) && Number(wo.orderId) === numId));
      for (const wo of targetWOs) {
        if (wo.id) await db.workOrders.delete(wo.id);
      }

      // 2. Delete associated order items
      const allItems = await db.orderItems.toArray();
      const targetItems = allItems.filter(it => it.orderId === id || (it.orderId !== undefined && !isNaN(numId) && Number(it.orderId) === numId));
      for (const it of targetItems) {
        if (it.id) await db.orderItems.delete(it.id);
      }

      // 3. Delete order itself
      if (!isNaN(numId)) {
        await db.orders.delete(numId);
      }
      if (typeof id === 'string' && id !== String(numId)) {
        await db.orders.delete(id as any);
      }
    });
  },

  async getOrder(id: number) {
    const order = await db.orders.get(id);
    if (!order) return null;
    const items = await db.orderItems.where('orderId').equals(id).toArray();
    return { ...order, items };
  },

  async getOrdersByContact(contactId: number) {
    return await db.orders.where('contactId').equals(contactId).toArray();
  },

  async updateOrderStatus(id: number, status: OrderStatus) {
    return await db.transaction('rw', [db.orders, db.orderItems, db.workOrders, db.recipes, db.products, db.contacts], async () => {
      await db.orders.update(id, { status });
      if (status === 'confirmed') {
        const order = await db.orders.get(id);
        if (order && order.type === 'sales') {
          await this.createWorkOrdersFromOrder(id);
        }
      }
    });
  },

  // --- Invoice Management (Faturalar & Kısmi Faturalandırma) ---
  generateETTN(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  async generateInvoiceNumber(type: 'sales' | 'purchase'): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = type === 'sales' ? `SAT-${year}-` : `ALS-${year}-`;
    const count = await db.invoices.where('type').equals(type).count();
    const nextSeq = (count + 1).toString().padStart(6, '0');
    return `${prefix}${nextSeq}`;
  },

  async getPendingOrdersForInvoicing(contactId?: number, orderType: 'sales' | 'purchase' = 'sales') {
    let query = db.orders.where('type').equals(orderType);
    if (contactId) {
      query = db.orders.where('[type+contactId]').equals([orderType, contactId]) as any;
    }
    
    const allOrders = contactId 
      ? await db.orders.where('contactId').equals(contactId).filter(o => o.type === orderType).toArray()
      : await db.orders.where('type').equals(orderType).toArray();

    const openOrders = allOrders.filter(o => o.status !== 'cancelled' && o.invoicingStatus !== 'fully_invoiced');

    const result = [];
    for (const order of openOrders) {
      const items = await db.orderItems.where('orderId').equals(order.id!).toArray();
      const itemsWithRemaining = items.map(item => {
        const invoicedQty = item.invoicedQuantity || 0;
        const remainingQty = Math.max(0, item.quantity - invoicedQty);
        return {
          ...item,
          invoicedQuantity: invoicedQty,
          remainingQuantity: remainingQty
        };
      }).filter(it => it.remainingQuantity > 0);

      if (itemsWithRemaining.length > 0) {
        result.push({
          ...order,
          items: itemsWithRemaining
        });
      }
    }

    return result;
  },

  async getPendingWaybillsForInvoicing(contactId?: number, type?: WaybillType) {
    let query = db.waybills.where('status').equals('issued');
    const issuedWaybills = await query.toArray();

    const pendingWaybills = issuedWaybills.filter(wb => {
      const notInvoiced = !wb.invoicedStatus || wb.invoicedStatus === 'not_invoiced';
      const matchContact = contactId ? wb.contactId === contactId : true;
      const matchType = type ? wb.type === type : true;
      return notInvoiced && matchContact && matchType;
    });

    const result = [];
    for (const wb of pendingWaybills) {
      const items = await db.waybillItems.where('waybillId').equals(wb.id!).toArray();
      const contact = wb.contactId ? await db.contacts.get(wb.contactId) : null;
      result.push({
        ...wb,
        items,
        contact
      });
    }

    return result;
  },

  // --- Stock Movement & Variant Synchronization Engine ---
  async syncProductVariantStocks(targetProductId?: number) {
    return await db.transaction('rw', [db.products, db.assortmentTemplates], async () => {
      const products = targetProductId 
        ? [await db.products.get(targetProductId)].filter(Boolean) as Product[]
        : await db.products.toArray();

      for (const product of products) {
        if (!product.id) continue;
        if (!product.isFootwear && (!product.variantBarcodes || product.variantBarcodes.length === 0)) continue;

        let variants = product.variantBarcodes ? [...product.variantBarcodes] : [];
        
        // If variants array is empty but product is footwear, generate default variant list
        if (variants.length === 0 && product.isFootwear) {
          const colors = product.colors && product.colors.length > 0 ? product.colors : ['Genel'];
          let assortment = product.assortment;
          if ((!assortment || assortment.length === 0) && product.assortmentTemplateId) {
            const tmpl = await db.assortmentTemplates.get(product.assortmentTemplateId);
            if (tmpl) assortment = tmpl.items;
          }
          if (assortment && assortment.length > 0) {
            for (const color of colors) {
              for (const it of assortment) {
                variants.push({
                  size: it.size,
                  color,
                  barcode: '',
                  stock: 0
                });
              }
            }
          }
        }

        if (variants.length === 0) continue;

        const sumVariantStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);

        // If variant stock sum is 0 but product.stock has a non-zero value (e.g., -2400 from invoice)
        if (sumVariantStock === 0 && product.stock !== 0) {
          const targetColor = product.colors && product.colors.length > 0 ? product.colors[0] : (variants[0]?.color || 'Genel');
          let assortment = product.assortment;
          if ((!assortment || assortment.length === 0) && product.assortmentTemplateId) {
            const tmpl = await db.assortmentTemplates.get(product.assortmentTemplateId);
            if (tmpl) assortment = tmpl.items;
          }

          const targetVariants = variants.filter(v => v.color === targetColor);
          const effectiveVariants = targetVariants.length > 0 ? targetVariants : variants;

          if (assortment && assortment.length > 0) {
            const totalRatio = assortment.reduce((sum, it) => sum + (it.quantity || 0), 0);
            if (totalRatio > 0) {
              let allocated = 0;
              assortment.forEach((it, idx) => {
                const isLast = idx === assortment.length - 1;
                const sizeQty = isLast 
                  ? (product.stock - allocated) 
                  : Math.round((product.stock * (it.quantity || 1)) / totalRatio);
                allocated += sizeQty;

                const matchVar = effectiveVariants.find(v => v.size === it.size);
                if (matchVar) {
                  matchVar.stock = (matchVar.stock || 0) + sizeQty;
                }
              });
            }
          } else {
            // Distribute evenly
            const count = effectiveVariants.length;
            let allocated = 0;
            effectiveVariants.forEach((v, idx) => {
              const isLast = idx === count - 1;
              const sizeQty = isLast ? (product.stock - allocated) : Math.round(product.stock / count);
              allocated += sizeQty;
              v.stock = (v.stock || 0) + sizeQty;
            });
          }

          const updatedSum = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
          await db.products.update(product.id, {
            variantBarcodes: variants,
            stock: updatedSum
          });
        } else if (product.stock !== sumVariantStock) {
          // Sync product.stock to match variants total
          await db.products.update(product.id, {
            stock: sumVariantStock
          });
        }
      }
    });
  },

  async applyItemStockMovement(
    item: { productId: number; quantity: number; color?: string; size?: string; productName?: string },
    isSales: boolean,
    invoiceNumber: string,
    invoiceDate: Date,
    reverse: boolean = false
  ) {
    const product = await db.products.get(item.productId);
    if (!product) return;

    // deltaSign: for sales: normally -1 (stock decreases), if reverse: +1 (stock restored)
    //            for purchase: normally +1 (stock increases), if reverse: -1 (stock deducted)
    const deltaSign = isSales ? (reverse ? 1 : -1) : (reverse ? -1 : 1);
    const moveType = deltaSign < 0 ? 'out' : 'in';

    const isFootwearOrVariants = product.isFootwear || product.hasSizeVariants || (product.variantBarcodes && product.variantBarcodes.length > 0);

    if (isFootwearOrVariants) {
      let variants = product.variantBarcodes ? [...product.variantBarcodes] : [];

      // Ensure template/assortment is retrieved if needed
      let assortment = product.assortment;
      if ((!assortment || assortment.length === 0) && product.assortmentTemplateId) {
        const tmpl = await db.assortmentTemplates.get(product.assortmentTemplateId);
        if (tmpl) assortment = tmpl.items;
      }

      // If variants array is empty, auto-populate from colors and assortment
      if (variants.length === 0) {
        const colors = product.colors && product.colors.length > 0 ? product.colors : ['Genel'];
        if (assortment && assortment.length > 0) {
          for (const color of colors) {
            for (const it of assortment) {
              variants.push({
                size: it.size,
                color,
                barcode: '',
                stock: 0
              });
            }
          }
        }
      }

      const effectiveColor = item.color?.trim() || (product.colors && product.colors.length > 0 ? product.colors[0] : (variants[0]?.color || 'Genel'));
      const isSpecificSize = item.size && item.size.trim() !== '' && !['Asorti', 'Tüm Bedenler', 'Standart', 'Tümü'].includes(item.size.trim());

      let logDetailText = '';

      if (isSpecificSize) {
        // Specific single size
        const targetSize = item.size!.trim();
        let targetVar = variants.find(v => v.size === targetSize && v.color === effectiveColor);
        if (!targetVar) {
          // Try matching just size
          targetVar = variants.find(v => v.size === targetSize);
        }

        if (targetVar) {
          targetVar.stock = (targetVar.stock || 0) + (deltaSign * item.quantity);
        } else {
          variants.push({
            size: targetSize,
            color: effectiveColor,
            barcode: '',
            stock: deltaSign * item.quantity
          });
        }

        logDetailText = `${effectiveColor ? effectiveColor + ' ' : ''}Beden ${targetSize}: ${deltaSign > 0 ? '+' : ''}${deltaSign * item.quantity} ${product.unit || 'Çift'}`;
      } else {
        // Assortment distribution (Beden / Asorti Dağılımı)
        let colorVariants = variants.filter(v => v.color === effectiveColor);
        if (colorVariants.length === 0) {
          colorVariants = variants;
        }

        if (assortment && assortment.length > 0) {
          const totalRatio = assortment.reduce((sum, it) => sum + (it.quantity || 0), 0);
          if (totalRatio > 0) {
            let allocated = 0;
            const distributions: { size: string; qty: number }[] = [];

            assortment.forEach((it, idx) => {
              if (idx === assortment.length - 1) {
                const rem = Math.max(0, item.quantity - allocated);
                distributions.push({ size: it.size, qty: rem });
              } else {
                const sizeQty = Math.round((item.quantity * (it.quantity || 1)) / totalRatio);
                allocated += sizeQty;
                distributions.push({ size: it.size, qty: sizeQty });
              }
            });

            // Apply each size distribution
            distributions.forEach(d => {
              let matchVar = colorVariants.find(v => v.size === d.size);
              if (matchVar) {
                matchVar.stock = (matchVar.stock || 0) + (deltaSign * d.qty);
              } else {
                const newVar = {
                  size: d.size,
                  color: effectiveColor,
                  barcode: '',
                  stock: deltaSign * d.qty
                };
                variants.push(newVar);
              }
            });

            logDetailText = `${effectiveColor ? effectiveColor + ' ' : ''}Asorti Dağılımı [${distributions.map(d => `${d.size}: ${deltaSign > 0 ? '+' : '-'}${d.qty}`).join(', ')}]`;
          }
        } else if (colorVariants.length > 0) {
          // Even distribution across variants
          const count = colorVariants.length;
          let allocated = 0;
          const distSummary: string[] = [];

          colorVariants.forEach((v, idx) => {
            const isLast = idx === count - 1;
            const sizeQty = isLast ? Math.max(0, item.quantity - allocated) : Math.round(item.quantity / count);
            allocated += sizeQty;
            v.stock = (v.stock || 0) + (deltaSign * sizeQty);
            distSummary.push(`${v.size}: ${deltaSign > 0 ? '+' : '-'}${sizeQty}`);
          });

          logDetailText = `${effectiveColor ? effectiveColor + ' ' : ''}Beden Dağılımı [${distSummary.join(', ')}]`;
        }
      }

      // Recalculate total product stock from variant stocks to ensure perfect sync
      const calculatedTotalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
      await db.products.update(item.productId, {
        variantBarcodes: variants,
        stock: calculatedTotalStock
      });

      // Add detailed inventory log
      await db.inventoryLogs.add({
        productId: item.productId,
        type: moveType,
        quantity: item.quantity,
        date: new Date(invoiceDate),
        description: `${invoiceNumber} No'lu ${isSales ? 'Satış' : 'Alış'} Faturası ${reverse ? 'Geri Alma' : 'Stok Hareketi'}${logDetailText ? ` (${logDetailText})` : ''}`
      });
    } else {
      // Standard product without variants
      const newStock = Math.max(0, roundUpQuantity((product.stock || 0) + (deltaSign * item.quantity), 2));
      await db.products.update(item.productId, { stock: newStock });

      await db.inventoryLogs.add({
        productId: item.productId,
        type: moveType,
        quantity: item.quantity,
        date: new Date(invoiceDate),
        description: `${invoiceNumber} No'lu ${isSales ? 'Satış' : 'Alış'} Faturası ${reverse ? 'Geri Alma' : 'Stok Hareketi'} (${deltaSign > 0 ? '+' : '-'}${item.quantity} ${product.unit || 'Adet'})`
      });
    }
  },

  async createInvoice(
    invoiceData: Omit<Invoice, 'id'>, 
    items: Omit<InvoiceItem, 'id' | 'invoiceId'>[]
  ) {
    return await db.transaction('rw', [
      db.invoices, 
      db.invoiceItems, 
      db.orders, 
      db.orderItems, 
      db.waybills,
      db.contacts, 
      db.inventoryLogs, 
      db.products,
      db.assortmentTemplates
    ], async () => {
      // 1. Add Invoice
      const invoiceId = await db.invoices.add({
        ...invoiceData,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Invoice);

      // 2. Add Invoice Items
      const itemsWithInvoiceId = items.map(item => ({
        ...item,
        invoiceId
      }));
      await db.invoiceItems.bulkAdd(itemsWithInvoiceId as InvoiceItem[]);

      // 3. Handle Partial / Full Order Invoicing Link
      if (invoiceData.orderId) {
        const orderId = invoiceData.orderId;
        const allOrderItems = await db.orderItems.where('orderId').equals(orderId).toArray();

        for (const item of items) {
          if (item.orderItemId) {
            const targetOrderItem = allOrderItems.find(oi => oi.id === item.orderItemId);
            if (targetOrderItem) {
              const prevInvoiced = targetOrderItem.invoicedQuantity || 0;
              const newInvoiced = prevInvoiced + item.quantity;
              await db.orderItems.update(targetOrderItem.id!, {
                invoicedQuantity: newInvoiced
              });
              targetOrderItem.invoicedQuantity = newInvoiced;
            }
          }
        }

        // Check if all order items are now fully invoiced
        const totalOrderedQty = allOrderItems.reduce((sum, oi) => sum + oi.quantity, 0);
        const totalInvoicedQty = allOrderItems.reduce((sum, oi) => sum + (oi.invoicedQuantity || 0), 0);

        let invoicingStatus: 'not_invoiced' | 'partially_invoiced' | 'fully_invoiced' = 'not_invoiced';
        if (totalInvoicedQty >= totalOrderedQty) {
          invoicingStatus = 'fully_invoiced';
        } else if (totalInvoicedQty > 0) {
          invoicingStatus = 'partially_invoiced';
        }

        const currentInvoicedTotal = (invoiceData.grandTotal || 0);
        const order = await db.orders.get(orderId);
        const existingInvoicedTotal = order?.invoicedTotal || 0;

        await db.orders.update(orderId, {
          invoicingStatus,
          invoicedTotal: existingInvoicedTotal + currentInvoicedTotal
        });
      }

      // 3b. Handle Waybill Invoicing Link
      if (invoiceData.waybillId) {
        await db.waybills.update(invoiceData.waybillId, {
          invoicedStatus: 'invoiced',
          invoiceId,
          invoiceNumber: invoiceData.invoiceNumber,
          updatedAt: new Date()
        });
      }

      // 4. Update Contact Balance if invoice is issued (not draft)
      if (invoiceData.status !== 'draft' && invoiceData.contactId) {
        const contact = await db.contacts.get(invoiceData.contactId);
        if (contact) {
          let newBalance = contact.balance;
          if (invoiceData.type === 'sales') {
            // Sales invoice increases receivable (Borç/Alacağımız artar)
            newBalance = contact.balance + invoiceData.grandTotal;
          } else {
            // Purchase invoice increases payable (Borcumuz artar)
            newBalance = contact.balance - invoiceData.grandTotal;
          }
          await db.contacts.update(invoiceData.contactId, {
            balance: newBalance,
            updatedAt: new Date()
          });
        }
      }

      // 5. Handle Variant-Aware Stock Deduction
      if (invoiceData.isStockDeducted) {
        const isSales = invoiceData.type === 'sales';
        for (const item of items) {
          if (item.productId) {
            await this.applyItemStockMovement(
              {
                productId: item.productId,
                quantity: item.quantity,
                color: item.color,
                size: item.size,
                productName: item.productName
              },
              isSales,
              invoiceData.invoiceNumber,
              new Date(invoiceData.date),
              false
            );
          }
        }
      }

      return invoiceId;
    });
  },

  async cancelInvoice(id: number, reason?: string) {
    return await db.transaction('rw', [
      db.invoices, 
      db.invoiceItems, 
      db.orders, 
      db.orderItems, 
      db.waybills,
      db.contacts, 
      db.inventoryLogs, 
      db.products,
      db.assortmentTemplates
    ], async () => {
      const invoice = await db.invoices.get(id);
      if (!invoice) return;
      if (invoice.status === 'cancelled') return; // already cancelled

      const items = await db.invoiceItems.where('invoiceId').equals(id).toArray();

      // 1. Revert order item invoiced quantities if it was linked to an order
      if (invoice.orderId) {
        const orderId = invoice.orderId;
        const allOrderItems = await db.orderItems.where('orderId').equals(orderId).toArray();

        for (const item of items) {
          if (item.orderItemId) {
            const targetOrderItem = allOrderItems.find(oi => oi.id === item.orderItemId);
            if (targetOrderItem) {
              const prevInvoiced = targetOrderItem.invoicedQuantity || 0;
              const newInvoiced = Math.max(0, prevInvoiced - item.quantity);
              await db.orderItems.update(targetOrderItem.id!, {
                invoicedQuantity: newInvoiced
              });
              targetOrderItem.invoicedQuantity = newInvoiced;
            }
          }
        }

        const totalOrderedQty = allOrderItems.reduce((sum, oi) => sum + oi.quantity, 0);
        const totalInvoicedQty = allOrderItems.reduce((sum, oi) => sum + (oi.invoicedQuantity || 0), 0);

        let invoicingStatus: InvoicingStatus = 'not_invoiced';
        if (totalInvoicedQty >= totalOrderedQty) {
          invoicingStatus = 'fully_invoiced';
        } else if (totalInvoicedQty > 0) {
          invoicingStatus = 'partially_invoiced';
        }

        const order = await db.orders.get(orderId);
        const existingInvoicedTotal = order?.invoicedTotal || 0;

        await db.orders.update(orderId, {
          invoicingStatus,
          invoicedTotal: Math.max(0, existingInvoicedTotal - (invoice.grandTotal || 0))
        });
      }

      // 1b. Revert Waybill Invoiced Status if linked
      if (invoice.waybillId) {
        await db.waybills.update(invoice.waybillId, {
          invoicedStatus: 'not_invoiced',
          invoiceId: undefined,
          invoiceNumber: undefined,
          updatedAt: new Date()
        });
      } else {
        const linkedWaybills = await db.waybills.where('invoiceId').equals(id).toArray();
        for (const wb of linkedWaybills) {
          if (wb.id) {
            await db.waybills.update(wb.id, {
              invoicedStatus: 'not_invoiced',
              invoiceId: undefined,
              invoiceNumber: undefined,
              updatedAt: new Date()
            });
          }
        }
      }

      // 2. Revert Contact Balance (if invoice was issued)
      if (invoice.status === 'issued' && invoice.contactId) {
        const contact = await db.contacts.get(invoice.contactId);
        if (contact) {
          let newBalance = contact.balance;
          if (invoice.type === 'sales') {
            // Satış faturası alacağımızı artırmıştı -> İptal ile alacağımız düşer
            newBalance = contact.balance - invoice.grandTotal;
          } else {
            // Alış faturası borcumuzu artırmıştı -> İptal ile borcumuz düşer
            newBalance = contact.balance + invoice.grandTotal;
          }
          await db.contacts.update(invoice.contactId, {
            balance: newBalance,
            updatedAt: new Date()
          });
        }
      }

      // 3. Revert stock across variants if deducted
      if (invoice.isStockDeducted && invoice.status === 'issued') {
        const isSales = invoice.type === 'sales';
        for (const item of items) {
          if (item.productId) {
            await this.applyItemStockMovement(
              {
                productId: item.productId,
                quantity: item.quantity,
                color: item.color,
                size: item.size,
                productName: item.productName
              },
              isSales,
              invoice.invoiceNumber,
              new Date(),
              true // reverse = true to restore stock
            );
          }
        }
      }

      // 4. Update Invoice Status to 'cancelled'
      const formattedDate = new Date().toLocaleDateString('tr-TR');
      const formattedTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const cancelNote = reason 
        ? `[İPTAL EDİLDİ: ${formattedDate} ${formattedTime} - Sebep: ${reason}]` 
        : `[İPTAL EDİLDİ: ${formattedDate} ${formattedTime}]`;

      await db.invoices.update(id, {
        status: 'cancelled',
        updatedAt: new Date(),
        notes: invoice.notes ? `${invoice.notes}\n${cancelNote}` : cancelNote
      });
    });
  },

  async deleteInvoice(id: number) {
    return await db.transaction('rw', [
      db.invoices, 
      db.invoiceItems, 
      db.orders, 
      db.orderItems, 
      db.waybills,
      db.contacts, 
      db.inventoryLogs, 
      db.products,
      db.assortmentTemplates
    ], async () => {
      const invoice = await db.invoices.get(id);
      if (!invoice) return;

      const items = await db.invoiceItems.where('invoiceId').equals(id).toArray();

      // Revert waybill invoiced status if linked
      if (invoice.waybillId) {
        await db.waybills.update(invoice.waybillId, {
          invoicedStatus: 'not_invoiced',
          invoiceId: undefined,
          invoiceNumber: undefined,
          updatedAt: new Date()
        });
      } else {
        const linkedWaybills = await db.waybills.where('invoiceId').equals(id).toArray();
        for (const wb of linkedWaybills) {
          if (wb.id) {
            await db.waybills.update(wb.id, {
              invoicedStatus: 'not_invoiced',
              invoiceId: undefined,
              invoiceNumber: undefined,
              updatedAt: new Date()
            });
          }
        }
      }

      // If the invoice was 'issued' (and not previously cancelled), revert relations
      if (invoice.status === 'issued') {
        // 1. Revert order item invoiced quantities
        if (invoice.orderId) {
          const orderId = invoice.orderId;
          const allOrderItems = await db.orderItems.where('orderId').equals(orderId).toArray();

          for (const item of items) {
            if (item.orderItemId) {
              const targetOrderItem = allOrderItems.find(oi => oi.id === item.orderItemId);
              if (targetOrderItem) {
                const prevInvoiced = targetOrderItem.invoicedQuantity || 0;
                const newInvoiced = Math.max(0, prevInvoiced - item.quantity);
                await db.orderItems.update(targetOrderItem.id!, {
                  invoicedQuantity: newInvoiced
                });
                targetOrderItem.invoicedQuantity = newInvoiced;
              }
            }
          }

          const totalOrderedQty = allOrderItems.reduce((sum, oi) => sum + oi.quantity, 0);
          const totalInvoicedQty = allOrderItems.reduce((sum, oi) => sum + (oi.invoicedQuantity || 0), 0);

          let invoicingStatus: InvoicingStatus = 'not_invoiced';
          if (totalInvoicedQty >= totalOrderedQty) {
            invoicingStatus = 'fully_invoiced';
          } else if (totalInvoicedQty > 0) {
            invoicingStatus = 'partially_invoiced';
          }

          const order = await db.orders.get(orderId);
          const existingInvoicedTotal = order?.invoicedTotal || 0;

          await db.orders.update(orderId, {
            invoicingStatus,
            invoicedTotal: Math.max(0, existingInvoicedTotal - (invoice.grandTotal || 0))
          });
        }

        // 2. Revert Contact Balance
        if (invoice.contactId) {
          const contact = await db.contacts.get(invoice.contactId);
          if (contact) {
            let newBalance = contact.balance;
            if (invoice.type === 'sales') {
              newBalance = contact.balance - invoice.grandTotal;
            } else {
              newBalance = contact.balance + invoice.grandTotal;
            }
            await db.contacts.update(invoice.contactId, {
              balance: newBalance,
              updatedAt: new Date()
            });
          }
        }

        // 3. Revert stock across variants if deducted
        if (invoice.isStockDeducted) {
          const isSales = invoice.type === 'sales';
          for (const item of items) {
            if (item.productId) {
              await this.applyItemStockMovement(
                {
                  productId: item.productId,
                  quantity: item.quantity,
                  color: item.color,
                  size: item.size,
                  productName: item.productName
                },
                isSales,
                invoice.invoiceNumber,
                new Date(invoice.date),
                true // reverse = true to restore stock
              );
            }
          }
        }

        // Clean up any inventory logs associated with this deleted invoice
        const relatedLogs = await db.inventoryLogs
          .filter(log => log.description?.includes(invoice.invoiceNumber))
          .toArray();
        for (const l of relatedLogs) {
          if (l.id) await db.inventoryLogs.delete(l.id);
        }
      }

      // 4. Delete items and invoice
      await db.invoiceItems.where('invoiceId').equals(id).delete();
      await db.invoices.delete(id);
    });
  },

  async getInvoice(id: number) {
    const invoice = await db.invoices.get(id);
    if (!invoice) return null;
    const items = await db.invoiceItems.where('invoiceId').equals(id).toArray();
    const contact = invoice.contactId ? await db.contacts.get(invoice.contactId) : null;
    const order = invoice.orderId ? await db.orders.get(invoice.orderId) : null;
    return { ...invoice, items, contact, order };
  },

  async updateInvoiceStatus(id: number, status: InvoiceStatus) {
    if (status === 'cancelled') {
      return await this.cancelInvoice(id);
    }

    return await db.transaction('rw', [db.invoices, db.contacts], async () => {
      const invoice = await db.invoices.get(id);
      if (!invoice) return;

      const prevStatus = invoice.status;
      if (prevStatus === status) return;

      await db.invoices.update(id, { status, updatedAt: new Date() });

      // If transitioning from draft to issued, apply balance
      if (prevStatus === 'draft' && status === 'issued' && invoice.contactId) {
        const contact = await db.contacts.get(invoice.contactId);
        if (contact) {
          const delta = invoice.type === 'sales' ? invoice.grandTotal : -invoice.grandTotal;
          await db.contacts.update(invoice.contactId, { balance: contact.balance + delta });
        }
      }
    });
  },

  async clearAllStockMovements() {
    return await db.inventoryLogs.clear();
  },

  async resetInvoicesAndStockMovements(options?: {
    resetStockMovements?: boolean;
    resetOrdersInvoicing?: boolean;
    resetContactBalances?: boolean;
  }) {
    const resetStock = options?.resetStockMovements !== false;
    const resetOrders = options?.resetOrdersInvoicing !== false;
    const resetContacts = options?.resetContactBalances !== false;

    return await db.transaction('rw', [
      db.invoices,
      db.invoiceItems,
      db.inventoryLogs,
      db.orders,
      db.orderItems,
      db.contacts,
      db.products
    ], async () => {
      // 1. Clear all invoices and invoice items
      await db.invoices.clear();
      await db.invoiceItems.clear();

      // 2. Clear inventory logs if requested
      if (resetStock) {
        await db.inventoryLogs.clear();
      }

      // 3. Reset order item invoiced quantities and order invoicing status
      if (resetOrders) {
        const orderItems = await db.orderItems.toArray();
        for (const oi of orderItems) {
          if (oi.id) {
            await db.orderItems.update(oi.id, { invoicedQuantity: 0 });
          }
        }

        const orders = await db.orders.toArray();
        for (const o of orders) {
          if (o.id) {
            await db.orders.update(o.id, {
              invoicingStatus: 'not_invoiced',
              invoicedTotal: 0
            });
          }
        }
      }

      // 4. Reset contact balances if requested
      if (resetContacts) {
        const contacts = await db.contacts.toArray();
        for (const c of contacts) {
          if (c.id) {
            await db.contacts.update(c.id, { balance: 0, updatedAt: new Date() });
          }
        }
      }
    });
  },

  /**
   * Resets all movement and transactional data (stock movements, financial transactions,
   * contact balances, TDHP journal entries, invoices, waybills, work orders, HR logs)
   * EXCEPT for orders created today (and their order items / linked work orders).
   * Master cards (products, contacts, TDHP accounts, recipes, employees, templates) are KEPT intact.
   */
  async resetExceptTodayOrders(): Promise<{
    keptOrdersCount: number;
    deletedOrdersCount: number;
    keptWorkOrdersCount: number;
    deletedWorkOrdersCount: number;
  }> {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();

    const isTodayDate = (d: Date | string | number | undefined): boolean => {
      if (!d) return false;
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return false;
      return (
        dateObj.getFullYear() === todayYear &&
        dateObj.getMonth() === todayMonth &&
        dateObj.getDate() === todayDay
      );
    };

    return await db.transaction('rw', [
      db.orders,
      db.orderItems,
      db.inventoryLogs,
      db.transactions,
      db.journalEntries,
      db.collectionReceipts,
      db.checks,
      db.invoices,
      db.invoiceItems,
      db.waybills,
      db.waybillItems,
      db.workOrders,
      db.products,
      db.contacts,
      db.accounts,
      db.cashBoxes,
      db.bankAccounts,
      db.attendanceRecords,
      db.leaveRequests,
      db.payrollRecords,
      db.advanceRequests,
      db.auditLogs,
      db.settings
    ], async () => {
      // 1. Mark movements as reset in settings
      const currentSettings = await db.settings.get('global_barcode');
      if (currentSettings) {
        await db.settings.update('global_barcode', { movementsReset: true } as any);
      }

      // 2. Identify orders created today
      const allOrders = await db.orders.toArray();
      const keptOrders = allOrders.filter(o => isTodayDate(o.date) || isTodayDate(o.createdAt));
      const keptOrderIds = new Set(keptOrders.map(o => o.id).filter(Boolean) as number[]);
      const deletedOrders = allOrders.filter(o => !o.id || !keptOrderIds.has(o.id));

      const deletedOrderIds = deletedOrders.map(o => o.id).filter(Boolean) as number[];
      if (deletedOrderIds.length > 0) {
        await db.orders.bulkDelete(deletedOrderIds);
      }

      // 3. Delete order items for deleted orders
      const allOrderItems = await db.orderItems.toArray();
      const orderItemsToDelete = allOrderItems.filter(oi => !keptOrderIds.has(oi.orderId));
      if (orderItemsToDelete.length > 0) {
        const itemIdsToDelete = orderItemsToDelete.map(oi => oi.id).filter(Boolean) as number[];
        await db.orderItems.bulkDelete(itemIdsToDelete);
      }

      // 4. Handle work orders
      const allWorkOrders = await db.workOrders.toArray();
      const keptWorkOrders = allWorkOrders.filter(wo => {
        if (wo.orderId && keptOrderIds.has(wo.orderId)) return true;
        if (isTodayDate(wo.createdAt) || isTodayDate(wo.orderDate)) return true;
        return false;
      });
      const keptWoIds = new Set(keptWorkOrders.map(wo => wo.id).filter(Boolean) as number[]);
      const workOrdersToDelete = allWorkOrders.filter(wo => !wo.id || !keptWoIds.has(wo.id));

      if (workOrdersToDelete.length > 0) {
        const woIdsToDelete = workOrdersToDelete.map(wo => wo.id).filter(Boolean) as number[];
        await db.workOrders.bulkDelete(woIdsToDelete);
      }

      // 5. Clear all movement / transaction logs
      await db.inventoryLogs.clear();
      await db.transactions.clear();
      await db.journalEntries.clear();
      await db.collectionReceipts.clear();
      await db.checks.clear();
      await db.invoices.clear();
      await db.invoiceItems.clear();
      await db.waybills.clear();
      await db.waybillItems.clear();
      await db.attendanceRecords.clear();
      await db.leaveRequests.clear();
      await db.payrollRecords.clear();
      await db.advanceRequests.clear();
      await db.auditLogs.clear();

      // 6. Reset Product Stocks to 0 (Keep product master cards!)
      const products = await db.products.toArray();
      for (const p of products) {
        if (!p.id) continue;
        const updatedVariants = p.variantBarcodes?.map(v => ({ ...v, stock: 0 }));
        await db.products.update(p.id, {
          stock: 0,
          variantBarcodes: updatedVariants
        });
      }

      // 7. Reset Contact Financial Balances to 0 (Keep contact master cards!)
      const contacts = await db.contacts.toArray();
      for (const c of contacts) {
        if (!c.id) continue;
        await db.contacts.update(c.id, {
          balance: 0,
          updatedAt: new Date()
        });
      }

      // 8. Reset CashBox and BankAccount balances to 0 (Keep definitions!)
      const cashBoxes = await db.cashBoxes.toArray();
      for (const cb of cashBoxes) {
        if (cb.id) {
          await db.cashBoxes.update(cb.id, { balance: 0 });
        }
      }

      const bankAccounts = await db.bankAccounts.toArray();
      for (const ba of bankAccounts) {
        if (ba.id) {
          await db.bankAccounts.update(ba.id, { balance: 0 });
        }
      }

      return {
        keptOrdersCount: keptOrders.length,
        deletedOrdersCount: deletedOrders.length,
        keptWorkOrdersCount: keptWorkOrders.length,
        deletedWorkOrdersCount: workOrdersToDelete.length
      };
    });
  },

  // --- Waybill Management (İrsaliye & Sevkiyat Yönetimi) ---
  async generateWaybillNumber(type: 'sales' | 'purchase'): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = type === 'sales' ? `IRS-${year}-` : `GIR-${year}-`;
    const count = await db.waybills.where('type').equals(type).count();
    const nextSeq = (count + 1).toString().padStart(6, '0');
    return `${prefix}${nextSeq}`;
  },

  async getPendingOrdersForWaybill(contactId?: number, orderType: 'sales' | 'purchase' = 'sales') {
    const allOrders = contactId 
      ? await db.orders.where('contactId').equals(contactId).filter(o => o.type === orderType).toArray()
      : await db.orders.where('type').equals(orderType).toArray();

    const openOrders = allOrders.filter(o => o.status !== 'cancelled' && o.status !== 'completed');

    const result = [];
    for (const order of openOrders) {
      const items = await db.orderItems.where('orderId').equals(order.id!).toArray();
      const itemsWithRemaining = items.map(item => {
        const shippedQty = item.shippedQuantity || 0;
        const remainingQty = Math.max(0, item.quantity - shippedQty);
        return {
          ...item,
          shippedQuantity: shippedQty,
          remainingQuantity: remainingQty
        };
      }).filter(it => it.remainingQuantity > 0);

      if (itemsWithRemaining.length > 0) {
        result.push({
          ...order,
          items: itemsWithRemaining
        });
      }
    }

    return result;
  },

  async createWaybill(
    waybillData: Omit<Waybill, 'id'>,
    items: Omit<WaybillItem, 'id' | 'waybillId'>[]
  ) {
    return await db.transaction('rw', [
      db.waybills,
      db.waybillItems,
      db.orders,
      db.orderItems,
      db.inventoryLogs,
      db.products,
      db.assortmentTemplates
    ], async () => {
      // 1. Add Waybill
      const waybillId = await db.waybills.add({
        ...waybillData,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Waybill);

      // 2. Add Waybill Items
      const itemsWithWaybillId = items.map(item => ({
        ...item,
        waybillId
      }));
      await db.waybillItems.bulkAdd(itemsWithWaybillId as WaybillItem[]);

      // 3. Handle Order Shipment link
      if (waybillData.orderId) {
        const orderId = waybillData.orderId;
        const allOrderItems = await db.orderItems.where('orderId').equals(orderId).toArray();

        for (const item of items) {
          if (item.orderItemId) {
            const targetOrderItem = allOrderItems.find(oi => oi.id === item.orderItemId);
            if (targetOrderItem) {
              const prevShipped = targetOrderItem.shippedQuantity || 0;
              const newShipped = prevShipped + item.quantity;
              await db.orderItems.update(targetOrderItem.id!, {
                shippedQuantity: newShipped
              });
              targetOrderItem.shippedQuantity = newShipped;
            }
          }
        }

        const totalOrderedQty = allOrderItems.reduce((sum, oi) => sum + oi.quantity, 0);
        const totalShippedQty = allOrderItems.reduce((sum, oi) => sum + (oi.shippedQuantity || 0), 0);

        let orderStatus: OrderStatus = 'partially_shipped';
        if (totalShippedQty >= totalOrderedQty) {
          orderStatus = 'completed';
        } else if (totalShippedQty === 0) {
          orderStatus = 'confirmed';
        }

        await db.orders.update(orderId, { status: orderStatus });
      }

      // 4. Variant-Aware Stock Movement (if isStockDeducted !== false and status !== 'draft')
      if (waybillData.isStockDeducted !== false && waybillData.status !== 'draft') {
        const isSales = waybillData.type === 'sales';
        for (const item of items) {
          if (item.productId) {
            await this.applyItemStockMovement(
              {
                productId: item.productId,
                quantity: item.quantity,
                color: item.color,
                size: item.size,
                productName: item.productName
              },
              isSales,
              waybillData.waybillNumber,
              new Date(waybillData.dispatchDate || waybillData.date),
              false
            );
          }
        }
      }

      return waybillId;
    });
  },

  async cancelWaybill(id: number, reason?: string) {
    return await db.transaction('rw', [
      db.waybills,
      db.waybillItems,
      db.orders,
      db.orderItems,
      db.inventoryLogs,
      db.products,
      db.assortmentTemplates
    ], async () => {
      const waybill = await db.waybills.get(id);
      if (!waybill) return;
      if (waybill.status === 'cancelled') return;

      // Check if waybill is already invoiced
      if (waybill.invoicedStatus === 'invoiced') {
        throw new Error(`Bu irsaliye faturalandırılmıştır (${waybill.invoiceNumber || 'Bağlı Fatura'}). İrsaliyeyi iptal etmek için lütfen önce faturayı iptal ediniz.`);
      }

      const items = await db.waybillItems.where('waybillId').equals(id).toArray();

      // 1. Revert order item shipped quantities
      if (waybill.orderId) {
        const orderId = waybill.orderId;
        const allOrderItems = await db.orderItems.where('orderId').equals(orderId).toArray();

        for (const item of items) {
          if (item.orderItemId) {
            const targetOrderItem = allOrderItems.find(oi => oi.id === item.orderItemId);
            if (targetOrderItem) {
              const prevShipped = targetOrderItem.shippedQuantity || 0;
              const newShipped = Math.max(0, prevShipped - item.quantity);
              await db.orderItems.update(targetOrderItem.id!, {
                shippedQuantity: newShipped
              });
              targetOrderItem.shippedQuantity = newShipped;
            }
          }
        }

        const totalOrderedQty = allOrderItems.reduce((sum, oi) => sum + oi.quantity, 0);
        const totalShippedQty = allOrderItems.reduce((sum, oi) => sum + (oi.shippedQuantity || 0), 0);

        let orderStatus: OrderStatus = 'partially_shipped';
        if (totalShippedQty >= totalOrderedQty) {
          orderStatus = 'completed';
        } else if (totalShippedQty === 0) {
          orderStatus = 'confirmed';
        }

        await db.orders.update(orderId, { status: orderStatus });
      }

      // 2. Revert stock if deducted and was issued
      if (waybill.isStockDeducted !== false && waybill.status === 'issued') {
        const isSales = waybill.type === 'sales';
        for (const item of items) {
          if (item.productId) {
            await this.applyItemStockMovement(
              {
                productId: item.productId,
                quantity: item.quantity,
                color: item.color,
                size: item.size,
                productName: item.productName
              },
              isSales,
              waybill.waybillNumber,
              new Date(),
              true
            );
          }
        }
      }

      // 3. Mark as cancelled
      const formattedDate = new Date().toLocaleDateString('tr-TR');
      const formattedTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const cancelNote = reason 
        ? `[İPTAL EDİLDİ: ${formattedDate} ${formattedTime} - Sebep: ${reason}]` 
        : `[İPTAL EDİLDİ: ${formattedDate} ${formattedTime}]`;

      await db.waybills.update(id, {
        status: 'cancelled',
        updatedAt: new Date(),
        notes: waybill.notes ? `${waybill.notes}\n${cancelNote}` : cancelNote
      });
    });
  },

  async deleteWaybill(id: number) {
    return await db.transaction('rw', [
      db.waybills,
      db.waybillItems,
      db.orders,
      db.orderItems,
      db.inventoryLogs,
      db.products,
      db.assortmentTemplates
    ], async () => {
      const waybill = await db.waybills.get(id);
      if (!waybill) return;

      if (waybill.invoicedStatus === 'invoiced') {
        throw new Error(`Bu irsaliye faturalandırılmıştır (${waybill.invoiceNumber || 'Bağlı Fatura'}). İrsaliyeyi silmek için lütfen önce bağlı faturayı iptal ediniz.`);
      }

      const items = await db.waybillItems.where('waybillId').equals(id).toArray();

      if (waybill.status === 'issued') {
        if (waybill.orderId) {
          const orderId = waybill.orderId;
          const allOrderItems = await db.orderItems.where('orderId').equals(orderId).toArray();

          for (const item of items) {
            if (item.orderItemId) {
              const targetOrderItem = allOrderItems.find(oi => oi.id === item.orderItemId);
              if (targetOrderItem) {
                const prevShipped = targetOrderItem.shippedQuantity || 0;
                const newShipped = Math.max(0, prevShipped - item.quantity);
                await db.orderItems.update(targetOrderItem.id!, {
                  shippedQuantity: newShipped
                });
                targetOrderItem.shippedQuantity = newShipped;
              }
            }
          }

          const totalOrderedQty = allOrderItems.reduce((sum, oi) => sum + oi.quantity, 0);
          const totalShippedQty = allOrderItems.reduce((sum, oi) => sum + (oi.shippedQuantity || 0), 0);

          let orderStatus: OrderStatus = 'partially_shipped';
          if (totalShippedQty >= totalOrderedQty) {
            orderStatus = 'completed';
          } else if (totalShippedQty === 0) {
            orderStatus = 'confirmed';
          }

          await db.orders.update(orderId, { status: orderStatus });
        }

        if (waybill.isStockDeducted !== false) {
          const isSales = waybill.type === 'sales';
          for (const item of items) {
            if (item.productId) {
              await this.applyItemStockMovement(
                {
                  productId: item.productId,
                  quantity: item.quantity,
                  color: item.color,
                  size: item.size,
                  productName: item.productName
                },
                isSales,
                waybill.waybillNumber,
                new Date(waybill.date),
                true
              );
            }
          }
        }

        const relatedLogs = await db.inventoryLogs
          .filter(log => log.description?.includes(waybill.waybillNumber))
          .toArray();
        for (const l of relatedLogs) {
          if (l.id) await db.inventoryLogs.delete(l.id);
        }
      }

      await db.waybillItems.where('waybillId').equals(id).delete();
      await db.waybills.delete(id);
    });
  },

  async getWaybill(id: number) {
    const waybill = await db.waybills.get(id);
    if (!waybill) return null;
    const items = await db.waybillItems.where('waybillId').equals(id).toArray();
    const contact = waybill.contactId ? await db.contacts.get(waybill.contactId) : null;
    const order = waybill.orderId ? await db.orders.get(waybill.orderId) : null;
    return { ...waybill, items, contact, order };
  },

  async updateWaybillStatus(id: number, status: WaybillStatus) {
    if (status === 'cancelled') {
      return await this.cancelWaybill(id);
    }

    return await db.transaction('rw', [
      db.waybills,
      db.waybillItems,
      db.products,
      db.inventoryLogs,
      db.assortmentTemplates
    ], async () => {
      const waybill = await db.waybills.get(id);
      if (!waybill) return;

      const prevStatus = waybill.status;
      if (prevStatus === status) return;

      await db.waybills.update(id, { status, updatedAt: new Date() });

      // If transition from draft to issued and stock deduction enabled
      if (prevStatus === 'draft' && status === 'issued' && waybill.isStockDeducted !== false) {
        const items = await db.waybillItems.where('waybillId').equals(id).toArray();
        const isSales = waybill.type === 'sales';
        for (const item of items) {
          if (item.productId) {
            await this.applyItemStockMovement(
              {
                productId: item.productId,
                quantity: item.quantity,
                color: item.color,
                size: item.size,
                productName: item.productName
              },
              isSales,
              waybill.waybillNumber,
              new Date(waybill.dispatchDate || waybill.date),
              false
            );
          }
        }
      }
    });
  },

  async resetWaybillsAndShipments(options?: {
    resetStockMovements?: boolean;
    resetOrdersShipment?: boolean;
  }) {
    const resetStock = options?.resetStockMovements !== false;
    const resetOrders = options?.resetOrdersShipment !== false;

    return await db.transaction('rw', [
      db.waybills,
      db.waybillItems,
      db.inventoryLogs,
      db.orders,
      db.orderItems,
      db.products
    ], async () => {
      await db.waybills.clear();
      await db.waybillItems.clear();

      if (resetOrders) {
        const orderItems = await db.orderItems.toArray();
        for (const oi of orderItems) {
          if (oi.id) {
            await db.orderItems.update(oi.id, { shippedQuantity: 0 });
          }
        }

        const orders = await db.orders.toArray();
        for (const o of orders) {
          if (o.id && (o.status === 'completed' || o.status === 'partially_shipped')) {
            await db.orders.update(o.id, { status: 'confirmed' });
          }
        }
      }

      if (resetStock) {
        const waybillLogs = await db.inventoryLogs
          .filter(l => l.description?.includes('İrsaliye') || l.description?.includes('IRS-') || l.description?.includes('GIR-'))
          .toArray();
        for (const l of waybillLogs) {
          if (l.id) await db.inventoryLogs.delete(l.id);
        }
      }
    });
  }
};

