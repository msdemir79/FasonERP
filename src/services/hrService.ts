import { db } from '../db';
import type { 
  Employee, 
  AttendanceRecord, 
  AttendanceStatus, 
  LeaveRequest, 
  LeaveType, 
  PayrollRecord, 
  AdvanceRequest,
  SgkStatus
} from '../types';
import { accountingService } from './accountingService';

// Standart 2026 Türkiye Parametreleri (Referans)
export const HR_CONSTANTS = {
  SGK_WORKER_RATE: 0.14,            // %14 SGK İşçi Payı
  UNEMPLOYMENT_WORKER_RATE: 0.01,   // %1 İşsizlik İşçi Payı
  SGK_EMPLOYER_RATE: 0.155,         // %15.5 SGK İşveren Payı (5 puanlık Hazine teşviki ile)
  UNEMPLOYMENT_EMPLOYER_RATE: 0.02, // %2 İşveren İşsizlik Payı
  INCOME_TAX_RATE_TIER1: 0.15,      // %15 1. Vergi Dilimi
  STAMP_TAX_RATE: 0.00759,          // Binde 7.59 Damga Vergisi
  
  // Asgari Ücret Parametreleri (İstisna Hesaplaması İçin)
  MIN_WAGE_GROSS: 26005.00,
  MIN_WAGE_NET: 22104.00,
  MIN_WAGE_SGK_WORKER: 3640.70,     // 26005 * 0.14
  MIN_WAGE_UNEMPLOYMENT: 260.05,    // 26005 * 0.01
  MIN_WAGE_INCOME_TAX_EXEMPTION: 3315.64, // İstisna edilecek gelir vergisi
  MIN_WAGE_STAMP_TAX_EXEMPTION: 197.38    // İstisna edilecek damga vergisi
};

