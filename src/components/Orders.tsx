import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ShoppingCart, Plus, Search, Eye, Trash2, ChevronRight, X, FileText, Calendar, User, Package, Calculator, ArrowRight, CheckCircle2, Clock, AlertCircle, Hammer, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import Modal from './Modal';
import { erpService } from '../services/erpService';
import type { Order, OrderItem, OrderStatus, OrderType } from '../types';

export default function Orders() {
  const orders = useLiveQuery(() => db.orders.reverse().toArray());
  const contacts = useLiveQuery(() => db.contacts.toArray());
  const products = useLiveQuery(() => db.products.toArray());
  const templates = useLiveQuery(() => db.assortmentTemplates.toArray());
  const workOrders = useLiveQuery(() => db.workOrders.toArray());

  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<OrderType>('sales');
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [isTransferringToProduction, setIsTransferringToProduction] = React.useState(false);
  
  // Product Selector Modal State
  const [isProductSelectorOpen, setIsProductSelectorOpen] = React.useState(false);
  const [modalSearchTerm, setModalSearchTerm] = React.useState('');
  const [selectedProduct, setSelectedProduct] = React.useState<any>(null);
  const [selectedColor, setSelectedColor] = React.useState('');
  const [modalBoxCount, setModalBoxCount] = React.useState(1);
  const [modalQuantity, setModalQuantity] = React.useState(1);
  
  // Form State
  const [orderItems, setOrderItems] = React.useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = React.useState<number | null>(null);
  const [orderDate, setOrderDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = React.useState('');
  const [orderNumber, setOrderNumber] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const filteredOrders = React.useMemo(() => {
    if (!orders) return [];
    return orders.filter(o => {
      const contact = contacts?.find(c => c.id === o.contactId);
      const matchesSearch = 
        o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact?.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = o.type === activeTab;
      return matchesSearch && matchesType;
    });
  }, [orders, contacts, searchTerm, activeTab]);

  const totals = React.useMemo(() => {
    const subtotal = orderItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
    const taxTotal = orderItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity * (item.taxRate / 100)), 0);
    const grandTotal = subtotal + taxTotal;
    return { subtotal, taxTotal, grandTotal };
  }, [orderItems]);

  const openProductSelector = () => {
    setIsProductSelectorOpen(true);
    setSelectedProduct(null);
    setSelectedColor('');
    setModalBoxCount(1);
    setModalQuantity(1);
    setModalSearchTerm('');
  };

  const handleModalAdd = () => {
    if (!selectedProduct) return;
    
    const template = selectedProduct.assortmentTemplateId ? templates?.find(t => t.id === selectedProduct.assortmentTemplateId) : null;
    const pairsPerBox = template ? template.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
    
    const qty = selectedProduct.isFootwear && selectedProduct.assortmentTemplateId 
      ? modalBoxCount * pairsPerBox 
      : modalQuantity;

    const newItem = {
      productId: selectedProduct.id!,
      name: selectedProduct.name,
      code: selectedProduct.code,
      color: selectedColor,
      isFootwear: selectedProduct.isFootwear,
      assortmentTemplateId: selectedProduct.assortmentTemplateId,
      pairsPerBox,
      boxCount: selectedProduct.isFootwear && selectedProduct.assortmentTemplateId ? modalBoxCount : 0,
      quantity: qty,
      unitPrice: activeTab === 'sales' ? selectedProduct.sellingPrice : selectedProduct.buyingPrice,
      taxRate: 20,
      discountRate: 0,
      total: (activeTab === 'sales' ? selectedProduct.sellingPrice : selectedProduct.buyingPrice) * qty
    };

    setOrderItems([...orderItems, newItem]);
    setIsProductSelectorOpen(false);
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...orderItems];
    const item = { ...newItems[index], [field]: value };
    
    // Auto-calculate quantity if boxCount changes for footwear
    if (field === 'boxCount' && item.isFootwear && item.pairsPerBox) {
      item.quantity = value * item.pairsPerBox;
    }
    
    newItems[index] = item;
    setOrderItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId || orderItems.length === 0) {
      alert('Lütfen bir cari seçin ve en az bir ürün ekleyin.');
      return;
    }

    const orderData: Omit<Order, 'id'> = {
      type: activeTab,
      orderNumber: orderNumber || `ORD-${Date.now()}`,
      contactId: selectedContactId,
      date: new Date(orderDate),
      deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
      status: 'confirmed',
      totalAmount: totals.subtotal,
      taxAmount: totals.taxTotal,
      discountAmount: 0,
      grandTotal: totals.grandTotal,
      notes,
      currency: 'TRY'
    };

    const items: Omit<OrderItem, 'id' | 'orderId'>[] = orderItems.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      shippedQuantity: 0,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      discountRate: item.discountRate,
      total: item.unitPrice * item.quantity * (1 + item.taxRate / 100),
      color: item.color,
      size: item.size
    }));

    try {
      await erpService.createOrder(orderData, items);
      setIsAddModalOpen(false);
      resetForm();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const resetForm = () => {
    setOrderItems([]);
    setSelectedContactId(null);
    setOrderDate(new Date().toISOString().split('T')[0]);
    setDeliveryDate('');
    setOrderNumber('');
    setNotes('');
  };

  const getStatusBadge = (status: OrderStatus) => {
    const styles = {
      draft: "bg-slate-100 text-slate-600",
      confirmed: "bg-indigo-100 text-indigo-600",
      partially_shipped: "bg-amber-100 text-amber-600",
      completed: "bg-emerald-100 text-emerald-600",
      cancelled: "bg-rose-100 text-rose-600"
    };

    const labels = {
      draft: "Taslak",
      confirmed: "Onaylandı",
      partially_shipped: "Kısmi Sevk",
      completed: "Tamamlandı",
      cancelled: "İptal"
    };

    return (
      <span className={cn("px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter", styles[status])}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-indigo-600" />
            SİPARİŞ YÖNETİMİ
          </h1>
          <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest text-[10px]">
            Alış ve Satış Siparişleri Takip Paneli
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('sales')}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'sales' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Satış Siparişleri
            </button>
            <button 
              onClick={() => setActiveTab('purchase')}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'purchase' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Alış Siparişleri
            </button>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100"
          >
            <Plus className="w-4 h-4" /> YENİ SİPARİŞ
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Sipariş no veya cari adı ile ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 placeholder:text-slate-300"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sipariş Bilgisi</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cari / Müşteri</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarih</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Durum</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Toplam Tutar</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-300">
                      <ShoppingCart className="w-16 h-16 mb-4 opacity-10" />
                      <p className="text-sm font-black uppercase tracking-widest">Henüz sipariş bulunmuyor</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const contact = contacts?.find(c => c.id === order.contactId);
                  return (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800">{order.orderNumber}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                            {order.type === 'sales' ? 'Satış Siparişi' : 'Alış Siparişi'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black uppercase",
                            order.type === 'sales' ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
                          )}>
                            {contact?.name.substring(0, 2)}
                          </div>
                          <span className="text-sm font-bold text-slate-700">{contact?.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-600">
                            {new Date(order.date).toLocaleDateString('tr-TR')}
                          </span>
                          {order.deliveryDate && (
                            <span className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {new Date(order.deliveryDate).toLocaleDateString('tr-TR')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="text-sm font-black text-slate-800">
                          {order.grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {order.currency}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={async () => {
                              const detail = await erpService.getOrder(order.id!);
                              setSelectedOrder(detail);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all shadow-sm"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={async () => {
                              if (confirm('Siparişi silmek istediğinize emin misiniz?')) {
                                await erpService.deleteOrder(order.id!);
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-all shadow-sm"
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

      {/* Add Order Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); resetForm(); }} title={activeTab === 'sales' ? "Satış Siparişi Oluştur" : "Alış Siparişi Oluştur"} className="max-w-6xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Panel: Header Info */}
            <div className="space-y-6 lg:col-span-1">
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Sipariş Üst Bilgileri</h4>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cari Seçimi</label>
                  <select 
                    required
                    value={selectedContactId || ''}
                    onChange={(e) => setSelectedContactId(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
                  >
                    <option value="">Cari Seçiniz...</option>
                    {contacts?.filter(c => c.type === (activeTab === 'sales' ? 'customer' : 'supplier')).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sipari No</label>
                  <input 
                    type="text" 
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="Otomatik oluşturulacak..."
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none uppercase"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sipariş Tarihi</label>
                    <input 
                      type="date" 
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Termin Tarihi</label>
                    <input 
                      type="date" 
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Notlar</label>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[100px]"
                  />
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-indigo-600 rounded-2xl p-6 text-white space-y-4 shadow-xl shadow-indigo-100">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Sipariş Özeti</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="opacity-80 font-medium">Ara Toplam:</span>
                    <span>{totals.subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="opacity-80 font-medium">KDV Toplam:</span>
                    <span>{totals.taxTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                  </div>
                  <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                    <span className="text-sm font-black uppercase">GENEL TOPLAM:</span>
                    <span className="text-xl font-black">{totals.grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel: Items List */}
            <div className="lg:col-span-2 space-y-6">
               <div className="bg-white rounded-2xl border border-slate-100 flex flex-col h-full overflow-hidden">
                  <div className="p-4 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                     <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                        <Package className="w-4 h-4 text-indigo-500" /> SİPARİŞ KALEMLERİ
                     </h4>
                     <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={openProductSelector}
                          className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg flex items-center gap-2"
                        >
                           <Plus className="w-4 h-4" /> ÜRÜN SEÇ
                        </button>
                     </div>
                  </div>

                  <div className="flex-1 overflow-x-auto min-h-[400px]">
                     <table className="w-full text-left">
                       <thead className="bg-slate-50/50">
                         <tr>
                            <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Ürün</th>
                            <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-24">Koli / Adet</th>
                            <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-24">Toplam Çift</th>
                            <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-32">Birim Fiyat</th>
                            <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-20 text-center">KDV %</th>
                            <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Toplam</th>
                            <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-10"></th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {orderItems.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-20 text-center text-slate-300">
                                <Plus className="w-12 h-12 mx-auto mb-2 opacity-10" />
                                <p className="text-[10px] font-black uppercase tracking-widest">Ürün eklemek için yukarıdaki menüyü kullanın</p>
                              </td>
                            </tr>
                          ) : (
                            orderItems.map((item, idx) => (
                              <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                                <td className="p-3">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-800">{item.code}</span>
                                    <span className="text-[10px] text-slate-500 font-medium uppercase">{item.name}</span>
                                    {item.color && (
                                      <span className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter mt-1">{item.color}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3">
                                  {item.isFootwear && item.assortmentTemplateId ? (
                                    <div className="flex flex-col gap-1">
                                      <input 
                                        type="number" 
                                        min="1"
                                        value={item.boxCount}
                                        onChange={(e) => updateItem(idx, 'boxCount', Number(e.target.value))}
                                        className="w-full border border-indigo-200 rounded-lg p-1.5 text-xs font-black text-center text-indigo-600 focus:ring-2 focus:ring-indigo-500/10 outline-none"
                                      />
                                      <span className="text-[8px] font-bold text-indigo-400 uppercase text-center">({item.pairsPerBox}'lı Asorti)</span>
                                    </div>
                                  ) : (
                                    <input 
                                      type="number" 
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                                      className="w-full border border-slate-200 rounded-lg p-1.5 text-xs font-black text-center focus:ring-2 focus:ring-indigo-500/10 outline-none"
                                    />
                                  )}
                                </td>
                                <td className="p-3">
                                  <div className={cn(
                                    "w-full p-1.5 text-xs font-black text-center rounded-lg border",
                                    item.isFootwear && item.assortmentTemplateId ? "bg-indigo-50 border-indigo-100 text-indigo-700" : "bg-slate-50 border-slate-100 text-slate-600"
                                  )}>
                                    {item.quantity}
                                  </div>
                                </td>
                                <td className="p-3 text-left">
                                  <input 
                                    type="number" 
                                    step="0.01"
                                    value={item.unitPrice}
                                    onChange={(e) => updateItem(idx, 'unitPrice', Number(e.target.value))}
                                    className="w-full border border-slate-200 rounded-lg p-1.5 text-xs font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500/10 outline-none"
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <select 
                                    value={item.taxRate}
                                    onChange={(e) => updateItem(idx, 'taxRate', Number(e.target.value))}
                                    className="w-full border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-600 focus:outline-none"
                                  >
                                    <option value="0">%0</option>
                                    <option value="1">%1</option>
                                    <option value="10">%10</option>
                                    <option value="20">%20</option>
                                  </select>
                                </td>
                                <td className="p-3 text-right">
                                  <span className="text-xs font-black text-slate-800">
                                    {(item.quantity * item.unitPrice * (1 + item.taxRate / 100)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                  </span>
                                </td>
                                <td className="p-3">
                                  <button 
                                    type="button" 
                                    onClick={() => removeOrderItem(idx)}
                                    className="text-slate-200 hover:text-rose-500 transition-colors p-1"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                       </tbody>
                     </table>
                  </div>

                  <div className="p-6 border-t border-slate-100 flex justify-end gap-4">
                    <button 
                      type="button" 
                      onClick={() => { setIsAddModalOpen(false); resetForm(); }}
                      className="px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all"
                    >
                      VAZGEÇ
                    </button>
                    <button 
                      type="submit"
                      className="bg-slate-900 text-white px-12 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
                    >
                      SİPARİŞİ KAYDET VE ONAYLA
                    </button>
                  </div>
               </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Sipariş Detayı" className="max-w-5xl">
         {selectedOrder && (
           <div className="space-y-6">
              {/* Header Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Sipariş No</p>
                    <h4 className="text-lg font-black text-slate-800 tracking-tight">{selectedOrder.orderNumber}</h4>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Sipariş Tarihi</p>
                    <h4 className="text-lg font-black text-slate-800 tracking-tight">{new Date(selectedOrder.date).toLocaleDateString('tr-TR')}</h4>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Termin Tarihi</p>
                    <h4 className="text-lg font-black text-slate-800 tracking-tight">
                      {selectedOrder.deliveryDate ? new Date(selectedOrder.deliveryDate).toLocaleDateString('tr-TR') : '-'}
                    </h4>
                 </div>
                 <div className="bg-indigo-600 p-4 rounded-2xl shadow-xl shadow-indigo-100 flex flex-col items-center justify-center text-center text-white">
                    <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1">Genel Toplam</p>
                    <h4 className="text-lg font-black tracking-tight">{selectedOrder.grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</h4>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Left Panel: Information */}
                 <div className="lg:col-span-1 space-y-6">
                    {/* Contact Information */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-4">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2 flex items-center gap-2">
                          <User className="w-3.5 h-3.5" /> Cari Bilgileri
                       </h4>
                       {(() => {
                          const contact = contacts?.find(c => c.id === selectedOrder.contactId);
                          return (
                             <div className="space-y-4">
                                <div>
                                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">İsim / Ünvan</p>
                                   <p className="text-sm font-black text-slate-800 leading-tight">{contact?.name}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Vergi Dairesi</p>
                                     <p className="text-xs font-bold text-slate-600">{contact?.taxOffice || '-'}</p>
                                  </div>
                                  <div>
                                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Vergi No</p>
                                     <p className="text-xs font-bold text-slate-600">{contact?.taxNumber || '-'}</p>
                                  </div>
                                </div>
                                <div>
                                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">İletişim Bilgileri</p>
                                   <p className="text-xs font-bold text-slate-700">{contact?.phone || 'Telefon Yok'}</p>
                                   <p className="text-xs font-medium text-slate-400 mt-1">{contact?.email || 'E-posta Yok'}</p>
                                </div>
                             </div>
                          );
                       })()}
                    </div>

                    {/* Financial Summary */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-4">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2 flex items-center gap-2">
                          <Calculator className="w-3.5 h-3.5" /> Ödeme Detayı
                       </h4>
                       <div className="space-y-2">
                          <div className="flex justify-between text-xs font-bold">
                             <span className="text-slate-400">Ara Toplam:</span>
                             <span className="text-slate-700">{selectedOrder.totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold">
                             <span className="text-slate-400">KDV Toplam:</span>
                             <span className="text-slate-700">{selectedOrder.taxAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                          </div>
                          {selectedOrder.discountAmount > 0 && (
                            <div className="flex justify-between text-xs font-bold text-rose-500">
                               <span>Toplam İskonto:</span>
                               <span>-{selectedOrder.discountAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                            </div>
                          )}
                          <div className="pt-3 border-t border-slate-100 flex justify-between text-sm font-black text-indigo-600">
                             <span className="uppercase tracking-tighter">Genel Toplam:</span>
                             <span>{selectedOrder.grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                          </div>
                       </div>
                    </div>

                    {selectedOrder.notes && (
                      <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100/50 space-y-2">
                         <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5" /> Sipariş Notu
                         </h4>
                         <p className="text-xs text-amber-800 font-medium leading-relaxed italic">"{selectedOrder.notes}"</p>
                      </div>
                    )}
                 </div>

                 {/* Right Panel: Items Table */}
                 <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                       <div className="p-4 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                          <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                             <Package className="w-4 h-4 text-indigo-500" /> Sipariş Satırları ({selectedOrder.items.length})
                          </h4>
                          <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">FİYATLAR KDV DAHİL HARİÇ BİLGİSİ</span>
                       </div>
                       <div className="overflow-x-auto">
                          <table className="w-full text-left">
                             <thead className="bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                   <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Ürün ve Varyant</th>
                                   <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Miktar</th>
                                   <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Birim Fiyat</th>
                                   <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Satır Toplamı</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-50">
                                {selectedOrder.items.map((item: any, i: number) => {
                                  const p = products?.find(prod => prod.id === item.productId);
                                  return (
                                    <tr key={i} className="hover:bg-slate-50/30 transition-colors group">
                                       <td className="p-4">
                                          <div className="flex flex-col">
                                             <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors uppercase">{p?.code}</span>
                                             <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{p?.name}</span>
                                             {item.color && (
                                               <div className="mt-1 flex items-center gap-1.5">
                                                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                  <span className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter">{item.color}</span>
                                               </div>
                                             )}
                                          </div>
                                       </td>
                                       <td className="p-4 text-center">
                                          <div className="inline-flex flex-col items-center">
                                             <span className="text-sm font-black text-slate-800">{item.quantity}</span>
                                             <span className="text-[8px] font-bold text-slate-300 uppercase">ADET / ÇİFT</span>
                                          </div>
                                       </td>
                                       <td className="p-4 text-right">
                                          <div className="flex flex-col">
                                             <span className="text-sm font-bold text-slate-700">{item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                                             <span className="text-[8px] font-black text-slate-300 uppercase">KDV: %{item.taxRate}</span>
                                          </div>
                                       </td>
                                       <td className="p-4 text-right">
                                          <span className="text-sm font-black text-slate-800">
                                            {item.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                          </span>
                                       </td>
                                    </tr>
                                  );
                                })}
                             </tbody>
                          </table>
                       </div>
                    </div>

                    {/* Status Tracking */}
                    <div className="bg-slate-50/80 p-6 rounded-3xl border border-slate-100 border-dashed">
                       <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                         <Clock className="w-3.5 h-3.5" /> İşlem Geçmişi ve Takibi
                       </h5>
                       <div className="space-y-6">
                          <div className="flex gap-4">
                             <div className="flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 ring-4 ring-white shadow-sm transition-transform hover:scale-110">
                                   <CheckCircle2 className="w-5 h-5" />
                                </div>
                                <div className="h-full w-0.5 bg-emerald-200 mt-1"></div>
                             </div>
                             <div className="pb-8">
                                <div className="flex items-center gap-2 mb-1">
                                   <span className="text-xs font-black text-slate-800 uppercase tracking-tight">SİPARİŞ OLUŞTURULDU</span>
                                   <span className="bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">TAMAMLANDI</span>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                                   <Calendar className="w-3 h-3" /> 
                                   {new Date(selectedOrder.date).toLocaleDateString('tr-TR')} {new Date(selectedOrder.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                             </div>
                          </div>

                          <div className="flex gap-4">
                             <div className="flex flex-col items-center">
                                <div className={cn(
                                   "w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white shadow-sm transition-transform hover:scale-110",
                                   selectedOrder.status === 'confirmed' ? "bg-indigo-100 text-indigo-600 animate-pulse" : "bg-slate-100 text-slate-400"
                                )}>
                                   <Clock className="w-5 h-5" />
                                </div>
                             </div>
                             <div>
                                <div className="flex items-center gap-2 mb-1">
                                   <span className="text-xs font-black text-slate-800 uppercase tracking-tight">SEVKİYAT / TESLİMAT BEKLENİYOR</span>
                                   {selectedOrder.status === 'confirmed' && (
                                      <span className="bg-indigo-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">AKTİF</span>
                                   )}
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Tahmini Teslim: {selectedOrder.deliveryDate ? new Date(selectedOrder.deliveryDate).toLocaleDateString('tr-TR') : 'Belirtilmedi'}</p>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-slate-100">
                 <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95">
                       <FileText className="w-4 h-4" /> PDF Yazdır
                    </button>
                    <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95">
                       <ArrowRight className="w-4 h-4" /> İrsaliyeye Dönüştür
                    </button>
                 </div>
                 <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="w-full sm:w-auto bg-slate-100 text-slate-600 px-10 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all font-mono"
                 >
                    Pencereyi Kapat
                 </button>
              </div>
           </div>
         )}
      </Modal>

      {/* Product Selector Modal */}
      <Modal 
        isOpen={isProductSelectorOpen} 
        onClose={() => setIsProductSelectorOpen(false)} 
        title="Siparişe Ürün Ekle" 
        className="max-w-5xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Product List */}
          <div className="space-y-4 border-r border-slate-100 pr-8">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Ürün adı veya kodu ile ara..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
                />
             </div>
             <div className="overflow-y-auto max-h-[500px] space-y-2 pr-2 custom-scrollbar">
                {products?.filter(p => !p.isRawMaterial && (p.name.toLowerCase().includes(modalSearchTerm.toLowerCase()) || p.code.toLowerCase().includes(modalSearchTerm.toLowerCase()))).map(p => (
                  <button 
                    key={p.id}
                    onClick={() => {
                      setSelectedProduct(p);
                      setSelectedColor(p.colors?.[0] || '');
                      setModalBoxCount(1);
                      setModalQuantity(1);
                    }}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group",
                      selectedProduct?.id === p.id 
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 translate-x-2" 
                        : "bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:bg-slate-50"
                    )}
                  >
                    <div>
                      <div className={cn("text-xs font-black uppercase tracking-widest mb-1", selectedProduct?.id === p.id ? "text-indigo-100" : "text-slate-400")}>{p.code}</div>
                      <div className="text-sm font-bold uppercase">{p.name}</div>
                    </div>
                    <ChevronRight className={cn("w-4 h-4 transition-transform", selectedProduct?.id === p.id ? "translate-x-1" : "opacity-0 group-hover:opacity-100")} />
                  </button>
                ))}
             </div>
          </div>

          {/* Configuration */}
          <div className="space-y-8">
            {selectedProduct ? (
              <div className="space-y-8">
                <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100/50">
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                    <Package className="w-5 h-5 text-indigo-600" />
                    {selectedProduct.name}
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="bg-white px-3 py-1 rounded-full text-[10px] font-black text-indigo-600 border border-indigo-100 uppercase tracking-widest">{selectedProduct.code}</span>
                    <span className="bg-white px-3 py-1 rounded-full text-[10px] font-black text-slate-400 border border-slate-100 uppercase tracking-widest">{selectedProduct.brand}</span>
                  </div>
                </div>

                {/* Color Selection */}
                {selectedProduct.colors && selectedProduct.colors.length > 0 && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Renk Seçimi</label>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedProduct.colors.map((color: string) => (
                        <button 
                          key={color}
                          onClick={() => setSelectedColor(color)}
                          className={cn(
                            "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                            selectedColor === color 
                              ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200" 
                              : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
                          )}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity Logic */}
                {selectedProduct.isFootwear ? (
                   <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Asorti Şablonu</label>
                        <select 
                          value={selectedProduct.assortmentTemplateId || ''}
                          onChange={(e) => {
                            const newTemplateId = Number(e.target.value);
                            setSelectedProduct({...selectedProduct, assortmentTemplateId: newTemplateId});
                          }}
                          className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-indigo-500/10"
                        >
                          <option value="">Şablon Seçiniz...</option>
                          {templates?.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        
                        {selectedProduct.assortmentTemplateId && (
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                             <div className="grid grid-cols-6 gap-2">
                                {templates?.find(t => t.id === selectedProduct.assortmentTemplateId)?.items.map((item, i) => (
                                  <div key={i} className="flex flex-col items-center bg-white p-2 rounded-lg border border-slate-100">
                                    <span className="text-[9px] font-black text-slate-400 uppercase mb-1">{item.size}</span>
                                    <span className="text-xs font-black text-indigo-600">{item.quantity}</span>
                                  </div>
                                ))}
                             </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 text-center pt-4 border-t border-dashed border-slate-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sipariş Miktarı (Koli)</label>
                        <div className="flex items-center justify-center gap-6">
                           <button 
                            type="button"
                            onClick={() => setModalBoxCount(Math.max(1, modalBoxCount - 1))}
                            className="w-12 h-12 rounded-2xl border border-slate-200 flex items-center justify-center text-xl font-bold hover:bg-slate-50 transition-all"
                           >-</button>
                           <input 
                            type="number"
                            min="1"
                            value={modalBoxCount}
                            onChange={(e) => setModalBoxCount(Math.max(1, Number(e.target.value)))}
                            className="w-24 text-4xl font-black text-center focus:outline-none text-indigo-600"
                           />
                           <button 
                            type="button"
                            onClick={() => setModalBoxCount(modalBoxCount + 1)}
                            className="w-12 h-12 rounded-2xl border border-slate-200 flex items-center justify-center text-xl font-bold hover:bg-slate-50 transition-all"
                           >+</button>
                        </div>
                        {selectedProduct.assortmentTemplateId && (
                          <div className="bg-indigo-600/5 px-4 py-2 rounded-xl inline-block mt-4">
                             <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                               <Calculator className="w-3.5 h-3.5" />
                               {modalBoxCount} KOLİ x {templates?.find(t => t.id === selectedProduct.assortmentTemplateId)?.items.reduce((s, i) => s + i.quantity, 0)} ÇİFT = {modalBoxCount * (templates?.find(t => t.id === selectedProduct.assortmentTemplateId)?.items.reduce((s, i) => s + i.quantity, 0) || 0)} ÇİFT
                             </p>
                          </div>
                        )}
                      </div>
                   </div>
                ) : (
                   <div className="space-y-3 text-center">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Adet / Miktar</label>
                      <div className="flex items-center justify-center gap-6">
                         <button 
                          onClick={() => setModalQuantity(Math.max(1, modalQuantity - 1))}
                          className="w-12 h-12 rounded-2xl border border-slate-200 flex items-center justify-center text-xl font-bold hover:bg-slate-50"
                         >-</button>
                         <input 
                          type="number"
                          min="1"
                          value={modalQuantity}
                          onChange={(e) => setModalQuantity(Math.max(1, Number(e.target.value)))}
                          className="w-32 text-4xl font-black text-center focus:outline-none text-slate-800"
                         />
                         <button 
                          onClick={() => setModalQuantity(modalQuantity + 1)}
                          className="w-12 h-12 rounded-2xl border border-slate-200 flex items-center justify-center text-xl font-bold hover:bg-slate-50"
                         >+</button>
                      </div>
                   </div>
                )}

                <div className="pt-8 border-t border-slate-100 flex flex-col gap-3">
                   <div className="flex justify-between items-center px-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Birim Fiyat</span>
                      <span className="text-xl font-black text-slate-800">
                        { (activeTab === 'sales' ? selectedProduct.sellingPrice : selectedProduct.buyingPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) } ₺
                      </span>
                   </div>
                   <button 
                    onClick={handleModalAdd}
                    className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                   >
                     <Plus className="w-5 h-5" /> SEPETE EKLE
                   </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 py-20">
                <div className="w-20 h-20 rounded-full border-4 border-dashed border-slate-100 flex items-center justify-center">
                   <Package className="w-8 h-8 opacity-20" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-center">Yapılandırmak için<br/>yandaki listeden ürün seçin</p>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
