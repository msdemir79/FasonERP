import React, { useState, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { 
  Package, 
  Plus, 
  Search, 
  AlertTriangle, 
  ArrowDown, 
  ArrowUp, 
  Palette, 
  Ruler, 
  Eye, 
  Trash2, 
  ChevronRight, 
  Hash, 
  X, 
  Barcode, 
  Settings, 
  Image as ImageIcon, 
  Camera, 
  Printer,
  Sparkles,
  Layers,
  Check,
  Edit2,
  Filter,
  Boxes,
  HelpCircle,
  Tag,
  ShoppingBag,
  Scissors,
  Wrench,
  Grid,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import Modal from './Modal';
import { erpService } from '../services/erpService';
import BarcodePrintModal from './BarcodePrintModal';
import { resizeAndOptimizeImage } from '../utils/imageUtils';
import { StockCategoryType, Product, AssortmentTemplate, BarcodeVariant } from '../types';

// Category Definitions & Configurations
export interface CategoryConfig {
  id: StockCategoryType;
  title: string;
  subtitle: string;
  badge: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  icon: any;
  defaultUnits: string[];
  subTypes: string[];
}

export const CATEGORY_CONFIGS: Record<StockCategoryType, CategoryConfig> = {
  finished: {
    id: 'finished',
    title: 'Mamul (Bitmiş Ayakkabı)',
    subtitle: 'Satışa hazır spor, klasik, bot, terlik ve sneaker modelleri',
    badge: 'MAMUL',
    colorClass: 'indigo',
    bgClass: 'bg-indigo-50/80',
    borderClass: 'border-indigo-200',
    textClass: 'text-indigo-700',
    icon: ShoppingBag,
    defaultUnits: ['Çift', 'Koli', 'Adet'],
    subTypes: ['Spor', 'Sneaker', 'Bot & Çizme', 'Klasik', 'Loafer', 'Sandalet', 'Terlik', 'Çocuk Ayakkabısı', 'Güvenlik & İş']
  },
  semi_finished: {
    id: 'semi_finished',
    title: 'Yarı Mamul (Taban / Parça)',
    subtitle: 'Bedenli taban, mostra, fuspet, salpa veya standart ökçe, saya parçaları',
    badge: 'YARI MAMUL',
    colorClass: 'sky',
    bgClass: 'bg-sky-50/80',
    borderClass: 'border-sky-200',
    textClass: 'text-sky-700',
    icon: Layers,
    defaultUnits: ['Çift', 'Adet', 'Takım', 'Paket'],
    subTypes: ['Taban (Sole)', 'Mostra (Astar)', 'Fuspet (Tabanlık)', 'İç Taban (Salpa)', 'Saya Parçası', 'Ökçe / Topuk', 'Bombe & Fort', 'Çelik Bel']
  },
  raw_material: {
    id: 'raw_material',
    title: 'Hammadde (Deri / Kumaş)',
    subtitle: 'Metraj veya alan bazlı vidala, süet, astar deri, tekstil, eva plaka',
    badge: 'HAMMADDE',
    colorClass: 'amber',
    bgClass: 'bg-amber-50/80',
    borderClass: 'border-amber-200',
    textClass: 'text-amber-700',
    icon: Scissors,
    defaultUnits: ['dm²', 'm²', 'Metre', 'Kg', 'Ayak (Sqft)', 'Tabaka', 'Rulo', 'Litre'],
    subTypes: ['Vidala Deri', 'Nubuk Deri', 'Süet Deri', 'Astar Deri', 'Tekstil Kumaş', 'Kanvas', 'Eva Levha', 'Kauçuk Hamuru', 'Sünger', 'Neolit / Köstek']
  },
  accessory: {
    id: 'accessory',
    title: 'Aksesuar & Sarf Malzeme',
    subtitle: 'Toka, bağcık, fermuar, yapıştırıcı ilaç, boya, kutu ve koli sarfları',
    badge: 'AKSESUAR & SARF',
    colorClass: 'emerald',
    bgClass: 'bg-emerald-50/80',
    borderClass: 'border-emerald-200',
    textClass: 'text-emerald-700',
    icon: Wrench,
    defaultUnits: ['Adet', 'Çift', 'Paket', 'Kutu', 'Koli', 'Kg', 'Litre', 'Bobin', 'Rulo', 'Teneke'],
    subTypes: ['Bağcık', 'Toka', 'Fermuar', 'Kuşgözü & Zımba', 'Arma & Logo', 'Yapıştırıcı / İlaç', 'Sertleştirici & Primer', 'Boya & Cila', 'Dikiş İpliği', 'Ayakkabı Kutusu', 'Koli & Ambalaj']
  }
};

export default function Inventory() {
  const products = useLiveQuery(() => db.products.toArray());
  const templates = useLiveQuery(() => db.assortmentTemplates.toArray());
  const tdhpAccounts = useLiveQuery(() => db.accounts.toArray());

  // Navigation & Filter States
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<'all' | StockCategoryType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [filterVariantOnly, setFilterVariantOnly] = useState(false);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Active Tab inside Add/Edit Modal: 'general' | 'matrix' | 'images' | 'barcodes' | 'accounting'
  const [activeTab, setActiveTab] = useState<'general' | 'matrix' | 'images' | 'barcodes' | 'accounting'>('general');
  const [barcodeSubTab, setBarcodeSubTab] = useState<'box' | 'variants'>('box');

  // Form State for Stock Card
  const [categoryType, setCategoryType] = useState<StockCategoryType>('finished');
  const [hasSizeVariants, setHasSizeVariants] = useState<boolean>(true);
  const [subType, setSubType] = useState<string>('Spor');
  
  const [productForm, setProductForm] = useState({
    code: '',
    name: '',
    brand: '',
    unit: 'Çift',
    shelf: '',
    location: '',
    stock: 0,
    minStock: 5,
    buyingPrice: 0,
    sellingPrice: 0,
    multiplier: 1,
    secondaryUnit: 'Çift',
    accountingCode: '157.01',
    salesAccountCode: '600.01',
    purchaseAccountCode: '620.01',
    vatRate: 20,
    notes: ''
  });

  // Variant & Matrix Data
  const [colors, setColors] = useState<string[]>([]);
  const [newColor, setNewColor] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>(undefined);
  const [colorBoxBarcodes, setColorBoxBarcodes] = useState<{ color: string; barcode: string }[]>([]);
  const [variantBarcodes, setVariantBarcodes] = useState<BarcodeVariant[]>([]);
  const [matrixData, setMatrixData] = useState<Record<string, Record<string, number>>>({});

  // Image upload state
  const [mainImage, setMainImage] = useState<string | undefined>(undefined);
  const [colorImages, setColorImages] = useState<{ color: string; image: string }[]>([]);

  // Adjust Stock modal state
  const [adjustData, setAdjustData] = useState({
    type: 'in' as 'in' | 'out',
    quantity: 1,
    selectedColor: '',
    selectedSize: '',
    description: 'Manuel stok düzeltme'
  });

  // Template Manager state
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateItems, setNewTemplateItems] = useState<{ size: string; quantity: number }[]>([
    { size: '40', quantity: 1 },
    { size: '41', quantity: 2 },
    { size: '42', quantity: 3 },
    { size: '43', quantity: 3 },
    { size: '44', quantity: 2 },
    { size: '45', quantity: 1 }
  ]);

  // Barcode Settings state
  const [barcodeSettings, setBarcodeSettings] = useState<{
    barcodeType: 'EAN-13' | 'CODE-128' | 'CODE-39';
    barcodePrefix: string;
    nextBarcodeSequence: number;
  }>({
    barcodeType: 'CODE-128',
    barcodePrefix: '869',
    nextBarcodeSequence: 1000000
  });

  // Load barcode settings when opening settings modal
  React.useEffect(() => {
    if (isSettingsModalOpen) {
      erpService.getBarcodeSettings().then(s => {
        setBarcodeSettings({
          barcodeType: s.barcodeType || 'CODE-128',
          barcodePrefix: s.barcodePrefix || '869',
          nextBarcodeSequence: s.nextBarcodeSequence || 1000000
        });
      });
    }
  }, [isSettingsModalOpen]);

  // Helper to determine active category of a product
  const getProductCategoryType = (p: Product): StockCategoryType => {
    if (p.categoryType) return p.categoryType;
    if (p.isRawMaterial) {
      // Check subType or unit to distinguish accessory vs raw material
      const lowerName = (p.name || '').toLowerCase();
      const lowerCat = (p.category || '').toLowerCase();
      if (
        lowerName.includes('toka') || lowerName.includes('bağcık') || lowerName.includes('fermuar') || 
        lowerName.includes('ilaç') || lowerName.includes('yapıştırıcı') || lowerName.includes('kutu') || 
        lowerCat.includes('aksesuar') || lowerCat.includes('sarf')
      ) {
        return 'accessory';
      }
      return 'raw_material';
    }
    if (p.isFootwear || (p.variantBarcodes && p.variantBarcodes.length > 0)) {
      const lowerName = (p.name || '').toLowerCase();
      if (lowerName.includes('taban') || lowerName.includes('mostra') || lowerName.includes('fuspet') || lowerName.includes('salpa') || lowerName.includes('ökçe')) {
        return 'semi_finished';
      }
      return 'finished';
    }
    return 'finished';
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    if (!products) return [];

    return products.filter(p => {
      const pCat = getProductCategoryType(p);

      // Category tab filter
      if (selectedCategoryTab !== 'all' && pCat !== selectedCategoryTab) {
        return false;
      }

      // Low stock filter
      if (filterLowStock && p.stock > p.minStock) {
        return false;
      }

      // Variant only filter
      if (filterVariantOnly && !p.hasSizeVariants && !p.isFootwear && (!p.variantBarcodes || p.variantBarcodes.length === 0)) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesCode = p.code?.toLowerCase().includes(term);
        const matchesName = p.name?.toLowerCase().includes(term);
        const matchesBrand = p.brand?.toLowerCase().includes(term);
        const matchesCategory = p.category?.toLowerCase().includes(term);
        const matchesSubType = p.subType?.toLowerCase().includes(term);
        const matchesShelf = p.shelf?.toLowerCase().includes(term);
        const matchesColors = p.colors?.some(c => c.toLowerCase().includes(term));
        const matchesBarcode = p.colorBoxBarcodes?.some(b => b.barcode.includes(term)) || p.variantBarcodes?.some(v => v.barcode.includes(term));

        if (!matchesCode && !matchesName && !matchesBrand && !matchesCategory && !matchesSubType && !matchesShelf && !matchesColors && !matchesBarcode) {
          return false;
        }
      }

      return true;
    });
  }, [products, selectedCategoryTab, searchTerm, filterLowStock, filterVariantOnly]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = {
      all: products?.length || 0,
      finished: 0,
      semi_finished: 0,
      raw_material: 0,
      accessory: 0
    };
    if (products) {
      products.forEach(p => {
        const cat = getProductCategoryType(p);
        counts[cat] = (counts[cat] || 0) + 1;
      });
    }
    return counts;
  }, [products]);

  // Reset form handler
  const resetForm = () => {
    setCategoryType('finished');
    setHasSizeVariants(true);
    setSubType('Spor');
    setProductForm({
      code: '',
      name: '',
      brand: '',
      unit: 'Çift',
      shelf: '',
      location: '',
      stock: 0,
      minStock: 5,
      buyingPrice: 0,
      sellingPrice: 0,
      multiplier: 1,
      secondaryUnit: 'Çift',
      accountingCode: '157.01',
      salesAccountCode: '600.01',
      purchaseAccountCode: '620.01',
      vatRate: 20,
      notes: ''
    });
    setColors([]);
    setNewColor('');
    setSelectedTemplateId(undefined);
    setColorBoxBarcodes([]);
    setVariantBarcodes([]);
    setMatrixData({});
    setMainImage(undefined);
    setColorImages([]);
    setIsEditMode(false);
    setSelectedProduct(null);
    setActiveTab('general');
  };

  // Open Add Modal
  const handleOpenAddModal = (initialCategory?: StockCategoryType) => {
    resetForm();
    const cat = initialCategory || (selectedCategoryTab === 'all' ? 'finished' : selectedCategoryTab);
    applyCategoryChange(cat);
    setIsAddModalOpen(true);
  };

  // Change category handler in form
  const applyCategoryChange = (newCat: StockCategoryType) => {
    setCategoryType(newCat);
    const config = CATEGORY_CONFIGS[newCat];
    
    if (newCat === 'finished') {
      setHasSizeVariants(true);
      setProductForm(prev => ({
        ...prev,
        unit: 'Çift',
        secondaryUnit: 'Çift',
        multiplier: 1,
        accountingCode: '157.01',
        salesAccountCode: '600.01',
        purchaseAccountCode: '620.01',
        vatRate: 20
      }));
      setSubType(config.subTypes[0] || 'Spor');
      if (colors.length === 0) setColors(['SİYAH', 'BEYAZ']);
      if (!selectedTemplateId && templates && templates.length > 0) {
        setSelectedTemplateId(templates[0].id);
      }
    } else if (newCat === 'semi_finished') {
      // Default to size-variant for Taban/Mostra
      setHasSizeVariants(true);
      setProductForm(prev => ({
        ...prev,
        unit: 'Çift',
        secondaryUnit: 'Çift',
        multiplier: 1,
        accountingCode: '152.01',
        salesAccountCode: '600.01',
        purchaseAccountCode: '710.01',
        vatRate: 20
      }));
      setSubType('Taban (Sole)');
      if (colors.length === 0) setColors(['SİYAH', 'BEYAZ']);
      // Pick Taban/Fuspet template if exists
      const tabanTmpl = templates?.find(t => t.name.toLowerCase().includes('taban') || t.name.toLowerCase().includes('fuspet'));
      if (tabanTmpl) {
        setSelectedTemplateId(tabanTmpl.id);
      } else if (templates && templates.length > 0) {
        setSelectedTemplateId(templates[0].id);
      }
    } else if (newCat === 'raw_material') {
      setHasSizeVariants(false);
      setProductForm(prev => ({
        ...prev,
        unit: 'dm²',
        secondaryUnit: 'dm²',
        multiplier: 1,
        accountingCode: '150.01',
        salesAccountCode: '600.20',
        purchaseAccountCode: '150.01',
        vatRate: 20
      }));
      setSubType(config.subTypes[0] || 'Vidala Deri');
      if (colors.length === 0) setColors(['SİYAH', 'BEYAZ', 'GRİ']);
    } else if (newCat === 'accessory') {
      setHasSizeVariants(false);
      setProductForm(prev => ({
        ...prev,
        unit: 'Adet',
        secondaryUnit: 'Adet',
        multiplier: 1,
        accountingCode: '150.02',
        salesAccountCode: '600.20',
        purchaseAccountCode: '150.02',
        vatRate: 20
      }));
      setSubType(config.subTypes[0] || 'Bağcık');
      if (colors.length === 0) setColors(['SİYAH', 'BEYAZ']);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (product: Product) => {
    setSelectedProduct(product);
    setIsEditMode(true);

    const cat = getProductCategoryType(product);
    setCategoryType(cat);
    setHasSizeVariants(product.hasSizeVariants ?? (cat === 'finished' || Boolean(product.isFootwear && product.assortmentTemplateId)));
    setSubType(product.subType || product.category || (cat === 'finished' ? 'Spor' : 'Standart'));

    setProductForm({
      code: product.code || '',
      name: product.name || '',
      brand: product.brand || '',
      unit: product.unit || 'Çift',
      shelf: product.shelf || '',
      location: product.location || '',
      stock: product.stock || 0,
      minStock: product.minStock || 5,
      buyingPrice: product.buyingPrice || 0,
      sellingPrice: product.sellingPrice || 0,
      multiplier: product.multiplier || 1,
      secondaryUnit: product.secondaryUnit || product.unit || 'Çift',
      accountingCode: product.accountingCode || (cat === 'finished' ? '157.01' : cat === 'semi_finished' ? '152.01' : '150.01'),
      salesAccountCode: product.salesAccountCode || '600.01',
      purchaseAccountCode: product.purchaseAccountCode || (cat === 'finished' ? '620.01' : '150.01'),
      vatRate: product.vatRate ?? 20,
      notes: product.notes || ''
    });

    setColors(product.colors ? [...product.colors] : []);
    setSelectedTemplateId(product.assortmentTemplateId);
    setColorBoxBarcodes(product.colorBoxBarcodes ? [...product.colorBoxBarcodes] : []);
    setVariantBarcodes(product.variantBarcodes ? [...product.variantBarcodes] : []);
    setMainImage(product.image);
    setColorImages(product.colorImages ? [...product.colorImages] : []);

    // Reconstruct matrix data from variantBarcodes if available
    const matrix: Record<string, Record<string, number>> = {};
    if (product.variantBarcodes && product.variantBarcodes.length > 0) {
      product.variantBarcodes.forEach(vb => {
        if (!matrix[vb.color]) matrix[vb.color] = {};
        matrix[vb.color][vb.size] = vb.stock || 0;
      });
    }
    setMatrixData(matrix);

    setActiveTab('general');
    setIsAddModalOpen(true);
  };

  // Color add/remove
  const addColor = () => {
    if (!newColor.trim()) return;
    const clean = newColor.trim().toUpperCase();
    if (!colors.includes(clean)) {
      setColors([...colors, clean]);
    }
    setNewColor('');
  };

  const removeColor = (colorToRemove: string) => {
    setColors(colors.filter(c => c !== colorToRemove));
    setColorBoxBarcodes(colorBoxBarcodes.filter(b => b.color !== colorToRemove));
    setVariantBarcodes(variantBarcodes.filter(v => v.color !== colorToRemove));
    setColorImages(colorImages.filter(ci => ci.color !== colorToRemove));
  };

  // Image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await resizeAndOptimizeImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.85 });
        setMainImage(base64);
      } catch (err) {
        console.error('Error optimizing image:', err);
      }
    }
  };

  const handleColorImageUpload = async (color: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await resizeAndOptimizeImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.85 });
        setColorImages(prev => {
          const filtered = prev.filter(ci => ci.color !== color);
          return [...filtered, { color, image: base64 }];
        });
      } catch (err) {
        console.error('Error optimizing color image:', err);
      }
    }
  };

  // Barcode Generation
  const handleGenerateBarcodes = async () => {
    const activeTemplate = templates?.find(t => t.id === (selectedTemplateId || selectedProduct?.assortmentTemplateId));
    const effectiveAssortment = activeTemplate ? activeTemplate.items : (selectedProduct?.assortment || []);

    const productPayload = {
      isFootwear: hasSizeVariants,
      hasSizeVariants,
      colors: colors.length > 0 ? colors : ['Genel'],
      assortment: effectiveAssortment
    };

    try {
      const { colorBoxBarcodes: generatedBox, variantBarcodes: generatedVar } = await erpService.generateAutomatedBarcodes(productPayload);
      
      // Preserve existing stock counts in matrix if any
      const updatedVars = generatedVar.map(gv => {
        const existingStock = matrixData[gv.color]?.[gv.size] || 0;
        return { ...gv, stock: existingStock };
      });

      setColorBoxBarcodes(generatedBox);
      setVariantBarcodes(updatedVars);
    } catch (err) {
      console.error('Barcode generation error:', err);
    }
  };

  // Auto-distribute total stock proportionally based on template ratios
  const handleAutoDistributeStock = (totalAmount: number) => {
    const activeTemplate = templates?.find(t => t.id === (selectedTemplateId || selectedProduct?.assortmentTemplateId));
    if (!activeTemplate || activeTemplate.items.length === 0 || colors.length === 0) return;

    const totalRatio = activeTemplate.items.reduce((acc, it) => acc + (it.quantity || 1), 0);
    const amountPerColor = Math.floor(totalAmount / colors.length);

    const newMatrix: Record<string, Record<string, number>> = {};

    colors.forEach(col => {
      newMatrix[col] = {};
      activeTemplate.items.forEach(it => {
        const proportion = it.quantity / totalRatio;
        const itemStock = Math.round(amountPerColor * proportion);
        newMatrix[col][it.size] = itemStock;
      });
    });

    setMatrixData(newMatrix);

    // Update variantBarcodes stocks
    setVariantBarcodes(prev => prev.map(vb => {
      const s = newMatrix[vb.color]?.[vb.size] || 0;
      return { ...vb, stock: s };
    }));

    // Update total stock
    let calculatedTotal = 0;
    Object.values(newMatrix).forEach(sizes => {
      Object.values(sizes).forEach(qty => {
        calculatedTotal += qty;
      });
    });
    setProductForm(prev => ({ ...prev, stock: calculatedTotal }));
  };

  // Form Submit (Add or Edit)
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productForm.name.trim() || !productForm.code.trim()) {
      alert('Lütfen Stok Kodu ve Malzeme/Ürün Adını eksiksiz giriniz.');
      return;
    }

    const activeTemplate = templates?.find(t => t.id === (selectedTemplateId || selectedProduct?.assortmentTemplateId));
    const effectiveAssortment = hasSizeVariants ? (activeTemplate ? activeTemplate.items : (selectedProduct?.assortment || [])) : undefined;

    // Calculate total stock from matrix if size-variant based
    let finalStock = Number(productForm.stock) || 0;
    let finalVariantBarcodes = variantBarcodes;

    if (hasSizeVariants && Object.keys(matrixData).length > 0) {
      let matrixTotal = 0;
      Object.entries(matrixData).forEach(([col, sizes]) => {
        Object.entries(sizes).forEach(([size, qty]) => {
          matrixTotal += Number(qty) || 0;
        });
      });

      if (matrixTotal > 0 || !isEditMode) {
        finalStock = matrixTotal;
      }

      // Sync variantBarcodes with matrix stocks
      if (finalVariantBarcodes.length > 0) {
        finalVariantBarcodes = finalVariantBarcodes.map(vb => ({
          ...vb,
          stock: matrixData[vb.color]?.[vb.size] !== undefined ? matrixData[vb.color][vb.size] : (vb.stock || 0)
        }));
      }
    }

    const payload: Partial<Product> = {
      code: productForm.code.trim().toUpperCase(),
      name: productForm.name.trim(),
      brand: productForm.brand.trim(),
      categoryType,
      hasSizeVariants,
      subType,
      category: subType,
      unit: productForm.unit,
      secondaryUnit: productForm.secondaryUnit || productForm.unit,
      multiplier: Number(productForm.multiplier) || 1,
      stock: finalStock,
      minStock: Number(productForm.minStock) || 0,
      buyingPrice: Number(productForm.buyingPrice) || 0,
      sellingPrice: Number(productForm.sellingPrice) || 0,
      isRawMaterial: categoryType === 'raw_material' || categoryType === 'accessory',
      isFootwear: categoryType === 'finished' || (categoryType === 'semi_finished' && hasSizeVariants),
      shelf: productForm.shelf.trim(),
      location: productForm.location.trim(),
      accountingCode: productForm.accountingCode?.trim() || undefined,
      salesAccountCode: productForm.salesAccountCode?.trim() || undefined,
      purchaseAccountCode: productForm.purchaseAccountCode?.trim() || undefined,
      vatRate: Number(productForm.vatRate) || 20,
      notes: productForm.notes.trim(),
      colors: colors && colors.length > 0 ? colors : undefined,
      assortmentTemplateId: hasSizeVariants ? selectedTemplateId : undefined,
      assortment: effectiveAssortment,
      colorBoxBarcodes: colorBoxBarcodes.length > 0 ? colorBoxBarcodes : undefined,
      variantBarcodes: finalVariantBarcodes.length > 0 ? finalVariantBarcodes : undefined,
      image: mainImage,
      colorImages: colorImages.length > 0 ? colorImages : undefined,
      updatedAt: new Date()
    };

    try {
      if (isEditMode && selectedProduct?.id) {
        await erpService.updateProduct(selectedProduct.id, payload);
      } else {
        await erpService.addProduct({
          ...payload,
          createdAt: new Date()
        });
      }

      setIsAddModalOpen(false);
      resetForm();
    } catch (err: any) {
      console.error('Error saving product:', err);
      alert('Kayıt kaydedilirken bir hata oluştu: ' + (err.message || err));
    }
  };

  // Delete product handler
  const handleDeleteProduct = async (id: number) => {
    try {
      setDeleteError(null);
      await erpService.deleteProduct(id);
      setDeleteConfirmId(null);
      setIsDetailModalOpen(false);
      setSelectedProduct(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Ürün silinemedi.');
    }
  };

  // Adjust Stock submit handler
  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct?.id) return;

    try {
      const variant = (selectedProduct.hasSizeVariants || selectedProduct.isFootwear) && adjustData.selectedColor && adjustData.selectedSize
        ? { color: adjustData.selectedColor, size: adjustData.selectedSize }
        : undefined;

      await erpService.adjustStock(
        selectedProduct.id,
        Number(adjustData.quantity) || 1,
        adjustData.type,
        adjustData.description,
        variant
      );

      setIsAdjustModalOpen(false);
      setSelectedProduct(null);
    } catch (err: any) {
      alert('Stok hareketi işlenirken hata oluştu: ' + (err.message || err));
    }
  };

  // Assortment Template Save
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;

    try {
      await db.assortmentTemplates.add({
        name: newTemplateName.trim(),
        items: newTemplateItems
      });
      setNewTemplateName('');
      alert('Asorti şablonu başarıyla eklendi.');
    } catch (err) {
      console.error('Template save error:', err);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (confirm('Bu asorti şablonunu silmek istediğinize emin misiniz?')) {
      await db.assortmentTemplates.delete(id);
    }
  };

  // Barcode Settings Save
  const handleSaveBarcodeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await erpService.updateBarcodeSettings(barcodeSettings);
      setIsSettingsModalOpen(false);
      alert('Barkod ayarları başarıyla güncellendi.');
    } catch (err) {
      console.error('Barcode settings error:', err);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Primary Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Stok & Malzeme Envanteri</h1>
              <p className="text-xs font-semibold text-slate-400">
                Mamul ayakkabı, bedenli yarı mamul (taban/mostra/fuspet), hammadde ve sarf malzeme kartları
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all shadow-sm"
          >
            <Ruler className="w-4 h-4 text-indigo-500" />
            <span>Asorti Şablonları</span>
          </button>

          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all shadow-sm"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>Barkod Yapılandırması</span>
          </button>

          <button
            onClick={() => handleOpenAddModal()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Stok Kartı</span>
          </button>
        </div>
      </div>

      {/* Category Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* All items */}
        <button
          onClick={() => setSelectedCategoryTab('all')}
          className={cn(
            "p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between group",
            selectedCategoryTab === 'all'
              ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/10"
              : "bg-white border-slate-200/80 hover:border-slate-300 text-slate-800"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={cn(
              "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md",
              selectedCategoryTab === 'all' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
            )}>
              TÜMÜ
            </span>
            <Boxes className={cn("w-4 h-4", selectedCategoryTab === 'all' ? "text-white/70" : "text-slate-400")} />
          </div>
          <div>
            <div className="text-2xl font-black">{categoryCounts.all}</div>
            <div className={cn("text-[11px] font-semibold mt-0.5", selectedCategoryTab === 'all' ? "text-slate-300" : "text-slate-500")}>
              Toplam Stok Kartı
            </div>
          </div>
        </button>

        {/* 4 Specialized Categories */}
        {(Object.keys(CATEGORY_CONFIGS) as StockCategoryType[]).map(catKey => {
          const cfg = CATEGORY_CONFIGS[catKey];
          const IconComp = cfg.icon;
          const isSelected = selectedCategoryTab === catKey;

          return (
            <button
              key={catKey}
              onClick={() => setSelectedCategoryTab(catKey)}
              className={cn(
                "p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between group",
                isSelected
                  ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/10"
                  : "bg-white border-slate-200/80 hover:border-slate-300 text-slate-800"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md",
                  isSelected ? "bg-white/20 text-white" : `${cfg.bgClass} ${cfg.textClass}`
                )}>
                  {cfg.badge}
                </span>
                <IconComp className={cn("w-4 h-4", isSelected ? "text-white/70" : "text-slate-400")} />
              </div>
              <div>
                <div className="text-2xl font-black">{categoryCounts[catKey]}</div>
                <div className={cn("text-[11px] font-semibold mt-0.5 truncate", isSelected ? "text-slate-300" : "text-slate-500")}>
                  {cfg.title.split(' ')[0]} Kartları
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Stok Kodu, Ürün Adı, Marka, Barkod veya Renk ile ara..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setFilterLowStock(!filterLowStock)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border",
              filterLowStock
                ? "bg-rose-50 border-rose-200 text-rose-700 shadow-sm"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            )}
          >
            <AlertTriangle className={cn("w-3.5 h-3.5", filterLowStock ? "text-rose-600" : "text-slate-400")} />
            <span>Kritik Stok</span>
          </button>

          <button
            onClick={() => setFilterVariantOnly(!filterVariantOnly)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border",
              filterVariantOnly
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            )}
          >
            <Grid className={cn("w-3.5 h-3.5", filterVariantOnly ? "text-indigo-600" : "text-slate-400")} />
            <span>Bedenli / Matris</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300 mb-4">
              <Boxes className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Kayıtlı Stok Bulunamadı</h3>
            <p className="text-xs text-slate-400 font-semibold max-w-sm mt-1 mb-6">
              Arama kriterlerinize uygun kart bulunamadı veya henüz stok kartı eklenmedi.
            </p>
            <button
              onClick={() => handleOpenAddModal()}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" /> Yeni Stok Kartı Ekle
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-5">Stok / Malzeme Kartı</th>
                  <th className="py-4 px-4">Kategori & Tür</th>
                  <th className="py-4 px-4">Beden & Varyant</th>
                  <th className="py-4 px-4">Fiyat (Alış / Satış)</th>
                  <th className="py-4 px-4 text-right">Mevcut Stok</th>
                  <th className="py-4 px-5 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                {filteredProducts.map(product => {
                  const cat = getProductCategoryType(product);
                  const cfg = CATEGORY_CONFIGS[cat];
                  const isLow = product.stock <= (product.minStock || 0);
                  const isVariant = product.hasSizeVariants || product.isFootwear || (product.variantBarcodes && product.variantBarcodes.length > 0);

                  return (
                    <tr 
                      key={product.id} 
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Product Name & Code */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-6 h-6 text-slate-300" />
                            )}
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                {product.code}
                              </span>
                              {product.accountingCode && (
                                <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700" title={`TDHP Stok Hesabı: ${product.accountingCode}`}>
                                  TDHP: {product.accountingCode}
                                </span>
                              )}
                              {product.shelf && (
                                <span className="text-[9px] font-bold text-slate-400 uppercase">
                                  Raf: {product.shelf}
                                </span>
                              )}
                            </div>
                            <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {product.name}
                            </div>
                            {product.brand && (
                              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {product.brand}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                            `${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`
                          )}>
                            <cfg.icon className="w-3 h-3" />
                            {cfg.badge}
                          </span>
                          {product.subType && (
                            <div className="text-[10px] text-slate-500 font-bold uppercase">
                              {product.subType}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Variants / Sizes / Colors */}
                      <td className="py-3.5 px-4">
                        {(product.colors && product.colors.length > 0) || isVariant ? (
                          <div className="space-y-1.5">
                            {product.colors && product.colors.length > 0 ? (
                              <div className="flex items-center gap-1 flex-wrap">
                                {product.colors.map(col => (
                                  <span key={col} className="text-[9px] font-black uppercase px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                                    {col}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[9px] text-slate-400 font-bold">Matris Var</span>
                            )}
                            {product.variantBarcodes && product.variantBarcodes.length > 0 && (
                              <div className="text-[9px] font-mono text-indigo-600 font-bold">
                                {product.variantBarcodes.length} Beden Varyantı
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-semibold italic">Tekil Stok</span>
                        )}
                      </td>

                      {/* Prices */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="text-[11px] font-bold text-slate-700">
                            ₺{(product.sellingPrice || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[9px] text-slate-400 font-bold">
                            Alış: ₺{(product.buyingPrice || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </td>

                      {/* Current Stock */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="space-y-1">
                          <div className={cn(
                            "text-sm font-black font-mono inline-flex items-center gap-1",
                            isLow ? "text-rose-600" : "text-slate-900"
                          )}>
                            <span>{product.stock}</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{product.unit}</span>
                          </div>
                          {isLow && (
                            <div className="text-[9px] font-black text-rose-500 uppercase tracking-tight flex items-center justify-end gap-1">
                              <AlertTriangle className="w-3 h-3" /> Kritik (Min: {product.minStock})
                            </div>
                          )}
                          {product.multiplier && product.multiplier > 1 && product.secondaryUnit && (
                            <div className="text-[9px] text-indigo-500 font-bold uppercase">
                              ({product.stock * product.multiplier} {product.secondaryUnit})
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Detail Modal Button */}
                          <button
                            onClick={() => { setSelectedProduct(product); setIsDetailModalOpen(true); }}
                            title="Kart Detayı"
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Print Barcode Button */}
                          <button
                            onClick={() => { setSelectedProduct(product); setIsPrintModalOpen(true); }}
                            title="Barkod Yazdır"
                            className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors"
                          >
                            <Barcode className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Adjust Button */}
                          <button
                            onClick={() => {
                              setSelectedProduct(product);
                              setAdjustData({
                                type: 'in',
                                quantity: 1,
                                selectedColor: product.colors?.[0] || '',
                                selectedSize: product.variantBarcodes?.[0]?.size || '',
                                description: 'Stok hareketi'
                              });
                              setIsAdjustModalOpen(true);
                            }}
                            title="Stok Hareketi Giriş/Çıkış"
                            className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenEditModal(product)}
                            title="Kartı Düzenle"
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ADD / EDIT STOCK CARD MODAL                                              */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); resetForm(); }}
        title={isEditMode ? `Stok Kartını Düzenle: ${selectedProduct?.name}` : 'Yeni Stok Kartı Oluştur'}
        className="max-w-4xl"
      >
        <form onSubmit={handleSubmitProduct} className="space-y-6">
          {/* 4 Category Selection Buttons (Only active in Create mode) */}
          {!isEditMode && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                1. Stok Kategorisini Seçiniz
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(Object.keys(CATEGORY_CONFIGS) as StockCategoryType[]).map(catKey => {
                  const cfg = CATEGORY_CONFIGS[catKey];
                  const IconComp = cfg.icon;
                  const isSelected = categoryType === catKey;

                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => applyCategoryChange(catKey)}
                      className={cn(
                        "p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 relative",
                        isSelected
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <IconComp className={cn("w-5 h-5", isSelected ? "text-white" : "text-slate-500")} />
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase tracking-tight">{cfg.title.split(' ')[0]}</div>
                        <div className={cn("text-[10px] font-medium mt-0.5", isSelected ? "text-indigo-100" : "text-slate-400")}>
                          {cfg.badge}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Subtype customizable input and quick select chips */}
          <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Malzeme / Ürün Alt Türü (Serbestçe Yazabilir veya Seçebilirsiniz)</span>
                </label>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Aşağıdaki hazır önerilere tıklayabilir veya dilediğiniz özel tür adını doğrudan yazabilirsiniz.
                </p>
              </div>
              {categoryType === 'semi_finished' && (
                <label className="flex items-center gap-2 cursor-pointer bg-sky-50 hover:bg-sky-100/80 px-3 py-1.5 rounded-xl border border-sky-200 transition-colors flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={hasSizeVariants}
                    onChange={e => setHasSizeVariants(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-[10px] font-black text-sky-800 uppercase">
                    Beden / Numara Matrisi Desteği (Taban, Mostra, Fuspet, Salpa)
                  </span>
                </label>
              )}
            </div>

            {/* Direct Editable Input */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={subType}
                  onChange={e => {
                    const val = e.target.value;
                    setSubType(val);
                    if (categoryType === 'semi_finished') {
                      const lower = val.toLowerCase();
                      if (lower.includes('taban') || lower.includes('mostra') || lower.includes('fuspet') || lower.includes('salpa')) {
                        setHasSizeVariants(true);
                      }
                    }
                  }}
                  placeholder="Örn: Termo Taban, Poliüretan Taban, Vidala Deri, 8mm Eva, Ortopedik Mostra, Kilitli Toka..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none shadow-sm transition-all"
                  list="subtype-suggestions"
                />
                <datalist id="subtype-suggestions">
                  {(CATEGORY_CONFIGS[categoryType]?.subTypes || []).map(st => (
                    <option key={`top-st-${st}`} value={st} />
                  ))}
                </datalist>
              </div>

              {subType && (
                <button
                  type="button"
                  onClick={() => setSubType('')}
                  title="Temizle"
                  className="p-2.5 rounded-xl bg-slate-200/70 hover:bg-slate-300 text-slate-600 text-xs font-bold transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Suggestion Chips */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Hızlı Öneriler:</span>
              <div className="flex flex-wrap gap-1.5">
                {(CATEGORY_CONFIGS[categoryType]?.subTypes || []).map(st => {
                  const isSelected = subType?.toLowerCase().trim() === st.toLowerCase().trim();
                  return (
                    <button
                      key={`btn-st-${st}`}
                      type="button"
                      onClick={() => {
                        setSubType(st);
                        if (categoryType === 'semi_finished') {
                          if (st.includes('Taban') || st.includes('Mostra') || st.includes('Fuspet') || st.includes('Salpa')) {
                            setHasSizeVariants(true);
                          }
                        }
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border",
                        isSelected
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm font-black"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step Tabs Navigation */}
          <div className="flex border-b border-slate-200/80 gap-6">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={cn(
                "pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all",
                activeTab === 'general' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              1. Genel Bilgiler
            </button>
            {hasSizeVariants && (
              <button
                type="button"
                onClick={() => setActiveTab('matrix')}
                className={cn(
                  "pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all",
                  activeTab === 'matrix' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
                )}
              >
                2. Varyant & Matris
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('images')}
              className={cn(
                "pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all",
                activeTab === 'images' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              {hasSizeVariants ? '3.' : '2.'} Görsel Galerisi
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('barcodes')}
              className={cn(
                "pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all",
                activeTab === 'barcodes' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              {hasSizeVariants ? '4.' : '3.'} Barkod Yönetimi
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('accounting')}
              className={cn(
                "pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5",
                activeTab === 'accounting' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              <BookOpen className="w-3.5 h-3.5" />
              {hasSizeVariants ? '5.' : '4.'} Muhasebe (TDHP)
            </button>
          </div>

          {/* TAB 1: GENERAL INFO */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Stok / Malzeme Kodu *
                  </label>
                  <input
                    type="text"
                    required
                    value={productForm.code}
                    onChange={e => setProductForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="Örn: AYK-102, TAB-3645, VID-01"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold uppercase focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Stok Kartı / Malzeme Adı *
                  </label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={e => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Örn: Oxford Deri Klasik Ayakkabı, Termo Taban Siyah, Siyah Vidala Deri..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Marka / Model</label>
                  <input
                    type="text"
                    value={productForm.brand}
                    onChange={e => setProductForm(prev => ({ ...prev, brand: e.target.value }))}
                    placeholder="Örn: ProShoes, DeriSan..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Alt Tür (Özel Tanım)</label>
                    <span className="text-[9px] text-slate-400 font-bold">Özelleştirilebilir</span>
                  </div>
                  <input
                    type="text"
                    value={subType}
                    onChange={e => setSubType(e.target.value)}
                    placeholder="Örn: Termo Taban, 8mm Eva, Spor, Bot..."
                    className="w-full bg-slate-50 border border-indigo-200 rounded-xl p-3 text-xs font-bold text-indigo-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    list="subtype-general-suggestions"
                  />
                  <datalist id="subtype-general-suggestions">
                    {Array.from(new Set([
                      ...(CATEGORY_CONFIGS[categoryType]?.subTypes || []),
                      ...(products ? products.map(p => p.subType).filter(Boolean) as string[] : [])
                    ])).map(st => (
                      <option key={`gen-st-${st}`} value={st} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ana Birim *</label>
                  <select
                    value={productForm.unit}
                    onChange={e => setProductForm(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  >
                    {(CATEGORY_CONFIGS[categoryType]?.defaultUnits || ['Çift', 'Adet', 'Kg', 'dm²', 'Metre']).map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Depo Raf / Adres</label>
                  <input
                    type="text"
                    value={productForm.shelf}
                    onChange={e => setProductForm(prev => ({ ...prev, shelf: e.target.value }))}
                    placeholder="Örn: A-12, Taban-04..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
              </div>

              {/* Pricing & Stock Numbers */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Alış Fiyatı (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={productForm.buyingPrice}
                    onChange={e => setProductForm(prev => ({ ...prev, buyingPrice: Number(e.target.value) }))}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Satış Fiyatı (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={productForm.sellingPrice}
                    onChange={e => setProductForm(prev => ({ ...prev, sellingPrice: Number(e.target.value) }))}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-indigo-600 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {hasSizeVariants ? 'Toplam Stok (Oto)' : 'Başlangıç Stoğu'}
                  </label>
                  <input
                    type="number"
                    disabled={hasSizeVariants && Object.keys(matrixData).length > 0}
                    value={productForm.stock}
                    onChange={e => setProductForm(prev => ({ ...prev, stock: Number(e.target.value) }))}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-black outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Kritik Stok Uyarısı</label>
                  <input
                    type="number"
                    value={productForm.minStock}
                    onChange={e => setProductForm(prev => ({ ...prev, minStock: Number(e.target.value) }))}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none"
                  />
                </div>
              </div>

              {/* TDHP Muhasebe Özeti & Hızlı Erişim */}
              <div className="p-3.5 bg-gradient-to-r from-indigo-50/80 to-slate-50 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-sm">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center flex-wrap gap-1.5">
                      <span>TDHP Stok Kodu:</span>
                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-700 font-black">
                        {productForm.accountingCode || 'Belirtilmedi'}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        | Satış: <span className="font-mono text-slate-700 font-bold">{productForm.salesAccountCode || '600.01'}</span>
                        | Alış: <span className="font-mono text-slate-700 font-bold">{productForm.purchaseAccountCode || '150.01'}</span>
                        | KDV: <span className="font-mono text-slate-700 font-bold">%{productForm.vatRate ?? 20}</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Fatura ve stok hareketlerinde bu hesap kodlarına otomatik yevmiye kaydı işlenir.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('accounting')}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all whitespace-nowrap shadow-sm active:scale-95"
                >
                  Hesap Planı Detayları &rarr;
                </button>
              </div>

              {/* Color Options for ALL Categories (Deri, Kumaş, Bağcık, Mostra, Fuspet, Taban vb.) */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-indigo-600" />
                    <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                      Renk Seçenekleri & Varyantlar
                    </label>
                    <span className="text-[10px] font-black bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full border border-indigo-200">
                      {colors.length} Renk Tanımlı
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {categoryType === 'raw_material' ? 'Deri, Suni Deri, Kumaş, Astar renkleri' :
                     categoryType === 'accessory' ? 'Bağcık, Toka, İplik, Fermuar renkleri' :
                     categoryType === 'semi_finished' ? 'Mostra, Fuspet, Taban renk varyantları' : 'Ayakkabı renk varyantları'}
                  </span>
                </div>

                {/* Color Input and Popular Color Badges */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Renk adı yazıp Enter'a veya Ekle'ye basınız (Örn: SİYAH, BEYAZ, GRİ, TABA, FÜME)..."
                      value={newColor}
                      onChange={e => setNewColor(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addColor(); } }}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold uppercase focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                    <button
                      type="button"
                      onClick={addColor}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all"
                    >
                      Ekle
                    </button>
                  </div>

                  {/* Quick Color Suggestions */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Hızlı Seçim:</span>
                    {['SİYAH', 'BEYAZ', 'GRİ', 'TABA', 'KAHVE', 'LACİVERT', 'BEJ', 'BORDO', 'HAKİ', 'KIRMIZI', 'HARDAL', 'NUBUK', 'ŞEFFAF'].map(quickCol => {
                      const isAdded = colors.includes(quickCol);
                      return (
                        <button
                          key={quickCol}
                          type="button"
                          onClick={() => {
                            if (isAdded) {
                              removeColor(quickCol);
                            } else {
                              setColors([...colors, quickCol]);
                            }
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1",
                            isAdded
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                          )}
                        >
                          {quickCol}
                          {isAdded && <X className="w-2.5 h-2.5 ml-0.5 opacity-80" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Selected Colors Chips */}
                  {colors.length > 0 ? (
                    <div className="pt-2 flex flex-wrap gap-2">
                      {colors.map(col => (
                        <span
                          key={col}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-indigo-100 rounded-xl text-xs font-black uppercase text-indigo-950 shadow-sm"
                        >
                          <span className="w-2 h-2 rounded-full bg-indigo-600" />
                          {col}
                          <button
                            type="button"
                            onClick={() => removeColor(col)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 rounded-md hover:bg-rose-50"
                            title={`${col} rengini kaldır`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-medium">
                      ⚠️ Henüz bir renk eklenmedi. Örnek: Deniz suni deri için yukarıdan <b>SİYAH</b>, <b>BEYAZ</b> ve <b>GRİ</b> renklerini seçebilir veya özel renk yazabilirsiniz.
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-400 font-medium">
                  💡 Bu renkler üretim reçetelerinde (BoM), siparişlerde ve stok hareketlerinde otomatik filtrelenir ve malzeme eşleştirmelerinde kullanılır.
                </div>
              </div>

              {/* Next Step Button */}
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setActiveTab(hasSizeVariants ? 'matrix' : 'images')}
                  className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-600 transition-all shadow-md"
                >
                  <span>Sonraki Adım</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: VARIANT & MATRIX */}
          {activeTab === 'matrix' && hasSizeVariants && (
            <div className="space-y-6">
              {/* Color & Template selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                {/* Colors */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    1. Renk Varyantları
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Örn: Siyah, Kahve, Taba, Beyaz..."
                      value={newColor}
                      onChange={e => setNewColor(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addColor(); } }}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold uppercase outline-none"
                    />
                    <button
                      type="button"
                      onClick={addColor}
                      className="bg-slate-900 hover:bg-indigo-600 text-white px-4 rounded-xl font-bold text-xs"
                    >
                      Ekle
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {colors.map(col => (
                      <span key={col} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-black uppercase text-slate-700 shadow-sm">
                        {col}
                        <button type="button" onClick={() => removeColor(col)} className="text-slate-400 hover:text-rose-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Assortment Template */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    2. Asorti / Numara Şablonu
                  </label>
                  <select
                    value={selectedTemplateId || ''}
                    onChange={e => setSelectedTemplateId(Number(e.target.value) || undefined)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none"
                  >
                    <option value="">Şablon Seçiniz</option>
                    {templates?.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>

                  {/* Auto Distribute helper */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const total = prompt('Dağıtılacak toplam stok miktarını giriniz (Örn: 120):', '120');
                        if (total && !isNaN(Number(total))) {
                          handleAutoDistributeStock(Number(total));
                        }
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Şablon Oranlarına Göre Otomatik Dağıt
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Matrix Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Grid className="w-4 h-4 text-indigo-600" /> Canlı Stok Matrisi
                  </h4>
                  <div className="text-[10px] text-slate-400 font-bold">
                    Her numara için başlangıç veya güncel stok adetlerini giriniz
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-3 text-left font-black text-slate-600 uppercase w-32">Renk / Numara</th>
                        {templates?.find(t => t.id === (selectedTemplateId || selectedProduct?.assortmentTemplateId))?.items.map((it, idx) => (
                          <th key={idx} className="p-3 text-center border-l border-slate-200 font-black text-slate-800">
                            {it.size}
                            <div className="text-[9px] text-slate-400 font-semibold">Oran: {it.quantity}</div>
                          </th>
                        )) || (
                          <th className="p-6 text-center text-slate-400 font-semibold italic">
                            Lütfen yukarıdan bir Asorti Şablonu seçiniz
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {colors.length === 0 ? (
                        <tr>
                          <td colSpan={20} className="p-8 text-center text-slate-400 font-semibold italic">
                            Lütfen önce en az 1 renk ekleyiniz
                          </td>
                        </tr>
                      ) : (
                        colors.map(col => (
                          <tr key={col} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="p-3 font-black text-slate-900 uppercase">{col}</td>
                            {templates?.find(t => t.id === (selectedTemplateId || selectedProduct?.assortmentTemplateId))?.items.map((it, sIdx) => (
                              <td key={sIdx} className="p-1.5 border-l border-slate-100">
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={matrixData[col]?.[it.size] || ''}
                                  onChange={e => {
                                    const val = Number(e.target.value) || 0;
                                    setMatrixData(prev => ({
                                      ...prev,
                                      [col]: {
                                        ...(prev[col] || {}),
                                        [it.size]: val
                                      }
                                    }));
                                  }}
                                  className="w-full text-center py-2 border border-slate-200 rounded-lg font-black text-slate-800 focus:bg-indigo-50/50 focus:border-indigo-300 outline-none"
                                />
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('general')}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100"
                >
                  Geri Dön
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('images')}
                  className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-600 transition-all shadow-md"
                >
                  <span>Görsel Adımı</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: IMAGES */}
          {activeTab === 'images' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Catalog Image */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Ana Katalog Fotoğrafı
                  </label>
                  <div className="aspect-square bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden relative flex items-center justify-center group hover:border-indigo-400 transition-colors">
                    {mainImage ? (
                      <>
                        <img src={mainImage} alt="Main" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <label className="cursor-pointer bg-white text-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold">
                            Değiştir
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                          </label>
                          <button
                            type="button"
                            onClick={() => setMainImage(undefined)}
                            className="bg-rose-600 text-white p-1.5 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center justify-center p-6 text-center">
                        <Camera className="w-8 h-8 text-slate-300 mb-2 group-hover:text-indigo-500 transition-colors" />
                        <span className="text-xs font-bold text-slate-500">Fotoğraf Yükle</span>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>

                {/* Color-based images */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Renk Varyantı Fotoğrafları
                  </label>
                  {colors.length === 0 ? (
                    <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl text-center text-slate-400 text-xs font-semibold">
                      Varyant sekmesinden renk tanımladığınızda renk bazlı fotoğraflar buraya eklenebilir.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {colors.map(col => {
                        const colImg = colorImages.find(ci => ci.color === col)?.image;
                        return (
                          <div key={col} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-700">
                              <span>{col}</span>
                              {colImg && (
                                <button
                                  type="button"
                                  onClick={() => setColorImages(prev => prev.filter(ci => ci.color !== col))}
                                  className="text-rose-500 hover:text-rose-700"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <label className="cursor-pointer block aspect-square bg-white border border-dashed border-slate-300 rounded-lg overflow-hidden flex items-center justify-center hover:border-indigo-400 transition-colors">
                              {colImg ? (
                                <img src={colImg} alt={col} className="w-full h-full object-contain" />
                              ) : (
                                <Camera className="w-5 h-5 text-slate-300" />
                              )}
                              <input type="file" accept="image/*" onChange={e => handleColorImageUpload(col, e)} className="hidden" />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setActiveTab(hasSizeVariants ? 'matrix' : 'general')}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100"
                >
                  Geri Dön
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('barcodes')}
                  className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-600 transition-all shadow-md"
                >
                  <span>Barkod Yönetimine Geç</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: BARCODES */}
          {activeTab === 'barcodes' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setBarcodeSubTab('box')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                      barcodeSubTab === 'box' ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    Koli / Kutu Barkodları
                  </button>
                  {hasSizeVariants && (
                    <button
                      type="button"
                      onClick={() => setBarcodeSubTab('variants')}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                        barcodeSubTab === 'variants' ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      Beden & Varyant Barkodları
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleGenerateBarcodes}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Otomatik Barkod Üret</span>
                </button>
              </div>

              {/* Barcodes Content */}
              {barcodeSubTab === 'box' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {colorBoxBarcodes.map((b, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs font-black text-slate-700 uppercase">
                          <span>{b.color} Koli Barkodu</span>
                          <button
                            type="button"
                            onClick={() => setColorBoxBarcodes(prev => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={b.barcode}
                          onChange={e => {
                            const updated = [...colorBoxBarcodes];
                            updated[idx].barcode = e.target.value;
                            setColorBoxBarcodes(updated);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-xs font-bold outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setColorBoxBarcodes(prev => [...prev, { color: colors[0] || 'Genel', barcode: `869${Date.now().toString().slice(-9)}` }])}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Elle Koli Barkodu Ekle
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto p-1">
                    {variantBarcodes.map((v, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-black text-slate-700 uppercase">
                          <span>{v.color} / No: {v.size}</span>
                          <button
                            type="button"
                            onClick={() => setVariantBarcodes(prev => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={v.barcode}
                          onChange={e => {
                            const updated = [...variantBarcodes];
                            updated[idx].barcode = e.target.value;
                            setVariantBarcodes(updated);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-xs font-bold outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setVariantBarcodes(prev => [...prev, { color: colors[0] || 'Genel', size: 'Standart', barcode: `869${Date.now().toString().slice(-9)}`, stock: 0 }])}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Elle Varyant Barkodu Ekle
                  </button>
                </div>
              )}

              {/* Submit / Save Bar */}
              <div className="flex justify-between pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('images')}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100"
                >
                  Geri Dön
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsAddModalOpen(false); resetForm(); }}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 active:scale-95 transition-all"
                  >
                    {isEditMode ? 'Güncellemeyi Kaydet' : 'Kartı Envantere Ekle'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ACCOUNTING (TDHP) */}
          {activeTab === 'accounting' && (
            <div className="space-y-5">
              {/* Presets / Information Bar */}
              <div className="p-4 bg-indigo-50/60 border border-indigo-200/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-indigo-900 uppercase tracking-wider">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    Tek Düzen Hesap Planı (TDHP) Entegrasyonu
                  </div>
                  <span className="text-[11px] font-bold text-indigo-600 bg-white px-2.5 py-0.5 rounded-full border border-indigo-200">
                    Otomatik Yevmiye Eşlemesi
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Bu stok kartı kaydedildiğinde, tanımlanan tüm TDHP hesapları (Stok, Satış Geliri ve Alış/Maliyet) Muhasebe Modülünde <strong>otomatik olarak açılır</strong>. Faturalara veya irsaliyelere eklendiğinde ise sistem bu hesap kodlarını doğrudan yevmiye maddelerine aktarır.
                </p>

                {/* Quick Presets */}
                <div className="pt-1">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Hızlı Şablon Uygula:
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setProductForm(prev => ({
                        ...prev,
                        accountingCode: '157.01',
                        salesAccountCode: '600.01',
                        purchaseAccountCode: '620.01',
                        vatRate: 20
                      }))}
                      className="p-2 bg-white hover:bg-indigo-600 hover:text-white border border-indigo-200/70 rounded-xl text-left transition-all group shadow-sm"
                    >
                      <div className="text-[11px] font-black group-hover:text-white text-indigo-900">Mamul (Ayakkabı)</div>
                      <div className="text-[10px] text-slate-500 group-hover:text-indigo-100 font-mono">157 / 600 / 620</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProductForm(prev => ({
                        ...prev,
                        accountingCode: '150.01',
                        salesAccountCode: '600.20',
                        purchaseAccountCode: '150.01',
                        vatRate: 20
                      }))}
                      className="p-2 bg-white hover:bg-indigo-600 hover:text-white border border-indigo-200/70 rounded-xl text-left transition-all group shadow-sm"
                    >
                      <div className="text-[11px] font-black group-hover:text-white text-indigo-900">İlk Madde (Deri/Kumaş)</div>
                      <div className="text-[10px] text-slate-500 group-hover:text-indigo-100 font-mono">150.01 / 600 / 150</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProductForm(prev => ({
                        ...prev,
                        accountingCode: '152.01',
                        salesAccountCode: '600.01',
                        purchaseAccountCode: '710.01',
                        vatRate: 20
                      }))}
                      className="p-2 bg-white hover:bg-indigo-600 hover:text-white border border-indigo-200/70 rounded-xl text-left transition-all group shadow-sm"
                    >
                      <div className="text-[11px] font-black group-hover:text-white text-indigo-900">Yarı Mamul (Taban/Mostra)</div>
                      <div className="text-[10px] text-slate-500 group-hover:text-indigo-100 font-mono">152.01 / 600 / 710</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProductForm(prev => ({
                        ...prev,
                        accountingCode: '153.01',
                        salesAccountCode: '600.20',
                        purchaseAccountCode: '153.01',
                        vatRate: 20
                      }))}
                      className="p-2 bg-white hover:bg-indigo-600 hover:text-white border border-indigo-200/70 rounded-xl text-left transition-all group shadow-sm"
                    >
                      <div className="text-[11px] font-black group-hover:text-white text-indigo-900">Ticari Mal / Aksesuar</div>
                      <div className="text-[10px] text-slate-500 group-hover:text-indigo-100 font-mono">153.01 / 600 / 153</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Form inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Stok Hesabı */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                      1. Stok Bilanço Hesabı (Aktif)
                    </label>
                    <span className="text-[10px] font-bold text-indigo-600">150, 152, 153, 157 Grubu</span>
                  </div>
                  <input
                    type="text"
                    value={productForm.accountingCode}
                    onChange={e => setProductForm(prev => ({ ...prev, accountingCode: e.target.value }))}
                    list="tdhp-stock-accounts"
                    placeholder="Örn: 157.01, 150.01..."
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                  <div className="text-[11px] mt-1">
                    {productForm.accountingCode?.trim() && (
                      tdhpAccounts?.some(a => a.code.toLowerCase() === productForm.accountingCode.trim().toLowerCase()) ? (
                        <span className="text-emerald-700 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Tanımlı TDHP Hesabı: {tdhpAccounts?.find(a => a.code.toLowerCase() === productForm.accountingCode.trim().toLowerCase())?.name}
                        </span>
                      ) : (
                        <span className="text-indigo-700 font-medium flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          Otomatik Açılacak: Kaydedildiğinde Tek Düzen Hesap Planına eklenecektir.
                        </span>
                      )
                    )}
                    {!productForm.accountingCode?.trim() && (
                      <span className="text-slate-500">Envanter giriş/çıkışlarında borç/alacak çalışan aktif stok hesabı.</span>
                    )}
                  </div>
                </div>

                {/* 2. Satış Gelir Hesabı */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                      2. Yurtiçi Satış Gelir Hesabı
                    </label>
                    <span className="text-[10px] font-bold text-indigo-600">600 Grubu</span>
                  </div>
                  <input
                    type="text"
                    value={productForm.salesAccountCode}
                    onChange={e => setProductForm(prev => ({ ...prev, salesAccountCode: e.target.value }))}
                    list="tdhp-sales-accounts"
                    placeholder="Örn: 600.01 (Mamul Satışları)..."
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                  <div className="text-[11px] mt-1">
                    {productForm.salesAccountCode?.trim() && (
                      tdhpAccounts?.some(a => a.code.toLowerCase() === productForm.salesAccountCode.trim().toLowerCase()) ? (
                        <span className="text-emerald-700 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Tanımlı Gelir Hesabı: {tdhpAccounts?.find(a => a.code.toLowerCase() === productForm.salesAccountCode.trim().toLowerCase())?.name}
                        </span>
                      ) : (
                        <span className="text-indigo-700 font-medium flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          Otomatik Açılacak: Kaydedildiğinde 600 grubu altına eklenecektir.
                        </span>
                      )
                    )}
                    {!productForm.salesAccountCode?.trim() && (
                      <span className="text-slate-500">Satış faturasında alacak kaydı açılacak gelir hesabı.</span>
                    )}
                  </div>
                </div>

                {/* 3. Alış / Maliyet Hesabı */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                      3. Alış / Maliyet Hesabı
                    </label>
                    <span className="text-[10px] font-bold text-indigo-600">150, 620, 710 Grubu</span>
                  </div>
                  <input
                    type="text"
                    value={productForm.purchaseAccountCode}
                    onChange={e => setProductForm(prev => ({ ...prev, purchaseAccountCode: e.target.value }))}
                    list="tdhp-purchase-accounts"
                    placeholder="Örn: 620.01 (Mamul Maliyeti) veya 150.01..."
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                  <div className="text-[11px] mt-1">
                    {productForm.purchaseAccountCode?.trim() && (
                      tdhpAccounts?.some(a => a.code.toLowerCase() === productForm.purchaseAccountCode.trim().toLowerCase()) ? (
                        <span className="text-emerald-700 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Tanımlı Hesap: {tdhpAccounts?.find(a => a.code.toLowerCase() === productForm.purchaseAccountCode.trim().toLowerCase())?.name}
                        </span>
                      ) : (
                        <span className="text-indigo-700 font-medium flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          Otomatik Açılacak: Kaydedildiğinde TDHP planına eklenecektir.
                        </span>
                      )
                    )}
                    {!productForm.purchaseAccountCode?.trim() && (
                      <span className="text-slate-500">Alış faturasında veya satılan mamul maliyeti mahsubunda kullanılır.</span>
                    )}
                  </div>
                </div>

                {/* 4. KDV Oranı (%) */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                      4. Varsayılan KDV Oranı (%)
                    </label>
                    <span className="text-[10px] font-bold text-indigo-600">391 / 191 Hesapları</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={productForm.vatRate}
                      onChange={e => setProductForm(prev => ({ ...prev, vatRate: Number(e.target.value) }))}
                      className="w-24 bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                    <div className="flex gap-1.5 flex-1">
                      {[0, 1, 10, 20].map(rate => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setProductForm(prev => ({ ...prev, vatRate: rate }))}
                          className={cn(
                            "flex-1 py-2 rounded-xl text-xs font-bold border transition-all",
                            productForm.vatRate === rate
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                          )}
                        >
                          %{rate}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Fatura hesaplamalarında 391 Hesaplanan KDV veya 191 İndirilecek KDV için uygulanır.
                  </p>
                </div>
              </div>

              {/* Datalists for Accounts Auto-suggest */}
              <datalist id="tdhp-stock-accounts">
                {tdhpAccounts
                  ?.filter(a => a.code.startsWith('15'))
                  .reduce((acc, a) => acc.some(x => x.code === a.code) ? acc : [...acc, a], [] as typeof tdhpAccounts)
                  .map(a => (
                    <option key={`stk-${a.id || a.code}`} value={a.code}>{a.name}</option>
                  ))}
              </datalist>
              <datalist id="tdhp-sales-accounts">
                {tdhpAccounts
                  ?.filter(a => a.code.startsWith('60'))
                  .reduce((acc, a) => acc.some(x => x.code === a.code) ? acc : [...acc, a], [] as typeof tdhpAccounts)
                  .map(a => (
                    <option key={`sls-${a.id || a.code}`} value={a.code}>{a.name}</option>
                  ))}
              </datalist>
              <datalist id="tdhp-purchase-accounts">
                {tdhpAccounts
                  ?.filter(a => a.code.startsWith('15') || a.code.startsWith('62') || a.code.startsWith('71'))
                  .reduce((acc, a) => acc.some(x => x.code === a.code) ? acc : [...acc, a], [] as typeof tdhpAccounts)
                  .map(a => (
                    <option key={`prc-${a.id || a.code}`} value={a.code}>{a.name}</option>
                  ))}
              </datalist>

              {/* Submit / Save Bar */}
              <div className="flex justify-between pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('general')}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100"
                >
                  Genel Bilgilere Dön
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsAddModalOpen(false); resetForm(); }}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 active:scale-95 transition-all"
                  >
                    {isEditMode ? 'Güncellemeyi Kaydet' : 'Kartı Envantere Ekle'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* PRODUCT DETAIL MODAL                                                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Stok Kartı Detayı & Analizi"
        className="max-w-3xl"
      >
        {selectedProduct && (() => {
          const cat = getProductCategoryType(selectedProduct);
          const cfg = CATEGORY_CONFIGS[cat];
          const isLow = selectedProduct.stock <= (selectedProduct.minStock || 0);

          return (
            <div className="space-y-6">
              {/* Product Header Profile */}
              <div className="flex flex-col md:flex-row items-start justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm">
                    {selectedProduct.image ? (
                      <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-contain" />
                    ) : (
                      <Package className="w-10 h-10 text-slate-300" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border",
                        `${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`
                      )}>
                        {cfg.badge}
                      </span>
                      <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        {selectedProduct.code}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900">{selectedProduct.name}</h3>
                    <div className="text-xs font-bold text-slate-400 uppercase">
                      {selectedProduct.brand} {selectedProduct.subType && `• ${selectedProduct.subType}`}
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Mevcut Stok</div>
                  <div className={cn("text-3xl font-black font-mono", isLow ? "text-rose-600" : "text-indigo-600")}>
                    {selectedProduct.stock} <span className="text-xs uppercase">{selectedProduct.unit}</span>
                  </div>
                  {isLow && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                      <AlertTriangle className="w-3 h-3" /> Kritik Seviye
                    </span>
                  )}
                </div>
              </div>

              {/* Price & Shelf Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Alış Fiyatı</div>
                  <div className="text-sm font-black font-mono text-slate-800 mt-0.5">
                    ₺{(selectedProduct.buyingPrice || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Satış Fiyatı</div>
                  <div className="text-sm font-black font-mono text-indigo-600 mt-0.5">
                    ₺{(selectedProduct.sellingPrice || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Depo Raf</div>
                  <div className="text-sm font-black text-slate-800 mt-0.5">
                    {selectedProduct.shelf || 'Tanımlanmadı'}
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Kritik Limit</div>
                  <div className="text-sm font-black font-mono text-rose-600 mt-0.5">
                    {selectedProduct.minStock || 0} {selectedProduct.unit}
                  </div>
                </div>
              </div>

              {/* TDHP Muhasebe Entegrasyon Kartı */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-200/80 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" /> Tek Düzen Hesap Planı (TDHP) Eşleşmeleri
                  </h4>
                  <span className="text-[10px] font-mono font-bold bg-white text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200">
                    KDV: %{selectedProduct.vatRate ?? 20}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Stok Hesabı (Aktif)</div>
                    <div className="font-mono font-black text-xs text-indigo-700 mt-1">
                      {selectedProduct.accountingCode || '157.01 (Varsayılan)'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                      {tdhpAccounts?.find(a => a.code === selectedProduct.accountingCode)?.name || 'Mamuller / Stok Hesabı'}
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Satış Gelir Hesabı</div>
                    <div className="font-mono font-black text-xs text-slate-800 mt-1">
                      {selectedProduct.salesAccountCode || '600.01 (Varsayılan)'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                      {tdhpAccounts?.find(a => a.code === selectedProduct.salesAccountCode)?.name || 'Yurtiçi Satışlar'}
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Alış / Maliyet Hesabı</div>
                    <div className="font-mono font-black text-xs text-slate-800 mt-1">
                      {selectedProduct.purchaseAccountCode || '620.01 (Varsayılan)'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                      {tdhpAccounts?.find(a => a.code === selectedProduct.purchaseAccountCode)?.name || 'Satılan Malzeme/Mamul'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Defined Color Options (For all categories: Suni Deri, Kumaş, Bağcık, Mostra, Ayakkabı vs.) */}
              {selectedProduct.colors && selectedProduct.colors.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Palette className="w-4 h-4 text-indigo-600" /> Tanımlı Renk Seçenekleri
                    </h4>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                      {selectedProduct.colors.length} Renk
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedProduct.colors.map(c => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase text-slate-800 shadow-sm"
                      >
                        <span className="w-2 h-2 rounded-full bg-indigo-600" />
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Size Matrix Breakdown (If available) */}
              {(selectedProduct.hasSizeVariants || selectedProduct.isFootwear) && selectedProduct.variantBarcodes && selectedProduct.variantBarcodes.length > 0 && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Grid className="w-4 h-4 text-indigo-600" /> Beden & Numara Bazlı Stok Dağılımı
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400">
                      {selectedProduct.variantBarcodes.length} Varyant
                    </span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {selectedProduct.variantBarcodes.map((vb, idx) => (
                      <div key={idx} className="p-2.5 bg-white border border-slate-200 rounded-xl text-center space-y-0.5 shadow-sm">
                        <div className="text-[9px] font-black text-slate-400 uppercase truncate">{vb.color}</div>
                        <div className="text-xs font-black text-slate-800">No: {vb.size}</div>
                        <div className="text-sm font-black text-indigo-600 font-mono">{vb.stock || 0}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delete error notification */}
              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
                {deleteConfirmId === selectedProduct.id ? (
                  <div className="flex items-center gap-2 bg-rose-50 p-2 rounded-xl border border-rose-200">
                    <span className="text-xs font-black text-rose-700 px-2">Silmek istiyor musunuz?</span>
                    <button
                      onClick={() => handleDeleteProduct(selectedProduct.id!)}
                      className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700"
                    >
                      Evet, Sil
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                    >
                      İptal
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(selectedProduct.id!)}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors border border-rose-200"
                  >
                    <Trash2 className="w-4 h-4" /> Kartı Sil
                  </button>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      setIsPrintModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Barcode className="w-4 h-4" /> Barkod Yazdır
                  </button>

                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenEditModal(selectedProduct);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20"
                  >
                    <Edit2 className="w-4 h-4" /> Düzenle
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ========================================================================= */}
      {/* ADJUST STOCK MODAL                                                       */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Hızlı Stok Hareketi"
        className="max-w-md"
      >
        {selectedProduct && (
          <form onSubmit={handleAdjustStockSubmit} className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Seçili Kart</div>
              <div className="text-xs font-black text-slate-900">{selectedProduct.name} ({selectedProduct.code})</div>
              <div className="text-xs font-semibold text-slate-500">
                Güncel Stok: <span className="font-mono font-black text-indigo-600">{selectedProduct.stock} {selectedProduct.unit}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">İşlem Türü</label>
                <select
                  value={adjustData.type}
                  onChange={e => setAdjustData(prev => ({ ...prev, type: e.target.value as 'in' | 'out' }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none"
                >
                  <option value="in">Stok Girişi (+)</option>
                  <option value="out">Stok Çıkışı (-)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Miktar ({selectedProduct.unit})</label>
                <input
                  type="number"
                  required
                  step="any"
                  min="0.01"
                  value={adjustData.quantity}
                  onChange={e => setAdjustData(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-black outline-none"
                />
              </div>
            </div>

            {/* If product has colors */}
            {selectedProduct.colors && selectedProduct.colors.length > 0 && (
              <div className={cn("grid gap-3", (selectedProduct.hasSizeVariants || selectedProduct.isFootwear) ? "grid-cols-2" : "grid-cols-1")}>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">İşlem Yapılacak Renk</label>
                  <select
                    value={adjustData.selectedColor}
                    onChange={e => setAdjustData(prev => ({ ...prev, selectedColor: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none"
                  >
                    <option value="">Genel / Tümü</option>
                    {selectedProduct.colors.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {(selectedProduct.hasSizeVariants || selectedProduct.isFootwear) && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Numara / Beden</label>
                    <select
                      value={adjustData.selectedSize}
                      onChange={e => setAdjustData(prev => ({ ...prev, selectedSize: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none"
                    >
                      <option value="">Tüm Bedenler</option>
                      {selectedProduct.variantBarcodes?.map((v, i) => (
                        <option key={i} value={v.size}>{v.size}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hareket Açıklaması</label>
              <input
                type="text"
                required
                value={adjustData.description}
                onChange={e => setAdjustData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Örn: İmalat girişi, Fire çıkışı, Sayım düzeltmesi..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-colors shadow-md"
            >
              Hareketi Onayla ve Kaydet
            </button>
          </form>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* ASSORTMENT TEMPLATES MANAGER MODAL                                       */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="Asorti & Numara Şablonları"
        className="max-w-2xl"
      >
        <div className="space-y-6">
          {/* Create new template */}
          <form onSubmit={handleSaveTemplate} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Yeni Şablon Ekle</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Şablon Adı</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Erkek 40-45 (12'li), Taban 36-45..."
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold text-xs"
                >
                  Şablonu Kaydet
                </button>
              </div>
            </div>
          </form>

          {/* Existing Templates list */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Mevcut Şablonlar</h4>
            <div className="space-y-2">
              {templates?.map(t => (
                <div key={t.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-xs font-black text-slate-900">{t.name}</div>
                    <div className="flex flex-wrap gap-1">
                      {t.items.map((it, idx) => (
                        <span key={idx} className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                          {it.size} ({it.quantity})
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteTemplate(t.id!)}
                    className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* BARCODE CONFIGURATION MODAL                                              */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="Barkod Formatı ve Sıra Numarası"
        className="max-w-md"
      >
        <form onSubmit={handleSaveBarcodeSettings} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Barkod Standardı</label>
            <select
              value={barcodeSettings.barcodeType}
              onChange={e => setBarcodeSettings(prev => ({ ...prev, barcodeType: e.target.value as any }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none"
            >
              <option value="CODE-128">CODE-128 (Esnek Alfamerik & Kompakt)</option>
              <option value="EAN-13">EAN-13 (Uluslararası Perakende Standart)</option>
              <option value="CODE-39">CODE-39 (Endüstriyel)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Barkod Ön Eki (Prefix)</label>
            <input
              type="text"
              value={barcodeSettings.barcodePrefix}
              onChange={e => setBarcodeSettings(prev => ({ ...prev, barcodePrefix: e.target.value }))}
              placeholder="Örn: 869"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sıradaki Sayaç (Sequence)</label>
            <input
              type="number"
              value={barcodeSettings.nextBarcodeSequence}
              onChange={e => setBarcodeSettings(prev => ({ ...prev, nextBarcodeSequence: Number(e.target.value) }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-md"
          >
            Ayarları Kaydet
          </button>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* BARCODE PRINT MODAL                                                      */}
      {/* ========================================================================= */}
      <BarcodePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        product={selectedProduct}
        templates={templates}
      />
    </div>
  );
}
