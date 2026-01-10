
import React, { useState, useRef, useEffect } from 'react';
import { XIcon, DownloadIcon, CameraIcon, UserPlusIcon, CreditCardIcon, SparklesIcon, VideoIcon, FilmIcon, CheckIcon } from './Icons';
import { CAMERA_ANGLE_OPTIONS } from '../services/geminiService';
import type { Character, Storybook, Outfit } from '../services/geminiService';
import { ImageEditor } from './ImageEditor';
import { HistoryPanel } from './History';
import { StorybookCreator } from './Storybook';
import { Timeline } from './Timeline';
import { Storyboard } from './Storyboard';
import { ActorRoster } from './ActorRoster';
import { PAYPAL_STARTER_LINK, PAYPAL_PRO_LINK, PAYPAL_STUDIO_LINK } from '../utils/constants';

interface ModalsProps {
    activeModal: string | null; setActiveModal: (modal: string | null) => void; modalData: any; onClose: () => void; onConfirm?: () => void;
    storybookContent: Storybook; setStorybookContent: (data: Storybook) => void; onGenerateFromStorybook: (scenes: string[]) => void;
    history: any[]; masterHistory: any[]; onLoadHistory: (index: number, sceneId?: string, restore?: boolean) => void; onDeleteHistory?: (index: number) => void; onDeleteHistoryImage?: (sessionId: number, sceneId: string) => void; onClearHistory: () => void;
    characters: Character[]; onEditImage: (prompt: string, mask?: string, style?: string, refImage?: string | null) => void; onEditImageInModal?: (genId: number, sceneId: string, src: string, variants: any[]) => void; onApplyCameraAngle: (angle: string, subject?: string) => void;
    costPerImage: number; currencySymbol: string; exchangeRate: number;
    savedItems: any[]; characterStyle: string; selectedCountry: string; onToggleSave: (card: any) => void;
    imageModel?: string; setImageModel?: (val: string) => void; onGenerateSingleStorybookScene?: (index: number, model: string) => void;
    creditBalance?: number; onUpdateModalData?: (newData: any) => void; isGenerating?: boolean; onUpdateImage?: (base64: string) => void;
    onSwapOutfit?: (sceneIndex: number, outfit: Outfit) => Promise<void>;
    onAddAudioToTimeline?: (url: string, duration: number) => void;
    onAddAudioClip?: (url: string, duration?: number, startTime?: number) => void;
    onDeductAudioCredit?: () => boolean;
    onResetStorybook: () => void;
    storySeed: string;
    setStorySeed: (val: string) => void;
    visualStyle?: string;

    // Timeline Specific
    timelineClips?: any[];
    audioClips?: any[];
    textClips?: any[];
    onUpdateTextClips?: (clips: any[]) => void;
    onUpdateTimelineClip?: (id: string, updates: any) => void;
    onDeleteTimelineClip?: (id: string) => void;
    onAddTimelineClip?: (url: string, file?: File, duration?: number, startTime?: number) => void;
    onCaptureFrameFromTimeline?: (base64: string) => void;
    onExportTimeline?: () => void;

    // Storyboard Specific
    generationItem?: any;
    historyIndex?: number;
    activeVideoIndices?: number[];
    onOpenVideoCreator?: (idx: number) => void;
    onGenerateVideo?: (genId: number, sceneId: string, script?: string, cameraMovement?: string, withAudio?: boolean) => void;
    onAddToTimeline?: (url: string, duration?: number, videoObject?: any) => void;
    videoModel?: string;
    setVideoModel?: (val: string) => void;
    setVideoResolution?: (val: string) => void;
    onSwitchSession?: (index: number) => void;
    onNewSession?: () => void;
    onUpdateVideoDraft?: (genId: number, sceneId: string, updates: any) => void;
    activeI2ISlot?: { genId: number, sceneId: string } | null;
    setActiveI2ISlot?: (slot: { genId: number, sceneId: string } | null) => void;
    onUploadStartImage?: (file: File) => void;
    onUploadToSession?: (file: File, sessionId: number) => void;
    onDeleteScene?: (genId: number, sceneId: string) => void;
    onUndoEdit?: (genId: number, sceneId: string) => void;
    // DO add comment above each fix. Added missing onRegenerateScene and onAngleSelect to ModalsProps.
    onRegenerateScene?: (genId: number, sceneId: string) => void;
    onAngleSelect?: (genId: number, sceneId: string) => void;

