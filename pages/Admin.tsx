import React, { useState, useMemo } from 'react';
import { WatchlistItem, TradeSignal, OptionType, TradeStatus, User, LogEntry, ChatMessage } from '../types';
import { 
  Trash2, Edit2, Radio, UserCheck, RefreshCw, Search, 
  History, Zap, Loader2, Database,
  Plus, ArrowUpCircle, ArrowDownCircle, X, Database as DatabaseIcon,
  UserPlus, Shield, User as UserIcon, CheckCircle2, Eye, EyeOff,
  Key, TrendingUp, Send, MessageSquareCode, Radio as RadioIcon,
  Briefcase, Activity, Moon, MessageSquare, Check
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
  const [savingId, setSavingId] = useState<string | null>(null);
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
        details: `Updated info/password for ${editName}`,
        type: 'USER'
      });
      setEditingUser(null);
      if (onHardSync) onHardSync();
    }
    setIsSaving(false);
  };

  const handleResetDevice = async (userToReset: User) => {
    if (!window.confirm(`Clear Hardware Lock for ${userToReset.name}? User can bind next device on login.`)) return;
    setIsSaving(true);
    const updatedUser = { ...userToReset, deviceId: null, lastPassword: '' };
    const success = await updateSheetData('users', 'UPDATE_USER', updatedUser, userToReset.id);
    if (success) {
      await updateSheetData('logs', 'ADD', {
        timestamp: new Date().toISOString(),
        user: 'ADMIN',
        action: 'DEVICE_UNLOCKED',
        details: `Manual device reset for ${userToReset.name}`,
        type: 'SECURITY'
      });
      if (onHardSync) onHardSync();
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
        details: `New: ${newSignal.instrument} ${newSignal.symbol}`,
        type: 'TRADE'
      });
      setSigSymbol(''); setSigEntry(''); setSigSL(''); setSigTargets(''); setSigComment(''); setSigQty(''); setSigIsBtst(false);
      setIsAddingSignal(false);
      if (onHardSync) onHardSync();
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
        action: 'INTEL_BROADCAST',
        details: `Global broadcast posted.`,
        type: 'SYSTEM'
      });
      setIntelText('');
      if (onHardSync) onHardSync();
    }
    setIsSaving(false);
  };

  const triggerQuickUpdate = async (signal: TradeSignal, updates: Partial<TradeSignal>, actionLabel: string) => {
    setSavingId(signal.id);
    setIsSaving(true);
    
    const isClosing = updates.status && (
      updates.status === TradeStatus.EXITED || 
      updates.status === TradeStatus.STOPPED || 
      updates.status === TradeStatus.ALL_TARGET
    );
    
    const payload = { 
      ...signal, 
      ...updates, 
      ...(isClosing ? { lastTradedTimestamp: new Date().toISOString() } : {})
    };
    
    // Attempt update using both unique ID and sheetIndex for maximum reliability
    const success = await updateSheetData('signals', 'UPDATE_SIGNAL', payload, signal.id);
    
    if (success) {
      await updateSheetData('logs', 'ADD', {
        timestamp: new Date().toISOString(),
        user: 'ADMIN',
        action: `Trade ${actionLabel}`,
        details: `${signal.instrument}: ${updates.status || 'Updated'}`,
        type: 'TRADE'
      });
      if (onHardSync) await onHardSync();
    }
    setSavingId(null);
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
            <p className="text-slate-500 text-xs font-medium mt-1">Management Console</p>
        </div>
        <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 mt-4 md:mt-0 shadow-lg overflow-x-auto">
            {[
              { id: 'SIGNALS', icon: Radio, label: 'Signals' },
              { id: 'BROADCAST', icon: RadioIcon, label: 'Market Intelligence' },
              { id: 'CLIENTS', icon: UserIcon, label: 'Subscribers' },
              { id: 'LOGS', icon: History, label: 'Audit Trail' }
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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                    <div className="flex items-center">
                        <Plus size={18} className="mr-3 text-blue-500" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Broadcast Engine</h3>
                    </div>
                    {!isAddingSignal && (
                      <div className="flex space-x-2">
                        <button onClick={onHardSync} className="flex items-center px-4 py-2 rounded-lg bg-slate-800 text-blue-400 border border-blue-500/20 text-xs font-bold hover:bg-blue-500/10 transition-all">
                           <DatabaseIcon size={14} className="mr-2" />
                           Hard Sync
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
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-tighter">Instrument</label>
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
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-tighter">Strike / Symbol</label>
                                <input type="text" value={sigSymbol} onChange={e => setSigSymbol(e.target.value)} placeholder="e.g. 22500" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-tighter">Option Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['CE', 'PE', 'FUT'].map(t => (
                                        <button key={t} onClick={() => setSigType(t as any)} className={`py-2 text-xs font-bold rounded-lg border transition-all ${sigType === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-tighter">Action</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setSigAction('BUY')} className={`py-2 text-xs font-bold rounded-lg border transition-all ${sigAction === 'BUY' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>Buy</button>
                                    <button onClick={() => setSigAction('SELL')} className={`py-2 text-xs font-bold rounded-lg border transition-all ${sigAction === 'SELL' ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>Sell</button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-tighter">Entry Price</label>
                                <input type="number" value={sigEntry} onChange={e => setSigEntry(e.target.value)} placeholder="0.00" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-tighter">Stop Loss</label>
                                <input type="number" value={sigSL} onChange={e => setSigSL(e.target.value)} placeholder="0.00" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-tighter">Quantity</label>
                                <input type="number" value={sigQty} onChange={e => setSigQty(e.target.value)} placeholder="0" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                            <div className="md:col-span-1 flex flex-col justify-end pb-1">
                                <button 
                                  onClick={() => setSigIsBtst(!sigIsBtst)}
                                  className={`flex items-center justify-center space-x-2 py-2.5 rounded-xl border transition-all ${sigIsBtst ? 'bg-amber-500/20 border-amber-500 text-amber-500 shadow-lg shadow-amber-900/20' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                                >
                                  <Moon size={14} className={sigIsBtst ? 'animate-pulse' : ''} />
                                  <span className="text-[10px] font-black uppercase tracking-widest">BTST / Overnight</span>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-tighter">Targets (Separate with comma + space: ", ")</label>
                            <input type="text" value={sigTargets} onChange={e => setSigTargets(e.target.value)} placeholder="e.g. 120, 140, 180" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-mono" />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-tighter">Trade Comment / Intel</label>
                            <div className="relative">
                                <MessageSquare size={14} className="absolute left-3 top-3 text-slate-500" />
                                <input type="text" value={sigComment} onChange={e => setSigComment(e.target.value)} placeholder="e.g. Strong breakout above VWAP, keep trailing..." className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:border-blue-500 outline-none" />
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 pt-2">
                            <button 
                                onClick={handleAddSignal} 
                                disabled={isSaving || !sigSymbol || !sigEntry} 
                                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-4 rounded-xl text-sm font-bold transition-all shadow-xl flex items-center justify-center uppercase tracking-widest"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Zap size={16} className="mr-2" />}
                                {isSaving ? 'Dispatching...' : 'Broadcast Signal'}
                            </button>
                            <button onClick={() => setIsAddingSignal(false)} className="px-6 py-4 bg-slate-800 text-slate-400 rounded-xl hover:bg-slate-700 transition-colors font-bold text-sm uppercase tracking-tighter">Cancel</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-5 border-b border-slate-800 bg-slate-800/10 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Signals ({activeSignals.length})</h3>
                    {isSaving && <div className="flex items-center space-x-2 text-[10px] font-black text-blue-500 uppercase animate-pulse"><RefreshCw size={10} className="animate-spin" /> <span>Syncing Sheet...</span></div>}
                </div>

                <div className="p-5">
                    {activeSignals.length === 0 ? (
                        <div className="py-12 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                            <p className="text-slate-500 text-xs uppercase tracking-widest font-black">No Active Trades</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activeSignals.map((s) => (
                                <div key={s.id} className={`bg-slate-950/50 border rounded-2xl p-5 flex flex-col items-center justify-between gap-6 transition-all ${savingId === s.id ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-slate-800'}`}>
                                    <div className="flex flex-col lg:flex-row items-center justify-between w-full gap-6">
                                        <div className="flex items-center space-x-4 w-full lg:w-auto">
                                            <div className={`p-2 rounded-xl ${s.action === 'BUY' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'}`}>
                                                {s.action === 'BUY' ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
                                            </div>
                                            <div>
                                                <h4 className="font-mono font-bold text-white">{s.instrument} {s.symbol}</h4>
                                                <p className="text-[10px] text-slate-500 font-mono">Entry: ₹{s.entryPrice} | SL: ₹{s.stopLoss}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-end gap-3 w-full lg:w-auto">
                                            {/* Quantity Input */}
                                            <div className="flex items-center bg-slate-800 rounded-xl px-3 py-2 border border-slate-700">
                                                <Briefcase size={12} className="text-blue-400 mr-2" />
                                                <span className="text-[9px] font-black text-slate-500 uppercase mr-2">Qty:</span>
                                                <input 
                                                    key={`${s.id}-qty-${s.quantity}`}
                                                    type="number"
                                                    defaultValue={s.quantity ?? ''}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const val = e.currentTarget.value === '' ? 0 : parseInt(e.currentTarget.value);
                                                            if (val !== s.quantity) triggerQuickUpdate(s, { quantity: val }, "Qty Update");
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                        if (val !== s.quantity) {
                                                            triggerQuickUpdate(s, { quantity: val }, "Qty Update");
                                                        }
                                                    }}
                                                    placeholder="0"
                                                    className="bg-transparent text-[10px] font-mono font-bold text-blue-400 w-12 outline-none"
                                                />
                                            </div>

                                            {/* CMP Input */}
                                            <div className="flex items-center bg-slate-800 rounded-xl px-3 py-2 border border-slate-700">
                                                <Activity size={12} className="text-emerald-400 mr-2" />
                                                <span className="text-[9px] font-black text-slate-500 uppercase mr-2">CMP:</span>
                                                <input 
                                                    key={`${s.id}-cmp-${s.cmp}`}
                                                    type="number"
                                                    step="any"
                                                    defaultValue={s.cmp ?? ''}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const val = e.currentTarget.value === '' ? 0 : parseFloat(e.currentTarget.value);
                                                            if (val !== s.cmp) triggerQuickUpdate(s, { cmp: val }, "CMP Update");
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                        if (val !== s.cmp) {
                                                            triggerQuickUpdate(s, { cmp: val }, "CMP Update");
                                                        }
                                                    }}
                                                    placeholder="0.00"
                                                    className="bg-transparent text-[10px] font-mono font-bold text-emerald-400 w-16 outline-none"
                                                />
                                            </div>

                                            {/* Status Dropdown */}
                                            <div className="flex items-center bg-slate-800 rounded-xl px-3 py-2 border border-slate-700">
                                                <span className="text-[9px] font-black text-slate-500 uppercase mr-2">Status:</span>
                                                <select 
                                                    value={s.status} 
                                                    onChange={(e) => triggerQuickUpdate(s, { status: e.target.value as TradeStatus }, "Status Change")}
                                                    className="bg-transparent text-[10px] font-bold text-white outline-none cursor-pointer"
                                                >
                                                    {Object.values(TradeStatus).map(status => (
                                                        <option key={status} value={status} className="bg-slate-900">{status}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Targets Hit Control */}
                                            <div className="flex items-center bg-slate-800 rounded-xl px-3 py-2 border border-slate-700">
                                                <span className="text-[9px] font-black text-slate-500 uppercase mr-2">Hit:</span>
                                                <div className="flex space-x-1">
                                                    {[1, 2, 3].map(t => (
                                                        <button 
                                                            key={t}
                                                            onClick={() => triggerQuickUpdate(s, { targetsHit: t, status: TradeStatus.PARTIAL, comment: `Target ${t} Done!` }, `T${t} Hit`)}
                                                            className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black transition-all ${ (s.targetsHit || 0) >= t ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600' }`}
                                                        >
                                                            {t}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* TSL Editable Option */}
                                            <div className="flex items-center bg-slate-800 rounded-xl px-3 py-2 border border-slate-700">
                                                <span className="text-[9px] font-black text-slate-500 uppercase mr-2">TSL:</span>
                                                <input 
                                                    key={`${s.id}-tsl-${s.trailingSL}`}
                                                    type="number"
                                                    step="any"
                                                    defaultValue={s.trailingSL ?? ''}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const val = e.currentTarget.value === '' ? null : parseFloat(e.currentTarget.value);
                                                            if (val !== s.trailingSL) triggerQuickUpdate(s, { trailingSL: val }, "TSL Update");
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                                        if (val !== s.trailingSL) {
                                                            triggerQuickUpdate(s, { trailingSL: val }, "TSL Update");
                                                        }
                                                    }}
                                                    placeholder="None"
                                                    className="bg-transparent text-[10px] font-mono font-bold text-yellow-500 w-16 outline-none"
                                                />
                                            </div>

                                            {/* Quick Action Buttons */}
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => triggerQuickUpdate(s, { status: TradeStatus.ALL_TARGET, targetsHit: 3, comment: "Golden Trade! All targets hit." }, "All Done")}
                                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-900/40"
                                                >
                                                    All Done
                                                </button>
                                                <button 
                                                    onClick={() => triggerQuickUpdate(s, { status: TradeStatus.STOPPED, comment: "Stop Loss hit." }, "SL Hit")}
                                                    className="px-4 py-2 bg-rose-900/20 text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-black uppercase hover:bg-rose-500/10"
                                                >
                                                    SL Hit
                                                </button>
                                                <button 
                                                    onClick={() => triggerQuickUpdate(s, { status: TradeStatus.EXITED, comment: "Manual market exit." }, "Manual Exit")}
                                                    className="px-4 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-[10px] font-black uppercase hover:bg-slate-700"
                                                >
                                                    Exit
                                                </button>
                                            </div>
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
                    <h3 className="text-lg font-bold text-white uppercase tracking-tighter">Institutional Broadcast Feed</h3>
                </div>
                
                <div className="space-y-4">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Post Market Intelligence (Morning Posts, View Updates, Alerts)</p>
                    <textarea 
                        value={intelText}
                        onChange={(e) => setIntelText(e.target.value)}
                        placeholder="Type global broadcast message..."
                        className="w-full h-32 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-sm focus:border-blue-500 outline-none font-medium leading-relaxed"
                    />
                    <div className="flex justify-end">
                        <button 
                            onClick={handlePostIntel}
                            disabled={isSaving || !intelText.trim()}
                            className="flex items-center px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg disabled:opacity-50 uppercase tracking-widest"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Send size={16} className="mr-2" />}
                            Post Intelligence
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-5 border-b border-slate-800 bg-slate-800/10">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Previous Broadcasts</h3>
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
                    {adminMessages.length === 0 && (
                        <div className="p-10 text-center">
                            <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">No previous intel broadcasts</p>
                        </div>
                    )}
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
                  placeholder="Search subscribers..." 
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-white focus:border-blue-500 outline-none text-sm"
                />
              </div>
              <div className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-2xl flex items-center space-x-2">
                <UserIcon size={16} className="text-blue-500" />
                <span className="text-xs font-bold text-white">{filteredUsers.length} Subscribers</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/30 text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">
                      <th className="px-6 py-4">Subscriber</th>
                      <th className="px-6 py-4">Access Key</th>
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
                                <p className="text-sm font-bold text-white">{u.name || 'No Name'}</p>
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
                            <p className="text-[8px] text-slate-600 mt-1 uppercase font-bold tracking-tighter">Exp: {u.expiryDate || 'PERPETUAL'}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button onClick={() => handleEditUser(u)} title="Edit Subscriber" className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"><Edit2 size={14} /></button>
                              <button onClick={() => handleResetDevice(u)} title="Unlock Device" className={`p-2 rounded-lg transition-all ${u.deviceId ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-800 text-slate-600 opacity-50'}`} disabled={!u.deviceId}><RefreshCw size={14} /></button>
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

      {activeTab === 'LOGS' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-3.5 text-slate-500" size={18} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter logs..." 
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-white focus:border-blue-500 outline-none text-sm"
                />
              </div>
              <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 shadow-lg overflow-x-auto w-full sm:w-auto">
                {['ALL', 'SECURITY', 'TRADE', 'USER'].map((f) => (
                  <button 
                      key={f}
                      onClick={() => setLogFilter(f as any)}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${logFilter === f ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                      {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="divide-y divide-slate-800/50 max-h-[600px] overflow-y-auto">
                {filteredLogs.length === 0 ? (
                  <div className="py-20 text-center">
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest italic">No matching records found in audit trail</p>
                  </div>
                ) : (
                  filteredLogs.map((l, idx) => (
                    <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-800/20 transition-colors gap-3">
                      <div className="flex items-start space-x-4">
                        <div className={`mt-1 p-1.5 rounded-lg border ${getLogTypeColor(l.type)}`}>
                          {l.type === 'SECURITY' ? <Shield size={14} /> : l.type === 'TRADE' ? <TrendingUp size={14} /> : <UserPlus size={14} />}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 mb-0.5">
                            <span className="text-[11px] font-black text-white uppercase tracking-tighter">{l.action}</span>
                            <span className="text-[9px] font-mono text-slate-600">{new Date(l.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-slate-400 font-medium">{l.details}</p>
                        </div>
                      </div>
                      <div className="sm:text-right">
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{l.user}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center">
                <Edit2 size={18} className="mr-3 text-blue-500" />
                Edit Subscriber
              </h3>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
               <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Full Name</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:border-blue-500 outline-none" />
               </div>
               <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Phone Number</label>
                  <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:border-blue-500 outline-none" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Access Key (Password)</label>
                    <div className="relative">
                        <input 
                            type={showEditPassword ? "text" : "password"} 
                            value={editPassword} 
                            onChange={e => setEditPassword(e.target.value)} 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-white text-sm focus:border-blue-500 outline-none font-mono" 
                        />
                        <button 
                            type="button"
                            onClick={() => setShowEditPassword(!showEditPassword)}
                            className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Expiry Date (YYYY-MM-DD)</label>
                    <input type="text" value={editExpiry} onChange={e => setEditExpiry(e.target.value)} placeholder="YYYY-MM-DD" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:border-blue-500 outline-none font-mono" />
                  </div>
               </div>
               <p className="text-[9px] text-amber-500 font-bold uppercase leading-relaxed italic">
                 Note: Changing the Access Key will automatically clear the hardware lock on the user's next login attempt.
               </p>
            </div>
            <div className="p-6 bg-slate-950/50 border-t border-slate-800 flex space-x-3">
               <button onClick={handleSaveUser} disabled={isSaving} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center">
                 {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : <CheckCircle2 size={16} className="mr-2" />}
                 {isSaving ? 'Updating...' : 'Save Changes'}
               </button>
               <button onClick={() => setEditingUser(null)} className="px-6 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl hover:bg-slate-700 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;