import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Scale, Phone, KeyRound, ShieldAlert, CheckCircle2, Eye, EyeOff, Loader2, Smartphone, ShieldCheck } from 'lucide-react';
import { fetchSheetData, updateSheetData } from '../services/googleSheetsService';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [browserDeviceId, setBrowserDeviceId] = useState('');

  useEffect(() => {
    // Generate a deterministic Fingerprint based on hardware signals
    // This makes it extremely hard to bypass by just clearing cache
    const generateFingerprint = () => {
      const components = [
        navigator.userAgent,
        navigator.language,
        screen.colorDepth,
        screen.height,
        screen.width,
        navigator.hardwareConcurrency || 'unknown',
        new Date().getTimezoneOffset(),
        !!window.indexedDB,
        !!window.sessionStorage,
        !!window.localStorage,
      ];
      
      const str = components.join('###');
      // Simple hash function for deterministic ID
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit int
      }
      return 'LQN-' + Math.abs(hash).toString(36).toUpperCase();
    };

    const fingerprint = generateFingerprint();
    setBrowserDeviceId(fingerprint);
    // Also store it for consistency, though deterministic generation is primary
    localStorage.setItem('libra_hw_id', fingerprint);
  }, []);

  const completeLogin = async (sheetUser: any, isPasswordReset: boolean) => {
    const rawSavedId = String(sheetUser.deviceId || '').trim();
    const hasExistingLock = rawSavedId && rawSavedId !== "" && rawSavedId !== "null" && rawSavedId !== "undefined";

    if (!sheetUser.isAdmin) {
        // SCENARIO 1: First time login or Admin has cleared the ID
        if (!hasExistingLock) {
            const updatedUser = { 
                ...sheetUser, 
                deviceId: browserDeviceId, 
                lastPassword: sheetUser.password 
            };
            
            const success = await updateSheetData('users', 'UPDATE_USER', updatedUser, sheetUser.id);
            if (!success) {
                setError("Terminal handshake failed. Try again.");
                setLoading(false);
                return;
            }

            await updateSheetData('logs', 'ADD', {
              timestamp: new Date().toISOString(),
              user: sheetUser.name,
              action: 'HARDWARE_BINDING',
              details: `Locked to terminal: ${browserDeviceId}`,
              type: 'SECURITY'
            });
        } 
        // SCENARIO 2: Device already locked, check for match
        else if (rawSavedId !== browserDeviceId) {
            setError(`SECURITY VIOLATION: This account is locked to another terminal. Contact Admin to reset.`);
            setLoading(false);
            return;
        }
    }

    await updateSheetData('logs', 'ADD', {
        timestamp: new Date().toISOString(),
        user: sheetUser.name,
        action: 'ACCESS_GRANTED',
        details: `Secure session started on ${browserDeviceId}`,
        type: 'SECURITY'
    });

    onLogin({
        id: sheetUser.id,
        phoneNumber: sheetUser.phoneNumber || '',
        name: sheetUser.name,
        expiryDate: sheetUser.expiryDate,
        isAdmin: sheetUser.isAdmin,
        deviceId: browserDeviceId
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) { setError('Enter 10-digit mobile number.'); return; }
    if (!password) { setError('Access key required.'); return; }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
        const data = await fetchSheetData();
        const users = data?.users || [];
        const cleanInputPhone = phone.replace(/\D/g, '').slice(-10);

        const sheetUser = users.find((u: any) => {
            const cleanSheetPhone = String(u.phoneNumber || '').replace(/\D/g, '').slice(-10);
            return cleanSheetPhone === cleanInputPhone;
        });

        if (!sheetUser) {
            setError('Authorized subscriber not found.');
            setLoading(false);
            return;
        }

        if (password.trim() !== String(sheetUser.password).trim()) {
            setError('Invalid Access Key.');
            setLoading(false);
            return;
        }

        // 1. Subscription Integrity Check
        const rawExpiry = String(sheetUser.expiryDate || '').trim().toLowerCase();
        const isPerpetual = rawExpiry === 'perpetual' || rawExpiry === 'admin' || !!sheetUser.isAdmin;

        if (!isPerpetual) {
            let expiryStr = sheetUser.expiryDate;
            const parts = expiryStr.split(/[-/]/);
            if (parts.length === 3 && parts[0].length === 2) {
                expiryStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }

            const expiryDate = new Date(expiryStr);
            expiryDate.setHours(23, 59, 59, 999);
            
            if (isNaN(expiryDate.getTime()) || new Date() > expiryDate) {
                setError('ACCESS EXPIRED. CONTACT ADMIN FOR RENEWAL.');
                setLoading(false);
                return;
            }
        }

        // 2. Hardware-Password Rotation Check
        const isPasswordReset = String(sheetUser.lastPassword || '').trim() !== String(sheetUser.password).trim();
        const rawSavedId = String(sheetUser.deviceId || '').trim();
        const isDeviceCleared = !rawSavedId || rawSavedId === "" || rawSavedId === "null" || rawSavedId === "undefined";

        // Forced rotation: If admin cleared the device, the user MUST change the password to re-bind
        if (!isPasswordReset && isDeviceCleared && sheetUser.lastPassword) {
            setError('SECURITY POLICY: NEW ACCESS KEY REQUIRED FOR RE-ACTIVATION.');
            setLoading(false);
            return;
        }

        if (isPasswordReset && isDeviceCleared) {
            setSuccessMsg('Hardware Security Verified. New binding accepted.');
        }

        completeLogin(sheetUser, isPasswordReset);
    } catch (err) {
        setError('Server synchronization failed. Check connection.');
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500"></div>
        
        <div className="p-8">
            <div className="text-center mb-10">
                <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-3xl mx-auto flex items-center justify-center mb-5 shadow-2xl shadow-blue-500/20">
                    <Scale size={40} strokeWidth={2.5} className="text-white" />
                </div>
                <h1 className="text-3xl font-black text-white tracking-tighter">LibraQuant</h1>
                <p className="text-slate-500 text-[10px] mt-2 uppercase tracking-[0.3em] font-mono">Institutional Signal Terminal</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Registered ID (Mobile)</label>
                    <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <input 
                            type="tel" 
                            maxLength={10}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                            placeholder="Mobile Number"
                            className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-700 font-mono text-sm"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Access Key</label>
                    <div className="relative group">
                        <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <input 
                            type={showPassword ? "text" : "password"} 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Terminal Key"
                            className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-4 pl-12 pr-14 text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-700 font-mono text-sm"
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-600 hover:text-slate-300 transition-colors"
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-4 flex items-start space-x-3 animate-in fade-in zoom-in-95">
                        <ShieldAlert size={20} className="text-rose-500 mt-0.5 shrink-0" />
                        <span className="text-rose-400 text-[11px] font-bold uppercase tracking-tight leading-relaxed">{error}</span>
                    </div>
                )}

                {successMsg && (
                    <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 flex items-start space-x-3 animate-in fade-in zoom-in-95">
                        <ShieldCheck size={20} className="text-emerald-500 mt-0.5 shrink-0" />
                        <span className="text-emerald-400 text-[11px] font-bold uppercase tracking-tight leading-relaxed">{successMsg}</span>
                    </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4.5 rounded-2xl transition-all shadow-[0_10px_30px_rgba(37,99,235,0.3)] disabled:opacity-50 flex items-center justify-center text-xs uppercase tracking-[0.2em]"
                >
                    {loading ? <Loader2 className="animate-spin mr-3" size={20} /> : <Smartphone className="mr-3" size={18} />}
                    {loading ? 'Authenticating Terminal...' : 'Bind & Access Terminal'}
                </button>
            </form>

            <div className="mt-10 pt-8 border-t border-slate-800/50 text-center">
                <div className="flex items-center justify-center space-x-2 mb-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Device Hash: {browserDeviceId || 'GENERATING...'}</span>
                </div>
                <p className="text-[10px] text-slate-600 font-bold leading-relaxed uppercase tracking-tighter max-w-[280px] mx-auto">
                    Account is strictly locked to your hardware.<br/>
                    Multiple device access is physically prohibited.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Login;