    // Roster Specific
    setCharacters?: React.Dispatch<React.SetStateAction<Character[]>>;
    handleBuildCharacterVisual?: (id: number) => void;
    handleUploadNewCharacterImage?: (file: File) => void;
    handleCharacterImageUpload?: (file: File, id: number) => void;
    updateCharacter?: (id: number, props: Partial<Character>) => void;
    removeCharacter?: (id: number) => void;
    onToggleHero?: (id: number) => void;

    // Variant Management
    onAddSceneVariant?: (genId: number, sceneId: string, src: string, prompt: string, angleName: string) => void;
    onSelectSceneVariant?: (genId: number, sceneId: string, variantIndex: number) => void;
    onSceneVariantChange?: (genId: number, sceneId: string, direction: 'next' | 'prev') => void;
    onUpdateSceneImage?: (genId: number, sceneId: string, base64: string) => void;
}

const ModalWrapper = ({ children, title, onClose }: { children?: React.ReactNode, title: string, onClose: () => void }) => (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-xl p-0 md:p-6" onClick={onClose}>
        <div className="w-full h-full md:max-w-[95vw] md:max-h-[92vh] bg-gray-950 md:rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden border border-white/5 animate-in fade-in zoom-in-[0.98] duration-500" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#0a0f1d] shrink-0">
                <h2 className="text-sm font-black text-gray-500 uppercase tracking-[0.4em] ml-4">{title}</h2>
                <button onClick={onClose} className="p-2 mr-2 bg-gray-800/50 hover:bg-red-900/30 rounded-full transition-all text-gray-400 hover:text-red-400"><XIcon className="w-6 h-6"/></button>
            </div>
            <div className="flex-1 overflow-hidden h-full flex flex-col">
                {children}
            </div>
        </div>
    </div>
);

const BuyCreditsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div className="flex-1 flex flex-col items-center justify-center p-4 bg-gray-950 overflow-hidden">
        <div className="flex flex-col items-center max-w-5xl w-full animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center mb-6">
                <h2 className="text-3xl font-black text-white italic tracking-tighter mb-1 uppercase leading-none">Studio Top-Up</h2>
                <div className="inline-block px-3 py-1 bg-indigo-600/10 border border-indigo-500/30 rounded-full">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic">Pay-As-You-Go • No Monthly Fees</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-8">
                <div className="bg-[#0f172a] border border-sky-500/20 rounded-3xl p-5 flex flex-col items-center text-center transition-all hover:scale-[1.02] group">
                    <h3 className="text-xl font-black text-white mb-1 italic tracking-tighter uppercase leading-none">Line Up</h3>
                    <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-3xl font-black text-white tracking-tighter">$12</span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">One-time</span>
                    </div>
                    <a href={PAYPAL_STARTER_LINK} target="_blank" className="w-full py-3 bg-sky-600 text-white font-black text-[10px] uppercase tracking-widest rounded-lg shadow-lg mb-6 hover:bg-sky-500 transition-colors">Purchase Now</a>
                    <div className="w-full border border-sky-500/40 rounded-xl p-4 flex flex-col gap-2 bg-sky-950/10 text-left">
                        <div className="flex items-center gap-2 text-sky-300"><CheckIcon className="w-3.5 h-3.5 shrink-0"/><span className="text-[9px] font-black uppercase tracking-wider">100 Production Credits</span></div>
                    </div>
                </div>

                <div className="bg-white/[0.03] border-2 border-white/20 rounded-3xl p-5 flex flex-col items-center text-center scale-105 z-10 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 right-0 bg-white text-[8px] font-black text-black py-1 uppercase tracking-[0.2em]">MOST POPULAR</div>
                    <h3 className="text-xl font-black text-white mb-1 italic tracking-tighter uppercase leading-none">Production</h3>
                    <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-3xl font-black text-white tracking-tighter">$25</span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic leading-none">Best Value</span>
                    </div>
                    <a href={PAYPAL_PRO_LINK} target="_blank" className="w-full py-3 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-lg shadow-lg mb-6 hover:bg-gray-200 transition-all hover:scale-105">Get 300 Credits</a>
                    <div className="w-full border border-white/10 rounded-xl p-4 flex flex-col gap-2 bg-white/5 text-left">
                        <div className="flex items-center gap-2 text-white"><CheckIcon className="w-3.5 h-3.5 shrink-0 text-white"/><span className="text-[9px] font-black uppercase tracking-wider">300 Production Credits</span></div>
                    </div>
                </div>

                <div className="bg-[#0f172a] border border-amber-500/20 rounded-3xl p-5 flex flex-col items-center text-center transition-all hover:scale-[1.02] group">
                    <h3 className="text-xl font-black text-white mb-1 italic tracking-tighter uppercase leading-none">Studio</h3>
                    <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-3xl font-black text-white tracking-tighter">$50</span>
                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Max Power</span>
                    </div>
                    <a href={PAYPAL_STUDIO_LINK} target="_blank" className="w-full py-3 bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest rounded-lg shadow-lg mb-6 hover:bg-amber-500 transition-colors">Purchase Now</a>
                    <div className="w-full border border-amber-500/40 rounded-xl p-4 flex flex-col gap-2 bg-amber-900/5 text-left">
                        <div className="flex items-center gap-2 text-amber-400"><CheckIcon className="w-3.5 h-3.5 shrink-0"/><span className="text-[9px] font-black uppercase tracking-wider">700 Production Credits</span></div>
                    </div>
                </div>
            </div>

            <div className="w-full max-w-xl bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] italic">New Account Welcome Gift: 1,000 Credits Applied Automatically</span>
            </div>
        </div>
    </div>
);

