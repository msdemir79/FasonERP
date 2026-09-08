import Dexie, { type Table } from 'dexie';
import type { 
  Contact, 
  Product, 
  Recipe, 
  WorkOrder, 
  Transaction, 
  InventoryLog, 
  AssortmentTemplate, 
  AppSettings, 
  Order, 
  OrderItem, 
  Invoice, 
  InvoiceItem, 
  Waybill, 
  WaybillItem,
  Account,
  JournalEntry,
  CashBox,
  BankAccount,
  CheckNote,
  CollectionReceipt,
  Employee,
  AttendanceRecord,
  LeaveRequest, 
  PayrollRecord, 
  AdvanceRequest,
  AttendancePeriodLock
} from './types';
import { INITIAL_TDHP_ACCOUNTS, INITIAL_CASH_BOXES, INITIAL_BANK_ACCOUNTS } from './data/tdhpAccounts';

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
  waybills!: Table<Waybill>;
  waybillItems!: Table<WaybillItem>;
  accounts!: Table<Account>;
  journalEntries!: Table<JournalEntry>;
  cashBoxes!: Table<CashBox>;
  bankAccounts!: Table<BankAccount>;
  checks!: Table<CheckNote>;
  collectionReceipts!: Table<CollectionReceipt>;
  employees!: Table<Employee>;
  attendanceRecords!: Table<AttendanceRecord>;
  leaveRequests!: Table<LeaveRequest>;
  payrollRecords!: Table<PayrollRecord>;
  advanceRequests!: Table<AdvanceRequest>;
  periodLocks!: Table<AttendancePeriodLock>;

  constructor() {
    super('ProERPDatabase');
    this.version(13).stores({
      contacts: '++id, name, type, accountCode',
      products: '++id, code, name, isRawMaterial, assortmentTemplateId, categoryType, accountingCode',
      recipes: '++id, productId, targetColor',
      workOrders: '++id, productId, orderId, status, currentStage, createdAt, barcode',
      transactions: '++id, contactId, type, date, category',
      inventoryLogs: '++id, productId, type, date',
      assortmentTemplates: '++id, name',
      settings: 'id',
      orders: '++id, type, orderNumber, contactId, status, date',
      orderItems: '++id, orderId, productId',
      invoices: '++id, type, invoiceNumber, contactId, orderId, date, status, paymentStatus',
      invoiceItems: '++id, invoiceId, productId, orderItemId',
      waybills: '++id, type, waybillNumber, contactId, orderId, date, status, invoicedStatus',
      waybillItems: '++id, waybillId, productId, orderItemId',
      accounts: '++id, code, name, type, level, parentCode',
      journalEntries: '++id, entryNumber, entryType, date, documentType, documentId, isBalanced',
      cashBoxes: '++id, code, name, accountCode, currency',
      bankAccounts: '++id, bankName, iban, accountCode, currency',
      checks: '++id, type, portfolioNumber, contactId, dueDate, status',
      collectionReceipts: '++id, receiptNumber, type, date, contactId, instrument, isAccounted',
      employees: '++id, employeeCode, name, tcNo, department, position, status, sgkStatus, hireDate',
      attendanceRecords: '++id, employeeId, date, month, year, status, [employeeId+date]',
      leaveRequests: '++id, employeeId, leaveType, startDate, endDate, status, createdAt',
      payrollRecords: '++id, employeeId, month, year, sgkStatus, isAccounted, paymentStatus',
      advanceRequests: '++id, employeeId, date, month, year, status, isDeducted'
    });

    this.version(14).stores({
      periodLocks: '++id, [month+year], month, year, isLocked'
    });
  }
}

export const db = new ProERPDatabase();

// Seed concurrency lock
let seedPromise: Promise<void> | null = null;

