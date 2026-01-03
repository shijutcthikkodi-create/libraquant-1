import React, { useState, useMemo, useEffect } from 'react';
import { WatchlistItem, TradeSignal, OptionType, TradeStatus, User, LogEntry, ChatMessage } from '../types';
import { 
  Trash2, Edit2, Radio, UserCheck, RefreshCw, Search, 
  History, Zap, Loader2, Database,
  Plus, ArrowUpCircle, ArrowDownCircle, X, Database as DatabaseIcon,
  UserPlus, Shield, User as UserIcon, CheckCircle2, Eye, EyeOff,
  Key, TrendingUp, Send, MessageSquareCode, Radio as RadioIcon,
  Briefcase, Activity, Moon, MessageSquare, AlertCircle, ChevronRight, Settings2,
  Target
} from 'lucide-react';
import { updateSheetData } from '../services/googleSheetsService';

interface AdminProps {
  watchlist: WatchlistItem[];
  onUpdateWatchlist: (list: WatchlistItem[]) => void;
  signals: TradeSignal[];
  onUpdateSignals: (list: TradeSignal[]) => void;
  users: User[];
  onUpdateUsers: (list: User[]) => void;
  logs?: LogEntry[];
  messages: ChatMessage[];
  onNavigate: (page: string) => void;
  onHardSync?: () => Promise<void>;
}

