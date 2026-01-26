
import React, { useState, useMemo, useEffect } from 'react';
import { TradeSignal, TradeStatus, User, LogEntry, ChatMessage, WatchlistItem } from '../types';
import { 
  Zap, Loader2, Power, Briefcase, Activity, Moon, ShieldCheck, 
  RefreshCw, MessageSquareCode, Send, Users, ShieldAlert, Clock,
  Search, Edit3, Check, X, Calendar, Key, Shield, RotateCcw, Smartphone,
  Edit, UserCircle, Eye, EyeOff
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

const Admin: React.FC<AdminProps> = ({ signals = [], messages = [], users = [], logs = [], onHardSync }) => {
  const [activeTab, setActiveTab] = useState<'SIGNALS' | 'BROADCAST' | 'USERS' | 'LOGS'>('SIGNALS');
  const [isSaving, setIsSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Search/Filter states
  const [userSearch, setUserSearch] = useState('');

  // Editing state for users
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState<Partial<User>>({});

  // Minimalist New Signal Form State
  const [sigInstrument, setSigInstrument] = useState('NIFTY');
  const [customStockName, setCustomStockName] = useState('');
  const [sigSymbol, setSigSymbol] = useState('');
  const [sigType, setSigType] = useState('CE'); 
  const [sigAction, setSigAction] = useState<'BUY' | 'SELL'>('BUY');
  const [sigEntry, setSigEntry] = useState('');
  const [sigIsBtst, setSigIsBtst] = useState(false);
  const [sigQty, setSigQty] = useState('');

  // Intel/Broadcast State
  const [intelText, setIntelText] = useState('');
  const [broadcasterName, setBroadcasterName] = useState(() => {
    return localStorage.getItem('libra_broadcaster_name') || 'Shiju Prasannan TC';
  });
  const [showBroadcasterName, setShowBroadcasterName] = useState(() => {
    return localStorage.getItem('libra_show_broadcaster') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('libra_broadcaster_name', broadcasterName);
    localStorage.setItem('libra_show_broadcaster', String(showBroadcasterName));
  }, [broadcasterName, showBroadcasterName]);

  const activeSignals = useMemo(() => {
    return (signals || []).filter(s => s.status === TradeStatus.ACTIVE || s.status === TradeStatus.PARTIAL);
  }, [signals]);

  const filteredUsers = useMemo(() => {
    let list = users;
    if (userSearch) {
      const s = userSearch.toLowerCase();
      list = users.filter(u => 
        u.name.toLowerCase().includes(s) || 
        u.phoneNumber.includes(s)
      );
    }
    return list;
  }, [users, userSearch]);

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs]);

  const getExpiryStatus = (expiryStr: string) => {
    if (!expiryStr || expiryStr.toUpperCase() === 'PERPETUAL' || expiryStr.toUpperCase() === 'ADMIN') return 'SAFE';
    try {
      let dStr = expiryStr;
      const parts = expiryStr.split(/[-/]/);
      if (parts.length === 3 && parts[0].length === 2) dStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
      const expiry = new Date(dStr);
      expiry.setHours(23, 59, 59, 999);
      const now = new Date();
      if (isNaN(expiry.getTime())) return 'SAFE';
      if (expiry < now) return 'EXPIRED';
      const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= 5) return 'SOON';
      return 'SAFE';
    } catch (e) { return 'SAFE'; }
  };

  const handleAddSignal = async () => {
    if (!sigSymbol || !sigEntry) return;
    setIsSaving(true);
    
    const finalInstrument = (sigInstrument === 'STOCKS' && customStockName.trim()) 
      ? customStockName.trim().toUpperCase() 
      : sigInstrument;

    const newSignal: any = {
        id: `SIG-${Date.now()}`,
        instrument: finalInstrument,
        symbol: sigSymbol,
        type: sigType,
        action: sigAction,
        entryPrice: parseFloat(sigEntry),
        quantity: sigQty ? parseInt(sigQty) : "",
        isBTST: sigIsBtst,
        timestamp: new Date().toISOString()
    };

    const success = await updateSheetData('signals', 'ADD', newSignal);
    
    if (success) {
      setSigSymbol(''); setSigEntry(''); setSigQty(''); setSigIsBtst(false); setCustomStockName('');
      if (onHardSync) await onHardSync();
    }
    setIsSaving(false);
  };

  const handleUrgentExit = async (signal: TradeSignal) => {
    if (!window.confirm(`Confirm URGENT EXIT for ${signal.instrument} ${signal.symbol}?`)) return;
    setSavingId(signal.id);
    setIsSaving(true);
    
    const payload = { 
      id: signal.id,
      instrument: signal.instrument,
      symbol: signal.symbol,
      status: TradeStatus.EXITED,
      "exit input": "EXIT_NOW", 
      lastTradedTimestamp: new Date().toISOString(),
      sheetIndex: (signal as any).sheetIndex
    };
    
    const success = await updateSheetData('signals', 'UPDATE_SIGNAL', payload, signal.id);
    
    if (success && onHardSync) {
      setTimeout(async () => {
        await onHardSync();
        setSavingId(null);
        setIsSaving(false);
      }, 1500);
    } else {
      setSavingId(null);
      setIsSaving(false);
    }
  };

  const handlePostIntel = async () => {
    if (!intelText.trim()) return;
    setIsSaving(true);
    const success = await updateSheetData('messages', 'ADD', {
      id: `msg-${Date.now()}`,
      text: intelText.trim(),
      timestamp: new Date().toISOString(),
      isAdminReply: true,
      userId: 'ADMIN',
      broadcaster: showBroadcasterName ? broadcasterName.trim() : ''
    });
    if (success) {
      setIntelText('');
      if (onHardSync) await onHardSync();
    }
    setIsSaving(false);
  };

  const startEditingUser = (u: User) => {
    setEditingUserId(u.id);
    setEditUserForm({ ...u });
  };

  const cancelEditingUser = () => {
    setEditingUserId(null);
    setEditUserForm({});
  };

  const saveUserUpdate = async (userId: string) => {
    setIsSaving(true);
    setSavingId(userId);
    
    const payload = {
      id: userId,
      name: editUserForm.name,
      phoneNumber: editUserForm.phoneNumber,
      expiryDate: editUserForm.expiryDate,
      isAdmin: editUserForm.isAdmin,
      password: editUserForm.password
    };

    const success = await updateSheetData('users', 'UPDATE_USER', payload, userId);
    
    if (success) {
      setEditingUserId(null);
      if (onHardSync) await onHardSync();
    }
    setSavingId(null);
    setIsSaving(false);
  };

  const handleResetHWID = async (user: User) => {
    if (!window.confirm(`RESET device lock for ${user.name}? This will allow login from any new device.`)) return;
    setIsSaving(true);
    setSavingId(user.id);
    
    const payload = {
        id: user.id,
        deviceId: "" 
    };
    
    const success = await updateSheetData('users', 'UPDATE_USER', payload, user.id);
    
    if (success && onHardSync) {
      await onHardSync();
    }
    setSavingId(null);
    setIsSaving(false);
  };

  return (
    <div className="max-w-7xl mx-auto pb-32 px-2 sm:px-4 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">Terminal Command</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Superuser Administrative Access</p>
          </div>
          <button onClick={onHardSync} className="flex items-center space-x-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-black text-blue-500 uppercase tracking-widest hover:bg-slate-800 transition-colors">
              <RefreshCw size={14} className={isSaving ? 'animate-spin' : ''} />
              <span>Force Global Sync</span>
          </button>
        </div>

        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-2xl shadow-2xl overflow-x-auto no-scrollbar">
            {[
                { id: 'SIGNALS', icon: Zap, label: 'Execution' },
                { id: 'BROADCAST', icon: MessageSquareCode, label: 'Alpha' },
                { id: 'USERS', icon: Users, label: 'Subscribers' },
                { id: 'LOGS', icon: ShieldAlert, label: 'Audit' }
            ].map(tab => (
                <button 
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id as any); setEditingUserId(null); }}
                    className={`flex items-center px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <tab.icon size={14} className="mr-2" />
                    {tab.label}
                </button>
            ))}
        </div>
      </div>

      {activeTab === 'SIGNALS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-2">
            <div className="lg:col-span-5 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-slate-800 bg-slate-800/20 flex items-center">
                        <Zap size={18} className="mr-3 text-blue-500" />
                        <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">New Execution Order</h3>
                    </div>
                    <div className="p-6 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-1">
                                <label className="block text-[9px] font-black text-slate-500 mb-1.5 uppercase tracking-widest">Instrument</label>
                                <select value={sigInstrument} onChange={e => { setSigInstrument(e.target.value); if (e.target.value !== 'STOCKS') setCustomStockName(''); }} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none font-bold">
                                    <option value="NIFTY">NIFTY</option>
                                    <option value="BANKNIFTY">BANKNIFTY</option>
                                    <option value="FINNIFTY">FINNIFTY</option>
                                    <option value="MIDCPNIFTY">MIDCPNIFTY</option>
                                    <option value="SENSEX">SENSEX</option>
                                    <option value="STOCKS">STOCKS (MANUAL)</option>
                                </select>
                                {sigInstrument === 'STOCKS' && (
                                  <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-300">
                                    <label className="block text-[8px] font-black text-blue-500 mb-1 uppercase tracking-widest flex items-center">
                                      <Edit size={10} className="mr-1" /> Custom Stock Name
                                    </label>
                                    <input 
                                      type="text" 
                                      value={customStockName} 
                                      onChange={e => setCustomStockName(e.target.value)} 
                                      placeholder="e.g. RELIANCE" 
                                      className="w-full bg-slate-950 border border-blue-500/50 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none font-black tracking-widest" 
                                    />
                                  </div>
                                )}
                            </div>
                            <div className="col-span-1">
                                <label className="block text-[9px] font-black text-slate-500 mb-1.5 uppercase tracking-widest">Symbol</label>
                                <input type="text" value={sigSymbol} onChange={e => setSigSymbol(e.target.value)} placeholder="e.g. 24500" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none font-mono font-bold" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-1">
                                <label className="block text-[9px] font-black text-slate-500 mb-1.5 uppercase tracking-widest">Type (e.g. CE JAN 27)</label>
                                <input type="text" value={sigType} onChange={e => setSigType(e.target.value)} placeholder="CE / PE / FUT" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none font-mono font-bold" />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-[9px] font-black text-slate-500 mb-1.5 uppercase tracking-widest">Action</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setSigAction('BUY')} className={`py-3 text-[10px] font-black rounded-xl border transition-all ${sigAction === 'BUY' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>BUY</button>
                                    <button onClick={() => setSigAction('SELL')} className={`py-3 text-[10px] font-black rounded-xl border transition-all ${sigAction === 'SELL' ? 'bg-rose-600 border-rose-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>SELL</button>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 mb-1.5 uppercase tracking-widest">Entry Price</label>
                                <input type="number" value={sigEntry} onChange={e => setSigEntry(e.target.value)} placeholder="0.00" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none font-mono font-bold" />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 mb-1.5 uppercase tracking-widest">Quantity</label>
                                <input type="number" value={sigQty} onChange={e => setSigQty(e.target.value)} placeholder="Size" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none font-mono font-bold" />
                            </div>
                        </div>
                        <button onClick={() => setSigIsBtst(!sigIsBtst)} className={`w-full py-3 rounded-xl border transition-all flex items-center justify-center space-x-2 ${sigIsBtst ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>
                            <Moon size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">BTST Toggle</span>
                        </button>
                        <button onClick={handleAddSignal} disabled={isSaving || !sigSymbol || !sigEntry || (sigInstrument === 'STOCKS' && !customStockName.trim())} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-4 rounded-2xl text-[11px] font-black transition-all shadow-xl shadow-blue-900/40 uppercase tracking-[0.2em] flex items-center justify-center">
                            {isSaving ? <Loader2 size={16} className="animate-spin mr-3" /> : <ShieldCheck size={16} className="mr-3" />} Broadcast Signal
                        </button>
                    </div>
                </div>
            </div>
            <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center px-1">
                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center">
                        <Activity size={14} className="mr-2 text-emerald-500" /> Active Terminal Risk ({activeSignals.length})
                    </h3>
                </div>
                {activeSignals.length === 0 ? (
                    <div className="py-20 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl">
                        <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] italic">Zero active risk</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {activeSignals.map(s => (
                            <div key={s.id} className={`bg-slate-900 border ${savingId === s.id ? 'border-blue-500' : 'border-slate-800'} p-4 rounded-3xl shadow-xl flex items-center justify-between transition-all`}>
                                <div className="flex items-center space-x-4">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${s.action === 'BUY' ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400' : 'bg-rose-900/20 border-rose-500/30 text-rose-400'}`}>
                                        <Briefcase size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-white font-mono leading-none uppercase">{s.instrument} {s.symbol} {s.type}</h4>
                                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter mt-1">@ ₹{s.entryPrice} • QTY: {s.quantity || '1'}</p>
                                    </div>
                                </div>
                                <button onClick={() => handleUrgentExit(s)} disabled={isSaving} className="px-8 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-rose-900/40">
                                    {savingId === s.id ? <Loader2 size={14} className="animate-spin mr-2" /> : <Power size={14} className="mr-2" />} URGENT EXIT
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      )}

      {activeTab === 'BROADCAST' && (
        <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-bottom-2">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center space-x-3 mb-6">
                    <MessageSquareCode className="text-blue-500" size={24} />
                    <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Broadcast Market Intel</h3>
                </div>

                <div className="space-y-4">
                    <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">Admin Broadcaster Name</label>
                                <button 
                                  onClick={() => setShowBroadcasterName(!showBroadcasterName)}
                                  className={`flex items-center space-x-1.5 px-2 py-1 rounded-lg transition-colors ${showBroadcasterName ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 bg-slate-800'}`}
                                >
                                    {showBroadcasterName ? <Eye size={12} /> : <EyeOff size={12} />}
                                    <span className="text-[9px] font-black uppercase tracking-tighter">{showBroadcasterName ? 'VISIBLE' : 'HIDDEN'}</span>
                                </button>
                            </div>
                            <div className={`relative group transition-opacity duration-300 ${showBroadcasterName ? 'opacity-100' : 'opacity-40'}`}>
                                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={16} />
                                <input 
                                    type="text" 
                                    value={broadcasterName} 
                                    onChange={e => setBroadcasterName(e.target.value)} 
                                    placeholder="e.g. Shiju Prasannan TC" 
                                    disabled={!showBroadcasterName}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs text-white focus:border-blue-500 outline-none font-black tracking-widest disabled:cursor-not-allowed" 
                                />
                            </div>
                        </div>
                    </div>

                    <textarea 
                        value={intelText} 
                        onChange={e => setIntelText(e.target.value)} 
                        placeholder="Push global intel..." 
                        className="w-full h-32 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-sm focus:border-blue-500 outline-none font-bold mb-4" 
                    />
                    
                    <button onClick={handlePostIntel} disabled={isSaving || !intelText.trim() || (showBroadcasterName && !broadcasterName.trim())} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-900/40 flex items-center justify-center">
                        {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Send size={16} className="mr-2" />} Push Intel
                    </button>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'USERS' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center">
                    <Users size={14} className="mr-2 text-blue-500" /> Institutional Subscriber List ({users.length})
                </h3>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                    <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search by name or phone..." className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-[10px] text-white focus:border-blue-500 outline-none font-bold placeholder:text-slate-700" />
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="bg-slate-950/50 border-b border-slate-800">
                                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Subscriber Details</th>
                                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Access Expiry</th>
                                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Access Key</th>
                                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Hardware Lock</th>
                                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filteredUsers.map(u => {
                                const isEditing = editingUserId === u.id;
                                const status = getExpiryStatus(u.expiryDate);
                                const isSavingUser = savingId === u.id;

                                if (isEditing) {
                                    return (
                                        <tr key={u.id} className="bg-blue-600/5 transition-colors">
                                            <td className="px-6 py-4 space-y-2">
                                                <input type="text" value={editUserForm.name} onChange={e => setEditUserForm({...editUserForm, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 font-bold" placeholder="Full Name" />
                                                <input type="text" value={editUserForm.phoneNumber} onChange={e => setEditUserForm({...editUserForm, phoneNumber: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 font-mono" placeholder="Phone Number" />
                                            </td>
                                            <td className="px-6 py-4">
                                                <input type="text" value={editUserForm.expiryDate} onChange={e => setEditUserForm({...editUserForm, expiryDate: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 font-mono" placeholder="DD-MM-YYYY" />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col space-y-2">
                                                    <input type="text" value={editUserForm.password} onChange={e => setEditUserForm({...editUserForm, password: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 font-mono" placeholder="Access Key" />
                                                    <div className="flex items-center space-x-2">
                                                        <input type="checkbox" id={`edit-admin-${u.id}`} checked={editUserForm.isAdmin} onChange={e => setEditUserForm({...editUserForm, isAdmin: e.target.checked})} className="w-4 h-4 rounded border-slate-700 bg-slate-950 accent-blue-600" />
                                                        <label htmlFor={`edit-admin-${u.id}`} className="text-[9px] font-black text-slate-500 uppercase tracking-widest cursor-pointer">Admin Access</label>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center space-x-2">
                                                    <button onClick={() => saveUserUpdate(u.id)} disabled={isSaving} className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg transition-all active:scale-95">
                                                        {isSavingUser ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                    </button>
                                                    <button onClick={cancelEditingUser} disabled={isSaving} className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }

                                return (
                                    <tr key={u.id} className={`hover:bg-slate-800/30 transition-colors ${status === 'EXPIRED' ? 'bg-rose-950/10' : status === 'SOON' ? 'bg-amber-950/10' : ''}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 font-black border border-slate-700">
                                                    {u.name.substring(0, 1).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="flex items-center space-x-2">
                                                        <span className="text-sm font-black text-white uppercase tracking-tight">{u.name}</span>
                                                        {u.isAdmin && <Shield size={10} className="text-purple-400" />}
                                                    </div>
                                                    <span className="text-[10px] font-bold font-mono text-slate-500">{u.phoneNumber}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className={`text-xs font-mono font-black ${status === 'EXPIRED' ? 'text-rose-500' : status === 'SOON' ? 'text-amber-500' : 'text-slate-300'}`}>
                                                    {u.expiryDate}
                                                </span>
                                                <span className={`text-[8px] font-black uppercase tracking-widest ${status === 'EXPIRED' ? 'text-rose-600' : status === 'SOON' ? 'text-amber-600' : 'text-slate-600'}`}>
                                                    {status === 'EXPIRED' ? 'EXPIRED' : status === 'SOON' ? 'EXPIRING SOON' : 'ACTIVE'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-2">
                                                <Key size={12} className="text-slate-700" />
                                                <span className="text-xs font-mono font-black text-slate-400 tracking-widest uppercase">{u.password || '----'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-between group/hwid">
                                                <div className="flex items-center space-x-2">
                                                    <Smartphone size={12} className={u.deviceId ? 'text-blue-500' : 'text-slate-700'} />
                                                    <span className={`text-[10px] font-mono font-bold uppercase truncate max-w-[100px] ${u.deviceId ? 'text-slate-300' : 'text-slate-700 italic'}`}>
                                                        {u.deviceId ? u.deviceId.substring(0, 10) + '...' : 'Unbound'}
                                                    </span>
                                                </div>
                                                {u.deviceId && (
                                                    <button 
                                                        onClick={() => handleResetHWID(u)}
                                                        disabled={isSaving}
                                                        className="p-1.5 bg-slate-800 text-slate-500 hover:text-amber-500 rounded-lg opacity-0 group-hover/hwid:opacity-100 transition-all border border-transparent hover:border-amber-500/20"
                                                        title="Reset Device Lock"
                                                    >
                                                        <RotateCcw size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => startEditingUser(u)} className="p-2.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all active:scale-95" title="Edit Subscriber">
                                                <Edit3 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredUsers.length === 0 && (
                    <div className="p-20 text-center bg-slate-900/20">
                        <Users size={40} className="mx-auto text-slate-800 mb-4 opacity-30" />
                        <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] italic">No matching subscribers</p>
                    </div>
                )}
            </div>
        </div>
      )}

      {activeTab === 'LOGS' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center">
                    <ShieldAlert size={14} className="mr-2 text-rose-500" /> Terminal Audit Logs
                </h3>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl divide-y divide-slate-800">
                {sortedLogs.length === 0 ? (
                    <div className="p-10 text-center text-slate-600 text-[10px] font-black uppercase tracking-widest italic">No archived events</div>
                ) : (
                    sortedLogs.map((log, idx) => (
                        <div key={idx} className="p-5 hover:bg-slate-800/20 transition-colors group">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                <div className="flex items-center space-x-3">
                                    <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                                        log.type === 'SECURITY' ? 'bg-rose-950/20 border-rose-500/30 text-rose-400' :
                                        log.type === 'TRADE' ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400' :
                                        'bg-blue-900/20 border-blue-500/30 text-blue-400'
                                    }`}>
                                        {log.type}
                                    </div>
                                    <span className="text-[10px] font-black text-white uppercase tracking-tight">{log.user}</span>
                                </div>
                                <div className="flex items-center text-[9px] font-mono text-slate-600 font-bold uppercase">
                                    <Clock size={10} className="mr-1.5" /> {new Date(log.timestamp).toLocaleString()}
                                </div>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{log.action}</span>
                                <p className="text-xs text-slate-400 font-medium italic">"{log.details}"</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
