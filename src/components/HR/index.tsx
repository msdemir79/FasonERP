import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Calendar, 
  FileText, 
  DollarSign, 
  CreditCard, 
  ShieldCheck, 
  ShieldAlert, 
  UserCheck, 
  Briefcase,
  TrendingUp,
  Building2,
  Sparkles,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import type { Employee } from '../../types';
import { hrService } from '../../services/hrService';
import EmployeeListTab from './EmployeeListTab';
import AttendanceTab from './AttendanceTab';
import LeaveTab from './LeaveTab';
import PayrollTab from './PayrollTab';
import AdvanceTab from './AdvanceTab';
import HRReport from '../Reports/HRReport';

export default function HRManagement() {
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'leaves' | 'payroll' | 'advances' | 'reports'>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const list = await hrService.getEmployees();
      setEmployees(list);
    } catch (err) {
      console.error('Personel listesi yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  // Stats
  const activeEmployees = employees.filter(e => e.status === 'active');
  const sgkLiCount = activeEmployees.filter(e => e.sgkStatus === 'sgk_li').length;
  const sgkSizCount = activeEmployees.filter(e => e.sgkStatus === 'sgk_siz').length;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <Users className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">İnsan Kaynakları ve Personel Yönetimi</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            İK, Puantaj & Bordro Sistemi
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Personel devam takibi, 1-31 puantaj matrisi, izin yönetimi, SGK'lı & SGK'sız yevmiye/maaş hesaplamaları ve muhasebe fişleri
          </p>
        </div>

        {/* Quick KPI Stat Chips */}
        <div className="flex items-center gap-3">
          <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-xs text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Toplam Çalışan</p>
            <p className="text-lg font-black text-slate-800">{activeEmployees.length}</p>
          </div>

          <div className="bg-emerald-50 px-4 py-2.5 rounded-xl border border-emerald-200 shadow-xs text-center">
            <p className="text-[10px] font-bold text-emerald-600 uppercase flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3" /> SGK'lı
            </p>
            <p className="text-lg font-black text-emerald-800">{sgkLiCount}</p>
          </div>

          <div className="bg-amber-50 px-4 py-2.5 rounded-xl border border-amber-200 shadow-xs text-center">
            <p className="text-[10px] font-bold text-amber-600 uppercase flex items-center justify-center gap-1">
              <ShieldAlert className="w-3 h-3" /> SGK'sız / Yevmiyeli
            </p>
            <p className="text-lg font-black text-amber-800">{sgkSizCount}</p>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 shadow-xs">
        <button
          onClick={() => setActiveTab('employees')}
          className={`py-3.5 px-5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'employees'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Personel Listesi ({employees.length})
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`py-3.5 px-5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'attendance'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Puantaj & Devam Takibi
        </button>

        <button
          onClick={() => setActiveTab('leaves')}
          className={`py-3.5 px-5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'leaves'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          İzin Yönetimi
        </button>

        <button
          onClick={() => setActiveTab('payroll')}
          className={`py-3.5 px-5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'payroll'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Bordro & Ücret Hesaplama
        </button>

        <button
          onClick={() => setActiveTab('advances')}
          className={`py-3.5 px-5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'advances'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Avans Takibi
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`py-3.5 px-5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'reports'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          İK & Bordro Raporu
        </button>

        <div className="ml-auto flex items-center pr-2">
          <Link
            to="/reports?tab=hr"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
          >
            <span>Raporlar Merkezi</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'employees' && (
          <EmployeeListTab employees={employees} onRefresh={loadEmployees} />
        )}

        {activeTab === 'attendance' && (
          <AttendanceTab employees={employees} onAttendanceChanged={loadEmployees} />
        )}

        {activeTab === 'leaves' && (
          <LeaveTab employees={employees} onLeavesUpdated={loadEmployees} />
        )}

        {activeTab === 'payroll' && (
          <PayrollTab employees={employees} onPayrollUpdated={loadEmployees} />
        )}

        {activeTab === 'advances' && (
          <AdvanceTab employees={employees} onAdvancesUpdated={loadEmployees} />
        )}

        {activeTab === 'reports' && (
          <HRReport />
        )}
      </div>
    </div>
  );
}
