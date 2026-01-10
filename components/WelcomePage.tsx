import React, { useState, useRef } from 'react';
// Added ClapperboardIcon to imports.
import { Logo, SparklesIcon, VideoIcon, UserPlusIcon, ChevronRightIcon, ClapperboardIcon } from './Icons';
import { Auth } from './Auth';

interface WelcomePageProps {
    onEnter: () => void;
    session?: any;
}

const REEL_VIDEOS = [
    "https://istoria-ai.github.io/my-production-reel/89dd41fd-9efb-4319-9e9d-993a908ccd6e.mp4",
    "https://istoria-ai.github.io/my-production-reel/939be0a3-8414-4a49-ac39-cc8e497fbf4b.mp4",
    "https://istoria-ai.github.io/my-production-reel/A spicy rooster strutting around the farmhouse like a macho ___.mp4",
    "https://istoria-ai.github.io/my-production-reel/generated-video-3-clip-4.mp4"
];

// Placeholder for the empty slots (4 active + 4 reserved = 8 total)
const PLACEHOLDER_SLOTS = [4, 5, 6, 7];

// Sub-component to handle hover-to-play behavior
const HoverVideo: React.FC<{ src: string }> = ({ src }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleMouseEnter = () => {
        if (videoRef.current) {
            videoRef.current.play().catch(() => {});
        }
    };

    const handleMouseLeave = () => {
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    };

    return (
        <div 
            onMouseEnter={handleMouseEnter} 
            onMouseLeave={handleMouseLeave}
            className="aspect-video bg-black/40 rounded-xl border border-white/10 overflow-hidden shadow-2xl relative group transition-all duration-500 hover:border-indigo-500/50 hover:scale-[1.02]"
        >
            <video 
                ref={videoRef}
                src={src} 
                muted 
                loop 
                playsInline 
                preload="auto"
                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" 
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/5 rounded-xl pointer-events-none"></div>
            {/* Play overlay indicator */}
            <div className="absolute inset-0 flex items-center justify-center opacity-40 group-hover:opacity-0 transition-opacity pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-black/40 border border-white/10 flex items-center justify-center">
                    <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-1"></div>
                </div>
            </div>
        </div>
    );
};

