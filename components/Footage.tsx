
import React, { useState, useRef, useEffect } from 'react';
import { SparklesIcon, VideoIcon, ClapperboardIcon, PhotoIcon, LoaderIcon, BookmarkIcon, PlusIcon, TrashIcon, UploadIcon, HistoryIcon, XIcon, ArrowsRightLeftIcon, ChevronDownIcon, FilmIcon } from './Icons';
import { SceneProgressOverlay } from './Card';
import type { Character } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';

interface FootageCardProps {
    item: any;
    onSave: () => void;
    onAddToTimeline: () => void;
    onToVideo: () => void;
    onDelete: () => void;
    isSaved: boolean;
    isGeneratingVideo?: boolean;
}

const FootageCard: React.FC<FootageCardProps> = ({ item, onSave, onAddToTimeline, onToVideo, onDelete, isSaved, isGeneratingVideo }) => {
    const isVideo = item.type === 'video' || (item.videoClips && item.videoClips.length > 0);
    const displaySrc = item.src ? (item.src.startsWith('data') ? item.src : `data:image/png;base64,${item.src}`) : null;
    const latestVideo = item.videoClips?.[item.videoClips.length - 1]?.videoUrl;

    return (
        <div className="flex flex-col bg-[#0f172a]/60 border border-white/5 rounded-xl overflow-hidden shadow-2xl group animate-in zoom-in-95 duration-500 hover:border-indigo-500/30 transition-all">
            <div className="relative aspect-video bg-black overflow-hidden">
                {item.status === 'pending' || item.status === 'generating' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/50 backdrop-blur-sm">
                        <LoaderIcon className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest animate-pulse">Producing...</span>
                    </div>
                ) : isGeneratingVideo ? (
                    <SceneProgressOverlay onStop={() => {}} label="Rendering Motion..." />
                ) : (
                    <>
                        {latestVideo ? (
                            <video src={latestVideo} autoPlay loop muted playsInline className="w-full h-full object-contain" />
                        ) : (
                            <img src={displaySrc || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
                        )}
                        <div className="absolute top-3 left-3">
                            <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest border shadow-lg ${isVideo ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-indigo-600 border-indigo-400 text-white'}`}>
                                {isVideo ? 'Motion Clip' : 'Fixed Frame'}
                            </span>
                        </div>
                    </>
                )}
            </div>

            <div className="p-2.5 flex items-center justify-between bg-white/[0.02] border-t border-white/5">
                <div className="flex gap-1.5">
                    <button 
                        onClick={onSave}
                        className={`p-2 rounded-lg transition-all ${isSaved ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'}`}
                        title="Save to History"
                    >
                        <BookmarkIcon className="w-3.5 h-3.5" solid={isSaved} />
                    </button>
                    <button 
                        onClick={onDelete}
                        className="p-2 bg-white/5 text-gray-500 hover:bg-red-900/30 hover:text-red-400 rounded-lg transition-all"
                        title="Discard"
                    >
                        <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="flex gap-1.5">
                    {!isVideo && item.status === 'complete' && (
                        <button 
                            onClick={onToVideo}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-indigo-600 text-gray-400 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border border-white/5"
                        >
                            <VideoIcon className="w-3 h-3" />
                            Motion
                        </button>
                    )}
                    <button 
                        disabled={item.status !== 'complete'}
                        onClick={onAddToTimeline}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all shadow-lg disabled:opacity-30"
                    >
                        <FilmIcon className="w-3 h-3" />
                        Timeline
                    </button>
                </div>
            </div>
        </div>
    );
};

interface FootageProps {
    characters: Character[];
    visualStyle: string;
    aspectRatio: string;
    characterStyle: string;
    selectedCountry: string;
    onProduce: (prompt: string, mode: 'image' | 'video' | 'i2i', refImage?: string, videoTier?: string, imageTier?: string) => void;
    isGenerating?: boolean;
    creditBalance: number;
    footageHistory: any[];
    onSaveItem: (item: any) => void;
    onDeleteItem: (id: string) => void;
    onToTimeline: (item: any) => void;
    onAnimate: (item: any) => void;
    savedItems: any[];
    // Persistent Props from App
    footagePrompt: string;
    setFootagePrompt: (v: string) => void;
    footageMode: 'image' | 'video';
    setFootageMode: (v: 'image' | 'video') => void;
    footageVideoTier: string;
    setFootageVideoTier: (v: string) => void;
    footageImageTier: string;
    setFootageImageTier: (v: string) => void;
    footageRefImages: (string | null)[];
    setFootageRefImages: (v: (string | null)[]) => void;
}

export const Footage: React.FC<FootageProps> = ({
    visualStyle,
    aspectRatio,
    characterStyle,
    selectedCountry,
    onProduce,
    isGenerating = false,
    footageHistory = [],
    onSaveItem,
    onDeleteItem,
    onToTimeline,
    onAnimate,
    savedItems,
    footagePrompt,
    setFootagePrompt,
    footageMode,
    setFootageMode,
    footageVideoTier,
    setFootageVideoTier,
    footageImageTier,
    setFootageImageTier,
    footageRefImages,
    setFootageRefImages
}) => {
    const [activeSlotIdx, setActiveSlotIdx] = useState<number | null>(null);
    const [showHistoryPicker, setShowHistoryPicker] = useState(false);
    const [showTierMenu, setShowTierMenu] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const tierMenuRef = useRef<HTMLDivElement>(null);

    const hasRefImages = footageRefImages.some(img => img !== null);
    const isSlot1Filled = !!footageRefImages[0];
    const isSlot2Filled = !!footageRefImages[1];
    const isSlot3Filled = !!footageRefImages[2];
    const showTransitionArrow = isSlot1Filled && isSlot2Filled && !isSlot3Filled;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (tierMenuRef.current && !tierMenuRef.current.contains(e.target as Node)) {
                setShowTierMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleProduce = () => {
        if (!footagePrompt.trim() || isGenerating) return;
        const activeMode = hasRefImages ? 'i2i' : footageMode;
        onProduce(footagePrompt, activeMode as any, footageRefImages[0] || undefined, footageVideoTier, footageImageTier);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0] && activeSlotIdx !== null) {
            const base64 = await fileToBase64(e.target.files[0]);
            const next = [...footageRefImages];
            next[activeSlotIdx] = base64;
            setFootageRefImages(next);
            setActiveSlotIdx(null);
        }
    };

    const selectFromHistory = (src: string) => {
        if (activeSlotIdx !== null) {
            const next = [...footageRefImages];
            next[activeSlotIdx] = src;
            setFootageRefImages(next);
            setActiveSlotIdx(null);
            setShowHistoryPicker(false);
        }
    };

    const clearSlot = (idx: number) => {
        const next = [...footageRefImages];
        next[idx] = null;
        setFootageRefImages(next);
    };

    let cost = footageImageTier === 'pro' ? 2 : 1;
    if (footageMode === 'video') {
        cost = footageVideoTier === 'veo31-quality' ? 8 : 5;
    }

    return (
        <div className="w-full h-full flex flex-col bg-[#030712] animate-in fade-in duration-500 overflow-hidden font-sans">
            
            <div className="w-full shrink-0 bg-[#0a0f1d] border-b border-white/5 py-8 md:py-14 z-20">
                <div className="max-w-2xl mx-auto px-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="space-y-1">
                            <h2 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">
                                Quick <span className="text-indigo-500">Footage</span> Desk
                            </h2>
                            <div className="flex items-center gap-2.5">
                                <div className="w-1 h-1 rounded-full bg-red-600 animate-pulse"></div>
                                <p className="text-[8px] font-black text-gray-600 uppercase tracking-[0.4em]">Rapid Terminal</p>
                            </div>
                        </div>
                        <div className="flex gap-1.5">
                            <div className={`px-2 py-0.5 border rounded-md text-[7px] font-black uppercase tracking-widest transition-all ${hasRefImages ? 'bg-gray-800/50 border-white/5 text-gray-500' : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400'}`}>
                                {visualStyle}
                            </div>
                            <div className={`px-2 py-0.5 border rounded-md text-[7px] font-black uppercase tracking-widest transition-all ${hasRefImages ? 'bg-gray-800/50 border-white/5 text-gray-500' : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400'}`}>
                                {selectedCountry}
                            </div>
                            <div className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-md text-[7px] font-black text-gray-500 uppercase tracking-widest">
                                {aspectRatio}
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#030712] border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col relative group">
                        <div className="flex flex-col">
                            <textarea
                                value={footagePrompt}
                                onChange={(e) => setFootagePrompt(e.target.value)}
                                placeholder="Describe footage blueprint..."
                                className="w-full h-20 bg-transparent border-none p-5 text-sm font-bold text-white placeholder-gray-800 resize-none focus:outline-none leading-relaxed italic scrollbar-none"
                            />
                            
                            <div className="px-5 pb-4 flex items-center gap-3">
                                {footageRefImages.map((img, idx) => (
                                    <React.Fragment key={idx}>
                                        <div className="relative group/slot">
                                            {img ? (
                                                <div className="w-20 h-14 rounded-lg overflow-hidden border border-indigo-500/50 shadow-lg relative group">
                                                    <img src={img.startsWith('data') ? img : `data:image/png;base64,${img}`} className="w-full h-full object-cover" />
                                                    <button onClick={() => clearSlot(idx)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                        <XIcon className="w-4 h-4 text-white" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-20 h-14 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all bg-black/40 border-white/10 hover:border-indigo-500 hover:bg-indigo-500/5 group/empty shadow-inner">
                                                    <div className="flex flex-col gap-1 w-full h-full p-1 opacity-60 group-hover/empty:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => { setActiveSlotIdx(idx); setShowHistoryPicker(true); }}
                                                            className="flex-1 rounded bg-white/10 hover:bg-indigo-600 flex items-center justify-center gap-1 text-[7px] font-black uppercase text-gray-300 hover:text-white transition-all shadow-sm"
                                                        >
                                                            <HistoryIcon className="w-2.5 h-2.5" /> HIST
                                                        </button>
                                                        <button 
                                                            onClick={() => { setActiveSlotIdx(idx); fileInputRef.current?.click(); }}
                                                            className="flex-1 rounded bg-white/10 hover:bg-indigo-600 flex items-center justify-center gap-1 text-[7px] font-black uppercase text-gray-300 hover:text-white transition-all shadow-sm"
                                                        >
                                                            <UploadIcon className="w-2.5 h-2.5" /> COMP
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {idx === 0 && showTransitionArrow && (
                                            <div className="animate-in fade-in zoom-in duration-300">
                                                <ArrowsRightLeftIcon className="w-4 h-4 text-indigo-500" />
                                            </div>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>

                            <div className="border-t border-white/5 bg-white/[0.02] p-2 flex flex-col sm:flex-row gap-2 items-center">
                                <div className="flex-1 w-full bg-black/40 rounded-xl p-1 flex items-center gap-1">
                                    <button 
                                        onClick={() => setFootageMode('image')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${footageMode === 'image' && !hasRefImages ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'}`}
                                    >
                                        <PhotoIcon className="w-3.5 h-3.5" />
                                        Instant Image
                                    </button>
                                    <button 
                                        onClick={() => setFootageMode('video')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${footageMode === 'video' && !hasRefImages ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'}`}
                                    >
                                        <VideoIcon className="w-3.5 h-3.5" />
                                        Direct Video
                                    </button>
                                    
                                    {hasRefImages && (
                                        <div className="flex-1 bg-indigo-900/40 rounded-lg p-1 flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-widest text-indigo-400 animate-in fade-in slide-in-from-left-2">
                                            <SparklesIcon className="w-3.5 h-3.5" />
                                            {isSlot3Filled ? 'Combination' : 'I2I Active'}
                                        </div>
                                    )}
                                </div>

                                <div className="relative w-full sm:w-auto">
                                    <button 
                                        onClick={handleProduce}
                                        disabled={isGenerating || !footagePrompt.trim()}
                                        className="w-full sm:w-44 h-11 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-[0.2em] rounded-xl shadow-xl transition-all active:scale-95 disabled:bg-gray-950 disabled:text-gray-800 disabled:shadow-none flex items-center justify-center gap-3 border border-red-500/20"
                                    >
                                        {isGenerating ? (
                                            <LoaderIcon className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <ClapperboardIcon className="w-4 h-4" />
                                                <span className="text-[11px]">Initiate</span>
                                                <div className="h-3 w-px bg-white/20"></div>
                                                <div 
                                                    onClick={(e) => { e.stopPropagation(); setShowTierMenu(!showTierMenu); }}
                                                    className={`flex items-center gap-1 py-1 px-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer ring-1 ring-white/10`}
                                                >
                                                    <span className="text-[8px] font-black tracking-widest">{cost}C</span>
                                                    <ChevronDownIcon className="w-2 h-2 opacity-60" />
                                                </div>
                                            </>
                                        )}
                                    </button>

                                    {showTierMenu && (
                                        <div ref={tierMenuRef} className="absolute bottom-full right-0 mb-3 w-44 bg-[#0a0f1d] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-200 z-[100]">
                                            {footageMode === 'image' ? (
                                                [
                                                    { id: 'fast', label: 'Flash Image', cost: 1 },
                                                    { id: 'pro', label: 'Pro Image', cost: 2 }
                                                ].map((tier) => (
                                                    <button 
                                                        key={tier.id}
                                                        onClick={() => { setFootageImageTier(tier.id); setShowTierMenu(false); }}
                                                        className={`w-full flex items-center justify-between p-3 text-[9px] font-black uppercase tracking-widest transition-colors ${footageImageTier === tier.id ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                                                    >
                                                        <span>{tier.label}</span>
                                                        <span className="opacity-60">{tier.cost}C</span>
                                                    </button>
                                                ))
                                            ) : (
                                                [
                                                    { id: 'veo31-fast', label: 'Veo Fast', cost: 5 },
                                                    { id: 'veo31-quality', label: 'Veo Quality', cost: 8 }
                                                ].map((tier) => (
                                                    <button 
                                                        key={tier.id}
                                                        onClick={() => { setFootageVideoTier(tier.id); setShowTierMenu(false); }}
                                                        className={`w-full flex items-center justify-between p-3 text-[9px] font-black uppercase tracking-widest transition-colors ${footageVideoTier === tier.id ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                                                    >
                                                        <span>{tier.label}</span>
                                                        <span className="opacity-60">{tier.cost}C</span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-professional relative bg-[#030712] p-6 md:p-10">
                <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/5 blur-[100px] rounded-full"></div>
                </div>

                <div className="max-w-6xl mx-auto relative z-10">
                    <div className="flex items-center gap-4 mb-8">
                        <h3 className="text-[9px] font-black text-gray-600 uppercase tracking-[0.4em] whitespace-nowrap">Current Session Gallery</h3>
                        <div className="h-px bg-white/5 flex-1"></div>
                        <span className="text-[8px] font-black text-indigo-400/40 uppercase tracking-widest">{footageHistory.length} assets</span>
                    </div>

                    {footageHistory.length === 0 && !isGenerating ? (
                        <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in duration-1000">
                            <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6">
                                <ClapperboardIcon className="w-6 h-6 text-gray-800" />
                            </div>
                            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-700">Studio Floor Empty</h4>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                            {footageHistory.map((item, idx) => (
                                <FootageCard 
                                    key={item.sceneId || idx}
                                    item={item}
                                    isSaved={savedItems.some(s => s.sceneId === item.sceneId)}
                                    onSave={() => onSaveItem(item)}
                                    onDelete={() => onDeleteItem(item.sceneId)}
                                    onAddToTimeline={() => onToTimeline(item)}
                                    onToVideo={() => onAnimate(item)}
                                    isGeneratingVideo={item.videoStatus === 'loading'}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showHistoryPicker && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowHistoryPicker(false)}>
                    <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-4xl h-[70vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0a0f1d]">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2"><HistoryIcon className="w-5 h-5 text-indigo-500"/> Select Reference Asset</h3>
                            <button onClick={() => setShowHistoryPicker(false)} className="p-2 bg-white/5 hover:bg-red-900/30 text-gray-500 hover:text-red-400 rounded-full transition-all"><XIcon className="w-6 h-6"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 scrollbar-thin">
                            {savedItems.length === 0 ? (
                                <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-20">
                                    <BookmarkIcon className="w-12 h-12 mb-4"/>
                                    <p className="text-[10px] font-black uppercase tracking-widest">No saved assets found</p>
                                </div>
                            ) : (
                                savedItems.map((item, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => selectFromHistory(item.src)}
                                        className="aspect-video bg-black rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-indigo-500 transition-all hover:scale-[1.02] shadow-lg"
                                    >
                                        <img src={item.src.startsWith('data') ? item.src : `data:image/png;base64,${item.src}`} className="w-full h-full object-cover" />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
        </div>
    );
};
