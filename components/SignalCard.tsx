
import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Target, Cpu, Edit2, Check, X, TrendingUp, TrendingDown, Clock, ShieldAlert, Zap, AlertTriangle, Trophy, Loader2, History, Briefcase, Activity, Moon, Trash2, RefreshCw } from 'lucide-react';
import { TradeSignal, TradeStatus, OptionType, User } from '../types';
import { analyzeTradeSignal } from '../services/geminiService';

interface SignalCardProps {
  signal: TradeSignal;
  user: User;
  highlights?: Set<string>;
  isMajorAlerting?: boolean;
  onSignalUpdate?: (updated: TradeSignal) => Promise<boolean>;
  onSignalDelete?: (signal: TradeSignal) => Promise<void>;
  isRecentlyClosed?: boolean;
}

const SignalCard: React.FC<SignalCardProps> = ({ signal, user, highlights, isMajorAlerting, onSignalUpdate, onSignalDelete, isRecentlyClosed }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  
  const [isEditingTrail, setIsEditingTrail] = useState(false);
  const [isSavingTrail, setIsSavingTrail] = useState(false);
  const [trailValue, setTrailValue] = useState<string>(signal.trailingSL != null ? Number(signal.trailingSL).toFixed(2) : '');
  const [displayTrail, setDisplayTrail] = useState<number | null | undefined>(signal.trailingSL);
  
  useEffect(() => {
    if (!isEditingTrail) {
      setDisplayTrail(signal.trailingSL);
      setTrailValue(signal.trailingSL != null ? Number(signal.trailingSL).toFixed(2) : '');
    }
  }, [signal.trailingSL, isEditingTrail]);

  const isBuy = signal.action === 'BUY';
  const isActive = signal.status === TradeStatus.ACTIVE || signal.status === TradeStatus.PARTIAL;
  const isExited = signal.status === TradeStatus.EXITED || signal.status === TradeStatus.STOPPED || signal.status === TradeStatus.ALL_TARGET;
  const isSLHit = signal.status === TradeStatus.STOPPED;
  const isAllTarget = signal.status === TradeStatus.ALL_TARGET;
  const isBTST = !!signal.isBTST;
  const isTSLHit = isExited && !isAllTarget && (signal.comment?.toUpperCase().includes('TSL') || (signal.status === TradeStatus.EXITED && (Number(signal.pnlPoints || 0)) > 0 && signal.comment?.toUpperCase().includes('TRAILING')));
  const canEdit = user.isAdmin && !isExited;

  let currentCMP = isNaN(Number(signal.cmp)) || signal.cmp === undefined || signal.cmp === null ? Number(signal.entryPrice || 0) : Number(signal.cmp);
  
  if (isSLHit) {
    currentCMP = Number(signal.stopLoss || 0);
  } else if (isAllTarget && signal.targets && signal.targets.length > 0) {
    currentCMP = Number(signal.targets[signal.targets.length - 1]);
  }

  const entryPrice = Number(signal.entryPrice || 0);
  const cmpProfit = currentCMP > 0 && entryPrice > 0 ? (isBuy ? currentCMP > entryPrice : currentCMP < entryPrice) : false;
  const cmpLoss = currentCMP > 0 && entryPrice > 0 ? (isBuy ? currentCMP < entryPrice : currentCMP > entryPrice) : false;
  
  const getStatusColor = (status: TradeStatus) => {
    switch (status) {
      case TradeStatus.ACTIVE: return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case TradeStatus.PARTIAL: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case TradeStatus.ALL_TARGET: return 'bg-emerald-600/20 text-emerald-400 border-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
      case TradeStatus.EXITED: return 'bg-slate-800 text-slate-500 border-slate-700';
      case TradeStatus.STOPPED: return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      default: return 'bg-slate-800 text-slate-400';
    }
  };

  const getTargetStyle = (index: number) => {
    const isHit = isAllTarget || (signal.targetsHit || 0) > index;
    if (!isHit) return 'bg-slate-950/40 border-slate-700/50 text-slate-300';
    switch (index) {
      case 0: return 'bg-[#10b981]/20 border-[#10b981] text-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.15)]';
      case 1: return 'bg-[#059669]/40 border-[#059669] text-white shadow-[0_0_15px_rgba(5,150,105,0.25)]';
      case 2: return 'bg-[#047857]/60 border-[#047857] text-white font-black shadow-[0_0_20px_rgba(4,120,87,0.35)]';
      default: return 'bg-emerald-500/30 border-emerald-400 text-emerald-200';
    }
  };

  const handleAIAnalysis = async () => {
    if (analysis) { setAnalysis(null); return; }
    setLoadingAnalysis(true);
    try {
      const result: string = await analyzeTradeSignal(signal);
      setAnalysis(result);
    } catch (err) {
      setAnalysis("Technical analysis could not be generated.");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleSaveTrail = async () => {
    const val = trailValue.trim() === '' ? null : parseFloat(trailValue);
    if (onSignalUpdate) {
        setIsSavingTrail(true);
        const success = await onSignalUpdate({
            ...signal,
            trailingSL: val,
            stopLoss: val !== null ? val : signal.stopLoss
        });
        if (success) {
            setDisplayTrail(val);
            setIsEditingTrail(false);
        }
        setIsSavingTrail(false);
    } else {
        if (!isNaN(val as any)) setDisplayTrail(val); else setDisplayTrail(null);
        setIsEditingTrail(false);
    }
  };

  let riskReward = 0;
  if (signal.targets && signal.targets.length > 0) {
    const risk = Math.abs(entryPrice - (Number(signal.stopLoss) || 1));
    if (risk > 0) {
      riskReward = isBuy 
        ? (Number(signal.targets[0]) - entryPrice) / risk
        : (entryPrice - Number(signal.targets[0])) / risk;
    }
  }
  
  const getStampContent = () => {
    if (isAllTarget) return { text: 'COMPLETED', color: 'text-emerald-500' };
    if (isSLHit) return { text: 'INVALIDATED', color: 'text-rose-500' };
    if (isTSLHit) return { text: 'PROTECTION HIT', color: 'text-amber-500' };
    return { text: 'VIEW CLOSED', color: 'text-slate-400' };
  };

  const stamp = getStampContent();
  const observedAtTime = new Date(signal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  return (
    <div className={`relative bg-slate-900 border rounded-xl overflow-hidden transition-all duration-500 
      ${isActive ? (isBTST ? 'border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : 'border-slate-700 shadow-xl') : 
        isBTST ? 'border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)]' : 'border-slate-800 opacity-90'} 
      ${isRecentlyClosed ? 'opacity-30 grayscale-[0.8]' : ''}
      ${isBTST ? 'bg-gradient-to-br from-slate-900 to-amber-950/15' : ''}
      ${isMajorAlerting ? 'animate-card-pulse border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.2)]' : ''}
    `}>
      
      {isBTST && (
        <div className="absolute top-0 right-0 z-20 overflow-hidden w-24 h-24 pointer-events-none">
          <div className="bg-amber-500 text-slate-950 text-[10px] font-black py-1 w-[140%] text-center transform rotate-45 translate-x-[20%] translate-y-[40%] shadow-lg border-b border-amber-600">
            OVERNIGHT
          </div>
        </div>
      )}

      {isRecentlyClosed && (
        <div className="absolute inset-0 z-[100] bg-slate-950/20 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
           <div className={`status-stamp ${stamp.color}`}>
              <div className="flex flex-col items-center">
                 <span className="text-2xl tracking-[0.2em]">{stamp.text}</span>
                 <div className="flex items-center mt-1 space-x-2">
                    <History size={12} />
                    <span className="text-[10px] font-bold opacity-60 uppercase">System Archiving</span>
                 </div>
              </div>
           </div>
        </div>
      )}

      <div className={`flex justify-between items-start p-5 pb-3 pt-6 ${!isExited && (highlights?.has('instrument') || highlights?.has('symbol') || highlights?.has('type') || highlights?.has('action') || highlights?.has('status')) ? 'animate-box-blink' : ''}`}>
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${isBuy ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'}`}>
            {isBuy ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 mb-0.5">
                <h3 className="text-xl font-bold text-white tracking-tight font-mono truncate">{signal.instrument}</h3>
                {isBTST && isActive && (
                  <div className={`flex items-center px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-black shadow-lg animate-pulse whitespace-nowrap`}>
                    <Moon size={10} className="mr-1" /> OVERNIGHT
                  </div>
                )}
            </div>
            <div className="flex items-center space-x-2 text-xs">
                <span className="font-mono text-slate-400 uppercase">{signal.symbol}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${signal.type === OptionType.CE ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                    {signal.type}
                </span>
                <span className={`px-2 py-0.5 rounded text-white text-[9px] font-black uppercase tracking-tight shadow-sm ${isBuy ? 'bg-green-600' : 'bg-red-600'}`}>
                    {isBuy ? 'POTENTIAL UP' : 'POTENTIAL DOWN'}
                </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end space-y-1.5 pr-2">
            <div className="flex items-center space-x-2">
              {user.isAdmin && onSignalDelete && (
                <button 
                  onClick={() => onSignalDelete(signal)}
                  className="p-1.5 bg-slate-800 text-slate-500 hover:text-rose-500 rounded-lg border border-slate-700 transition-colors mr-1"
                  title="Delete Signal"
                >
                  <Trash2 size={12} />
                </button>
              )}
              <div className={`px-3 py-1 rounded text-[10px] font-bold border ${getStatusColor(signal.status)} flex items-center ${!isExited && highlights?.has('status') ? 'animate-box-blink ring-2 ring-current' : ''}`}>
                  {isAllTarget ? <Trophy size={10} className="mr-2" /> : <span className={`w-1.5 h-1.5 rounded-full mr-2 ${isActive ? 'bg-current animate-pulse' : 'bg-current opacity-50'}`}></span>}
                  {signal.status}
              </div>
            </div>
            <div className="flex items-center text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                <ShieldAlert size={10} className="mr-1 text-blue-400" />
                RR 1:{riskReward.toFixed(1)}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-slate-800 border-y border-slate-800">
        <div className={`bg-slate-900 p-4 ${!isExited && (highlights?.has('entryPrice') || highlights?.has('quantity')) ? 'animate-box-blink' : ''}`}>
            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1 flex items-center leading-none">Base Level</p>
            <p className="text-xl font-mono font-bold text-white leading-tight">₹{entryPrice.toFixed(2)}</p>
            {signal.quantity ? (
              <div className="mt-1 flex items-center text-[10px] font-bold text-blue-400 uppercase tracking-tighter">
                <Briefcase size={10} className="mr-1" /> Size: {signal.quantity}
              </div>
            ) : null}
        </div>
        
        <div className={`p-4 flex flex-col transition-colors duration-500 ${isSLHit ? 'bg-rose-950/20' : 'bg-slate-900'} ${!isExited && highlights?.has('stopLoss') ? 'animate-box-blink' : ''}`}>
            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1 leading-none">Invalidation Point</p>
            <p className={`text-xl font-mono font-bold mb-3 leading-tight ${isSLHit ? 'text-rose-500' : 'text-rose-400'}`}>
              ₹{Number(signal.stopLoss || 0).toFixed(2)}
            </p>
            <div className={`mt-auto pt-2 border-t border-slate-800/80 ${!isExited && highlights?.has('trailingSL') ? 'animate-box-blink bg-blue-500/10' : ''}`}>
                {isEditingTrail ? (
                    <div className="flex items-center space-x-1">
                        <input type="number" value={trailValue} onChange={(e) => setTrailValue(e.target.value)} className="w-full bg-slate-950 border border-blue-500/50 rounded text-[10px] px-2 py-1 text-white focus:outline-none font-mono" autoFocus disabled={isSavingTrail} />
                        <button onClick={handleSaveTrail} disabled={isSavingTrail} className="p-1 bg-emerald-500/20 text-emerald-400 rounded">
                          {isSavingTrail ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                        </button>
                        <button onClick={() => setIsEditingTrail(false)} disabled={isSavingTrail} className="p-1 bg-slate-700 text-slate-400 rounded"><X size={10} /></button>
                    </div>
                ) : (
                    <div className={`flex items-center justify-between rounded -mx-1 px-1 py-1 transition-colors group/trail ${canEdit ? 'cursor-pointer hover:bg-slate-800/50' : 'opacity-70'}`} onClick={() => canEdit && setIsEditingTrail(true)}>
                         <div className="flex items-center space-x-1.5">
                            <TrendingUp size={10} className={isTSLHit ? 'text-rose-500' : 'text-yellow-600'} />
                            <span className="text-[9px] text-slate-500 uppercase font-black tracking-tighter whitespace-nowrap">Protection</span>
                         </div>
                         <div className="flex items-center space-x-2">
                            <span className={`text-xs font-mono font-bold ${isTSLHit ? 'text-rose-500' : 'text-yellow-500'}`}>
                              {displayTrail != null ? `₹${Number(displayTrail).toFixed(1)}` : '--'}
                            </span>
                            {canEdit && <Edit2 size={10} className="text-slate-700" />}
                         </div>
                    </div>
                )}
            </div>
        </div>

        <div className={`p-4 border-l border-slate-800 transition-all duration-700 bg-slate-900`}>
            <div className="flex items-center justify-between mb-1.5">
                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest flex items-center leading-none">
                  <Activity size={10} className={`mr-1 ${isBTST ? 'text-amber-500' : 'text-blue-500'}`} /> {isExited ? 'EXIT' : 'CMP'}
                </p>
                {isActive && (
                  <div className={`flex items-center space-x-1 ${isBTST ? 'bg-amber-500/10' : 'bg-emerald-500/10'} border border-current/20 px-1 py-0.5 rounded animate-pulse`}>
                     <span className={`w-1 h-1 rounded-full ${isBTST ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                     <span className={`text-[8px] font-black ${isBTST ? 'text-amber-500' : 'text-emerald-500'} uppercase`}>LIVE</span>
                  </div>
                )}
            </div>
            <p className={`text-2xl font-mono font-black tracking-tighter leading-tight ${cmpProfit && isActive ? 'text-emerald-400' : cmpLoss && isActive ? 'text-rose-400' : 'text-white'}`}>
              ₹{currentCMP.toFixed(2)}
            </p>
        </div>
      </div>

      {(isExited || (signal.pnlPoints !== undefined && signal.pnlPoints !== null)) && (
        <div className={`px-5 py-3 flex items-center justify-between border-b border-slate-800 ${ (Number(signal.pnlPoints || 0)) >= 0 ? 'bg-emerald-500/5' : 'bg-rose-500/5' }`}>
            <div className="flex items-center space-x-2">
                <div className={`p-1.5 rounded-full ${(Number(signal.pnlPoints || 0)) >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {(Number(signal.pnlPoints || 0)) >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isExited ? 'Realized P&L' : 'Unrealized'}</span>
            </div>
            <div className="text-right flex flex-col items-end">
                 <div className={`text-xl font-mono font-bold leading-none ${(Number(signal.pnlPoints || 0)) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(Number(signal.pnlPoints || 0)) > 0 ? '+' : ''}{Number(signal.pnlPoints || 0).toFixed(1)} pts
                 </div>
                 {signal.pnlRupees != null && (
                   <div className={`text-xs font-mono font-bold mt-1 ${(Number(signal.pnlRupees || 0)) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {Number(signal.pnlRupees) >= 0 ? '+' : ''}₹{Number(signal.pnlRupees).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                   </div>
                 )}
            </div>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
                <Target size={14} className="text-blue-500" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Projected Resistance Level</span>
            </div>
        </div>
        <div className={`grid grid-cols-3 gap-2 ${!isExited && (highlights?.has('targetsHit') || highlights?.has('blast')) ? 'animate-box-blink' : ''}`}>
            {signal.targets?.map((t, idx) => {
                const isHit = isAllTarget || (signal.targetsHit || 0) > idx;
                return (
                  <div key={idx} className={`rounded px-2 py-2 text-center border transition-all duration-700 ${getTargetStyle(idx)}`}>
                      <p className={`text-[9px] font-black uppercase mb-0.5 ${isHit ? 'text-white' : 'text-slate-400'}`}>LVL {idx + 1}</p>
                      <p className={`text-sm font-mono font-black ${isHit && isActive ? 'animate-pulse' : ''}`}>{Number(t).toFixed(1)}</p>
                      {isHit && <Check size={10} strokeWidth={3} className="mx-auto mt-1" />}
                  </div>
                );
            })}
        </div>
        {signal.comment && (
            <div className={`mt-4 p-3 rounded-lg border transition-colors ${!isExited && highlights?.has('comment') ? 'animate-box-blink' : ''} ${isSLHit || isTSLHit ? 'bg-rose-950/20 border-rose-500/30' : isAllTarget ? 'bg-emerald-950/20 border-emerald-500/30' : (isBTST ? 'bg-amber-950/20 border-amber-500/30' : 'bg-slate-950/50 border-slate-800/50')}`}>
                <p className={`text-xs leading-relaxed ${isSLHit || isTSLHit ? 'text-rose-400 font-bold' : isAllTarget ? 'text-emerald-400 font-bold italic' : (isBTST ? 'text-amber-400 font-bold' : 'text-slate-400')}`}>
                  " {signal.comment} "
                </p>
            </div>
        )}
        <div className="mt-4 border-t border-slate-800 pt-3 flex justify-between items-center">
            <div className="flex items-center space-x-6">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 leading-none opacity-50">Observed At</span>
                  <div className="flex items-center text-[10px] text-slate-400 font-mono">
                      <Clock size={10} className="mr-1" />
                      {observedAtTime}
                  </div>
                </div>

                {signal.lastTradedTimestamp && signal.lastTradedTimestamp !== signal.timestamp && (
                  <div className="flex flex-col border-l border-slate-800 pl-4">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 leading-none opacity-50">Modified</span>
                    <div className="flex items-center text-[10px] text-slate-400 font-mono">
                        <RefreshCw size={10} className="mr-1" />
                        {new Date(signal.lastTradedTimestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                )}
            </div>
            {!isExited && (
              <button onClick={handleAIAnalysis} disabled={loadingAnalysis} className="flex items-center py-1 text-[10px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-widest transition-colors">
                  <Cpu size={12} className="mr-1.5" />
                  {loadingAnalysis ? 'Syncing AI...' : analysis ? 'Close Intel' : 'AI Analysis'}
              </button>
            )}
        </div>
        {analysis && !isExited && (
            <div className="mt-2 p-3 bg-slate-950 border border-blue-900/30 rounded text-[10px] text-slate-300 font-mono animate-in slide-in-from-top-2">
                <div className="text-blue-400 mb-1 font-bold uppercase tracking-widest text-[9px] border-b border-blue-900/30 pb-1 flex items-center">
                    <Check size={10} className="mr-1" /> Quantitative Analysis Output
                </div>
                {analysis}
            </div>
        )}
      </div>
    </div>
  );
};

export default SignalCard;
