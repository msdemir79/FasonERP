import { db } from '../db';
import type { 
  CollectionReceipt, 
  CashBox, 
  BankAccount, 
  CheckNote, 
  CheckStatus, 
  PaymentInstrument, 
  ReceiptType,
  JournalEntryLine
} from '../types';
import { accountingService } from './accountingService';

export const financeService = {
  // --- Receipt Number Generation ---
  async generateReceiptNumber(type: ReceiptType): Promise<string> {
    const year = new Date().getFullYear();
    const count = await db.collectionReceipts.count();
    const prefix = type === 'collection' ? 'THS' : 'TED';
    return `${prefix}-${year}-${(count + 1).toString().padStart(6, '0')}`;
  },

  async generateCheckPortfolioNumber(type: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await db.checks.count();
    const prefix = type.includes('check') ? 'CEK' : 'SNT';
    return `${prefix}-${year}-${(count + 1).toString().padStart(4, '0')}`;
  },

  // --- Collection & Disbursement Operations ---
  async addReceipt(data: {
    type: ReceiptType;
    contactId: number;
    amount: number;
    currency?: string;
    instrument: PaymentInstrument;
    cashBoxId?: number;
    bankAccountId?: number;
    checkData?: {
      serialNumber: string;
      bankName?: string;
      branchName?: string;
      drawer: string;
      issueDate: Date;
      dueDate: Date;
      notes?: string;
    };
    description: string;
    date?: Date;
    invoiceId?: number;
    invoiceNumber?: string;
  }) {
    return await db.transaction('rw', [
      db.collectionReceipts,
      db.contacts,
      db.cashBoxes,
      db.bankAccounts,
      db.checks,
      db.transactions,
      db.journalEntries,
      db.accounts,
      db.invoices
    ], async () => {
      const contact = await db.contacts.get(data.contactId);
      if (!contact) throw new Error('Cari hesap bulunamadı');

      const receiptNumber = await this.generateReceiptNumber(data.type);
      const receiptDate = data.date ? new Date(data.date) : new Date();
      const amount = Number(data.amount);

      let checkId: number | undefined;

      // 1. Handle Check Creation if instrument is check
      if (data.instrument === 'check') {
        if (!data.checkData) throw new Error('Çek/Senet bilgileri girilmelidir.');
        const checkType = data.type === 'collection' ? 'received_check' : 'given_check';
        const portfolioNumber = await this.generateCheckPortfolioNumber(checkType);

        checkId = await db.checks.add({
          type: checkType,
          portfolioNumber,
          serialNumber: data.checkData.serialNumber,
          bankName: data.checkData.bankName,
          branchName: data.checkData.branchName,
          drawer: data.checkData.drawer || contact.name,
          contactId: contact.id!,
          contactName: contact.name,
          issueDate: new Date(data.checkData.issueDate || receiptDate),
          dueDate: new Date(data.checkData.dueDate),
          amount,
          currency: data.currency || 'TRY',
          status: 'portfolio',
          accountCode: checkType === 'received_check' ? '101.01' : '103.01',
          notes: data.checkData.notes,
          createdAt: new Date()
        });
      }

      // 2. Update CashBox or BankAccount balance
      if (data.instrument === 'cash' && data.cashBoxId) {
        const cash = await db.cashBoxes.get(data.cashBoxId);
        if (cash) {
          const newBal = data.type === 'collection' ? cash.balance + amount : cash.balance - amount;
          await db.cashBoxes.update(data.cashBoxId, { balance: Number(newBal.toFixed(2)) });
        }
      } else if (data.instrument === 'bank' && data.bankAccountId) {
        const bank = await db.bankAccounts.get(data.bankAccountId);
        if (bank) {
          const newBal = data.type === 'collection' ? bank.balance + amount : bank.balance - amount;
          await db.bankAccounts.update(data.bankAccountId, { balance: Number(newBal.toFixed(2)) });
        }
      }

      // 3. Update Contact Balance:
      // Customer: collection decreases balance (reduces debt to us)
      // Supplier: disbursement increases balance towards 0 (reduces our payable)
      let newContactBalance = contact.balance;
      if (contact.type === 'customer') {
        newContactBalance = data.type === 'collection' ? contact.balance - amount : contact.balance + amount;
      } else if (contact.type === 'supplier') {
        newContactBalance = data.type === 'disbursement' ? contact.balance + amount : contact.balance - amount;
      } else {
        newContactBalance = data.type === 'collection' ? contact.balance - amount : contact.balance + amount;
      }

      await db.contacts.update(contact.id!, {
        balance: Number(newContactBalance.toFixed(2)),
        updatedAt: new Date()
      });

      // 4. Update Invoice payment status if linked
      if (data.invoiceId) {
        const inv = await db.invoices.get(data.invoiceId);
        if (inv) {
          const prevPaid = inv.paidAmount || 0;
          const newPaid = prevPaid + amount;
          const status = newPaid >= inv.grandTotal ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
          await db.invoices.update(data.invoiceId, {
            paidAmount: Number(newPaid.toFixed(2)),
            paymentStatus: status,
            updatedAt: new Date()
          });
        }
      }

      // 5. Add to Transactions table for backward compatibility
      await db.transactions.add({
        contactId: contact.id,
        type: data.type === 'collection' ? 'income' : 'expense',
        amount,
        description: data.description || `${data.type === 'collection' ? 'Tahsilat' : 'Tediye'} - Makbuz No: ${receiptNumber}`,
        category: data.type === 'collection' ? 'Tahsilat' : 'Ödeme',
        paymentMethod: data.instrument === 'cash' ? 'cash' : data.instrument === 'bank' ? 'bank_transfer' : data.instrument === 'check' ? 'check' : 'credit_card',
        documentNo: receiptNumber,
        date: receiptDate
      });

      // 6. Save Collection Receipt record
      const receiptId = await db.collectionReceipts.add({
        receiptNumber,
        type: data.type,
        date: receiptDate,
        contactId: contact.id!,
        contactName: contact.name,
        instrument: data.instrument,
        cashBoxId: data.cashBoxId,
        bankAccountId: data.bankAccountId,
        checkId,
        amount,
        currency: data.currency || 'TRY',
        description: data.description,
        invoiceId: data.invoiceId,
        invoiceNumber: data.invoiceNumber,
        isAccounted: false,
        createdAt: new Date()
      });

      // 7. Auto-Account in TDHP Journal Entries
      try {
        await accountingService.createReceiptJournalEntry(receiptId);
      } catch (e) {
        console.error('TDHP muhasebeleştirme hatası:', e);
      }

      return receiptId;
    });
  },

  // --- Fund Transfers (Virman) ---
  async transferFunds(params: {
    fromType: 'cash' | 'bank';
    fromId: number;
    toType: 'cash' | 'bank';
    toId: number;
    amount: number;
    description: string;
    date?: Date;
  }) {
    return await db.transaction('rw', [
      db.cashBoxes,
      db.bankAccounts,
      db.transactions,
      db.journalEntries,
      db.accounts
    ], async () => {
      const amount = Number(params.amount);
      const transferDate = params.date ? new Date(params.date) : new Date();

      let fromName = '';
      let fromAccountCode = '';
      let toName = '';
      let toAccountCode = '';

      // Deduct from source
      if (params.fromType === 'cash') {
        const cash = await db.cashBoxes.get(params.fromId);
        if (!cash) throw new Error('Kaynak kasa bulunamadı');
        if (cash.balance < amount) throw new Error('Kaynak kasada yeterli bakiye bulunmamaktadır.');
        await db.cashBoxes.update(params.fromId, { balance: Number((cash.balance - amount).toFixed(2)) });
        fromName = cash.name;
        fromAccountCode = cash.accountCode || '100.01';
      } else {
        const bank = await db.bankAccounts.get(params.fromId);
        if (!bank) throw new Error('Kaynak banka hesabı bulunamadı');
        if (bank.balance < amount) throw new Error('Kaynak banka hesabında yeterli bakiye bulunmamaktadır.');
        await db.bankAccounts.update(params.fromId, { balance: Number((bank.balance - amount).toFixed(2)) });
        fromName = `${bank.bankName} (${bank.iban})`;
        fromAccountCode = bank.accountCode || '102.01';
      }

      // Add to target
      if (params.toType === 'cash') {
        const cash = await db.cashBoxes.get(params.toId);
        if (!cash) throw new Error('Hedef kasa bulunamadı');
        await db.cashBoxes.update(params.toId, { balance: Number((cash.balance + amount).toFixed(2)) });
        toName = cash.name;
        toAccountCode = cash.accountCode || '100.01';
      } else {
        const bank = await db.bankAccounts.get(params.toId);
        if (!bank) throw new Error('Hedef banka hesabı bulunamadı');
        await db.bankAccounts.update(params.toId, { balance: Number((bank.balance + amount).toFixed(2)) });
        toName = `${bank.bankName} (${bank.iban})`;
        toAccountCode = bank.accountCode || '102.01';
      }

      // Create Journal Entry for Virman:
      // BORÇ: Hedef Hesap (Kasa veya Banka)
      // ALACAK: Kaynak Hesap (Kasa veya Banka)
      const lines: JournalEntryLine[] = [
        {
          id: `line-${Date.now()}-1`,
          accountCode: toAccountCode,
          accountName: toName,
          description: `Virman Girişi: ${params.description || `${fromName} -> ${toName}`}`,
          debit: amount,
          credit: 0
        },
        {
          id: `line-${Date.now()}-2`,
          accountCode: fromAccountCode,
          accountName: fromName,
          description: `Virman Çıkışı: ${params.description || `${fromName} -> ${toName}`}`,
          debit: 0,
          credit: amount
        }
      ];

      const entryId = await accountingService.createJournalEntry({
        entryType: 'mahsup',
        date: transferDate,
        description: `Hesaplar Arası Virman: ${fromName} -> ${toName} (₺${amount.toLocaleString('tr-TR')})`,
        documentType: 'manual',
        lines,
        status: 'approved'
      });

      return entryId;
    });
  },

  // --- Check & Note Status Lifecycle ---
  async updateCheckStatus(
    checkId: number, 
    newStatus: CheckStatus, 
    options?: {
      targetBankAccountId?: number;
      targetCashBoxId?: number;
      endorsedToContactId?: number;
      notes?: string;
      date?: Date;
    }
  ) {
    return await db.transaction('rw', [
      db.checks,
      db.contacts,
      db.bankAccounts,
      db.cashBoxes,
      db.journalEntries,
      db.accounts,
      db.transactions
    ], async () => {
      const check = await db.checks.get(checkId);
      if (!check) throw new Error('Çek/Senet kaydı bulunamadı');

      const actionDate = options?.date ? new Date(options.date) : new Date();
      const amount = check.amount;

      // 1. Alınan Çek Tahsil Edildi (Portföy -> Banka veya Kasa)
      if (check.type === 'received_check' && newStatus === 'collected') {
        let destAccountCode = '102.01';
        let destAccountName = 'Bankalar';

        if (options?.targetBankAccountId) {
          const bank = await db.bankAccounts.get(options.targetBankAccountId);
          if (bank) {
            await db.bankAccounts.update(bank.id!, { balance: Number((bank.balance + amount).toFixed(2)) });
            destAccountCode = bank.accountCode || '102.01';
            destAccountName = `${bank.bankName} (${bank.iban})`;
          }
        } else if (options?.targetCashBoxId) {
          const cash = await db.cashBoxes.get(options.targetCashBoxId);
          if (cash) {
            await db.cashBoxes.update(cash.id!, { balance: Number((cash.balance + amount).toFixed(2)) });
            destAccountCode = cash.accountCode || '100.01';
            destAccountName = cash.name;
          }
        }

        // Journal Entry: BORÇ 102/100, ALACAK 101 (Alınan Çekler)
        await accountingService.createJournalEntry({
          entryType: 'mahsup',
          date: actionDate,
          description: `Alınan Çek Tahsilatı: ${check.portfolioNumber} (${check.drawer})`,
          documentType: 'check',
          documentId: check.id,
          documentNumber: check.portfolioNumber,
          lines: [
            {
              id: `line-${Date.now()}-1`,
              accountCode: destAccountCode,
              accountName: destAccountName,
              description: `Çek Tahsilat Bedeli - ${check.portfolioNumber}`,
              debit: amount,
              credit: 0
            },
            {
              id: `line-${Date.now()}-2`,
              accountCode: '101.01',
              accountName: 'Portföydeki Çekler',
              description: `Tahsil Edilen Çek Çıkışı - ${check.serialNumber}`,
              debit: 0,
              credit: amount
            }
          ]
        });
      }

      // 2. Alınan Çek Ciro Edildi (Tedarikçiye verildi)
      if (check.type === 'received_check' && newStatus === 'endorsed' && options?.endorsedToContactId) {
        const targetContact = await db.contacts.get(options.endorsedToContactId);
        if (targetContact) {
          // Reduces supplier payable (contact.balance increases towards 0)
          const newBalance = targetContact.balance + amount;
          await db.contacts.update(targetContact.id!, { balance: Number(newBalance.toFixed(2)) });

          // Journal Entry: BORÇ 320 (Satıcılar), ALACAK 101 (Alınan Çekler)
          await accountingService.createJournalEntry({
            entryType: 'mahsup',
            date: actionDate,
            description: `Çek Cirosu: ${check.portfolioNumber} -> ${targetContact.name}`,
            documentType: 'check',
            documentId: check.id,
            documentNumber: check.portfolioNumber,
            lines: [
              {
                id: `line-${Date.now()}-1`,
                accountCode: '320.01',
                accountName: `Yurtiçi Mal ve Hizmet Tedarikçileri (${targetContact.name})`,
                description: `Çek Cirosu ile Borç Ödemesi - ${check.portfolioNumber}`,
                debit: amount,
                credit: 0,
                contactId: targetContact.id
              },
              {
                id: `line-${Date.now()}-2`,
                accountCode: '101.01',
                accountName: 'Portföydeki Çekler',
                description: `Ciro Edilen Çek Çıkışı - ${check.serialNumber}`,
                debit: 0,
                credit: amount
              }
            ]
          });
        }
      }

      // 3. Verilen Çek Bankadan Ödendi (collected)
      if (check.type === 'given_check' && newStatus === 'collected' && options?.targetBankAccountId) {
        const bank = await db.bankAccounts.get(options.targetBankAccountId);
        if (bank) {
          await db.bankAccounts.update(bank.id!, { balance: Number((bank.balance - amount).toFixed(2)) });
          
          // Journal Entry: BORÇ 103 (Verilen Çekler), ALACAK 102 (Bankalar)
          await accountingService.createJournalEntry({
            entryType: 'mahsup',
            date: actionDate,
            description: `Verilen Çek Bankadan Ödendi: ${check.portfolioNumber} (${bank.bankName})`,
            documentType: 'check',
            documentId: check.id,
            documentNumber: check.portfolioNumber,
            lines: [
              {
                id: `line-${Date.now()}-1`,
                accountCode: '103.01',
                accountName: 'Verilen Firma Çekleri',
                description: `Ödenen Çek Kapanışı - ${check.serialNumber}`,
                debit: amount,
                credit: 0
              },
              {
                id: `line-${Date.now()}-2`,
                accountCode: bank.accountCode || '102.01',
                accountName: `${bank.bankName} (${bank.iban})`,
                description: `Çek Ödemesi - ${check.portfolioNumber}`,
                debit: 0,
                credit: amount
              }
            ]
          });
        }
      }

      // Update check record
      let endorsedName = check.endorsedToContactName;
      if (options?.endorsedToContactId) {
        const c = await db.contacts.get(options.endorsedToContactId);
        if (c) endorsedName = c.name;
      }

      await db.checks.update(checkId, {
        status: newStatus,
        statusChangeDate: actionDate,
        statusNotes: options?.notes || check.statusNotes,
        endorsedToContactId: options?.endorsedToContactId || check.endorsedToContactId,
        endorsedToContactName: endorsedName
      });
    });
  },

  // --- Kasa (CashBox) Düzenleme ve Silme İşlemleri ---
  async updateCashBox(id: number, data: Partial<CashBox>, syncAccount = true) {
    const existing = await db.cashBoxes.get(id);
    if (!existing) throw new Error('Kasa bulunamadı.');

    const result = await db.cashBoxes.update(id, {
      ...data,
      balance: data.balance !== undefined ? Number(data.balance) : existing.balance
    });

    // TDHP Kasa Hesabı Senkronizasyonu
    if (syncAccount && (data.name || data.code || data.accountCode)) {
      try {
        const targetAccCode = data.accountCode || existing.accountCode;
        const oldAccCode = existing.accountCode;
        const newDisplayName = `${data.code || existing.code} - ${data.name || existing.name}`;

        const account = await db.accounts.where('code').equals(oldAccCode).first();
        if (account && account.id) {
          await db.accounts.update(account.id, {
            name: newDisplayName,
            code: targetAccCode,
            currency: data.currency || existing.currency
          });
        }
      } catch (err) {
        console.error('Kasa hesabı TDHP senkronizasyon hatası:', err);
      }
    }

    return result;
  },

  async deleteCashBox(id: number, force = false) {
    const existing = await db.cashBoxes.get(id);
    if (!existing) throw new Error('Kasa bulunamadı.');

    // Bu kasaya bağlı tahsilat/tediye makbuzu var mı kontrol et
    const receiptCount = await db.collectionReceipts.where('cashBoxId').equals(id).count();
    if (receiptCount > 0 && !force) {
      throw new Error(`Bu kasaya bağlı ${receiptCount} adet makbuz kaydı bulunmaktadır. Silmek için onay vermeniz gerekmektedir.`);
    }

    // Eğer force ise veya makbuz yoksa sil
    return await db.cashBoxes.delete(id);
  },

  // --- Banka Hesabı (BankAccount) Düzenleme ve Silme İşlemleri ---
  async updateBankAccount(id: number, data: Partial<BankAccount>, syncAccount = true) {
    const existing = await db.bankAccounts.get(id);
    if (!existing) throw new Error('Banka hesabı bulunamadı.');

    const result = await db.bankAccounts.update(id, {
      ...data,
      balance: data.balance !== undefined ? Number(data.balance) : existing.balance
    });

    // TDHP Banka Hesabı Senkronizasyonu
    if (syncAccount && (data.bankName || data.branchName || data.iban || data.accountCode)) {
      try {
        const targetAccCode = data.accountCode || existing.accountCode;
        const oldAccCode = existing.accountCode;
        const newDisplayName = `${data.bankName || existing.bankName} (${data.branchName || existing.branchName || 'Merkez'})`;

        const account = await db.accounts.where('code').equals(oldAccCode).first();
        if (account && account.id) {
          await db.accounts.update(account.id, {
            name: newDisplayName,
            code: targetAccCode,
            currency: data.currency || existing.currency,
            description: `Banka Hesabı - IBAN: ${data.iban || existing.iban}`
          });
        }
      } catch (err) {
        console.error('Banka hesabı TDHP senkronizasyon hatası:', err);
      }
    }

    return result;
  },

  async deleteBankAccount(id: number, force = false) {
    const existing = await db.bankAccounts.get(id);
    if (!existing) throw new Error('Banka hesabı bulunamadı.');

    // Bu banka hesabına bağlı tahsilat/tediye makbuzu var mı kontrol et
    const receiptCount = await db.collectionReceipts.where('bankAccountId').equals(id).count();
    if (receiptCount > 0 && !force) {
      throw new Error(`Bu banka hesabına bağlı ${receiptCount} adet makbuz kaydı bulunmaktadır. Silmek için onay vermeniz gerekmektedir.`);
    }

    return await db.bankAccounts.delete(id);
  }
};
