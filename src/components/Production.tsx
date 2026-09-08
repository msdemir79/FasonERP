import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { 
  Play, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Settings2, 
  Trash2, 
  Scissors, 
  Printer, 
  Hammer, 
  Sparkles, 
  PackageCheck, 
  Barcode, 
  Search, 
  AlertTriangle, 
  Layers, 
  ArrowRight, 
  RefreshCw, 
  ShoppingCart, 
  FileText, 
  FileSpreadsheet,
  Calendar, 
  User, 
  Eye, 
  Check, 
  X, 
  Volume2, 
  Package, 
  Filter,
  CheckCircle,
  HelpCircle,
  TrendingUp,
  AlertCircle,
  Palette,
  Loader2,
  Download,
  ExternalLink,
  BarChart3
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { erpService, PRODUCTION_STAGES_CONFIG } from '../services/erpService';
import Modal from './Modal';
import { BarcodeSvg } from './BarcodeSvg';
import DetailedWorkOrderCardModal from './Production/DetailedWorkOrderCardModal';
import ProductionReport from './Reports/ProductionReport';
import { printElement, openPrintWindow } from '../lib/printService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { 
  WorkOrder, 
  ProductionStage, 
  Product, 
  Recipe, 
  RecipeIngredient,
  MrpCalculationResult, 
  MrpRequirementItem, 
  Order, 
  OrderItem,
  MaterialReadinessStatus 
} from '../types';

type ProductionTab = 'pipeline' | 'orders_pool' | 'mrp' | 'barcode_terminal' | 'recipes' | 'reports';

// Audio feedback helper for shopfloor scanner
function playBeepSound(type: 'success' | 'error' = 'success') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15); // E6
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.16);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.26);
    }
  } catch {
    // AudioContext blocked or not supported, ignore silently
  }
}

