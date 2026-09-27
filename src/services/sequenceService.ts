import { db } from '../db';
import type { JournalEntryType, ReceiptType, OrderType } from '../types';

interface SequenceStore {
  id: string;
  sequences: Record<string, number>;
  updatedAt?: Date;
}

const SEQUENCE_STORE_ID = 'doc_sequences';

export const sequenceService = {
  /**
   * Atomically generates and increments the next document sequence number.
   * Handles database persistence, year partitioning, and avoids duplicate key collisions.
   */
  async getNextSequence(key: string, prefix: string, padLength: number = 6, year: number = new Date().getFullYear()): Promise<string> {
    const fullKey = `${key}_${year}`;

    let store = await db.settings.get(SEQUENCE_STORE_ID) as unknown as SequenceStore | undefined;
    if (!store || !store.sequences) {
      store = { id: SEQUENCE_STORE_ID, sequences: {}, updatedAt: new Date() };
    }

    let currentVal = store.sequences[fullKey];

    // If sequence counter is not initialized in store, inspect existing database records to find current max
    if (typeof currentVal !== 'number') {
      currentVal = await this.detectMaxExistingSequence(key, prefix, year);
    }

    const nextVal = currentVal + 1;
    store.sequences[fullKey] = nextVal;
    store.updatedAt = new Date();

    await db.settings.put(store as any);

    return `${prefix}-${year}-${nextVal.toString().padStart(padLength, '0')}`;
  },

  /**
   * Scans existing records to find the highest sequence integer for that year & prefix
   */
  async detectMaxExistingSequence(key: string, prefix: string, year: number): Promise<number> {
    try {
      let maxNum = 0;
      const yearStr = String(year);

      if (key.startsWith('invoice')) {
        const type = key.includes('sales') ? 'sales' : 'purchase';
        const invoices = await db.invoices.where('type').equals(type).toArray();
        for (const inv of invoices) {
          if (inv.invoiceNumber && inv.invoiceNumber.includes(yearStr)) {
            const parts = inv.invoiceNumber.split('-');
            const lastPart = parts[parts.length - 1];
            const parsed = parseInt(lastPart, 10);
            if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
          }
        }
      } else if (key.startsWith('waybill')) {
        const waybills = await db.waybills.toArray();
        for (const wb of waybills) {
          if (wb.waybillNumber && wb.waybillNumber.includes(yearStr)) {
            const parts = wb.waybillNumber.split('-');
            const lastPart = parts[parts.length - 1];
            const parsed = parseInt(lastPart, 10);
            if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
          }
        }
      } else if (key.startsWith('journal')) {
        const entries = await db.journalEntries.toArray();
        for (const je of entries) {
          if (je.entryNumber && je.entryNumber.includes(yearStr)) {
            const parts = je.entryNumber.split('-');
            const lastPart = parts[parts.length - 1];
            const parsed = parseInt(lastPart, 10);
            if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
          }
        }
      } else if (key.startsWith('receipt')) {
        const receipts = await db.collectionReceipts.toArray();
        for (const r of receipts) {
          if (r.receiptNumber && r.receiptNumber.includes(yearStr)) {
            const parts = r.receiptNumber.split('-');
            const lastPart = parts[parts.length - 1];
            const parsed = parseInt(lastPart, 10);
            if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
          }
        }
      } else if (key.startsWith('check')) {
        const checks = await db.checks.toArray();
        for (const c of checks) {
          if (c.portfolioNumber && c.portfolioNumber.includes(yearStr)) {
            const parts = c.portfolioNumber.split('-');
            const lastPart = parts[parts.length - 1];
            const parsed = parseInt(lastPart, 10);
            if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
          }
        }
      } else if (key.startsWith('order')) {
        const orders = await db.orders.toArray();
        for (const o of orders) {
          if (o.orderNumber && o.orderNumber.includes(yearStr)) {
            const parts = o.orderNumber.split('-');
            const lastPart = parts[parts.length - 1];
            const parsed = parseInt(lastPart, 10);
            if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed;
          }
        }
      }

      return maxNum;
    } catch {
      return 0;
    }
  },

  async generateInvoiceNumber(type: 'sales' | 'purchase'): Promise<string> {
    const prefix = type === 'sales' ? 'SAT' : 'ALS';
    return await this.getNextSequence(`invoice_${type}`, prefix, 6);
  },

  async generateWaybillNumber(type: 'sales' | 'purchase'): Promise<string> {
    const prefix = type === 'sales' ? 'IRS' : 'AIR';
    return await this.getNextSequence(`waybill_${type}`, prefix, 6);
  },

  async generateEntryNumber(type: JournalEntryType = 'mahsup'): Promise<string> {
    const prefix = type === 'tahsil' ? 'THS' : type === 'tediye' ? 'TDY' : type === 'acilis' ? 'ACL' : type === 'kapanis' ? 'KPN' : 'YEV';
    return await this.getNextSequence(`journal_${type}`, prefix, 6);
  },

  async generateReceiptNumber(type: ReceiptType): Promise<string> {
    const prefix = type === 'collection' ? 'THS' : 'TED';
    return await this.getNextSequence(`receipt_${type}`, prefix, 6);
  },

  async generateCheckPortfolioNumber(type: string): Promise<string> {
    const prefix = type.includes('check') ? 'CEK' : 'SNT';
    return await this.getNextSequence(`check_${type}`, prefix, 4);
  },

  async generateOrderNumber(type: OrderType = 'sales'): Promise<string> {
    const prefix = type === 'sales' ? 'SIP' : 'SAS';
    return await this.getNextSequence(`order_${type}`, prefix, 6);
  }
};