// Seed data with deduplication & concurrency protection
export async function seedDatabase() {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      // 1. Initialize default settings if not exists
      const settingsCount = await db.settings.count();
      if (settingsCount === 0) {
        await db.settings.add({
          id: 'global_barcode',
          barcodeType: 'CODE-128',
          barcodePrefix: '869',
          nextBarcodeSequence: 1000000
        });
      }

      // 2. TDHP Accounts: Deduplicate existing, clean undefined names, and seed missing
      const allAccounts = await db.accounts.toArray();
      const seenAccountCodes = new Set<string>();
      const duplicateAccountIds: number[] = [];

      for (const acc of allAccounts) {
        const normalized = acc.code?.trim().toLowerCase();
        if (!normalized) continue;
        if (seenAccountCodes.has(normalized)) {
          if (acc.id) duplicateAccountIds.push(acc.id);
        } else {
          seenAccountCodes.add(normalized);
          // Sanitize any names or descriptions that might have 'undefined'
          let isChanged = false;
          let fixedName = acc.name;
          let fixedDesc = acc.description;
          if (fixedName && fixedName.includes('undefined')) {
            fixedName = fixedName.replace(/^undefined\s*[-–:]\s*/i, '').replace(/undefined/gi, '').trim() || `${acc.code} Hesabı`;
            isChanged = true;
          }
          if (fixedDesc && fixedDesc.includes('undefined')) {
            fixedDesc = fixedDesc.replace(/^undefined\s*[-–:]\s*/i, '').replace(/undefined/gi, '').trim();
            isChanged = true;
          }
          if (isChanged && acc.id) {
            await db.accounts.update(acc.id, { name: fixedName, description: fixedDesc });
          }
        }
      }

      if (duplicateAccountIds.length > 0) {
        await db.accounts.bulkDelete(duplicateAccountIds);
      }

      // Add any missing initial TDHP accounts
      const toAddAccounts = INITIAL_TDHP_ACCOUNTS.filter(
        a => !seenAccountCodes.has(a.code.trim().toLowerCase())
      );
      if (toAddAccounts.length > 0) {
        await db.accounts.bulkAdd(toAddAccounts as any);
      }

      // 3. Cash Boxes: Deduplicate & Seed
      const allCash = await db.cashBoxes.toArray();
      const seenCashKeys = new Set<string>();
      const duplicateCashIds: number[] = [];

      for (const c of allCash) {
        const key = (c.code || c.name || '').trim().toLowerCase();
        if (seenCashKeys.has(key)) {
          if (c.id) duplicateCashIds.push(c.id);
        } else {
          seenCashKeys.add(key);
        }
      }

      if (duplicateCashIds.length > 0) {
        await db.cashBoxes.bulkDelete(duplicateCashIds);
      }

      if (allCash.length === 0) {
        await db.cashBoxes.bulkAdd(INITIAL_CASH_BOXES as any);
      }

      // 4. Bank Accounts: Deduplicate & Seed
      const allBanks = await db.bankAccounts.toArray();
      const seenBankKeys = new Set<string>();
      const duplicateBankIds: number[] = [];

      for (const b of allBanks) {
        const key = (b.iban || `${b.bankName}-${b.branchName}`).trim().toLowerCase();
        if (seenBankKeys.has(key)) {
          if (b.id) duplicateBankIds.push(b.id);
        } else {
          seenBankKeys.add(key);
        }
      }

      if (duplicateBankIds.length > 0) {
        await db.bankAccounts.bulkDelete(duplicateBankIds);
      }

      if (allBanks.length === 0) {
        await db.bankAccounts.bulkAdd(INITIAL_BANK_ACCOUNTS as any);
      }

      // 5. Assortment Templates: Deduplicate & Seed
      const allTemplates = await db.assortmentTemplates.toArray();
      const seenTemplateNames = new Set<string>();
      const duplicateTemplateIds: number[] = [];

      for (const t of allTemplates) {
        const key = t.name?.trim().toLowerCase() || '';
        if (seenTemplateNames.has(key)) {
          if (t.id) duplicateTemplateIds.push(t.id);
        } else {
          seenTemplateNames.add(key);
        }
      }

      if (duplicateTemplateIds.length > 0) {
        await db.assortmentTemplates.bulkDelete(duplicateTemplateIds);
      }

      if (allTemplates.length === 0) {
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

      // 6. Seed HR Employees if none exist
      const empCount = await db.employees.count();
      if (empCount === 0) {
        const emp1 = await db.employees.add({
          employeeCode: 'PER-001',
          name: 'Mehmet Demir',
          tcNo: '28471930214',
          phone: '0532 555 10 20',
          email: 'mehmet.demir@proerp.com',
          department: 'KESİM',
          position: 'Kesimhane Şefi / Usta',
          hireDate: new Date('2023-01-15'),
          status: 'active',
          sgkStatus: 'sgk_li',
          salaryType: 'monthly_net',
          baseSalary: 38500,
          agreedNetSalary: 38500,
          paymentMethod: 'bank',
          bankName: 'Garanti BBVA',
          iban: 'TR44 0006 2000 1234 5678 9012 34',
          entitledAnnualLeave: 14,
          usedAnnualLeave: 3,
          bloodGroup: 'A Rh+',
          emergencyContact: 'Eşi Ayşe Demir (0533 111 22 33)',
          notes: 'Deri kesim kalıp tecrübesi 12 yıl.',
          createdAt: new Date()
        });

        const emp2 = await db.employees.add({
          employeeCode: 'PER-002',
          name: 'Fatma Yılmaz',
          tcNo: '19384729102',
          phone: '0544 444 33 22',
          email: 'fatma.yilmaz@proerp.com',
          department: 'SAYA',
          position: 'Saya Dikim & Çatım Ustası',
          hireDate: new Date('2023-06-01'),
          status: 'active',
          sgkStatus: 'sgk_li',
          salaryType: 'monthly_net',
          baseSalary: 32000,
          agreedNetSalary: 32000,
          paymentMethod: 'bank',
          bankName: 'İş Bankası',
          iban: 'TR55 0006 4000 9876 5432 1098 76',
          entitledAnnualLeave: 14,
          usedAnnualLeave: 5,
          bloodGroup: '0 Rh+',
          emergencyContact: 'Kardeşi Selim Yılmaz (0542 333 44 55)',
          notes: 'Saya overlok ve çift iğne uzmanı.',
          createdAt: new Date()
        });

        const emp3 = await db.employees.add({
          employeeCode: 'PER-003',
          name: 'Ali Kaya',
          tcNo: '48291039482',
          phone: '0555 777 88 99',
          department: 'MONTA',
          position: 'Monta & Kalıplama Ustası (Harici/Yevmiyeli)',
          hireDate: new Date('2024-03-10'),
          status: 'active',
          sgkStatus: 'sgk_siz',
          salaryType: 'daily',
          baseSalary: 1600,
          agreedNetSalary: 1600,
          paymentMethod: 'cash',
          entitledAnnualLeave: 0,
          usedAnnualLeave: 0,
          bloodGroup: 'B Rh+',
          emergencyContact: 'Oğlu Murat Kaya (0551 222 33 44)',
          notes: 'Günlük yevmiyeli harici monta ustası (SGK muafiyeti/yevmiyeli).',
          createdAt: new Date()
        });

        const emp4 = await db.employees.add({
          employeeCode: 'PER-004',
          name: 'Hasan Çelik',
          tcNo: '37281920391',
          phone: '0530 888 99 00',
          department: 'FİNİSAJ',
          position: 'Finisaj & Paketleme Elemanı',
          hireDate: new Date('2024-07-15'),
          status: 'active',
          sgkStatus: 'sgk_siz',
          salaryType: 'daily',
          baseSalary: 1400,
          agreedNetSalary: 1400,
          paymentMethod: 'cash',
          entitledAnnualLeave: 0,
          usedAnnualLeave: 0,
          bloodGroup: 'A Rh-',
          notes: 'Sezonluk paketleme personeli.',
          createdAt: new Date()
        });

        const emp5 = await db.employees.add({
          employeeCode: 'PER-005',
          name: 'Zeynep Aydın',
          tcNo: '58291029384',
          phone: '0536 123 45 67',
          email: 'zeynep.aydin@proerp.com',
          department: 'MUHASEBE & FİNANS',
          position: 'İK & Ön Muhasebe Uzmanı',
          hireDate: new Date('2022-09-01'),
          status: 'active',
          sgkStatus: 'sgk_li',
          salaryType: 'monthly_net',
          baseSalary: 42000,
          agreedNetSalary: 42000,
          paymentMethod: 'bank',
          bankName: 'Akbank',
          iban: 'TR33 0004 6000 5555 6666 7777 88',
          entitledAnnualLeave: 14,
          usedAnnualLeave: 2,
          bloodGroup: 'AB Rh+',
          notes: 'Personel özlük işleri ve genel muhasebe sorumlusu.',
          createdAt: new Date()
        });

        // Seed initial leave request
        await db.leaveRequests.bulkAdd([
          {
            employeeId: emp2 as number,
            employeeName: 'Fatma Yılmaz',
            leaveType: 'annual',
            startDate: '2026-09-10',
            endDate: '2026-09-12',
            days: 3,
            status: 'approved',
            reason: 'Yıllık izin kullanımı',
            approvedBy: 'Yönetim',
            createdAt: new Date()
          },
          {
            employeeId: emp1 as number,
            employeeName: 'Mehmet Demir',
            leaveType: 'excuse',
            startDate: '2026-09-15',
            endDate: '2026-09-15',
            days: 1,
            status: 'pending',
            reason: 'Resmi daire işleri mazeret izni',
            createdAt: new Date()
          }
        ]);
      }
    } finally {
      // Keep promise resolved so subsequent callers immediately return
    }
  })();

  return seedPromise;
}
