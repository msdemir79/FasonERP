import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Phone, 
  Mail, 
  Calendar, 
  Shield, 
  DollarSign, 
  UserCheck, 
  Users, 
  Building2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { Employee, SgkStatus, EmployeeDepartment } from '../../types';
import { hrService } from '../../services/hrService';
import EmployeeModal from './EmployeeModal';

interface EmployeeListTabProps {
  employees: Employee[];
  onRefresh: () => void;
}

export default function EmployeeListTab({ employees, onRefresh }: EmployeeListTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sgkFilter, setSgkFilter] = useState<'all' | SgkStatus>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'passive'>('active');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const handleEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setIsModalOpen(true);
  };

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`${emp.name} isimli personeli silmek istediğinize emin misiniz?`)) return;
    try {
      await hrService.deleteEmployee(emp.id!);
      onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Personel silinemedi.');
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    if (statusFilter !== 'all' && emp.status !== statusFilter) return false;
    if (sgkFilter !== 'all' && emp.sgkStatus !== sgkFilter) return false;
    if (deptFilter !== 'all' && emp.department !== deptFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = emp.name.toLowerCase().includes(q);
      const matchCode = emp.employeeCode.toLowerCase().includes(q);
      const matchPos = emp.position.toLowerCase().includes(q);
      const matchPhone = emp.phone?.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchPos && !matchPhone) return false;
    }
    return true;
  });

  // Department list from existing employees
  const departments = Array.from(new Set(employees.map(e => e.department)));

  return (
    <div className="space-y-6">
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        
        {/* Search and Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Personel adı, sicil, görev..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* SGK Status Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs">
            <button
              onClick={() => setSgkFilter('all')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                sgkFilter === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tümü ({employees.length})
            </button>
            <button
              onClick={() => setSgkFilter('sgk_li')}
              className={`px-3 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors ${
                sgkFilter === 'sgk_li' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Shield className="w-3 h-3 text-emerald-600" />
              SGK'lı ({employees.filter(e => e.sgkStatus === 'sgk_li').length})
            </button>
            <button
              onClick={() => setSgkFilter('sgk_siz')}
              className={`px-3 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors ${
                sgkFilter === 'sgk_siz' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <DollarSign className="w-3 h-3 text-amber-600" />
              SGK'sız / Yevmiyeli ({employees.filter(e => e.sgkStatus === 'sgk_siz').length})
            </button>
          </div>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="all">Tüm Departmanlar</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Add Employee Button */}
        <button
          onClick={() => {
            setEditingEmployee(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm shadow-indigo-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Yeni Personel Ekle
        </button>
      </div>

      {/* Employee Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEmployees.length === 0 ? (
          <div className="col-span-full p-12 bg-white rounded-xl border border-slate-200 text-center text-slate-400">
            Arama kriterlerinize uygun personel bulunamadı.
          </div>
        ) : (
          filteredEmployees.map((emp) => {
            const isSgk = emp.sgkStatus === 'sgk_li';
            const remainingLeave = Math.max(0, (emp.entitledAnnualLeave ?? 14) - (emp.usedAnnualLeave ?? 0));

            return (
              <div
                key={emp.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  {/* Top info */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                        isSgk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {emp.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-800 group-hover:text-indigo-600 transition-colors">
                          {emp.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-mono">{emp.employeeCode}</span>
                          <span>•</span>
                          <span>{emp.position}</span>
                        </div>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isSgk 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {isSgk ? 'SGK\'lı' : 'SGK\'sız'}
                    </span>
                  </div>

                  {/* Department & Wage details */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="text-[11px] text-slate-500 uppercase font-semibold">Departman:</span>
                      <span className="font-bold text-slate-800">{emp.department}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600">
                      <span className="text-[11px] text-slate-500 uppercase font-semibold">
                        {emp.salaryType === 'daily' ? 'Günlük Yevmiye:' : 'Aylık Ücret:'}
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        ₺{emp.baseSalary.toLocaleString('tr-TR')} 
                        <span className="text-[10px] text-slate-500 font-normal ml-1">
                          {emp.salaryType === 'daily' ? '/ gün' : emp.salaryType === 'monthly_gross' ? '(Brüt)' : '(Net)'}
                        </span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600">
                      <span className="text-[11px] text-slate-500 uppercase font-semibold">Kalan İzin:</span>
                      <span className="font-mono font-semibold text-indigo-600">
                        {remainingLeave} Gün
                      </span>
                    </div>
                  </div>

                  {/* Contact Snippets */}
                  <div className="space-y-1 text-xs text-slate-500">
                    {emp.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{emp.phone}</span>
                      </div>
                    )}
                    {emp.paymentMethod === 'bank' && emp.iban && (
                      <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 truncate" title={emp.iban}>
                        <span>IBAN: {emp.iban}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-400">
                    Giriş: {new Date(emp.hireDate).toLocaleDateString('tr-TR')}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(emp)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Düzenle"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(emp)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Employee Modal */}
      <EmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        employee={editingEmployee}
        onSaved={onRefresh}
      />
    </div>
  );
}