export const hrService = {
  // ==================== PERSONEL (EMPLOYEE) ====================
  async getEmployees(): Promise<Employee[]> {
    return await db.employees.orderBy('name').toArray();
  },

  async getEmployeeById(id: number): Promise<Employee | undefined> {
    return await db.employees.get(id);
  },

  async addEmployee(data: Omit<Employee, 'id' | 'createdAt'>): Promise<number> {
    return await db.employees.add({
      ...data,
      createdAt: new Date()
    }) as number;
  },

  async updateEmployee(id: number, data: Partial<Employee>): Promise<number> {
    return await db.employees.update(id, data);
  },

  async deleteEmployee(id: number): Promise<void> {
    // Bağlı puantaj ve bordroları temizle
    await db.attendanceRecords.where('employeeId').equals(id).delete();
    await db.leaveRequests.where('employeeId').equals(id).delete();
    await db.payrollRecords.where('employeeId').equals(id).delete();
    await db.advanceRequests.where('employeeId').equals(id).delete();
    await db.employees.delete(id);
  },

  // ==================== PUANTAJ VE DEVAM TAKİBİ ====================
  async getAttendanceForMonth(month: number, year: number): Promise<AttendanceRecord[]> {
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    return await db.attendanceRecords
      .filter(r => (r.date && r.date.startsWith(monthPrefix)) || (Number(r.year) === Number(year) && Number(r.month) === Number(month)))
      .toArray();
  },

  async saveAttendanceRecord(record: {
    employeeId: number;
    date: string; // YYYY-MM-DD
    status: AttendanceStatus;
    overtimeHours?: number;
    normalHours?: number;
    notes?: string;
  }): Promise<void> {
    const [yearStr, monthStr] = record.date.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const existing = await db.attendanceRecords
      .where('[employeeId+date]')
      .equals([record.employeeId, record.date])
      .first();

    if (existing && existing.id) {
      await db.attendanceRecords.update(existing.id, {
        month,
        year,
        status: record.status,
        overtimeHours: record.overtimeHours ?? existing.overtimeHours ?? 0,
        normalHours: record.normalHours ?? existing.normalHours ?? 8,
        notes: record.notes ?? existing.notes
      });
    } else {
      await db.attendanceRecords.add({
        employeeId: record.employeeId,
        date: record.date,
        month,
        year,
        status: record.status,
        normalHours: record.normalHours ?? (record.status === 'present' ? 8 : 0),
        overtimeHours: record.overtimeHours ?? 0,
        notes: record.notes
      });
    }
  },

  // Bir ay için tüm aktif personelin puantajını otomatik oluştur / doldur (Hızlı toplu işlem)
  async autoPopulateMonthAttendance(month: number, year: number, overwriteExisting = true): Promise<void> {
    const employees = await db.employees.where('status').equals('active').toArray();
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Onaylı izinleri al
    const approvedLeaves = await db.leaveRequests
      .where('status')
      .equals('approved')
      .toArray();

    // Mevcut puantaj kayıtlarını tek sorguda çek
    const existingRecords = await db.attendanceRecords
      .where('year')
      .equals(year)
      .filter(r => r.month === month)
      .toArray();

    const recordMap = new Map<string, AttendanceRecord>();
    for (const r of existingRecords) {
      recordMap.set(`${r.employeeId}_${r.date}`, r);
    }

    const recordsToSave: AttendanceRecord[] = [];

    for (const emp of employees) {
      if (!emp.id) continue;
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0: Pazar

        // İzin kontrolü
        const activeLeave = approvedLeaves.find(l => 
          l.employeeId === emp.id && 
          dateStr >= l.startDate && 
          dateStr <= l.endDate
        );

        let status: AttendanceStatus = 'present';
        let normalHours = 8;

        if (dayOfWeek === 0) {
          // Pazar - Hafta Tatili
          status = 'weekly_rest';
          normalHours = 0;
        } else if (activeLeave) {
          status = activeLeave.leaveType === 'unpaid' ? 'unpaid_leave' : 
                   activeLeave.leaveType === 'sick' ? 'sick_leave' : 'paid_leave';
          normalHours = 0;
        }

        const key = `${emp.id}_${dateStr}`;
        const existing = recordMap.get(key);

        if (existing) {
          if (overwriteExisting) {
            recordsToSave.push({
              ...existing,
              status,
              normalHours,
              overtimeHours: existing.overtimeHours || 0
            });
          }
        } else {
          recordsToSave.push({
            employeeId: emp.id,
            date: dateStr,
            month,
            year,
            status,
            normalHours,
            overtimeHours: 0
          });
        }
      }
    }

    if (recordsToSave.length > 0) {
      await db.attendanceRecords.bulkPut(recordsToSave);
    }
  },

  // Seçili veya tüm personeller için puantaj durumunu toplu güncelle
  async bulkSetAttendanceForEmployees(
    employeeIds: number[],
    month: number,
    year: number,
    targetStatus: AttendanceStatus,
    respectSunday = true
  ): Promise<void> {
    const daysInMonth = new Date(year, month, 0).getDate();

    // Mevcut kayıtları çek
    const existingRecords = await db.attendanceRecords
      .where('year')
      .equals(year)
      .filter(r => r.month === month && employeeIds.includes(r.employeeId))
      .toArray();

    const recordMap = new Map<string, AttendanceRecord>();
    for (const r of existingRecords) {
      recordMap.set(`${r.employeeId}_${r.date}`, r);
    }

    const recordsToSave: AttendanceRecord[] = [];

    for (const empId of employeeIds) {
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0: Pazar

        let status: AttendanceStatus = targetStatus;
        let normalHours = targetStatus === 'present' ? 8 : (targetStatus === 'half_day' ? 4 : 0);

        if (respectSunday && dayOfWeek === 0) {
          status = 'weekly_rest';
          normalHours = 0;
        }

        const key = `${empId}_${dateStr}`;
        const existing = recordMap.get(key);

        if (existing) {
          recordsToSave.push({
            ...existing,
            status,
            normalHours
          });
        } else {
          recordsToSave.push({
            employeeId: empId,
            date: dateStr,
            month,
            year,
            status,
            normalHours,
            overtimeHours: 0
          });
        }
      }
    }

    if (recordsToSave.length > 0) {
      await db.attendanceRecords.bulkPut(recordsToSave);
    }
  },

  // Ay için puantaj kayıtlarını temizle
  async bulkClearMonthAttendance(month: number, year: number, employeeIds?: number[]): Promise<void> {
    const records = await db.attendanceRecords
      .where('year')
      .equals(year)
      .filter(r => r.month === month && (!employeeIds || employeeIds.includes(r.employeeId)))
      .toArray();

    const idsToDelete = records.map(r => r.id!).filter(Boolean);
    if (idsToDelete.length > 0) {
      await db.attendanceRecords.bulkDelete(idsToDelete);
    }
  },

  // ==================== İZİN TAKİBİ (LEAVE MANAGEMENT) ====================
  async getLeaveRequests(employeeId?: number): Promise<LeaveRequest[]> {
    let list: LeaveRequest[];
    if (employeeId) {
      list = await db.leaveRequests.where('employeeId').equals(employeeId).toArray();
    } else {
      list = await db.leaveRequests.toArray();
    }
    return list.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.startDate ? new Date(a.startDate).getTime() : 0);
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.startDate ? new Date(b.startDate).getTime() : 0);
      return timeB - timeA;
    });
  },

  async addLeaveRequest(data: Omit<LeaveRequest, 'id' | 'createdAt'>): Promise<number> {
    return await db.leaveRequests.add({
      ...data,
      createdAt: new Date()
    }) as number;
  },

  async approveLeaveRequest(id: number, approvedBy = 'Yönetim'): Promise<void> {
    const leave = await db.leaveRequests.get(id);
    if (!leave) throw new Error('İzin talebi bulunamadı');

    await db.leaveRequests.update(id, {
      status: 'approved',
      approvedBy
    });

    // Personelin kullanılan izin sayacını güncelle (yıllık izin ise)
    if (leave.leaveType === 'annual') {
      const emp = await db.employees.get(leave.employeeId);
      if (emp && emp.id) {
        await db.employees.update(emp.id, {
          usedAnnualLeave: (emp.usedAnnualLeave || 0) + leave.days
        });
      }
    }

    // Puantaj tablosuna otomatik yansıt
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const status: AttendanceStatus = leave.leaveType === 'unpaid' ? 'unpaid_leave' : 
                                      leave.leaveType === 'sick' ? 'sick_leave' : 'paid_leave';

      const existing = await db.attendanceRecords
        .where('[employeeId+date]')
        .equals([leave.employeeId, dateStr])
        .first();

      if (existing && existing.id) {
        await db.attendanceRecords.update(existing.id, {
          status,
          normalHours: 0
        });
      } else {
        await db.attendanceRecords.add({
          employeeId: leave.employeeId,
          date: dateStr,
          month,
          year,
          status,
          normalHours: 0,
          overtimeHours: 0
        });
      }
    }
  },

  async rejectLeaveRequest(id: number): Promise<void> {
    await db.leaveRequests.update(id, { status: 'rejected' });
  },

  async deleteLeaveRequest(id: number): Promise<void> {
    await db.leaveRequests.delete(id);
  },

  // ==================== AVANS YÖNETİMİ ====================
  async getAdvances(month?: number, year?: number): Promise<AdvanceRequest[]> {
    let list: AdvanceRequest[];
    if (month && year) {
      list = await db.advanceRequests
        .where('year')
        .equals(year)
        .filter(a => a.month === month)
        .toArray();
    } else {
      list = await db.advanceRequests.toArray();
    }
    return list.sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return timeB - timeA;
    });
  },

  async addAdvance(data: Omit<AdvanceRequest, 'id' | 'createdAt' | 'isDeducted'>): Promise<number> {
    return await db.advanceRequests.add({
      ...data,
      isDeducted: false,
      createdAt: new Date()
    }) as number;
  },

  async updateAdvanceStatus(id: number, status: 'pending' | 'paid' | 'rejected'): Promise<void> {
    await db.advanceRequests.update(id, { status });
  },

  // ==================== BORDRO VE ÜCRET HESAPLAMA MOTORU ====================
  // Tek bir personel için aylık bordro ve maliyet hesabı
  calculatePayrollForEmployee(
    employee: Employee,
    attendanceList: AttendanceRecord[],
    advances: AdvanceRequest[],
    month: number,
    year: number
  ): Omit<PayrollRecord, 'id' | 'createdAt'> {
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Puantaj kayıtlarını tarih bazlı haritaya al
    const attMap = new Map<string, AttendanceRecord>();
    attendanceList.forEach(att => {
      if (att.date) attMap.set(att.date, att);
    });

    let daysWorked = 0;
    let halfDays = 0;
    let weeklyRestDays = 0;
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    let absentDays = 0;
    let overtimeHours = 0;

    // Ayın 1'inden son gününe kadar her takvim gününü değerlendir
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const rec = attMap.get(dateStr);
      const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0: Pazar
      const isSunday = dayOfWeek === 0;

      // Kayıt yoksa: Pazar günleri hafta tatili, diğer günler fiili çalışma varsayılır
      const status: AttendanceStatus = rec?.status || (isSunday ? 'weekly_rest' : 'present');

      if (status === 'present') {
        daysWorked += 1;
      } else if (status === 'half_day') {
        halfDays += 1;
        daysWorked += 0.5;
      } else if (status === 'weekly_rest') {
        weeklyRestDays += 1;
      } else if (status === 'paid_leave' || status === 'public_holiday' || status === 'sick_leave') {
        paidLeaveDays += 1;
      } else if (status === 'unpaid_leave') {
        unpaidLeaveDays += 1;
      } else if (status === 'absent') {
        absentDays += 1;
      }

      if (rec?.overtimeHours) {
        overtimeHours += rec.overtimeHours;
      }
    }

    // Ücret kesintisine tabi toplam gün sayısı (devamsızlık + ücretsiz izin + yarım gün açığı)
    const totalDeductedDays = absentDays + unpaidLeaveDays + (halfDays * 0.5);

    // Toplam Avans Kesintisi
    const employeeAdvances = advances.filter(a => a.employeeId === employee.id && a.status === 'paid');
    const advanceDeduction = employeeAdvances.reduce((sum, a) => sum + a.amount, 0);

    const isSgkLi = employee.sgkStatus === 'sgk_li';

    // -------------------------------------------------------------
    // SENARYO 1: SGK'LI PERSONEL (Bordrolu / Yasal Kesintili Hesaplama)
    // -------------------------------------------------------------
    if (isSgkLi) {
      // Netten Brüte veya Brüt bazlı hesaplama
      // Net anlaşılan tutardan brüt tahmini katsayısı: ~1.42 (asgari ücret muafiyeti dikkate alınarak)
      let grossSalary = 0;
      if (employee.salaryType === 'monthly_net') {
        const targetNet = employee.baseSalary || 30000;
        // Basitleştirilmiş hassas Türkiye bordro net-brüt dönüştürücüsü
        // Net = Brüt - (Brüt * 0.15) - Gelir Vergisi (İstisna düşülmüş) - Damga Vergisi (İstisna düşülmüş)
        grossSalary = targetNet <= HR_CONSTANTS.MIN_WAGE_NET
          ? HR_CONSTANTS.MIN_WAGE_GROSS
          : HR_CONSTANTS.MIN_WAGE_GROSS + (targetNet - HR_CONSTANTS.MIN_WAGE_NET) / 0.7149;
      } else {
        grossSalary = employee.baseSalary;
      }

      // Çalışılan güne oranla temel hak ediş (30 gün standardı)
      const standardDays = 30;
      const effectiveDays = Math.max(0, standardDays - totalDeductedDays);
      const basePay = (grossSalary / standardDays) * effectiveDays;

      // Fazla mesai brüt ücreti (Saatlik Brüt * 1.5 * Saat)
      const hourlyGross = grossSalary / 225; // 225 aylık yasal çalışma saati
      const overtimePay = hourlyGross * 1.5 * overtimeHours;
      const bonusPay = 0; // Yol, yemek, prim eklenebilir

      const totalGrossPay = basePay + overtimePay + bonusPay;

      // Yasal Kesintiler
      const employeeSgkShare = totalGrossPay * HR_CONSTANTS.SGK_WORKER_RATE; // %14
      const employeeUnemploymentShare = totalGrossPay * HR_CONSTANTS.UNEMPLOYMENT_WORKER_RATE; // %1

      // Gelir Vergisi Matrahı
      const incomeTaxBase = totalGrossPay - employeeSgkShare - employeeUnemploymentShare;
      const rawIncomeTax = incomeTaxBase * HR_CONSTANTS.INCOME_TAX_RATE_TIER1; // %15
      // Asgari Ücret Vergi İstisnası Düşümü
      const incomeTax = Math.max(0, rawIncomeTax - HR_CONSTANTS.MIN_WAGE_INCOME_TAX_EXEMPTION);

      // Damga Vergisi Matrahı & İstisnası
      const rawStampTax = totalGrossPay * HR_CONSTANTS.STAMP_TAX_RATE;
      const stampTax = Math.max(0, rawStampTax - HR_CONSTANTS.MIN_WAGE_STAMP_TAX_EXEMPTION);

      const totalLegalDeductions = employeeSgkShare + employeeUnemploymentShare + incomeTax + stampTax;

      // Net Ödenecek
      const netSalary = Math.max(0, totalGrossPay - totalLegalDeductions - advanceDeduction);

      // İşveren Maliyeti
      const employerSgkShare = totalGrossPay * HR_CONSTANTS.SGK_EMPLOYER_RATE; // %15.5
      const employerUnemploymentShare = totalGrossPay * HR_CONSTANTS.UNEMPLOYMENT_EMPLOYER_RATE; // %2
      const totalEmployerCost = totalGrossPay + employerSgkShare + employerUnemploymentShare;

      return {
        employeeId: employee.id!,
        employeeName: employee.name,
        employeeCode: employee.employeeCode,
        department: employee.department,
        month,
        year,
        sgkStatus: 'sgk_li',
        salaryType: employee.salaryType,
        daysWorked,
        weeklyRestDays,
        paidLeaveDays,
        unpaidLeaveDays,
        absentDays,
        totalDays: effectiveDays,
        overtimeHours,
        baseSalary: Math.round(grossSalary),
        basePay: Math.round(basePay),
        overtimePay: Math.round(overtimePay),
        bonusPay,
        totalGrossPay: Math.round(totalGrossPay),
        employeeSgkShare: Math.round(employeeSgkShare),
        employeeUnemploymentShare: Math.round(employeeUnemploymentShare),
        incomeTax: Math.round(incomeTax),
        stampTax: Math.round(stampTax),
        totalLegalDeductions: Math.round(totalLegalDeductions),
        advanceDeduction: Math.round(advanceDeduction),
        otherDeductions: 0,
        netSalary: Math.round(netSalary),
        employerSgkShare: Math.round(employerSgkShare),
        employerUnemploymentShare: Math.round(employerUnemploymentShare),
        totalEmployerCost: Math.round(totalEmployerCost),
        paymentStatus: 'unpaid',
        isAccounted: false,
        notes: `SGK'lı Bordro Hesabı (${effectiveDays} gün hak ediş${absentDays > 0 ? `, ${absentDays} gün devamsız` : ''}${unpaidLeaveDays > 0 ? `, ${unpaidLeaveDays} gün ücr. izin` : ''}${overtimeHours > 0 ? `, ${overtimeHours} sa mesai` : ''})`
      };
    } 
    
    // -------------------------------------------------------------
    // SENARYO 2: SGK'SIZ / GÜNLÜK YEVMİYELİ / HARİCİ PERSONEL
    // (Vergi ve SGK kesintisi yok, fiili net hakediş ve yevmiye bazlı)
    // -------------------------------------------------------------
    else {
      let basePay = 0;
      let hourlyRate = 0;

      if (employee.salaryType === 'daily') {
        // Günlük Yevmiye:
        // Fiili çalışılan gün sayısı + Ücretli izin günleri üzerinden ödenir.
        // Devamsızlık veya ücretsiz izin günleri kesinlikle ödenmez.
        const dailyRate = employee.baseSalary || 1500;
        const payableDays = Math.max(0, daysWorked + paidLeaveDays);
        basePay = dailyRate * payableDays;
        hourlyRate = dailyRate / 8;
      } else if (employee.salaryType === 'hourly') {
        hourlyRate = employee.baseSalary || 200;
        basePay = (daysWorked * 8) * hourlyRate;
      } else {
        // Aylık sabit net anlaşılan tutar: 30 gün standardı üzerinden devamsızlık düşülür
        const monthlyNet = employee.baseSalary || 30000;
        const standardDays = 30;
        const effectiveDays = Math.max(0, standardDays - totalDeductedDays);
        basePay = (monthlyNet / standardDays) * effectiveDays;
        hourlyRate = monthlyNet / 240;
      }

      // Fazla Mesai (Saatlik Ücret * 1.5 * Mesai Saati)
      const overtimePay = hourlyRate * 1.5 * overtimeHours;
      const bonusPay = 0;
      const totalNetEarned = basePay + overtimePay + bonusPay;

      // Net Ödenecek (Avanslar Düşülür)
      const netSalary = Math.max(0, totalNetEarned - advanceDeduction);

      // SGK'sız personelde işveren maliyeti net ödenen toplam tutardır (Ek yasal prim maliyeti yoktur)
      const totalEmployerCost = totalNetEarned;

      return {
        employeeId: employee.id!,
        employeeName: employee.name,
        employeeCode: employee.employeeCode,
        department: employee.department,
        month,
        year,
        sgkStatus: 'sgk_siz',
        salaryType: employee.salaryType,
        daysWorked,
        weeklyRestDays,
        paidLeaveDays,
        unpaidLeaveDays,
        absentDays,
        totalDays: employee.salaryType === 'daily' ? Math.max(0, daysWorked + paidLeaveDays) : Math.max(0, 30 - totalDeductedDays),
        overtimeHours,
        baseSalary: employee.baseSalary,
        basePay: Math.round(basePay),
        overtimePay: Math.round(overtimePay),
        bonusPay,
        totalGrossPay: Math.round(totalNetEarned),
        employeeSgkShare: 0,
        employeeUnemploymentShare: 0,
        incomeTax: 0,
        stampTax: 0,
        totalLegalDeductions: 0,
        advanceDeduction: Math.round(advanceDeduction),
        otherDeductions: 0,
        netSalary: Math.round(netSalary),
        employerSgkShare: 0,
        employerUnemploymentShare: 0,
        totalEmployerCost: Math.round(totalEmployerCost),
        paymentStatus: 'unpaid',
        isAccounted: false,
        notes: `SGK'sız / Yevmiyeli Net Hak Ediş (${daysWorked} fiili gün${absentDays > 0 ? `, ${absentDays} gün devamsız` : ''}${unpaidLeaveDays > 0 ? `, ${unpaidLeaveDays} gün ücr. izin` : ''}${overtimeHours > 0 ? `, ${overtimeHours} sa mesai` : ''})`
      };
    }
  },

  // Tüm personeller için seçilen ayın bordrosunu hesaplayıp veritabanına kaydet/güncelle
  async generateMonthlyPayroll(month: number, year: number): Promise<PayrollRecord[]> {
    const employees = await db.employees.where('status').equals('active').toArray();
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const attendanceRecords = await db.attendanceRecords
      .filter(r => (r.date && r.date.startsWith(monthPrefix)) || (Number(r.year) === Number(year) && Number(r.month) === Number(month)))
      .toArray();

    const advances = await db.advanceRequests
      .where('year')
      .equals(year)
      .filter(a => a.month === month && a.status === 'paid')
      .toArray();

    const generated: PayrollRecord[] = [];

    for (const emp of employees) {
      if (!emp.id) continue;
      const empAttendance = attendanceRecords.filter(a => a.employeeId === emp.id);
      
      const payrollData = this.calculatePayrollForEmployee(emp, empAttendance, advances, month, year);

      // Varolan bordro kaydı var mı
      const existing = await db.payrollRecords
        .where('employeeId')
        .equals(emp.id)
        .filter(p => p.month === month && p.year === year)
        .first();

      if (existing && existing.id) {
        await db.payrollRecords.update(existing.id, {
          ...payrollData,
          paymentStatus: existing.paymentStatus,
          isAccounted: existing.isAccounted,
          journalEntryId: existing.journalEntryId
        });
        generated.push({ ...payrollData, id: existing.id, createdAt: existing.createdAt });
      } else {
        const id = await db.payrollRecords.add({
          ...payrollData,
          createdAt: new Date()
        }) as number;
        generated.push({ ...payrollData, id, createdAt: new Date() });
      }
    }

    return generated;
  },

  // Bordroyu Muhasebeleştirme (Genel Muhasebe Yevmiye Fişi Oluşturma)
  async accountPayroll(payrollId: number): Promise<void> {
    const record = await db.payrollRecords.get(payrollId);
    if (!record) throw new Error('Bordro kaydı bulunamadı.');
    if (record.isAccounted) throw new Error('Bu bordro zaten muhasebeleştirilmiş.');

    const isSgk = record.sgkStatus === 'sgk_li';

    // Üretim Departmanları 720 (Direkt İşçilik), İdari Departmanlar 770 (Genel Yönetim Giderleri)
    const isProduction = ['KESİM', 'SAYA', 'MONTA', 'FİNİSAJ', 'KALİTE & PAKET'].includes(record.department);
    const expenseAccountCode = isProduction ? '720.01' : '770.01';
    const expenseAccountName = isProduction ? 'Direkt İşçilik Giderleri' : 'Personel Ücret Giderleri';

    const items: Array<{
      accountId: number;
      accountCode: string;
      accountName: string;
      debit: number;
      credit: number;
      description: string;
    }> = [];

    // Muhasebe hesaplarını bul veya oluştur
    const expenseAcc = await accountingService.registerAccountFromCode({
      code: expenseAccountCode,
      name: expenseAccountName,
      type: 'expense',
      currency: 'TRY',
      sourceModule: 'manual'
    });

    const netPayableAcc = await accountingService.registerAccountFromCode({
      code: '335.01',
      name: 'Personele Borçlar (Net Ücretler)',
      type: 'liability',
      currency: 'TRY',
      sourceModule: 'manual'
    });

    if (isSgk) {
      // SGK'lı Personel Yevmiye Maddesi
      // Borç: 720/770 İşveren Toplam Maliyeti (Brüt + İşveren SGK + İşsizlik)
      // Alacak: 335 Personele Borçlar (Net Maaş)
      // Alacak: 360 Ödenecek Gelir & Damga Vergisi
      // Alacak: 361 Ödenecek Sosyal Güvenlik Primleri (İşçi + İşveren)
      const taxPayableAcc = await accountingService.registerAccountFromCode({
        code: '360.01',
        name: 'Ödenecek Gelir ve Damga Vergisi',
        type: 'liability',
        currency: 'TRY',
        sourceModule: 'manual'
      });

      const sgkPayableAcc = await accountingService.registerAccountFromCode({
        code: '361.01',
        name: 'Ödenecek SGK ve İşsizlik Primleri',
        type: 'liability',
        currency: 'TRY',
        sourceModule: 'manual'
      });

      const totalSgkPayable = record.employeeSgkShare + record.employeeUnemploymentShare + 
                              record.employerSgkShare + record.employerUnemploymentShare;
      const totalTaxPayable = record.incomeTax + record.stampTax;

      // 1. Gider Borç
      items.push({
        accountId: expenseAcc?.id || 0,
        accountCode: expenseAcc?.code || expenseAccountCode,
        accountName: expenseAcc?.name || expenseAccountName,
        debit: record.totalEmployerCost,
        credit: 0,
        description: `${record.employeeName} ${record.month}/${record.year} Bordro Tahakkuku`
      });

      // 2. Personele Net Borç Alacak
      items.push({
        accountId: netPayableAcc?.id || 0,
        accountCode: netPayableAcc?.code || '335.01',
        accountName: netPayableAcc?.name || 'Personele Borçlar (Net Ücretler)',
        debit: 0,
        credit: record.netSalary + record.advanceDeduction,
        description: `${record.employeeName} Net Ücret Hakedişi`
      });

      // 3. Vergi Alacak
      if (totalTaxPayable > 0) {
        items.push({
          accountId: taxPayableAcc?.id || 0,
          accountCode: taxPayableAcc?.code || '360.01',
          accountName: taxPayableAcc?.name || 'Ödenecek Gelir ve Damga Vergisi',
          debit: 0,
          credit: totalTaxPayable,
          description: `${record.employeeName} Stopaj ve Damga Vergisi`
        });
      }

      // 4. SGK Primleri Alacak
      items.push({
        accountId: sgkPayableAcc?.id || 0,
        accountCode: sgkPayableAcc?.code || '361.01',
        accountName: sgkPayableAcc?.name || 'Ödenecek SGK ve İşsizlik Primleri',
        debit: 0,
        credit: totalSgkPayable,
        description: `${record.employeeName} SGK İşçi+İşveren Primleri`
      });
    } else {
      // SGK'sız Personel Yevmiye Maddesi
      // Borç: 720/770 Direkt İşçilik / Yevmiye Gideri
      // Alacak: 335 Personele Borçlar
      items.push({
        accountId: expenseAcc?.id || 0,
        accountCode: expenseAcc?.code || expenseAccountCode,
        accountName: expenseAcc?.name || expenseAccountName,
        debit: record.totalEmployerCost,
        credit: 0,
        description: `${record.employeeName} Yevmiyeli/Harici İşçilik Hak Edişi`
      });

      items.push({
        accountId: netPayableAcc?.id || 0,
        accountCode: netPayableAcc?.code || '335.01',
        accountName: netPayableAcc?.name || 'Personele Borçlar (Net Ücretler)',
        debit: 0,
        credit: record.totalEmployerCost,
        description: `${record.employeeName} Net Ödenecek Yevmiye Bedeli`
      });
    }

    const lines = items.map((item, idx) => ({
      id: `payroll-${payrollId}-${idx}`,
      accountCode: item.accountCode,
      accountName: item.accountName,
      description: item.description,
      debit: Number(item.debit.toFixed(2)),
      credit: Number(item.credit.toFixed(2))
    }));

    const journalEntryId = await accountingService.createJournalEntry({
      date: new Date(record.year, record.month - 1, 28),
      description: `${record.employeeCode} - ${record.employeeName} (${record.month}/${record.year}) Personel Ücret Tahakkuku`,
      entryType: 'mahsup',
      documentType: 'manual',
      documentNumber: `BRD-${record.year}${String(record.month).padStart(2, '0')}-${record.employeeCode}`,
      lines
    });

    await db.payrollRecords.update(payrollId, {
      isAccounted: true,
      journalEntryId: journalEntryId as number
    });
  }
};
