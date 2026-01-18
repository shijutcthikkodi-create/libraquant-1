
import React, { useState, useMemo } from 'react';
import { TrendingUp, Activity, BarChart3, Target, Clock, ShieldCheck, Flame } from 'lucide-react';
import { InsightData } from '../types';

interface MarketInsightsProps {
  insights?: InsightData[];
}

type TabID = 'TREND' | 'DOMINANCE' | 'FLOW';

// Helper for robust sentiment checking
const isBullish = (val: any): boolean => {
  const s = String(val || '').trim().toUpperCase();
  return ['BULLISH', 'BULL', 'BUY', 'UP', 'ACC'].includes(s);
};

const isBearish = (val: any): boolean => {
  const s = String(val || '').trim().toUpperCase();
  return ['BEARISH', 'BEAR', 'SELL', 'DOWN', 'DIS'].includes(s);
};

const isNeutral = (val: any): boolean => {
  const s = String(val || '').trim().toUpperCase();
  return ['NEUTRAL', 'NUTRAL', 'NEUT', 'SIDE', 'FLAT', 'BAL', 'SIDEWAYS', 'INDECISION'].includes(s);
};

// Helper for Flow status
const isHfr = (val: any): boolean => {
  const s = String(val || '').trim().toUpperCase();
  return ['H-FR', 'HFR', 'HIGH FREQUENCY', 'FAST'].includes(s);
};

