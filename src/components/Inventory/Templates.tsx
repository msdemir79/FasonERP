import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Hash, Plus, Trash2, Ruler } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { erpService } from '../../services/erpService';

export default function Templates() {
  const templates = useLiveQuery(() => db.assortmentTemplates.toArray());
  const [newTemplateName, setNewTemplateName] = React.useState('');
  const [newTemplateItem, setNewTemplateItem] = React.useState({ size: '', quantity: 1 });
  const [newTemplateItems, setNewTemplateItems] = React.useState<{size: string, quantity: number}[]>([]);
  const sizeInputRef = React.useRef<HTMLInputElement>(null);

  const handleAddTemplateItem = () => {
    if (!newTemplateItem.size || newTemplateItem.quantity <= 0) return;
    if (newTemplateItems.find(i => i.size === newTemplateItem.size)) {
      alert('Bu beden zaten eklenmiş.');
      return;
    }
    setNewTemplateItems([...newTemplateItems, { ...newTemplateItem }]);
    setNewTemplateItem({ size: '', quantity: 1 });
    sizeInputRef.current?.focus();
  };

  const removeTemplateItem = (size: string) => {
    setNewTemplateItems(newTemplateItems.filter(i => i.size !== size));
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName || newTemplateItems.length === 0) return;
    await erpService.addAssortmentTemplate({
      name: newTemplateName,
      items: newTemplateItems
    });
    setNewTemplateName('');
    setNewTemplateItems([]);
    setNewTemplateItem({ size: '', quantity: 1 });
  };

  const deleteTemplate = async (id: number) => {
    if (confirm('Bu şablonu silmek istediğinize emin misiniz?')) {
      await db.assortmentTemplates.delete(id);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">Asorti Şablonları</h2>
        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Ayakkabı üretim ve kutulama standartlarınızı belirleyin.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Creation Form */}
        <div className="lg:col-span-1">
          <form onSubmit={handleCreateTemplate} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 sticky top-8">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3">Yeni Şablon Oluştur</h3>
            
            <div className="space-y-4">
               <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Şablon İsmi</label>
                <input 
                  required 
                  value={newTemplateName} 
                  onChange={e => setNewTemplateName(e.target.value)} 
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                  placeholder="ÖRN: 10'LU ERKEK SPOR"
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-xl space-y-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Beden / Miktar Ekle</div>
                <div className="flex gap-2">
                  <input 
                    ref={sizeInputRef}
                    type="text" 
                    placeholder="Beden" 
                    className="w-20 border border-slate-200 rounded-lg p-2 text-xs font-bold text-center outline-none focus:border-indigo-400"
                    value={newTemplateItem.size}
                    onChange={e => setNewTemplateItem({ ...newTemplateItem, size: e.target.value })}
                  />
                  <input 
                    type="number" 
                    placeholder="Adet" 
                    className="w-24 border border-slate-200 rounded-lg p-2 text-xs font-bold text-center outline-none focus:border-indigo-400"
                    value={newTemplateItem.quantity}
                    onChange={e => setNewTemplateItem({ ...newTemplateItem, quantity: Number(e.target.value) })}
                  />
                  <button 
                    type="button"
                    onClick={handleAddTemplateItem}
                    className="flex-1 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase px-3 hover:bg-indigo-600 transition-colors shadow-sm"
                  >
                    EKLE
                  </button>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                  {newTemplateItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-100">
                      <div className="flex gap-2 items-center">
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">NO: {item.size}</span>
                        <span className="text-xs font-bold text-slate-600">x {item.quantity} Adet</span>
                      </div>
                      <button type="button" onClick={() => removeTemplateItem(item.size)} className="text-rose-400 hover:text-rose-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={newTemplateItems.length === 0 || !newTemplateName}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              ŞABLONU KAYDET
            </button>
          </form>
        </div>

        {/* Existing Templates List */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence>
            {templates?.map((t) => (
              <motion.div 
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                      <Ruler className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 uppercase tracking-tight">{t.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        TOPLAM: {t.items.reduce((acc, curr) => acc + curr.quantity, 0)} ÇİFT / KOLİ
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => t.id && deleteTemplate(t.id)}
                    className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {t.items.map((item, i) => (
                    <div key={i} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg flex flex-col items-center min-w-[50px]">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">NO</span>
                      <span className="text-xs font-black text-slate-700">{item.size}</span>
                      <div className="w-full h-px bg-slate-200 my-1" />
                      <span className="text-[10px] font-bold text-indigo-600">{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {templates?.length === 0 && (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <Hash className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Henüz hiçbir asorti şablonu tanımlanmadı.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
