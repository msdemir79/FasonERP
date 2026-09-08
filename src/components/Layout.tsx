import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { 
  LayoutDashboard, 
  Package, 
  Hammer, 
  Wallet, 
  Users, 
  ShoppingCart, 
  Menu, 
  X,
  CreditCard,
  Activity,
  ChevronRight,
  Receipt,
  Truck,
  Landmark,
  BookOpen,
  UserCheck,
  BarChart3,
  Settings
} from 'lucide-react';
import { cn } from '../lib/utils';

export interface NavItem {
  name: string;
  href: string;
  icon: any;
  subItems?: { name: string; href: string }[];
}

const navigation: NavItem[] = [
  { name: 'Panel', href: '/', icon: LayoutDashboard },
  { name: 'Stok Yönetimi', href: '/inventory', icon: Package },
  { name: 'Sipariş Yönetimi', href: '/orders', icon: ShoppingCart },
  { name: 'İrsaliyeler', href: '/waybills', icon: Truck },
  { name: 'Faturalar', href: '/invoices', icon: Receipt },
  { name: 'Finans & Tahsilat', href: '/finance', icon: Landmark },
  { name: 'Genel Muhasebe', href: '/accounting', icon: BookOpen },
  { name: 'İnsan Kaynakları (İK)', href: '/hr', icon: UserCheck },
  { name: 'Üretim Planlama', href: '/production', icon: Hammer },
  { name: 'Cari Hesaplar', href: '/contacts', icon: Users },
  { name: 'Raporlar & Analiz', href: '/reports', icon: BarChart3 },
  { name: 'Ayarlar & Yapılandırma', href: '/settings', icon: Settings },
];

export default function Layout() {
  const location = useLocation();
  const currentPathWithSearch = location.pathname + location.search;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [expandedMenus, setExpandedMenus] = React.useState<string[]>(['Stok Yönetimi', 'Raporlar & Analiz']);

  const appSettings = useLiveQuery(() => db.settings.get('global_settings'));
  const companyLogo = appSettings?.company?.logo;
  const companyName = appSettings?.company?.companyName || 'ProERP';

  const toggleMenu = (name: string) => {
    setExpandedMenus(prev => 
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    );
  };

  return (
    <div className="flex h-screen bg-slate-100/70 overflow-hidden font-sans">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:w-56 md:flex-col bg-slate-900 border-r border-slate-800/80 shrink-0">
        <div className="h-13 px-4 flex items-center gap-2.5 border-b border-slate-800/60">
          {companyLogo ? (
            <div className="w-8 h-8 rounded-lg bg-white p-0.5 shadow-xs shrink-0 flex items-center justify-center overflow-hidden border border-slate-700">
              <img src={companyLogo} alt={companyName} className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white text-xs shadow-sm shadow-indigo-600/30 shrink-0">
              P
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-white font-bold tracking-tight text-sm leading-none truncate">{companyName}</span>
            <span className="text-[10px] text-slate-400 font-medium leading-none mt-0.5 truncate">Ayakkabı Sanayi</span>
          </div>
        </div>

        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto custom-scrollbar">
          {navigation.map((item) => (
            <div key={item.name}>
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-xs font-medium group",
                    isActive 
                      ? "bg-indigo-600 text-white font-semibold shadow-xs" 
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  )
                }
              >
                <item.icon className="w-4 h-4 shrink-0 transition-colors group-hover:text-indigo-400" />
                <span className="truncate">{item.name}</span>
              </NavLink>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800/60">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/50 border border-slate-800">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-xs uppercase shrink-0">
              MD
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white font-semibold truncate leading-tight">Mehmet Demir</p>
              <p className="text-[10px] text-slate-400 truncate leading-tight">Yönetici</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden transition-opacity" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* Sidebar Mobile */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-60 bg-slate-900 text-white z-50 transform transition-transform duration-300 md:hidden border-r border-slate-800 flex flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-13 px-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            {companyLogo ? (
              <div className="w-7 h-7 rounded-lg bg-white p-0.5 shadow-xs shrink-0 flex items-center justify-center overflow-hidden border border-slate-700">
                <img src={companyLogo} alt={companyName} className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0">P</div>
            )}
            <span className="text-white font-bold tracking-tight text-sm truncate">{companyName}</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} aria-label="Kapat" className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-xs font-medium",
                  isActive 
                    ? "bg-indigo-600 text-white font-semibold" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )
              }
            >
              <item.icon className="w-4 h-4" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-13 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 flex items-center justify-between px-4 md:px-6 shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              className="p-1.5 md:hidden text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 shrink-0" 
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Menüyü aç"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              {companyLogo && (
                <div className="w-6 h-6 rounded bg-white border border-slate-200 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                  <img src={companyLogo} alt={companyName} className="max-w-full max-h-full object-contain" />
                </div>
              )}
              <span className="text-xs font-bold text-slate-700 tracking-tight truncate">{companyName} Fabrika Sistemi</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/70 rounded-md text-[11px] font-medium shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Canlı
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-[11px] font-mono text-slate-500 font-medium">
                {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
              <Activity className="w-4 h-4" />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-5 custom-scrollbar">
          <div className="max-w-[1560px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
