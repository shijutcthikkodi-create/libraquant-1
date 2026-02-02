import React, { useState, useMemo, useEffect } from 'react';
import { Menu, X, BarChart2, Radio, ShieldAlert, LogOut, FileText, User as UserIcon, Scale, Clock, CheckCircle, AlertCircle, EyeOff, ShieldCheck, List, TrendingUp, TrendingDown, BellRing, Zap, ArrowUpCircle, ExternalLink, Briefcase, BookOpen, Info, Flame } from 'lucide-react';
import { User, WatchlistItem } from '../types';
import { FOOTER_TEXT, BRANDING_TEXT } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
  watchlist?: WatchlistItem[];
  activeWatchlistAlerts?: Record<string, number>;
}

const GlobalWatchlist = ({ watchlist = [], activeWatchlistAlerts = {} }: { watchlist: WatchlistItem[], activeWatchlistAlerts: Record<string, number> }) => {
  const hasAlerts = Object.keys(activeWatchlistAlerts).length > 0;

  return (
    <div className={`flex flex-col h-full bg-slate-900 border-l border-slate-800 w-72 shrink-0 hidden lg:flex transition-all duration-500 ${hasAlerts ? 'ring-1 ring-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.1)]' : ''}`}>
      <div className={`p-2 border-b border-slate-800 flex items-center justify-between bg-slate-800/20 ${hasAlerts ? 'bg-blue-600/10' : ''}`}>
          <div className="flex items-center space-x-2">
              <List size={12} className={hasAlerts ? "text-white animate-pulse" : "text-blue-500"} />
              <h3 className="font-bold text-white text-[9px] uppercase tracking-widest">Market Watch</h3>
          </div>
          <div className="flex items-center">
            {hasAlerts && <BellRing size={8} className="text-blue-400 mr-2 animate-bounce" />}
            <span className={`w-1 h-1 rounded-full bg-emerald-500 mr-1 ${hasAlerts ? 'animate-ping' : 'animate-pulse'}`}></span>
            <span className="text-[7px] font-black text-emerald-500 uppercase tracking-tighter">Live</span>
          </div>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50 scrollbar-hide">
          {watchlist.map((item, idx) => {
              const isAlerting = !!activeWatchlistAlerts[item.symbol];
              return (
                <div key={idx} className={`px-3 py-1.5 flex items-center justify-between transition-all duration-200 relative ${isAlerting ? 'animate-box-glow bg-blue-500/20 z-10' : 'hover:bg-slate-800/30'}`}>
                    <div className="min-w-0">
                        <p className={`font-bold text-[10px] transition-colors truncate ${isAlerting ? 'text-white' : 'text-slate-300'}`}>{item.symbol}</p>
                        <span className="text-[7px] font-mono text-slate-600 block leading-none">{item.lastUpdated || '--'}</span>
                    </div>
                    <div className="text-right shrink-0">
                        <p className={`font-mono text-[11px] font-black transition-all leading-none mb-0.5 ${isAlerting ? 'text-white scale-110' : 'text-slate-100'}`}>
                          {Number(item.price || 0).toFixed(1)}
                        </p>
                        <div className="flex items-center justify-end leading-none">
                          {item.isPositive ? <TrendingUp size={8} className="text-emerald-500 mr-1" /> : <TrendingDown size={8} className="text-rose-500 mr-1" />}
                          <p className={`text-[8px] font-mono font-bold ${item.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {Number(item.change || 0).toFixed(1)}%
                          </p>
                        </div>
                    </div>
                </div>
              );
          })}
      </div>
    </div>
  );
};

const WatchlistAlertToast = ({ activeWatchlistAlerts = {}, watchlist = [] }: { activeWatchlistAlerts: Record<string, number>, watchlist: WatchlistItem[] }) => {
  const alertedSymbols = useMemo(() => {
    return Object.keys(activeWatchlistAlerts);
  }, [activeWatchlistAlerts]);

  if (alertedSymbols.length === 0) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[300] flex flex-col items-center space-y-1.5 pointer-events-none w-full max-w-[240px] px-2">
      {alertedSymbols.map(symbol => {
        const item = watchlist.find(i => i.symbol === symbol);
        return (
          <div key={symbol} className="bg-blue-600 text-white rounded-xl shadow-[0_8px_25px_rgba(37,99,235,0.4)] border border-white/20 px-3 py-1.5 flex items-center justify-between w-full animate-notification">
            <div className="flex items-center space-x-2">
              <div className="p-1 bg-white/20 rounded-md animate-pulse">
                <ArrowUpCircle size={14} />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black uppercase tracking-tight opacity-70">Watch Alert</span>
                <span className="text-[10px] font-black uppercase tracking-tighter truncate max-w-[80px]">{symbol}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-mono font-black">₹{Number(item?.price || 0).toFixed(1)}</span>
              <div className="flex items-center justify-end text-[7px] font-black">
                <Zap size={8} className="mr-0.5" /> <span>SYNC</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Watermark = ({ user }: { user: User }) => {
  const watermarkText = useMemo(() => {
    const safeId = (user.id || '').toUpperCase();
    const safePhone = user.phoneNumber || '';
    const safeName = (user.name || '').toUpperCase();
    return `${safeId} ${safePhone} ${safeName}`.trim();
  }, [user]);

  const svgDataUrl = useMemo(() => {
    const svg = `
      <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <text 
          x="50%" 
          y="50%" 
          font-family="JetBrains Mono, monospace" 
          font-size="28" 
          font-weight="900" 
          fill="white" 
          fill-opacity="0.1" 
          text-anchor="middle" 
          transform="rotate(-25, 300, 200)"
        >
          ${watermarkText}
        </text>
      </svg>
    `;
    return `url("data:image/svg+xml;base64,${btoa(svg)}")`;
  }, [watermarkText]);

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-[1000]" 
      style={{ backgroundImage: svgDataUrl, backgroundRepeat: 'repeat' }}
    />
  );
};

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, currentPage, onNavigate, watchlist = [], activeWatchlistAlerts = {} }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number, seconds: number, expired: boolean, soon: boolean, perpetual: boolean } | null>(null);

  useEffect(() => {
    const calculateTime = () => {
        const rawExpiry = String(user?.expiryDate || '').trim();
        if (!rawExpiry || rawExpiry.toLowerCase() === 'perpetual' || rawExpiry.toLowerCase() === 'admin') {
          setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false, soon: false, perpetual: true });
          return;
        }
        const parts = rawExpiry.includes('-') ? rawExpiry.split('-') : rawExpiry.split('/');
        let expiryStr = rawExpiry;
        if (parts[0].length === 2) expiryStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        const end = new Date(expiryStr);
        if (isNaN(end.getTime())) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false, soon: false, perpetual: true }); return; }
        end.setHours(23, 59, 59, 999);
        const now = new Date();
        const diff = end.getTime() - now.getTime();
        if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, soon: false, perpetual: false }); return; }
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds, expired: false, soon: days < 5, perpetual: false });
    };
    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [user?.expiryDate]);

  const hasGlobalWatchAlerts = Object.keys(activeWatchlistAlerts).length > 0;

  const NavItem = ({ page, icon: Icon, label, isNew }: { page: string; icon: any; label: string; isNew?: boolean }) => (
    <button
      onClick={() => { onNavigate(page); setIsSidebarOpen(false); }}
      className={`flex items-center w-full px-4 py-3 mb-2 rounded-lg transition-colors relative group ${
        currentPage === page ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon size={20} className="mr-3 shrink-0" />
      <span className="font-medium whitespace-nowrap">{label}</span>
      {isNew && (
        <span className="ml-auto px-1.5 py-0.5 rounded bg-rose-500 text-[8px] font-black text-white uppercase animate-pulse">New</span>
      )}
    </button>
  );

  const formatUnit = (n: number) => n.toString().padStart(2, '0');

  const CountdownBadge = () => {
    if (!timeLeft) return null;
    return (
      <div className={`flex items-center space-x-1.5 text-[9px] font-mono font-black px-2 py-1 rounded-md transition-all duration-300 ${
          timeLeft.perpetual ? 'bg-blue-900/20 text-blue-400 border border-blue-500/20' :
          timeLeft.expired ? 'bg-rose-950 text-rose-500 border border-rose-500/50' : 
          timeLeft.soon ? 'bg-rose-600 text-white border border-white/40 shadow-lg' : 
          'bg-emerald-900/20 text-emerald-400 border border-emerald-500/20'
      }`}>
          {timeLeft.perpetual ? <ShieldCheck size={10} /> : (timeLeft.soon || timeLeft.expired ? <AlertCircle size={10} /> : <Clock size={10} />)}
          <span className="uppercase tracking-tighter whitespace-nowrap">
            {timeLeft.perpetual ? 'UNLIMITED' : timeLeft.expired ? 'EXPIRED' : (timeLeft.soon ? `${timeLeft.days}D ${formatUnit(timeLeft.hours)}:${formatUnit(timeLeft.minutes)}:${formatUnit(timeLeft.seconds)}` : `${timeLeft.days} DAYS`)}
          </span>
      </div>
    );
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col md:flex-row relative overflow-hidden bg-slate-950">
      {user && <Watermark user={user} />}

      {/* GLOBAL TOAST NOTIFICATIONS */}
      <WatchlistAlertToast activeWatchlistAlerts={activeWatchlistAlerts} watchlist={watchlist} />

      {/* Global Market Watch Update Alert Bar */}
      {hasGlobalWatchAlerts && (
        <div className="fixed top-0 left-0 right-0 z-[200] h-1 bg-blue-500 animate-pulse shadow-[0_0_20px_rgba(59,130,246,1)]"></div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center z-50 shadow-xl flex-shrink-0 w-full">
        <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-pink-500 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-lg">
                <Scale size={18} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs text-white uppercase leading-none">LibraQuant</span>
              <div className="mt-1">
                 <CountdownBadge />
              </div>
            </div>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-slate-800 rounded-lg text-slate-300 relative active:scale-95 transition-transform">
          {hasGlobalWatchAlerts && <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-ping z-10"></span>}
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[35] md:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`fixed md:relative z-40 top-0 left-0 h-full w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} flex flex-col shadow-2xl flex-shrink-0`}>
        <div className="p-6 hidden md:flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-tr from-pink-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Scale size={22} strokeWidth={2.5} /></div>
          <div>
            <h1 className="font-bold text-xl text-white tracking-tight">LibraQuant</h1>
            <p className="text-[10px] text-purple-400 font-mono uppercase tracking-widest">Secure Terminal</p>
          </div>
        </div>
        
        {/* Mobile Sidebar Close Button */}
        <div className="md:hidden p-4 flex justify-end">
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 bg-slate-800 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 overflow-y-auto no-scrollbar pb-8">
          <NavItem page="dashboard" icon={Radio} label="Live Analysis Feed" />
          <NavItem page="insights" icon={Flame} label="Market Insights" isNew />
          <NavItem page="booked" icon={CheckCircle} label="Observed Outcomes" />
          <NavItem page="stats" icon={BarChart2} label="Performance Metrics" />
          <NavItem page="rules" icon={ShieldAlert} label="Rules & Disclaimer" />
          <NavItem page="about" icon={Info} label="About Us" />
          
          {/* DEMAT OPEN SECTION */}
          <div className="mt-6 px-1">
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-2xl p-4 shadow-xl group/demat">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover/demat:opacity-20 transition-opacity">
                      <Briefcase size={48} className="text-emerald-500" />
                  </div>
                  
                  <div className="relative z-10">
                      <div className="flex items-center space-x-2 mb-3">
                          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                              <ShieldCheck size={14} className="text-emerald-400" />
                          </div>
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Partner Gateway</span>
                      </div>
                      
                      <h4 className="text-[11px] font-black text-white leading-tight uppercase mb-3">
                        Unlock Institutional<br/><span className="text-emerald-400">Brokerage Tiers</span>
                      </h4>

                      <a 
                        href="https://oa.mynt.in/?ref=ZTN348" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between w-full px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-lg shadow-emerald-900/40 group/btn"
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest">Open Demat A/c</span>
                        <div className="bg-white/10 p-1 rounded-md group-hover/btn:bg-white/20 transition-colors">
                           <ExternalLink size={12} className="text-white" />
                        </div>
                      </a>
                  </div>
              </div>
          </div>

          {user?.isAdmin && <div className="mt-4 pt-4 border-t border-slate-800/50"><NavItem page="admin" icon={FileText} label="Admin Panel" /></div>}
        </nav>
        
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 mr-3 shrink-0"><UserIcon size={16} /></div>
            <div className="overflow-hidden w-full">
              <p className="text-xs font-bold text-white truncate uppercase">{user?.name}</p>
              <div className="mt-1"><CountdownBadge /></div>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center justify-center w-full py-2 px-4 rounded-lg bg-slate-800 text-slate-300 hover:bg-rose-900/30 hover:text-rose-400 transition-all text-[10px] font-bold uppercase tracking-widest active:scale-95"><LogOut size={12} className="mr-2" /> Sign Out</button>
        </div>
      </aside>

      <main className="flex-1 h-full overflow-hidden flex flex-col relative z-10 min-w-0">
        <div className="flex-1 flex overflow-hidden w-full h-full relative">
          <div id="app-main-container" className="flex-1 h-full overflow-y-auto bg-slate-950 scroll-smooth px-4 py-6 md:p-8 w-full no-scrollbar">
              <div className="max-w-5xl mx-auto pb-32 w-full">
                  {children}
              </div>
          </div>
          <GlobalWatchlist watchlist={watchlist} activeWatchlistAlerts={activeWatchlistAlerts} />
        </div>
        
        <div className="bg-slate-900/95 border-t border-slate-800 p-2 text-center w-full backdrop-blur-md z-[60] flex flex-col items-center justify-center space-y-1 shrink-0">
           <div className="text-[9px] text-slate-500 font-mono tracking-tight opacity-70 uppercase px-4 truncate max-w-full">{FOOTER_TEXT}</div>
           <div className="text-[10px] font-bold text-blue-500/90 tracking-[0.15em] font-mono leading-none pt-0.5 uppercase">{BRANDING_TEXT}</div>
        </div>
      </main>
    </div>
  );
};

export default Layout;