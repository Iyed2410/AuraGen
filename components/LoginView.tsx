
import React, { useState, useEffect } from 'react';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [autoStart, setAutoStart] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (hasKey) setAutoStart(true);
      }
    };
    checkKey();
  }, []);

  const handleLogin = async () => {
    setIsConnecting(true);
    try {
      if (window.aistudio?.openSelectKey) {
        await window.aistudio.openSelectKey();
        // Proceeding immediately as per race condition mitigation rules
        onLoginSuccess();
      } else {
        // Fallback for environment without aistudio helper
        onLoginSuccess();
      }
    } catch (error) {
      console.error("Connection failed", error);
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/20 rounded-full blur-[120px] animate-pulse delay-700"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-50"></div>
      </div>

      <div className="relative z-10 max-w-lg w-full px-8 text-center space-y-12">
        <div className="space-y-6">
          <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-cyan-400 rounded-[2rem] mx-auto flex items-center justify-center shadow-2xl shadow-indigo-500/40 transform -rotate-12">
            <span className="text-4xl font-black text-white italic">A</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-black tracking-tighter text-white uppercase">AuraGen</h1>
            <p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-[10px]">Universal Visual Intelligence</p>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-3xl border border-white/5 p-10 rounded-[3rem] shadow-2xl space-y-8">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">
              {autoStart ? 'Ready to Create' : 'Unlock Creative Access'}
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Connect your billing-enabled Google Cloud project to access the full Gemini Creative Suite. 
              Required for professional-grade synthesis.
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleLogin}
              disabled={isConnecting}
              className="group w-full relative flex items-center justify-center gap-4 bg-white hover:bg-slate-100 text-black py-5 rounded-2xl font-black tracking-widest transition-all shadow-xl hover:shadow-white/10 active:scale-95 disabled:opacity-50"
            >
              {isConnecting ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.39-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {autoStart ? 'START ENGINE' : 'SELECT API KEY'}
                </>
              )}
            </button>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-[10px] text-indigo-400 font-bold uppercase hover:underline opacity-60 hover:opacity-100 transition-all"
            >
              Billing Documentation & Setup
            </a>
          </div>

          <div className="pt-4 border-t border-white/5">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Standard Auth • Pro Tier Pipeline Available
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