export const WelcomePage: React.FC<WelcomePageProps> = ({ onEnter, session }) => {
    const isMobile = window.innerWidth < 768;
    const [showAuthOverlay, setShowAuthOverlay] = useState(false);
    
    const bgVideoRef = useRef<HTMLVideoElement>(null);

    const handleEnterClick = () => {
        if (!session) {
            setShowAuthOverlay(true);
        } else {
            onEnter();
        }
    };

    const isMinimalView = showAuthOverlay || !!session;

    return (
        <div className="w-full h-full flex flex-col items-center bg-gray-950 overflow-y-auto overflow-x-hidden relative perspective-1000 scrollbar-none">
            {/* LAYER 0: CINEMATIC BACKGROUND VIDEO (Brightened as requested) */}
            <div className={`fixed inset-0 z-0 overflow-hidden pointer-events-none transition-all duration-1000 ${isMinimalView ? 'scale-105 saturate-[1.1]' : ''}`}>
                <video 
                    ref={bgVideoRef}
                    src={REEL_VIDEOS[0]} 
                    autoPlay 
                    muted 
                    loop 
                    playsInline 
                    preload="auto"
                    className={`w-full h-full object-cover scale-110 transition-all duration-700 opacity-50 brightness-90 contrast-110`}
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(3,7,18,0.85)_100%)] pointer-events-none"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-transparent to-gray-950 opacity-70 pointer-events-none"></div>
            </div>

            {/* LAYER 2: MAIN INTERACTIVE AREA (TOP/CENTER) */}
            <div className={`relative z-20 flex flex-col items-center text-center max-w-5xl px-6 pt-16 transition-all duration-700 ${isMinimalView ? 'opacity-0 pointer-events-none scale-95 blur-md' : 'opacity-100'}`}>
                {/* Logo Top Center */}
                <div className="w-20 h-20 md:w-24 md:h-24 mb-6 p-0.5 bg-indigo-500/20 rounded-full flex items-center justify-center animate-in zoom-in duration-1000 shadow-[0_0_40px_rgba(79,70,229,0.15)] border border-white/5 overflow-hidden">
                    <div className="w-full h-full bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center p-5">
                        <Logo className="w-full h-full text-white" />
                    </div>
                </div>

                {/* Heading with White/Indigo split - UPDATED BRANDING */}
                <div className="space-y-6 mb-10 animate-in slide-in-from-bottom-8 duration-1000">
                    <h1 className="text-6xl sm:text-7xl md:text-[90px] font-black text-white italic tracking-tighter leading-none select-none">
                        Thetori <span className="text-[#818cf8]">Ai</span>
                    </h1>
                    
                    {/* ENTER STUDIO Blue Capsule Button */}
                    <div className="flex justify-center">
                        <button 
                            onClick={handleEnterClick}
                            className="group relative px-12 py-5 bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-[0_20px_60px_rgba(79,70,229,0.3)] transition-all active:scale-[0.97] flex items-center justify-center gap-6 overflow-hidden rounded-full border border-white/10"
                        >
                            <span className="text-base md:text-lg font-black uppercase tracking-[0.4em] italic ml-[0.4em]">Enter Studio</span>
                            <ChevronRightIcon className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                        </button>
                    </div>
                </div>

                {/* Feature Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 w-full animate-in slide-in-from-bottom-12 duration-1000 delay-300 mb-16">
                    {[
                        { icon: UserPlusIcon, title: "Consistency", desc: "Identity-locked actors across scenes.", color: "text-indigo-400" },
                        { icon: SparklesIcon, title: "High-Fidelity", desc: "Generative 3D visual blueprints.", color: "text-amber-400" },
                        { icon: VideoIcon, title: "Workflow", desc: "Timeline sequencing & master export.", color: "text-emerald-400" }
                    ].map((feature, i) => (
                        <div key={i} className="flex flex-col items-center p-5 bg-white/[0.01] border border-white/5 rounded-2xl backdrop-blur-xl group hover:bg-white/[0.03] transition-all cursor-default">
                            <feature.icon className={`w-5 h-5 ${feature.color} mb-2 group-hover:scale-110 transition-transform`} />
                            <h3 className="text-[9px] font-black text-white uppercase tracking-widest mb-1">{feature.title}</h3>
                            <p className="text-[7px] text-gray-500 font-bold leading-relaxed uppercase">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* LAYER 3: FIXED VIDEO HOLDERS (8 Slots Total - HOVER TO PLAY) */}
            {!isMinimalView && (
                <div className="relative z-30 w-full px-8 pb-16 hidden md:block">
                    <div className="max-w-7xl mx-auto flex flex-col gap-6 animate-in slide-in-from-bottom-10 duration-1000 delay-700">
                        {/* Row 1: Active Reels (Hover to Play) */}
                        <div className="grid grid-cols-4 gap-6">
                            {REEL_VIDEOS.map((src, i) => (
                                <HoverVideo key={i} src={src} />
                            ))}
                        </div>
                        {/* Row 2: Empty Holders */}
                        <div className="grid grid-cols-4 gap-6">
                            {PLACEHOLDER_SLOTS.map((slot) => (
                                <div key={slot} className="aspect-video bg-black/20 rounded-xl border border-dashed border-white/5 flex flex-col items-center justify-center group hover:border-white/10 transition-all opacity-40 hover:opacity-100">
                                    <div className="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center mb-2">
                                        <ClapperboardIcon className="w-3 h-3 text-gray-800" />
                                    </div>
                                    <span className="text-[7px] font-black text-gray-800 uppercase tracking-[0.4em]">Empty Holder</span>
                                </div>
                            ))}
                        </div>
                        
                        <p className="text-[8px] font-black text-gray-700 uppercase tracking-[1.2em] text-center mt-8 ml-[1.2em] opacity-30">Professional Creative Environment</p>
                    </div>
                </div>
            )}

            {/* Mobile Fallback */}
            {isMobile && !isMinimalView && (
                 <div className="relative z-30 px-4 mt-4 pb-12">
                    <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-none snap-x">
                        {[...REEL_VIDEOS, ...PLACEHOLDER_SLOTS.map(() => REEL_VIDEOS[0])].map((src, i) => (
                            <div key={i} className="min-w-[240px] aspect-video bg-black/40 rounded-xl border border-white/10 overflow-hidden snap-center">
                                {i < 4 ? (
                                    <video src={src} autoPlay muted loop playsInline className="w-full h-full object-cover opacity-60" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-black/20">
                                        <ClapperboardIcon className="w-4 h-4 text-gray-800 mb-2" />
                                        <span className="text-[6px] font-black text-gray-800 uppercase">Reserved</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-[6px] font-black text-gray-700 uppercase tracking-[0.8em] text-center opacity-30">Professional Creative Environment</p>
                </div>
            )}

            {/* AUTH OVERLAY */}
            {showAuthOverlay && !session && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-full max-w-md">
                        <Auth onBack={() => setShowAuthOverlay(false)} isOverlay={true} />
                    </div>
                </div>
            )}

            {/* Visual Overlays */}
            <div className="fixed inset-0 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] contrast-150 mix-blend-overlay z-[60]"></div>
        </div>
    );
};