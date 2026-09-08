import React, { useState } from 'react';
import { UserCheck, Clock, Percent, Calendar, Save, Check, Shield } from 'lucide-react';
import type { AppSettings } from '../../types';

interface HRSettingsProps {
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => Promise<void>;
}

export default function HRSettings({ settings, onSave }: HRSettingsProps) {
  const [weeklyHours, setWeeklyHours] = useState(settings.hr?.weeklyWorkHours || 45);
  const [dailyHours, setDailyHours] = useState(settings.hr?.dailyWorkHours || 8);
  const [overtimeWeekday, setOvertimeWeekday] = useState(settings.hr?.overtimeWeekdayMultiplier || 1.5);
  const [overtimeWeekend, setOvertimeWeekend] = useState(settings.hr?.overtimeWeekendMultiplier || 2.0);
  const [annualLeaveDays, setAnnualLeaveDays] = useState(settings.hr?.annualLeaveBaseDays || 14);

  const [sgkEmployee, setSgkEmployee] = useState(settings.hr?.sgkEmployeeRate || 14);
  const [unempEmployee, setUnempEmployee] = useState(settings.hr?.unemploymentEmployeeRate || 1);
  const [sgkEmployer, setSgkEmployer] = useState(settings.hr?.sgkEmployerRate || 15.5);
  const [unempEmployer, setUnempEmployer] = useState(settings.hr?.unemploymentEmployerRate || 2);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated: AppSettings = {
        ...settings,
        hr: {
          ...settings.hr,
          weeklyWorkHours: Number(weeklyHours),
          dailyWorkHours: Number(dailyHours),
          overtimeWeekdayMultiplier: Number(overtimeWeekday),
          overtimeWeekendMultiplier: Number(overtimeWeekend),
          annualLeaveBaseDays: Number(annualLeaveDays),
          sgkEmployeeRate: Number(sgkEmployee),
          unemploymentEmployeeRate: Number(unempEmployee),
          sgkEmployerRate: Number(sgkEmployer),
          unemploymentEmployerRate: Number(unempEmployer)
        }
      };
      await onSave(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('İK ayarları kaydedilemedi:', err);
      alert('İK ayarları kaydedilirken hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wider">İnsan Kaynakları & Bordro parametreleri başarıyla kaydedildi.</span>
          </div>
        </div>
      )}

      {/* SECTION 1: ÇALIŞMA SAATLERİ VE FAZLA MESAİ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold uppercase tracking-wider">Çalışma Süreleri & Fazla Mesai Katsayıları</h3>
              <p className="text-slate-400 text-xs font-medium">4857 sayılı İş Kanunu standartları ve mesai çarpanları</p>
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Haftalık Yasal Çalışma (Saat)</label>
            <input
              type="number"
              min="1"
              max="60"
              value={weeklyHours}
              onChange={e => setWeeklyHours(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <span className="text-[10px] text-slate-400">Yasal standart 45 saat</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Günlük Normal Mesai (Saat)</label>
            <input
              type="number"
              min="1"
              max="12"
              value={dailyHours}
              onChange={e => setDailyHours(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <span className="text-[10px] text-slate-400">Genel vardiya 8 saat</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hafta İçi Mesai Çarpanı (x)</label>
            <input
              type="number"
              min="1"
              max="3"
              step="0.1"
              value={overtimeWeekday}
              onChange={e => setOvertimeWeekday(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <span className="text-[10px] text-slate-400">Standart %50 zamlı (1.5x)</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hafta Sonu & Tatil Çarpanı (x)</label>
            <input
              type="number"
              min="1"
              max="4"
              step="0.1"
              value={overtimeWeekend}
              onChange={e => setOvertimeWeekend(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <span className="text-[10px] text-slate-400">Pazar/Resmi tatil %100 zamlı (2.0x)</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: SGK VE YASAL KESİNTİLER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold uppercase tracking-wider">SGK & Bordro Yasal Kesinti Oranları</h3>
              <p className="text-slate-400 text-xs font-medium">Bordro hesaplamasında kullanılan işçi ve işveren payları</p>
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SGK İşçi Primi (%)</label>
            <input
              type="number"
              step="0.1"
              value={sgkEmployee}
              onChange={e => setSgkEmployee(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <span className="text-[10px] text-slate-400">Yasal oran %14</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">İşsizlik Sigortası İşçi (%)</label>
            <input
              type="number"
              step="0.1"
              value={unempEmployee}
              onChange={e => setUnempEmployee(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <span className="text-[10px] text-slate-400">Yasal oran %1</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SGK İşveren Primi (%)</label>
            <input
              type="number"
              step="0.1"
              value={sgkEmployer}
              onChange={e => setSgkEmployer(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <span className="text-[10px] text-slate-400">Hazine teşvikli %15.5 / normal %20.5</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">İşsizlik Sigortası İşveren (%)</label>
            <input
              type="number"
              step="0.1"
              value={unempEmployer}
              onChange={e => setUnempEmployer(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <span className="text-[10px] text-slate-400">Yasal oran %2</span>
          </div>
        </div>

        <div className="p-6 bg-white border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Kaydediliyor...' : 'İK Parametrelerini Kaydet'}
          </button>
        </div>
      </div>
    </form>
  );
}
