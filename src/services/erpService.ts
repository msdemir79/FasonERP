import { db } from '../db';
import type { 
  Contact,
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
  InvoiceScenario
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

export const erpService = {
  // --- Accounting & Contacts ---
  async addContact(contact: Omit<Contact, 'id'>) {
    return await db.transaction('rw', [db.contacts, db.transactions], async () => {
      let code = contact.code?.trim();
      if (!code) {
        const prefix = contact.type === 'customer' ? 'MUS-' : contact.type === 'supplier' ? 'TED-' : 'CAR-';
        const allContacts = await db.contacts.toArray();
        const nextNum = (allContacts.length + 1).toString().padStart(4, '0');
        code = `${prefix}${nextNum}`;
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

      return contactId;
    });
  },

  async updateContact(id: number, contact: Partial<Contact>) {
    return await db.contacts.update(id, {
      ...contact,
      updatedAt: new Date()
    });
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
    color?: string;
    size?: string;
    targetDate?: Date;
    notes?: string;
    operator?: string;
  }) {
    return await db.transaction('rw', [db.workOrders, db.recipes, db.products], async () => {
      const recipe = await db.recipes.where('productId').equals(data.productId).first();
      
      // Determine initial material status
      let materialStatus: MaterialReadinessStatus = 'no_recipe';
      if (recipe && recipe.ingredients.length > 0) {
        materialStatus = 'pending_mrp';
      }

      const defaultStages = this.generateDefaultStages();

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
        color: data.color,
        size: data.size,
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
    return await db.transaction('rw', [db.orders, db.orderItems, db.workOrders, db.products, db.contacts, db.recipes], async () => {
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
          color: item.color,
          size: item.size,
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
              const updatedStock = Math.max(0, raw.stock - totalNeeded);
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
    const productMap = new Map(products.map(p => [p.id!, p]));

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
      affectedWorkOrderIds: number[];
    }>();

    for (const wo of workOrdersToAnalyze) {
      const recipe = getRecipeForWO(wo.productId, wo.color);
      if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) continue;

      for (const ing of recipe.ingredients) {
        const totalIngNeeded = ing.quantity * wo.quantity;
        const ingColor = ing.color || wo.color || '';
        const key = `${ing.productId}__${ingColor}`;

        const existing = rawMaterialNeeds.get(key);
        if (existing) {
          existing.requiredQuantity += totalIngNeeded;
          if (!existing.affectedWorkOrderIds.includes(wo.id!)) {
            existing.affectedWorkOrderIds.push(wo.id!);
          }
        } else {
          rawMaterialNeeds.set(key, {
            rawMaterialId: ing.productId,
            color: ingColor || undefined,
            isMatrixMatched: ing.isMatrixMatched,
            requiredQuantity: totalIngNeeded,
            affectedWorkOrderIds: [wo.id!]
          });
        }
      }
    }

    const mrpItems: MrpRequirementItem[] = [];
    let shortageCount = 0;
    let totalShortageCost = 0;

    for (const [key, data] of rawMaterialNeeds.entries()) {
      const rawProduct = productMap.get(data.rawMaterialId);
      if (!rawProduct) continue;

      // Check variant stock if color is specified and tracked
      let currentStock = rawProduct.stock || 0;
      if (data.color && rawProduct.variantBarcodes && rawProduct.variantBarcodes.length > 0) {
        const colorVariants = rawProduct.variantBarcodes.filter(v => v.color && v.color.toLowerCase() === data.color!.toLowerCase());
        if (colorVariants.length > 0) {
          currentStock = colorVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
        }
      }

      const shortageQuantity = Math.max(0, data.requiredQuantity - currentStock);
      const buyingPrice = rawProduct.buyingPrice || 0;
      const estimatedCost = shortageQuantity * buyingPrice;

      if (shortageQuantity > 0) {
        shortageCount++;
        totalShortageCost += estimatedCost;
      }

      mrpItems.push({
        rawMaterialId: data.rawMaterialId,
        rawMaterialName: rawProduct.name,
        rawMaterialCode: rawProduct.code,
        color: data.color,
        categoryType: rawProduct.categoryType,
        isMatrixMatched: data.isMatrixMatched,
        unit: rawProduct.unit || 'Adet',
        currentStock,
        requiredQuantity: data.requiredQuantity,
        shortageQuantity,
        status: shortageQuantity > 0 ? 'shortage' : 'sufficient',
        buyingPrice,
        estimatedCost,
        workOrderCount: data.affectedWorkOrderIds.length,
        affectedWorkOrderIds: data.affectedWorkOrderIds
      });
    }

    // Sort: shortages first
    mrpItems.sort((a, b) => {
      if (a.status === 'shortage' && b.status !== 'shortage') return -1;
      if (a.status !== 'shortage' && b.status === 'shortage') return 1;
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
      for (const ing of recipe.ingredients) {
        const ingColor = ing.color || wo.color || '';
        const item = mrpItems.find(m => m.rawMaterialId === ing.productId && (m.color || '') === ingColor);
        if (item && item.status === 'shortage') {
          hasShortage = true;
          break;
        }
      }

      const newStatus: MaterialReadinessStatus = hasShortage ? 'materials_shortage' : 'materials_ready';
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

  async createPurchaseOrderFromMRP(
    shortageItems: { rawMaterialId: number; quantity: number; unitPrice?: number }[],
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

        const price = item.unitPrice !== undefined ? item.unitPrice : raw.buyingPrice;
        const lineTotal = price * item.quantity * 1.20; // 20% VAT
        subtotal += price * item.quantity;

        orderItemsData.push({
          productId: item.rawMaterialId,
          quantity: item.quantity,
          shippedQuantity: 0,
          unitPrice: price,
          taxRate: 20,
          discountRate: 0,
          total: lineTotal
        });
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

  async addProduct(product: any) {
    return await db.products.add({
      ...product,
      stock: product.stock || 0
    });
  },

  async updateProduct(id: number, product: any) {
    return await db.products.update(id, product);
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

  // --- Barcode & Settings ---
  async getBarcodeSettings(): Promise<AppSettings> {
    const settings = await db.settings.get('global_barcode');
    if (settings) return settings;
    const defaultSettings: AppSettings = {
      id: 'global_barcode',
      barcodeType: 'CODE-128',
      barcodePrefix: '869',
      nextBarcodeSequence: 1000000
    };
    await db.settings.put(defaultSettings);
    return defaultSettings;
  },

  async updateBarcodeSettings(settings: AppSettings) {
    return await db.settings.put({ ...settings, id: 'global_barcode' });
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

  async updateOrder(id: number, order: Partial<Order>, items?: Omit<OrderItem, 'id' | 'orderId'>[]) {
    return await db.transaction('rw', [db.orders, db.orderItems, db.workOrders, db.recipes, db.products, db.contacts], async () => {
      await db.orders.update(id, order);
      if (items) {
        await db.orderItems.where('orderId').equals(id).delete();
        const itemsWithOrderId = items.map(item => ({ ...item, orderId: id }));
        await db.orderItems.bulkAdd(itemsWithOrderId as OrderItem[]);
      }

      // If sales order changed to confirmed, ensure work orders are created
      if (order.status === 'confirmed' || (order.type === 'sales' && order.status !== 'cancelled')) {
        try {
          await this.createWorkOrdersFromOrder(id);
        } catch (err) {
          console.warn('İş emri senkronizasyon uyarısı:', err);
        }
      }
    });
  },

  async deleteOrder(id: number) {
    return await db.transaction('rw', [db.orders, db.orderItems], async () => {
      await db.orderItems.where('orderId').equals(id).delete();
      await db.orders.delete(id);
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
      const newStock = (product.stock || 0) + (deltaSign * item.quantity);
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
      db.contacts, 
      db.inventoryLogs, 
      db.products,
      db.assortmentTemplates
    ], async () => {
      const invoice = await db.invoices.get(id);
      if (!invoice) return;

      const items = await db.invoiceItems.where('invoiceId').equals(id).toArray();

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
  }
};

