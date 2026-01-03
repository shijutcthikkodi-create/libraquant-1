import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Stats from './pages/Stats';
import Rules from './pages/Rules';
import About from './pages/About';
import Admin from './pages/Admin';
import BookedTrades from './pages/BookedTrades';
import { User, WatchlistItem, TradeSignal, TradeStatus, LogEntry, ChatMessage } from './types';
import { fetchSheetData, updateSheetData } from './services/googleSheetsService';
import { Radio, CheckCircle, BarChart2, Volume2, VolumeX, Database, Zap, BookOpen, Briefcase, ExternalLink, MessageCircle } from 'lucide-react';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; 
const SESSION_KEY = 'libra_user_session';
const POLL_INTERVAL = 8000; 
const MAJOR_ALERT_DURATION = 5000; 

export type GranularHighlights = Record<string, Set<string>>;

const ALERT_TRIGGER_KEYS: Array<keyof TradeSignal> = [
  'instrument', 'symbol', 'type', 'action', 'entryPrice', 
  'stopLoss', 'targets', 'status', 'targetsHit', 'isBTST', 'trailingSL', 'cmp', 'comment'
];

const ALL_SIGNAL_KEYS: Array<keyof TradeSignal> = [
  ...ALERT_TRIGGER_KEYS, 'pnlPoints', 'pnlRupees', 'quantity'
];

