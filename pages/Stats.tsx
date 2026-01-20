
import React, { useMemo, useState, useLayoutEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TradeSignal, TradeStatus } from '../types';
import { TrendingUp, BarChart3, Filter, Award, Clock, Layers, Briefcase, History as HistoryIcon, Zap, Calendar } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const pnl = payload[0].value || 0;
    const color = pnl >= 0 ? '#10b981' : '#f43f5e';
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-2xl backdrop-blur-md">
        <p className="text-[10px] uppercase font-black tracking-widest mb-1" style={{ color }}>
          {label}
        </p>
        <p className="text-sm font-mono font-black" style={{ color }}>
          ₹{pnl.toLocaleString('en-IN')}
        </p>
      </div>
    );
  }
  return null;
};

const Stats: React.FC<{ signals?: (TradeSignal & { sheetIndex?: number })[]; historySignals?: TradeSignal[] }> = ({ signals = [], historySignals = [] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState<number | string>('100%');
  const [isReady, setIsReady] = useState(false);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 0) {
        setChartWidth(Math.floor(entry.contentRect.width));
        setIsReady(true);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const normalizeDate = (trade: TradeSignal): string => {
    const ts = trade.lastTradedTimestamp || trade.date || trade.timestamp;
    if (!ts) return '';
    if ((ts as any) instanceof Date || (typeof ts === 'string' && ts.includes('T'))) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
    }
    const rawDate = String(ts).trim();
    if (rawDate.includes('-')) {
      const parts = rawDate.split('-');
      if (parts[0].length === 4) return rawDate;
      if (parts.length === 3 && parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    if (rawDate.includes('/')) {
      const parts = rawDate.split('/');
      if (parts.length === 3) {
        const y = parts[2].length === 4 ? parts[2] : `20${parts[2]}`;
        return `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return '';
  };

  const performance = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const thirtyDaysAgoStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(thirtyDaysAgo);
    
    const unifiedMap = new Map<string, TradeSignal>();
    (signals || []).forEach(s => {
      if (s.status === TradeStatus.EXITED || s.status === TradeStatus.STOPPED || s.status === TradeStatus.ALL_TARGET) {
        if (s.id) unifiedMap.set(s.id, s);
      }
    });
    (historySignals || []).forEach(s => {
      const id = s.id || `hist-${normalizeDate(s)}-${s.symbol}-${s.entryPrice}`;
      unifiedMap.set(id, s);
    });

    const combinedHistory = Array.from(unifiedMap.values());
    const rollingStats = { 
      pnl: 0, indexPnL: 0, stockPnL: 0, 
      overall: [] as number[], intraday: [] as number[], btst: [] as number[] 
    };

    let earliestAuditDate: string | null = null;
    let latestAuditDate: string | null = null;

    const chartMap: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      chartMap[new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d)] = 0;
    }

    combinedHistory.forEach(trade => {
      const tradeDateStr = normalizeDate(trade);
      if (!tradeDateStr) return;

      const qty = Number(trade.quantity && trade.quantity > 0 ? trade.quantity : 1);
      const pnlValue = Number(trade.pnlRupees !== undefined ? trade.pnlRupees : (trade.pnlPoints || 0) * qty);
      
      const successScore = Number(trade.pnlRupees !== undefined ? trade.pnlRupees : (trade.pnlPoints || 0));

      if (tradeDateStr >= thirtyDaysAgoStr) {
        rollingStats.pnl += pnlValue;
        rollingStats.overall.push(successScore);

        if (!earliestAuditDate || tradeDateStr < earliestAuditDate) earliestAuditDate = tradeDateStr;
        if (!latestAuditDate || tradeDateStr > latestAuditDate) latestAuditDate = tradeDateStr;
        
        const instrument = trade.instrument || '';
        const indices = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'];
        const isIdx = indices.includes(instrument.toUpperCase());
        
        if (isIdx) rollingStats.indexPnL += pnlValue; else rollingStats.stockPnL += pnlValue;
        if (trade.isBTST) rollingStats.btst.push(successScore); else rollingStats.intraday.push(successScore);
      }
      
      if (chartMap[tradeDateStr] !== undefined) chartMap[tradeDateStr] += pnlValue;
    });

    const calculateConsistency = (list: number[]) => {
      // Logic: 0 P&L trade is ignored entirely from the consistency calculation
      const filteredList = list.filter(v => v !== 0);
      if (filteredList.length === 0) return 0;
      
      const successCount = filteredList.filter(v => v > 0).length;
      return (successCount / filteredList.length) * 100;
    };

    const formatDate = (isoStr: string | null) => {
      if (!isoStr) return '--';
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }).toUpperCase();
    };

    return {
      rollingPnL: rollingStats.pnl,
      indexPnL: rollingStats.indexPnL,
      stockPnL: rollingStats.stockPnL,
      overallPercent: calculateConsistency(rollingStats.overall),
      intradayPercent: calculateConsistency(rollingStats.intraday),
      overnightPercent: calculateConsistency(rollingStats.btst),
      auditStart: formatDate(earliestAuditDate),
      auditEnd: formatDate(latestAuditDate || now.toISOString()),
      chartData: Object.entries(chartMap).map(([date, pnl]) => ({ 
        date: date.split('-').reverse().slice(0, 2).join('/'), 
        pnl 
      }))
    };
  }, [signals, historySignals]);

  const getConsistencyColor = (percent: number) => {
    if (percent < 50) return 'text-rose-500';
    if (percent < 60) return 'text-yellow-500';
    
    // Above 60%: Darkening Green logic (each 5% turns to dark)
    if (percent < 65) return 'text-emerald-400';
    if (percent < 70) return 'text-emerald-500';
    if (percent < 75) return 'text-emerald-600';
    if (percent < 80) return 'text-emerald-700';
    if (percent < 85) return 'text-emerald-800';
    return 'text-emerald-950'; 
  };

  const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center">
            <TrendingUp size={24} className="mr-2 text-yellow-500" />
            Performance Metrics
          </h2>
          <p className="text-slate-400 text-[10px] font-mono font-black uppercase tracking-widest leading-none mb-2">
            Institutional Efficiency Audit
          </p>
          <div className="flex items-center space-x-3">
             <div className="flex items-center space-x-1">
                <span className="text-slate-500 text-[9px] font-black uppercase tracking-tighter">Audit Start:</span>
                <span className="text-blue-500 text-[10px] font-mono font-black">{performance.auditStart}</span>
             </div>
             <div className="w-1 h-1 rounded-full bg-slate-800"></div>
             <div className="flex items-center space-x-1">
                <span className="text-slate-500 text-[9px] font-black uppercase tracking-tighter">Audit End:</span>
                <span className="text-blue-500 text-[10px] font-mono font-black">{performance.auditEnd}</span>
             </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-slate-400 text-[10px] bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
           <Filter size={12} className="text-blue-500" />
           <span className="uppercase font-black tracking-tighter">Rolling 30-Day Terminal Data</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatItem 
          label="30-Day Net Outcome" 
          value={formatCurrency(performance.rollingPnL)} 
          isPositive={performance.rollingPnL >= 0} 
          icon={HistoryIcon} 
          highlight={true} 
        />
        <StatItem 
          label="Consistency Ratio (30-Day)" 
          value={`${performance.overallPercent.toFixed(1)}%`} 
          colorClass={getConsistencyColor(performance.overallPercent)}
          icon={Award}
        />
        
        <StatItem 
          label="Stock – 30-Day Net Outcome" 
          value={formatCurrency(performance.stockPnL)} 
          isPositive={performance.stockPnL >= 0} 
          icon={Briefcase} 
        />
        <StatItem 
          label="Intraday Consistency" 
          value={`${performance.intradayPercent.toFixed(1)}%`} 
          colorClass={getConsistencyColor(performance.intradayPercent)}
          icon={Zap}
        />
        
        <StatItem 
          label="Index – 30-Day Net Outcome" 
          value={formatCurrency(performance.indexPnL)} 
          isPositive={performance.indexPnL >= 0} 
          icon={Layers} 
        />
        <StatItem 
          label="Overnight Consistency" 
          value={`${performance.overnightPercent.toFixed(1)}%`} 
          colorClass={getConsistencyColor(performance.overnightPercent)}
          icon={Clock}
        />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-10 relative z-10">
            <div>
              <h3 className="text-white font-bold flex items-center text-sm uppercase tracking-widest">
                <BarChart3 size={16} className="mr-3 text-blue-500" />
                Realized Trend
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">14-Day Rolling Realization Curve</p>
            </div>
        </div>
        
        <div 
          ref={containerRef}
          className="w-full relative z-10 block" 
          style={{ height: '300px', minWidth: '0px', minHeight: '300px', overflow: 'hidden' }}
        >
          {isReady && (
            <ResponsiveContainer width={chartWidth as any} height={300} debounce={50}>
              <BarChart data={performance.chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 800}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 800}} tickFormatter={(val) => `₹${Math.abs(val) >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(30, 41, 59, 0.2)'}} />
                <Bar dataKey="pnl" radius={[6, 6, 0, 0]} barSize={35}>
                  {performance.chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

const StatItem = ({ label, value, isPositive, colorClass, icon: Icon, highlight = false }: { label: string; value: string; isPositive?: boolean; colorClass?: string; icon: any; highlight?: boolean }) => {
  const finalColorClass = colorClass || (isPositive ? 'text-emerald-400' : 'text-rose-400');
  
  return (
    <div className={`bg-slate-900 border ${highlight ? 'border-blue-500/30 shadow-[0_0_25px_rgba(59,130,246,0.1)]' : 'border-slate-800'} p-5 rounded-2xl shadow-xl hover:border-slate-700 transition-all group relative overflow-hidden`}>
      <div className="flex items-center space-x-2 mb-3">
          <div className={`p-1.5 rounded-lg ${highlight ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-800 text-slate-500'}`}><Icon size={14} /></div>
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{label}</p>
      </div>
      <div className="flex items-baseline justify-between">
        <p className={`text-2xl font-mono font-black tracking-tighter leading-none ${finalColorClass}`}>{value}</p>
      </div>
    </div>
  );
};

export default Stats;
