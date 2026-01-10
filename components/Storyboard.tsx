
import React, { useRef, useState, useEffect } from 'react';
import { SparklesIcon, PlusIcon, UploadIcon, XIcon, ClapperboardIcon, BookOpenIcon, Logo, MusicalNoteIcon, LoaderIcon, HistoryIcon, FilmIcon } from './Icons';
import { SceneCard } from './Card';

interface StoryboardProps {
    generationItem: any;
    savedItems: any[];
    onSaveScene: (genId: number, sceneId: string) => void;
    onEditScene: (genId: number, sceneId: string) => void;
    onRegenerateScene: (genId: number, sceneId: string) => void;
    onAngleSelect: (genId: number, sceneId: string) => void;
    onDeleteScene?: (genId: number, sceneId: string) => void; 
    onOpenVideoCreator: (idx: number) => void;
    onGenerateVideo: (genId: number, sceneId: string, script?: string, cameraMovement?: string) => void;
    onAddToTimeline: (videoUrl: string, duration?: number, videoObject?: any) => void;
    onStop: () => void;
    isGenerating: boolean;
    isDisabled: boolean;
    activeVideoIndices: number[];
    videoModel: string;
    videoResolution?: string;
    setVideoModel: (val: string) => void;
    setVideoResolution: (val: string) => void;
    onPreviewImage: (src: string | null) => void;
    onUploadStartImage?: (file: File) => void;
    onUploadToSession?: (file: File, sessionId?: number) => void;
    onUploadAudioStory?: (file: File) => void;
    isProcessingAudio?: boolean;
    storybook?: any; 
    historyIndex: number;
    currency: 'USD' | 'SEK';
    onCloseSession?: () => void;
    history: any[];
    onSwitchSession: (index: number, sceneId?: string, restore?: boolean) => void;
    onNewSession: () => void;
    onUpdateVideoDraft: (genId: number, sceneId: string, updates: any) => void;
    creditBalance: number;
    onStopScene?: (genId: number, sceneId: string) => void;
    onUndoEdit?: (genId: number, sceneId: string) => void;
    onSceneVariantChange?: (genId: number, sceneId: string, direction: 'next' | 'prev') => void;
    isBlurred?: boolean;
    activeI2ISlot: { genId: number, sceneId: string } | null;
    setActiveI2ISlot: (slot: { genId: number, sceneId: string } | null) => void;
}

