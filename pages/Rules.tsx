
import React from 'react';
import { AlertTriangle, CheckCircle, Shield, BookOpen } from 'lucide-react';
import { SEBI_DISCLAIMER } from '../constants';

const Rules: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-10">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-500/10 rounded-2xl mx-auto flex items-center justify-center mb-4 border border-blue-500/20">
          <BookOpen size={32} className="text-blue-500" />
        </div>
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Rules & Disclaimer</h2>
        <p className="text-slate-400 mt-2 font-medium">Strict adherence to risk management protocols is mandatory for all subscribers.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
        <div className="flex items-start space-x-4">
            <AlertTriangle className="text-amber-500 shrink-0 mt-1" size={24} />
            <div>
                <h3 className="text-sm font-black text-white mb-4 uppercase tracking-widest">Official SEBI Disclaimer</h3>
                <div className="text-slate-400 text-[11px] leading-relaxed whitespace-pre-wrap font-mono bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                    {SEBI_DISCLAIMER}
                </div>
            </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
        <h3 className="text-sm font-black text-white mb-6 uppercase tracking-widest flex items-center">
          <Shield size={16} className="mr-3 text-blue-500" />
          Subscriber Code of Conduct
        </h3>
        <ul className="space-y-4">
            {[
                "Strict Stop Loss MUST be maintained for every trade without exception.",
                "Do not over-leverage. Recommended risk per trade is strictly 2% of capital.",
                "Sharing internal terminal data or screenshots is prohibited (Watermarked).",
                "Trade execution status (Active/Exit) as per Terminal Admin is final.",
                "Abusive conduct results in immediate access termination without refund."
            ].map((rule, idx) => (
                <li key={idx} className="flex items-start text-slate-300 group">
                    <div className="mt-1 mr-4">
                      <CheckCircle size={14} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                    </div>
                    <span className="text-xs font-medium leading-relaxed">{rule}</span>
                </li>
            ))}
        </ul>
      </div>

      <div className="text-center py-6">
          <div className="inline-block px-4 py-2 bg-slate-900 border border-slate-800 rounded-full">
            <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em]">
              LibraQuant Institutional Terminal • SEBI REG: NON-ADVISORY
            </p>
          </div>
      </div>
    </div>
  );
};

export default Rules;
