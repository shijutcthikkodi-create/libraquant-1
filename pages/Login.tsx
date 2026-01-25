import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Scale, Phone, KeyRound, ShieldAlert, CheckCircle2, Eye, EyeOff, Loader2, Smartphone, ShieldCheck, UserPlus, ArrowRight, MessageCircle, LogIn, ExternalLink, Lock } from 'lucide-react';
import { fetchSheetData, updateSheetData } from '../services/googleSheetsService';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [browserDeviceId, setBrowserDeviceId] = useState('');
  
  // Flow state
  const [lookupDone, setLookupDone] = useState(false);
  const [existingUser, setExistingUser] = useState<any | null>(null);
  const [leadSaved, setLeadSaved] = useState(false);

  useEffect(() => {
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
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return 'LQN-' + Math.abs(hash).toString(36).toUpperCase();
    };

    const fingerprint = generateFingerprint();
    setBrowserDeviceId(fingerprint);
    localStorage.setItem('libra_hw_id', fingerprint);
  }, []);

  const handlePhoneCheck = async () => {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      setError('Enter 10-digit mobile number.');
      return;
    }

    setCheckingPhone(true);
    setError('');
    setLeadSaved(false);
    try {
      const data = await fetchSheetData();
      const users = data?.users || [];
      const userFound = users.find((u: any) => {
        const cleanSheetPhone = String(u.phoneNumber || '').replace(/\D/g, '').slice(-10);
        return cleanSheetPhone === cleanPhone;
      });

      if (userFound) {
        setExistingUser(userFound);
      } else {
        setExistingUser(null);
      }
      setLookupDone(true);
    } catch (err) {
      setError('Handshake failed. Check your internet connection.');
    } finally {
      setCheckingPhone(false);
    }
  };

  const completeLogin = async (sheetUser: any) => {
    const rawSavedId = String(sheetUser.deviceId || '').trim();
    const hasExistingLock = rawSavedId && rawSavedId !== "" && rawSavedId !== "null" && rawSavedId !== "undefined";

    // ONLY BIND IF NO LOCK EXISTS
    if (!sheetUser.isAdmin && !hasExistingLock) {
        const updatedUser = { 
            ...sheetUser, 
            deviceId: browserDeviceId, 
            lastPassword: sheetUser.password // Record the password used for this specific binding
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

    // LOG SUCCESSFUL LOGIN
    await updateSheetData('logs', 'ADD', {
      timestamp: new Date().toISOString(),
      user: sheetUser.name,
      action: 'LOGIN_SUCCESS',
      details: `Session started on hardware: ${browserDeviceId}`,
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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError('Access key required.'); return; }

    setLoading(true);
    setError('');

    try {
        // 1. Password Verification
        if (password.trim() !== String(existingUser.password).trim()) {
            setError('Invalid Access Key.');
            setLoading(false);
            return;
        }

        // 2. Expiry Check
        const rawExpiry = String(existingUser.expiryDate || '').trim().toLowerCase();
        const isPerpetual = rawExpiry === 'perpetual' || rawExpiry === 'admin' || !!existingUser.isAdmin;

        if (!isPerpetual) {
            let expiryStr = existingUser.expiryDate;
            const parts = expiryStr.split(/[-/]/);
            if (parts.length === 3 && parts[0].length === 2) {
                expiryStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            const expiryDate = new Date(expiryStr);
            expiryDate.setHours(23, 59, 59, 999);
            if (isNaN(expiryDate.getTime()) || new Date() > expiryDate) {
                setError('ACCESS EXPIRED. CONTACT ADMIN.');
                setLoading(false);
                return;
            }
        }

        // 3. HARDWARE LOCK LOGIC (Single Device Enforcement)
        if (!existingUser.isAdmin) {
            const rawSavedId = String(existingUser.deviceId || '').trim();
            const hasExistingLock = rawSavedId && rawSavedId !== "" && rawSavedId !== "null" && rawSavedId !== "undefined";
            
            const lastBoundPassword = String(existingUser.lastPassword || '').trim();
            const currentPassword = String(existingUser.password || '').trim();
            const isPasswordChangedSinceLastBind = lastBoundPassword !== currentPassword;

            if (hasExistingLock) {
                // If account is already locked to a device
                if (rawSavedId !== browserDeviceId) {
                    setError('SECURITY VIOLATION: Locked to another terminal. Multiple device logins are not permitted.');
                    setLoading(false);
                    return;
                }
            } else {
                // If account is reset (deviceId is null)
                // We REQUIRE a password change if the account was previously bound to something
                if (lastBoundPassword && !isPasswordChangedSinceLastBind) {
                    setError('SECURITY POLICY: Account was reset. You must use a NEW Access Key (updated by Admin) to bind this new device.');
                    setLoading(false);
                    return;
                }
                // If it's a completely new user (no lastBoundPassword) or password changed, they can bind now.
            }
        }

        completeLogin(existingUser);
    } catch (err) {
        setError('Sync failed. Check connection.');
        setLoading(false);
    }
  };

  const handleLeadCollection = async () => {
    if (!name.trim()) { setError('Please enter your name.'); return; }
    setLoading(true);
    setError('');

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const newLead = {
      id: 'USR-' + Date.now(),
      name: name.trim(),
      phoneNumber: cleanPhone,
      expiryDate: 'PENDING',
      isAdmin: false,
      password: '',
      deviceId: null,
      lastPassword: ''
    };

    try {
      await updateSheetData('users', 'ADD', newLead);
      await updateSheetData('logs', 'ADD', {
        timestamp: new Date().toISOString(),
        user: name.trim(),
        action: 'UNREGISTERED_LOGIN_ATTEMPT',
        details: `Collected lead info for: ${cleanPhone}`,
        type: 'USER'
      });
      
      setLeadSaved(true);
      setSuccessMsg('Registration initialized. Finalize access via WhatsApp.');
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppRedirect = () => {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const readyMessage = `*LIBRAQUANT SUBSCRIPTION REQUEST*
-----------------------------
Name: ${name.trim()}
Mobile: ${cleanPhone}
Hardware Hash: ${browserDeviceId}
-----------------------------
Hi Support, I would like to subscribe to the LibraQuant Institutional Terminal. Please provide my Access Key and instructions.`;

    const whatsappUrl = `https://wa.me/919539407707?text=${encodeURIComponent(readyMessage)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500"></div>
        
        <div className="p-8">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-2xl mx-auto flex items-center justify-center mb-5 shadow-2xl shadow-blue-500/20">
                    <Scale size={32} strokeWidth={2.5} className="text-white" />
                </div>
                <h1 className="text-2xl font-black text-white tracking-tighter">LibraQuant</h1>
                <p className="text-slate-500 text-[9px] mt-1 uppercase tracking-[0.3em] font-mono">Institutional Signal Terminal</p>
            </div>

            {!lookupDone ? (
              <div className="space-y-6">
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Enter Mobile Number</label>
                    <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <input 
                            type="tel" 
                            maxLength={10}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                            placeholder="10-digit Number"
                            className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-700 font-mono text-sm"
                        />
                    </div>
                </div>
                <button 
                  onClick={handlePhoneCheck}
                  disabled={checkingPhone || phone.length < 10}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg disabled:opacity-50 flex items-center justify-center text-[10px] uppercase tracking-[0.2em]"
                >
                    {checkingPhone ? <Loader2 className="animate-spin mr-3" size={18} /> : <ArrowRight className="mr-3" size={18} />}
                    Check Status
                </button>
              </div>
            ) : existingUser ? (
              <form onSubmit={handleLoginSubmit} className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 mb-6 flex items-center space-x-3">
                   <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-black">
                      {existingUser.name.charAt(0).toUpperCase()}
                   </div>
                   <div>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Subscriber Identity</p>
                      <p className="text-sm font-bold text-white uppercase">{existingUser.name}</p>
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
                            placeholder="Enter Key"
                            className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-4 pl-12 pr-14 text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-700 font-mono text-sm"
                            autoFocus
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

                <div className="flex space-x-3">
                  <button 
                    type="button"
                    onClick={() => { setLookupDone(false); setPassword(''); }}
                    className="bg-slate-800 text-slate-400 px-4 rounded-2xl hover:text-white transition-all"
                  >
                    <ArrowRight className="rotate-180" size={18} />
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg disabled:opacity-50 flex items-center justify-center text-[10px] uppercase tracking-[0.2em]"
                  >
                      {loading ? <Loader2 className="animate-spin mr-3" size={18} /> : <ShieldCheck className="mr-3" size={18} />}
                      Verify Terminal
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20 mb-6 flex items-start space-x-3">
                   <ShieldAlert size={20} className="text-amber-500 shrink-0 mt-0.5" />
                   <div>
                      <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest leading-none mb-1">Unregistered Terminal</p>
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">Identify yourself to request access.</p>
                   </div>
                </div>

                {!leadSaved ? (
                  <>
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Your Full Name</label>
                        <div className="relative group">
                            <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                            <input 
                                type="text" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Name for Registration"
                                className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-700 text-sm"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="flex flex-col space-y-4">
                      <div className="flex space-x-3">
                        <button 
                          type="button"
                          onClick={() => { setLookupDone(false); setName(''); }}
                          className="bg-slate-800 text-slate-400 px-4 rounded-2xl hover:text-white transition-all"
                        >
                          <ArrowRight className="rotate-180" size={18} />
                        </button>
                        <button 
                            disabled={loading || !name.trim()}
                            onClick={handleLeadCollection}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center text-[10px] uppercase tracking-[0.2em]"
                        >
                            {loading ? <Loader2 className="animate-spin mr-3" size={18} /> : <LogIn className="mr-3" size={18} />}
                            Request Access
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-6 animate-in zoom-in-95 duration-500">
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                        <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 mb-4 animate-bounce">
                           <CheckCircle2 size={32} />
                        </div>
                        <h3 className="text-white font-black text-sm uppercase tracking-widest mb-1">Details Captured</h3>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-tighter">Your request is logged. Tap below to get Access Key.</p>
                    </div>
                    <button 
                        onClick={handleWhatsAppRedirect}
                        className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-black py-5 rounded-2xl transition-all shadow-[0_10px_40px_rgba(37,211,102,0.3)] flex items-center justify-center text-xs uppercase tracking-[0.2em]"
                    >
                        <MessageCircle className="mr-3" size={20} />
                        Subscribe via WhatsApp
                        <ExternalLink className="ml-2 opacity-50" size={12} />
                    </button>
                    <button 
                      onClick={() => setLeadSaved(false)}
                      className="w-full py-2 text-[9px] font-black text-slate-600 uppercase tracking-widest hover:text-slate-400 transition-colors"
                    >
                      Edit Information
                    </button>
                  </div>
                )}
              </div>
            )}

            {error && (
                <div className="mt-6 bg-rose-950/30 border border-rose-500/30 rounded-2xl p-4 flex items-start space-x-3 animate-in fade-in zoom-in-95">
                    <ShieldAlert size={18} className="text-rose-500 mt-0.5 shrink-0" />
                    <span className="text-rose-400 text-[10px] font-bold uppercase tracking-tight leading-relaxed">{error}</span>
                </div>
            )}

            {successMsg && !leadSaved && (
                <div className="mt-6 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 flex items-start space-x-3 animate-in fade-in zoom-in-95">
                    <ShieldCheck size={18} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-tight leading-relaxed">{successMsg}</span>
                </div>
            )}

            <div className="mt-10 pt-8 border-t border-slate-800/50 text-center">
                <div className="flex items-center justify-center space-x-2 mb-3">
                   <Lock size={10} className="text-blue-500" />
                   <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">HW_HASH: {browserDeviceId || 'SCANNING...'}</span>
                </div>
                <p className="text-[9px] text-slate-600 font-bold leading-relaxed uppercase tracking-tighter max-w-[280px] mx-auto">
                    Institutional terminal security enabled.<br/>
                    One hardware lock per subscriber seat.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Login;