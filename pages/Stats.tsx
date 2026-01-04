import React, { useMemo, useState, useLayoutEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, TooltipProps } from 'recharts';
import { TradeSignal, TradeStatus } from '../types';
import { TrendingUp, Activity, BarChart3, Filter, Award, Clock, Layers, Briefcase, History as HistoryIcon, Zap, Calendar } from 'lucide-react';

interface StatsProps {
  signals?: (TradeSignal & { sheetIndex?: number })[];
  historySignals?: TradeSignal[];
}

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
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

const Stats: React.FC<StatsProps> = ({ signals = [], historySignals = [] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState<number | string>('100%');
  const [isReady, setIsReady] = useState(false);

  // ResizeObserver to handle Recharts dimension warning
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
    
    return () => {
      observer.disconnect();
    };
  }, []);

  const getISTContext = () => {
    const now = new Date();
    // 30 days ago from now
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    const fmt = (d: Date) => 
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    
    return { 
      today: fmt(now), 
      thirtyDaysAgoStr: fmt(thirtyDaysAgo),
      thirtyDaysAgoDate: thirtyDaysAgo
    };
  };

  const isIndex = (instrument: string) => {
    const indices = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'];
    return indices.includes(instrument.toUpperCase());
  };

  const normalizeDate = (trade: TradeSignal): string => {
    const ts = trade.lastTradedTimestamp || trade.date || trade.timestamp;
    if (!ts) return '';
    
    if ((ts as any) instanceof Date || (typeof ts === 'string' && ts.includes('T'))) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
      }
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
    const { thirtyDaysAgoStr } = getISTContext();
    
    // Unified pool of realized trades
    const unifiedMap = new Map<string, TradeSignal>();
    
    // 1. Process Active Closed (Realized today/recently)
    (signals || []).forEach(s => {
      if (s.status === TradeStatus.EXITED || s.status === TradeStatus.STOPPED || s.status === TradeStatus.ALL_TARGET) {
        if (s.id) unifiedMap.set(s.id, s);
      }
    });

    // 2. Process Historical Data
    (historySignals || []).forEach(s => {
      const id = s.id || `hist-${normalizeDate(s)}-${s.symbol}-${s.entryPrice}`;
      unifiedMap.set(id, s);
    });

    const combinedHistory = Array.from(unifiedMap.values());
    const rollingStats = { pnl: 0, indexPnL: 0, stockPnL: 0, overall: [] as number[], intraday: [] as number[], btst: [] as number[] };

    // Chart Tracker (Last 14 Days for better mobile visual, but calculated from 30)
    const chartMap: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      chartMap[new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d)] = 0;
    }

    combinedHistory.forEach(trade => {
      const tradeDateStr = normalizeDate(trade);
      if (!tradeDateStr) return;
      
      const qty = Number(trade.quantity && trade.quantity > 0 ? trade.quantity : 1);
      const pnl = Number(trade.pnlRupees !== undefined ? trade.pnlRupees : (trade.pnlPoints || 0) * qty);

      // Trailing 30-Day Filter
      if (tradeDateStr >= thirtyDaysAgoStr) {
        rollingStats.pnl += pnl;
        rollingStats.overall.push(pnl);
        if (isIndex(trade.instrument)) rollingStats.indexPnL += pnl; else rollingStats.stockPnL += pnl;
        if (trade.isBTST) rollingStats.btst.push(pnl); else rollingStats.intraday.push(pnl);
      }
      
      // Chart Feed (Last 14 days window)
      if (chartMap[tradeDateStr] !== undefined) {
        chartMap[tradeDateStr] += pnl;
      }
    });

    const calculateWinRate = (list: number[]) => list.length === 0 ? 0 : (list.filter(v => v > 0).length / list.length) * 100;

    return {
      rollingPnL: rollingStats.pnl,
      indexPnL: rollingStats.indexPnL,
      stockPnL: rollingStats.stockPnL,
      overallWinRate: calculateWinRate(rollingStats.overall),
      intradayWinRate: calculateWinRate(rollingStats.intraday),
      btstWinRate: calculateWinRate(rollingStats.btst),
      totalTrades: rollingStats.overall.length,
      chartData: Object.entries(chartMap).map(([date, pnl]) => ({ 
        date: date.split('-').reverse().slice(0, 2).join('/'), 
        pnl 
      }))
    };
  }, [signals, historySignals]);

  const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center"><TrendingUp size={24} className="mr-2 text-yellow-500" />Performance Analytics</h2>
          <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest flex items-center"><Calendar className="mr-1.5 text-blue-500" size={12} /> Trailing 30-Day Statistical Engine</p>
        </div>
        <div className="flex items-center space-x-2 text-slate-400 text-[10px] bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
           <Filter size={12} className="text-blue-500" />
           <span className="uppercase font-black tracking-tighter">Window: Last 30 Days</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Row 1: 30-Day Surplus & Win Rate */}
        <StatItem label="30-Day Surplus" value={formatCurrency(performance.rollingPnL)} isPositive={performance.rollingPnL >= 0} icon={HistoryIcon} highlight={true} subtext={`Realized P&L (Trailing)`} />
        <StatItem label="Win Rate (30D)" value={`${performance.overallWinRate.toFixed(1)}%`} isPositive={performance.overallWinRate >= 65} icon={Award} subtext="Aggregated Unified Accuracy" />
        
        {/* Row 2: Stock P&L & Intraday Accuracy */}
        <StatItem label="Stock 30D P&L" value={formatCurrency(performance.stockPnL)} isPositive={performance.stockPnL >= 0} icon={Briefcase} subtext="Equity Options Surplus" />
        <StatItem label="Intraday Accuracy" value={`${performance.intradayWinRate.toFixed(1)}%`} isPositive={performance.intradayWinRate >= 65} icon={Zap} subtext="Day-Trading Accuracy" />
        
        {/* Row 3: Index P&L & BTST Reliability */}
        <StatItem label="Index 30D P&L" value={formatCurrency(performance.indexPnL)} isPositive={performance.indexPnL >= 0} icon={Layers} subtext="Nifty / BankNifty P&L" />
        <StatItem label="BTST Reliability" value={`${performance.btstWinRate.toFixed(1)}%`} isPositive={performance.btstWinRate >= 65} icon={Clock} subtext="Overnight Success Ratio" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-10 relative z-10">
            <div>
              <h3 className="text-white font-bold flex items-center text-sm uppercase tracking-widest"><BarChart3 size={16} className="mr-3 text-blue-500" />Realized Trend</h3>
              <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">14-Day Rolling Realization Curve</p>
            </div>
            <div className="text-right">
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Dataset: {performance.totalTrades} Closed Trades</span>
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

const StatItem = ({ label, value, isPositive, subtext, icon: Icon, highlight = false }: { label: string; value: string; isPositive: boolean; subtext?: string; icon: any; highlight?: boolean }) => (
  <div className={`bg-slate-900 border ${highlight ? 'border-blue-500/30 shadow-[0_0_25px_rgba(59,130,246,0.1)]' : 'border-slate-800'} p-5 rounded-2xl shadow-xl hover:border-slate-700 transition-all group`}>
    <div className="flex items-center space-x-2 mb-3">
        <div className={`p-1.5 rounded-lg ${highlight ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-800 text-slate-500'}`}><Icon size={14} /></div>
        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{label}</p>
    </div>
    <p className={`text-2xl font-mono font-black tracking-tighter leading-none ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>{value}</p>
    {subtext && <p className="text-[9px] font-bold text-slate-600 uppercase mt-2 tracking-widest opacity-80">{subtext}</p>}
  </div>
);

export default Stats;