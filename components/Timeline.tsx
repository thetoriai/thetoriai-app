// Production Timeline: Binary Engine (Professional Edition)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PlayIcon, XIcon, PlusIcon, VideoIcon, DownloadIcon, MusicalNoteIcon, SpeakerWaveIcon, ChevronDownIcon, UploadIcon, TrashIcon, Logo, SparklesIcon, DocumentTextIcon, FilmIcon, AdjustmentsIcon, PhotoIcon, StopIcon, ArrowsRightLeftIcon, MagnifyingGlassPlusIcon } from './Icons';

interface TimelineProps {
    clips: { 
        id: string; 
        url: string; 
        duration: number; 
        startTime: number;
        originalDuration: number;
        videoObject?: any; 
        isLoading?: boolean; 
        sourceUrl?: string; 
        error?: string;
        isMuted?: boolean;
        fadeIn?: boolean;
        fadeOut?: boolean;
        scale?: number;
        panX?: number;
    }[];
    audioClips: {
        id: string;
        url: string;
        duration: number;
        startTime: number; 
        isLoading?: boolean;
        isMuted?: boolean;
        fadeIn?: boolean;
        fadeOut?: boolean;
    }[];
    textClips: {
        id: string;
        text: string;
        startTime: number;
        duration: number;
        bgColor?: string;
        fadeIn?: boolean;
        fadeOut?: boolean;
        hasBackground?: boolean;
        fontSize?: number;
    }[];
    onUpdateTextClips: (clips: any[]) => void;
    onReorder: (newClips: any[]) => void;
    onReorderAudio: (newClips: any[]) => void;
    onDelete: (id: string) => void;
    onDeleteAudio: (id: string) => void;
    onExtend: (id: string, prompt: string) => void;
    onPlayAll: () => void;
    onUpdateClip: (id: string, updates: any) => void;
    onUpdateAudioClip: (id: string, updates: any) => void;
    onAddClip: (url: string, file?: File, duration?: number, startTime?: number) => void;
    onAddAudioClip: (url: string, duration?: number, startTime?: number) => void;
    onClear: () => void;
    onCreateScene: (clipId: string) => void;
    onExport: () => void;
    isMinimized: boolean;
    setIsMinimized: (val: boolean) => void;
    isTheaterMode: boolean;
    setIsTheaterMode: (val: boolean) => void;
    onCaptureFrame?: (base64: string) => void;
}

const PIXELS_PER_SECOND = 40; 