export default function Production() {
  const workOrders = useLiveQuery(() => db.workOrders.reverse().toArray());
  const products = useLiveQuery(() => db.products.toArray());
  const recipes = useLiveQuery(() => db.recipes.toArray());
  const orders = useLiveQuery(() => db.orders.where('type').equals('sales').reverse().toArray());
  const orderItems = useLiveQuery(() => db.orderItems.toArray());
  const contacts = useLiveQuery(() => db.contacts.toArray());

  const [activeTab, setActiveTab] = React.useState<ProductionTab>('pipeline');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [stageFilter, setStageFilter] = React.useState<string>('all');
  const [selectedWorkOrder, setSelectedWorkOrder] = React.useState<WorkOrder | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = React.useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = React.useState(false);
  const [ticketWorkOrder, setTicketWorkOrder] = React.useState<WorkOrder | null>(null);
  const [isPrintingTicket, setIsPrintingTicket] = React.useState(false);
  const [isDownloadingTicketPdf, setIsDownloadingTicketPdf] = React.useState(false);
  const [ticketPrintNotice, setTicketPrintNotice] = React.useState<{ message: string; blobUrl?: string } | null>(null);
  const [isDetailedSheetModalOpen, setIsDetailedSheetModalOpen] = React.useState(false);
  const [detailedSheetWorkOrder, setDetailedSheetWorkOrder] = React.useState<WorkOrder | null>(null);
  const [isStageTransitionModalOpen, setIsStageTransitionModalOpen] = React.useState(false);
  const [transitionTargetStage, setTransitionTargetStage] = React.useState<ProductionStage>('cutting');
  const [transitionOperator, setTransitionOperator] = React.useState('');
  const [transitionScrap, setTransitionScrap] = React.useState(0);
  const [transitionNotes, setTransitionNotes] = React.useState('');

  // Recipe Modal State
  const [selectedProductId, setSelectedProductId] = React.useState<number>(0);
  const [selectedRecipeTargetColor, setSelectedRecipeTargetColor] = React.useState<string>('all');
  const [recipeIngredients, setRecipeIngredients] = React.useState<RecipeIngredient[]>([]);
  const [recipeLaborCost, setRecipeLaborCost] = React.useState<number>(0);
  const [recipeNotes, setRecipeNotes] = React.useState<string>('');

  // Manual Work Order Form State
  const [manualWoProductId, setManualWoProductId] = React.useState<number>(0);
  const [manualWoColor, setManualWoColor] = React.useState<string>('');
  const [manualWoSize, setManualWoSize] = React.useState<string>('');

  // MRP State
  const [mrpResult, setMrpResult] = React.useState<MrpCalculationResult | null>(null);
  const [isMrpCalculating, setIsMrpCalculating] = React.useState(false);
  const [selectedMrpItems, setSelectedMrpItems] = React.useState<number[]>([]);
  const [isPurchaseOrderModalOpen, setIsPurchaseOrderModalOpen] = React.useState(false);
  const [mrpSupplierId, setMrpSupplierId] = React.useState<number | null>(null);

  // Barcode Terminal State
  const [scannedCode, setScannedCode] = React.useState('');
  const [scannerOperator, setScannerOperator] = React.useState('İstasyon Operatörü');
  const [scanFeedback, setScanFeedback] = React.useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
    workOrder?: WorkOrder;
    product?: Product;
    timestamp: Date;
  } | null>(null);
  const [scanHistory, setScanHistory] = React.useState<{
    id: string;
    barcode: string;
    productName: string;
    prevStage: string;
    newStage: string;
    time: string;
  }[]>([]);

  const barcodeInputRef = React.useRef<HTMLInputElement>(null);

  // Helper Maps
  const productMap = React.useMemo(() => new Map((products || []).map(p => [p.id!, p])), [products]);
  const recipeMap = React.useMemo(() => new Map((recipes || []).map(r => [r.productId, r])), [recipes]);

  // Run initial MRP calculation when tab opens or on demand
  const handleCalculateMRP = async (targetIds?: number[]) => {
    setIsMrpCalculating(true);
    try {
      const result = await erpService.calculateMRP(targetIds);
      setMrpResult(result);
      // Select all shortage items by default
      const shortageIds = result.items.filter(i => i.status === 'shortage').map(i => i.rawMaterialId);
      setSelectedMrpItems(shortageIds);
    } catch (err: any) {
      alert(`MRP Hesaplama Hatası: ${err.message}`);
    } finally {
      setIsMrpCalculating(false);
    }
  };

  // Auto calculate MRP once data is loaded if null
  React.useEffect(() => {
    if (workOrders && products && recipes && !mrpResult) {
      handleCalculateMRP();
    }
  }, [workOrders?.length, products?.length, recipes?.length]);

  // Filtered Work Orders for Pipeline
  const filteredWorkOrders = React.useMemo(() => {
    if (!workOrders) return [];
    return workOrders.filter(wo => {
      const prod = productMap.get(wo.productId);
      const matchesSearch = 
        wo.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (prod?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (prod?.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (wo.orderNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (wo.customerName || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStage = stageFilter === 'all' || wo.currentStage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [workOrders, searchTerm, stageFilter, productMap]);

  // Filter Sales Orders for Pool
  const pendingSalesOrders = React.useMemo(() => {
    if (!orders || !orderItems) return [];
    return orders.filter(o => o.status !== 'cancelled').map(order => {
      const items = orderItems.filter(i => i.orderId === order.id);
      const existingWOs = workOrders?.filter(w => w.orderId === order.id) || [];
      const contact = contacts?.find(c => c.id === order.contactId);
      return {
        ...order,
        contactName: contact?.name || 'Müşteri',
        items,
        workOrderCount: existingWOs.length,
        hasMissingWorkOrders: items.some(item => {
          const prod = productMap.get(item.productId);
          if (!prod || prod.isRawMaterial) return false;
          return !existingWOs.some(w => w.orderItemId === item.id);
        })
      };
    });
  }, [orders, orderItems, workOrders, contacts, productMap]);

  // Stage Helpers
  const getStageInfo = (stageId: ProductionStage) => {
    return PRODUCTION_STAGES_CONFIG.find(s => s.id === stageId) || PRODUCTION_STAGES_CONFIG[0];
  };

  const getStageIcon = (stageId: ProductionStage) => {
    switch (stageId) {
      case 'planning': return FileText;
      case 'cutting': return Scissors;
      case 'printing': return Printer;
      case 'sewing': return Layers;
      case 'assembly': return Hammer;
      case 'finishing': return Sparkles;
      case 'quality_packing': return PackageCheck;
      case 'completed': return CheckCircle2;
      default: return Clock;
    }
  };

  // Recipe helpers: Load existing recipe or prefill draft for specific variant color
  const loadRecipeForProductAndColor = (productId: number, targetColor: string) => {
    setSelectedProductId(productId);
    setSelectedRecipeTargetColor(targetColor);

    const allProdRecipes = recipes?.filter(r => r.productId === productId) || [];
    const exactMatch = allProdRecipes.find(r => (r.targetColor || 'all') === targetColor);

    if (exactMatch) {
      setRecipeIngredients(exactMatch.ingredients.map(ing => {
        const mat = productMap.get(ing.productId);
        const isSemi = mat?.categoryType === 'semi_finished' || mat?.isFootwear || mat?.unit === 'Çift';
        return {
          productId: ing.productId,
          color: ing.color || (targetColor !== 'all' ? targetColor : undefined),
          quantity: ing.quantity,
          unit: ing.unit || mat?.unit || 'Adet',
          isMatrixMatched: ing.isMatrixMatched ?? isSemi,
          notes: ing.notes || ''
        };
      }));
      setRecipeLaborCost(exactMatch.laborCost || 0);
      setRecipeNotes(exactMatch.notes || '');
      return;
    }

    // If no exact match and looking for specific color, use generic 'all' recipe as draft template
    if (targetColor !== 'all') {
      const generic = allProdRecipes.find(r => !r.targetColor || r.targetColor === 'all');
      if (generic) {
        setRecipeIngredients(generic.ingredients.map(ing => {
          const mat = productMap.get(ing.productId);
          const isSemi = mat?.categoryType === 'semi_finished' || mat?.isFootwear || mat?.unit === 'Çift';
          const matHasTargetColor = mat?.colors?.includes(targetColor);
          return {
            productId: ing.productId,
            color: matHasTargetColor ? targetColor : (ing.color || targetColor),
            quantity: ing.quantity,
            unit: ing.unit || mat?.unit || 'Adet',
            isMatrixMatched: ing.isMatrixMatched ?? isSemi,
            notes: ing.notes || ''
          };
        }));
        setRecipeLaborCost(generic.laborCost || 0);
        setRecipeNotes(generic.notes || '');
        return;
      }
    }

    // Default blank recipe
    setRecipeIngredients([{
      productId: 0,
      color: targetColor !== 'all' ? targetColor : undefined,
      quantity: 1,
      unit: 'Adet',
      isMatrixMatched: false
    }]);
    setRecipeLaborCost(0);
    setRecipeNotes('');
  };

  const openRecipeModalForProduct = (productId: number, targetColor?: string) => {
    setSelectedProductId(productId);
    const prod = productMap.get(productId);
    const colorToUse = targetColor || (prod?.colors && prod.colors.length > 0 ? prod.colors[0] : 'all');
    loadRecipeForProductAndColor(productId, colorToUse);
    setIsRecipeModalOpen(true);
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      alert('Lütfen bir hedef model seçin.');
      return;
    }
    const validIngredients = recipeIngredients.filter(i => i.productId > 0 && i.quantity > 0);
    if (validIngredients.length === 0) {
      alert('Reçete için en az bir hammadde veya yarı mamul ve geçerli miktar girilmelidir.');
      return;
    }

    try {
      await erpService.saveRecipe({
        productId: selectedProductId,
        targetColor: selectedRecipeTargetColor !== 'all' ? selectedRecipeTargetColor : undefined,
        ingredients: validIngredients,
        laborCost: recipeLaborCost,
        notes: recipeNotes
      });
      setIsRecipeModalOpen(false);
      // Recalculate MRP with new recipe
      handleCalculateMRP();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteRecipe = async (recipeId: number) => {
    if (confirm('Bu reçeteyi silmek istediğinize emin misiniz?')) {
      await erpService.deleteRecipe(recipeId);
      handleCalculateMRP();
    }
  };

  // Direct create single work order
  const handleCreateManualWorkOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const productId = Number(formData.get('productId'));
    const quantity = Number(formData.get('quantity'));
    const color = formData.get('color') as string;
    const size = formData.get('size') as string;
    const targetDateStr = formData.get('targetDate') as string;
    const notes = formData.get('notes') as string;

    try {
      await erpService.createWorkOrder({
        productId,
        quantity,
        color: color || undefined,
        size: size || undefined,
        targetDate: targetDateStr ? new Date(targetDateStr) : undefined,
        notes: notes || undefined
      });
      setIsAddModalOpen(false);
      handleCalculateMRP();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Convert Sales Order to Work Orders
  const handleTransferOrderToProduction = async (orderId: number) => {
    try {
      const createdIds = await erpService.createWorkOrdersFromOrder(orderId);
      if (createdIds.length > 0) {
        alert(`${createdIds.length} adet ürün kalemi başarıyla üretim planına alındı ve barkodları oluşturuldu.`);
        handleCalculateMRP();
      } else {
        alert('Bu siparişteki tüm kalemler zaten üretim planına alınmış.');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Stage Advancement Handler
  const handleOpenStageTransition = (wo: WorkOrder, target?: ProductionStage) => {
    setSelectedWorkOrder(wo);
    const stagesList: ProductionStage[] = ['planning', 'cutting', 'printing', 'sewing', 'assembly', 'finishing', 'quality_packing', 'completed'];
    const currIdx = stagesList.indexOf(wo.currentStage);
    const defaultNext = target || (currIdx < stagesList.length - 1 ? stagesList[currIdx + 1] : 'completed');
    setTransitionTargetStage(defaultNext);
    setTransitionOperator(wo.operator || '');
    setTransitionScrap(0);
    setTransitionNotes('');
    setIsStageTransitionModalOpen(true);
  };

  const handleExecuteStageTransition = async () => {
    if (!selectedWorkOrder) return;
    try {
      await erpService.advanceWorkOrderStage(selectedWorkOrder.id!, transitionTargetStage, {
        operator: transitionOperator || undefined,
        scrapQuantity: transitionScrap > 0 ? transitionScrap : undefined,
        notes: transitionNotes || undefined
      });
      setIsStageTransitionModalOpen(false);
      handleCalculateMRP();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Barcode Scanner Action
  const handleBarcodeSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = scannedCode.trim();
    if (!code) return;

    try {
      const result = await erpService.scanWorkOrderBarcode(code, scannerOperator);
      playBeepSound(result.success ? 'success' : 'error');
      
      const product = result.product;
      setScanFeedback({
        type: result.success ? 'success' : 'error',
        title: result.success ? 'Aşama Başarıyla Güncellendi' : 'İşlem Uyarısı',
        message: result.message,
        workOrder: result.workOrder,
        product,
        timestamp: new Date()
      });

      if (result.success) {
        setScanHistory(prev => [
          {
            id: String(Date.now()),
            barcode: result.workOrder.barcode,
            productName: product?.name || 'Ürün',
            prevStage: getStageInfo(result.previousStage as ProductionStage).shortLabel,
            newStage: getStageInfo(result.newStage as ProductionStage).shortLabel,
            time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          },
          ...prev.slice(0, 19)
        ]);
        handleCalculateMRP();
      }
    } catch (err: any) {
      playBeepSound('error');
      setScanFeedback({
        type: 'error',
        title: 'Barkod Okuma Başarısız',
        message: err.message,
        timestamp: new Date()
      });
    } finally {
      setScannedCode('');
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    }
  };

  // Create Purchase Order from MRP shortages
  const handleCreatePurchaseOrderFromMRP = async () => {
    if (!mrpResult || selectedMrpItems.length === 0) {
      alert('Lütfen satın alma siparişi oluşturmak için en az bir hammadde seçin.');
      return;
    }

    const itemsToBuy = mrpResult.items
      .filter(i => selectedMrpItems.includes(i.rawMaterialId) && i.shortageQuantity > 0)
      .map(i => ({
        rawMaterialId: i.rawMaterialId,
        quantity: i.shortageQuantity,
        unitPrice: i.buyingPrice
      }));

    if (itemsToBuy.length === 0) {
      alert('Seçilen kalemler arasında eksik stok bulunmuyor.');
      return;
    }

    try {
      const orderRes = await erpService.createPurchaseOrderFromMRP(itemsToBuy, mrpSupplierId || undefined);
      alert(`✅ Başarılı: Eksik hammaddeler için #${orderRes.orderNumber} nolu Alış Siparişi oluşturuldu!`);
      setIsPurchaseOrderModalOpen(false);
      handleCalculateMRP();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Print Work Order Ticket Modal trigger
  const openTicketModal = (wo: WorkOrder) => {
    setTicketWorkOrder(wo);
    setTicketPrintNotice(null);
    setIsTicketModalOpen(true);
  };

  // Direct Print Ticket with Fail-Safe Blob URL (Bypasses iframe restrictions)
  const handlePrintTicket = async () => {
    const printArea = document.getElementById('printable-ticket');
    if (!printArea || !ticketWorkOrder) return;

    setIsPrintingTicket(true);
    setTicketPrintNotice(null);

    try {
      // 1. Open dedicated print window via Blob URL (Bypasses iframe sandbox restrictions completely)
      const blobUrl = openPrintWindow(
        printArea.outerHTML,
        `İş Emri Proses Kartı - ${ticketWorkOrder.barcode}`,
        {
          title: `İş Emri Proses Ref Kartı - ${ticketWorkOrder.barcode}`,
          landscape: false,
          css: `
            body { background: #ffffff !important; padding: 12px !important; }
            #printable-ticket {
              margin: 0 auto !important;
              max-width: 620px !important;
              border: 2px solid #000000 !important;
              border-radius: 16px !important;
              padding: 16px !important;
              background: #ffffff !important;
              box-shadow: none !important;
            }
          `
        }
      );

      setTicketPrintNotice({
        message: 'İş emri proses kartı yeni yazdırma sekmesinde açıldı ve yazıcı penceresi otomatik tetiklendi.',
        blobUrl: blobUrl || undefined
      });

      // 2. Also try native print if outside iframe
      if (window.self === window.top) {
        setTimeout(() => {
          try {
            window.print();
          } catch (e) {
            console.warn('Native window.print failed:', e);
          }
        }, 150);
      }
    } catch (err) {
      console.error('Baskı başlatılırken hata:', err);
      await handleDownloadTicketPdf();
    } finally {
      setTimeout(() => {
        setIsPrintingTicket(false);
      }, 1000);
    }
  };

  // Download Ticket Card as High Quality PDF (.pdf)
  const handleDownloadTicketPdf = async () => {
    const printArea = document.getElementById('printable-ticket');
    if (!printArea || !ticketWorkOrder) return;

    setIsDownloadingTicketPdf(true);
    try {
      const helperCanvas = document.createElement('canvas');
      const helperCtx = helperCanvas.getContext('2d');

      const sanitizeColor = (colorStr: string): string => {
        if (!colorStr) return '#000000';
        if (!colorStr.includes('oklch') && !colorStr.includes('color(') && !colorStr.includes('lab(')) {
          return colorStr;
        }
        try {
          if (helperCtx) {
            helperCtx.fillStyle = '#000000';
            helperCtx.fillStyle = colorStr;
            return helperCtx.fillStyle || '#000000';
          }
        } catch {}
        return '#000000';
      };

      const canvas = await html2canvas(printArea, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const printRoot = clonedDoc.getElementById('printable-ticket');
          if (printRoot) {
            printRoot.style.fontFamily = 'Arial, Helvetica, sans-serif';
            printRoot.style.letterSpacing = 'normal';
            printRoot.style.transform = 'none';
          }
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            try {
              htmlEl.style.fontFamily = 'Arial, Helvetica, sans-serif';
              htmlEl.style.letterSpacing = 'normal';
              const computed = window.getComputedStyle(htmlEl);
              const colorProps = ['color', 'backgroundColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor'];
              colorProps.forEach((prop) => {
                const val = (computed as any)[prop];
                if (val && (val.includes('oklch') || val.includes('color(') || val.includes('lab('))) {
                  (htmlEl.style as any)[prop] = sanitizeColor(val);
                }
              });
            } catch {}
          });
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const imgWidth = 180;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 15, 20, imgWidth, Math.min(imgHeight, 250));

      const cleanBarcode = (ticketWorkOrder.barcode || ticketWorkOrder.id || 'proses').replace(/[^a-zA-Z0-9_-]/g, '_');
      pdf.save(`Is_Emri_Proses_Karti_${cleanBarcode}.pdf`);
    } catch (err) {
      console.error('PDF oluşturulurken hata:', err);
    } finally {
      setIsDownloadingTicketPdf(false);
    }
  };

  // Open Full A4 Detailed Work Order & Cutting Card Modal
  const openDetailedWorkOrderSheet = (wo: WorkOrder) => {
    setDetailedSheetWorkOrder(wo);
    setIsDetailedSheetModalOpen(true);
  };

  const handleSaveDetailedWorkOrder = async (updatedFields: Partial<WorkOrder>) => {
    if (!detailedSheetWorkOrder?.id) return;
    try {
      await db.workOrders.update(detailedSheetWorkOrder.id, updatedFields);
      setDetailedSheetWorkOrder({ ...detailedSheetWorkOrder, ...updatedFields });
    } catch (err: any) {
      console.error("İş emri güncellenirken hata:", err);
    }
  };

  // Material Status Pill
  const renderMaterialStatusBadge = (status?: MaterialReadinessStatus, productId?: number) => {
    switch (status) {
      case 'materials_ready':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3 h-3" /> Malzeme Hazır
          </span>
        );
      case 'materials_shortage':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
            <AlertTriangle className="w-3 h-3" /> Hammadde Eksik
          </span>
        );
      case 'materials_consumed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            <Check className="w-3 h-3" /> Malzeme Harcandı
          </span>
        );
      case 'no_recipe':
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (productId) openRecipeModalForProduct(productId);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors"
          >
            <AlertCircle className="w-3 h-3" /> Reçete Tanımla
          </button>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200">
            <HelpCircle className="w-3 h-3" /> MRP Bekleniyor
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Hammer className="w-8 h-8 text-indigo-600" />
            ÜRETİM PLANLAMA & PROSES TAKİBİ
          </h1>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-1">
            Siparişten İmalata • Otomatik Reçete & MRP • 8 Kademeli Barkodlu Proses İstasyonu
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleCalculateMRP()}
            disabled={isMrpCalculating}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition-all shadow-xs"
          >
            <RefreshCw className={cn("w-4 h-4 text-indigo-600", isMrpCalculating && "animate-spin")} />
            {isMrpCalculating ? "Hesaplanıyor..." : "MRP İhtiyaç Hesapla"}
          </button>

          <button
            onClick={() => setIsRecipeModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition-all shadow-xs"
          >
            <Settings2 className="w-4 h-4 text-slate-500" />
            Reçeteler (BoM)
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
          >
            <Plus className="w-4 h-4" />
            Yeni İş Emri
          </button>
        </div>
      </div>

      {/* Quick Stat Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Aktif İş Emirleri</span>
            <span className="text-xl font-black text-slate-900">
              {workOrders?.filter(w => w.status !== 'completed' && w.status !== 'cancelled').length || 0}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Sipariş Havuzu</span>
            <span className="text-xl font-black text-amber-600">
              {pendingSalesOrders.filter(o => o.hasMissingWorkOrders).length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Eksik Hammadde</span>
            <span className={cn(
              "text-xl font-black",
              (mrpResult?.shortageItemsCount || 0) > 0 ? "text-rose-600" : "text-emerald-600"
            )}>
              {mrpResult?.shortageItemsCount || 0} Kalem
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tamamlanan İmalat</span>
            <span className="text-xl font-black text-emerald-600">
              {workOrders?.filter(w => w.status === 'completed').length || 0}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="col-span-2 sm:col-span-4 lg:col-span-1 bg-gradient-to-br from-slate-900 to-indigo-950 p-4 rounded-2xl shadow-sm text-white flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300 block">Barkod İstasyonu</span>
            <button
              onClick={() => setActiveTab('barcode_terminal')}
              className="text-xs font-black text-white hover:text-indigo-200 uppercase flex items-center gap-1 mt-1 underline decoration-indigo-400 underline-offset-4"
            >
              Terminali Aç <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center">
            <Barcode className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Tab Navigation Bar */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              activeTab === 'pipeline'
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Layers className="w-4 h-4 text-indigo-400" />
            1. Üretim Proses Hattı & Takip
          </button>

          <button
            onClick={() => setActiveTab('orders_pool')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              activeTab === 'orders_pool'
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <ShoppingCart className="w-4 h-4 text-amber-400" />
            2. Bekleyen Sipariş Havuzu
            {pendingSalesOrders.filter(o => o.hasMissingWorkOrders).length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('mrp')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              activeTab === 'mrp'
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <RefreshCw className="w-4 h-4 text-rose-400" />
            3. Malzeme İhtiyaç Planlama (MRP)
            {(mrpResult?.shortageItemsCount || 0) > 0 && (
              <span className="px-1.5 py-0.2 text-[9px] font-black bg-rose-500 text-white rounded-md">
                {mrpResult?.shortageItemsCount} Eksik
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('barcode_terminal')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              activeTab === 'barcode_terminal'
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Barcode className="w-4 h-4 text-emerald-400" />
            4. Barkodlu İstasyon Terminali
          </button>

          <button
            onClick={() => setActiveTab('recipes')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              activeTab === 'recipes'
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Settings2 className="w-4 h-4 text-sky-400" />
            5. Reçeteler (BoM)
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              activeTab === 'reports'
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <BarChart3 className="w-4 h-4 text-purple-400" />
            6. Üretim & Hat Raporları
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/reports?tab=production"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
          >
            <span>Raporlar Merkezi</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {activeTab === 'pipeline' && (
          <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="İş emri, barkod, model ara..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">Tüm Aşamalar</option>
              {PRODUCTION_STAGES_CONFIG.map(st => (
                <option key={st.id} value={st.id}>{st.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: PRODUCTION PIPELINE & STAGES */}
      {activeTab === 'pipeline' && (
        <div className="space-y-6">
          {/* Horizontal Stage Stepper / Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {PRODUCTION_STAGES_CONFIG.map(stage => {
              const count = workOrders?.filter(w => w.currentStage === stage.id && w.status !== 'cancelled').length || 0;
              const StageIcon = getStageIcon(stage.id);
              const isActive = stageFilter === stage.id;
              return (
                <button
                  key={stage.id}
                  onClick={() => setStageFilter(isActive ? 'all' : stage.id)}
                  className={cn(
                    "p-3 rounded-2xl border text-left transition-all relative overflow-hidden",
                    isActive
                      ? "bg-indigo-900 text-white border-indigo-900 shadow-md ring-2 ring-indigo-400"
                      : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <StageIcon className={cn("w-4 h-4", isActive ? "text-indigo-300" : "text-slate-400")} />
                    <span className={cn(
                      "text-xs font-black px-1.5 py-0.5 rounded-md",
                      isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-800"
                    )}>
                      {count}
                    </span>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-tight truncate">{stage.shortLabel}</div>
                  <div className="text-[8px] opacity-70 truncate">{stage.description}</div>
                </button>
              );
            })}
          </div>

          {/* Work Order Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredWorkOrders.length === 0 ? (
              <div className="col-span-full bg-white rounded-3xl p-16 border border-slate-200 text-center space-y-3">
                <Layers className="w-12 h-12 mx-auto text-slate-300" />
                <h4 className="text-base font-black text-slate-700 uppercase tracking-wider">Kayıtlı İş Emri Bulunamadı</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Seçili filtreye uygun aktif iş emri yok. Satış Siparişleri Havuzundan siparişleri üretime alabilir veya yukarıdan yeni iş emri açabilirsiniz.
                </p>
              </div>
            ) : (
              filteredWorkOrders.map(wo => {
                const product = productMap.get(wo.productId);
                const stageInfo = getStageInfo(wo.currentStage);
                const StageIcon = getStageIcon(wo.currentStage);

                return (
                  <div
                    key={wo.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3 group relative overflow-hidden"
                  >
                    {/* Top Stage & Barcode Row */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 border",
                          stageInfo.color
                        )}>
                          <StageIcon className="w-3 h-3" />
                          {stageInfo.shortLabel}
                        </span>
                      </div>

                      <span className="font-mono text-[10px] font-black text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                        {wo.barcode}
                      </span>
                    </div>

                    {/* Product & Order Details */}
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {product?.code || 'KODSUZ'}
                          </div>
                          <h4 className="text-sm font-black text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                            {product?.name || 'Bilinmeyen Ürün'}
                          </h4>
                        </div>
                        {product?.image && (
                          <img 
                            src={product.image} 
                            alt="" 
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" 
                          />
                        )}
                      </div>

                      {/* Variant & Order info */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        {wo.color && (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold uppercase">
                            Renk: {wo.color}
                          </span>
                        )}
                        {wo.size && (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold uppercase">
                            Beden: {wo.size}
                          </span>
                        )}
                        {wo.orderNumber && (
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase">
                            Sip: {wo.orderNumber}
                          </span>
                        )}
                      </div>

                      {wo.customerName && (
                        <div className="text-[10px] text-slate-500 font-medium truncate flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          {wo.customerName}
                        </div>
                      )}
                    </div>

                    {/* Quantity & Material Status */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase">Miktar</div>
                        <div className="text-base font-black text-slate-900">{wo.quantity} <span className="text-xs font-bold text-slate-500">Adet/Çift</span></div>
                      </div>

                      <div className="text-right">
                        {renderMaterialStatusBadge(wo.materialStatus, wo.productId)}
                      </div>
                    </div>

                    {/* Progress Bar (8 Stages) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[8px] font-black uppercase text-slate-400">
                        <span>İlerleme: {stageInfo.order} / 8</span>
                        <span>{Math.round((stageInfo.order / 8) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex">
                        <div 
                          className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${(stageInfo.order / 8) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openDetailedWorkOrderSheet(wo)}
                        className="p-2 rounded-xl bg-amber-100 hover:bg-amber-400 text-amber-950 text-xs font-black transition-all flex items-center justify-center shrink-0 shadow-xs"
                        title="Detaylı A4 Üretim & Kesim Kartelasını Görüntüle / Yazdır"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-amber-800" />
                      </button>

                      <button
                        type="button"
                        onClick={() => openTicketModal(wo)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center justify-center shrink-0"
                        title="İş Emri & Barkod Ref Kartı"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {wo.status !== 'completed' ? (
                        <button
                          type="button"
                          onClick={() => handleOpenStageTransition(wo)}
                          className="flex-1 py-2 px-3 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Sonraki Aşamaya Geç
                        </button>
                      ) : (
                        <div className="flex-1 py-2 px-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-black uppercase tracking-wider text-center flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Üretim Bitti
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SALES ORDERS POOL (SİPARİŞTEN ÜRETİME HAVUZ) */}
      {activeTab === 'orders_pool' && (
        <div className="space-y-4">
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <h4 className="text-sm font-black text-amber-900 uppercase">Satış Siparişleri & Üretim Entegrasyonu</h4>
                <p className="text-xs text-amber-700 font-medium">
                  Alınan ve onaylanan tüm satış siparişleri buraya düşer. Tek tuşla tüm kalemler için üretim iş emirleri ve proses barkodları oluşturabilirsiniz.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Sipariş No</th>
                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Müşteri / Cari</th>
                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Sipariş & Termin Tarihi</th>
                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Ürün Kalemleri</th>
                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Üretim Durumu</th>
                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingSalesOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400 font-bold text-xs uppercase">
                        Kayıtlı satış siparişi bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    pendingSalesOrders.map(order => {
                      return (
                        <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-4">
                            <div className="text-sm font-black text-slate-900">{order.orderNumber}</div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Satış Siparişi</span>
                          </td>
                          <td className="p-4">
                            <div className="text-xs font-black text-slate-800">{order.contactName}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-xs font-bold text-slate-700">
                              {new Date(order.date).toLocaleDateString('tr-TR')}
                            </div>
                            {order.deliveryDate && (
                              <div className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Termin: {new Date(order.deliveryDate).toLocaleDateString('tr-TR')}
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="space-y-1">
                              {order.items.map((item, idx) => {
                                const prod = productMap.get(item.productId);
                                const hasRecipe = recipeMap.has(item.productId);
                                return (
                                  <div key={idx} className="flex items-center gap-2 text-xs">
                                    <span className="font-bold text-slate-800">{prod?.name || 'Ürün'}</span>
                                    <span className="text-slate-400 font-medium">({item.quantity} Adet)</span>
                                    {!hasRecipe && (
                                      <button
                                        type="button"
                                        onClick={() => openRecipeModalForProduct(item.productId)}
                                        className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded hover:bg-amber-100"
                                      >
                                        + Reçete Yaz
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                          <td className="p-4">
                            {order.hasMissingWorkOrders ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3" /> Plana Alınmayı Bekliyor
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> Üretim Planında ({order.workOrderCount} İş Emri)
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleTransferOrderToProduction(order.id!)}
                              className="px-4 py-2 bg-indigo-600 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-xs"
                            >
                              ⚡ Üretim Planına Al
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MRP (MALZEME İHTİYAÇ PLANLAMASI) */}
      {activeTab === 'mrp' && (
        <div className="space-y-6">
          {/* MRP Header Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  Otomatik Malzeme İhtiyaç Planlaması (MRP)
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Aktif ve bekleyen tüm üretim iş emirlerinin reçetelerine göre gerekli hammadde ihtiyaçları anlık stok ile karşılaştırılır.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleCalculateMRP()}
                disabled={isMrpCalculating}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2"
              >
                <RefreshCw className={cn("w-4 h-4", isMrpCalculating && "animate-spin")} />
                Yeniden Hesapla
              </button>

              {(mrpResult?.shortageItemsCount || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setIsPurchaseOrderModalOpen(true)}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shadow-rose-100 animate-pulse"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Eksikler İçin Satın Alma Oluştur ({mrpResult?.shortageItemsCount})
                </button>
              )}
            </div>
          </div>

          {/* MRP Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Gerekli Hammadde ve Malzeme Listesi ({mrpResult?.items.length || 0} Kalem)
              </div>
              {mrpResult?.totalShortageCost ? (
                <div className="text-xs font-black text-rose-600">
                  Tahmini Eksik Tedarik Maliyeti: {mrpResult.totalShortageCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider w-10">
                      <input
                        type="checkbox"
                        checked={selectedMrpItems.length === (mrpResult?.items.length || 0) && selectedMrpItems.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMrpItems(mrpResult?.items.map(i => i.rawMaterialId) || []);
                          } else {
                            setSelectedMrpItems([]);
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Hammadde Kodu & Adı</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Toplam İhtiyaç</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Mevcut Stok</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Net Eksik / Fazla</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Durum</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Tahmini Maliyet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!mrpResult || mrpResult.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400 font-bold text-xs uppercase">
                        Aktif üretim emirlerinde hammadde ihtiyacı bulunamadı veya reçete tanımlanmamış.
                      </td>
                    </tr>
                  ) : (
                    mrpResult.items.map(item => {
                      const isSelected = selectedMrpItems.includes(item.rawMaterialId);
                      return (
                        <tr 
                          key={item.rawMaterialId} 
                          className={cn(
                            "hover:bg-slate-50 transition-colors",
                            item.status === 'shortage' && "bg-rose-50/30"
                          )}
                        >
                          <td className="p-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMrpItems([...selectedMrpItems, item.rawMaterialId]);
                                } else {
                                  setSelectedMrpItems(selectedMrpItems.filter(id => id !== item.rawMaterialId));
                                }
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-4">
                            <div className="text-xs font-black text-slate-900">{item.rawMaterialName}</div>
                            <div className="text-[10px] font-mono text-slate-400">{item.rawMaterialCode}</div>
                          </td>
                          <td className="p-4 text-right">
                            <span className="text-xs font-black text-slate-800">
                              {item.requiredQuantity} {item.unit}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <span className="text-xs font-bold text-slate-600">
                              {item.currentStock} {item.unit}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            {item.shortageQuantity > 0 ? (
                              <span className="text-xs font-black text-rose-600 bg-rose-100 px-2 py-0.5 rounded">
                                -{item.shortageQuantity} {item.unit}
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-emerald-600">
                                +{item.currentStock - item.requiredQuantity} {item.unit} (Yeterli)
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {item.status === 'shortage' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-100 text-rose-700 border border-rose-200">
                                Kritik Eksik
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">
                                Stok Yeterli
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <div className="text-xs font-black text-slate-800">
                              {item.estimatedCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                            </div>
                            <div className="text-[9px] text-slate-400">
                              Birim: {item.buyingPrice.toLocaleString('tr-TR')} ₺
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
        </div>
      )}

      {/* TAB 4: BARCODE OPERATOR TERMINAL */}
      {activeTab === 'barcode_terminal' && (
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" /> Canlı Barkod Okutma İstasyonu
                </span>
                <h3 className="text-xl font-black tracking-tight mt-1">İmalat Operatör Terminali</h3>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Operatör / Hat:</label>
                <input
                  type="text"
                  value={scannerOperator}
                  onChange={e => setScannerOperator(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-black text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Big Live Input */}
            <form onSubmit={handleBarcodeSubmit} className="space-y-3">
              <div className="relative">
                <Barcode className="w-8 h-8 absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
                <input
                  ref={barcodeInputRef}
                  autoFocus
                  type="text"
                  placeholder="Barkod okutun veya 'WO-000101' yazıp Enter'a basın..."
                  value={scannedCode}
                  onChange={e => setScannedCode(e.target.value)}
                  className="w-full pl-16 pr-32 py-5 bg-slate-800/90 border-2 border-indigo-500/50 rounded-2xl text-lg font-mono font-black text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 tracking-wider uppercase"
                />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md"
                >
                  Onayla & Geçir
                </button>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                <span>⚡ USB El Terminali / Barkod Okuyucu direkt algılanır.</span>
                <span>Her okutmada otomatik sesli geri bildirim verilir.</span>
              </div>
            </form>

            {/* Scan Feedback Banner */}
            <AnimatePresence>
              {scanFeedback && (
                <motion.div
                  key={`scan-feedback-${scanFeedback.timestamp.getTime()}`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "p-5 rounded-2xl border flex items-start gap-4 transition-all",
                    scanFeedback.type === 'success'
                      ? "bg-emerald-950/80 border-emerald-500 text-emerald-100"
                      : "bg-rose-950/80 border-rose-500 text-rose-100"
                  )}
                >
                  {scanFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-rose-400 shrink-0 mt-0.5" />
                  )}

                  <div className="flex-1 space-y-1">
                    <div className="text-sm font-black uppercase tracking-wide">
                      {scanFeedback.title}
                    </div>
                    <div className="text-xs opacity-90 font-medium">
                      {scanFeedback.message}
                    </div>
                    {scanFeedback.product && (
                      <div className="text-[11px] font-bold text-indigo-300 mt-2">
                        Model: {scanFeedback.product.name} ({scanFeedback.product.code}) • Miktar: {scanFeedback.workOrder?.quantity} Adet
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] font-mono opacity-60">
                    {scanFeedback.timestamp.toLocaleTimeString('tr-TR')}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Scan History Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Son Terminal İşlem Kayıtları
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Canlı Akış</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase">Saat</th>
                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase">Barkod</th>
                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase">Model / Ürün</th>
                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase">Önceki Aşama</th>
                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase">Yeni Aşama</th>
                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase text-center">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scanHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 text-xs font-bold uppercase">
                        Henüz barkod okutma işlemi yapılmadı.
                      </td>
                    </tr>
                  ) : (
                    scanHistory.map(hist => (
                      <tr key={hist.id} className="hover:bg-slate-50 text-xs">
                        <td className="p-3 font-mono font-bold text-slate-500">{hist.time}</td>
                        <td className="p-3 font-mono font-black text-indigo-600">{hist.barcode}</td>
                        <td className="p-3 font-black text-slate-900">{hist.productName}</td>
                        <td className="p-3 font-bold text-slate-500">{hist.prevStage}</td>
                        <td className="p-3 font-black text-emerald-600">{hist.newStage}</td>
                        <td className="p-3 text-center">
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded uppercase">
                            Tamamlandı
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: RECIPES (BoM) MANAGEMENT */}
      {activeTab === 'recipes' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Ürün Reçeteleri & Varyant BoM Yönetimi</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                1 adet veya 1 çift mamul üretimi için gereken hammadde, yarı mamul (taban, mostra vb.), aksesuar ve sarfiyat reçeteleri. Renk bazlı (örn: 2045 Siyah için 126 Taban Siyah) ve asorti matris eşlemeli tanımlanabilir.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const finishedProds = products?.filter(p => p.categoryType === 'finished' || (!p.categoryType && !p.isRawMaterial && p.categoryType !== 'semi_finished' && p.categoryType !== 'accessory')) || [];
                const firstId = finishedProds[0]?.id || 0;
                openRecipeModalForProduct(firstId, 'all');
              }}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4" /> Yeni Reçete Tanımla
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {products?.filter(p => p.categoryType === 'finished' || (!p.categoryType && !p.isRawMaterial && p.categoryType !== 'semi_finished' && p.categoryType !== 'accessory')).map(prod => {
              const allProdRecipes = recipes?.filter(r => r.productId === prod.id) || [];
              const hasGenericRecipe = allProdRecipes.some(r => !r.targetColor || r.targetColor === 'all');

              return (
                <div key={prod.id} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">{prod.code}</span>
                      <div className="flex items-center gap-1.5">
                        {allProdRecipes.length > 0 ? (
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {allProdRecipes.length} Reçete Tanımlı
                          </span>
                        ) : (
                          <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200">
                            Reçete Yok
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-base font-black text-slate-900 line-clamp-1">{prod.name}</h4>
                      {prod.brand && <p className="text-[11px] font-bold text-slate-400">{prod.brand} {prod.subType ? `• ${prod.subType}` : ''}</p>}
                    </div>

                    {/* Color Pills & Status */}
                    {prod.colors && prod.colors.length > 0 && (
                      <div className="space-y-1 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Model Renk Varyantları:</div>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {prod.colors.map(col => {
                            const colorRecipe = allProdRecipes.find(r => r.targetColor === col);
                            return (
                              <button
                                key={col}
                                type="button"
                                onClick={() => openRecipeModalForProduct(prod.id!, col)}
                                className={cn(
                                  "text-[10px] font-black px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all",
                                  colorRecipe
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                                    : hasGenericRecipe
                                    ? "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100"
                                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                                )}
                              >
                                <span>{col}</span>
                                {colorRecipe ? (
                                  <span className="text-[8px] bg-emerald-200 text-emerald-900 px-1 rounded font-black">Özel</span>
                                ) : hasGenericRecipe ? (
                                  <span className="text-[8px] bg-sky-200 text-sky-900 px-1 rounded font-black">Genel</span>
                                ) : (
                                  <span className="text-[8px] text-amber-600 font-bold">+ Ekle</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Defined Recipes Detailed List */}
                    {allProdRecipes.length > 0 && (
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {allProdRecipes.map((rc, rcIdx) => (
                          <div key={`prod-${prod.id}-rc-${rc.id || rcIdx}-${rc.targetColor || 'genel'}`} className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-md uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                                {rc.targetColor ? `🎨 ${rc.targetColor} Reçetesi` : '🌐 Genel (Tüm Renkler)'}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openRecipeModalForProduct(prod.id!, rc.targetColor || 'all')}
                                  className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase"
                                >
                                  Düzenle
                                </button>
                                {rc.id && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRecipe(rc.id!)}
                                    className="text-[9px] font-black text-rose-500 hover:text-rose-700 uppercase"
                                  >
                                    Sil
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1">
                              {rc.ingredients.map((ing, i) => {
                                const matProd = productMap.get(ing.productId);
                                const isSemi = matProd?.categoryType === 'semi_finished';
                                const isAccessory = matProd?.categoryType === 'accessory';
                                return (
                                  <div key={i} className="flex items-center justify-between text-xs font-bold text-slate-700 bg-white p-1.5 rounded-xl border border-slate-100">
                                    <div className="truncate flex items-center gap-1.5">
                                      <span className={cn(
                                        "text-[8px] font-black px-1.5 py-0.2 rounded uppercase",
                                        isSemi ? "bg-sky-100 text-sky-800" : isAccessory ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                      )}>
                                        {isSemi ? 'Yarı Mamul' : isAccessory ? 'Aksesuar' : 'Hammadde'}
                                      </span>
                                      <span className="truncate text-slate-900">{matProd?.name || 'Malzeme'}</span>
                                      {ing.color && (
                                        <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">
                                          [{ing.color}]
                                        </span>
                                      )}
                                      {ing.isMatrixMatched && (
                                        <span className="text-[8px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200">
                                          🎯 Matrisli
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-indigo-600 font-black flex-shrink-0 ml-2">
                                      {ing.quantity} {ing.unit || matProd?.unit || 'Adet'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openRecipeModalForProduct(prod.id!)}
                      className="flex-1 py-2.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center shadow-xs"
                    >
                      {allProdRecipes.length > 0 ? "Reçeteleri Yönet / Ekle" : "+ İlk Reçeteyi Tanımla"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 6: PRODUCTION & SHOPFLOOR REPORTS */}
      {activeTab === 'reports' && (
        <ProductionReport />
      )}

      {/* MODAL 1: NEW MANUAL WORK ORDER */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Yeni Üretim İş Emri">
        <form onSubmit={handleCreateManualWorkOrder} className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Üretilecek Model / Mamul</label>
              <span className="text-[9px] font-bold text-indigo-600">Yalnızca Bitmiş Mamuller</span>
            </div>
            <select
              required
              name="productId"
              value={manualWoProductId || ''}
              onChange={e => {
                const pId = Number(e.target.value);
                setManualWoProductId(pId);
                const selectedP = productMap.get(pId);
                if (selectedP?.colors && selectedP.colors.length > 0) {
                  setManualWoColor(selectedP.colors[0]);
                }
              }}
              className="w-full border border-slate-300 rounded-xl p-3 text-sm font-bold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">Mamul Model Seçiniz...</option>
              {products?.filter(p => p.categoryType === 'finished' || (!p.categoryType && !p.isRawMaterial && p.categoryType !== 'semi_finished' && p.categoryType !== 'accessory')).map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code}) {p.subType ? `• ${p.subType}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Quick Color Selector if model has colors */}
          {manualWoProductId > 0 && productMap.get(manualWoProductId)?.colors && (
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Model Renk Seçimi:</label>
              <div className="flex flex-wrap gap-1.5">
                {productMap.get(manualWoProductId)!.colors!.map(col => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setManualWoColor(col)}
                    className={cn(
                      "text-xs font-black px-3 py-1.5 rounded-lg border transition-all uppercase",
                      manualWoColor === col
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-300 hover:border-indigo-300"
                    )}
                  >
                    {col}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Üretim Miktarı (Çift / Adet)</label>
              <input
                type="number"
                required
                min="1"
                defaultValue="100"
                name="quantity"
                className="w-full border border-slate-300 rounded-xl p-3 text-sm font-black text-slate-900 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hedef Bitiş Tarihi</label>
              <input
                type="date"
                name="targetDate"
                className="w-full border border-slate-300 rounded-xl p-3 text-sm font-bold text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Renk / Varyant</label>
              <input
                type="text"
                name="color"
                value={manualWoColor}
                onChange={e => setManualWoColor(e.target.value)}
                placeholder="Örn: Siyah"
                className="w-full border border-slate-300 rounded-xl p-3 text-sm font-bold text-slate-900 focus:outline-none uppercase"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Beden / Asorti (Opsiyonel)</label>
              <input
                type="text"
                name="size"
                value={manualWoSize}
                onChange={e => setManualWoSize(e.target.value)}
                placeholder="Örn: 40-44 Asorti"
                className="w-full border border-slate-300 rounded-xl p-3 text-sm font-bold text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Notlar / Özel Talimatlar</label>
            <textarea
              name="notes"
              rows={2}
              placeholder="Örn: Kalıp 224 kullanılacak, özel logo baskısı yapılacak..."
              className="w-full border border-slate-300 rounded-xl p-3 text-sm font-medium text-slate-900 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md"
          >
            İş Emrini Başlat & Barkod Oluştur
          </button>
        </form>
      </Modal>

      {/* MODAL 2: RECIPE (BoM) BUILDER */}
      <Modal isOpen={isRecipeModalOpen} onClose={() => setIsRecipeModalOpen(false)} title="Ürün Reçetesi (BoM) Tanımla" className="max-w-3xl">
        <form onSubmit={handleSaveRecipe} className="space-y-6">
          {/* Target Product Selection */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Hedef Mamul / Model</label>
            <select
              required
              value={selectedProductId}
              onChange={e => {
                const newId = Number(e.target.value);
                const prod = productMap.get(newId);
                const colorToUse = prod?.colors && prod.colors.length > 0 ? prod.colors[0] : 'all';
                loadRecipeForProductAndColor(newId, colorToUse);
              }}
              className="w-full border border-slate-300 rounded-xl p-3 text-sm font-black text-slate-900 bg-white focus:outline-none"
            >
              <option value="0">Model Seçiniz...</option>
              {products?.filter(p => p.categoryType === 'finished' || (!p.categoryType && !p.isRawMaterial && p.categoryType !== 'semi_finished' && p.categoryType !== 'accessory')).map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code}) {p.subType ? `• ${p.subType}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Target Variant / Color Tabs */}
          {selectedProductId > 0 && (
            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-indigo-600" />
                  Reçete Rengi / Hedef Varyant
                </label>
                <span className="text-[10px] text-slate-400 font-bold">
                  {selectedRecipeTargetColor === 'all' ? 'Tüm renkler için geçerli varsayılan reçete' : `${selectedRecipeTargetColor} rengine özel reçete`}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {/* Generic Option */}
                <button
                  type="button"
                  onClick={() => loadRecipeForProductAndColor(selectedProductId, 'all')}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all",
                    selectedRecipeTargetColor === 'all'
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                  )}
                >
                  🌐 Genel (Tüm Renkler)
                </button>

                {/* Specific Colors defined on the finished good */}
                {productMap.get(selectedProductId)?.colors?.map(col => {
                  const hasColorRecipe = recipes?.some(r => r.productId === selectedProductId && r.targetColor === col);
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => loadRecipeForProductAndColor(selectedProductId, col)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all flex items-center gap-1.5",
                        selectedRecipeTargetColor === col
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300"
                      )}
                    >
                      <span>{col}</span>
                      {hasColorRecipe && (
                        <span className={cn(
                          "text-[8px] px-1.5 py-0.2 rounded font-black",
                          selectedRecipeTargetColor === col ? "bg-indigo-800 text-white" : "bg-emerald-100 text-emerald-800"
                        )}>
                          ✓ Tanımlı
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Custom Color Input */}
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="+ Özel Renk..."
                    className="border border-slate-200 bg-white rounded-xl px-2.5 py-1 text-xs font-bold uppercase w-28 focus:outline-none focus:border-indigo-500"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) {
                          loadRecipeForProductAndColor(selectedProductId, val);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Ingredients Rows */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                  Reçete Bileşenleri & Yarı Mamuller
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  1 adet veya 1 çift mamul üretimi için harcanacak hammadde, taban ve sarfiyatlar
                </span>
              </div>
              <button
                type="button"
                onClick={() => setRecipeIngredients([
                  ...recipeIngredients, 
                  { 
                    productId: 0, 
                    color: selectedRecipeTargetColor !== 'all' ? selectedRecipeTargetColor : undefined,
                    quantity: 1, 
                    unit: 'Adet',
                    isMatrixMatched: false
                  }
                ])}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Malzeme / Yarı Mamul Ekle
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {recipeIngredients.map((ing, idx) => {
                const selectedMat = productMap.get(ing.productId);
                const isSemi = selectedMat?.categoryType === 'semi_finished';
                return (
                  <div key={idx} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                    {/* Row 1: Department + Part Name + Material Select */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                      {/* Department Select */}
                      <div className="md:col-span-3">
                        <select
                          value={ing.department || 'KESİM'}
                          onChange={e => {
                            const next = [...recipeIngredients];
                            next[idx].department = e.target.value;
                            setRecipeIngredients(next);
                          }}
                          className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-black text-amber-900 bg-amber-50 focus:outline-none uppercase"
                        >
                          <option value="KESİM">🟡 KESİM</option>
                          <option value="BASKI">🟡 BASKI</option>
                          <option value="SAYA">🟡 SAYA</option>
                          <option value="BAĞCIK">🟡 BAĞCIK</option>
                          <option value="MONTA">🟡 MONTA</option>
                          <option value="TEMİZLEME">🟡 TEMİZLEME</option>
                          <option value="DİĞER">⚪ DİĞER</option>
                        </select>
                      </div>

                      {/* Part Name / Açıklama */}
                      <div className="md:col-span-3">
                        <input
                          type="text"
                          placeholder="Açıklama / Parça (Örn: ÇEMBER)"
                          value={ing.partName || ''}
                          onChange={e => {
                            const next = [...recipeIngredients];
                            next[idx].partName = e.target.value;
                            setRecipeIngredients(next);
                          }}
                          className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-black text-blue-700 bg-white uppercase focus:outline-none"
                          list="part-suggestions"
                        />
                        <datalist id="part-suggestions">
                          <option value="ÇEMBER" />
                          <option value="NAL" />
                          <option value="GAMBA" />
                          <option value="CIRT" />
                          <option value="KUŞ" />
                          <option value="FORT" />
                          <option value="YÜZ" />
                          <option value="DİL" />
                          <option value="KONÇ" />
                          <option value="GAMBA ASTAR" />
                          <option value="DİL ASTAR" />
                          <option value="VİZO" />
                          <option value="FORT BASKI" />
                          <option value="GAMBA BASKI" />
                          <option value="KUŞ BASKISI" />
                          <option value="CIRT BASKISI" />
                          <option value="DİL ALTI ETİKET" />
                          <option value="KAPSÜL" />
                          <option value="CIRT TOKA" />
                          <option value="MOSTRA ETİKETİ" />
                          <option value="BAĞCIK" />
                          <option value="TABAN" />
                          <option value="FUSPET" />
                          <option value="KOLİ" />
                          <option value="KUTU" />
                          <option value="İÇ KAĞIT" />
                          <option value="PELUR" />
                          <option value="ZİNCİR" />
                          <option value="TANITIM KARTI" />
                        </datalist>
                      </div>

                      {/* Material Select */}
                      <div className="md:col-span-6">
                        <select
                          required
                          value={ing.productId}
                          onChange={e => {
                            const newMatId = Number(e.target.value);
                            const next = [...recipeIngredients];
                            next[idx].productId = newMatId;
                            const mat = productMap.get(newMatId);
                            if (mat) {
                              next[idx].unit = mat.unit || 'Adet';
                              // Auto set isMatrixMatched if semi finished taban or has foot variant
                              if (mat.categoryType === 'semi_finished' || mat.isFootwear || mat.unit === 'Çift') {
                                next[idx].isMatrixMatched = true;
                              }
                              // Auto set ingredient color if material has matching colors
                              if (selectedRecipeTargetColor !== 'all' && mat.colors?.includes(selectedRecipeTargetColor)) {
                                next[idx].color = selectedRecipeTargetColor;
                              }
                            }
                            setRecipeIngredients(next);
                          }}
                          className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-black text-slate-800 bg-white focus:outline-none"
                        >
                          <option value="0">Malzeme Seçiniz...</option>
                          
                          {/* Yarı Mamuller (Taban, Mostra, Fuspet vs.) */}
                          <optgroup label="── 🏭 Yarı Mamuller (Taban, Mostra, Parça) ──">
                            {products?.filter(p => p.categoryType === 'semi_finished').map(p => (
                              <option key={`opt-semi-${p.id}`} value={p.id}>
                                [Yarı Mamul] {p.name} ({p.code}) {p.subType ? `• ${p.subType}` : ''} {p.colors && p.colors.length > 0 ? `[Renkler: ${p.colors.join(', ')}]` : ''}
                              </option>
                            ))}
                          </optgroup>

                          {/* Hammaddeler (Deri, Kumaş, EVA vs.) */}
                          <optgroup label="── 📦 Hammaddeler (Deri, Kumaş, Plaka) ──">
                            {products?.filter(p => (p.categoryType === 'raw_material' || (!p.categoryType && p.isRawMaterial)) && p.categoryType !== 'semi_finished').map(p => (
                              <option key={`opt-raw-${p.id}`} value={p.id}>
                                [Hammadde] {p.name} ({p.code}) {p.subType ? `• ${p.subType}` : ''} {p.colors && p.colors.length > 0 ? `[Renkler: ${p.colors.join(', ')}]` : ''}
                              </option>
                            ))}
                          </optgroup>

                          {/* Aksesuar & Sarf Malzemeler */}
                          <optgroup label="── ✂️ Aksesuar & Sarf Malzemeler ──">
                            {products?.filter(p => p.categoryType === 'accessory').map(p => (
                              <option key={`opt-acc-${p.id}`} value={p.id}>
                                [Aksesuar/Sarf] {p.name} ({p.code}) {p.subType ? `• ${p.subType}` : ''} {p.colors && p.colors.length > 0 ? `[Renkler: ${p.colors.join(', ')}]` : ''}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Color + Quantity + Unit + Delete */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                      {/* Material Color / Variant */}
                      <div className="md:col-span-5">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Kullanılacak Renk (Örn: SİYAH)"
                            value={ing.color || ''}
                            onChange={e => {
                              const next = [...recipeIngredients];
                              next[idx].color = e.target.value || undefined;
                              setRecipeIngredients(next);
                            }}
                            className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-white uppercase focus:outline-none"
                            list={`color-sug-${idx}`}
                          />
                          {Array.isArray(selectedMat?.colors) && selectedMat.colors.length > 0 && (
                            <datalist id={`color-sug-${idx}`}>
                              {Array.from(new Set(selectedMat.colors)).map((c, cIdx) => (
                                <option key={`col-sug-${idx}-${c}-${cIdx}`} value={c} />
                              ))}
                            </datalist>
                          )}
                        </div>
                      </div>

                      {/* Quantity */}
                      <div className="md:col-span-4">
                        <input
                          type="number"
                          step="0.00001"
                          min="0.00001"
                          required
                          placeholder="Birim Sarfiyat Miktarı"
                          value={ing.quantity}
                          onChange={e => {
                            const next = [...recipeIngredients];
                            next[idx].quantity = Number(e.target.value);
                            setRecipeIngredients(next);
                          }}
                          className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-black text-slate-800 text-center bg-white focus:outline-none"
                        />
                      </div>

                      {/* Unit */}
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          placeholder="Birim"
                          value={ing.unit || 'ADET'}
                          onChange={e => {
                            const next = [...recipeIngredients];
                            next[idx].unit = e.target.value;
                            setRecipeIngredients(next);
                          }}
                          className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-600 text-center bg-white uppercase focus:outline-none"
                        />
                      </div>

                      {/* Delete */}
                      <div className="md:col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx))}
                          className="p-2 text-rose-500 hover:bg-rose-100 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Matrix Matching Toggle & Explanation */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!ing.isMatrixMatched}
                          onChange={e => {
                            const next = [...recipeIngredients];
                            next[idx].isMatrixMatched = e.target.checked;
                            setRecipeIngredients(next);
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span className={cn(
                          "font-black text-[11px] uppercase tracking-wide",
                          ing.isMatrixMatched ? "text-emerald-700" : "text-slate-500"
                        )}>
                          🎯 Beden Matrisli (Asorti Eşlemeli)
                        </span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium italic">
                        {ing.isMatrixMatched 
                          ? '✓ Siparişteki 40,41,42 vb. ayakkabı adetleri, bu tabanın aynı numaralarından otomatik eksiltilir.'
                          : 'Adet bazlı sabit sarfiyat.'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tahmini Birim İşçilik Maliyeti (₺)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={recipeLaborCost}
                onChange={e => setRecipeLaborCost(Number(e.target.value))}
                placeholder="Örn: 25.50"
                className="w-full border border-slate-300 rounded-xl p-3 text-xs font-bold text-slate-900 bg-white focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Reçete Notları / Proses Bilgisi</label>
              <input
                type="text"
                value={recipeNotes}
                onChange={e => setRecipeNotes(e.target.value)}
                placeholder="Örn: 126 Taban için 224 nolu kalıp kullanılacaktır..."
                className="w-full border border-slate-300 rounded-xl p-3 text-xs font-medium text-slate-900 bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 bg-slate-900 hover:bg-indigo-600 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              {productMap.get(selectedProductId)?.name || 'Model'} {selectedRecipeTargetColor !== 'all' ? `(${selectedRecipeTargetColor} Rengi)` : '(Genel)'} Reçetesini Kaydet & MRP'ye Bağla
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: STAGE ADVANCEMENT MODAL */}
      <Modal isOpen={isStageTransitionModalOpen} onClose={() => setIsStageTransitionModalOpen(false)} title="Üretim Aşaması İlerlemesi">
        {selectedWorkOrder && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase">İş Emri & Model</div>
              <div className="text-base font-black text-slate-900">
                {productMap.get(selectedWorkOrder.productId)?.name} ({selectedWorkOrder.barcode})
              </div>
              <div className="text-xs font-bold text-indigo-700">
                Mevcut Aşama: {getStageInfo(selectedWorkOrder.currentStage).label}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hedef Aşama</label>
              <select
                value={transitionTargetStage}
                onChange={e => setTransitionTargetStage(e.target.value as ProductionStage)}
                className="w-full border border-slate-300 rounded-xl p-3 text-sm font-black text-slate-900 bg-white focus:outline-none"
              >
                {PRODUCTION_STAGES_CONFIG.map(st => (
                  <option key={st.id} value={st.id}>{st.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">İşleyen Operatör</label>
                <input
                  type="text"
                  placeholder="Örn: Ahmet Usta"
                  value={transitionOperator}
                  onChange={e => setTransitionOperator(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fire / Iskarta (Adet)</label>
                <input
                  type="number"
                  min="0"
                  value={transitionScrap}
                  onChange={e => setTransitionScrap(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aşama Notu</label>
              <input
                type="text"
                placeholder="Örn: Kesim tamamlandı, lazer baskıya aktarıldı."
                value={transitionNotes}
                onChange={e => setTransitionNotes(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-medium text-slate-800 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleExecuteStageTransition}
              className="w-full bg-indigo-600 hover:bg-slate-900 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md"
            >
              Aşamayı Onayla ve Geçişi Kaydet
            </button>
          </div>
        )}
      </Modal>

      {/* MODAL 4: WORK ORDER REF TICKET / BARCODE PRINT */}
      <Modal 
        isOpen={isTicketModalOpen} 
        onClose={() => {
          setIsTicketModalOpen(false);
          setTicketPrintNotice(null);
        }} 
        title="İş Emri & Proses Ref Kartı" 
        className="max-w-xl"
      >
        {ticketWorkOrder && (
          <div className="space-y-4">
            {/* Print Feedback Banner */}
            {ticketPrintNotice && (
              <div className="bg-amber-50 border border-amber-300 text-amber-950 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold print:hidden shadow-sm">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>{ticketPrintNotice.message}</span>
                  {ticketPrintNotice.blobUrl && (
                    <a
                      href={ticketPrintNotice.blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-bold text-indigo-700 hover:text-indigo-900 ml-1 inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Yazdırma Sayfasını Aç
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setTicketPrintNotice(null)}
                  className="p-1 hover:bg-amber-200/70 rounded-lg text-slate-600 cursor-pointer"
                  title="Kapat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div id="printable-ticket" className="bg-white p-6 rounded-3xl border-2 border-slate-900 space-y-4 text-black">
              {/* Header */}
              <div className="flex items-center justify-between border-b-2 border-black pb-3">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">PRO-ERP İŞ EMRİ REFAKAT KARTI</h3>
                  <p className="text-[10px] font-mono font-bold">TAKİP NO: {ticketWorkOrder.barcode}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold font-mono">{new Date().toLocaleDateString('tr-TR')}</span>
                </div>
              </div>

              {/* Product Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-300">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Model Adı / Kodu</span>
                  <span className="text-sm font-black text-black">
                    {productMap.get(ticketWorkOrder.productId)?.name} ({productMap.get(ticketWorkOrder.productId)?.code})
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Üretim Miktarı</span>
                  <span className="text-sm font-black text-black">{ticketWorkOrder.quantity} Çift / Adet</span>
                </div>
                {ticketWorkOrder.orderNumber && (
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Sipariş / Müşteri</span>
                    <span className="text-xs font-black text-black">{ticketWorkOrder.orderNumber} - {ticketWorkOrder.customerName || ''}</span>
                  </div>
                )}
                {ticketWorkOrder.color && (
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Varyant / Renk</span>
                    <span className="text-xs font-black text-black">{ticketWorkOrder.color} {ticketWorkOrder.size ? `(${ticketWorkOrder.size})` : ''}</span>
                  </div>
                )}
              </div>

              {/* Main Work Order Barcode */}
              <div className="p-3 bg-white border border-slate-300 rounded-2xl flex flex-col items-center justify-center">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">İş Emri Ana Barkodu</div>
                <BarcodeSvg value={ticketWorkOrder.barcode} height={50} showText={true} />
              </div>

              {/* Process Stages Quick Barcodes */}
              <div className="space-y-2">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-600">Proses Aşama Ref Kodları</div>
                <div className="grid grid-cols-4 gap-1.5 text-center text-[8px] font-bold font-mono">
                  {PRODUCTION_STAGES_CONFIG.slice(1, 7).map(st => (
                    <div key={st.id} className="p-1.5 rounded-lg border border-slate-300 bg-slate-50">
                      <div className="text-[8px] font-black uppercase text-slate-800 mb-0.5">{st.shortLabel}</div>
                      <BarcodeSvg value={`${ticketWorkOrder.barcode}-${st.id.slice(0, 3).toUpperCase()}`} height={24} showText={false} />
                      <span className="text-[7px] text-slate-500">{ticketWorkOrder.barcode}-{st.id.slice(0, 3).toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsTicketModalOpen(false);
                  openDetailedWorkOrderSheet(ticketWorkOrder);
                }}
                className="py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-400/20 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" /> Detaylı A4 Kartelayı Aç
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isDownloadingTicketPdf}
                  onClick={handleDownloadTicketPdf}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  {isDownloadingTicketPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> PDF...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" /> PDF İndir
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isPrintingTicket}
                  onClick={handlePrintTicket}
                  className="py-2.5 px-5 bg-slate-900 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  {isPrintingTicket ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Yazıcı Açılıyor...
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4" /> Barkod Kartını Yazdır
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 4B: DETAILED A4 WORK ORDER & CUTTING SHEET MODAL (AYAKKABI STANDART KARTELA) */}
      <DetailedWorkOrderCardModal
        isOpen={isDetailedSheetModalOpen}
        onClose={() => setIsDetailedSheetModalOpen(false)}
        workOrder={detailedSheetWorkOrder}
        product={detailedSheetWorkOrder ? productMap.get(detailedSheetWorkOrder.productId) : undefined}
        recipe={detailedSheetWorkOrder?.productId ? (recipes?.find(r => r.productId === detailedSheetWorkOrder.productId && (!r.targetColor || r.targetColor === 'all' || r.targetColor === detailedSheetWorkOrder.color)) || recipes?.find(r => r.productId === detailedSheetWorkOrder.productId)) : undefined}
        allProducts={products || []}
        customer={contacts?.find(c => c.name === detailedSheetWorkOrder?.customerName || c.code === detailedSheetWorkOrder?.customerCode)}
        onSaveWorkOrder={handleSaveDetailedWorkOrder}
      />

      {/* MODAL 5: AUTO PURCHASE ORDER FROM MRP */}
      <Modal isOpen={isPurchaseOrderModalOpen} onClose={() => setIsPurchaseOrderModalOpen(false)} title="MRP'den Otomatik Satın Alma Siparişi Oluştur">
        <div className="space-y-4">
          <p className="text-xs text-slate-600 font-medium">
            Seçilen {selectedMrpItems.length} kalem eksik hammadde için doğrudan tedarikçi Alış Siparişi oluşturulacaktır.
          </p>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tedarikçi Seçimi</label>
            <select
              value={mrpSupplierId || ''}
              onChange={e => setMrpSupplierId(Number(e.target.value) || null)}
              className="w-full border border-slate-300 rounded-xl p-3 text-sm font-black text-slate-900 bg-white focus:outline-none"
            >
              <option value="">Otomatik / Varsayılan Tedarikçi</option>
              {contacts?.filter(c => c.type === 'supplier').map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5 max-h-40 overflow-y-auto">
            {mrpResult?.items.filter(i => selectedMrpItems.includes(i.rawMaterialId) && i.shortageQuantity > 0).map(i => (
              <div key={i.rawMaterialId} className="flex justify-between text-xs font-bold text-slate-800">
                <span>{i.rawMaterialName}</span>
                <span className="text-rose-600 font-black">{i.shortageQuantity} {i.unit} ({i.estimatedCost.toLocaleString('tr-TR')} ₺)</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCreatePurchaseOrderFromMRP}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-rose-100"
          >
            Alış Siparişini Onayla ve Kaydet
          </button>
        </div>
      </Modal>
    </div>
  );
}
