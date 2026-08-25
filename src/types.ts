export type EntityType = 'customer' | 'supplier' | 'both';
export type TransactionType = 'income' | 'expense';
export type InventoryMoveType = 'in' | 'out' | 'production_in' | 'production_out';

export interface Contact {
  id?: number;
  code?: string;                 // Cari Kodu (örn: CAR-001, MUS-0001, TED-0002)
  name: string;                  // Firma Ünvanı / Cari Adı
  companyTitle?: string;         // Resmi Ticari Ünvan
  contactPerson?: string;        // Yetkili Kişi
  type: EntityType;              // 'customer' | 'supplier' | 'both'
  category?: string;             // Toptancı, Perakende, Fason Saya, Taban Tedarikçisi, Aksesuar vs.
  email?: string;
  phone?: string;                // Sabit Telefon
  mobile?: string;               // GSM / Cep
  website?: string;
  address?: string;              // Fatura Adresi
  shippingAddress?: string;      // Sevkiyat / Depo Teslim Adresi
  city?: string;                 // İl
  district?: string;             // İlçe
  country?: string;              // Ülke
  taxOffice?: string;            // Vergi Dairesi
  taxNumber?: string;            // Vergi No
  tcKimlik?: string;             // TC Kimlik No
  paymentTermDays?: number;      // Vade Günü (örn: 30, 45, 60 gün)
  creditLimit?: number;          // Kredi / Risk Limiti (₺)
  discountRate?: number;         // Özel İskonto Oranı (%)
  bankName?: string;             // Banka Adı
  iban?: string;                 // IBAN Numarası
  bankAccountName?: string;      // Hesap Sahibi
  balance: number;               // Cari Bakiye
  notes?: string;                // Özel Notlar
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AssortmentTemplate {
  id?: number;
  name: string;
  items: {
    size: string;
    quantity: number;
  }[];
}

export interface BarcodeVariant {
  size: string;
  color: string;
  barcode: string;
  stock?: number;
}

export interface AppSettings {
  id?: string; // 'global'
  barcodeType: 'EAN-13' | 'CODE-128' | 'CODE-39';
  barcodePrefix?: string;
  nextBarcodeSequence: number;
}

export type StockCategoryType = 'finished' | 'semi_finished' | 'raw_material' | 'accessory';
export type ProductCategoryType = StockCategoryType;

export interface Product {
  id?: number;
  code: string;
  name: string;
  categoryType?: StockCategoryType; // 'finished' | 'semi_finished' | 'raw_material' | 'accessory'
  hasSizeVariants?: boolean;        // true for finished goods and size-variant semi-finished (Taban, Mostra, Fuspet, Salpa)
  subType?: string;                 // e.g. 'Taban', 'Mostra', 'Fuspet', 'Salpa', 'Saya', 'Deri', 'Tekstil', 'Toka', 'Bağcık', 'Yapıştırıcı'
  unit: string;                     // 'Çift', 'Adet', 'dm²', 'm²', 'Metre', 'Kg', 'Litre', 'Tabaka', 'Paket', 'Koli', 'Bobin', 'Rulo'
  secondaryUnit?: string;           // e.g., "Çift"
  multiplier?: number;              // e.g., 10 (items per box)
  stock: number;
  minStock: number;
  buyingPrice: number;
  sellingPrice: number;
  isRawMaterial: boolean;           // Compatibility flag (true for raw materials & accessories)
  // Barcode support
  colorBoxBarcodes?: { color: string, barcode: string }[];
  variantBarcodes?: BarcodeVariant[];
  // Footwear & variant specific
  isFootwear?: boolean;             // Compatibility flag (true for finished goods & size-based semi-finished)
  colors?: string[];
  assortmentTemplateId?: number;    // Linked template
  assortment?: {
    size: string;
    quantity: number;
  }[];
  category?: string;
  brand?: string;
  image?: string;                   // Base64 or URL
  colorImages?: { color: string, image: string }[];
  shelf?: string;
  location?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductVariant {
  color: string;
  size: string;
  barcode: string;
  stock: number;
  shelf?: string;
  location?: string;
}

export interface RecipeIngredient {
  productId: number;
  color?: string;                  // Malzeme / Yarı mamul rengi (Örn: Siyah)
  quantity: number;                // 1 çift/adet mamul için sarfiyat
  unit?: string;                   // Çift, dm2, Adet, Kg, Metre vb.
  isMatrixMatched?: boolean;       // Numara/Beden Matris Eşleşmeli (Taban, Mostra, Fuspet için sipariş asortisi ile 1:1 eşleşir)
  notes?: string;
}

export interface Recipe {
  id?: number;
  productId: number;               // Mamul Ürün ID
  targetColor?: string;            // Belirli bir renk varyantı reçetesi mi (Örn: "Siyah" veya "Tüm Renkler")
  name?: string;
  ingredients: RecipeIngredient[];
  notes?: string;
  laborCost?: number;
  estimatedTimeMinutes?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ProductionStage = 
  | 'planning'         // Planlama & Reçete Hazırlık
  | 'cutting'          // Kesim (Saya / Taban)
  | 'printing'         // Baskı & Nakış & Lazer
  | 'sewing'           // Saya Dikim & Çatım
  | 'assembly'         // Montaj & Kalıplama & Tabanlama
  | 'finishing'        // Finisaj & Temizlik
  | 'quality_packing'  // Kalite Kontrol & Paketleme / Kolileme
  | 'completed';       // Tamamlandı (Mamul Depo)

export interface WorkOrderStageLog {
  stage: ProductionStage;
  stageName: string;
  status: 'pending' | 'in_progress' | 'completed';
  startedAt?: Date;
  completedAt?: Date;
  operator?: string;
  completedQuantity?: number;
  scrapQuantity?: number; // Fire adedi
  notes?: string;
}

export type MaterialReadinessStatus = 
  | 'no_recipe'            // Reçete Tanımlı Değil
  | 'pending_mrp'          // İhtiyaç Hesaplanmadı
  | 'materials_shortage'   // Eksik Hammadde Var
  | 'materials_ready'      // Malzemeler Yeterli / Hazır
  | 'materials_consumed';  // Malzemeler Üretimde Harcandı

export interface WorkOrder {
  id?: number;
  productId: number;
  quantity: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
  targetDate?: Date;
  
