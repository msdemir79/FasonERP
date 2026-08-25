import Dexie, { type Table } from 'dexie';
import type { Contact, Product, Recipe, WorkOrder, Transaction, InventoryLog, AssortmentTemplate, AppSettings, Order, OrderItem, Invoice, InvoiceItem } from './types';

export class ProERPDatabase extends Dexie {
  contacts!: Table<Contact>;
  products!: Table<Product>;
  recipes!: Table<Recipe>;
  workOrders!: Table<WorkOrder>;
  transactions!: Table<Transaction>;
  inventoryLogs!: Table<InventoryLog>;
  assortmentTemplates!: Table<AssortmentTemplate>;
  settings!: Table<AppSettings>;
  orders!: Table<Order>;
  orderItems!: Table<OrderItem>;
  invoices!: Table<Invoice>;
  invoiceItems!: Table<InvoiceItem>;

  constructor() {
    super('ProERPDatabase');
    this.version(8).stores({
      contacts: '++id, name, type',
      products: '++id, code, name, isRawMaterial, assortmentTemplateId, categoryType',
      recipes: '++id, productId, targetColor',
      workOrders: '++id, productId, orderId, status, currentStage, createdAt, barcode',
      transactions: '++id, contactId, type, date, category',
      inventoryLogs: '++id, productId, type, date',
      assortmentTemplates: '++id, name',
      settings: 'id',
      orders: '++id, type, orderNumber, contactId, status, date',
      orderItems: '++id, orderId, productId',
      invoices: '++id, type, invoiceNumber, contactId, orderId, date, status, paymentStatus',
      invoiceItems: '++id, invoiceId, productId, orderItemId'
    });
  }
}

export const db = new ProERPDatabase();

// Seed data
export async function seedDatabase() {
  // Initialize default settings if not exists
  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.add({
      id: 'global_barcode',
      barcodeType: 'CODE-128',
      barcodePrefix: '869',
      nextBarcodeSequence: 1000000
    });
  }

  // Seed standard assortment templates if none exist
  const templateCount = await db.assortmentTemplates.count();
  if (templateCount === 0) {
    await db.assortmentTemplates.bulkAdd([
      {
        name: "Erkek Standart 40-45 (12'li Koli)",
        items: [
          { size: "40", quantity: 1 },
          { size: "41", quantity: 2 },
          { size: "42", quantity: 3 },
          { size: "43", quantity: 3 },
          { size: "44", quantity: 2 },
          { size: "45", quantity: 1 }
        ]
      },
      {
        name: "Kadın Standart 36-40 (12'li Koli)",
        items: [
          { size: "36", quantity: 1 },
          { size: "37", quantity: 3 },
          { size: "38", quantity: 4 },
          { size: "39", quantity: 3 },
          { size: "40", quantity: 1 }
        ]
      },
      {
        name: "Taban & Fuspet Serisi 36-45 (10 Çift)",
        items: [
          { size: "36", quantity: 1 },
          { size: "37", quantity: 1 },
          { size: "38", quantity: 1 },
          { size: "39", quantity: 1 },
          { size: "40", quantity: 1 },
          { size: "41", quantity: 1 },
          { size: "42", quantity: 1 },
          { size: "43", quantity: 1 },
          { size: "44", quantity: 1 },
          { size: "45", quantity: 1 }
        ]
      },
      {
        name: "Çocuk 26-35 (10'lu Koli)",
        items: [
          { size: "26", quantity: 1 },
          { size: "27", quantity: 1 },
          { size: "28", quantity: 1 },
          { size: "29", quantity: 1 },
          { size: "30", quantity: 1 },
          { size: "31", quantity: 1 },
          { size: "32", quantity: 1 },
          { size: "33", quantity: 1 },
          { size: "34", quantity: 1 },
          { size: "35", quantity: 1 }
        ]
      }
    ]);
  }
  
  return;
}