const WhatsAppLogo = ({ size = 24 }: { size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .01 5.403.006 12.039c0 2.12.556 4.189 1.613 6.007L0 24l6.117-1.605a11.803 11.803 0 005.925 1.577h.005c6.632 0 12.032-5.403 12.037-12.039a11.799 11.799 0 00-3.51-8.514z"/>
  </svg>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const { user, timestamp } = JSON.parse(saved);
        if (Date.now() - timestamp < SESSION_DURATION_MS) return user;
      } catch (e) { 
        localStorage.removeItem(SESSION_KEY); 
      }
    }
    return null;
  });

  const [page, setPage] = useState('dashboard');
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [historySignals, setHistorySignals] = useState<TradeSignal[]>([]); 
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'syncing'>('syncing');
  const [lastSyncTime, setLastSyncTime] = useState<string>('--:--:--');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('libra_sound_enabled') === 'true');
  const [audioInitialized, setAudioInitialized] = useState(false);
  
  const [activeMajorAlerts, setActiveMajorAlerts] = useState<Record<string, number>>({});
  const [activeWatchlistAlerts, setActiveWatchlistAlerts] = useState<Record<string, number>>({});
  const [granularHighlights, setGranularHighlights] = useState<GranularHighlights>({});
  
  const prevSignalsRef = useRef<TradeSignal[]>([]);
  const prevWatchlistRef = useRef<WatchlistItem[]>([]);
  const prevMessagesRef = useRef<ChatMessage[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeOscillatorRef = useRef<OscillatorNode | null>(null);
  const activeGainRef = useRef<GainNode | null>(null);
  
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef(false);

  const initAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      setAudioInitialized(true);
    } catch (e) {
      console.error("Audio init failed", e);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('touchstart', initAudio, { once: true });
    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('touchstart', initAudio);
    };
  }, [initAudio]);

  const handleRedirectToCard = useCallback((id: string) => {
    setPage('dashboard');
    const scrollTask = () => {
      const el = document.getElementById(`signal-${id}`);
      const container = document.getElementById('app-main-container');
      if (el && container) {
        const offset = 80; 
        const elementPosition = el.getBoundingClientRect().top;
        const offsetPosition = elementPosition + container.scrollTop - offset;
        container.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      }
    };
    setTimeout(scrollTask, 350);
  }, []);

  const stopAlertAudio = useCallback(() => {
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
      alertTimeoutRef.current = null;
    }
    if (activeOscillatorRef.current) {
      try { 
        activeOscillatorRef.current.stop(); 
        activeOscillatorRef.current.disconnect(); 
      } catch (e) {}
      activeOscillatorRef.current = null;
    }
    if (activeGainRef.current) {
      try { activeGainRef.current.disconnect(); } catch (e) {}
      activeGainRef.current = null;
    }
  }, []);

  const playUpdateBlip = useCallback(() => {
    if (!soundEnabled || !audioInitialized) return;
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      
      const playTone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur + 0.05);
      };

      // Distinct institutional ping sequence
      playTone(2200, 0, 0.08);
      playTone(1800, 0.06, 0.12);
    } catch (e) {}
  }, [soundEnabled, audioInitialized]);

  const playLongBeep = useCallback((isCritical = false, isBTST = false) => {
    if (!soundEnabled || !audioInitialized) return;
    stopAlertAudio();
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const baseFreq = isBTST ? 980 : (isCritical ? 440 : 880);
      osc.type = (isBTST || isCritical) ? 'square' : 'sine';
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.1); 
      gain.gain.setValueAtTime(0.15, now + 1.9);
      gain.gain.linearRampToValueAtTime(0, now + 2.0); 
      const secondStart = now + 5.0;
      gain.gain.setValueAtTime(0, secondStart);
      gain.gain.linearRampToValueAtTime(0.15, secondStart + 0.1); 
      gain.gain.setValueAtTime(0.15, secondStart + 1.9);
      gain.gain.linearRampToValueAtTime(0, secondStart + 2.0); 
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      activeOscillatorRef.current = osc;
      activeGainRef.current = gain;
      alertTimeoutRef.current = setTimeout(() => stopAlertAudio(), MAJOR_ALERT_DURATION);
    } catch (e) {
      console.error("Audio Playback Failed", e);
    }
  }, [soundEnabled, audioInitialized, stopAlertAudio]);

  const sync = useCallback(async (isInitial = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setConnectionStatus('syncing');
    
    try {
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
      
      const data = await fetchSheetData();
      if (data) {
        let signalChangeDetected = false;
        let watchChangeDetected = false;
        let intelChangeDetected = false;
        let isCriticalAlert = false;
        let isBTSTUpdate = false;
        let targetSid: string | null = null;
        let topIndex = -1;
        
        const now = Date.now();
        const expirationTime = now + MAJOR_ALERT_DURATION;

        setActiveMajorAlerts(prevMajor => {
          const nextMajor = { ...prevMajor };
          setActiveWatchlistAlerts(prevWatch => {
            const nextWatch = { ...prevWatch };
            setGranularHighlights(prevHighs => {
              const nextHighs = { ...prevHighs };

              data.signals.forEach(s => {
                const sid = s.id;
                const old = prevSignalsRef.current.find(o => o.id === sid);
                const diff = new Set<string>();
                let majorUpdateFound = false;

                if (!old) {
                  if (!isInitial && prevSignalsRef.current.length > 0) {
                    ALL_SIGNAL_KEYS.forEach(k => diff.add(k));
                    majorUpdateFound = signalChangeDetected = true;
                  }
                } else {
                  ALL_SIGNAL_KEYS.forEach(k => {
                    const newVal = s[k];
                    const oldVal = old[k];
                    if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
                      diff.add(k);
                      if (ALERT_TRIGGER_KEYS.includes(k)) {
                         majorUpdateFound = signalChangeDetected = true;
                         if (k === 'status' && (s.status === TradeStatus.STOPPED || s.status === TradeStatus.EXITED || s.status === TradeStatus.ALL_TARGET)) {
                            isCriticalAlert = true;
                         }
                      }
                    }
                  });
                }

                if (majorUpdateFound) {
                  nextMajor[sid] = expirationTime;
                  if (s.sheetIndex > topIndex) { topIndex = s.sheetIndex; targetSid = sid; }
                  if (s.isBTST && (s.status === TradeStatus.ACTIVE || s.status === TradeStatus.PARTIAL)) isBTSTUpdate = true;
                }
                
                if (diff.size > 0) {
                  nextHighs[sid] = diff;
                  nextMajor[sid] = expirationTime;
                }
              });

              data.watchlist.forEach(w => {
                const old = prevWatchlistRef.current.find(o => o.symbol === w.symbol);
                const isNew = !old && prevWatchlistRef.current.length > 0;
                const isPriceChanged = old && Number(w.price) !== Number(old.price);

                if (!isInitial && (isNew || isPriceChanged)) {
                  watchChangeDetected = true;
                  nextWatch[w.symbol] = expirationTime;
                }
              });

              return nextHighs;
            });
            return nextWatch;
          });
          return nextMajor;
        });

        // Detect new Admin Broadcasts (Intelligence)
        if (!isInitial && data.messages.length > 0) {
          const latestAdminMsg = data.messages.filter(m => m.isAdminReply).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
          const prevAdminMsg = prevMessagesRef.current.filter(m => m.isAdminReply).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
          
          if (latestAdminMsg && (!prevAdminMsg || latestAdminMsg.id !== prevAdminMsg.id)) {
            intelChangeDetected = true;
          }
        }

        if (!isInitial) {
           if (signalChangeDetected) {
             playLongBeep(isCriticalAlert, isBTSTUpdate);
             if (targetSid) handleRedirectToCard(targetSid);
           } else if (watchChangeDetected || intelChangeDetected) {
             playUpdateBlip();
           }
        }

        setLastSyncTime(new Date().toLocaleTimeString('en-IN'));
        prevSignalsRef.current = [...data.signals];
        prevWatchlistRef.current = [...data.watchlist];
        prevMessagesRef.current = [...data.messages];
        setSignals([...data.signals]);
        setHistorySignals([...(data.history || [])]);
        setWatchlist([...data.watchlist]);
        setUsers([...data.users]);
        setLogs([...(data.logs || [])]);
        setMessages([...(data.messages || [])]);
        setConnectionStatus('connected');
      }
    } catch (err) {
      setConnectionStatus('error');
    } finally {
      isFetchingRef.current = false;
    }
  }, [playLongBeep, playUpdateBlip, handleRedirectToCard]);

  const handleSignalUpdate = useCallback(async (updated: TradeSignal): Promise<boolean> => {
    const success = await updateSheetData('signals', 'UPDATE_SIGNAL', updated, updated.id);
    if (success) {
      await sync(false);
      return true;
    }
    return false;
  }, [sync]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setActiveMajorAlerts(prev => {
        const next = { ...prev };
        let majorChanged = false;
        Object.keys(next).forEach(key => { if (now >= next[key]) { delete next[key]; majorChanged = true; } });
        if (majorChanged) {
          setGranularHighlights(prevHighs => {
            const nextHighs = { ...prevHighs };
            Object.keys(prev).forEach(key => { if (now >= prev[key]) delete nextHighs[key]; });
            return nextHighs;
          });
          return next;
        }
        return prev;
      });
      setActiveWatchlistAlerts(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(key => { if (now >= next[key]) { delete next[key]; changed = true; } });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    sync(true);
    const poll = setInterval(() => sync(false), POLL_INTERVAL);
    const handleVisibility = () => { if (!document.hidden) sync(false); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [sync]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('libra_sound_enabled', String(next));
    if (!next) stopAlertAudio();
    if (next && !audioInitialized) initAudio();
  };

  if (!user) return <Login onLogin={(u) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: u, timestamp: Date.now() }));
    setUser(u);
    sync(true);
  }} />;

  return (
    <Layout 
      user={user} 
      onLogout={() => { localStorage.removeItem(SESSION_KEY); setUser(null); }} 
      currentPage={page} 
      onNavigate={setPage}
      watchlist={watchlist}
      activeWatchlistAlerts={activeWatchlistAlerts}
    >
      {user && !audioInitialized && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white mb-6 animate-pulse shadow-[0_0_40px_rgba(37,99,235,0.4)]">
            <Zap size={40} />
          </div>
          <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Initialize Terminal</h2>
          <p className="text-slate-400 text-sm mb-8 max-w-xs">Tap below to activate real-time institutional alerts and secure audio stream.</p>
          <button onClick={initAudio} className="w-full max-w-xs bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-900/40 uppercase tracking-[0.2em] text-xs transition-all active:scale-95">Activate Live Feed</button>
        </div>
      )}
      <div className="fixed top-4 right-4 z-[100] flex flex-col items-end space-y-3">
        <div className={`bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-xl text-[10px] font-bold border shadow-2xl flex items-center ${connectionStatus === 'error' ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800'}`}>
          <div className="flex flex-col items-start mr-3">
              <span className="text-[9px] text-slate-500 uppercase tracking-tighter leading-none mb-1">Terminal Link</span>
              <div className="flex items-center">
                 <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${connectionStatus === 'syncing' ? 'bg-blue-400 animate-pulse' : connectionStatus === 'error' ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></div>
                 <span className={`${connectionStatus === 'error' ? 'text-rose-400' : 'text-white'} font-mono`}>{lastSyncTime}</span>
              </div>
          </div>
          <button onClick={() => sync(true)} className="p-1.5 rounded-lg bg-slate-800 text-blue-400 border border-blue-500/20"><Database size={14} /></button>
        </div>
        <button onClick={toggleSound} className={`p-4 rounded-full border shadow-2xl transition-all active:scale-90 ${soundEnabled ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-cyan-500/10' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
          {soundEnabled ? <Volume2 size={32} /> : <VolumeX size={32} />}
        </button>
        
        {/* DEMAT OPEN FLAG */}
        <a 
          href="https://oa.mynt.in/?ref=ZTN348" 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-emerald-600/90 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg border border-emerald-400/30 shadow-lg transition-all active:scale-95 flex items-center space-x-1.5"
          title="Open Demat Account"
        >
          <Briefcase size={12} />
          <span className="text-[9px] font-black uppercase tracking-tight">Open Demat</span>
          <ExternalLink size={8} className="opacity-70" />
        </a>
      </div>

      {/* FLOATING ROUND WHATSAPP ICON */}
      <a 
        href="https://wa.me/?text=DISCUSSION%20ROOM%20F - premium%20group%20Group:%20https://chat.whatsapp.com/IaHejh1i0h09qewDUBoVNv" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-24 right-6 md:bottom-10 md:right-10 z-[150] w-12 h-12 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full flex items-center justify-center shadow-[0_10px_40px_rgba(37,211,102,0.4)] border border-white/20 transition-all active:scale-95 hover:scale-110 group"
        title="WhatsApp Support Group"
      >
        <WhatsAppLogo size={26} />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border border-slate-900"></span>
        </span>
      </a>

      {page === 'dashboard' && <Dashboard watchlist={watchlist} signals={signals} messages={messages} user={user} granularHighlights={granularHighlights} activeMajorAlerts={activeMajorAlerts} activeWatchlistAlerts={activeWatchlistAlerts} onSignalUpdate={handleSignalUpdate} />}
      {page === 'booked' && <BookedTrades signals={signals} historySignals={historySignals} user={user} granularHighlights={granularHighlights} onSignalUpdate={handleSignalUpdate} />}
      {page === 'stats' && <Stats signals={signals} historySignals={historySignals} />}
      {page === 'rules' && <Rules />}
      {page === 'about' && <About />}
      {user?.isAdmin && page === 'admin' && <Admin watchlist={watchlist} onUpdateWatchlist={() => {}} signals={signals} onUpdateSignals={() => {}} users={users} onUpdateUsers={() => {}} logs={logs} messages={messages} onNavigate={setPage} onHardSync={() => sync(true)} />}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-[100] bg-slate-900/90 backdrop-blur-xl border border-slate-800 px-6 py-4 flex justify-around items-center rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <button onClick={() => setPage('dashboard')} className={`flex flex-col items-center space-y-1 transition-all ${page === 'dashboard' ? 'text-blue-500' : 'text-slate-500'}`}>
          <Radio size={24} strokeWidth={page === 'dashboard' ? 3 : 2} />
          <span className="text-[10px] font-bold uppercase tracking-tighter text-center">Live</span>
        </button>
        <button onClick={() => setPage('booked')} className={`flex flex-col items-center space-y-1 transition-all ${page === 'booked' ? 'text-emerald-500' : 'text-slate-500'}`}>
          <CheckCircle size={24} strokeWidth={page === 'booked' ? 3 : 2} />
          <span className="text-[10px] font-bold uppercase tracking-tighter text-center">Booked</span>
        </button>
        <button onClick={() => setPage('stats')} className={`flex flex-col items-center space-y-1 transition-all ${page === 'stats' ? 'text-yellow-500' : 'text-slate-500'}`}>
          <BarChart2 size={24} strokeWidth={page === 'stats' ? 3 : 2} />
          <span className="text-[10px] font-bold uppercase tracking-tighter text-center">Stats</span>
        </button>
        <button onClick={() => setPage('rules')} className={`flex flex-col items-center space-y-1 transition-all ${page === 'rules' ? 'text-purple-500' : 'text-slate-500'}`}>
          <BookOpen size={24} strokeWidth={page === 'rules' ? 3 : 2} />
          <span className="text-[10px] font-bold uppercase tracking-tighter text-center">Rules</span>
        </button>
      </div>
    </Layout>
  );
};

export default App;