const Admin: React.FC<AdminProps> = ({ signals = [], users = [], logs = [], messages = [], onHardSync }) => {
  const [activeTab, setActiveTab] = useState<'SIGNALS' | 'CLIENTS' | 'BROADCAST' | 'LOGS'>('SIGNALS');
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [logFilter, setLogFilter] = useState<'ALL' | 'SECURITY' | 'TRADE' | 'SYSTEM' | 'USER'>('ALL');

  // Broadcast State
  const [intelText, setIntelText] = useState('');

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editExpiry, setEditExpiry] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Edit Signal Modal State
  const [editingSignal, setEditingSignal] = useState<TradeSignal | null>(null);
  const [editSigSymbol, setEditSigSymbol] = useState('');
  const [editSigEntry, setEditSigEntry] = useState('');
  const [editSigSL, setEditSigSL] = useState('');
  const [editSigTargets, setEditSigTargets] = useState('');
  const [editSigCMP, setEditSigCMP] = useState('');
  const [editSigQty, setEditSigQty] = useState('');
  const [editSigIsBTST, setEditSigIsBTST] = useState(false);
  const [editSigType, setEditSigType] = useState<OptionType>(OptionType.CE);
  const [editSigAction, setEditSigAction] = useState<'BUY' | 'SELL'>('BUY');
  const [editSigInstrument, setEditSigInstrument] = useState('');
  const [editSigComment, setEditSigComment] = useState('');

  // New Signal Form State
  const [isAddingSignal, setIsAddingSignal] = useState(false);
  const [sigInstrument, setSigInstrument] = useState('NIFTY');
  const [sigSymbol, setSigSymbol] = useState('');
  const [sigType, setSigType] = useState<OptionType>(OptionType.CE);
  const [sigAction, setSigAction] = useState<'BUY' | 'SELL'>('BUY');
  const [sigEntry, setSigEntry] = useState('');
  const [sigSL, setSigSL] = useState('');
  const [sigTargets, setSigTargets] = useState('');
  const [sigComment, setSigComment] = useState('');
  const [sigIsBtst, setSigIsBtst] = useState(false);
  const [sigQty, setSigQty] = useState('');

  const activeSignals = useMemo(() => {
    return (signals || []).filter(s => s.status === TradeStatus.ACTIVE || s.status === TradeStatus.PARTIAL);
  }, [signals]);

  const adminMessages = useMemo(() => {
    return (messages || []).filter(m => m.isAdminReply).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [messages]);

  const filteredUsers = useMemo(() => {
    let list = [...(users || [])];
    if (searchQuery && activeTab === 'CLIENTS') {
      const q = searchQuery.toLowerCase();
      list = list.filter(u => 
        (u.name || '').toLowerCase().includes(q) || 
        (u.phoneNumber || '').includes(q) || 
        (u.id || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, searchQuery, activeTab]);

  const filteredLogs = useMemo(() => {
    let list = logFilter === 'ALL' 
      ? [...(logs || [])] 
      : (logs || []).filter(l => l.type === logFilter);
      
    if (searchQuery && activeTab === 'LOGS') {
      const q = searchQuery.toLowerCase();
      list = list.filter(l => 
        (l.user || '').toLowerCase().includes(q) || 
        (l.action || '').toLowerCase().includes(q) || 
        (l.details || '').toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, logFilter, searchQuery, activeTab]);

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditName(user.name || '');
    setEditPhone(user.phoneNumber || '');
    setEditExpiry(user.expiryDate || '');
    setEditPassword(user.password || '');
    setShowEditPassword(false);
  };

  const handleEditSignalModal = (signal: TradeSignal) => {
    setEditSigSymbol(signal.symbol || '');
    setEditSigEntry(String(signal.entryPrice || ''));
    setEditSigSL(String(signal.stopLoss || ''));
    setEditSigTargets(signal.targets ? signal.targets.join(', ') : '');
    setEditSigCMP(String(signal.cmp || signal.entryPrice || ''));
    setEditSigQty(String(signal.quantity || ''));
    setEditSigIsBTST(!!signal.isBTST);
    setEditSigType(signal.type || OptionType.CE);
    setEditSigAction(signal.action || 'BUY');
    setEditSigInstrument(signal.instrument || 'NIFTY');
    setEditSigComment(signal.comment || '');
    setEditingSignal(signal);
  };

  const handleSaveSignal = async () => {
    if (!editingSignal) return;
    setIsSaving(true);
    
    const targets = editSigTargets.split(',')
      .map(t => parseFloat(t.trim()))
      .filter(n => !isNaN(n));

    const updatedSignal: TradeSignal = {
      ...editingSignal,
      symbol: editSigSymbol,
      entryPrice: parseFloat(editSigEntry) || 0,
      stopLoss: parseFloat(editSigSL) || 0,
      targets: targets,
      cmp: parseFloat(editSigCMP) || 0,
      quantity: editSigQty ? parseInt(editSigQty) : 0,
      isBTST: editSigIsBTST,
      type: editSigType,
      action: editSigAction,
      instrument: editSigInstrument,
      comment: editSigComment,
      lastTradedTimestamp: new Date().toISOString()
    };

    const success = await updateSheetData('signals', 'UPDATE_SIGNAL', updatedSignal, editingSignal.id);
    if (success) {
      await updateSheetData('logs', 'ADD', {
        timestamp: new Date().toISOString(),
        user: 'ADMIN',
        action: 'SIGNAL_DEEP_MODIFY',
        details: `Modified ${updatedSignal.instrument} ${updatedSignal.symbol} parameters`,
        type: 'TRADE'
      });
      setEditingSignal(null);
      if (onHardSync) await onHardSync();
    }
    setIsSaving(false);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    const updatedUser = { 
      ...editingUser, 
      name: editName, 
      phoneNumber: editPhone, 
      expiryDate: editExpiry, 
      password: editPassword 
    };
    const success = await updateSheetData('users', 'UPDATE_USER', updatedUser, editingUser.id);
    if (success) {
      await updateSheetData('logs', 'ADD', {
        timestamp: new Date().toISOString(),
        user: 'ADMIN',
        action: 'USER_UPDATE',
        details: `Updated info for ${editName}`,
        type: 'USER'
      });
      setEditingUser(null);
      if (onHardSync) await onHardSync();
    }
    setIsSaving(false);
  };

  const handleResetDevice = async (userToReset: User) => {
    if (!window.confirm(`Clear hardware lock for ${userToReset.name}?`)) return;
    setIsSaving(true);
    const updatedUser = { ...userToReset, deviceId: null, lastPassword: '' };
    const success = await updateSheetData('users', 'UPDATE_USER', updatedUser, userToReset.id);
    if (success) {
      await updateSheetData('logs', 'ADD', {
        timestamp: new Date().toISOString(),
        user: 'ADMIN',
        action: 'DEVICE_UNLOCKED',
        details: `Reset security lock for ${userToReset.name}`,
        type: 'SECURITY'
      });
      if (onHardSync) await onHardSync();
    }
    setIsSaving(false);
  };

  const handleAddSignal = async () => {
    if (!sigSymbol || !sigEntry || !sigSL) return;
    setIsSaving(true);
    
    const targets = sigTargets.split(',')
      .map(t => parseFloat(t.trim()))
      .filter(n => !isNaN(n));
    
    const newSignal: any = {
        instrument: sigInstrument,
        symbol: sigSymbol,
        type: sigType,
        action: sigAction,
        entryPrice: parseFloat(sigEntry),
        stopLoss: parseFloat(sigSL),
        targets: targets,
        targetsHit: 0,
        status: TradeStatus.ACTIVE,
        timestamp: new Date().toISOString(),
        comment: sigComment,
        isBTST: sigIsBtst,
        quantity: sigQty ? parseInt(sigQty) : 0,
        cmp: parseFloat(sigEntry)
    };

    const success = await updateSheetData('signals', 'ADD', newSignal);
    
    if (success) {
      await updateSheetData('logs', 'ADD', {
        timestamp: new Date().toISOString(),
        user: 'ADMIN',
        action: 'SIGNAL_BROADCAST',
        details: `New Trade: ${newSignal.instrument} ${newSignal.symbol}`,
        type: 'TRADE'
      });
      setSigSymbol(''); setSigEntry(''); setSigSL(''); setSigTargets(''); setSigComment(''); setSigQty(''); setSigIsBtst(false);
      setIsAddingSignal(false);
      if (onHardSync) await onHardSync();
    }
    setIsSaving(false);
  };

  const handlePostIntel = async () => {
    if (!intelText.trim()) return;
    setIsSaving(true);
    const newBroadcast: Partial<ChatMessage> = {
      text: intelText.trim(),
      timestamp: new Date().toISOString(),
      isAdminReply: true,
      senderName: 'TERMINAL ADMIN',
      userId: 'ADMIN'
    };
    const success = await updateSheetData('messages', 'ADD', newBroadcast);
    if (success) {
      await updateSheetData('logs', 'ADD', {
        timestamp: new Date().toISOString(),
        user: 'ADMIN',
        action: 'INTEL_POST',
        details: `Intelligence update posted`,
        type: 'SYSTEM'
      });
      setIntelText('');
      if (onHardSync) await onHardSync();
    }
    setIsSaving(false);
  };

  const triggerQuickUpdate = async (signal: TradeSignal, updates: Partial<TradeSignal>, actionLabel: string) => {
    setIsSaving(true);
    const payload = { ...signal, ...updates, lastTradedTimestamp: new Date().toISOString() };
    const success = await updateSheetData('signals', 'UPDATE_SIGNAL', payload, signal.id);
    if (success) {
      await updateSheetData('logs', 'ADD', {
        timestamp: new Date().toISOString(),
        user: 'ADMIN',
        action: actionLabel,
        details: `${signal.instrument}: ${updates.status || 'Data Update'}`,
        type: 'TRADE'
      });
      if (onHardSync) await onHardSync();
    }
    setIsSaving(false);
  };

  const getLogTypeColor = (type: string) => {
    switch(type) {
      case 'SECURITY': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'TRADE': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'USER': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Admin Terminal</h2>
            <p className="text-slate-500 text-xs font-medium mt-1">Institutional Operations Console</p>
        </div>
        <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 mt-4 md:mt-0 shadow-lg overflow-x-auto">
            {[
              { id: 'SIGNALS', icon: Radio, label: 'Trade Deck' },
              { id: 'BROADCAST', icon: RadioIcon, label: 'Intel' },
              { id: 'CLIENTS', icon: UserIcon, label: 'Users' },
              { id: 'LOGS', icon: History, label: 'Audit' }
            ].map((tab) => (
              <button 
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as any); setSearchQuery(''); }}
                  className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                  <tab.icon size={14} className="mr-2" />
                  {tab.label}
              </button>
            ))}
        </div>
      </div>

      {activeTab === 'SIGNALS' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {/* BROADCAST ENGINE PANEL */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                    <div className="flex items-center">
                        <Zap size={18} className="mr-3 text-emerald-500" />
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">Broadcast New Trade</h3>
                    </div>
                    {!isAddingSignal && (
                      <div className="flex space-x-2">
                        <button onClick={onHardSync} className="flex items-center px-4 py-2 rounded-lg bg-slate-800 text-blue-400 border border-blue-500/20 text-xs font-bold hover:bg-blue-500/10 transition-all">
                           <DatabaseIcon size={14} className="mr-2" /> Hard Sync
                        </button>
                        <button onClick={() => setIsAddingSignal(true)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors shadow-lg shadow-blue-900/40 uppercase tracking-widest">
                            New Signal
                        </button>
                      </div>
                    )}
                </div>

                {isAddingSignal && (
                    <div className="p-6 bg-slate-950/40 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase tracking-tighter">Instrument</label>
                                <select value={sigInstrument} onChange={e => setSigInstrument(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none">
                                    <option value="NIFTY">NIFTY</option>
                                    <option value="BANKNIFTY">BANKNIFTY</option>
                                    <option value="FINNIFTY">FINNIFTY</option>
                                    <option value="MIDCPNIFTY">MIDCPNIFTY</option>
                                    <option value="SENSEX">SENSEX</option>
                                    <option value="STOCKS">STOCKS</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase tracking-tighter">Strike / Symbol</label>
                                <input type="text" value={sigSymbol} onChange={e => setSigSymbol(e.target.value)} placeholder="e.g. 22500" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase tracking-tighter">Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['CE', 'PE', 'FUT'].map(t => (
                                        <button key={t} onClick={() => setSigType(t as any)} className={`py-2 text-xs font-bold rounded-lg border transition-all ${sigType === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase tracking-tighter">Action</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setSigAction('BUY')} className={`py-2 text-xs font-bold rounded-lg border transition-all ${sigAction === 'BUY' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>Buy</button>
                                    <button onClick={() => setSigAction('SELL')} className={`py-2 text-xs font-bold rounded-lg border transition-all ${sigAction === 'SELL' ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>Sell</button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase tracking-tighter">Entry Price</label>
                                <input type="number" value={sigEntry} onChange={e => setSigEntry(e.target.value)} placeholder="0.00" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase tracking-tighter">Stop Loss</label>
                                <input type="number" value={sigSL} onChange={e => setSigSL(e.target.value)} placeholder="0.00" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase tracking-tighter">Quantity</label>
                                <input type="number" value={sigQty} onChange={e => setSigQty(e.target.value)} placeholder="0" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col justify-end">
                                <button 
                                  onClick={() => setSigIsBtst(!sigIsBtst)}
                                  className={`flex items-center justify-center space-x-2 py-2.5 rounded-xl border transition-all ${sigIsBtst ? 'bg-amber-500/20 border-amber-500 text-amber-500 shadow-lg shadow-amber-900/20' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                                >
                                  <Moon size={14} className={sigIsBtst ? 'animate-pulse' : ''} />
                                  <span className="text-[10px] font-black uppercase tracking-widest">BTST</span>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase tracking-tighter">Targets (Comma Separated)</label>
                            <input type="text" value={sigTargets} onChange={e => setSigTargets(e.target.value)} placeholder="e.g. 120, 140, 180" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase tracking-tighter">Market Comment</label>
                            <input type="text" value={sigComment} onChange={e => setSigComment(e.target.value)} placeholder="Strategic note..." className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none" />
                        </div>

                        <div className="flex items-center space-x-3 pt-2">
                            <button 
                                onClick={handleAddSignal} 
                                disabled={isSaving || !sigSymbol || !sigEntry} 
                                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-4 rounded-xl text-sm font-black transition-all shadow-xl flex items-center justify-center uppercase tracking-widest"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Zap size={16} className="mr-2" />}
                                Broadcast Signal
                            </button>
                            <button onClick={() => setIsAddingSignal(false)} className="px-6 py-4 bg-slate-800 text-slate-400 rounded-xl hover:bg-slate-700 transition-colors font-black text-xs uppercase tracking-tighter">Cancel</button>
                        </div>
                    </div>
                )}
            </div>

            {/* ACTIVE DECK COMMAND CENTER */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-5 border-b border-slate-800 bg-slate-800/10 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                       <Radio size={16} className="text-blue-500" />
                       <h3 className="text-sm font-black text-white uppercase tracking-wider">Active Portfolio Control</h3>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase px-2 py-0.5 bg-slate-800 rounded-full">{activeSignals.length} Active Positions</span>
                </div>

                <div className="p-5">
                    {activeSignals.length === 0 ? (
                        <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
                            <AlertCircle size={32} className="mx-auto text-slate-800 mb-3" />
                            <p className="text-slate-500 text-[10px] uppercase tracking-widest font-black">Scanning for Active Trades...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {activeSignals.map((s) => (
                                <div key={s.id} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 md:p-6 hover:border-slate-700 transition-all">
                                    <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
                                        {/* Instrument Block */}
                                        <div className="flex items-center space-x-4 min-w-[200px]">
                                            <div className={`p-3 rounded-xl ${s.action === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                {s.action === 'BUY' ? <ArrowUpCircle size={28} /> : <ArrowDownCircle size={28} />}
                                            </div>
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <h4 className="font-mono font-black text-white text-lg tracking-tight uppercase">{s.instrument} {s.symbol}</h4>
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${s.type === 'CE' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-rose-900/40 text-rose-400'}`}>{s.type}</span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-mono font-bold mt-0.5 uppercase">Entry: ₹{s.entryPrice} | SL: ₹{s.stopLoss}</p>
                                            </div>
                                        </div>

                                        {/* Live Update Strip */}
                                        <div className="grid grid-cols-2 md:grid-cols-3 xl:flex xl:items-center gap-4 w-full xl:w-auto">
                                            {/* CMP Field */}
                                            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2 px-3">
                                                <div className="flex items-center space-x-1.5 mb-1 opacity-50">
                                                    <Activity size={10} className="text-emerald-400" />
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">CMP Update</span>
                                                </div>
                                                <input 
                                                    type="number"
                                                    step="0.05"
                                                    defaultValue={s.cmp || s.entryPrice}
                                                    onBlur={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        if (!isNaN(val) && val !== s.cmp) triggerQuickUpdate(s, { cmp: val }, "CMP Refresh");
                                                    }}
                                                    className="bg-transparent text-xs font-mono font-black text-emerald-400 w-full outline-none"
                                                />
                                            </div>

                                            {/* Trail SL Field */}
                                            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2 px-3">
                                                <div className="flex items-center space-x-1.5 mb-1 opacity-50">
                                                    <TrendingUp size={10} className="text-yellow-500" />
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Trailing SL</span>
                                                </div>
                                                <input 
                                                    type="number"
                                                    step="0.05"
                                                    defaultValue={s.trailingSL || ''}
                                                    placeholder="--.--"
                                                    onBlur={(e) => {
                                                        const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                                        if (val !== s.trailingSL) triggerQuickUpdate(s, { trailingSL: val }, "Trail Modify");
                                                    }}
                                                    className="bg-transparent text-xs font-mono font-black text-yellow-500 w-full outline-none"
                                                />
                                            </div>

                                            {/* Targets Hit */}
                                            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2 px-3 col-span-2 md:col-span-1">
                                                <div className="flex items-center space-x-1.5 mb-1.5 opacity-50">
                                                    {/* Fix: Added Target to lucide-react imports */}
                                                    <Target size={10} className="text-blue-500" />
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Target Progress</span>
                                                </div>
                                                <div className="flex space-x-1.5">
                                                    {[1, 2, 3].map(t => (
                                                        <button 
                                                            key={t}
                                                            onClick={() => triggerQuickUpdate(s, { targetsHit: t, status: TradeStatus.PARTIAL, comment: `Target ${t} Accomplished.` }, `T${t} Hit`)}
                                                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${ (s.targetsHit || 0) >= t ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/20' : 'bg-slate-800 text-slate-500 hover:bg-slate-700' }`}
                                                        >
                                                            {t}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center space-x-2 w-full xl:w-auto justify-end">
                                            <button 
                                                onClick={() => handleEditSignalModal(s)}
                                                className="p-3 bg-slate-800 text-blue-400 hover:text-white rounded-xl border border-slate-700 transition-all hover:bg-blue-600/10 shadow-lg"
                                                title="Deep Modify Trade"
                                            >
                                                <Settings2 size={18} />
                                            </button>
                                            
                                            <div className="h-10 w-px bg-slate-800 mx-1 hidden xl:block"></div>

                                            <button 
                                                onClick={() => triggerQuickUpdate(s, { status: TradeStatus.ALL_TARGET, targetsHit: 3, comment: "Golden Trade! All targets hit." }, "All Booked")}
                                                className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-black uppercase shadow-xl shadow-emerald-900/40 tracking-tighter"
                                            >
                                                Goal
                                            </button>
                                            <button 
                                                onClick={() => triggerQuickUpdate(s, { status: TradeStatus.STOPPED, comment: "Stop Loss strictly hit." }, "SL Liquidation")}
                                                className="px-4 py-3 bg-rose-900/30 text-rose-400 border border-rose-500/30 rounded-xl text-[11px] font-black uppercase hover:bg-rose-500/10 tracking-tighter"
                                            >
                                                SL Hit
                                            </button>
                                            <button 
                                                onClick={() => triggerQuickUpdate(s, { status: TradeStatus.EXITED, comment: "Position liquidated at market." }, "Manual Exit")}
                                                className="px-4 py-3 bg-slate-800 text-slate-400 border border-slate-700 rounded-xl text-[11px] font-black uppercase hover:bg-slate-700 tracking-tighter"
                                            >
                                                Exit
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {activeTab === 'BROADCAST' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-6">
                <div className="flex items-center space-x-3 mb-6">
                    <MessageSquareCode className="text-blue-500" size={24} />
                    <h3 className="text-lg font-bold text-white uppercase tracking-tighter">Market Intelligence Broadcaster</h3>
                </div>
                
                <div className="space-y-4">
                    <textarea 
                        value={intelText}
                        onChange={(e) => setIntelText(e.target.value)}
                        placeholder="Type global market update or view..."
                        className="w-full h-32 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-sm focus:border-blue-500 outline-none font-medium leading-relaxed"
                    />
                    <div className="flex justify-end">
                        <button 
                            onClick={handlePostIntel}
                            disabled={isSaving || !intelText.trim()}
                            className="flex items-center px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg disabled:opacity-50 uppercase tracking-widest"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Send size={16} className="mr-2" />}
                            Post Update
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-5 border-b border-slate-800 bg-slate-800/10">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Feed History</h3>
                </div>
                <div className="divide-y divide-slate-800">
                    {adminMessages.map((msg) => (
                        <div key={msg.id} className="p-4 hover:bg-slate-800/20 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-mono text-slate-600 uppercase font-bold">{new Date(msg.timestamp).toLocaleString()}</span>
                                <div className="flex items-center space-x-1">
                                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                   <span className="text-[8px] font-black text-blue-500 uppercase tracking-tighter">Live Intel</span>
                                </div>
                            </div>
                            <p className="text-sm text-slate-300 font-medium leading-relaxed">{msg.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {activeTab === 'CLIENTS' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3.5 text-slate-500" size={18} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter subscribers..." 
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-white focus:border-blue-500 outline-none text-sm"
                />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/30 text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">
                      <th className="px-6 py-4">Subscriber</th>
                      <th className="px-6 py-4">Key Access</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredUsers.map(u => {
                      const isExpired = u.expiryDate && new Date(u.expiryDate) < new Date();
                      return (
                        <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-xs uppercase">
                                {u.name ? u.name.charAt(0) : '?'}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white">{u.name || 'Anonymous'}</p>
                                <p className="text-[10px] font-mono text-slate-500">{u.phoneNumber}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2">
                              <Key size={12} className="text-slate-500" />
                              <span className="text-[11px] font-mono text-slate-300">{(u.password || '').slice(0, 10)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block border ${isExpired ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                {isExpired ? 'EXPIRED' : 'ACTIVE'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button onClick={() => handleEditUser(u)} className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"><Edit2 size={14} /></button>
                              <button onClick={() => handleResetDevice(u)} className={`p-2 rounded-lg transition-all ${u.deviceId ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-800 text-slate-600 opacity-30'}`} disabled={!u.deviceId}><RefreshCw size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
        </div>
      )}

      {/* RE-CREATED MODIFY TRADE MODAL */}
      {editingSignal && (
        <div className="fixed inset-0 z-[300] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-800/10">
              <div className="flex items-center space-x-4">
                 <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-500 border border-blue-500/20 shadow-lg">
                    <Settings2 size={24} />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Modify Terminal Feed</h3>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-0.5">Adjusting parameters for {editingSignal.instrument} {editingSignal.symbol}</p>
                 </div>
              </div>
              <button onClick={() => setEditingSignal(null)} className="p-3 hover:bg-slate-800 rounded-full text-slate-500 transition-colors"><X size={24} /></button>
            </div>
            
            <div className="p-8 overflow-y-auto max-h-[65vh] space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Base Instrument</label>
                          <select value={editSigInstrument} onChange={e => setEditSigInstrument(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-white text-sm focus:border-blue-500 outline-none transition-all">
                              <option value="NIFTY">NIFTY</option>
                              <option value="BANKNIFTY">BANKNIFTY</option>
                              <option value="FINNIFTY">FINNIFTY</option>
                              <option value="MIDCPNIFTY">MIDCPNIFTY</option>
                              <option value="SENSEX">SENSEX</option>
                              <option value="STOCKS">STOCKS</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Strike / Symbol</label>
                          <input type="text" value={editSigSymbol} onChange={e => setEditSigSymbol(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-white text-sm focus:border-blue-500 outline-none font-mono font-bold" />
                      </div>
                  </div>
                  
                  <div className="space-y-6">
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Pricing Structure (Entry / SL / CMP)</label>
                          <div className="grid grid-cols-3 gap-2">
                              <input type="number" step="0.05" value={editSigEntry} onChange={e => setEditSigEntry(e.target.value)} placeholder="Entry" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-white text-xs outline-none font-mono" />
                              <input type="number" step="0.05" value={editSigSL} onChange={e => setEditSigSL(e.target.value)} placeholder="SL" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-rose-400 outline-none font-mono" />
                              <input type="number" step="0.05" value={editSigCMP} onChange={e => setEditSigCMP(e.target.value)} placeholder="CMP" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-emerald-400 outline-none font-mono" />
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Lot Size / Qty</label>
                            <input type="number" value={editSigQty} onChange={e => setEditSigQty(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-white text-sm font-mono" />
                         </div>
                         <div className="flex flex-col justify-end pb-1">
                            <button 
                                onClick={() => setEditSigIsBTST(!editSigIsBTST)}
                                className={`flex items-center justify-center space-x-2 py-3 rounded-2xl border transition-all ${editSigIsBTST ? 'bg-amber-500/20 border-amber-500 text-amber-500' : 'bg-slate-950 border-slate-800 text-slate-600'}`}
                            >
                                <Moon size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest">BTST Toggle</span>
                            </button>
                         </div>
                      </div>
                  </div>
               </div>

               <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Target Sequence (Targets 1, 2, 3...)</label>
                  <input type="text" value={editSigTargets} onChange={e => setEditSigTargets(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-white text-sm focus:border-blue-500 outline-none font-mono font-bold tracking-widest" />
               </div>

               <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Terminal Logic / Comment</label>
                  <div className="relative">
                    <MessageSquare size={16} className="absolute left-4 top-4 text-slate-600" />
                    <input type="text" value={editSigComment} onChange={e => setEditSigComment(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-white text-sm focus:border-blue-500 outline-none" placeholder="Execution logic..." />
                  </div>
               </div>
            </div>

            <div className="p-8 bg-slate-950/50 border-t border-slate-800 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
               <button onClick={handleSaveSignal} disabled={isSaving} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-900/30 flex items-center justify-center uppercase tracking-[0.2em] text-xs">
                 {isSaving ? <Loader2 className="animate-spin mr-3" size={18} /> : <CheckCircle2 size={18} className="mr-3" />}
                 Synchronize Feed
               </button>
               <button onClick={() => setEditingSignal(null)} className="px-10 py-4 bg-slate-800 text-slate-400 font-black rounded-2xl hover:bg-slate-700 transition-colors uppercase tracking-[0.1em] text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;