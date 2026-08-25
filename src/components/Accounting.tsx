import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Transaction, Contact, TransactionType } from '../types';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Plus, 
  Wallet, 
  FileText, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Calendar, 
  Building2, 
  CreditCard, 
  CheckCircle2, 
  Printer, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import TransactionModal from './Accounting/TransactionModal';
import TransactionDeleteModal from './Accounting/TransactionDeleteModal';
import ContactStatementModal from './Contacts/ContactStatementModal';

export default function Accounting() {
  const transactions = useLiveQuery(() => db.transactions.toArray());
  const contacts = useLiveQuery(() => db.contacts.toArray());

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'last7' | 'this_month' | 'this_year'>('all');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<TransactionType>('income');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);

  const [statementContact, setStatementContact] = useState<Contact | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-dismiss notification
  React.useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Contact quick map
  const contactMap = useMemo(() => {
    const map = new Map<number, Contact>();
    if (contacts) {
      contacts.forEach(c => {
        if (c.id) map.set(c.id, c);
      });
    }
    return map;
  }, [contacts]);

  // Distinct categories
  const categories = useMemo(() => {
    if (!transactions) return [];
    const set = new Set<string>();
    transactions.forEach(t => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set).sort();
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return transactions
      .filter(t => {
        // Type filter
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;

        // Category filter
        if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;

        // Payment method filter
        if (paymentMethodFilter !== 'all' && (t.paymentMethod || 'cash') !== paymentMethodFilter) return false;

        // Date filter
        if (dateFilter !== 'all') {
          const tDate = new Date(t.date);
          if (dateFilter === 'today') {
            if (tDate.toISOString().split('T')[0] !== todayStr) return false;
          } else if (dateFilter === 'last7') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(now.getDate() - 7);
            if (tDate < sevenDaysAgo) return false;
          } else if (dateFilter === 'this_month') {
            if (tDate.getMonth() !== now.getMonth() || tDate.getFullYear() !== now.getFullYear()) return false;
          } else if (dateFilter === 'this_year') {
            if (tDate.getFullYear() !== now.getFullYear()) return false;
          }
        }

        // Search term
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase().trim();
          const contact = t.contactId ? contactMap.get(t.contactId) : null;
          const matchDesc = t.description?.toLowerCase().includes(q);
          const matchDoc = t.documentNo?.toLowerCase().includes(q);
          const matchCat = t.category?.toLowerCase().includes(q);
          const matchContact = contact?.name?.toLowerCase().includes(q) || contact?.code?.toLowerCase().includes(q);
          const matchAmount = t.amount.toString().includes(q);

          return matchDesc || matchDoc || matchCat || matchContact || matchAmount;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || (b.id || 0) - (a.id || 0));
  }, [transactions, typeFilter, categoryFilter, paymentMethodFilter, dateFilter, searchTerm, contactMap]);

  // Totals & KPI metrics
  const metrics = useMemo(() => {
    if (!transactions) return { totalIncome: 0, totalExpense: 0, netBalance: 0, incomeCount: 0, expenseCount: 0 };

    let totalIncome = 0;
    let totalExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    transactions.forEach(t => {
      if (t.type === 'income') {
        totalIncome += t.amount;
        incomeCount++;
      } else {
        totalExpense += t.amount;
        expenseCount++;
      }
    });

    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      incomeCount,
      expenseCount
    };
  }, [transactions]);

  const openAddModal = (type: TransactionType) => {
    setEditingTransaction(null);
    setModalType(type);
    setIsModalOpen(true);
  };

  const openEditModal = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setModalType(transaction.type);
    setIsModalOpen(true);
  };

  const openDeleteModal = (transaction: Transaction) => {
    setDeletingTransaction(transaction);
    setIsDeleteModalOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const getPaymentMethodLabel = (method?: string) => {
    switch (method) {
      case 'bank_transfer': return 'Banka / Havale';
      case 'credit_card': return 'Kredi Kartı';
      case 'check': return 'Çek / Senet';
      case 'other': return 'Diğer';
      case 'cash':
      default: return 'Nakit Kasa';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "p-4 rounded-2xl flex items-center justify-between gap-3 shadow-md border text-xs font-bold",
              notification.type === 'success' 
                ? "bg-emerald-50 border-emerald-200 text-emerald-900" 
                : "bg-rose-50 border-rose-200 text-rose-900"
            )}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-indigo-600" />
            Muhasebe & Kasa Yönetimi
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Tahsilat, ödeme, kasa giriş-çıkış hareketleri ve cari bakiye güncellemeleri
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Yazdır</span>
          </button>
          <button 
            onClick={() => openAddModal('income')}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm hover:bg-emerald-700 transition-all shadow-emerald-200"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>+ Tahsilat / Gelir Ekle</span>
          </button>
          <button 
            onClick={() => openAddModal('expense')}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm hover:bg-rose-700 transition-all shadow-rose-200"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>- Ödeme / Gider Ekle</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Income */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-2">
            <span>Toplam Tahsilat / Gelir</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600">
            +₺{metrics.totalIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 font-bold mt-1">
            {metrics.incomeCount} adet tahsilat kaydı
          </div>
        </div>

        {/* Total Expense */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-2">
            <span>Toplam Ödeme / Gider</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-rose-600">
            -₺{metrics.totalExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 font-bold mt-1">
            {metrics.expenseCount} adet ödeme kaydı
          </div>
        </div>

        {/* Net Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-black uppercase tracking-wider mb-2">
            <span>Net Kasa Durumu</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className={cn(
            "text-2xl font-black font-mono",
            metrics.netBalance >= 0 ? "text-slate-900" : "text-rose-600"
          )}>
            ₺{metrics.netBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 font-bold mt-1">
            {metrics.netBalance >= 0 ? 'Pozitif Kasa Fazlası' : 'Kasa Açığı / Net Eksi'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Açıklama, makbuz no, cari adı, kategori veya tutar ara..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Temizle
              </button>
            )}
          </div>

          {/* Quick Type Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full lg:w-auto shrink-0 overflow-x-auto">
            <button
              onClick={() => setTypeFilter('all')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap",
                typeFilter === 'all'
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Tüm Hareketler ({transactions?.length || 0})
            </button>
            <button
              onClick={() => setTypeFilter('income')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap",
                typeFilter === 'income'
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Tahsilatlar ({metrics.incomeCount})
            </button>
            <button
              onClick={() => setTypeFilter('expense')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap",
                typeFilter === 'expense'
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Ödemeler ({metrics.expenseCount})
            </button>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtrele:</span>
          </div>

          {/* Category */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">Tüm Kategoriler</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Payment Method */}
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">Tüm Ödeme Şekilleri</option>
            <option value="cash">Nakit (Kasa)</option>
            <option value="bank_transfer">Banka / Havale</option>
            <option value="credit_card">Kredi Kartı</option>
            <option value="check">Çek / Senet</option>
            <option value="other">Diğer</option>
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">Tüm Tarihler</option>
            <option value="today">Bugün</option>
            <option value="last7">Son 7 Gün</option>
            <option value="this_month">Bu Ay</option>
            <option value="this_year">Bu Yıl</option>
          </select>

          {(categoryFilter !== 'all' || paymentMethodFilter !== 'all' || dateFilter !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setCategoryFilter('all');
                setPaymentMethodFilter('all');
                setDateFilter('all');
                setSearchTerm('');
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold ml-auto"
            >
              Filtreleri Sıfırla
            </button>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider">Tarih</th>
                <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider">Makbuz / Belge No</th>
                <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider">Tür</th>
                <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider">İlgili Cari</th>
                <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider">Kategori</th>
                <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider">Ödeme Şekli</th>
                <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider">Açıklama</th>
                <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-right">Tutar</th>
                <th className="px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-center w-28">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Wallet className="w-8 h-8 text-slate-300" />
                      <p>Kayıtlı finansal hareket veya arama kriterine uygun işlem bulunamadı.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => {
                  const contact = t.contactId ? contactMap.get(t.contactId) : null;
                  const isIncome = t.type === 'income';

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Date */}
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-600 whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString('tr-TR')}
                      </td>

                      {/* Doc No */}
                      <td className="px-5 py-3.5 font-mono font-bold text-indigo-700 whitespace-nowrap">
                        {t.documentNo || `MAK-${t.id}`}
                      </td>

                      {/* Type Badge */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                          isIncome 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        )}>
                          {isIncome ? <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> : <ArrowUpRight className="w-3 h-3 text-rose-600" />}
                          {isIncome ? 'Tahsilat (Giriş)' : 'Ödeme (Çıkış)'}
                        </span>
                      </td>

                      {/* Contact */}
                      <td className="px-5 py-3.5">
                        {contact ? (
                          <button
                            type="button"
                            onClick={() => {
                              setStatementContact(contact);
                              setIsStatementOpen(true);
                            }}
                            className="text-left group/btn"
                            title="Cari Ekstresini Görüntüle"
                          >
                            <div className="font-bold text-slate-900 group-hover/btn:text-indigo-600 group-hover/btn:underline flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              {contact.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {contact.code || `ID: ${contact.id}`} • {contact.type === 'customer' ? 'Müşteri' : contact.type === 'supplier' ? 'Tedarikçi' : 'Müşteri/Tedarikçi'}
                            </div>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">Genel Kasa Hareketi</span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                          {t.category || 'Genel'}
                        </span>
                      </td>

                      {/* Payment Method */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 font-medium">
                        {getPaymentMethodLabel(t.paymentMethod)}
                      </td>

                      {/* Description */}
                      <td className="px-5 py-3.5 text-slate-700 max-w-xs truncate" title={t.description}>
                        {t.description || '-'}
                      </td>

                      {/* Amount */}
                      <td className={cn(
                        "px-5 py-3.5 text-right font-mono font-black text-sm whitespace-nowrap",
                        isIncome ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {isIncome ? '+' : '-'}₺{t.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(t)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="İşlemi Düzenle"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(t)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="İşlemi Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT TRANSACTION MODAL */}
      {isModalOpen && (
        <TransactionModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTransaction(null);
          }}
          transactionToEdit={editingTransaction}
          defaultType={modalType}
          onSuccess={(msg) => {
            setNotification({
              type: 'success',
              message: msg || 'İşlem başarıyla kaydedildi.'
            });
          }}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && deletingTransaction && (
        <TransactionDeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setDeletingTransaction(null);
          }}
          transaction={deletingTransaction}
          contact={deletingTransaction.contactId ? contactMap.get(deletingTransaction.contactId) : null}
          onSuccess={(msg) => {
            setNotification({
              type: 'success',
              message: msg || 'İşlem başarıyla silindi.'
            });
          }}
        />
      )}

      {/* CONTACT STATEMENT MODAL (Opened when clicking contact name) */}
      {isStatementOpen && statementContact && (
        <ContactStatementModal
          isOpen={isStatementOpen}
          onClose={() => {
            setIsStatementOpen(false);
            setStatementContact(null);
          }}
          contact={statementContact}
        />
      )}
    </div>
  );
}