  // Link to Sales Order
  orderId?: number;
  orderItemId?: number;
  orderNumber?: string;
  customerName?: string;
  
  // Product Variant info
  color?: string;
  size?: string;
  
  // Stages & Progress
  currentStage: ProductionStage;
  stages?: WorkOrderStageLog[];
  
  // MRP & Materials
  materialStatus?: MaterialReadinessStatus;
  recipeId?: number;
  
  // Barcode & Tracking
  barcode: string; // e.g. "WO-001024"
  notes?: string;
  operator?: string;
}

export interface MrpRequirementItem {
  rawMaterialId: number;
  rawMaterialName: string;
  rawMaterialCode: string;
  color?: string;
  categoryType?: ProductCategoryType;
  isMatrixMatched?: boolean;
  unit: string;
  currentStock: number;
  requiredQuantity: number;
  shortageQuantity: number; // max(0, required - currentStock)
  status: 'sufficient' | 'shortage';
  buyingPrice: number;
  estimatedCost: number;
  workOrderCount: number;
  affectedWorkOrderIds: number[];
}

export interface MrpCalculationResult {
  calculatedAt: Date;
  totalWorkOrders: number;
  totalRequiredMaterialsCount: number;
  shortageItemsCount: number;
  totalShortageCost: number;
  items: MrpRequirementItem[];
}

export interface Transaction {
  id?: number;
  contactId?: number;
  type: TransactionType;
  amount: number;
  description: string;
  date: Date;
  category: string;
  paymentMethod?: 'cash' | 'bank_transfer' | 'credit_card' | 'check' | 'other';
  documentNo?: string;
  orderId?: number;
}

export type OrderType = 'purchase' | 'sales';
export type OrderStatus = 'draft' | 'confirmed' | 'partially_shipped' | 'completed' | 'cancelled';
export type InvoicingStatus = 'not_invoiced' | 'partially_invoiced' | 'fully_invoiced';

export interface Order {
  id?: number;
  type: OrderType;
  orderNumber: string;
  contactId: number;
  date: Date;
  deliveryDate?: Date;
  status: OrderStatus;
  invoicingStatus?: InvoicingStatus;
  invoicedTotal?: number;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  notes?: string;
  currency: string;
}

export interface OrderItem {
  id?: number;
  orderId: number;
  productId: number;
  color?: string;
  size?: string;
  quantity: number;
  shippedQuantity: number;
  invoicedQuantity?: number;     // Şu ana kadar faturalandırılan miktar (kısmi fatura takibi)
  unitPrice: number;
  taxRate: number; // e.g., 20 for %20
  discountRate: number;
  total: number;
}

export type InvoiceType = 'sales' | 'purchase';
export type InvoiceStatus = 'draft' | 'issued' | 'cancelled';
export type InvoiceScenario = 'commercial' | 'basic' | 'return' | 'withholding' | 'export';
export type InvoicePaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface Invoice {
  id?: number;
  invoiceNumber: string;         // e.g., SAT-2026-000001, ALS-2026-000001 or GIB e-Archive No
  type: InvoiceType;             // 'sales' = Satış Faturası | 'purchase' = Alış Faturası
  scenario: InvoiceScenario;     // 'commercial' (Ticari) | 'basic' (Temel) | 'return' (İade) | 'withholding' (Tevkifatlı) | 'export' (İhracat)
  contactId: number;             // Müşteri veya Tedarikçi
  orderId?: number;              // Bağlı Sipariş (opsiyonel)
  orderNumber?: string;
  date: Date;                    // Fatura Tarihi
  dueDate?: Date;                // Vade Tarihi
  ettn?: string;                 // e-Fatura UUID / ETTN
  subtotal: number;              // KDV Hariç Matrah Toplamı (₺)
  discountTotal: number;         // Toplam İskonto Tutarı (₺)
  taxTotal: number;              // Toplam KDV Tutarı (₺)
  withholdingRate?: number;      // Tevkifat Oranı (örn: 0, 2, 3, 5, 7, 9 -> 5/10)
  withholdingAmount?: number;    // Tevkifat KDV Tutarı (₺)
  grandTotal: number;            // Ödenecek / Fatura Toplam Tutarı (₺)
  currency: string;              // 'TRY' | 'USD' | 'EUR'
  exchangeRate?: number;
  paymentStatus: InvoicePaymentStatus; // 'unpaid' | 'partial' | 'paid'
  paidAmount?: number;
  status: InvoiceStatus;         // 'draft' | 'issued' | 'cancelled'
  notes?: string;
  isStockDeducted?: boolean;     // Otomatik stok hareketi yapıldı mı
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InvoiceItem {
  id?: number;
  invoiceId: number;
  productId?: number;
  orderItemId?: number;          // Bağlı sipariş kalemi
  productCode: string;
  productName: string;
  color?: string;
  size?: string;
  quantity: number;              // Faturalanan Miktar (Çift / Adet)
  unit: string;                  // 'Çift', 'Adet', 'Metre', 'Kg', 'Paket' vb.
  unitPrice: number;             // Birim Fiyat (KDV Hariç)
  discountRate: number;          // İskonto %
  discountAmount: number;        // İskonto Tutarı
  taxRate: number;               // KDV % (0, 1, 10, 20)
  taxAmount: number;             // KDV Tutarı
  total: number;                 // Satır Net Tutarı (KDV Dahil)
}

export interface InventoryLog {
  id?: number;
  productId: number;
  type: InventoryMoveType;
  quantity: number;
  date: Date;
  description: string;
}
