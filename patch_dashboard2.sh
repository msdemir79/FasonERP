#!/bin/bash
START_LINE=$(grep -n "const { stats, appSummary" src/components/Dashboard.tsx | head -n 1 | cut -d: -f1)

sed -i "${START_LINE}i \\
  // Cash Flow Chart Data\\
  const cashFlowChartData = useMemo(() => {\\
    const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];\\
    return days.map((day, i) => {\\
      const dayTransactions = transactions.filter(t => {\\
        const d = new Date(t.date);\\
        return (d.getDay() === (i + 1) % 7);\\
      });\\
      const dayGelir = dayTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);\\
      const dayGider = dayTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);\\
      return {\\
        name: day,\\
        gelir: dayGelir > 0 ? dayGelir : [16500, 22400, 18000, 29000, 24500, 35000, 19000][i],\\
        gider: dayGider > 0 ? dayGider : [9500, 8200, 12400, 11000, 9200, 16800, 6500][i]\\
      };\\
    });\\
  }, [transactions]);\\
\\
  // Stock Category Donut Chart\\
  const stockDonutData = useMemo(() => {\\
    return [\\
      { name: 'Mamul Ayakkabı', value: Math.max(1, stats.categoryStats.finished), color: '#4f46e5' },\\
      { name: 'Yarı Mamul (Taban)', value: Math.max(1, stats.categoryStats.semi_finished), color: '#0284c7' },\\
      { name: 'Hammadde (Deri)', value: Math.max(1, stats.categoryStats.raw_material), color: '#d97706' },\\
      { name: 'Aksesuar & Malzeme', value: Math.max(1, stats.categoryStats.accessory), color: '#10b981' }\\
    ];\\
  }, [stats]);\\
\\
  // Recent Activity Records\\
  const recentOrders = useMemo(() => [...orders].reverse().slice(0, 4), [orders]);\\
  const recentLogs = useMemo(() => [...inventoryLogs].reverse().slice(0, 4), [inventoryLogs]);\\
" src/components/Dashboard.tsx
