
import React from 'react';
import { Info, Target, Shield, Cpu, Scale } from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16 animate-in fade-in duration-700">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-600/10 rounded-2xl mx-auto flex items-center justify-center mb-4 border border-blue-500/20">
          <Info size={32} className="text-blue-500" />
        </div>
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter">About Us</h2>
        <p className="text-slate-500 mt-2 font-mono text-[10px] uppercase tracking-[0.2em]">Institutional Infrastructure • Decision Support • Education</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden h-full">
           <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
           <div className="relative z-10">
              <div className="flex items-center space-x-3 mb-6">
                 <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><Cpu size={20} /></div>
                 <h3 className="text-sm font-black text-white uppercase tracking-widest">Our Framework</h3>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed font-medium mb-4">
                Libra Fin-Tech Solutions is a market-technology company focused on developing structured tools and frameworks that help traders understand market behavior and plan trades with discipline and risk awareness.
              </p>
              <p className="text-slate-400 text-sm leading-relaxed font-medium">
                Built on over 17 years of practical market experience, the platform offers a secure, organized, and technology-driven alternative to unstructured trading communication. It provides strategy-based market insights, execution planning tools, and rule-driven frameworks designed to support independent decision-making.
              </p>
           </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden h-full">
           <div className="absolute top-0 left-0 w-1 h-full bg-emerald-600"></div>
           <div className="relative z-10">
              <div className="flex items-center space-x-3 mb-6">
                 <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500"><Target size={20} /></div>
                 <h3 className="text-sm font-black text-white uppercase tracking-widest">Our Mission</h3>
              </div>
              <p className="text-slate-300 text-lg font-bold leading-snug tracking-tight mb-6">
                To build a professional trading technology platform that enables informed, independent decision-making through structured market frameworks and disciplined execution planning.
              </p>
              <div className="space-y-4">
                 {[
                   "Process Integrity & Transparency",
                   "Disciplined Risk Management",
                   "Responsible Market Participation",
                   "Structured Thinking Over Speculation"
                 ].map((item, i) => (
                   <div key={i} className="flex items-center space-x-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      <span>{item}</span>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
         <div className="flex items-start space-x-6 mb-8">
            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500 shrink-0"><Shield size={24} /></div>
            <div>
               <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2">Platform Operation</h3>
               <p className="text-slate-400 text-sm leading-relaxed font-medium">
                 Libra Fin-Tech Solutions operates as a decision-support and educational platform. The company does not provide investment advice, does not manage client funds, and does not execute trades on behalf of users. All content shared represents research-oriented views and system-based observations, intended strictly for educational and informational purposes.
               </p>
            </div>
         </div>
         
         <div className="pt-8 border-t border-slate-800">
            <div className="flex items-center space-x-3 mb-4">
               <Scale size={18} className="text-slate-500" />
               <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">Regulatory Disclosure</h3>
            </div>
            <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800">
               <p className="text-rose-400 text-xs font-bold leading-relaxed">
                 Libra Fin-Tech Solutions is not registered with SEBI as an Investment Advisor or Research Analyst. Trading in financial markets involves risk, and past performance or system references do not guarantee future outcomes.
               </p>
            </div>
         </div>
      </div>

      <div className="text-center pt-4">
         <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em] font-mono">
            LIBRA FIN-TECH SOLUTIONS • EST. 17+ YEARS MARKET EXPERIENCE
         </p>
      </div>
    </div>
  );
};

export default About;
