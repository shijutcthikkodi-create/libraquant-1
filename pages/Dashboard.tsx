
import React, { useMemo, useState, useEffect } from 'react';
import SignalCard from '../components/SignalCard';
import { Clock, Zap, Activity, ShieldCheck, Send, Timer, ArrowRight, List, TrendingUp, TrendingDown, Target, MessageSquareCode, Radio as RadioIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { WatchlistItem, TradeSignal, User, TradeStatus, ChatMessage } from '../types';
import { GranularHighlights } from '../App';

interface DashboardProps {
  watchlist: WatchlistItem[];
  signals: (TradeSignal & { sheetIndex?: number })[];
  messages: ChatMessage[];
  user: User;
  granularHighlights: GranularHighlights;
  activeMajorAlerts: Record<string, number>;
  activeWatchlistAlerts?: Record<string, number>;
  activeIntelAlert?: number;
  onSignalUpdate: (updated: TradeSignal) => Promise<boolean>;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  watchlist = [],
  signals, 
  messages = [],
  user, 
  granularHighlights,
  activeMajorAlerts,
  activeWatchlistAlerts = {},
  activeIntelAlert = 0,
  onSignalUpdate
}) => {
  const [currentIntelIndex, setCurrentIntelIndex] = useState(0);

  const parseFlexibleDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      else if (parts[0].length === 4) d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
    }
    return isNaN(d.getTime()) ? null : d;
  };

  const lastGivenTrade = useMemo(() => {
    if (!signals || signals.length === 0) return null;
    return [...signals].sort((a, b) => (b.sheetIndex ?? 0) - (a.sheetIndex ?? 0))[0];
  }, [signals]);

  const adminIntelHistory = useMemo(() => {
    return messages
      .filter(m => m.isAdminReply)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [messages]);

  const currentIntel = adminIntelHistory[currentIntelIndex];

  const liveSignals = useMemo(() => {
    return (signals || []);
  }, [signals]);

  // Updated sorting logic: Active/Partial first, then by sheetIndex descending
  const sortedSignals = useMemo(() => {
    return [...liveSignals].sort((a, b) => {
      const aIsActive = a.status === TradeStatus.ACTIVE || a.status === TradeStatus.PARTIAL;
      const bIsActive = b.status === TradeStatus.ACTIVE || b.status === TradeStatus.PARTIAL;

      // Priority 1: Active vs Closed
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;

      // Priority 2: Recency (sheetIndex) within the same bucket
      return (b.sheetIndex ?? 0) - (a.sheetIndex ?? 0);
    });
  }, [liveSignals]);

  const scrollToSignal = (id: string) => {
      const el = document.getElementById(`signal-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const timeSince = (timestamp: string) => {
    const tradeDate = parseFlexibleDate(timestamp);
    if (!tradeDate) return "LIVE";
    const seconds = Math.floor((new Date().getTime() - tradeDate.getTime()) / 1000);
    if (seconds < 60) return "JUST NOW";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}M AGO`;
    return `${Math.floor(seconds / 3600)}H AGO`;
  };

  const isIntelAlerting = activeIntelAlert > Date.now() && currentIntelIndex === 0;

  const navigateIntel = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentIntelIndex(prev => Math.min(prev + 1, adminIntelHistory.length - 1));
    } else {
      setCurrentIntelIndex(prev => Math.max(prev - 1, 0));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center">
            <Activity size={24} className="mr-2 text-emerald-500" />
            Live Analysis Feed
          </h2>
          <p className="text-slate-400 text-sm font-mono tracking-tighter italic">Institutional Terminal Active</p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-3">
            <div className="flex items-center px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-bold text-slate-500">
              <Clock size={12} className="mr-1.5 text-blue-500" />
              IST: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </div>
            <div className="flex items-center px-4 py-2 bg-slate-900/50 border border-emerald-500/20 text-emerald-500 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest">
                <ShieldCheck size={14} className="mr-2" /> Verified Partner
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {currentIntel && (
            <div className={`relative group overflow-hidden rounded-2xl border transition-all duration-700 ${isIntelAlerting ? 'border-blue-500 animate-card-pulse bg-blue-900/30' : 'border-blue-500/30 bg-gradient-to-br from-blue-900/20 to-slate-950'} p-1`}>
               <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                  <MessageSquareCode size={64} className="text-blue-500" />
               </div>
               
               <div className="relative bg-slate-900/80 rounded-[14px] p-5">
                  {/* Absolute Navigation Arrows (End-to-End) */}
                  {adminIntelHistory.length > 1 && (
                    <>
                      <button 
                        onClick={() => navigateIntel('prev')} 
                        disabled={currentIntelIndex === adminIntelHistory.length - 1}
                        className="absolute left-0 top-0 bottom-0 px-2 flex items-center text-slate-500 hover:text-blue-400 disabled:opacity-0 transition-all z-20 group/nav"
                        title="Older Broadcast"
                      >
                        <ChevronLeft size={32} className="group-hover/nav:scale-110 transition-transform" />
                      </button>
                      <button 
                        onClick={() => navigateIntel('next')} 
                        disabled={currentIntelIndex === 0}
                        className="absolute right-0 top-0 bottom-0 px-2 flex items-center text-slate-500 hover:text-blue-400 disabled:opacity-0 transition-all z-20 group/nav"
                        title="Newer Broadcast"
                      >
                        <ChevronRight size={32} className="group-hover/nav:scale-110 transition-transform" />
                      </button>
                    </>
                  )}

                  <div className="flex items-center justify-between mb-3 px-8">
                      <div className="flex items-center space-x-2">
                         <div className={`w-2 h-2 rounded-full ${isIntelAlerting ? 'bg-white animate-ping' : 'bg-blue-500 animate-pulse'}`}></div>
                         <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${isIntelAlerting ? 'text-white' : 'text-blue-400'}`}>
                           Neural Link: {currentIntelIndex === 0 ? 'Latest Intelligence' : 'Archives'}
                         </h3>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-[9px] font-mono text-slate-600 font-bold uppercase">{new Date(currentIntel.timestamp).toLocaleTimeString()} IST</span>
                        {adminIntelHistory.length > 1 && (
                          <div className="px-2 py-0.5 bg-slate-800/50 border border-slate-700/50 rounded text-[9px] font-black text-slate-400 font-mono tracking-widest">
                             {currentIntelIndex + 1} / {adminIntelHistory.length}
                          </div>
                        )}
                      </div>
                  </div>
                  
                  <div key={currentIntel.id} className="animate-in fade-in slide-in-from-right-2 duration-300 px-8">
                    <div className={`border-l-2 pl-4 py-1 ${isIntelAlerting ? 'border-white' : 'border-blue-500/50'}`}>
                      <p className={`text-sm font-bold leading-relaxed tracking-tight italic opacity-95 text-white`}>
                        "{currentIntel.text}"
                      </p>
                    </div>
                    <div className="mt-3 flex items-center space-x-2">
                      <RadioIcon size={10} className={isIntelAlerting ? 'text-white' : 'text-blue-500'} />
                      <span className={`text-[8px] font-black uppercase tracking-widest ${isIntelAlerting ? 'text-white/70' : 'text-slate-500'}`}>
                          Broadcasted by Admin{currentIntel.broadcaster ? ` - ${currentIntel.broadcaster}` : ''}
                      </span>
                    </div>
                  </div>
               </div>
            </div>
          )}

          {lastGivenTrade && (
            <div 
              onClick={() => scrollToSignal(lastGivenTrade.id)}
              className={`relative group cursor-pointer overflow-hidden rounded-2xl border bg-gradient-to-r from-slate-900 via-blue-900/40 to-slate-900 shadow-2xl transition-all duration-700 ${activeMajorAlerts[lastGivenTrade.id] ? 'border-blue-500 scale-[1.01]' : 'border-slate-800'}`}
            >
              <div className="flex items-center p-3 sm:p-5">
                  <div className="flex-shrink-0 mr-5 hidden sm:block">
                      <div className="w-14 h-14 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-400 border border-blue-500/30">
                          <Send size={28} />
                      </div>
                  </div>
                  <div className="flex-grow">
                      <div className="flex items-center space-x-3 mb-1.5">
                          <span className="px-2.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-[0.1em]">
                            Last Signal Broadcast
                          </span>
                          <div className="flex items-center text-[10px] font-mono font-black text-blue-400">
                              <Timer size={12} className="mr-1.5" />
                              <span>{timeSince(lastGivenTrade.timestamp)}</span>
                          </div>
                      </div>
                      <div className="flex flex-wrap items-baseline gap-x-4">
                          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tighter uppercase font-mono">
                              {lastGivenTrade.instrument} {lastGivenTrade.symbol} {lastGivenTrade.type}
                          </h3>
                          <div className="flex items-center text-sm font-black space-x-3">
                              <span className={`px-3 py-1 rounded-lg text-white font-black shadow-sm ${lastGivenTrade.action === 'BUY' ? 'bg-green-600' : 'bg-red-600'}`}>
                                  {lastGivenTrade.action === 'BUY' ? 'POTENTIAL UP' : 'POTENTIAL DOWN'} @ ₹{lastGivenTrade.entryPrice}
                              </span>
                          </div>
                      </div>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                      <div className="p-3 rounded-full bg-slate-800 text-slate-400 group-hover:text-blue-400 group-hover:bg-blue-400/10 transition-all border border-transparent group-hover:border-blue-500/20">
                          <ArrowRight size={24} />
                      </div>
                  </div>
              </div>
            </div>
          )}

          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-800/10">
                 <div className="flex items-center space-x-2">
                    <Target size={12} className="text-blue-500" />
                    <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Market Watch</h3>
                 </div>
                 <div className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[8px] font-mono font-black text-slate-600 uppercase tracking-tighter">Synced</span>
                 </div>
            </div>
            
            <div className="divide-y divide-slate-800/50">
                {watchlist.map((item, idx) => {
                    const isAlerting = !!activeWatchlistAlerts[item.symbol];
                    return (
                      <div key={idx} className={`flex items-center justify-between px-4 py-1.5 transition-all duration-200 relative ${isAlerting ? 'animate-box-glow bg-blue-500/10 z-10' : 'hover:bg-slate-800/20'}`}>
                          <div className="flex items-center space-x-3 min-0">
                              <div className={`w-1 h-1 rounded-full ${item.isPositive ? 'bg-emerald-500' : 'bg-rose-500'} ${isAlerting ? 'animate-ping' : ''}`}></div>
                              <div className="flex items-baseline space-x-2">
                                <span className={`text-[11px] font-black uppercase tracking-wider truncate ${isAlerting ? 'text-white' : 'text-slate-300'}`}>{item.symbol}</span>
                                <span className="text-[8px] font-mono text-slate-600 font-bold uppercase">{item.lastUpdated || '--'}</span>
                              </div>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                              <div className="flex items-baseline space-x-3">
                                  <span className={`text-xs font-mono font-black tracking-tighter ${isAlerting ? 'text-white scale-105 transition-transform' : 'text-slate-100'}`}>
                                    ₹{Number(item.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                                  </span>
                                  <div className="flex items-center min-w-[50px] justify-end">
                                    {item.isPositive ? <TrendingUp size={10} className="text-emerald-500 mr-1" /> : <TrendingDown size={10} className="text-rose-500 mr-1" />}
                                    <span className={`text-[9px] font-mono font-bold ${item.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {Number(item.change || 0).toFixed(1)}%
                                    </span>
                                  </div>
                              </div>
                              {isAlerting && <Zap size={8} className="text-blue-400 animate-pulse" />}
                          </div>
                      </div>
                    );
                })}
            </div>
          </div>

          <div>
              <div className="mb-4 flex items-center space-x-2 px-1">
                 <Zap size={16} className="text-emerald-500" />
                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Signal Feed</h3>
              </div>
              {sortedSignals.length === 0 ? (
                  <div className="text-center py-20 bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl">
                      <Zap size={40} className="mx-auto text-slate-800 mb-4" />
                      <p className="text-slate-500 font-black uppercase tracking-widest text-sm italic">Scanning terminal Truth...</p>
                  </div>
              ) : (
                  <div className="space-y-6">
                    {sortedSignals.map((signal) => (
                      <div key={signal.id} id={`signal-${signal.id}`}>
                        <SignalCard 
                            signal={signal} 
                            user={user} 
                            highlights={granularHighlights[signal.id]} 
                            isMajorAlerting={!!activeMajorAlerts[signal.id]}
                            onSignalUpdate={onSignalUpdate}
                            isRecentlyClosed={signal.status === TradeStatus.EXITED || signal.status === TradeStatus.STOPPED || signal.status === TradeStatus.ALL_TARGET}
                        />
                      </div>
                    ))}
                  </div>
              )}
          </div>
        </div>

        <div className="hidden lg:block space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-800/20">
                <div className="flex items-center space-x-2">
                    <List size={14} className="text-blue-500" />
                    <h3 className="font-bold text-white text-[10px] uppercase tracking-widest">Market Watch</h3>
                </div>
                <div className="flex items-center animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">Sync</span>
                </div>
            </div>
            <div className="divide-y divide-slate-800">
                {watchlist.map((item, idx) => {
                    const isAlerting = !!activeWatchlistAlerts[item.symbol];
                    return (
                      <div key={idx} className={`px-4 py-2 flex items-center justify-between transition-all duration-300 ${isAlerting ? 'animate-box-glow bg-blue-500/15' : 'hover:bg-slate-800/30'}`}>
                          <div>
                              <p className={`font-bold text-[11px] ${isAlerting ? 'text-blue-400' : 'text-slate-200'}`}>{item.symbol}</p>
                              <span className="text-[8px] font-mono text-slate-600">{item.lastUpdated || '--'}</span>
                          </div>
                          <div className="text-right">
                              <p className={`font-mono text-xs font-black ${isAlerting ? 'text-white' : 'text-slate-100'}`}>
                                {Number(item.price || 0).toFixed(2)}
                              </p>
                              <p className={`text-[9px] font-mono font-bold ${item.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {item.isPositive ? '+' : ''}{Number(item.change || 0).toFixed(2)}%
                              </p>
                          </div>
                      </div>
                    );
                })}
            </div>
          </div>
          
          <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-5 shadow-xl">
             <div className="flex items-center space-x-3 mb-3">
                <Zap size={18} className="text-blue-500" />
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Market Status</h4>
             </div>
             <p className="text-[10px] text-slate-400 leading-relaxed font-medium uppercase tracking-tighter italic">
                Secure link established. Spot prices and institutional flows are syncing in real-time. Alerts will trigger on major level shifts.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