export const Timeline: React.FC<TimelineProps> = ({ 
    clips = [], 
    audioClips = [], 
    textClips = [],
    onUpdateTextClips,
    onDelete,
    onDeleteAudio, 
    onAddClip, 
    onAddAudioClip, 
    onExport,
    onUpdateClip,
    onUpdateAudioClip,
    onCaptureFrame,
}) => {
    const [playbackTime, setPlaybackTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedClip, setSelectedClip] = useState<{ id: string, type: 'video' | 'audio' | 'text' } | null>(null);
    const [masterAspectRatio, setMasterAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [activeMenuClipId, setActiveMenuClipId] = useState<string | null>(null);
    
    const monitorRef = useRef<HTMLVideoElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const replacementInputRef = useRef<HTMLInputElement>(null);
    const captureCanvasRef = useRef<HTMLCanvasElement>(null);
    const audioTrackRef = useRef<HTMLAudioElement>(null);
    const seekCaptureRef = useRef<HTMLVideoElement>(null);
    
    const requestRef = useRef<number>(null);
    const lastTickRef = useRef<number>(0);
    const isScrubbingRef = useRef(false);

    const [dragging, setDragging] = useState<{ id: string, type: 'text' | 'audio' | 'video', startX: number, originalTime: number } | null>(null);
    const [trimming, setTrimming] = useState<{ id: string, type: 'text' | 'audio' | 'video', startX: number, startDuration: number } | null>(null);

    const contentDuration = Math.max(
        ...clips.map(c => (c.startTime || 0) + c.duration), 
        ...audioClips.map(a => a.startTime + a.duration), 
        ...textClips.map(t => t.startTime + t.duration), 
        0.1
    );

    // Track-specific end times for independent sequential loading
    const videoTrackEnd = Math.max(0, ...clips.map(c => (c.startTime || 0) + c.duration));
    const audioTrackEnd = Math.max(0, ...audioClips.map(a => a.startTime + a.duration));
    const textTrackEnd = Math.max(0, ...textClips.map(t => t.startTime + t.duration));

    const viewportDuration = Math.max(contentDuration + 15, 30);

    // RESET SETTINGS ON ASPECT RATIO CHANGE
    useEffect(() => {
        clips.forEach(clip => {
            onUpdateClip(clip.id, { scale: 1, panX: 0 });
        });
    }, [masterAspectRatio]);

    // CLICK OUTSIDE TO CLOSE MENU
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (activeMenuClipId && !(e.target as HTMLElement).closest('.clip-block')) {
                setActiveMenuClipId(null);
            }
        };
        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, [activeMenuClipId]);

    const getActiveClipAtTime = (time: number) => {
        if (clips.length === 0) return null;
        
        // HOLD LAST FRAME: If playhead is at or past the end of the total timeline, 
        // show the final visible frame of the last clip in the visual track.
        if (time >= contentDuration) {
            const lastClip = clips[clips.length - 1];
            return { clip: lastClip, internalTime: Math.max(0, lastClip.duration - 0.1) };
        }

        for (const clip of clips) {
            const start = clip.startTime || 0;
            if (time >= start && time < start + clip.duration) {
                return { clip, internalTime: time - start };
            }
        }
        return null;
    };

    const activeEntry = getActiveClipAtTime(playbackTime);
    const activeText = textClips.find(t => playbackTime >= t.startTime && playbackTime < t.startTime + t.duration);
    const activeAudio = audioClips.find(a => playbackTime >= a.startTime && playbackTime < a.startTime + a.duration);

    const animate = useCallback((time: number) => {
        if (lastTickRef.current !== 0) {
            const delta = (time - lastTickRef.current) / 1000;
            setPlaybackTime(prev => {
                const next = prev + delta;
                if (next >= contentDuration) {
                    setIsPlaying(false);
                    return contentDuration;
                }
                return next;
            });
        }
        lastTickRef.current = time;
        if (isPlaying) requestRef.current = requestAnimationFrame(animate);
    }, [isPlaying, contentDuration]);

    useEffect(() => {
        if (isPlaying) {
            lastTickRef.current = performance.now();
            requestRef.current = requestAnimationFrame(animate);
        } else {
            lastTickRef.current = 0;
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [isPlaying, animate]);

    useEffect(() => {
        if (monitorRef.current && activeEntry) {
            const targetTime = activeEntry.internalTime;
            if (!isPlaying || Math.abs(monitorRef.current.currentTime - targetTime) > 0.15) {
                monitorRef.current.currentTime = targetTime;
            }
            let videoVolume = (activeEntry.clip as any).isMuted ? 0 : 1;
            if (activeEntry.clip.fadeIn && activeEntry.internalTime < 1) videoVolume *= activeEntry.internalTime;
            if (activeEntry.clip.fadeOut && activeEntry.internalTime > activeEntry.clip.duration - 1) videoVolume *= (activeEntry.clip.duration - activeEntry.internalTime);
            monitorRef.current.volume = Math.max(0, Math.min(1, videoVolume));
            monitorRef.current.muted = false;

            const isAtGlobalEnd = playbackTime >= contentDuration;
            if (isPlaying && !isAtGlobalEnd && activeEntry.internalTime < activeEntry.clip.duration) {
                monitorRef.current.play().catch(() => {});
            } else {
                monitorRef.current.pause();
            }
        } else if (monitorRef.current) {
            monitorRef.current.pause();
        }

        if (audioTrackRef.current) {
            if (activeAudio) {
                const targetTime = playbackTime - activeAudio.startTime;
                if (audioTrackRef.current.src !== activeAudio.url) audioTrackRef.current.src = activeAudio.url;
                if (!isPlaying || Math.abs(audioTrackRef.current.currentTime - targetTime) > 0.1) audioTrackRef.current.currentTime = targetTime;
                let audioVolume = (activeAudio as any).isMuted ? 0 : 1;
                const internalTime = playbackTime - activeAudio.startTime;
                if (activeAudio.fadeIn && internalTime < 1) audioVolume *= internalTime;
                if (activeAudio.fadeOut && internalTime > activeAudio.duration - 1) audioVolume *= (activeAudio.duration - internalTime);
                audioTrackRef.current.volume = Math.max(0, Math.min(1, audioVolume));
                if (isPlaying) audioTrackRef.current.play().catch(() => {});
                else audioTrackRef.current.pause();
            } else {
                audioTrackRef.current.pause();
            }
        }
    }, [activeEntry, activeAudio, isPlaying, playbackTime, contentDuration]);

    const performScrub = (clientX: number) => {
        if (!scrollAreaRef.current) return;
        const rect = scrollAreaRef.current.getBoundingClientRect();
        const clickX = clientX - rect.left + scrollAreaRef.current.scrollLeft - 48;
        let targetTime = Math.max(0, Math.min(clickX / PIXELS_PER_SECOND, contentDuration));
        setPlaybackTime(targetTime);
    };

    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (isScrubbingRef.current) performScrub(e.clientX);
            else if (trimming) {
                let newDur = Math.max(0.1, trimming.startDuration + (e.clientX - trimming.startX) / PIXELS_PER_SECOND);
                if (trimming.type === 'video') onUpdateClip(trimming.id, { duration: newDur });
                else if (trimming.type === 'audio') onUpdateAudioClip(trimming.id, { duration: newDur });
                else if (trimming.type === 'text') onUpdateTextClips(textClips.map(t => t.id === trimming.id ? { ...t, duration: newDur } : t));
            } else if (dragging) {
                const newTime = Math.max(0, dragging.originalTime + (e.clientX - dragging.startX) / PIXELS_PER_SECOND);
                if (dragging.type === 'text') onUpdateTextClips(textClips.map(t => t.id === dragging.id ? { ...t, startTime: newTime } : t));
                else if (dragging.type === 'audio') onUpdateAudioClip(dragging.id, { startTime: newTime });
                else if (dragging.type === 'video') onUpdateClip(dragging.id, { startTime: newTime });
            }
        };
        const handleGlobalMouseUp = () => { isScrubbingRef.current = false; setTrimming(null); setDragging(null); };
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => { window.removeEventListener('mousemove', handleGlobalMouseMove); window.removeEventListener('mouseup', handleGlobalMouseUp); };
    }, [trimming, dragging, onUpdateClip, onUpdateAudioClip, onUpdateTextClips, textClips]);

    const snapFrameToStage = async (clipId: string) => {
        const targetClip = clips.find(c => c.id === clipId);
        if (!targetClip || !captureCanvasRef.current || !onCaptureFrame || !seekCaptureRef.current) return;
        
        const video = seekCaptureRef.current;
        video.src = targetClip.url;
        
        await new Promise<void>((resolve) => {
            video.onloadedmetadata = () => {
                video.currentTime = targetClip.duration;
                resolve();
            };
        });
        
        await new Promise<void>((resolve) => {
            video.onseeked = () => resolve();
        });

        const canvas = captureCanvasRef.current;
        canvas.width = video.videoWidth || 1280; 
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            onCaptureFrame(canvas.toDataURL('image/png').split(',')[1]);
        }
        setActiveMenuClipId(null);
    };

    // INDEPENDENT FADE LOGIC: Calculates opacity for each track separately
    const getVideoOpacity = () => {
        if (!activeEntry) return 0;
        const { clip, internalTime } = activeEntry;
        let opacity = 1;
        if (clip.fadeIn && internalTime < 1) opacity = internalTime;
        if (clip.fadeOut && internalTime > clip.duration - 1) opacity = clip.duration - internalTime;
        return Math.max(0, opacity);
    };

    const getTextOpacity = () => {
        if (!activeText) return 0;
        const internalTime = playbackTime - activeText.startTime;
        let opacity = 1;
        if (activeText.fadeIn && internalTime < 1) opacity = internalTime;
        if (activeText.fadeOut && internalTime > activeText.duration - 1) opacity = activeText.duration - internalTime;
        return Math.max(0, opacity);
    };

    const currentVideoOpacity = getVideoOpacity();
    const currentTextOpacity = getTextOpacity();

    const renderCompactSettings = () => {
        if (!selectedClip) return null;
        const data = (selectedClip.type === 'video' ? clips.find(c => c.id === selectedClip.id) : selectedClip.type === 'audio' ? audioClips.find(a => a.id === selectedClip.id) : textClips.find(t => t.id === selectedClip.id)) as any;
        if (!data) return null;

        return (
            <div className="flex items-center gap-6 bg-black/60 border border-white/10 rounded-2xl px-6 py-2 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-1.5 border-r border-white/10 pr-4">
                    <button onClick={() => {
                        if (selectedClip.type === 'video') onUpdateClip(selectedClip.id, { fadeIn: !data.fadeIn });
                        else if (selectedClip.type === 'audio') onUpdateAudioClip(selectedClip.id, { fadeIn: !data.fadeIn });
                        else onUpdateTextClips(textClips.map(t => t.id === selectedClip.id ? { ...t, fadeIn: !t.fadeIn } : t));
                    }} className={`px-2 py-1 rounded-lg border text-[8px] font-black uppercase transition-all ${data.fadeIn ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-transparent border-white/5 text-gray-500'}`}>In</button>
                    <button onClick={() => {
                        if (selectedClip.type === 'video') onUpdateClip(selectedClip.id, { fadeOut: !data.fadeOut });
                        else if (selectedClip.type === 'audio') onUpdateAudioClip(selectedClip.id, { fadeOut: !data.fadeOut });
                        else onUpdateTextClips(textClips.map(t => t.id === selectedClip.id ? { ...t, fadeOut: !t.fadeOut } : t));
                    }} className={`px-2 py-1 rounded-lg border text-[8px] font-black uppercase transition-all ${data.fadeOut ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-transparent border-white/5 text-gray-500'}`}>Out</button>
                </div>

                {selectedClip.type === 'video' && masterAspectRatio === '9:16' && (
                    <div className="flex items-center gap-4 border-r border-white/10 pr-4">
                        <div className="flex flex-col gap-1 w-20">
                            <div className="flex justify-between items-center"><span className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Zoom</span><span className="text-[7px] text-indigo-400 font-bold">{Math.round((data.scale || 1) * 100)}%</span></div>
                            <input type="range" min="1" max="3" step="0.1" value={data.scale || 1} onChange={(e) => onUpdateClip(selectedClip.id, { scale: parseFloat(e.target.value) })} className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                        </div>
                        <div className="flex flex-col gap-1 w-20">
                            <div className="flex justify-between items-center"><span className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Pan</span><span className="text-[7px] text-indigo-400 font-bold">{Math.round((data.panX || 0))}%</span></div>
                            <input type="range" min="-100" max="100" value={data.panX || 0} onChange={(e) => onUpdateClip(selectedClip.id, { panX: parseInt(e.target.value) })} className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                        </div>
                    </div>
                )}

                {(selectedClip.type === 'video' || selectedClip.type === 'audio') && (
                    <button onClick={() => {
                        if (selectedClip.type === 'video') onUpdateClip(selectedClip.id, { isMuted: !data.isMuted });
                        else onUpdateAudioClip(selectedClip.id, { isMuted: !data.isMuted });
                    }} className={`p-1.5 rounded-lg transition-all ${data.isMuted ? 'text-red-500 bg-red-900/10' : 'text-emerald-500 bg-emerald-900/10'}`}>
                        <SpeakerWaveIcon className="w-5 h-5"/>
                    </button>
                )}

                {selectedClip.type === 'text' && (
                    <div className="flex items-center gap-4">
                        <button onClick={() => onUpdateTextClips(textClips.map(t => t.id === selectedClip.id ? { ...t, hasBackground: !t.hasBackground } : t))} className={`p-1.5 rounded-lg transition-all ${data.hasBackground ? 'text-indigo-400 bg-indigo-900/20' : 'text-gray-600'}`}>
                            <PhotoIcon className="w-5 h-5"/>
                        </button>
                        {data.hasBackground && (
                            <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                                <input type="color" value={data.bgColor || '#000000'} onChange={(e) => onUpdateTextClips(textClips.map(t => t.id === selectedClip.id ? { ...t, bgColor: e.target.value } : t))} className="w-6 h-6 rounded-md bg-transparent border-none cursor-pointer" />
                                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Tint</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                            <span className="text-[8px] font-black text-gray-500 uppercase">Size</span>
                            <input type="range" min="20" max="150" value={data.fontSize || 60} onChange={(e) => onUpdateTextClips(textClips.map(t => t.id === selectedClip.id ? { ...t, fontSize: parseInt(e.target.value) } : t))} className="w-24 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                        </div>
                    </div>
                )}

                <button onClick={() => {
                    if (selectedClip.type === 'video') onDelete(selectedClip.id);
                    else if (selectedClip.type === 'audio') onDeleteAudio(selectedClip.id);
                    else onUpdateTextClips(textClips.filter(t => t.id !== selectedClip.id));
                    setSelectedClip(null);
                }} className="p-1.5 text-gray-600 hover:text-red-500 transition-colors" title="Discard Sequence">
                    <TrashIcon className="w-5 h-5" />
                </button>
                
                <button onClick={() => setSelectedClip(null)} className="p-1.5 text-gray-700 hover:text-white border-l border-white/5 pl-4 transition-colors">
                    <XIcon className="w-4 h-4"/>
                </button>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-[#020617] overflow-hidden select-none font-sans">
            <div className="h-10 bg-[#0a0f1d] border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-[110]">
                <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-red-600 animate-pulse' : 'bg-gray-600'}`}></div>
                    <span className="text-[9px] font-bold text-indigo-400 tracking-widest uppercase italic">Master production signal</span>
                </div>
                <div className="flex gap-1 bg-black/40 rounded-lg p-0.5 border border-white/10 scale-90">
                    <button onClick={() => setMasterAspectRatio('16:9')} className={`px-3 py-0.5 rounded text-[9px] font-bold transition-all ${masterAspectRatio === '16:9' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>16:9</button>
                    <button onClick={() => setMasterAspectRatio('9:16')} className={`px-3 py-0.5 rounded text-[9px] font-bold transition-all ${masterAspectRatio === '9:16' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>9:16</button>
                </div>
                <Logo className="w-5 h-5 opacity-40 grayscale" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center bg-[#030712] overflow-hidden relative p-8">
                <div className={`relative shadow-[0_0_100px_rgba(0,0,0,1)] bg-black border border-white/5 transition-all duration-500 overflow-hidden ${masterAspectRatio === '16:9' ? 'aspect-video h-[98%]' : 'aspect-[9/16] h-[98%]'}`}>
                    {/* VIDEO LAYER: Uses its own independent opacity */}
                    <div className="w-full h-full" style={{ opacity: currentVideoOpacity }}>
                        {activeEntry ? (
                            <video 
                                ref={monitorRef} 
                                key={activeEntry.clip.id} 
                                src={activeEntry.clip.url} 
                                className="w-full h-full object-contain transition-transform duration-300" 
                                style={{ transform: `scale(${activeEntry.clip.scale || 1}) translateX(${activeEntry.clip.panX || 0}%)` }}
                                playsInline 
                            />
                        ) : (
                            <div className="w-full h-full bg-black"></div>
                        )}
                    </div>

                    {/* TEXT LAYER: Uses its own independent opacity and background logic */}
                    {activeText && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-700" style={{ opacity: currentTextOpacity, backgroundColor: activeText.hasBackground ? (activeText.bgColor || 'rgba(0,0,0,0.85)') : 'transparent' }}>
                            <h3 className="text-white font-black italic tracking-tighter drop-shadow-[0_4px_40px_rgba(0,0,0,1)] text-center px-16 leading-tight transition-all" style={{ fontSize: `${activeText.fontSize || 60}px` }}>{activeText.text}</h3>
                        </div>
                    )}
                </div>
            </div>

            <div className="h-20 bg-[#0f172a] border-t border-white/10 flex items-center px-10 z-[100] shrink-0 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-8 shrink-0">
                    <button 
                        onClick={() => setIsPlaying(!isPlaying)} 
                        onDoubleClick={() => { setIsPlaying(false); setPlaybackTime(0); }}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.6)] scale-105' : 'bg-indigo-600 hover:bg-indigo-500 shadow-xl active:scale-90'}`}
                        title="Tap Play/Pause. Double-tap Stop/Reset."
                    >
                        {isPlaying ? <div className="w-5 h-5 bg-white rounded-sm"></div> : <PlayIcon className="w-6 h-7 text-white ml-0.5" />}
                    </button>
                    <div className="flex flex-col min-w-[140px]">
                        <span className="text-[28px] font-mono font-black text-indigo-400 tracking-tighter leading-none">00:00:{playbackTime.toFixed(2).padStart(5, '0')}</span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1.5 italic">Master clock signal</span>
                    </div>
                </div>
                
                <div className="flex-1 flex justify-center px-8 overflow-hidden">
                    {renderCompactSettings()}
                </div>
                
                <div className="flex items-center gap-4 shrink-0">
                    <button onClick={onExport} className="w-14 h-14 bg-indigo-600 hover:bg-indigo-50 text-white rounded-2xl transition-all shadow-xl flex items-center justify-center active:scale-95 border border-white/10 group" title="Export Master">
                        <DownloadIcon className="w-6 h-6 group-hover:-translate-y-0.5 transition-transform" />
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-[#020617] relative flex flex-col overflow-hidden border-t border-white/10">
                <div className="absolute left-0 top-0 bottom-0 w-12 bg-[#0a0f1d] border-r border-white/10 z-[80] flex flex-col pt-12 gap-8 px-1 items-center">
                    <div className="h-6 flex items-center justify-center opacity-20 hover:opacity-100 hover:scale-110 transition-all cursor-pointer" title="Append text" onClick={() => {
                        onUpdateTextClips([...textClips, { id: Date.now().toString(), text: "Production Title", startTime: textTrackEnd, duration: 4, fadeIn: true, fadeOut: true, hasBackground: false, fontSize: 60 }]);
                    }}><DocumentTextIcon className="w-5 h-5 text-amber-500"/></div>
                    <div className="h-6 flex items-center justify-center opacity-20 hover:opacity-100 hover:scale-110 transition-all cursor-pointer" title="Import visual" onClick={() => fileInputRef.current?.click()}><FilmIcon className="w-5 h-5 text-indigo-500"/></div>
                    <div className="h-6 flex items-center justify-center opacity-20 hover:opacity-100 hover:scale-110 transition-all cursor-pointer" title="Import audio" onClick={() => audioInputRef.current?.click()}><MusicalNoteIcon className="w-5 h-5 text-emerald-500"/></div>
                </div>

                <div ref={scrollAreaRef} className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-professional relative" onMouseDown={(e) => { if(!(e.target as HTMLElement).closest('.clip-block')) { isScrubbingRef.current = true; performScrub(e.clientX); } }}>
                    <div className="relative" style={{ width: `${viewportDuration * PIXELS_PER_SECOND + 800}px`, marginLeft: '48px' }}>
                        <div className="h-10 border-b border-white/5 sticky top-0 bg-[#0a0f1d]/90 backdrop-blur-md z-40 flex items-end px-2">
                            {Array.from({ length: Math.ceil(viewportDuration / 5) + 5 }).map((_, i) => (
                                <div key={i} className="absolute border-l border-gray-800 h-3 flex items-end" style={{ left: `${i * 5 * PIXELS_PER_SECOND}px` }}><span className="text-[9px] font-black text-gray-700 ml-1.5 mb-0.5">{i * 5}s</span></div>
                            ))}
                        </div>

                        <div className="flex flex-col py-4 gap-3">
                            <div className="relative w-full h-10 border-b border-white/[0.02]">
                                {textClips.map((t) => (
                                    <div key={t.id} onMouseDown={(e) => { e.stopPropagation(); setDragging({ id: t.id, type: 'text', startX: e.clientX, originalTime: t.startTime }); }} onClick={() => setSelectedClip({ id: t.id, type: 'text' })} onDoubleClick={(e) => { e.stopPropagation(); setEditingTextId(t.id); }} className={`clip-block absolute h-8 rounded-none flex items-center px-4 group cursor-pointer transition-all ${selectedClip?.id === t.id && selectedClip.type === 'text' ? 'ring-2 ring-indigo-500 bg-indigo-600/40 shadow-xl z-50' : 'bg-amber-600/10 border border-amber-500/20 hover:border-amber-500/50'}`} style={{ left: `${t.startTime * PIXELS_PER_SECOND}px`, width: `${t.duration * PIXELS_PER_SECOND}px` }}>
                                        {editingTextId === t.id ? (
                                            <input autoFocus value={t.text} onBlur={() => setEditingTextId(null)} onKeyDown={e => e.key === 'Enter' && setEditingTextId(null)} onChange={e => onUpdateTextClips(textClips.map(tc => tc.id === t.id ? { ...tc, text: e.target.value } : tc))} className="bg-transparent text-[10px] font-black text-amber-200 outline-none w-full" />
                                        ) : (
                                            <span className="text-[10px] font-black text-amber-200 truncate uppercase tracking-widest">{t.text}</span>
                                        )}
                                        <div onMouseDown={(e) => { e.stopPropagation(); setTrimming({ id: t.id, type: 'text', startX: e.clientX, startDuration: t.duration }); }} className="absolute top-0 right-0 bottom-0 w-2.5 cursor-col-resize hover:bg-amber-500/30 transition-colors z-[40] rounded-none"></div>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="relative w-full h-12 border-b border-white/[0.02]">
                                {clips.map((clip) => (
                                    <div key={clip.id} onMouseDown={(e) => { if((e.target as HTMLElement).closest('button')) return; e.stopPropagation(); setDragging({ id: clip.id, type: 'video', startX: e.clientX, originalTime: clip.startTime || 0 }); }} onClick={() => setSelectedClip({ id: clip.id, type: 'video' })} className={`clip-block absolute h-10 bg-[#1e293b]/40 border rounded-none transition-all cursor-pointer group ${selectedClip?.id === clip.id && selectedClip.type === 'video' ? 'bg-indigo-900 border-indigo-500 z-50 ring-2 ring-indigo-500/40 shadow-2xl scale-[1.02]' : 'border-white/10 hover:bg-[#334155]/40 hover:border-white/20'}`} style={{ left: `${(clip.startTime || 0) * PIXELS_PER_SECOND}px`, width: `${clip.duration * PIXELS_PER_SECOND}px` }}>
                                        <div className="absolute right-1 top-1 bottom-1 flex items-center justify-center">
                                            <button onClick={(e) => { e.stopPropagation(); setActiveMenuClipId(activeMenuClipId === clip.id ? null : clip.id); }} className={`p-1 rounded-md transition-all ${activeMenuClipId === clip.id ? 'bg-indigo-500 text-white' : 'bg-black/40 text-gray-400 hover:text-white'}`}><PlusIcon className="w-3.5 h-3.5"/></button>
                                            {activeMenuClipId === clip.id && (
                                                <div className="absolute left-full ml-2 flex flex-col bg-[#0a0f1d] border border-indigo-500/30 rounded-lg shadow-2xl overflow-hidden z-[200]">
                                                    <button onClick={(e) => { e.stopPropagation(); replacementInputRef.current?.click(); }} className="p-3 hover:bg-indigo-600 transition-colors border-b border-white/5" title="Import Asset"><UploadIcon className="w-4 h-4 text-indigo-400"/></button>
                                                    <button onClick={(e) => { e.stopPropagation(); snapFrameToStage(clip.id); }} className="p-3 hover:bg-indigo-600 transition-colors" title="Capture Frame"><SparklesIcon className="w-4 h-4 text-amber-500"/></button>
                                                </div>
                                            )}
                                        </div>
                                        <div onMouseDown={(e) => { e.stopPropagation(); setTrimming({ id: clip.id, type: 'video', startX: e.clientX, startDuration: clip.duration }); }} className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-500/50 transition-colors z-[40] rounded-none border-r border-indigo-400/30"></div>
                                    </div>
                                ))}
                            </div>

                            <div className="relative w-full h-10">
                                {audioClips.map((audio) => (
                                    <div key={audio.id} onMouseDown={(e) => { if((e.target as HTMLElement).closest('button')) return; e.stopPropagation(); setDragging({ id: audio.id, type: 'audio', startX: e.clientX, originalTime: audio.startTime }); }} onClick={() => setSelectedClip({ id: audio.id, type: 'audio' })} className={`clip-block absolute h-8 rounded-none overflow-hidden group cursor-pointer transition-all border ${audio.isMuted ? 'bg-gray-900 border-gray-700/50' : 'bg-emerald-950/20 border-emerald-500/20'} ${selectedClip?.id === audio.id && selectedClip.type === 'audio' ? 'ring-2 ring-emerald-500 z-50 shadow-2xl' : ''}`} style={{ width: `${audio.duration * PIXELS_PER_SECOND}px`, left: `${audio.startTime * PIXELS_PER_SECOND}px` }}>
                                        <div className={`w-full h-full flex items-center px-4 gap-[2px] pointer-events-none transition-opacity ${audio.isMuted ? 'opacity-20' : 'opacity-40'}`}>
                                            {Array.from({ length: Math.floor(audio.duration * 8) }).map((_, i) => (
                                                <div key={i} className={`flex-1 rounded-full ${audio.isMuted ? 'bg-gray-700' : 'bg-emerald-400'}`} style={{ height: `${20 + Math.abs(Math.sin(i * 0.5 + (audio.id.length % 5))) * 60}%` }} />
                                            ))}
                                        </div>
                                        <div onMouseDown={(e) => { e.stopPropagation(); setTrimming({ id: audio.id, type: 'audio', startX: e.clientX, startDuration: audio.duration }); }} className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize hover:bg-emerald-500/30 transition-colors z-[40] rounded-none"></div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="absolute top-0 bottom-0 w-[2px] bg-red-600 z-[70] shadow-[0_0_20px_rgba(220,38,38,0.8)] pointer-events-none" style={{ left: `${playbackTime * PIXELS_PER_SECOND}px` }}>
                            <div className="absolute -top-[1px] -left-[5px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-red-600 drop-shadow-lg"></div>
                        </div>
                    </div>
                </div>
            </div>

            <audio ref={audioTrackRef} className="hidden" />
            <canvas ref={captureCanvasRef} className="hidden" />
            <video ref={seekCaptureRef} className="hidden" muted crossOrigin="anonymous" />
            <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={e => { if (e.target.files?.[0]) { const url = URL.createObjectURL(e.target.files[0]); const v = document.createElement('video'); v.src = url; v.onloadedmetadata = () => {
                onAddClip(url, e.target.files![0], v.duration, videoTrackEnd);
            }; } e.target.value = ''; }} />
            <input type="file" ref={replacementInputRef} className="hidden" accept="video/*" onChange={e => { if (e.target.files?.[0]) { const url = URL.createObjectURL(e.target.files[0]); const v = document.createElement('video'); v.src = url; v.onloadedmetadata = () => { 
                onAddClip(url, e.target.files![0], v.duration, videoTrackEnd); 
                setActiveMenuClipId(null); 
            }; } e.target.value = ''; }} />
            <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={e => { if (e.target.files?.[0]) { const url = URL.createObjectURL(e.target.files[0]); const a = new Audio(url); a.onloadedmetadata = () => {
                onAddAudioClip(url, a.duration, audioTrackEnd);
            }; } e.target.value = ''; }} />
        </div>
    );
};
