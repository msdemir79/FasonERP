import React, { useEffect } from 'react';
import { 
  X, 
  Printer, 
  Building2, 
  User, 
  Shield, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  AlertCircle, 
  AlertTriangle, 
  ArrowDownRight, 
  ArrowUpRight, 
  FileText, 
  Info, 
  HelpCircle, 
  Landmark, 
  Wallet,
  CalendarCheck2,
  CalendarX2,
  MinusCircle,
  PlusCircle
} from 'lucide-react';
import type { PayrollRecord, Employee } from '../../types';

interface PayrollSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  payroll: PayrollRecord | null;
  employee?: Employee | null;
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

/**
 * Sayısal tutarı Türkçe yazıyla ifade eden yardımcı fonksiyon
 * Örnek: 31979.16 -> "Yalnız Otuz Bir Bin Dokuz Yüz Yetmiş Dokuz Türk Lirası On Altı Kuruştur."
 */
function numberToWordsTR(val: number): string {
  if (val === undefined || val === null || isNaN(val) || val === 0) {
    return 'Yalnız Sıfır Türk Lirasıdır.';
  }

  const units = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz'];
  const tens = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan'];

  function convertGroup(num: number): string {
    let res = '';
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const u = num % 10;

    if (h > 0) {
      if (h === 1) res += 'Yüz ';
      else res += units[h] + ' Yüz ';
    }
    if (t > 0) {
      res += tens[t] + ' ';
    }
    if (u > 0) {
      res += units[u] + ' ';
    }
    return res;
  }

  const rounded = Math.round(val * 100) / 100;
  const intPart = Math.floor(Math.abs(rounded));
  const decPart = Math.round((Math.abs(rounded) - intPart) * 100);

  let result = '';

  const billions = Math.floor(intPart / 1_000_000_000);
  const millions = Math.floor((intPart % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((intPart % 1_000_000) / 1000);
  const remainder = intPart % 1000;

  if (billions > 0) {
    result += convertGroup(billions) + 'Milyar ';
  }
  if (millions > 0) {
    result += convertGroup(millions) + 'Milyon ';
  }
  if (thousands > 0) {
    if (thousands === 1) result += 'Bin ';
    else result += convertGroup(thousands) + 'Bin ';
  }
  if (remainder > 0 || intPart === 0) {
    result += convertGroup(remainder);
  }

  result = result.trim() + ' Türk Lirası';

  if (decPart > 0) {
    const decGroup = convertGroup(decPart).trim();
    result += ' ' + decGroup + ' Kuruş';
  }

  return 'Yalnız ' + result.trim() + 'tur.';
}

export default function PayrollSlipModal({ isOpen, onClose, payroll, employee }: PayrollSlipModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !payroll) return null;

  const isSgk = payroll.sgkStatus === 'sgk_li';
  const isDaily = payroll.salaryType === 'daily';
  const isHourly = payroll.salaryType === 'hourly';

  // Sözleşme / Anlaşılan taban ücret
  const agreedBaseSalary = employee?.baseSalary || payroll.baseSalary || 0;

  // Günlük hak ediş birim tutarı (30 gün standardı veya günlük yevmiye)
  const dailyRate = isDaily 
    ? agreedBaseSalary 
    : Math.round((agreedBaseSalary / 30) * 100) / 100;

  // Saatlik normal çalışma ücreti
  const hourlyNormalRate = isDaily
    ? Math.round((dailyRate / 8) * 100) / 100
    : Math.round((agreedBaseSalary / 240) * 100) / 100;

  // Saatlik %50 zamlı fazla mesai birim ücreti
  const hourlyOvertimeRate = Math.round(hourlyNormalRate * 1.5 * 100) / 100;

  // Puantaj sayıları
  const absentDays = payroll.absentDays || 0;
  const unpaidLeaveDays = payroll.unpaidLeaveDays || 0;
  const totalMissingDays = absentDays + unpaidLeaveDays;
  const paidDays = payroll.totalDays || (payroll.daysWorked + payroll.weeklyRestDays + payroll.paidLeaveDays);

  // Eksik gün / devamsızlık kesinti tutarları
  const absentDeductionAmount = isDaily
    ? Math.round(absentDays * dailyRate * 100) / 100
    : Math.round(absentDays * dailyRate * 100) / 100;

  const unpaidLeaveDeductionAmount = isDaily
    ? Math.round(unpaidLeaveDays * dailyRate * 100) / 100
    : Math.round(unpaidLeaveDays * dailyRate * 100) / 100;

  const totalMissingDeduction = absentDeductionAmount + unpaidLeaveDeductionAmount;

  // Toplam kesintiler
  const totalDeductions = (payroll.totalLegalDeductions || 0) + (payroll.advanceDeduction || 0) + (payroll.otherDeductions || 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-2 sm:p-4 md:p-6 flex justify-center items-center print:p-0 print:bg-white print:static print:overflow-visible"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[96vh] overflow-hidden border border-slate-200 print:border-none print:shadow-none print:my-0 print:max-h-none animate-in fade-in zoom-in-95 flex flex-col">
        
        {/* Sticky Modal Header (Ekranın üstünde sabit, yazdırmada gizli) */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 bg-white z-30 print:hidden shadow-xs">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm sm:text-base text-slate-800">Şeffaf Ücret Hesap Pusulası (Bordro Zarfı)</h3>
            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
              isSgk ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {isSgk ? "SGK'lı Bordrolu (4/a)" : "SGK'sız / Günlük Yevmiyeli"}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
              title="Yazdır / PDF Olarak Kaydet"
            >
              <Printer className="w-4 h-4" />
              <span>Yazdır / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-3 py-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors border border-slate-300 cursor-pointer"
              title="Kapat (Esc)"
            >
              <X className="w-4 h-4" />
              <span>Kapat</span>
            </button>
          </div>
        </div>

        {/* Printable Slip Content with internal scrolling */}
        <div className="p-5 sm:p-8 space-y-5 text-slate-900 bg-white overflow-y-auto flex-1 print:overflow-visible print:p-2 print:space-y-4" id="printable-payroll-slip">
          
          {/* 1. Kurumsal ve Belge Başlığı */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-4 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-700 print:text-black" />
                <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-900">
                  PRO ERP AYAKKABI SAN. TİC. LTD. ŞTİ.
                </h2>
              </div>
              <p className="text-xs text-slate-600 mt-1">İkitelli OSB Aykosan Sanayi Sitesi 4. Ada B Blok No:12 Başakşehir / İstanbul</p>
              <p className="text-xs text-slate-600 font-mono">Vergi Dairesi: İkitelli V.D. 7320491820 | SGK İşyeri Sicil: 2.1029384.034.34.45</p>
            </div>
            <div className="sm:text-right shrink-0">
              <div className="inline-block border-2 border-slate-900 px-3 py-1 text-xs sm:text-sm font-black uppercase bg-slate-100 print:bg-transparent">
                ÜCRET HESAP PUSULASI
              </div>
              <p className="text-xs font-bold text-slate-800 mt-1.5">
                Hesap Dönemi: <span className="text-indigo-700 print:text-black font-black">{MONTH_NAMES[payroll.month - 1]} {payroll.year}</span>
              </p>
              <p className="text-[10px] text-slate-500 italic mt-0.5">
                4857 Sayılı İş Kanunu Madde 37 Uyarınca Düzenlenmiştir
              </p>
            </div>
          </div>

          {/* 2. Personel ve Sözleşme Bilgileri Kartı */}
          <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-3.5 sm:p-4 text-xs">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1.5 mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600 print:text-black" />
                Personel & Sözleşme / Ücret Bilgileri
              </span>
              <span className="text-slate-500 font-normal">Sicil No: <b className="font-mono text-slate-900">{payroll.employeeCode}</b></span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-slate-800">
              <div>
                <span className="text-slate-500 block text-[11px]">Adı Soyadı:</span>
                <span className="font-bold text-sm text-slate-900">{payroll.employeeName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">T.C. Kimlik No:</span>
                <span className="font-mono font-bold text-slate-900">{employee?.tcNo || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Departman & Görev:</span>
                <span className="font-bold text-slate-900">{payroll.department} - {employee?.position || 'Çalışan'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">SGK Statüsü:</span>
                <span className={`font-bold ${isSgk ? 'text-emerald-700' : 'text-amber-800'}`}>
                  {isSgk ? "4/a Sigortalı (SGK'lı)" : "Harici / Günlük Yevmiyeli"}
                </span>
              </div>

              {/* İkinci Satır: Ücret ve Sözleşme Koşulları */}
              <div className="border-t border-slate-200/60 pt-2">
                <span className="text-slate-500 block text-[11px]">Sözleşme Taban Ücreti:</span>
                <span className="font-mono font-bold text-indigo-900 print:text-black">
                  ₺{agreedBaseSalary.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  <span className="text-[10px] font-normal text-slate-600 block">
                    ({isDaily ? 'Günlük Anlaşılan Yevmiye' : isHourly ? 'Saatlik Ücret' : isSgk ? 'Aylık Brüt Taban' : 'Aylık Sabit Net'})
                  </span>
                </span>
              </div>
              <div className="border-t border-slate-200/60 pt-2">
                <span className="text-slate-500 block text-[11px]">Günlük Birim Hak Ediş:</span>
                <span className="font-mono font-bold text-slate-900">
                  ₺{dailyRate.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} / Gün
                </span>
                <span className="text-[10px] text-slate-500 block">{isDaily ? 'Yevmiye Tutarı' : 'Aylık Maaş ÷ 30 Gün'}</span>
              </div>
              <div className="border-t border-slate-200/60 pt-2">
                <span className="text-slate-500 block text-[11px]">Fazla Mesai Saat Ücreti:</span>
                <span className="font-mono font-bold text-slate-900">
                  ₺{hourlyOvertimeRate.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} / Saat
                </span>
                <span className="text-[10px] text-slate-500 block">%50 Zamlı (1.5x Katsayı)</span>
              </div>
              <div className="border-t border-slate-200/60 pt-2">
                <span className="text-slate-500 block text-[11px]">Ödeme Kanalı:</span>
                <span className="font-bold text-slate-900">
                  {employee?.paymentMethod === 'bank' ? (
                    <span className="text-indigo-700 print:text-black">
                      Banka ({employee?.bankName || 'Banka'})
                    </span>
                  ) : (
                    <span className="text-amber-700 print:text-black">Nakit (Kasa)</span>
                  )}
                </span>
                {employee?.iban && (
                  <span className="text-[10px] font-mono text-slate-500 block truncate" title={employee.iban}>
                    {employee.iban}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3. Puantaj ve Takvim Cetveli Özeti */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 print:text-black" />
                Dönem Puantaj & Gün Dökümü Cetveli
              </h4>
              <span className="text-[11px] font-bold text-slate-600">
                Hak Edilen Ücretli Gün: <b className="text-indigo-700 print:text-black font-mono">{paidDays} Gün</b>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-2.5 text-center">
                <span className="text-[10px] text-emerald-800 uppercase font-bold block">Fiili Çalışma</span>
                <span className="text-base font-black font-mono text-emerald-900">{payroll.daysWorked}</span>
                <span className="text-[10px] text-emerald-600 block">Gün (Mesai)</span>
              </div>
              <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-2.5 text-center">
                <span className="text-[10px] text-blue-800 uppercase font-bold block">Hafta Tatili</span>
                <span className="text-base font-black font-mono text-blue-900">{payroll.weeklyRestDays}</span>
                <span className="text-[10px] text-blue-600 block">Gün (Pazar)</span>
              </div>
              <div className="bg-sky-50/50 border border-sky-200 rounded-lg p-2.5 text-center">
                <span className="text-[10px] text-sky-800 uppercase font-bold block">Ücretli İzin / RT</span>
                <span className="text-base font-black font-mono text-sky-900">{payroll.paidLeaveDays}</span>
                <span className="text-[10px] text-sky-600 block">Gün (Hak Edildi)</span>
              </div>
              <div className={`border rounded-lg p-2.5 text-center ${absentDays > 0 ? 'bg-rose-50 border-rose-300' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] text-rose-800 uppercase font-bold block">Devamsızlık (D)</span>
                <span className={`text-base font-black font-mono ${absentDays > 0 ? 'text-rose-700' : 'text-slate-400'}`}>{absentDays}</span>
                <span className="text-[10px] text-rose-600 block">{absentDays > 0 ? 'Maaştan Kesildi' : 'Yok'}</span>
              </div>
              <div className={`border rounded-lg p-2.5 text-center ${unpaidLeaveDays > 0 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] text-amber-800 uppercase font-bold block">Ücretsiz İzin</span>
                <span className={`text-base font-black font-mono ${unpaidLeaveDays > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{unpaidLeaveDays}</span>
                <span className="text-[10px] text-amber-600 block">{unpaidLeaveDays > 0 ? 'Maaştan Kesildi' : 'Yok'}</span>
              </div>
              <div className="bg-indigo-50/60 border border-indigo-200 rounded-lg p-2.5 text-center">
                <span className="text-[10px] text-indigo-800 uppercase font-bold block">Fazla Mesai</span>
                <span className="text-base font-black font-mono text-indigo-900">{payroll.overtimeHours}</span>
                <span className="text-[10px] text-indigo-600 block">Saat ({payroll.overtimePay > 0 ? `+₺${payroll.overtimePay}` : 'Yok'})</span>
              </div>
            </div>
          </div>

          {/* 4. "MAAŞIM NEDEN VE NASIL HESAPLANDI?" ŞEFFAF MUTABAKAT TABLOSU (Çalışanın tüm sorularını cevaplar) */}
          <div className="border-2 border-slate-900 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-black uppercase tracking-wider">
                  Maaş & Hak Ediş Değişim Analizi (Personel Şeffaflık Tablosu)
                </h4>
              </div>
              <span className="text-[11px] text-slate-300">
                Maaşınızdan ne arttı, ne kesildi?
              </span>
            </div>

            <div className="p-3.5 sm:p-4 text-xs space-y-2.5 bg-slate-50/50">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold text-[11px]">
                    <th className="text-left pb-1.5">İşlem / Kalem</th>
                    <th className="text-left pb-1.5">Açıklama & Gerekçe</th>
                    <th className="text-right pb-1.5">Hesaplama Formülü</th>
                    <th className="text-right pb-1.5">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 font-mono">
                  {/* Taban Maaş */}
                  <tr>
                    <td className="py-1.5 text-left font-sans font-bold text-slate-900 flex items-center gap-1.5">
                      <PlusCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      {isDaily ? 'Temel Yevmiye Hak Edişi' : 'Sözleşme Taban Maaşı'}
                    </td>
                    <td className="py-1.5 text-left font-sans text-slate-600">
                      {isDaily 
                        ? `${payroll.daysWorked} fiili gün + ${payroll.paidLeaveDays} gün ücretli izin karşılığı` 
                        : 'Tam ay çalışma standardı (30 gün)'}
                    </td>
                    <td className="py-1.5 text-right text-slate-500">
                      {isDaily ? `${paidDays} gün × ₺${dailyRate.toLocaleString('tr-TR')}` : 'Aylık Standart'}
                    </td>
                    <td className="py-1.5 text-right font-bold text-emerald-700">
                      +₺{payroll.basePay.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Devamsızlık Kesintisi (Varsa) */}
                  {absentDays > 0 ? (
                    <tr className="bg-rose-50/50">
                      <td className="py-1.5 text-left font-sans font-bold text-rose-700 flex items-center gap-1.5">
                        <MinusCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        Devamsızlık Kesintisi
                      </td>
                      <td className="py-1.5 text-left font-sans text-rose-700">
                        {absentDays} gün işe mazeretsiz gelinmediği için maaştan düşüldü
                      </td>
                      <td className="py-1.5 text-right text-rose-600">
                        {absentDays} gün × ₺{dailyRate.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 text-right font-bold text-rose-700">
                        -₺{absentDeductionAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ) : null}

                  {/* Ücretsiz İzin Kesintisi (Varsa) */}
                  {unpaidLeaveDays > 0 ? (
                    <tr className="bg-amber-50/50">
                      <td className="py-1.5 text-left font-sans font-bold text-amber-800 flex items-center gap-1.5">
                        <MinusCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        Ücretsiz İzin Kesintisi
                      </td>
                      <td className="py-1.5 text-left font-sans text-amber-800">
                        {unpaidLeaveDays} gün onaylı ücretsiz izin kullanıldığı için maaştan düşüldü
                      </td>
                      <td className="py-1.5 text-right text-amber-700">
                        {unpaidLeaveDays} gün × ₺{dailyRate.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 text-right font-bold text-amber-700">
                        -₺{unpaidLeaveDeductionAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ) : null}

                  {/* Eksik Gün Yoksa Bilgi Satırı */}
                  {totalMissingDays === 0 && !isDaily && (
                    <tr className="text-slate-500">
                      <td className="py-1 text-left font-sans flex items-center gap-1.5 text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Eksik Gün Kesintisi
                      </td>
                      <td className="py-1 text-left font-sans text-slate-500" colSpan={2}>
                        Devamsızlık veya ücretsiz izin bulunmamaktadır (Tam çalışma)
                      </td>
                      <td className="py-1 text-right text-slate-400">₺0,00</td>
                    </tr>
                  )}

                  {/* Fazla Mesai (Varsa) */}
                  {payroll.overtimeHours > 0 && (
                    <tr className="bg-indigo-50/40">
                      <td className="py-1.5 text-left font-sans font-bold text-indigo-900 flex items-center gap-1.5">
                        <PlusCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        Fazla Mesai Hak Edişi
                      </td>
                      <td className="py-1.5 text-left font-sans text-indigo-800">
                        {payroll.overtimeHours} saat normal çalışma harici fazla mesai
                      </td>
                      <td className="py-1.5 text-right text-indigo-700">
                        {payroll.overtimeHours} sa × ₺{hourlyOvertimeRate.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 text-right font-bold text-indigo-700">
                        +₺{payroll.overtimePay.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}

                  {/* Prim / İkramiye (Varsa) */}
                  {payroll.bonusPay > 0 && (
                    <tr>
                      <td className="py-1.5 text-left font-sans font-bold text-emerald-800 flex items-center gap-1.5">
                        <PlusCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        Prim / İkramiye / İlave Hak Ediş
                      </td>
                      <td className="py-1.5 text-left font-sans text-slate-600">
                        Performans primi veya yol/yemek yardımı
                      </td>
                      <td className="py-1.5 text-right text-slate-500">-</td>
                      <td className="py-1.5 text-right font-bold text-emerald-700">
                        +₺{payroll.bonusPay.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}

                  {/* SGK & Yasal Kesintiler (SGK'lı ise) */}
                  {isSgk && payroll.totalLegalDeductions > 0 && (
                    <tr>
                      <td className="py-1.5 text-left font-sans font-bold text-slate-800 flex items-center gap-1.5">
                        <MinusCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        Yasal Kesintiler (SGK + Vergi)
                      </td>
                      <td className="py-1.5 text-left font-sans text-slate-600">
                        SGK İşçi (%14) + İşsizlik (%1) + Gelir & Damga Vergisi (İstisna sonrası)
                      </td>
                      <td className="py-1.5 text-right text-slate-500">Yasal Mevzuat</td>
                      <td className="py-1.5 text-right font-bold text-rose-700">
                        -₺{payroll.totalLegalDeductions.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}

                  {/* Avans Kesintisi (Varsa) */}
                  {payroll.advanceDeduction > 0 && (
                    <tr className="bg-rose-50/50">
                      <td className="py-1.5 text-left font-sans font-bold text-rose-700 flex items-center gap-1.5">
                        <MinusCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        Mahsup Edilen Personel Avansı
                      </td>
                      <td className="py-1.5 text-left font-sans text-rose-700">
                        Dönem içinde şirket kasasından/bankadan alınan avans bu aydan düşüldü
                      </td>
                      <td className="py-1.5 text-right text-rose-600">Mahsup</td>
                      <td className="py-1.5 text-right font-bold text-rose-700">
                        -₺{payroll.advanceDeduction.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}

                  {/* Net Ele Geçen Satırı */}
                  <tr className="bg-slate-900 text-white font-black text-sm">
                    <td className="py-2.5 text-left font-sans px-2" colSpan={2}>
                      = ÖDENECEK NET MAAŞ (BANKA / ELDEN)
                    </td>
                    <td className="py-2.5 text-right font-sans text-xs text-slate-300">
                      Hesaba Geçecek Tutar
                    </td>
                    <td className="py-2.5 text-right font-bold text-emerald-400 text-base px-2">
                      ₺{payroll.netSalary.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* İK Bilgilendirme Notu (Friendly HR Memo) */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-3 text-slate-800 text-[11px] leading-relaxed">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-indigo-900 block mb-0.5">İnsan Kaynakları Açıklama & Mutabakat Notu:</span>
                    <p className="text-slate-700">
                      {isDaily ? (
                        <>
                          Sayın <b>{payroll.employeeName}</b>; bu dönem günlük <b>₺{dailyRate.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</b> anlaşılan yevmiye üzerinden, puantajınızda kayıtlı <b>{payroll.daysWorked} gün fiili çalışma</b>{payroll.paidLeaveDays > 0 ? ` ve ${payroll.paidLeaveDays} gün ücretli izin` : ''} karşılığı temel kazanç hesaplanmıştır.{' '}
                          {totalMissingDays > 0 ? (
                            <span className="text-rose-700 font-medium">
                              Puantajınızda bulunan {absentDays > 0 ? `${absentDays} gün devamsızlık` : ''}{absentDays > 0 && unpaidLeaveDays > 0 ? ' ve ' : ''}{unpaidLeaveDays > 0 ? `${unpaidLeaveDays} gün ücretsiz izin` : ''} günlerine yevmiye tahakkuk etmemiştir.
                            </span>
                          ) : (
                            'Eksik gün veya devamsızlık bulunmamaktadır.'
                          )}{' '}
                          {payroll.overtimeHours > 0 ? `Hak ettiğiniz ${payroll.overtimeHours} saat fazla mesai (+₺${payroll.overtimePay.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}) tutarı eklenmiştir. ` : ''}
                          {payroll.advanceDeduction > 0 ? `Ay içerisinde şirketimizden aldığınız ₺${payroll.advanceDeduction.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} avans hak edişinizden düşülmüştür. ` : ''}
                          Hesabınıza net <b>₺{payroll.netSalary.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</b> ödenecektir.
                        </>
                      ) : (
                        <>
                          Sayın <b>{payroll.employeeName}</b>; bu ay sözleşmenizde anlaşılan <b>₺{agreedBaseSalary.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</b> {isSgk ? 'brüt/net' : 'sabit net'} maaşınız üzerinden hesaplama yapılmıştır.{' '}
                          {totalMissingDays > 0 ? (
                            <span className="text-rose-700 font-medium">
                              Puantajınızda yer alan {absentDays > 0 ? `${absentDays} gün devamsızlık (-₺${absentDeductionAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })})` : ''}{absentDays > 0 && unpaidLeaveDays > 0 ? ' ve ' : ''}{unpaidLeaveDays > 0 ? `${unpaidLeaveDays} gün ücretsiz izin (-₺${unpaidLeaveDeductionAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })})` : ''} sebebiyle toplam <b>-₺{totalMissingDeduction.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</b> eksik gün kesintisi uygulanmıştır.
                            </span>
                          ) : (
                            'Dönem içerisinde herhangi bir devamsızlık veya ücretsiz izin kesintiniz bulunmamaktadır (30 gün tam çalışma).'
                          )}{' '}
                          {payroll.overtimeHours > 0 ? `Hak ettiğiniz ${payroll.overtimeHours} saat fazla mesai (+₺${payroll.overtimePay.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}) eklenmiştir. ` : ''}
                          {payroll.advanceDeduction > 0 ? `Daha önce almış olduğunuz ₺${payroll.advanceDeduction.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} tutarındaki avans mahsup edilmiştir. ` : ''}
                          Hesabınıza net <b>₺{payroll.netSalary.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</b> ödenecektir.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Ayrıntılı Yasal Kazançlar ve Kesintiler Tabloları (Çift Kolon) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Sol: Kazançlar (Hak Edişler) */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="bg-slate-100 font-bold px-3.5 py-2 border-b border-slate-200 text-slate-800 uppercase flex items-center justify-between">
                <span>Kazançlar (Hak Edişler)</span>
                <span className="text-[10px] text-slate-500 font-normal">Gelir Kalemleri</span>
              </div>
              <div className="p-3 space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Normal Çalışma Ücreti ({payroll.daysWorked} Gün):</span>
                  <span className="font-mono font-bold">₺{payroll.basePay.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Fazla Mesai Ücreti ({payroll.overtimeHours} Saat):</span>
                  <span className="font-mono font-bold text-indigo-700">
                    {payroll.overtimePay > 0 ? `₺${payroll.overtimePay.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '₺0,00'}
                  </span>
                </div>
                {payroll.bonusPay > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Prim / İkramiye / Yol:</span>
                    <span className="font-mono font-bold text-emerald-700">₺{payroll.bonusPay.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 font-black text-slate-900 border-t border-slate-300 bg-slate-50 px-2 rounded">
                  <span>Toplam Tahakkuk Eden Kazanç:</span>
                  <span className="font-mono text-sm">₺{payroll.totalGrossPay.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Sağ: Kesintiler (Yasal ve Şirket) */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="bg-slate-100 font-bold px-3.5 py-2 border-b border-slate-200 text-slate-800 uppercase flex items-center justify-between">
                <span>Kesintiler (Yasal & Mahsup)</span>
                <span className="text-[10px] text-slate-500 font-normal">Gider Kalemleri</span>
              </div>
              <div className="p-3 space-y-2">
                {isSgk ? (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">SGK İşçi Primi (%14):</span>
                      <span className="font-mono font-bold text-rose-600">-₺{payroll.employeeSgkShare.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">İşsizlik Sigortası Primi (%1):</span>
                      <span className="font-mono font-bold text-rose-600">-₺{payroll.employeeUnemploymentShare.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Gelir Vergisi (İstisna Düşülmüş):</span>
                      <span className="font-mono font-bold text-rose-600">-₺{payroll.incomeTax.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Damga Vergisi (İstisna Düşülmüş):</span>
                      <span className="font-mono font-bold text-rose-600">-₺{payroll.stampTax.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                ) : (
                  <div className="py-2 text-slate-500 italic text-[11px] bg-slate-50 p-2 rounded">
                    * Harici / SGK'sız bordro: Yasal SGK prim kesintisi ve vergi stopajı bulunmamaktadır.
                  </div>
                )}

                {payroll.advanceDeduction > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100 bg-rose-50/40 px-1 rounded">
                    <span className="text-rose-800 font-medium">Mahsup Edilen Personel Avansı:</span>
                    <span className="font-mono font-bold text-rose-600">-₺{payroll.advanceDeduction.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                {payroll.otherDeductions > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Diğer Kesintiler (BES / İcra):</span>
                    <span className="font-mono font-bold text-rose-600">-₺{payroll.otherDeductions.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                <div className="flex justify-between py-2 font-black text-slate-900 border-t border-slate-300 bg-rose-50/60 px-2 rounded">
                  <span>Toplam Kesintiler:</span>
                  <span className="font-mono text-sm text-rose-700">
                    -₺{totalDeductions.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Yasal SGK ve Vergi Matrahları (SGK'lı ise Şeffaf Gösterim) */}
          {isSgk && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-[11px]">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Yasal Vergi & SGK Matrah Dökümü (7349 Sayılı Kanun Asgari Ücret Muafiyeti Uygulanmıştır)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700 font-mono">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-sans block">SGK Matrahı (SPEK):</span>
                  <span className="font-bold text-slate-900">₺{payroll.totalGrossPay.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-sans block">Gelir Vergisi Matrahı:</span>
                  <span className="font-bold text-slate-900">₺{(payroll.totalGrossPay - payroll.employeeSgkShare - payroll.employeeUnemploymentShare).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-sans block">Asgari Ücret Vergi İstisnası:</span>
                  <span className="font-bold text-emerald-700">Uygulandı (%0 Vergi)</span>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-sans block">İşveren Toplam Maliyeti:</span>
                  <span className="font-bold text-indigo-900">₺{payroll.totalEmployerCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          )}

          {/* 7. BÜYÜK NET ÖDENECEK KART & YAZIYLA TUTAR */}
          <div className="p-4 sm:p-5 bg-slate-900 text-white rounded-xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <p className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Personele Ödenecek Net Tutar
                </p>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                {employee?.paymentMethod === 'bank' 
                  ? `Ödeme Yöntemi: Banka Havalesi / EFT (${employee?.bankName || 'Banka'} - ${employee?.iban || 'IBAN Belirtilmemiş'})` 
                  : 'Ödeme Yöntemi: Şirket Kasasından Nakit Elden Ödeme'}
              </p>
              <p className="text-xs text-amber-300 italic font-medium mt-1 font-serif">
                {numberToWordsTR(payroll.netSalary)}
              </p>
            </div>
            <div className="sm:text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block sm:text-right">Net Hak Ediş</span>
              <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-emerald-400">
                ₺{payroll.netSalary.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* 8. Yasal Not & Karşılıklı İmza Alanı */}
          <div className="pt-2 border-t border-slate-300 space-y-4 text-xs">
            <p className="text-[11px] text-slate-600 leading-relaxed italic bg-slate-50 p-2.5 rounded border border-slate-200">
              <b>Yasal Bildirim & İbra:</b> İşbu ücret hesap pusulası 4857 sayılı İş Kanunu'nun 37. maddesi uyarınca işçi ve işveren mutabakatı için tanzim edilmiştir. 
              İşbu hesap pusulasındaki tüm çalışma günleri, mesai saatleri ve kesintileri inceledim. Tarafıma ödenecek olan yukarıda dökümü yapılmış net tutarı eksiksiz teslim aldığımı, 
              bu döneme ilişkin başkaca bir ücret, fazla çalışma veya izin alacağım kalmadığını kabul ve beyan ederim. (Varsa itirazlar en geç 3 iş günü içinde İK departmanına bildirilmelidir).
            </p>

            <div className="grid grid-cols-2 gap-8 pt-2 text-center">
              <div>
                <p className="font-bold text-slate-800">İşveren / Şirket Yetkilisi</p>
                <p className="text-[10px] text-slate-500">PRO ERP Ayakkabı San. Tic. Ltd. Şti.</p>
                <div className="h-16 mt-2 border-b border-dashed border-slate-400 flex items-end justify-center pb-1">
                  <span className="text-[10px] text-slate-400">Kaşe / Yetkili İmza</span>
                </div>
              </div>
              <div>
                <p className="font-bold text-slate-800">Personel (Teslim Alan)</p>
                <p className="text-[10px] text-slate-500">{payroll.employeeName} ({payroll.employeeCode})</p>
                <div className="h-16 mt-2 border-b border-dashed border-slate-400 flex items-end justify-center pb-1">
                  <span className="text-[10px] text-slate-400">Tarih: ..... / ..... / 2026 &nbsp;&nbsp;|&nbsp;&nbsp; Islak İmza</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer (Hidden during print) */}
        <div className="shrink-0 px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between print:hidden">
          <span className="text-xs text-slate-500">
            Dönem: <b>{MONTH_NAMES[payroll.month - 1]} {payroll.year}</b> | Sicil: <b>{payroll.employeeCode}</b>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Yazdır / PDF Kaydet
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Pusulayı Kapat
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