const MarketInsights: React.FC<MarketInsightsProps> = ({ insights = [] }) => {
  const [activeTab, setActiveTab] = useState<TabID>('TREND');

  const tabs = [
    { id: 'TREND', label: 'Trend', icon: TrendingUp },
    { id: 'DOMINANCE', label: 'Dominance', icon: BarChart3 },
    { id: 'FLOW', label: 'Flow', icon: Activity }
  ];

  // LOGIC RULES: 
  // 1. Assets with 'sentiment' appear in Trend.
  // 2. Assets with both 'sentiment' AND 'category' appear in Dominance.
  // 3. Assets with 'pattern' or 'phase' appear in Flow OR if they are Neutral in Trend.
  
  const trendData = useMemo(() => insights.filter(i => 
    i.type === 'TREND' || !!i.sentiment
  ), [insights]);

  const dominanceData = useMemo(() => insights.filter(i => 
    i.type === 'DOMINANCE' || (i.category && i.sentiment) || isNeutral(i.sentiment)
  ), [insights]);

  const flowData = useMemo(() => insights.filter(i => 
    i.type === 'FLOW' || i.pattern || i.phase || isNeutral(i.sentiment)
  ), [insights]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-32">
      {/* Header & Clickable Tabs */}
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
          <div>
            <h2 className="text-3xl font-black text-white mb-1 flex items-center tracking-tighter">
              <Flame size={28} className="mr-3 text-rose-500 animate-pulse" />
              ALPHA TERMINAL
            </h2>
            <p className="text-slate-500 text-[10px] font-mono uppercase tracking-[0.3em] flex items-center">
              <ShieldCheck className="mr-1.5 text-blue-500" size={12} /> Quantum Insight Engine
            </p>
          </div>
          <div className="flex items-center space-x-2 text-slate-500 text-[10px] bg-slate-900 px-4 py-2 rounded-2xl border border-slate-800">
            <Clock size={12} className="text-blue-500" />
            <span className="uppercase font-black tracking-widest">LIVE DATA SYNC</span>
          </div>
        </div>

        {/* Professional Tab Bar */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-900/50 backdrop-blur-md rounded-[24px] border border-slate-800 shadow-2xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabID)}
              className={`flex flex-col sm:flex-row items-center justify-center py-4 px-2 rounded-[20px] transition-all duration-300 group relative overflow-hidden ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                  : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'
              }`}
            >
              <tab.icon size={18} className={`mb-1 sm:mb-0 sm:mr-3 ${activeTab === tab.id ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'}`} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{tab.label}</span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-white rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Content Area */}
      <div className="min-h-[400px] animate-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'TREND' && (
          <div className="space-y-4">
            {trendData.length > 0 ? trendData.map((d, i) => (
              <TrendStrengthCard key={i} symbol={d.symbol} sentiment={d.sentiment} strength={d.strength ?? 50} />
            )) : (
              <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-3xl">
                <p className="text-slate-600 font-black uppercase text-xs tracking-widest">Scanning Trend Map...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'DOMINANCE' && (
          <div className="space-y-3">
            {dominanceData.length > 0 ? dominanceData.map((d, i) => (
              <DominanceLogicRow key={i} symbol={d.symbol} category={d.category} sentiment={d.sentiment} />
            )) : (
              <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-3xl">
                <p className="text-slate-600 font-black uppercase text-xs tracking-widest">Awaiting Segment Dominance...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'FLOW' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flowData.length > 0 ? flowData.map((d, i) => (
              <FlowPatternCard key={i} symbol={d.symbol} pattern={d.pattern} phase={d.phase} sentiment={d.sentiment} />
            )) : (
              <div className="md:col-span-2 text-center py-20 border-2 border-dashed border-slate-800 rounded-3xl">
                <p className="text-slate-600 font-black uppercase text-xs tracking-widest">Detecting Flow Patterns...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* --- TAB COMPONENTS --- */

interface TrendStrengthCardProps {
  symbol: string;
  sentiment?: string;
  strength: number;
}

const TrendStrengthCard: React.FC<TrendStrengthCardProps> = ({ symbol, sentiment, strength }) => {
  const isBull = isBullish(sentiment);
  const isBear = isBearish(sentiment);
  const isNeut = isNeutral(sentiment);
  const status = isBull ? "Active Buyers" : isBear ? "Active Sellers" : isNeut ? "Consolidation" : "Neutral";
  const displaySentiment = isBull ? 'Bullish' : isBear ? 'Bearish' : isNeut ? 'Neutral' : (sentiment || 'Monitoring');
  
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-col">
          <span className="text-2xl font-black text-white tracking-tighter font-mono">{symbol}</span>
          <span className={`text-[10px] font-black uppercase tracking-widest ${isBull ? 'text-emerald-500' : isBear ? 'text-rose-500' : isNeut ? 'text-blue-400' : 'text-slate-500'}`}>{displaySentiment}</span>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end space-x-2">
            <span className={`text-[11px] font-black uppercase tracking-widest ${isBull ? 'text-emerald-400' : isBear ? 'text-rose-400' : isNeut ? 'text-blue-300' : 'text-slate-400'}`}>{status}</span>
            <div className={`w-2 h-2 rounded-full ${isBull ? 'bg-emerald-500' : isBear ? 'bg-rose-500' : isNeut ? 'bg-blue-500' : 'bg-slate-500'} animate-pulse`} />
          </div>
        </div>
      </div>
      
      <div className="relative h-6 bg-slate-950 rounded-full border border-slate-800 p-1 flex">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ease-out shadow-lg ${
            isBull ? 'bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-emerald-500/20' : 
            isBear ? 'bg-gradient-to-r from-rose-600 to-rose-400 shadow-rose-500/20 ml-auto' :
            isNeut ? 'bg-gradient-to-r from-blue-600 to-blue-400 shadow-blue-500/20 mx-auto' :
            'bg-slate-700 w-full'
          }`}
          style={{ width: `${strength}%` }}
        />
        <div className="absolute inset-0 flex justify-between items-center px-4 pointer-events-none">
          <span className="text-[9px] text-white/40 font-black font-mono">0</span>
          <span className="text-[10px] text-white font-black font-mono">{strength}% STRENGTH</span>
          <span className="text-[9px] text-white/40 font-black font-mono">100</span>
        </div>
      </div>
    </div>
  );
};

interface DominanceLogicRowProps {
  symbol: string;
  category?: string;
  sentiment?: string; 
}

const DominanceLogicRow: React.FC<DominanceLogicRowProps> = ({ symbol, category, sentiment }) => {
  const normCategory = String(category || '').trim().toUpperCase();
  const isBull = isBullish(sentiment);
  const isBear = isBearish(sentiment);
  const isNeut = isNeutral(sentiment);
  
  let status = "Balanced";
  let colorTheme = "blue";
  let displayCategory = category || 'Terminal';

  if (isNeut) {
    status = "Indecision";
    colorTheme = "blue";
    displayCategory = "Awaiting News/Event";
  } else if (normCategory === 'SCALP') {
    status = isBear ? "Active Sellers" : isBull ? "Active Buyers" : "Scalping Range";
    colorTheme = isBear ? "rose" : isBull ? "emerald" : "blue";
  } else if (normCategory === 'INTRADAY' || normCategory.includes('SHORT')) {
    status = isBull ? "Active Buyers" : isBear ? "Active Sellers" : "Sideways Trend";
    colorTheme = isBull ? "emerald" : isBear ? "rose" : "blue";
  } else if (normCategory.includes('LONG')) {
    status = isBull ? "Active Investors" : isBear ? "Active Short-Sellers" : "Hold Zone";
    colorTheme = isBull ? "emerald" : isBear ? "rose" : "blue";
  }

  const textClasses: Record<string, string> = {
    rose: 'text-rose-500',
    emerald: 'text-emerald-500',
    blue: 'text-blue-500'
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex items-center justify-between shadow-md hover:bg-slate-800/50 transition-all group">
      <div className="flex items-center space-x-4">
        <div className={`w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 font-mono font-black border border-slate-700 transition-colors`}>
          {symbol.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <h4 className="text-base font-black text-white uppercase tracking-tight font-mono leading-none mb-1">{symbol}</h4>
          <span className={`text-[9px] font-black uppercase tracking-widest ${isBull ? 'text-emerald-500' : isBear ? 'text-rose-500' : 'text-blue-400'}`}>
            {isBull ? 'BULLISH' : isBear ? 'BEARISH' : 'NEUTRAL'} BIAS
          </span>
        </div>
      </div>
      
      <div className="flex-1 flex justify-center">
        <div className={`px-6 py-2 rounded-full border-2 transition-all shadow-inner font-black text-[10px] uppercase tracking-widest ${
          colorTheme === 'rose' ? 'bg-slate-950 border-rose-500/40 text-rose-400' :
          colorTheme === 'emerald' ? 'bg-slate-950 border-emerald-500/40 text-emerald-400' :
          'bg-slate-950 border-blue-500/40 text-blue-400'
        }`}>
          {displayCategory}
        </div>
      </div>

      <div className="flex items-center space-x-3 text-right min-w-[120px]">
        <span className={`text-[10px] font-black uppercase tracking-tighter ${textClasses[colorTheme]}`}>
          {status}
        </span>
        <Target size={14} className="text-slate-700 group-hover:text-blue-500 transition-colors" />
      </div>
    </div>
  );
};

interface FlowPatternCardProps {
  symbol: string;
  pattern?: string;
  phase?: string;
  sentiment?: string;
}

const FlowPatternCard: React.FC<FlowPatternCardProps> = ({ symbol, pattern, phase, sentiment }) => {
  const isAcc = isBullish(phase) || isBullish(pattern);
  const isDis = isBearish(phase) || isBearish(pattern);
  const isNeut = isNeutral(phase) || isNeutral(pattern);
  const isTrendNeut = isNeutral(sentiment);
  const isHFR = isHfr(pattern) || isHfr(phase);

  // Labels
  const displayPattern = isHFR ? 'HIGH FREQUENCY' : (pattern || 'QUANTUM').toUpperCase();
  const subTitle = isTrendNeut ? "Cautious Bias" : isAcc ? "Accumulation" : isDis ? "Distribution" : isNeut ? "Consolidation" : (isHFR ? "HIGH FREQUENCY" : (phase || "Monitoring"));
  
  // Logic Implementation for Status
  const status = isTrendNeut ? "Cautious" : (isAcc || isDis) ? "Active Option Sellers" : (isHFR ? "Active Scalpers" : isNeut ? "Range Bound" : "Scanning Flow");
  
  // Color Selection
  const colorTheme = isTrendNeut ? "amber" : isAcc ? "emerald" : isDis ? "rose" : "blue";

  const textClasses: Record<string, string> = {
    blue: 'text-blue-500',
    emerald: 'text-emerald-500',
    rose: 'text-rose-500',
    amber: 'text-amber-500'
  };

  const badgeClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col h-full group">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h4 className="text-xl font-mono font-black text-white">{symbol}</h4>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{displayPattern} FLOW</span>
        </div>
        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${badgeClasses[colorTheme]}`}>
          {status}
        </span>
      </div>
      
      <div className="flex-1 min-h-[100px] bg-slate-950 rounded-2xl border border-slate-800/50 relative overflow-hidden flex flex-col items-center justify-center p-4">
        <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 40" preserveAspectRatio="none">
          <path 
            d={isHFR 
              ? "M0 30 L10 10 L20 30 L30 10 L40 30 L50 10 L60 30 L70 10 L80 30 L90 10 L100 30" 
              : (isNeut || isTrendNeut) ? "M0 20 Q 25 20, 50 20 T 100 20" : "M0 20 Q 15 15, 30 20 T 60 20 T 90 20 T 100 20"} 
            fill="none" 
            stroke={isTrendNeut ? '#f59e0b' : isAcc ? '#10b981' : isDis ? '#f43f5e' : '#3b82f6'} 
            strokeWidth="1.5"
            className="animate-pulse"
          />
        </svg>
        <span className={`text-[10px] font-black uppercase tracking-[0.3em] relative z-10 animate-pulse ${textClasses[colorTheme]}`}>
          {subTitle}
        </span>
      </div>
    </div>
  );
};

export default MarketInsights;
