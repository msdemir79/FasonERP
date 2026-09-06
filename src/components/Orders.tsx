import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { 
  ShoppingCart, 
  Plus, 
  Search, 
  Eye, 
  Trash2, 
  ChevronRight, 
  X, 
  FileText, 
  Calendar, 
  User, 
  Package, 
  Calculator, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Hammer, 
  Sparkles,
  Truck,
  Layers,
  Boxes,
  Factory
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import Modal from './Modal';
import { erpService } from '../services/erpService';
import type { Order, OrderItem, OrderStatus, OrderType } from '../types';

export default function Orders() {
  const navigate = useNavigate();
  const orders = useLiveQuery(() => db.orders.reverse().toArray());
  const contacts = useLiveQuery(() => db.contacts.toArray());
  const products = useLiveQuery(() => db.products.toArray());
  const templates = useLiveQuery(() => db.assortmentTemplates.toArray());
  const workOrders = useLiveQuery(() => db.workOrders.toArray());
  const orderItemsAll = useLiveQuery(() => db.orderItems.toArray());
  const invoices = useLiveQuery(() => db.invoices.toArray());

  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<OrderType>('sales');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
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

  // Helper to compute tracking stats for a single order
  const getOrderProgressStats = React.useCallback((orderId: number) => {
    const items = orderItemsAll?.filter(oi => oi.orderId === orderId) || [];
    const orderWOs = workOrders?.filter(wo => wo.orderId === orderId) || [];
    
    const totalOrdered = items.reduce((sum, it) => sum + (it.quantity || 0), 0);
    
    // Produced quantity: completed work orders
    const totalProduced = orderWOs
      .filter(wo => wo.status === 'completed')
      .reduce((sum, wo) => sum + (wo.quantity || 0), 0);
      
    // In progress quantity
    const totalInProduction = orderWOs
      .filter(wo => wo.status === 'in_progress' || wo.status === 'pending')
      .reduce((sum, wo) => sum + (wo.quantity || 0), 0);

    // Shipped quantity: from order items invoiced / shipped fields
    const totalShipped = items.reduce((sum, it) => sum + (it.shippedQuantity || it.invoicedQuantity || 0), 0);

    const remainingToProduce = Math.max(0, totalOrdered - totalProduced);
    const remainingToShip = Math.max(0, totalOrdered - totalShipped);

    const producePercent = totalOrdered > 0 ? Math.min(100, Math.round((totalProduced / totalOrdered) * 100)) : 0;
    const shipPercent = totalOrdered > 0 ? Math.min(100, Math.round((totalShipped / totalOrdered) * 100)) : 0;

    return {
      totalOrdered,
      totalProduced,
      totalInProduction,
      totalShipped,
      remainingToProduce,
      remainingToShip,
      producePercent,
      shipPercent,
      workOrdersCount: orderWOs.length,
      items
    };
  }, [orderItemsAll, workOrders]);

  // Global KPIs for current tab
  const tabKPIs = React.useMemo(() => {
    if (!orders) return { totalOrders: 0, totalOrderedQty: 0, totalProducedQty: 0, totalShippedQty: 0, remainingShipQty: 0 };
    const tabOrders = orders.filter(o => o.type === activeTab);
    
    let totalOrderedQty = 0;
    let totalProducedQty = 0;
    let totalShippedQty = 0;

    tabOrders.forEach(o => {
      if (o.id) {
        const stats = getOrderProgressStats(o.id);
        totalOrderedQty += stats.totalOrdered;
        totalProducedQty += stats.totalProduced;
        totalShippedQty += stats.totalShipped;
      }
    });

    return {
      totalOrders: tabOrders.length,
      totalOrderedQty,
      totalProducedQty,
      totalShippedQty,
      remainingShipQty: Math.max(0, totalOrderedQty - totalShippedQty)
    };
  }, [orders, activeTab, getOrderProgressStats]);

  const filteredOrders = React.useMemo(() => {
    if (!orders) return [];
    return orders.filter(o => {
      const contact = contacts?.find(c => c.id === o.contactId);
      const matchesSearch = 
        o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact?.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = o.type === activeTab;
      
      if (!matchesSearch || !matchesType) return false;
      if (statusFilter === 'all') return true;

      const stats = o.id ? getOrderProgressStats(o.id) : null;
      if (!stats) return true;

      if (statusFilter === 'pending_prod') return stats.totalProduced < stats.totalOrdered;
      if (statusFilter === 'in_prod') return stats.totalInProduction > 0;
      if (statusFilter === 'ready_ship') return stats.totalProduced > stats.totalShipped;
      if (statusFilter === 'shipped') return stats.totalShipped >= stats.totalOrdered && stats.totalOrdered > 0;
      return true;
    });
  }, [orders, contacts, searchTerm, activeTab, statusFilter, getOrderProgressStats]);

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

  const handleCreateWorkOrders = async (orderId: number) => {
    try {
      setIsTransferringToProduction(true);
      await erpService.createWorkOrdersFromOrder(orderId);
      alert('Sipariş için üretim iş emirleri başarıyla oluşturuldu!');
      if (selectedOrder?.id === orderId) {
        const updated = await erpService.getOrder(orderId);
        setSelectedOrder(updated);
      }
    } catch (error: any) {
      alert('İş emri oluşturulurken hata: ' + error.message);
    } finally {
      setIsTransferringToProduction(false);
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
      draft: "bg-slate-100 text-slate-600 border-slate-200",
      confirmed: "bg-indigo-50 text-indigo-700 border-indigo-200",
      partially_shipped: "bg-amber-50 text-amber-700 border-amber-200",
      completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
      cancelled: "bg-rose-50 text-rose-700 border-rose-200"
    };

    const labels = {
      draft: "Taslak",
      confirmed: "Onaylandı",
      partially_shipped: "Kısmi Sevk",
      completed: "Tamamlandı",
      cancelled: "İptal"
    };

    return (
      <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border", styles[status])}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-indigo-600" />
            SİPARİŞ YÖNETİMİ & TAKİP
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1 uppercase tracking-wider">
            Sipariş, Üretim İlerlemesi ve Sevkiyat Durumu İzleme
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('sales')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                activeTab === 'sales' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              Satış Siparişleri
            </button>
            <button 
              onClick={() => setActiveTab('purchase')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                activeTab === 'purchase' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              Alış Siparişleri
            </button>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-slate-900 transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> YENİ SİPARİŞ
          </button>
        </div>
      </div>

      {/* Production & Shipment Live KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Toplam Sipariş</span>
            <Package className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {tabKPIs.totalOrderedQty.toLocaleString('tr-TR')} <span className="text-xs font-bold text-slate-400">Çift/Adet</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">{tabKPIs.totalOrders} Adet Aktif Sipariş</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Üretilen Miktar</span>
            <Factory className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-blue-600 font-mono">
            {tabKPIs.totalProducedQty.toLocaleString('tr-TR')} <span className="text-xs font-bold text-slate-400">Çift</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 rounded-full" 
                style={{ width: `${tabKPIs.totalOrderedQty > 0 ? (tabKPIs.totalProducedQty / tabKPIs.totalOrderedQty) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] font-black text-blue-600">
              %{tabKPIs.totalOrderedQty > 0 ? Math.round((tabKPIs.totalProducedQty / tabKPIs.totalOrderedQty) * 100) : 0}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Sevk Edilen Miktar</span>
            <Truck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-600 font-mono">
            {tabKPIs.totalShippedQty.toLocaleString('tr-TR')} <span className="text-xs font-bold text-slate-400">Çift</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-600 rounded-full" 
                style={{ width: `${tabKPIs.totalOrderedQty > 0 ? (tabKPIs.totalShippedQty / tabKPIs.totalOrderedQty) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] font-black text-emerald-600">
              %{tabKPIs.totalOrderedQty > 0 ? Math.round((tabKPIs.totalShippedQty / tabKPIs.totalOrderedQty) * 100) : 0}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Kalan Sevkiyat (Bakiye)</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-600 font-mono">
            {tabKPIs.remainingShipQty.toLocaleString('tr-TR')} <span className="text-xs font-bold text-slate-400">Çift</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">Müşteriye Teslim Bekleyen</p>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Sipariş no veya cari adı ile ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'Tümü' },
              { id: 'pending_prod', label: 'Üretim Bekleyen' },
              { id: 'in_prod', label: 'Üretimde' },
              { id: 'ready_ship', label: 'Sevkiyata Hazır' },
              { id: 'shipped', label: 'Tamamlananlar' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer",
                  statusFilter === f.id ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="p-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Sipariş & Cari</th>
                <th className="p-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Hedef Sipariş</th>
                <th className="p-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Üretim Durumu</th>
                <th className="p-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Sevkiyat Durumu</th>
                <th className="p-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Kalan Miktar</th>
                <th className="p-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Tutar & Tarih</th>
                <th className="p-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-wider">Kriterlere uygun sipariş bulunamadı</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const contact = contacts?.find(c => c.id === order.contactId);
                  const stats = order.id ? getOrderProgressStats(order.id) : null;
                  const totalOrdered = stats?.totalOrdered || 0;
                  const totalProduced = stats?.totalProduced || 0;
                  const totalShipped = stats?.totalShipped || 0;
                  const remainingProduce = stats?.remainingToProduce || 0;
                  const remainingShip = stats?.remainingToShip || 0;
                  const producePercent = stats?.producePercent || 0;
                  const shipPercent = stats?.shipPercent || 0;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Order & Contact */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black uppercase shrink-0 border",
                            order.type === 'sales' ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          )}>
                            {contact?.name?.substring(0, 2) || 'SP'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-900">{order.orderNumber}</span>
                              {getStatusBadge(order.status)}
                            </div>
                            <div className="text-xs font-bold text-slate-600 truncate max-w-[180px]">{contact?.name}</div>
                          </div>
                        </div>
                      </td>

                      {/* Total Ordered Qty */}
                      <td className="p-3.5 text-center">
                        <span className="text-sm font-black text-slate-900 font-mono">
                          {totalOrdered.toLocaleString('tr-TR')}
                        </span>
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Çift / Adet</span>
                      </td>

                      {/* Production Status */}
                      <td className="p-3.5 min-w-[170px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-blue-700 font-mono">
                              {totalProduced} / {totalOrdered}
                            </span>
                            <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">
                              %{producePercent}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-600 rounded-full transition-all"
                              style={{ width: `${producePercent}%` }}
                            />
                          </div>
                          <div className="text-[9px] font-bold text-slate-400">
                            {stats?.workOrdersCount === 0 ? (
                              <span className="text-amber-600">İş Emri Açılmadı</span>
                            ) : producePercent === 100 ? (
                              <span className="text-emerald-600">Üretim Tamamlandı</span>
                            ) : (
                              <span>{stats?.workOrdersCount} İş Emri Devam Ediyor</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Shipment Status */}
                      <td className="p-3.5 min-w-[170px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-emerald-700 font-mono">
                              {totalShipped} / {totalOrdered}
                            </span>
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                              %{shipPercent}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-600 rounded-full transition-all"
                              style={{ width: `${shipPercent}%` }}
                            />
                          </div>
                          <div className="text-[9px] font-bold text-slate-400">
                            {shipPercent === 100 ? (
                              <span className="text-emerald-600">Tamamı Sevk Edildi</span>
                            ) : totalShipped > 0 ? (
                              <span className="text-amber-600">Kısmi Sevk Edildi</span>
                            ) : (
                              <span>Sevkiyat Bekliyor</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Remaining Quantities */}
                      <td className="p-3.5">
                        <div className="space-y-0.5 text-xs font-bold font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Kalan Üretim:</span>
                            <span className={cn(remainingProduce > 0 ? "text-blue-700" : "text-slate-400")}>
                              {remainingProduce}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Kalan Sevk:</span>
                            <span className={cn(remainingShip > 0 ? "text-amber-700" : "text-emerald-600")}>
                              {remainingShip}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Total Price & Date */}
                      <td className="p-3.5 text-right">
                        <div className="text-xs font-black text-slate-900 font-mono">
                          {order.grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </div>
                        <div className="text-[10px] font-semibold text-slate-400">
                          {new Date(order.date).toLocaleDateString('tr-TR')}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => navigate(`/waybills?orderId=${order.id}&contactId=${order.contactId}&type=${order.type}`)}
                            title="İrsaliye Kes / Sevk Et"
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-slate-200 shadow-2xs"
                          >
                            <Truck className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="hidden xl:inline text-[10px] font-black text-indigo-700">İrsaliye</span>
                          </button>
                          <button 
                            onClick={() => navigate(`/invoices?orderId=${order.id}&contactId=${order.contactId}&type=${order.type}`)}
                            title="Fatura Kes"
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-slate-200 shadow-2xs"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="hidden xl:inline text-[10px] font-black text-emerald-700">Fatura</span>
                          </button>
                          {stats && stats.workOrdersCount === 0 && (
                            <button
                              onClick={() => handleCreateWorkOrders(order.id!)}
                              title="Üretim İş Emirlerini Başlat"
                              className="p-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg transition-colors cursor-pointer"
                            >
                              <Hammer className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button 
                            onClick={async () => {
                              const detail = await erpService.getOrder(order.id!);
                              setSelectedOrder(detail);
                              setIsDetailModalOpen(true);
                            }}
                            title="Detay & İlerleme Takibi"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={async () => {
                              if (confirm('Siparişi silmek istediğinize emin misiniz?')) {
                                await erpService.deleteOrder(order.id!);
                              }
                            }}
                            title="Sil"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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

      {/* ========================================================================= */}
      {/* ORDER DETAIL & PROGRESS TRACKING MODAL (SIZE 3XL)                        */}
      {/* ========================================================================= */}
      <Modal 
        isOpen={isDetailModalOpen} 
        onClose={() => setIsDetailModalOpen(false)} 
        title={`Sipariş Takip & İlerleme: ${selectedOrder?.orderNumber || ''}`}
        size="3xl"
      >
        {selectedOrder && (() => {
          const stats = selectedOrder.id ? getOrderProgressStats(selectedOrder.id) : null;
          const contact = contacts?.find(c => c.id === selectedOrder.contactId);
          const orderWOs = workOrders?.filter(w => w.orderId === selectedOrder.id) || [];

          return (
            <div className="space-y-6">
              {/* Top Summary Status Matrix */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Toplam Hedef</p>
                  <h4 className="text-xl font-black text-slate-900 font-mono">
                    {stats?.totalOrdered.toLocaleString('tr-TR')} <span className="text-xs uppercase text-slate-400">Çift</span>
                  </h4>
                </div>

                <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200 text-center">
                  <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-1">Üretilen Miktar</p>
                  <h4 className="text-xl font-black text-blue-700 font-mono">
                    {stats?.totalProduced.toLocaleString('tr-TR')} <span className="text-xs text-blue-500">Çift (%{stats?.producePercent})</span>
                  </h4>
                  <div className="w-full h-1.5 bg-blue-100 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${stats?.producePercent}%` }} />
                  </div>
                </div>

                <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 text-center">
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider mb-1">Sevk Edilen Miktar</p>
                  <h4 className="text-xl font-black text-emerald-700 font-mono">
                    {stats?.totalShipped.toLocaleString('tr-TR')} <span className="text-xs text-emerald-500">Çift (%{stats?.shipPercent})</span>
                  </h4>
                  <div className="w-full h-1.5 bg-emerald-100 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${stats?.shipPercent}%` }} />
                  </div>
                </div>

                <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 text-center">
                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-1">Kalan Bakiye (Sevk)</p>
                  <h4 className="text-xl font-black text-amber-700 font-mono">
                    {stats?.remainingToShip.toLocaleString('tr-TR')} <span className="text-xs text-amber-500">Çift</span>
                  </h4>
                  <p className="text-[9px] font-bold text-amber-600 mt-1">Kalan Üretim: {stats?.remainingToProduce} Çift</p>
                </div>
              </div>

              {/* Order Info & Line Items with Variant Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Panel: Contact & Order Details */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                      <User className="w-3.5 h-3.5" /> Cari & Sipariş Detayı
                    </h4>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Cari Ünvan</p>
                      <p className="text-sm font-black text-slate-900">{contact?.name}</p>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">{contact?.phone || 'Telefon Yok'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Sipariş Tarihi</span>
                        <span className="font-bold text-slate-800">{new Date(selectedOrder.date).toLocaleDateString('tr-TR')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Termin Tarihi</span>
                        <span className="font-bold text-indigo-600">
                          {selectedOrder.deliveryDate ? new Date(selectedOrder.deliveryDate).toLocaleDateString('tr-TR') : '-'}
                        </span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black text-indigo-600">
                      <span>Genel Tutar:</span>
                      <span>{selectedOrder.grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                    </div>
                  </div>

                  {/* Quick Production Button if needed */}
                  {orderWOs.length === 0 ? (
                    <button
                      onClick={() => handleCreateWorkOrders(selectedOrder.id)}
                      disabled={isTransferringToProduction}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    >
                      <Hammer className="w-4 h-4" /> Üretim İş Emirlerini Başlat
                    </button>
                  ) : (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 flex items-center justify-between">
                      <span>Bağlı İş Emirleri:</span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono">{orderWOs.length} Adet</span>
                    </div>
                  )}
                </div>

                {/* Right Panel: Product Lines Table with Exact Quantities */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <Package className="w-4 h-4 text-indigo-600" /> Sipariş Kalemleri ve Aşama Takibi
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400">{selectedOrder.items?.length || 0} Kalem</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          <tr>
                            <th className="p-3">Ürün & Renk</th>
                            <th className="p-3 text-center">Sipariş</th>
                            <th className="p-3 text-center">Üretilen</th>
                            <th className="p-3 text-center">Sevk Edilen</th>
                            <th className="p-3 text-center">Kalan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {selectedOrder.items?.map((item: any, i: number) => {
                            const p = products?.find(prod => prod.id === item.productId);
                            const itemWOs = orderWOs.filter(wo => wo.orderItemId === item.id || (wo.productId === item.productId && wo.color === item.color));
                            const itemProduced = itemWOs.filter(w => w.status === 'completed').reduce((s, w) => s + w.quantity, 0);
                            const itemShipped = item.shippedQuantity || item.invoicedQuantity || 0;
                            const itemRemainingShip = Math.max(0, item.quantity - itemShipped);

                            return (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="p-3">
                                  <div className="font-bold text-slate-800 uppercase">{p?.code || '-'}</div>
                                  <div className="text-[10px] text-slate-400 font-semibold">{p?.name}</div>
                                  {item.color && (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded mt-0.5 uppercase">
                                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                                      {item.color}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-center font-black font-mono text-slate-900">
                                  {item.quantity}
                                </td>
                                <td className="p-3 text-center">
                                  <span className="font-black font-mono text-blue-600">{itemProduced}</span>
                                  <span className="text-[9px] block text-slate-400 font-bold">
                                    %{item.quantity > 0 ? Math.round((itemProduced / item.quantity) * 100) : 0}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <span className="font-black font-mono text-emerald-600">{itemShipped}</span>
                                  <span className="text-[9px] block text-slate-400 font-bold">
                                    %{item.quantity > 0 ? Math.round((itemShipped / item.quantity) * 100) : 0}
                                  </span>
                                </td>
                                <td className="p-3 text-center font-black font-mono text-amber-600">
                                  {itemRemainingShip}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-slate-200">
                <div className="text-xs font-bold text-slate-500">
                  {selectedOrder.notes && <span>Not: "{selectedOrder.notes}"</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      navigate(`/waybills?orderId=${selectedOrder.id}&contactId=${selectedOrder.contactId}&type=${selectedOrder.type}`);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    <Truck className="w-4 h-4" />
                    <span>İrsaliye Kes / Sevk Et</span>
                  </button>

                  <button 
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      navigate(`/invoices?orderId=${selectedOrder.id}&contactId=${selectedOrder.contactId}&type=${selectedOrder.type}`);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Fatura Kes</span>
                  </button>

                  <button 
                    onClick={() => setIsDetailModalOpen(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-xs uppercase cursor-pointer"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Add Order Modal (Size 2XL) */}
      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => { setIsAddModalOpen(false); resetForm(); }} 
        title={activeTab === 'sales' ? "Yeni Satış Siparişi Oluştur" : "Yeni Alış Siparişi Oluştur"} 
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Header Inputs */}
            <div className="space-y-4 lg:col-span-1 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2">
                Sipariş Bilgileri
              </h4>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cari Seçimi</label>
                <select 
                  required
                  value={selectedContactId || ''}
                  onChange={(e) => setSelectedContactId(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold bg-white outline-none"
                >
                  <option value="">Cari Seçiniz...</option>
                  {contacts?.filter(c => c.type === (activeTab === 'sales' ? 'customer' : 'supplier')).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sipariş No</label>
                <input 
                  type="text" 
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="Otomatik oluşturulacak..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold uppercase bg-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sipariş Tarihi</label>
                  <input 
                    type="date" 
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs font-bold bg-white outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Termin Tarihi</label>
                  <input 
                    type="date" 
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs font-bold bg-white outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sipariş Notu</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-medium bg-white outline-none"
                />
              </div>

              {/* Summary */}
              <div className="p-3 bg-indigo-600 rounded-xl text-white space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span>Genel Toplam:</span>
                  <span className="font-mono text-sm">{totals.grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                </div>
              </div>
            </div>

            {/* Right Items List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-600" /> Sipariş Kalemleri ({orderItems.length})
                </h4>
                <button 
                  type="button"
                  onClick={openProductSelector}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-indigo-700 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Ürün Ekle
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden min-h-[260px] max-h-[350px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3">Ürün & Renk</th>
                      <th className="p-3 text-center">Miktar</th>
                      <th className="p-3 text-right">Birim Fiyat</th>
                      <th className="p-3 text-right">Toplam</th>
                      <th className="p-3 text-center">Sil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {orderItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-slate-400">
                          Henüz ürün eklenmedi. "Ürün Ekle" butonuna tıklayınız.
                        </td>
                      </tr>
                    ) : (
                      orderItems.map((item, index) => (
                        <tr key={index} className="hover:bg-slate-50">
                          <td className="p-3">
                            <div className="font-bold text-slate-800 uppercase">{item.code}</div>
                            <div className="text-[10px] text-slate-400">{item.name}</div>
                            {item.color && (
                              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded uppercase">
                                {item.color}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <input 
                              type="number" 
                              min="1" 
                              value={item.quantity} 
                              onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                              className="w-16 p-1 text-center font-bold border border-slate-200 rounded-lg text-xs"
                            />
                          </td>
                          <td className="p-3 text-right font-mono font-bold">
                            {item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </td>
                          <td className="p-3 text-right font-mono font-black text-indigo-600">
                            {(item.quantity * item.unitPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </td>
                          <td className="p-3 text-center">
                            <button 
                              type="button" 
                              onClick={() => removeOrderItem(index)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
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

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase shadow-md cursor-pointer"
                >
                  Siparişi Kaydet
                </button>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* Product Selector Sub-Modal (Size 2XL) */}
      <Modal 
        isOpen={isProductSelectorOpen} 
        onClose={() => setIsProductSelectorOpen(false)} 
        title="Siparişe Eklenecek Ürünü Seçin" 
        size="2xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* List */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Ürün adı veya kodu ile ara..."
                value={modalSearchTerm}
                onChange={(e) => setModalSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
              />
            </div>
            <div className="overflow-y-auto max-h-[380px] space-y-1.5 pr-1">
              {products?.filter(p => !p.isRawMaterial && (p.name.toLowerCase().includes(modalSearchTerm.toLowerCase()) || p.code.toLowerCase().includes(modalSearchTerm.toLowerCase()))).map(p => (
                <button 
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedProduct(p);
                    setSelectedColor(p.colors?.[0] || '');
                    setModalBoxCount(1);
                    setModalQuantity(1);
                  }}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer",
                    selectedProduct?.id === p.id 
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-md" 
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <div>
                    <div className={cn("text-[10px] font-black uppercase", selectedProduct?.id === p.id ? "text-indigo-100" : "text-slate-400")}>
                      {p.code}
                    </div>
                    <div className="text-xs font-bold uppercase">{p.name}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-60" />
                </button>
              ))}
            </div>
          </div>

          {/* Configuration */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            {selectedProduct ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-black uppercase text-slate-900">{selectedProduct.name}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{selectedProduct.code} • {selectedProduct.brand}</div>
                </div>

                {selectedProduct.colors && selectedProduct.colors.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Renk Seçimi</label>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProduct.colors.map((color: string) => (
                        <button 
                          key={color}
                          type="button"
                          onClick={() => setSelectedColor(color)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-black uppercase border transition-all cursor-pointer",
                            selectedColor === color 
                              ? "bg-slate-900 border-slate-900 text-white" 
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Miktar (Çift / Adet)</label>
                  <input 
                    type="number"
                    min="1"
                    value={modalQuantity}
                    onChange={(e) => setModalQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-black text-slate-900 outline-none"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Birim Fiyat:</span>
                  <span className="text-sm font-black text-slate-900 font-mono">
                    {(activeTab === 'sales' ? selectedProduct.sellingPrice : selectedProduct.buyingPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </span>
                </div>

                <button 
                  type="button"
                  onClick={handleModalAdd}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-colors shadow-md cursor-pointer"
                >
                  Sepete Ekle
                </button>
              </div>
            ) : (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-slate-300">
                <Package className="w-10 h-10 opacity-30 mb-2" />
                <p className="text-xs font-bold uppercase text-center">Lütfen soldaki listeden bir ürün seçiniz</p>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
