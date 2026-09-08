import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
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

  const toggleMenu = (name: string) => {
    setExpandedMenus(prev => 
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    );
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-slate-900 border-r border-slate-800">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-sm flex items-center justify-center font-bold text-white text-lg italic">P</div>
          <span className="text-white font-semibold tracking-tight text-lg uppercase">ProERP</span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
          {navigation.map((item) => (
            <div key={item.name} className="space-y-1">
              {item.subItems ? (
                <button
                  onClick={() => toggleMenu(item.name)}
                  className="w-full flex items-center justify-between px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 group-hover:text-indigo-400 transition-colors" />
                    <span className="text-[10px] uppercase font-bold tracking-widest">{item.name}</span>
                  </div>
                  <ChevronRight className={cn(
                    "w-3 h-3 transition-transform duration-200",
                    expandedMenus.includes(item.name) && "rotate-90"
                  )} />
                </button>
              ) : (
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 group",
                      isActive 
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )
                  }
                >
                  <item.icon className="w-4 h-4 group-hover:text-indigo-400 transition-colors" />
                  <span className="text-[10px] uppercase font-bold tracking-widest">{item.name}</span>
                </NavLink>
              )}

              {item.subItems && expandedMenus.includes(item.name) && (
                <div className="pl-11 space-y-1 py-1">
                  {item.subItems.map((sub) => {
                    const isSubActive = sub.href.includes('?') 
                      ? currentPathWithSearch === sub.href
                      : (location.pathname === sub.href && !location.search);
                    return (
                      <NavLink
                        key={sub.name}
                        to={sub.href}
                        className={cn(
                          "block py-1.5 text-[9px] uppercase font-bold tracking-widest transition-colors",
                          isSubActive ? "text-indigo-400 font-black" : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        {sub.name}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs uppercase">MS</div>
            <div>
              <p className="text-sm text-white font-medium">Mehmet Demir</p>
              <p className="text-xs text-slate-500">Yönetici</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

        {/* Sidebar Mobile */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 bg-slate-900 text-white z-50 transform transition-transform duration-300 md:hidden border-r border-slate-800",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-sm flex items-center justify-center font-bold text-white text-lg">P</div>
            <span className="text-white font-semibold tracking-tight text-lg uppercase">ProERP</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} aria-label="Kapat">
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {navigation.map((item) => (
            <div key={item.name} className="space-y-1">
               {item.subItems ? (
                <button
                  onClick={() => toggleMenu(item.name)}
                  className="w-full flex items-center justify-between px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4" />
                    <span className="text-[10px] uppercase font-bold tracking-widest">{item.name}</span>
                  </div>
                  <ChevronRight className={cn(
                    "w-3 h-3 transition-transform duration-200",
                    expandedMenus.includes(item.name) && "rotate-90"
                  )} />
                </button>
              ) : (
                <NavLink
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200",
                      isActive 
                        ? "bg-indigo-600 text-white" 
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    )
                  }
                >
                  <item.icon className="w-4 h-4" />
                  <span className="text-[10px] uppercase font-bold tracking-widest">{item.name}</span>
                </NavLink>
              )}

              {item.subItems && expandedMenus.includes(item.name) && (
                <div className="pl-11 space-y-1 py-1">
                  {item.subItems.map((sub) => {
                    const isSubActive = sub.href.includes('?') 
                      ? currentPathWithSearch === sub.href
                      : (location.pathname === sub.href && !location.search);
                    return (
                      <NavLink
                        key={sub.name}
                        to={sub.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "block py-1.5 text-[9px] uppercase font-bold tracking-widest transition-colors",
                          isSubActive ? "text-indigo-400 font-black" : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        {sub.name}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              className="p-2 md:hidden text-slate-600" 
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Menüyü aç"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-semibold text-slate-800">Kurumsal Yönetim</h2>
            <span className="hidden sm:inline-block px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold leading-none">Canlı Sistem: Aktif</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Durum</span>
              <span className="text-sm font-mono font-bold uppercase tracking-tight">20 NİSAN 2026</span>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-200 transition-colors">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
