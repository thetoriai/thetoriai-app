import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { LoaderIcon, XIcon, CheckIcon, LockClosedIcon, ChevronLeftIcon } from './Icons';
import { SUPPORT_EMAIL } from '../utils/constants';

interface AuthProps {
    onBack?: () => void;
    isOverlay?: boolean;
}

export const Auth: React.FC<AuthProps> = ({ onBack, isOverlay = false }) => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [showSignUpHint, setShowSignUpHint] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);
        setShowSignUpHint(false);

        try {
            if (mode === 'signup') {
                const { data, error } = await supabase.auth.signUp({
                  email,
                  password,
                  options: {
                    emailRedirectTo: window.location.origin
                  }
                });

                if (error) throw error;

                setMessage("Check your email to confirm your account.");
                setPassword("");

                setPassword(''); 
            } else {
                const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                if (signInError) {
                    if (signInError.message.includes('Invalid login credentials')) {
                        setShowSignUpHint(true);
                    }
                    throw signInError;
                }
               if (data.session) {
                 console.log("Logged in user:", data.user);
               }

            }
        } catch (err: any) {
            setError(err.message || 'Identity Rejected.');
        } finally {
            setLoading(false);
        }
    };

    const handleSocialLogin = async (provider: 'google' | 'facebook') => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: window.location.origin
                }
            });
            if (error) throw error;
        } catch (err: any) {
            setError(`Social login failed: ${err.message}`);
        }
    };

    const containerClasses = isOverlay 
    ? "w-full bg-black/20 backdrop-blur-md border border-white/10 rounded-[2.2rem] p-5 animate-in zoom-in-95 duration-300 shadow-[0_0_80px_rgba(0,0,0,0.8)]"
    : "w-full max-w-md bg-gray-900/90 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl p-8";

    return (
    <div
      className={
        !isOverlay
          ? "min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden"
          : ""
      }
    >
            {!isOverlay && (
                <div className="absolute inset-0 z-0">
                    <img 
                        src="https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&q=80&w=2000" 
            className="w-full h-full object-cover opacity-30"
            alt="Background"
                    />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-transparent to-gray-950/80"></div>
                </div>
            )}

      <div className={`${containerClasses} relative z-10 flex flex-col`}>
                {onBack && (
                    <button 
                        onClick={onBack}
            className="absolute top-2 left-3 text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-[12px] font-black tracking-widest uppercase"
                    >
            <ChevronLeftIcon className="w-5.5 h-2.5" /> Cancel
                    </button>
                )}

        <div className="mt-3"></div>

        <div className="flex bg-white/5 rounded-md p-0.5 mb-4 border border-white/5">
                    <button 
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
                        className={`flex-1 py-3 text-[12px] font-black tracking-widest rounded transition-all  ${mode === "signin" ? "bg-[#4f46e5] text-white" : "text-gray-500 hover:text-gray-300"}`}
          >
            Sign In
                    </button>
                    <button 
                        onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`flex-1 py-3 text-[12px] font-black tracking-widest rounded transition-all  ${mode === "signup" ? "bg-[#4f46e5] text-white" : "text-gray-500 hover:text-gray-300"}`}
                    >
                        Register
                    </button>
                </div>

        <form onSubmit={handleAuth} className="space-y-2.5">
          <div className="space-y-1">
            <label className="text-[6px] font-black text-gray-500 tracking-[0.2em] block ml-1 uppercase">
              Production Email
            </label>
                        <input 
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-indigo-500/50 outline-none transition-all placeholder-gray-800 text-[20px]"
                            placeholder="mail@studio.com"
                        />
                    </div>
          <div className="space-y-1">
            <label className="text-[6px] font-black text-gray-500 tracking-[0.2em] block ml-1 uppercase">
              Access Key
            </label>
                        <input 
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-indigo-500/50 outline-none transition-all placeholder-gray-800 text-[20px]"
              placeholder="••••••••"
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
            className="w-full py-5 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-black tracking-[0.3em] rounded-lg shadow-xl disabled:bg-gray-800 disabled:text-gray-700 flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-[12px] border border-white/10 uppercase"
                    >
            {loading ? (
              <LoaderIcon className="w-3 h-3 animate-spin" />
            ) : (
              <>{mode === "signin" ? "Sign In" : "Register"}</>
                        )}
                    </button>

          {error && (
            <div className="p-1 bg-red-900/20 border border-red-500/20 rounded-md text-center">
              <p className="text-[6px] text-red-400 font-black tracking-widest uppercase leading-tight">
                {error}
              </p>
                        </div>
                    )}
                </form>

        <div className="mt-4 pt-3 border-t border-white/5">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="h-px w-6 bg-white/5"></div>
            <span className="text-[12px] font-black tracking-[0.2em] text-white/20 uppercase">
              Social Access
            </span>
            <div className="h-px w-6 bg-white/5"></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleSocialLogin("google")}
              className="flex items-center justify-center gap-1.5 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg transition-all"
            >
              <svg
                className="w-2.5 h-2.5 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.152-1.928 4.176-1.288 1.288-3.312 2.712-7.12 2.712-6.08 0-10.856-4.944-10.856-11.024S5.2 1.04 11.28 1.04c3.28 0 5.616 1.296 7.408 2.992l2.312-2.312C18.816.632 15.456-1.04 11.28-1.04-1.04-1.04-10.856 8.76-10.856 21s9.816 22.04 22.136 22.04c6.64 0 11.64-2.192 15.52-6.232 4-4 5.256-9.656 5.256-14.192 0-1.368-.112-2.656-.32-3.84h-11.2V10.92z" />
              </svg>
              <span className="text-[12px] font-black tracking-widest text-gray-300 ">
                Gmail
              </span>
            </button>
            <button
              onClick={() => handleSocialLogin("facebook")}
              className="flex items-center justify-center gap-1.5 py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg transition-all"
            >
              <svg
                className="w-2.5 h-2.5 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span className="text-[12px] font-black tracking-widest text-gray-300 ">
                Facebook
              </span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center gap-0.5 opacity-20">
          <p className="text-[12px] font-black text-gray-0 tracking-widest ">
             {SUPPORT_EMAIL}
          </p>
          <p className="text-[4px] text-gray-700 text-center font-black tracking-[0.5em] uppercase">
            Thetori Ai v2.4.3
                    </p>
                </div>
            </div>
        </div>
    );
};