export const Storyboard = React.memo((props: StoryboardProps) => {
    const { generationItem, savedItems, history } = props;
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const sectionUploadRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
    const [videoErrors, setVideoErrors] = useState<{[key: string]: string}>({});
    const [confirmingVideoSceneId, setConfirmingVideoSceneId] = useState<string | null>(null);

    // DO add comment: Reset card confirmation if user clicks anywhere outside the current cards.
    useEffect(() => {
        if (!confirmingVideoSceneId) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (scrollContainerRef.current && scrollContainerRef.current.contains(target) && !target.closest('.bg-gray-800')) {
                setConfirmingVideoSceneId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [confirmingVideoSceneId]);

    const handleImportScript = (idx: number, sceneId: string) => { if (props.storybook?.scenes && props.storybook.scenes[idx]) props.onUpdateVideoDraft(generationItem.id, sceneId, { draftScript: props.storybook.scenes[idx].script || '' }); };

    const handleVideoGenerateClick = (genId: number, sceneId: string, script: string, movement: string) => {
        const currentCost = props.videoModel === 'veo-3.1-fast-generate-preview' ? 6 : 10;
        if (props.creditBalance < currentCost) {
            setVideoErrors(prev => ({ ...prev, [sceneId]: `Insufficient credits. Required: ${currentCost} Credits.` }));
            return;
        }
        if (confirmingVideoSceneId !== sceneId) {
            setConfirmingVideoSceneId(sceneId);
            setVideoErrors(prev => { const next = { ...prev }; delete next[sceneId]; return next; });
            return;
        }
        setConfirmingVideoSceneId(null);
        props.onGenerateVideo(genId, sceneId, script, movement);
    };

    const openSessions = history ? history.map((h, i) => ({ ...h, originalIndex: i })).filter(h => !h.isClosed) : [];
    const activeSession = props.historyIndex !== -1 ? history[props.historyIndex] : null;

    const renderTabBar = () => (
        <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-700 overscroll-none relative z-20">
            {openSessions.map((session) => (
                <div key={session.id} onClick={() => props.onSwitchSession(session.originalIndex)} className={`group flex items-center gap-2 px-3 py-2 rounded-t-lg cursor-pointer border-t border-l border-r border-transparent min-w-[120px] max-w-[200px] transition-all ${props.historyIndex === session.originalIndex ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-900/50 hover:bg-gray-800/80 text-gray-400 hover:text-gray-300' }`}>
                    <span className="text-[10px] font-bold truncate flex-1 uppercase tracking-tight">{session.prompt || 'Session'}</span>
                    <button onClick={(e) => { e.stopPropagation(); if (props.historyIndex === session.originalIndex && props.onCloseSession) props.onCloseSession(); else props.onSwitchSession(session.originalIndex); }} className={`p-0.5 rounded-full hover:bg-red-900/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ${props.historyIndex === session.originalIndex ? 'opacity-100' : ''}`}><XIcon className="w-3 h-3" /></button>
                </div>
            ))}
            {props.historyIndex !== -1 && !openSessions.some(s => s.type === 'upload') && (
                <button onClick={props.onNewSession} className={`flex items-center justify-center w-8 h-8 rounded hover:bg-gray-800 transition-colors ml-1 ${props.historyIndex === -1 ? 'bg-indigo-600 text-white' : 'text-gray-500'}`} title="New Workspace Session"><PlusIcon className="w-4 h-4" /></button>
            )}
        </div>
    );

    const renderActivePage = () => {
        if (!activeSession || activeSession.isClosed) return null;
        let title = "Sidebar productions";
        let icon = <SparklesIcon className="w-4 h-4 text-indigo-400" />;
        if (activeSession.type === 'storybook') { title = "Storybook scenes"; icon = <BookOpenIcon className="w-4 h-4 text-amber-400" />; }
        else if (activeSession.type === 'upload') { title = "Asset imports"; icon = <UploadIcon className="w-4 h-4 text-emerald-400" />; }
        else if (activeSession.type === 'timeline') { title = "Timeline productions"; icon = <FilmIcon className="w-4 h-4 text-rose-400" />; }

        return (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300 relative z-10">
                <div className="workspace-section-header">
                    <div className="flex items-center gap-2">
                        {icon}
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{title}</h3>
                    </div>
                    <div className="workspace-divider"></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                    {(activeSession.imageSet || []).map((scene: any, index: number) => {
                        if (scene.isHidden) return null;
                        const sceneId = scene.sceneId || `scene-${activeSession.id}-${index}`;
                        const isSaved = savedItems.some(i => i.id === `${activeSession.id}-${sceneId}` || (scene.originalSavedId && i.id === scene.originalSavedId));
                        const status = scene.status || (scene.isGenerating || scene.isRegenerating ? 'generating' : (scene.src ? 'complete' : (scene.error ? 'error' : 'pending')));
                        const videoState = activeSession.videoStates ? activeSession.videoStates[index] : null;
                        return (
                            <SceneCard 
                                key={sceneId} scene={scene} index={index} genId={activeSession.id} videoState={videoState} isSaved={isSaved} 
                                isActive={props.activeVideoIndices.includes(index)} status={status} draftScript={videoState?.draftScript || ''} 
                                draftMovement={videoState?.draftCameraMovement || 'Zoom In (Focus In)'} 
                                onPreviewImage={props.onPreviewImage} onSave={() => props.onSaveScene(activeSession.id, sceneId)} 
                                onAngle={() => props.onAngleSelect(activeSession.id, sceneId)} onEdit={() => props.onEditScene(activeSession.id, sceneId)} 
                                onRegenerate={() => props.onRegenerateScene(activeSession.id, sceneId)} onDelete={() => props.onDeleteScene && props.onDeleteScene(activeSession.id, sceneId)} 
                                onUndo={() => props.onUndoEdit && props.onUndoEdit(activeSession.id, sceneId)}
                                onVariantChange={(dir) => props.onSceneVariantChange && props.onSceneVariantChange(activeSession.id, sceneId, dir)} 
                                onStopScene={() => props.onStopScene && props.onStopScene(activeSession.id, sceneId)} 
                                onToggleVideoCreator={() => props.onOpenVideoCreator(index)} 
                                onUpdateDraft={(updates) => props.onUpdateVideoDraft(activeSession.id, sceneId, updates)} 
                                onGenerateVideo={(script, movement, withAudio) => handleVideoGenerateClick(activeSession.id, sceneId, script, movement)} 
                                onAddToTimeline={props.onAddToTimeline} onImportScript={() => handleImportScript(index, sceneId)} 
                                hasScriptToImport={!!(props.storybook?.scenes && props.storybook.scenes[index])} 
                                videoModel={props.videoModel} videoResolution={props.videoResolution || '720p'} 
                                setVideoModel={props.setVideoModel} setVideoResolution={props.setVideoResolution} 
                                isDisabled={props.isDisabled} videoCostDisplay={props.videoModel === 'veo-3.1-fast-generate-preview' ? '6 Credits' : '10 Credits'} 
                                isMusicVideo={activeSession.genre === 'Music Video'} isHistory={activeSession.genre === 'History'} 
                                videoError={videoErrors[sceneId]} isConfirmingVideo={confirmingVideoSceneId === sceneId} creditBalance={props.creditBalance} 
                                activeI2ISlot={props.activeI2ISlot} setActiveI2ISlot={props.setActiveI2ISlot}
                            />
                        );
                    })}
                    {activeSession.type === 'upload' && props.onUploadToSession && (
                        <div onClick={() => { setActiveSectionId(activeSession.id); sectionUploadRef.current?.click(); }} className="bg-gray-900/30 border-2 border-dashed border-gray-800 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-900/5 transition-all group aspect-video">
                            <PlusIcon className="w-10 h-10 text-gray-700 group-hover:text-indigo-500 mb-2 transition-colors" />
                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest group-hover:text-indigo-400">Add more</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className={`flex-1 flex flex-col h-full overflow-hidden bg-gray-950 relative ${props.isBlurred ? 'blur-sm pointer-events-none' : ''}`}>
            
            {/* CINEMATIC STORYBOARD BACKGROUND LAYER */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <img 
                    src="https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&q=80&w=2000" 
                    className="w-full h-full object-cover opacity-[0.12] scale-110 animate-ken-burns"
                    style={{ filter: 'grayscale(60%) contrast(120%)' }}
                    alt="Cinematic Background"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-transparent to-gray-950"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(3,7,18,0.8)_100%)]"></div>
            </div>

            <div className="px-4 pt-2 shrink-0 tab-bar-border relative z-20">
                {renderTabBar()}
            </div>
            
            <div ref={scrollContainerRef} className="workspace-scroll-container scrollbar-thin scrollbar-thumb-gray-800 relative z-10">
                {openSessions.length === 0 || props.historyIndex === -1 || (activeSession && activeSession.isClosed) && !props.isGenerating ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[70vh]">
                        <div className="w-20 h-20 bg-gray-900/80 backdrop-blur-md rounded-full flex items-center justify-center mb-6 border border-gray-800 shadow-2xl">
                            <ClapperboardIcon className="w-10 h-10 text-gray-700 opacity-50" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-400 mb-8 uppercase tracking-widest">Storyboard Workspace</h2>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button onClick={() => uploadInputRef.current?.click()} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-50 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 text-xs uppercase tracking-wider"><UploadIcon className="w-4 h-4" /> Import Image</button>
                            <input type="file" ref={uploadInputRef} className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) { props.onUploadStartImage!(e.target.files[0]); e.target.value = ''; }}} />
                        </div>
                    </div>
                ) : (
                    <>
                        {renderActivePage()}
                        {props.isGenerating && (
                            <div className="flex items-center gap-3 mt-4 px-2 opacity-50 relative z-10">
                                <LoaderIcon className="w-4 h-4 animate-spin text-gray-500" />
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Producing next batch...</span>
                            </div>
                        )}
                    </>
                )}
            </div>
            
            <input type="file" ref={sectionUploadRef} className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0] && activeSectionId !== null) { props.onUploadToSession!(e.target.files[0], activeSectionId); e.target.value = ''; setActiveSectionId(null); } }} />
        </div>
    );
}, (p, n) => p.generationItem === n.generationItem && p.activeVideoIndices === n.activeVideoIndices && p.isGenerating === n.isGenerating && p.savedItems === n.savedItems && p.historyIndex === n.historyIndex && p.history === n.history && p.videoResolution === n.videoResolution && p.videoModel === n.videoModel && p.creditBalance === n.creditBalance && p.isProcessingAudio === n.isProcessingAudio && p.isBlurred === n.isBlurred && p.activeI2ISlot === n.activeI2ISlot);
