import React, { useState } from 'react';
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
  Receipt, 
  Truck, 
  Landmark, 
  BookOpen, 
  UserCheck, 
  BarChart3, 
  Settings, 
  ShieldCheck, 
  Lock, 
  Sparkles, 
  Activity,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import UserSwitcherModal from './Users/UserSwitcherModal';
import AccessDenied from './Common/AccessDenied';
import type { AppModule } from '../types';

export interface NavItem {
  name: string;
  href: string;
  icon: any;
  module: AppModule;
}

const navigation: NavItem[] = [
  { name: 'Panel', href: '/', icon: LayoutDashboard, module: 'dashboard' },
  { name: 'Stok Yönetimi', href: '/inventory', icon: Package, module: 'inventory' },
  { name: 'Sipariş Yönetimi', href: '/orders', icon: ShoppingCart, module: 'orders' },
  { name: 'İrsaliyeler', href: '/waybills', icon: Truck, module: 'waybills' },
  { name: 'Faturalar', href: '/invoices', icon: Receipt, module: 'invoices' },
  { name: 'Finans & Tahsilat', href: '/finance', icon: Landmark, module: 'finance' },
  { name: 'Genel Muhasebe', href: '/accounting', icon: BookOpen, module: 'accounting' },
  { name: 'İnsan Kaynakları (İK)', href: '/hr', icon: UserCheck, module: 'hr' },
  { name: 'Üretim Planlama', href: '/production', icon: Hammer, module: 'production' },
  { name: 'Cari Hesaplar', href: '/contacts', icon: Users, module: 'contacts' },
  { name: 'Raporlar & Analiz', href: '/reports', icon: BarChart3, module: 'reports' },
  { name: 'Kullanıcılar & Yetkiler', href: '/users', icon: ShieldCheck, module: 'users' },
  { name: 'Ayarlar & Yapılandırma', href: '/settings', icon: Settings, module: 'settings' },
];

export default function Layout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  const { currentUser, currentRole, hasPermission, isSuperAdmin } = useAuth();

  const appSettings = useLiveQuery(() => db.settings.get('global_settings'));
  const companyLogo = appSettings?.company?.logo;
  const companyName = appSettings?.company?.companyName || 'ProERP';

  // Determine current active module from path
  const currentPath = location.pathname;
  let currentModule: AppModule = 'dashboard';
  if (currentPath === '/' || currentPath === '') {
    currentModule = 'dashboard';
  } else {
    const segment = currentPath.split('/')[1];
    const match = navigation.find(n => n.href.replace('/', '') === segment);
    if (match) {
      currentModule = match.module;
    }
  }

  const isCurrentModuleAllowed = hasPermission(currentModule, 'view');

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

        {/* Navigation list */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto custom-scrollbar">
          {navigation.map((item) => {
            const isAllowed = hasPermission(item.module, 'view');

            return (
              <div key={item.name}>
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center justify-between px-2.5 py-2 rounded-lg transition-all text-xs font-medium group",
                      isActive 
                        ? "bg-indigo-600 text-white font-semibold shadow-xs" 
                        : isAllowed
                        ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                        : "text-slate-600 hover:text-slate-400 hover:bg-slate-800/30 opacity-70"
                    )
                  }
                >
                  <div className="flex items-center gap-2.5 min-w-0 truncate">
                    <item.icon className="w-4 h-4 shrink-0 transition-colors group-hover:text-indigo-400" />
                    <span className="truncate">{item.name}</span>
                  </div>

                  {!isAllowed && (
                    <Lock className="w-3 h-3 text-slate-600 group-hover:text-amber-400/80 shrink-0 ml-1" />
                  )}
                </NavLink>
              </div>
            );
          })}
        </nav>

        {/* Desktop Active User Bar with Quick Switcher Trigger */}
        <div className="p-2.5 border-t border-slate-800/60">
          <button
            type="button"
            onClick={() => setIsSwitcherOpen(true)}
            className="w-full text-left p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 transition-all flex items-center justify-between gap-2 group cursor-pointer"
            title="Kullanıcı veya rol değiştir"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div 
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs uppercase shrink-0 shadow-2xs"
                style={{ backgroundColor: currentUser?.color || '#4f46e5' }}
              >
                {currentUser?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white font-semibold truncate leading-tight group-hover:text-indigo-300 transition-colors">
                  {currentUser?.fullName || 'Giriş Yapılmadı'}
                </p>
                <p className="text-[10px] text-slate-400 truncate leading-tight">
                  {currentRole?.name || currentUser?.roleName || 'Tanımsız Rol'}
                </p>
              </div>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors shrink-0" />
          </button>
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

        {/* Mobile active user switch button */}
        <div className="p-3 border-b border-slate-800">
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              setIsSwitcherOpen(true);
            }}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div 
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                style={{ backgroundColor: currentUser?.color || '#4f46e5' }}
              >
                {currentUser?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{currentUser?.fullName}</p>
                <p className="text-[10px] text-slate-400 truncate">{currentRole?.name || currentUser?.roleName}</p>
              </div>
            </div>
            <span className="text-[10px] text-indigo-400 font-semibold underline">Değiştir</span>
          </button>
        </div>

        <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
          {navigation.map((item) => {
            const isAllowed = hasPermission(item.module, 'view');
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg transition-all text-xs font-medium",
                    isActive 
                      ? "bg-indigo-600 text-white font-semibold" 
                      : isAllowed
                      ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                      : "text-slate-600 hover:bg-slate-800/40 opacity-70"
                  )
                }
              >
                <div className="flex items-center gap-2.5 min-w-0 truncate">
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </div>
                {!isAllowed && <Lock className="w-3.5 h-3.5 text-slate-500" />}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
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

          <div className="flex items-center gap-2.5">
            {/* Quick User Switcher Button in Header */}
            <button
              type="button"
              onClick={() => setIsSwitcherOpen(true)}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300 transition-all text-left shadow-2xs group cursor-pointer"
              title="Kullanıcı / Rol Değiştir (Simülatör)"
            >
              <div 
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white font-bold text-[11px] shadow-xs shrink-0"
                style={{ backgroundColor: currentUser?.color || '#4f46e5' }}
              >
                {currentUser?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors truncate max-w-[120px]">
                    {currentUser?.fullName}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({currentRole?.name || currentUser?.roleName})
                  </span>
                </div>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-semibold">
                Rolü Değiştir
              </span>
            </button>

            <div className="text-right hidden lg:block">
              <div className="text-[11px] font-mono text-slate-500 font-medium">
                {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area with Permission Guard */}
        <main className="flex-1 overflow-y-auto p-4 md:p-5 custom-scrollbar">
          <div className="max-w-[1560px] mx-auto w-full">
            {isCurrentModuleAllowed ? (
              <Outlet />
            ) : (
              <AccessDenied module={currentModule} />
            )}
          </div>
        </main>
      </div>

      {/* User Switcher Simulator Modal */}
      <UserSwitcherModal
        isOpen={isSwitcherOpen}
        onClose={() => setIsSwitcherOpen(false)}
      />
    </div>
  );
}
