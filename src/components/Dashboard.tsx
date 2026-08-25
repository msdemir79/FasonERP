import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Activity,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function Dashboard() {
  const transactions = useLiveQuery(() => db.transactions.toArray());
  const products = useLiveQuery(() => db.products.toArray());
  
  const stats = React.useMemo(() => {
    if (!transactions || !products) return null;
    
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const lowStock = products.filter(p => p.stock <= p.minStock).length;
    
    return {
      income,
      expense,
      profit: income - expense,
      lowStock
    };
  }, [transactions, products]);

  const chartData = React.useMemo(() => {
    if (!transactions) return [];
    // Last 7 days simulation
    return [
      { name: 'Pzt', gelir: 400, gider: 240 },
      { name: 'Sal', gelir: 300, gider: 139 },
      { name: 'Çar', gelir: 200, gider: 980 },
      { name: 'Per', gelir: 278, gider: 390 },
      { name: 'Cum', gelir: 189, gider: 480 },
      { name: 'Cmt', gelir: 239, gider: 380 },
      { name: 'Paz', gelir: 349, gider: 430 },
    ];
  }, [transactions]);

  if (!stats) return <div className="animate-pulse">Yükleniyor...</div>;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Hoş Geldiniz</h2>
          <p className="text-slate-500 mt-1">Sisteminizin bugünkü genel durumu aşağıdadır.</p>
        </div>
        <div className="flex gap-2">
          <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-sm font-medium text-slate-700">Veri Senkronize</span>
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Toplam Gelir" 
          value={`₺${stats.income.toLocaleString()}`} 
          icon={TrendingUp} 
          color="emerald"
        />
        <StatCard 
          title="Toplam Gider" 
          value={`₺${stats.expense.toLocaleString()}`} 
          icon={TrendingDown} 
          color="rose"
        />
        <StatCard 
          title="Net Kâr/Zarar" 
          value={`₺${stats.profit.toLocaleString()}`} 
          icon={Activity} 
          color={stats.profit >= 0 ? 'blue' : 'amber'}
        />
        <StatCard 
          title="Kritik Stok" 
          value={stats.lowStock.toString()} 
          icon={AlertCircle} 
          color={stats.lowStock > 0 ? 'orange' : 'slate'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
            <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Nakit Akışı Analizi</h3>
            <div className="flex gap-1">
              {['G', 'H', 'A'].map(p => (
                <button key={p} className="p-1 px-2 text-[10px] font-bold text-slate-400 hover:text-indigo-600 border border-transparent hover:border-slate-100 rounded transition-all">{p}</button>
              ))}
            </div>
          </div>
          <div className="p-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                  <Tooltip 
                    cursor={{fill: '#f1f5f9'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px'}}
                  />
                  <Bar dataKey="gelir" fill="#6366f1" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="gider" fill="#e2e8f0" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Small List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
            <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Son Hareketler</h3>
            <button className="text-[10px] font-bold text-indigo-600 hover:underline transition-all">TÜMÜ</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-slate-50">
              {transactions.slice(0, 6).reverse().map((t, idx) => (
                <motion.div 
                  key={t.id || idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-between p-4 px-6 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded flex items-center justify-center",
                      t.type === 'income' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                    )}>
                      {t.type === 'income' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 uppercase tracking-tight">{t.description}</div>
                      <div className="text-[10px] font-mono text-slate-400">{new Date(t.date).toLocaleDateString('tr-TR')}</div>
                    </div>
                  </div>
                  <div className={cn(
                    "text-xs font-bold font-mono",
                    t.type === 'income' ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {t.type === 'income' ? '+' : '-'}₺{t.amount.toLocaleString()}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string, value: string, icon: any, color: string }) {
  const colorMap: any = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100'
  };

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"
    >
      <p className="text-xs text-slate-400 font-bold uppercase mb-2 tracking-widest">{title}</p>
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold text-slate-900 leading-none">{value}</div>
        <div className={cn("p-1.5 rounded-lg", colorMap[color].split(' ')[0], colorMap[color].split(' ')[1])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className={cn("text-[10px] font-bold mt-2", colorMap[color].split(' ')[1])}>+0.0% Sistem Verisi</p>
    </motion.div>
  );
}
