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
  AttendancePeriodLock,
  AppUser,
  Role,
  AuditLog
} from './types';
import { INITIAL_TDHP_ACCOUNTS, INITIAL_CASH_BOXES, INITIAL_BANK_ACCOUNTS } from './data/tdhpAccounts';
import { INITIAL_ROLES } from './data/initialRoles';
import { INITIAL_USERS } from './data/initialUsers';

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
  users!: Table<AppUser>;
  roles!: Table<Role>;
  auditLogs!: Table<AuditLog>;

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

    this.version(15).stores({
      users: '++id, username, email, roleCode, status, department',
      roles: '++id, code, name, isSystem',
      auditLogs: '++id, userId, action, module, timestamp'
    });

    this.version(16).stores({
      collectionReceipts: '++id, receiptNumber, type, date, contactId, instrument, isAccounted, cashBoxId, bankAccountId'
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

      // 6. Seed Roles & Permissions
      const rolesCount = await db.roles.count();
      if (rolesCount === 0) {
        await db.roles.bulkAdd(INITIAL_ROLES as any);
      }

      // 7. Seed Users
      const usersCount = await db.users.count();
      if (usersCount === 0) {
        const seededRoles = await db.roles.toArray();
        const roleMap = new Map(seededRoles.map(r => [r.code, r.id]));
        
        const usersToSeed = INITIAL_USERS.map(u => ({
          ...u,
          roleId: roleMap.get(u.roleCode)
        }));
        await db.users.bulkAdd(usersToSeed as any);
      }

      // 8. Seed Initial Audit Logs
      const auditCount = await db.auditLogs.count();
      if (auditCount === 0) {
        const adminUser = await db.users.where('username').equals('mdemir').first();
        await db.auditLogs.bulkAdd([
          {
            userId: adminUser?.id || 1,
            userName: 'Mehmet Demir',
            userRole: 'Süper Admin / Sistem Yöneticisi',
            action: 'system',
            module: 'system',
            description: 'ProERP fabrika yönetim sistemi ve rol tabanlı yetkilendirme (RBAC) başarıyla kuruldu.',
            details: '7 adet temel sistem rolü ve departman kullanıcıları tanımlandı.',
            ipAddress: '192.168.1.100',
            timestamp: new Date('2026-09-01T08:00:00')
          },
          {
            userId: adminUser?.id || 1,
            userName: 'Mehmet Demir',
            userRole: 'Süper Admin / Sistem Yöneticisi',
            action: 'permission_change',
            module: 'users',
            description: 'Ön tanımlı departman yetki matrisleri kontrol edildi ve onaylandı.',
            ipAddress: '192.168.1.100',
            timestamp: new Date('2026-09-01T08:30:00')
          },
          {
            userId: adminUser?.id || 1,
            userName: 'Mehmet Demir',
            userRole: 'Süper Admin / Sistem Yöneticisi',
            action: 'login',
            module: 'auth',
            description: 'Sistem Yöneticisi başarıyla oturum açtı.',
            ipAddress: '192.168.1.100',
            timestamp: new Date()
          }
        ]);
      }

      // 9. Seed Initial TDHP Balanced Journal Entries if empty
      const entriesCount = await db.journalEntries.count();
      if (entriesCount === 0) {
        await db.journalEntries.bulkAdd([
          {
            entryNumber: 'YEV-2026-000001',
            entryType: 'acilis',
            date: new Date('2026-01-01'),
            description: '2026 Mali Yılı Açılış Bilançosu ve Mahsubu',
            documentType: 'opening',
            documentNumber: 'ACILIS-2026',
            totalDebit: 184580000,
            totalCredit: 184580000,
            isBalanced: true,
            status: 'approved',
            createdAt: new Date('2026-01-01T09:00:00'),
            lines: [
              { id: '1', accountCode: '100.01', accountName: 'Merkez TL Kasası', description: '2026 Devir Kasa Nakit Mevcudu', debit: 1115360, credit: 0 },
              { id: '2', accountCode: '101.01', accountName: 'Portföydeki Çekler', description: 'Portföydeki Müşteri Çekleri Devri', debit: 6303540, credit: 0 },
              { id: '3', accountCode: '102.01', accountName: 'Garanti BBVA Vadesiz TL Hesabı', description: 'Garanti BBVA Vadesiz Mevduat Devri', debit: 142850000, credit: 0 },
              { id: '4', accountCode: '102.02', accountName: 'Ziraat Bankası Ticari TL Hesabı', description: 'Ziraat Bankası Mevduat Devri', debit: 15442560, credit: 0 },
              { id: '5', accountCode: '120.01', accountName: 'Yurtiçi Müşteriler Cari Hesabı', description: 'Müşteri Cari Alacak Bakiyeleri Devri', debit: 13666725, credit: 0 },
              { id: '6', accountCode: '150.01', accountName: 'Deri ve Suni Deri Stokları', description: 'Deri Hammadde Yılbaşı Sayım Stoğu', debit: 3450000, credit: 0 },
              { id: '7', accountCode: '152.01', accountName: 'Biten Ayakkabı Mamul Deposu', description: 'Mamul Ayakkabı Depo Stoğu', debit: 1751815, credit: 0 },
              // Krediler / Pasifler
              { id: '8', accountCode: '103.01', accountName: 'Verilen Firma Çekleri', description: 'Satıcılara Verilen Vadeli Firma Çekleri Devri', debit: 0, credit: 4969152 },
              { id: '9', accountCode: '320.01', accountName: 'Deri ve Malzeme Tedarikçileri', description: 'Tedarikçi Cari Borç Bakiyeleri Devri', debit: 0, credit: 9610848 },
              { id: '10', accountCode: '500.01', accountName: 'Ödenmiş Sermaye', description: 'Şirket Tescilli Ödenmiş Ana Sermayesi', debit: 0, credit: 170000000 }
            ]
          },
          {
            entryNumber: 'YEV-2026-000002',
            entryType: 'tahsil',
            date: new Date('2026-03-15'),
            description: 'Müşteri Cari Tahsilatları ve Banka Hareketleri',
            documentType: 'collection',
            documentNumber: 'THS-2026-08',
            totalDebit: 4850000,
            totalCredit: 4850000,
            isBalanced: true,
            status: 'approved',
            createdAt: new Date('2026-03-15T14:30:00'),
            lines: [
              { id: '11', accountCode: '100.01', accountName: 'Merkez TL Kasası', description: 'Müşteri Elden Nakit Tahsilat', debit: 350000, credit: 0 },
              { id: '12', accountCode: '102.01', accountName: 'Garanti BBVA Vadesiz TL Hesabı', description: 'Müşteri Banka EFT/Havale Tahsilatı', debit: 4500000, credit: 0 },
              { id: '13', accountCode: '120.01', accountName: 'Yurtiçi Müşteriler Cari Hesabı', description: 'Yurtiçi Müşteriler Cari Hesabından Düşüm', debit: 0, credit: 4850000 }
            ]
          },
          {
            entryNumber: 'YEV-2026-000003',
            entryType: 'tediye',
            date: new Date('2026-06-20'),
            description: 'Tedarikçi Deri Hammadde Ödemesi ve Genel Fabrika Masrafları',
            documentType: 'disbursement',
            documentNumber: 'TDY-2026-14',
            totalDebit: 3200000,
            totalCredit: 3200000,
            isBalanced: true,
            status: 'approved',
            createdAt: new Date('2026-06-20T16:00:00'),
            lines: [
              { id: '14', accountCode: '320.01', accountName: 'Deri ve Malzeme Tedarikçileri', description: 'Deri Tedarikçisi Havale ile Cari Ödeme', debit: 2800000, credit: 0 },
              { id: '15', accountCode: '770.01', accountName: 'Genel Yönetim ve Fabrika Giderleri', description: 'Fabrika Elektrik ve Lojistik Hizmet Faturası', debit: 400000, credit: 0 },
              { id: '16', accountCode: '102.01', accountName: 'Garanti BBVA Vadesiz TL Hesabı', description: 'Banka Hesabından Otomatik Çıkış', debit: 0, credit: 3200000 }
            ]
          }
        ]);
      }
      // 10. Self-Healing: Repair any corrupted Turkish character sequences (e.g. zİylan -> ZİYLAN or Ziylan)
      try {
        const allContacts = await db.contacts.toArray();
        const contactIdToNameMap = new Map<number, string>();

        for (const c of allContacts) {
          if (!c.id) continue;
          let fixedName = c.name;
          let fixedTitle = c.companyTitle;
          let needsUpdate = false;

          // Repair 'zİ' or lowercase followed by uppercase İ
          if (fixedName && /[a-zğüşıöç]İ/.test(fixedName)) {
            fixedName = fixedName.replace(/([a-zğüşıöç])İ/g, '$1i');
            needsUpdate = true;
          }
          if (fixedTitle && /[a-zğüşıöç]İ/.test(fixedTitle)) {
            fixedTitle = fixedTitle.replace(/([a-zğüşıöç])İ/g, '$1i');
            needsUpdate = true;
          }

          if (needsUpdate) {
            await db.contacts.update(c.id, {
              name: fixedName,
              companyTitle: fixedTitle
            });
            contactIdToNameMap.set(c.id, fixedName);
          } else {
            contactIdToNameMap.set(c.id, c.name);
          }
        }

        // Sync collection receipts with authentic contact names
        const allReceipts = await db.collectionReceipts.toArray();
        for (const r of allReceipts) {
          if (!r.id) continue;
          let newContactName = r.contactName;
          if (r.contactId && contactIdToNameMap.has(r.contactId)) {
            newContactName = contactIdToNameMap.get(r.contactId)!;
          } else if (newContactName && /[a-zğüşıöç]İ/.test(newContactName)) {
            newContactName = newContactName.replace(/([a-zğüşıöç])İ/g, '$1i');
          }
          if (newContactName && newContactName !== r.contactName) {
            await db.collectionReceipts.update(r.id, { contactName: newContactName });
          }
        }

        // Sync checks with authentic contact names
        const allChecks = await db.checks.toArray();
        for (const chk of allChecks) {
          if (!chk.id) continue;
          let newContactName = chk.contactName;
          let newDrawer = chk.drawer;
          let changed = false;

          if (chk.contactId && contactIdToNameMap.has(chk.contactId)) {
            newContactName = contactIdToNameMap.get(chk.contactId)!;
            changed = true;
          } else if (newContactName && /[a-zğüşıöç]İ/.test(newContactName)) {
            newContactName = newContactName.replace(/([a-zğüşıöç])İ/g, '$1i');
            changed = true;
          }

          if (newDrawer && /[a-zğüşıöç]İ/.test(newDrawer)) {
            newDrawer = newDrawer.replace(/([a-zğüşıöç])İ/g, '$1i');
            changed = true;
          }

          if (changed) {
            await db.checks.update(chk.id, {
              contactName: newContactName,
              drawer: newDrawer
            });
          }
        }

        // Clean account names with corrupted sequences
        const allAccs = await db.accounts.toArray();
        for (const acc of allAccs) {
          if (!acc.id) continue;
          if (acc.name && /[a-zğüşıöç]İ/.test(acc.name)) {
            const repairedName = acc.name.replace(/([a-zğüşıöç])İ/g, '$1i');
            await db.accounts.update(acc.id, { name: repairedName });
          }
        }
      } catch (repairErr) {
        console.error('Türkçe karakter onarım hatası:', repairErr);
      }
    } finally {
      // Keep promise resolved so subsequent callers immediately return
    }
  })();

  return seedPromise;
}