const VideoExporter: React.FC<{ clips: any[], onClose: () => void }> = ({ clips, onClose }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('Starting render engine...');
    const [isComplete, setIsComplete] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [currentClipIndex, setCurrentClipIndex] = useState(0);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const animationFrameRef = useRef<number | null>(null);
    const [exportExt, setExportExt] = useState('webm');

    useEffect(() => {
        const startExport = async () => {
            if (!canvasRef.current || !videoRef.current || clips.length === 0) return;
            const canvas = canvasRef.current; const video = videoRef.current; const ctx = canvas.getContext('2d'); if(!ctx) return;
            const stream = canvas.captureStream(30);
            let mimeType = 'video/webm'; let ext = 'webm';
            if (MediaRecorder.isTypeSupported('video/mp4')) { mimeType = 'video/mp4'; ext = 'mp4'; } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) { mimeType = 'video/webm;codecs=h264'; ext = 'webm'; }
            setExportExt(ext);
            const recorder = new MediaRecorder(stream, { mimeType: mimeType }); recorderRef.current = recorder; chunksRef.current = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType }); const url = URL.createObjectURL(blob);
                setDownloadUrl(url); setIsComplete(true); setStatus('Render Complete!');
                const a = document.createElement('a'); a.href = url; a.download = `timeline_export_${Date.now()}.${ext}`; a.click();
            };
            recorder.start(); setStatus('Rendering video... Do not close.');
            for (let i = 0; i < clips.length; i++) {
                setCurrentClipIndex(i); const clip = clips[i]; setStatus(`Rendering Clip ${i + 1}/${clips.length}...`);
                await new Promise<void>((resolve) => {
                    video.src = clip.url; video.muted = true; video.crossOrigin = "anonymous";
                    video.onloadedmetadata = () => { canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720; };
                    video.oncanplay = () => { video.play(); drawFrame(); };
                    const drawFrame = () => { if (video.paused || video.ended) return; ctx.drawImage(video, 0, 0, canvas.width, canvas.height); animationFrameRef.current = requestAnimationFrame(drawFrame); };
                    video.onended = () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); resolve(); };
                    video.onerror = () => { console.error("Video load error for clip", i); resolve(); };
                });
                setProgress(((i + 1) / clips.length) * 100);
            }
            recorder.stop();
        };
        startExport();
        return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); if (recorderRef.current && recorderRef.current.state === 'recording') recorderRef.current.stop(); };
    }, []); 

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 backdrop-blur-2xl">
            <div className="bg-gray-900 border border-gray-700 rounded-[2rem] p-8 max-w-lg w-full text-center shadow-2xl animate-in zoom-in-95 duration-300">
                <h3 className="text-2xl font-black text-white mb-2 tracking-tighter italic">Exporting Master</h3>
                <div className="relative aspect-video bg-black rounded-2xl overflow-hidden mb-6 border border-gray-800 shadow-inner"><canvas ref={canvasRef} className="w-full h-full object-contain" /><video ref={videoRef} className="hidden" /></div>
                <div className="w-full bg-gray-800 rounded-full h-2 mb-3"><div className="bg-indigo-600 h-2 rounded-full transition-all duration-300 shadow-[0_0_100px_rgba(99,102,241,0.5)]" style={{ width: `${progress}%` }}></div></div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest animate-pulse mb-8">{status}</p>
                {isComplete ? (
                    <div className="flex gap-3 justify-center"><a href={downloadUrl || '#'} download={`timeline_export.${exportExt}`} className="flex-1 flex items-center justify-center gap-2 py-4 bg-green-600 hover:bg-green-700 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg transition-all"><DownloadIcon className="w-4 h-4"/> Get Video</a><button onClick={onClose} className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all">Done</button></div>
                ) : <button onClick={onClose} className="px-6 py-3 bg-red-900/20 hover:bg-red-800 border border-red-800/30 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">Cancel</button>}
            </div>
        </div>
    );
};

