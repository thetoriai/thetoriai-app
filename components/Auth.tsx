import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { LoaderIcon, XIcon, CheckIcon, LockClosedIcon, ChevronLeftIcon } from './Icons';

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
                const { error: signUpError } = await supabase.auth.signUp({ email, password });
                if (signUpError) throw signUpError;
                await supabase.auth.signOut();
                setMessage('Account created. Please login.');
                setPassword(''); 
            } else {
                const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                if (signInError) {
                    if (signInError.message.includes('Invalid login credentials')) {
                        setShowSignUpHint(true);
                    }
                    throw signInError;
                }
                if (!data?.session) throw new Error("Verification failed.");
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
        ? "w-full bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] p-10 animate-in zoom-in-95 duration-500"
        : "w-full max-w-md bg-gray-900/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl p-8";

    return (
        <div className={!isOverlay ? "min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden" : ""}>
            {!isOverlay && (
                <div className="absolute inset-0 z-0">
                    <img 
                        src="https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&q=80&w=2000" 
                        className="w-full h-full object-cover opacity-10 scale-110 animate-ken-burns"
                        style={{ filter: 'grayscale(100%) contrast(150%)' }}
                        alt="Cinema"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-transparent to-gray-950"></div>
                </div>
            )}

            <div className={`${containerClasses} relative z-10`}>
                {onBack && (
                    <button 
                        onClick={onBack}
                        className="absolute top-8 left-8 text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-[10px] font-black uppercase tracking-widest"
                    >
                        <ChevronLeftIcon className="w-4 h-4" /> Cancel
                    </button>
                )}

                <div className="flex flex-col items-center mb-8 text-center mt-6">
                    <h1 className="text-3xl font-black text-white tracking-tighter italic leading-none">Thetori Ai Access</h1>
                    <p className="text-indigo-400/60 text-[8px] font-black uppercase tracking-[0.5em] mt-3">Identity Verification System</p>
                </div>

                {/* Social Logins */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <button 
                        onClick={() => handleSocialLogin('google')}
                        className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group"
                    >
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.152-1.928 4.176-1.288 1.288-3.312 2.712-7.12 2.712-6.08 0-10.856-4.944-10.856-11.024S5.2 1.04 11.28 1.04c3.28 0 5.616 1.296 7.408 2.992l2.312-2.312C18.816.632 15.456-1.04 11.28-1.04-1.04-1.04-10.856 8.76-10.856 21s9.816 22.04 22.136 22.04c6.64 0 11.64-2.192 15.52-6.232 4-4 5.256-9.656 5.256-14.192 0-1.368-.112-2.656-.32-3.84h-11.2V10.92z"/>
                        </svg>
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-300 group-hover:text-white">Gmail</span>
                    </button>
                    <button 
                        onClick={() => handleSocialLogin('facebook')}
                        className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group"
                    >
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-300 group-hover:text-white">Facebook</span>
                    </button>
                </div>

                <div className="flex items-center gap-4 mb-6 opacity-20">
                    <div className="h-px flex-1 bg-white"></div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-white">OR</span>
                    <div className="h-px flex-1 bg-white"></div>
                </div>

                <div className="flex bg-white/5 rounded-2xl p-1 mb-8 border border-white/5">
                    <button onClick={() => { setMode('signin'); setError(null); setMessage(null); setShowSignUpHint(false); }} className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'signin' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>Sign In</button>
                    <button onClick={() => { setMode('signup'); setError(null); setMessage(null); setShowSignUpHint(false); }} className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'signup' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>Register</button>
                </div>

                <form onSubmit={handleAuth} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest block ml-2">Production Email</label>
                        <input 
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-indigo-500/50 outline-none transition-all placeholder-gray-800 text-sm shadow-inner"
                            placeholder="mail@studio.com"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest block ml-2">Access Key</label>
                        <input 
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-indigo-500/50 outline-none transition-all placeholder-gray-800 text-sm shadow-inner"
                            placeholder="Password"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-900/10 border border-red-500/20 rounded-2xl flex items-start gap-2 animate-in slide-in-from-top-1">
                            <XIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-[10px] text-red-400 font-bold leading-tight">{error}</p>
                                {showSignUpHint && mode === 'signin' && (
                                    <p className="text-[9px] text-indigo-400 mt-2 font-black uppercase cursor-pointer hover:underline" onClick={() => { setMode('signup'); setError(null); setShowSignUpHint(false); }}>
                                        Register new ID?
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.3em] rounded-3xl shadow-2xl disabled:bg-gray-800 disabled:text-gray-700 flex items-center justify-center gap-3 transition-all active:scale-[0.98] text-[10px] mt-6 group border border-white/10"
                    >
                        {loading ? <LoaderIcon className="w-5 h-5 animate-spin" /> : (
                            <>
                                <LockClosedIcon className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                                {mode === 'signin' ? 'Verify Identity' : 'Create Identity'}
                            </>
                        )}
                    </button>

                    {message && (
                        <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 mt-4">
                            <CheckIcon className="w-5 h-5 text-green-500" />
                            <p className="text-[10px] text-green-400 font-bold leading-tight uppercase tracking-wider">{message}</p>
                        </div>
                    )}
                </form>

                <div className="mt-10 pt-6 border-t border-white/5 flex flex-col items-center">
                    <p className="text-[7px] text-gray-600 text-center leading-tight uppercase font-black tracking-[0.4em]">
                        Thetori Ai Production Engine v2.4.3
                    </p>
                </div>
            </div>
        </div>
    );
};