import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Printer, 
  BookOpen, 
  Shield, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  TrendingUp,
  Download
} from 'lucide-react';
import type { Employee, PayrollRecord, SgkStatus } from '../../types';
import { hrService } from '../../services/hrService';
import PayrollSlipModal from './PayrollSlipModal';

interface PayrollTabProps {
  employees: Employee[];
  onPayrollUpdated?: () => void;
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export default function PayrollTab({ employees, onPayrollUpdated }: PayrollTabProps) {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [accountingPayrollId, setAccountingPayrollId] = useState<number | null>(null);
  const [selectedPayrollForSlip, setSelectedPayrollForSlip] = useState<PayrollRecord | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadPayrolls = async () => {
    try {
      setLoading(true);
      // Generate or fetch payrolls for this month
      const list = await hrService.generateMonthlyPayroll(selectedMonth, selectedYear);
      setPayrolls(list);
    } catch (err) {
      console.error('Bordrolar yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayrolls();
  }, [selectedMonth, selectedYear]);

  const handleRecalculate = async () => {
    try {
      setCalculating(true);
      setMessage(null);
      const list = await hrService.generateMonthlyPayroll(selectedMonth, selectedYear);
      setPayrolls(list);
      setMessage({ type: 'success', text: `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear} bordroları puantaj ve avanslara göre güncellendi.` });
      onPayrollUpdated?.();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Bordro hesaplanırken hata oluştu.' });
    } finally {
      setCalculating(false);
    }
  };

  const handleAccountPayroll = async (id: number) => {
    try {
      setAccountingPayrollId(id);
      await hrService.accountPayroll(id);
      await loadPayrolls();
      setMessage({ type: 'success', text: 'Bordro Genel Muhasebeye (TDHP) yevmiye fişi olarak aktarıldı.' });
      onPayrollUpdated?.();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Muhasebeleştirme hatası.' });
    } finally {
      setAccountingPayrollId(null);
    }
  };

  // Navigations
  const prevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Aggregations: SGK'lı vs SGK'sız
  const sgkLiRecords = payrolls.filter(p => p.sgkStatus === 'sgk_li');
  const sgkSizRecords = payrolls.filter(p => p.sgkStatus === 'sgk_siz');

  const totalSgkLiNet = sgkLiRecords.reduce((sum, p) => sum + p.netSalary, 0);
  const totalSgkLiGross = sgkLiRecords.reduce((sum, p) => sum + p.totalGrossPay, 0);
  const totalSgkLiEmployerCost = sgkLiRecords.reduce((sum, p) => sum + p.totalEmployerCost, 0);
  const totalSgkLiTaxesAndSGK = totalSgkLiEmployerCost - totalSgkLiNet;

  const totalSgkSizNet = sgkSizRecords.reduce((sum, p) => sum + p.netSalary, 0);
  const totalSgkSizCost = sgkSizRecords.reduce((sum, p) => sum + p.totalEmployerCost, 0);

  const grandTotalNet = totalSgkLiNet + totalSgkSizNet;
  const grandTotalEmployerCost = totalSgkLiEmployerCost + totalSgkSizCost;

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-black text-slate-800 tracking-wide">
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear} Bordrosu
            </span>
          </div>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRecalculate}
            disabled={calculating}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm shadow-indigo-200 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {calculating ? 'Hesaplanıyor...' : 'Bordroları Yeniden Hesapla'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-xs font-medium border flex items-center justify-between ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      {/* Comparative Cards: SGK'LI vs SGK'SIZ vs TOPLAM MALİYET */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: SGK'lı Personel */}
        <div className="p-5 bg-white rounded-xl border border-emerald-200 shadow-sm space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <Shield className="w-4 h-4" />
              </span>
              <div>
                <h4 className="font-bold text-xs text-slate-800 uppercase">SGK'lı Personel</h4>
                <p className="text-[11px] text-slate-500">{sgkLiRecords.length} Çalışan (Bordrolu)</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Yasal Kesintili
            </span>
          </div>

          <div className="space-y-1.5 pt-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Toplam Net Maaş:</span>
              <span className="font-bold font-mono text-slate-900">₺{totalSgkLiNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>SGK & Vergi Yükü:</span>
              <span className="font-mono text-rose-600">₺{totalSgkLiTaxesAndSGK.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-100 font-black text-slate-900">
              <span>İşveren Toplam Maliyet:</span>
              <span className="font-mono text-emerald-700 text-sm">₺{totalSgkLiEmployerCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Card 2: SGK'sız / Günlük Yevmiyeli */}
        <div className="p-5 bg-white rounded-xl border border-amber-200 shadow-sm space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </span>
              <div>
                <h4 className="font-bold text-xs text-slate-800 uppercase">SGK'sız / Yevmiyeli</h4>
                <p className="text-[11px] text-slate-500">{sgkSizRecords.length} Çalışan (Harici / Usta)</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              Doğrudan Net
            </span>
          </div>

          <div className="space-y-1.5 pt-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Fiili Gün / Mesai Hakediş:</span>
              <span className="font-bold font-mono text-slate-900">₺{totalSgkSizNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Yasal Kesinti / Stopaj:</span>
              <span className="font-mono text-slate-400">₺0,00</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-100 font-black text-slate-900">
              <span>Toplam Net Ödenecek:</span>
              <span className="font-mono text-amber-700 text-sm">₺{totalSgkSizCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Şirket Toplam İşveren Maliyeti */}
        <div className="p-5 bg-slate-900 text-white rounded-xl shadow-sm space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-slate-800 text-indigo-400 rounded-lg">
                <Building2 className="w-4 h-4" />
              </span>
              <div>
                <h4 className="font-bold text-xs uppercase text-slate-300">Genel Şirket Maliyeti</h4>
                <p className="text-[11px] text-slate-400">{payrolls.length} Toplam Personel</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-900/50 text-indigo-300 border border-indigo-700">
              Bordro Özeti
            </span>
          </div>

          <div className="space-y-1.5 pt-1 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Personele Ödenecek Net:</span>
              <span className="font-bold font-mono text-white">₺{grandTotalNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-800 font-black">
              <span className="text-slate-200">Toplam İşveren Maliyeti:</span>
              <span className="font-mono text-emerald-400 text-base">₺{grandTotalEmployerCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Payroll Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-indigo-600" />
            Personel Bordro & Hakediş Listesi ({MONTH_NAMES[selectedMonth - 1]} {selectedYear})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-3">Personel</th>
                <th className="p-3 text-center">SGK Tipi</th>
                <th className="p-3 text-center">Puantaj</th>
                <th className="p-3 text-right">Taban / Hak Ediş</th>
                <th className="p-3 text-right">Fazla Mesai</th>
                <th className="p-3 text-right">Yasal Kesintiler</th>
                <th className="p-3 text-right">Avans Kes.</th>
                <th className="p-3 text-right font-black text-slate-900">Net Ödenecek</th>
                <th className="p-3 text-right text-emerald-800">İşveren Maliyeti</th>
                <th className="p-3 text-center">Muhasebe</th>
                <th className="p-3 text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payrolls.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    Henüz bordro hesabı yapılmadı. Yukarıdaki "Bordroları Yeniden Hesapla" butonuna tıklayınız.
                  </td>
                </tr>
              ) : (
                payrolls.map((rec) => {
                  const emp = employees.find(e => e.id === rec.employeeId);
                  const isSgk = rec.sgkStatus === 'sgk_li';

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{rec.employeeName}</div>
                        <div className="text-[10px] text-slate-500">{rec.employeeCode} • {rec.department}</div>
                      </td>

                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isSgk ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {isSgk ? 'SGK\'lı' : 'SGK\'sız / Yevmiyeli'}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <div className="font-semibold text-slate-700">{rec.daysWorked} Gün</div>
                        {rec.overtimeHours > 0 && (
                          <div className="text-[10px] font-bold text-indigo-600">+{rec.overtimeHours} sa mesai</div>
                        )}
                      </td>

                      <td className="p-3 text-right font-mono font-medium text-slate-700">
                        ₺{rec.basePay.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-3 text-right font-mono font-medium text-indigo-600">
                        {rec.overtimePay > 0 ? `₺${rec.overtimePay.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '-'}
                      </td>

                      <td className="p-3 text-right font-mono text-rose-600">
                        {rec.totalLegalDeductions > 0 ? `-₺${rec.totalLegalDeductions.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '-'}
                      </td>

                      <td className="p-3 text-right font-mono text-rose-600">
                        {rec.advanceDeduction > 0 ? `-₺${rec.advanceDeduction.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '-'}
                      </td>

                      <td className="p-3 text-right font-mono font-black text-slate-900 bg-slate-50/50">
                        ₺{rec.netSalary.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">
                        ₺{rec.totalEmployerCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-3 text-center">
                        {rec.isAccounted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            İşlendi
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAccountPayroll(rec.id!)}
                            disabled={accountingPayrollId === rec.id}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold border border-slate-300 transition-colors flex items-center gap-1 mx-auto disabled:opacity-50"
                            title="Genel Muhasebe TDHP Yevmiye Fişi Oluştur"
                          >
                            <BookOpen className="w-3 h-3 text-indigo-600" />
                            {accountingPayrollId === rec.id ? 'İşleniyor...' : 'Fiş Kes'}
                          </button>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedPayrollForSlip(rec)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 transition-colors inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Pusula
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slip Modal */}
      {selectedPayrollForSlip && (
        <PayrollSlipModal
          isOpen={!!selectedPayrollForSlip}
          onClose={() => setSelectedPayrollForSlip(null)}
          payroll={selectedPayrollForSlip}
          employee={employees.find(e => e.id === selectedPayrollForSlip.employeeId)}
        />
      )}
    </div>
  );
}