export const Modals: React.FC<ModalsProps> = ({ activeModal, setActiveModal, modalData, onClose, storybookContent, setStorybookContent, onGenerateFromStorybook, history, masterHistory, onLoadHistory, onDeleteHistory, onDeleteHistoryImage, onClearHistory, characters, onEditImage, onApplyCameraAngle, costPerImage, currencySymbol, exchangeRate, savedItems, characterStyle, selectedCountry, onToggleSave, imageModel, setImageModel, onGenerateSingleStorybookScene, creditBalance = 0, onUpdateModalData, isGenerating = false, onUpdateImage, onSwapOutfit, onAddAudioToTimeline, onAddAudioClip, onDeductAudioCredit, onResetStorybook, storySeed, setStorySeed, timelineClips, audioClips, textClips, onUpdateTextClips, onUpdateTimelineClip, onDeleteTimelineClip, onAddTimelineClip, onCaptureFrameFromTimeline, onExportTimeline, generationItem, historyIndex, activeVideoIndices, onOpenVideoCreator, onGenerateVideo, onAddToTimeline, videoModel, setVideoModel, setVideoResolution, onSwitchSession, onNewSession, onUpdateVideoDraft, activeI2ISlot, setActiveI2ISlot, setCharacters, handleBuildCharacterVisual, handleUploadNewCharacterImage, handleCharacterImageUpload, updateCharacter, removeCharacter, onToggleHero, onUploadStartImage, onUploadToSession, onDeleteScene, onUndoEdit, onAddSceneVariant, onSelectSceneVariant, onSceneVariantChange, onUpdateSceneImage, onRegenerateScene, onAngleSelect, visualStyle }) => {
    const [selectedAngle, setSelectedAngle] = useState('');
    const [focusSubject, setFocusSubject] = useState('');
    const [isConfirmingAngle, setIsConfirmingAngle] = useState(false); 
    const angleContentRef = useRef<HTMLDivElement>(null);

    useEffect(() => setIsConfirmingAngle(false), [activeModal, selectedAngle]);

    useEffect(() => {
        if (!isConfirmingAngle) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (angleContentRef.current && !angleContentRef.current.contains(e.target as Node)) {
                setIsConfirmingAngle(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isConfirmingAngle]);

    if (!activeModal) return null;
    
    if (activeModal === 'export-video') return <VideoExporter clips={modalData.clips} onClose={onClose} />;
    
    if (activeModal === 'image-preview') return <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl" onClick={onClose}><div className="relative max-w-5xl max-h-full" onClick={e => e.stopPropagation()}><button onClick={onClose} className="absolute -top-12 right-0 text-white hover:text-indigo-400 transition-colors p-2"><XIcon className="w-8 h-8"/></button><img src={modalData.src} className="max-w-full max-h-[90vh] object-contain rounded-3xl shadow-2xl border border-white/5" /></div></div>;
    
    if (activeModal === 'edit-image') {
        const currentSession = history.find(h => h.id === modalData.genId);
        const existingVersions = (modalData.variants || []).map((v: any) => v.src);
        return (
            <ImageEditor 
                isOpen={true} 
                imageSrc={modalData.src} 
                initialVersions={existingVersions}
                initialPrompt="" 
                aspectRatio={currentSession?.aspectRatio || '16:9'} 
                imageStyle={currentSession?.visualStyle || '3D Render'} 
                genre={currentSession?.genre || 'General'} 
                characters={characters} 
                imageModel={imageModel || 'gemini-3-pro-image-preview'} 
                onClose={onClose} 
                onSave={(newImageSrc, newPrompt) => { 
                    // EDIT SAVE FIDELITY: Ensure the selected thumbnail from the editor is saved as the active visual on the card.
                    if (onUpdateSceneImage) onUpdateSceneImage(modalData.genId, modalData.sceneId, newImageSrc);
                    onClose(); 
                }} 
                onUpdateImage={(newSrc, prompt) => { 
                    if (onAddSceneVariant) onAddSceneVariant(modalData.genId, modalData.sceneId, newSrc, prompt || "Edited variation", "Edit");
                }} 
            />
        );
    }

    if (activeModal === 'history') {
        return (
            <ModalWrapper title="Production History" onClose={onClose}>
                <HistoryPanel 
                    history={history} 
                    masterHistory={masterHistory} 
                    savedItems={savedItems} 
                    onClose={onClose} 
                    // DO add comment above each fix. Change handleLoadHistory to onLoadHistory to correctly reference the prop.
                    onLoadHistory={onLoadHistory} 
                    onClearHistory={onClearHistory} 
                    onToggleSave={onToggleSave} 
                />
            </ModalWrapper>
        );
    }

    if (activeModal === 'storybook') {
        return <StorybookCreator storybookContent={storybookContent} setStorybookContent={setStorybookContent} characters={characters} characterStyle={characterStyle} selectedCountry={selectedCountry} creditBalance={creditBalance} onClose={onClose} onGenerateFromStorybook={onGenerateFromStorybook} onGenerateSingleStorybookScene={onGenerateSingleStorybookScene} onSwapOutfit={onSwapOutfit} onAddAudioToTimeline={onAddAudioToTimeline} onAddAudioClip={onAddAudioClip} onDeductAudioCredit={onDeductAudioCredit} onResetStorybook={onResetStorybook} storySeed={storySeed} setStorySeed={setStorySeed} />;
    }

    if (activeModal === 'timeline') {
        return (
            <ModalWrapper title="Story Timeline" onClose={onClose}>
                <Timeline 
                    clips={timelineClips || []} 
                    audioClips={audioClips || []}
                    textClips={textClips || []}
                    onUpdateTextClips={onUpdateTextClips || (() => {})}
                    onReorder={() => {}}
                    onReorderAudio={() => {}}
                    onDelete={onDeleteTimelineClip || (() => {})}
                    onDeleteAudio={() => {}}
                    onUpdateClip={onUpdateTimelineClip || (() => {})}
                    onUpdateAudioClip={() => {}}
                    onClear={() => {}}
                    onExport={onExportTimeline || (() => {})}
                    isMinimized={false}
                    setIsMinimized={() => {}}
                    isTheaterMode={true}
                    setIsTheaterMode={() => {}}
                    onAddClip={onAddTimelineClip}
                    onAddAudioClip={onAddAudioClip}
                    onCaptureFrame={onCaptureFrameFromTimeline}
                    onExtend={() => {}}
                    onPlayAll={() => {}}
                    onCreateScene={() => {}}
                />
            </ModalWrapper>
        );
    }

    if (activeModal === 'storyboard') {
        return (
            <ModalWrapper title="Production Stage" onClose={onClose}>
                <Storyboard 
                    generationItem={generationItem} 
                    savedItems={savedItems} 
                    history={history} 
                    historyIndex={historyIndex ?? -1}
                    onSaveScene={(gid, sid) => { const sess = history.find(h => h.id === gid); const img = sess?.imageSet.find((s:any) => s.sceneId === sid); if(img) onToggleSave(img); }}
                    onEditScene={(gid, sid) => { const sess = history.find(h => h.id === gid); const img = sess?.imageSet.find((s:any) => s.sceneId === sid); onUpdateModalData?.({ genId: gid, sceneId: sid, src: img.src, variants: img.variants || [] }); setActiveModal('edit-image'); }}
                    // DO add comment above each fix. Passed onRegenerateScene and onAngleSelect to Storyboard.
                    onRegenerateScene={onRegenerateScene || (() => {})}
                    onAngleSelect={onAngleSelect || (() => {})}
                    onOpenVideoCreator={onOpenVideoCreator || (() => {})}
                    onGenerateVideo={onGenerateVideo || (() => {})}
                    onAddToTimeline={onAddToTimeline || (() => {})}
                    isGenerating={isGenerating}
                    isDisabled={false}
                    activeVideoIndices={activeVideoIndices || []}
                    videoModel={videoModel || ''}
                    setVideoModel={setVideoModel || (() => {})}
                    setVideoResolution={setVideoResolution || (() => {})}
                    onPreviewImage={(src) => onUpdateModalData?.({ src })}
                    onSwitchSession={onSwitchSession || (() => {})}
                    onNewSession={onNewSession || (() => {})}
                    onUpdateVideoDraft={onUpdateVideoDraft || (() => {})}
                    creditBalance={creditBalance}
                    onStop={() => {}}
                    currency="USD"
                    activeI2ISlot={activeI2ISlot || null}
                    setActiveI2ISlot={setActiveI2ISlot || (() => {})}
                    onUploadStartImage={onUploadStartImage}
                    onUploadToSession={onUploadToSession}
                    onDeleteScene={onDeleteScene}
                    onUndoEdit={onUndoEdit}
                    onSceneVariantChange={onSceneVariantChange}
                />
            </ModalWrapper>
        );
    }

    if (activeModal === 'roster') {
        return (
            <ModalWrapper title="Character Roster" onClose={onClose}>
                <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-gray-800">
                    <div className="max-w-4xl mx-auto w-full">
                        <ActorRoster 
                            characters={characters} 
                            setCharacters={setCharacters || (() => {})}
                            handleBuildCharacterVisual={handleBuildCharacterVisual || (() => {})}
                            handleUploadNewCharacterImage={handleUploadNewCharacterImage || (() => {})}
                            handleCharacterImageUpload={handleCharacterImageUpload || (() => {})}
                            updateCharacter={updateCharacter || (() => {})}
                            removeCharacter={removeCharacter || (() => {})}
                            onToggleHero={onToggleHero || (() => {})}
                            visualStyle={visualStyle}
                        />
                    </div>
                </div>
            </ModalWrapper>
        );
    }

    if (activeModal === 'buy-credits') {
        return (
            <ModalWrapper title="Credit Exchange" onClose={onClose}>
                <BuyCreditsModal onClose={onClose} />
            </ModalWrapper>
        );
    }

    if (activeModal === 'camera-angles') {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
                <div ref={angleContentRef} className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-gray-800 flex justify-between items-center"><h2 className="font-bold text-white flex items-center gap-2"><CameraIcon className="w-5 h-5"/> Camera Angles</h2><button onClick={onClose} className="p-2"><XIcon className="w-5 h-5 text-gray-500 hover:text-white"/></button></div>
                    <div className="p-4 max-h-[70vh] overflow-y-auto space-y-6">
                        {/* Sync Character Row */}
                        <div>
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-3">Sync Character (Focus Actor)</label>
                            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                                {characters.map((char) => (
                                    <button 
                                        key={char.id} 
                                        onClick={() => setFocusSubject(char.name)}
                                        className={`shrink-0 w-12 h-12 rounded-full border-2 transition-all relative group ${focusSubject === char.name ? 'border-indigo-500 scale-110 ring-4 ring-indigo-500/20' : 'border-gray-800 opacity-40 grayscale hover:opacity-100 hover:grayscale-0'}`}
                                        title={char.name}
                                    >
                                        {char.imagePreview ? (
                                            <img src={char.imagePreview} className="w-full h-full object-cover rounded-full" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-full"><UserPlusIcon className="w-4 h-4 text-gray-600"/></div>
                                        )}
                                        {focusSubject === char.name && (
                                            <div className="absolute -top-1 -right-1 bg-indigo-500 text-white rounded-full p-0.5 shadow-lg animate-in zoom-in">
                                                <CheckIcon className="w-2 h-2" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[8px] text-gray-600 font-bold uppercase mt-2 tracking-widest italic">Locks visual identity to specific actor</p>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-3">Select Framing</label>
                            <div className="grid grid-cols-2 gap-2">
                                {CAMERA_ANGLE_OPTIONS.map((angle) => (
                                    <button 
                                        key={angle.key} 
                                        onClick={() => setSelectedAngle(angle.name)} 
                                        className={`p-2 text-left rounded-lg border transition-all ${selectedAngle === angle.name ? 'bg-indigo-900/50 border-indigo-500 text-white shadow-lg' : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-600 hover:bg-gray-900'}`}
                                    >
                                        <div className="text-[11px] font-black uppercase tracking-tight">{angle.name}</div>
                                        <div className="text-[8px] opacity-60 leading-tight mt-0.5 font-bold">{angle.description}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-800 flex justify-end items-center gap-3 bg-[#0a0f1d]">
                        {isConfirmingAngle && <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Cost: 2 Credits</span>}
                        {isConfirmingAngle && <button onClick={() => setIsConfirmingAngle(false)} className="text-[10px] font-black text-gray-500 hover:text-gray-300 uppercase tracking-widest mr-2">Cancel</button>}
                        <button 
                            onClick={() => isConfirmingAngle ? onApplyCameraAngle(selectedAngle, focusSubject) : setIsConfirmingAngle(true)} 
                            disabled={!selectedAngle} 
                            className={`px-6 py-2.5 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-2xl transition-all flex items-center gap-2 active:scale-95 ${isConfirmingAngle ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-800 disabled:text-gray-500'}`}
                        >
                            {isConfirmingAngle ? 'Confirm Production' : <><CameraIcon className="w-4 h-4"/> Initiate Shot</>}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};