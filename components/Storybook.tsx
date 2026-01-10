
import React, { useState, useRef, useEffect } from 'react';
import { XIcon, BookOpenIcon, SparklesIcon, LoaderIcon, CheckIcon, ClipboardIcon, RefreshIcon, UploadIcon, PlayIcon, CreditCardIcon, TrashIcon, LockClosedIcon, LockOpenIcon, ShirtIcon, CircularProgressIcon, MusicalNoteIcon, PlusIcon, DocumentMagnifyingGlassIcon, UserPlusIcon, ArrowsRightLeftIcon } from './Icons';
import { generateStructuredStory, generateScenesFromNarrative, regenerateSceneVisual, generatePromptFromAudio, generateSpeech, PREBUILT_VOICES } from '../services/geminiService';
import type { Character, Storybook, Outfit } from '../services/geminiService';
import { fileToBase64, base64ToBytes } from '../utils/fileUtils';
import { PAYPAL_LINK } from '../utils/constants';

interface StorybookCreatorProps {
    storybookContent: Storybook;
    setStorybookContent: (data: Storybook) => void;
    characters: Character[];
    characterStyle: string;
    selectedCountry: string;
    creditBalance: number;
    onClose: () => void;
    onGenerateFromStorybook: (scenes: string[]) => void;
    onGenerateSingleStorybookScene?: (index: number, model: string) => void;
    onSwapOutfit?: (sceneIndex: number, outfit: Outfit) => Promise<void>;
    onAddAudioToTimeline?: (url: string, duration: number) => void;
    onAddAudioClip?: (url: string, duration?: number, startTime?: number) => void;
    onDeductAudioCredit?: () => boolean;
    onResetStorybook: () => void;
    storySeed: string;
    setStorySeed: (val: string) => void;
}

export const StorybookCreator: React.FC<StorybookCreatorProps> = ({ 
    storybookContent, setStorybookContent, characters, characterStyle, selectedCountry, creditBalance, onClose, onGenerateFromStorybook, onGenerateSingleStorybookScene, onSwapOutfit, onAddAudioToTimeline, onAddAudioClip, onDeductAudioCredit, onResetStorybook, storySeed, setStorySeed
}) => {
    const [creationMode, setCreationMode] = useState<'ai' | 'paste'>('ai');
    const [title, setTitle] = useState(storybookContent.title || '');
    const [sharedStoryText, setSharedStoryText] = useState(storybookContent.storyNarrative || '');
    const [selectedStoryGenre, setSelectedStoryGenre] = useState('Oral Tradition');
    const [selectedMovieStyle, setSelectedMovieStyle] = useState('Nollywood');
    const [includeDialogue, setIncludeDialogue] = useState(storybookContent.includeDialogue ?? true);
    const [isGeneratingStory, setIsGeneratingStory] = useState(false);
    const [storyError, setStoryError] = useState<string | null>(null);
    const [isProcessingAudio, setIsProcessingAudio] = useState(false);
    const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
    const [confirmingBatch, setConfirmingBatch] = useState(false);
    const [confirmingExecuteIdx, setConfirmingExecuteIdx] = useState<number | null>(null);
    const [isConfirmingSpeak, setIsConfirmingSpeak] = useState(false);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const speakButtonRef = useRef<HTMLButtonElement>(null);
    const batchButtonRef = useRef<HTMLButtonElement>(null);

    const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
    const [selectedVoice, setSelectedVoice] = useState('Zephyr');

    // SYNC: Keep storybookContent in sync with local state
    useEffect(() => {
        const timer = setTimeout(() => {
            setStorybookContent({
                ...storybookContent,
                title,
                storyNarrative: sharedStoryText,
                includeDialogue
            });
        }, 500);
        return () => clearTimeout(timer);
    }, [title, sharedStoryText, includeDialogue]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (isConfirmingSpeak && speakButtonRef.current && !speakButtonRef.current.contains(target)) {
                setIsConfirmingSpeak(false);
            }
            if (confirmingBatch && batchButtonRef.current && !batchButtonRef.current.contains(target)) {
                setConfirmingBatch(false);
            }
            if (confirmingExecuteIdx !== null && !(target as HTMLElement).closest('.execute-btn-container')) {
                setConfirmingExecuteIdx(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isConfirmingSpeak, confirmingBatch, confirmingExecuteIdx]);

    useEffect(() => {
        if (confirmingExecuteIdx === null) return;
        const timer = setTimeout(() => setConfirmingExecuteIdx(null), 3000);
        return () => clearTimeout(timer);
    }, [confirmingExecuteIdx]);

    const toggleCharacterInCast = (name: string) => {
        const currentChars = [...storybookContent.characters];
        const exists = currentChars.includes(name);
        
        let newChars;
        if (exists) {
            newChars = currentChars.filter(n => n !== name);
        } else {
            newChars = [...currentChars, name];
        }
        setStorybookContent({ ...storybookContent, characters: newChars });
    };

    const isCharacterInCast = (name: string) => {
        return storybookContent.characters.includes(name);
    };

    const handleStoryTextChange = (val: string) => {
        setSharedStoryText(val);
        if (storybookContent.scenes.length === 0) {
            setStorySeed(val);
        }
    };

    const handleCreateStory = async (forceContinuation: boolean = false) => {
        if (!title.trim()) return;
        setIsGeneratingStory(true);
        try {
            const selectedChars = characters.filter(c => storybookContent.characters.includes(c.name));
            const inputIdea = (storySeed && storySeed.trim().length > 5) ? storySeed : sharedStoryText;
            
            const hasKeyword = inputIdea.toLowerCase().includes('continues');
            const isContinuation = forceContinuation || (hasKeyword && storybookContent.storyNarrative.length > 0);
            
            const history = isContinuation ? storybookContent.storyNarrative : '';
            const res = await generateStructuredStory(inputIdea, title, selectedChars, includeDialogue, characterStyle, selectedStoryGenre, selectedMovieStyle, '3', history, false, '', selectedCountry);
            
            const lockedScenes = res.scenes.map((s: any) => ({ ...s, isDescriptionLocked: true, isScriptLocked: true }));
            
            if (isContinuation) {
                const updatedNarrative = `${storybookContent.storyNarrative}\n\n${res.storyNarrative}`;
                setStorybookContent({ 
                    ...storybookContent,
                    storyNarrative: updatedNarrative, 
                    scenes: [...storybookContent.scenes, ...lockedScenes], 
                });
                setSharedStoryText(updatedNarrative);
            } else {
                setStorybookContent({ 
                    ...storybookContent,
                    title: title, 
                    storyNarrative: res.storyNarrative, 
                    scenes: lockedScenes, 
                    includeDialogue 
                });
                setSharedStoryText(res.storyNarrative);
            }
        } catch (e) { setStoryError("Failed to generate story."); } finally { setIsGeneratingStory(false); }
    };

    const handleProcessPastedStory = async () => {
        if (!title.trim() || !sharedStoryText.trim()) return;
        setIsGeneratingStory(true);
        try {
            const selectedChars = characters.filter(c => storybookContent.characters.includes(c.name));
            const scenes = await generateScenesFromNarrative(sharedStoryText, selectedChars, includeDialogue, characterStyle, selectedMovieStyle, selectedCountry);
            const lockedScenes = scenes.map((s: any) => ({ ...s, isDescriptionLocked: true, isScriptLocked: true }));
            setStorybookContent({ 
                ...storybookContent,
                title: title, 
                storyNarrative: sharedStoryText, 
                scenes: lockedScenes, 
                includeDialogue 
            });
        } catch (e) { console.error(e); } finally { setIsGeneratingStory(false); }
    };

    const handleGenerateSpeech = async () => {
        if (!sharedStoryText.trim()) return;
        if (!isConfirmingSpeak && !isGeneratingSpeech) { setIsConfirmingSpeak(true); return; }
        if (onDeductAudioCredit && !onDeductAudioCredit()) { setStoryError("Insufficient credits."); setIsConfirmingSpeak(false); return; }
        setIsConfirmingSpeak(false); setIsGeneratingSpeech(true);
        try {
            const base64 = await generateSpeech(sharedStoryText, selectedCountry, selectedVoice, 'Storytelling');
            const bytes = base64ToBytes(base64); const blob = new Blob([bytes], { type: 'audio/wav' }); const url = URL.createObjectURL(blob);
            if (onAddAudioToTimeline) onAddAudioToTimeline(url, 0);
        } catch (e) { setStoryError("TTS Failed."); } finally { setIsGeneratingSpeech(false); }
    };

    // DO add comment: Strict Audio Transcription. Modified to append only the transcription verbatim to the concept box.
    const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        setIsProcessingAudio(true);
        try { 
            const base64 = await fileToBase64(file); 
            const transcription = await generatePromptFromAudio(base64, file.type); 
            // Verbatim transcription append logic
            const updatedText = (sharedStoryText ? sharedStoryText + "\n" : "") + transcription;
            setSharedStoryText(updatedText); 
            setStorySeed((storySeed ? storySeed + "\n" : "") + transcription);
        } catch (error: any) { setStoryError("Failed to transcribe audio."); } finally { setIsProcessingAudio(false); if (audioInputRef.current) audioInputRef.current.value = ''; }
    };

    const handleGenerateScenes = async () => {
         setIsGeneratingScenes(true);
         try { 
            const fullChars = characters.filter(c => storybookContent.characters.includes(c.name)); 
            const scenes = await generateScenesFromNarrative(storybookContent.storyNarrative, fullChars, storybookContent.includeDialogue || false, characterStyle, selectedMovieStyle, selectedCountry); 
            const lockedScenes = scenes.map((s: any) => ({ ...s, isDescriptionLocked: true, isScriptLocked: true }));
            setStorybookContent({ ...storybookContent, scenes: lockedScenes }); 
        } catch(e) { console.error(e); } finally { setIsGeneratingScenes(false); }
    };

    const handleClearEverything = () => { onResetStorybook(); setTitle(''); setSharedStoryText(''); setStorySeed(''); };

    const handleRegenerateVisual = async (index: number) => {
        try { const scene = storybookContent.scenes[index]; const fullChars = characters.filter(c => storybookContent.characters.includes(c.name)); const newDesc = await regenerateSceneVisual(scene.script, fullChars); const newScenes = [...storybookContent.scenes]; newScenes[index] = { ...newScenes[index], imageDescription: newDesc }; setStorybookContent({...storybookContent, scenes: newScenes}); } catch(e) { console.error(e); }
    };

    const handleAddManualScene = () => {
        const newScene = {
            id: Date.now(),
            imageDescription: "Enter visual details...",
            script: "Enter dialogue or narration...",
            isDescriptionLocked: false,
            isScriptLocked: false
        };
        setStorybookContent({
            ...storybookContent,
            scenes: [...storybookContent.scenes, newScene]
        });
    };

    const handleBatchProduce = () => {
        if (!confirmingBatch) {
            setConfirmingBatch(true);
            return;
        }
        if (creditBalance < storybookContent.scenes.length) {
            setStoryError(`Insufficient credits. Required: ${storybookContent.scenes.length}`);
            setConfirmingBatch(false);
            return;
        }
        onGenerateFromStorybook(storybookContent.scenes.map(s => s.imageDescription));
        setConfirmingBatch(false);
    };

    const handleExecuteSingleScene = (index: number) => {
        if (confirmingExecuteIdx !== index) {
            setConfirmingExecuteIdx(index);
            return;
        }
        if (creditBalance < 1) {
            setStoryError("Insufficient credits to execute scene.");
            setConfirmingExecuteIdx(null);
            return;
        }
        if (onGenerateSingleStorybookScene) {
            onGenerateSingleStorybookScene(index, 'gemini-2.5-flash-image');
        }
        setConfirmingExecuteIdx(null);
    };

    const hasNarrativeContent = sharedStoryText.trim().length > 0;
    const totalCost = storybookContent.scenes.length;

    return (
        <div className="w-full h-full flex flex-col bg-gray-950 animate-in fade-in duration-500 overflow-hidden font-sans">
            <div className="p-4 border-b border-white/5 flex justify-between items-center shrink-0 bg-[#0a0f1d]">
                <h2 className="text-xs font-black text-gray-400 flex items-center gap-2 uppercase tracking-widest"><BookOpenIcon className="w-5 h-5 text-indigo-500"/> Storywriter Section</h2>
                <button onClick={handleClearEverything} className="flex items-center gap-2 px-3 py-1.5 bg-red-900/10 hover:bg-red-800 border border-red-900/30 text-red-400 rounded-lg text-[9px] font-black uppercase transition-all active:scale-95">
                    <TrashIcon className="w-3 h-3"/> Reset
                </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* LEFT: COMPACT SETTINGS */}
                <div className="w-full md:w-[340px] p-4 overflow-hidden border-r border-white/5 flex flex-col gap-5 shrink-0 bg-[#070b14]">
                    <div className="flex bg-gray-900 rounded-xl p-0.5 border border-white/5 shrink-0 shadow-inner">
                        <button onClick={() => setCreationMode('ai')} className={`flex-1 py-1.5 text-[9px] font-black rounded transition-all uppercase ${creationMode === 'ai' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>Blueprint</button>
                        <button onClick={() => setCreationMode('paste')} className={`flex-1 py-1.5 text-[9px] font-black rounded transition-all uppercase ${creationMode === 'paste' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>Draft</button>
                    </div>
                    
                    <div className="flex flex-col gap-5 shrink-0">
                        <div className="flex flex-col items-center">
                            <input 
                                value={title} 
                                onChange={e => setTitle(e.target.value)} 
                                placeholder="Titled..." 
                                className="w-full bg-transparent border-none py-2 text-2xl font-black text-white focus:outline-none placeholder-gray-900 text-center tracking-tighter italic" 
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap justify-center gap-2.5 max-h-[140px] overflow-y-auto p-2 scrollbar-none bg-black/20 rounded-2xl border border-white/5">
                                {characters.map(char => {
                                    const active = isCharacterInCast(char.name);
                                    return (
                                        <button 
                                            key={char.id} 
                                            onClick={() => toggleCharacterInCast(char.name)}
                                            className={`flex flex-col items-center gap-1 transition-all group active:scale-95`}
                                        >
                                            <div className={`w-12 h-12 rounded-full border-2 overflow-hidden transition-all shadow-lg ${active ? 'border-green-500 ring-4 ring-green-500/20 scale-110' : 'border-gray-800 opacity-40 grayscale hover:opacity-100 hover:grayscale-0'}`}>
                                                {char.imagePreview ? (
                                                    <img src={char.imagePreview} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-900"><UserPlusIcon className="w-5 h-5 text-gray-700"/></div>
                                                )}
                                            </div>
                                            <span className={`text-[8px] font-black uppercase tracking-tighter ${active ? 'text-green-500' : 'text-gray-600 group-hover:text-gray-400'}`}>{char.name || 'Actor'}</span>
                                        </button>
                                    );
                                })}
                                {characters.length === 0 && (
                                    <div className="text-[8px] font-bold text-gray-700 uppercase italic py-8 tracking-widest text-center w-full">Actors required from roster...</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-2 overflow-hidden min-h-0">
                        <div className="flex justify-between items-center shrink-0 px-1">
                            <label className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Story Concept</label>
                            <button onClick={() => audioInputRef.current?.click()} className="flex items-center gap-1.5 px-2 py-1 bg-indigo-900/20 hover:bg-indigo-600 border border-indigo-500/20 text-indigo-300 hover:text-white rounded text-[8px] font-black uppercase transition-all">
                                {isProcessingAudio ? <LoaderIcon className="w-2.5 h-2.5 animate-spin"/> : <MusicalNoteIcon className="w-2.5 h-2.5"/>}
                                {isProcessingAudio ? "Listening..." : "Audio"}
                            </button>
                            <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={handleAudioUpload} />
                        </div>
                        <textarea value={sharedStoryText} onChange={e => handleStoryTextChange(e.target.value)} placeholder="Describe your vision here... Part 2? Click 'Continue' below." className="flex-1 w-full bg-black/30 border border-white/5 rounded-2xl p-4 text-xs text-white resize-none focus:border-indigo-500 outline-none shadow-inner leading-relaxed placeholder-gray-800" />
                    </div>

                    <div className="space-y-3 shrink-0">
                        <div className="grid grid-cols-2 gap-2">
                            <select value={selectedStoryGenre} onChange={e => setSelectedStoryGenre(e.target.value)} className="w-full bg-gray-900 border border-white/5 rounded-lg px-2 py-2 text-[9px] font-black text-gray-400 outline-none cursor-pointer">
                                <option>Oral Tradition</option><option>Drama</option><option>Action</option><option>Sci-Fi</option><option>Comedy</option><option>History</option><option>Religion</option><option>Horror</option><option>Folklore</option><option>Mystery</option><option>Fantasy</option>
                            </select>
                            <select value={selectedMovieStyle} onChange={e => setSelectedMovieStyle(e.target.value)} className="w-full bg-gray-900 border border-white/5 rounded-lg px-2 py-2 text-[9px] font-black text-gray-400 outline-none cursor-pointer">
                                <option>Nollywood</option><option>Hollywood</option><option>General</option>
                            </select>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setIncludeDialogue(!includeDialogue)}
                                className={`flex-1 py-2.5 rounded-xl border flex items-center justify-center gap-2.5 transition-all ${includeDialogue ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400 shadow-lg' : 'bg-gray-900 border-gray-800 text-gray-600'}`}
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${includeDialogue ? 'bg-indigo-600 border-indigo-400' : 'border-gray-700'}`}>
                                    {includeDialogue && <CheckIcon className="w-3 h-3 text-white" />}
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-[0.1em]">AI Dialogue Helper</span>
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <div className="flex-1 flex flex-col gap-1">
                                <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)} className="w-full bg-gray-900 border border-white/5 rounded-lg px-2 py-1.5 text-[8px] font-black text-indigo-400 outline-none cursor-pointer">
                                    {PREBUILT_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                                <button 
                                    ref={speakButtonRef} onClick={handleGenerateSpeech} disabled={isGeneratingSpeech || !sharedStoryText.trim()}
                                    className={`w-full py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isConfirmingSpeak ? 'bg-green-600 text-white shadow-xl' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}
                                >
                                    {isGeneratingSpeech ? <LoaderIcon className="w-3.5 h-3.5 animate-spin"/> : (isConfirmingSpeak ? "1 Credit" : "Narrate")}
                                </button>
                            </div>
                            
                            <div className="flex-[2] flex flex-col gap-1">
                                {creationMode === 'ai' ? (
                                    <div className="flex gap-1 h-full">
                                        <button onClick={() => handleCreateStory(false)} disabled={isGeneratingStory} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-xl shadow-2xl transition-all active:scale-95 text-[9px] flex items-center justify-center gap-2">
                                            {isGeneratingStory ? <LoaderIcon className="w-3 h-3 animate-spin"/> : <SparklesIcon className="w-3 h-3"/>}
                                            Generate
                                        </button>
                                        {/* DO add comment: Smaller Continue button. Restricted appearance to Content-only states. */}
                                        {hasNarrativeContent && (
                                            <button onClick={() => handleCreateStory(true)} disabled={isGeneratingStory} className="px-3 bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest rounded-xl shadow-2xl transition-all active:scale-95 text-[8px] flex items-center justify-center gap-1.5" title="Continue Writing">
                                                {isGeneratingStory ? <LoaderIcon className="w-2.5 h-2.5 animate-spin"/> : <ArrowsRightLeftIcon className="w-2.5 h-2.5"/>}
                                                Cont.
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex gap-1 h-full">
                                        <button onClick={handleProcessPastedStory} disabled={isGeneratingStory || !sharedStoryText.trim()} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-xl shadow-2xl transition-all active:scale-95 text-[10px] flex items-center justify-center gap-2">
                                            {isGeneratingStory ? <LoaderIcon className="w-4 h-4 animate-spin"/> : <SparklesIcon className="w-4 h-4"/>}
                                            Parse Narrative
                                        </button>
                                        {/* DO add comment: Smaller Continue button for Draft mode as well. */}
                                        {hasNarrativeContent && (
                                            <button onClick={() => handleCreateStory(true)} disabled={isGeneratingStory} className="px-3 bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest rounded-xl shadow-2xl transition-all active:scale-95 text-[8px] flex items-center justify-center gap-1.5" title="Append Part 2">
                                                {isGeneratingStory ? <LoaderIcon className="w-2.5 h-2.5 animate-spin"/> : <ArrowsRightLeftIcon className="w-2.5 h-2.5"/>}
                                                Cont.
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: SCENE BOARD - SCROLLABLE */}
                <div className="flex-1 p-6 overflow-y-auto bg-black/10 scrollbar-thin scrollbar-thumb-gray-800">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Production Sequence ({storybookContent.scenes.length})</h3>
                            <div className="flex gap-3">
                                {storybookContent.scenes.length > 0 && (
                                    <button onClick={handleGenerateScenes} disabled={isGeneratingScenes} className="text-[10px] font-black text-indigo-400 hover:text-white flex items-center gap-2 transition-colors uppercase tracking-widest">
                                        {isGeneratingScenes ? <LoaderIcon className="w-4 h-4 animate-spin"/> : <RefreshIcon className="w-4 h-4"/>} Sync Visuals
                                    </button>
                                )}
                                {/* DO add comment: Manual Scene Add RESTRICTION. Only visible in Draft (Paste) mode. */}
                                {creationMode === 'paste' && (
                                    <button onClick={handleAddManualScene} className="text-[10px] font-black text-emerald-400 hover:text-white flex items-center gap-2 transition-colors uppercase tracking-widest">
                                        <PlusIcon className="w-4 h-4"/> Add Scene
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-6">
                            {storybookContent.scenes.map((scene, index) => (
                                <div key={index} className="bg-gray-800/40 rounded-[2rem] border border-white/5 p-6 space-y-6 hover:border-indigo-500/40 transition-all shadow-2xl backdrop-blur-md relative group">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <span className="px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">Scene {index + 1}</span>
                                            <button onClick={() => { const ns = [...storybookContent.scenes]; ns[index].isDescriptionLocked = !ns[index].isDescriptionLocked; setStorybookContent({...storybookContent, scenes: ns}); }} className={`p-2 rounded-full transition-all ${scene.isDescriptionLocked ? 'text-amber-500 bg-amber-500/10 border border-amber-500/20' : 'text-gray-600 hover:text-white border border-transparent'}`}>
                                                {scene.isDescriptionLocked ? <LockClosedIcon className="w-4 h-4" /> : <LockOpenIcon className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity execute-btn-container">
                                            <button 
                                                onClick={() => handleExecuteSingleScene(index)} 
                                                className={`px-4 py-2 text-[10px] font-black rounded-full uppercase transition-all shadow-lg min-w-[80px] ${confirmingExecuteIdx === index ? 'bg-green-600 hover:bg-green-500 text-white ring-4 ring-green-500/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                                            >
                                                {confirmingExecuteIdx === index ? "Confirm (1C)" : "Execute"}
                                            </button>
                                            <button onClick={() => handleRegenerateVisual(index)} className="p-2 text-gray-500 hover:text-white transition-colors hover:bg-white/5 rounded-full" title="Regenerate scene blueprint"><RefreshIcon className="w-4 h-4"/></button>
                                            <button onClick={() => { const ns = [...storybookContent.scenes]; ns.splice(index, 1); setStorybookContent({...storybookContent, scenes: ns}); }} className="p-2 text-gray-500 hover:text-red-400 transition-colors hover:bg-red-900/10 rounded-full" title="Remove scene"><TrashIcon className="w-4 h-4"/></button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] ml-2">Visual Blueprint</label>
                                            <textarea value={scene.imageDescription} readOnly={scene.isDescriptionLocked} onChange={(e) => { const ns = [...storybookContent.scenes]; ns[index].imageDescription = e.target.value; setStorybookContent({...storybookContent, scenes: ns}); }} className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-[11px] font-bold text-gray-300 leading-relaxed min-h-[80px] resize-none outline-none focus:border-indigo-500/50 transition-all shadow-inner" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] ml-2">Performance & Dialogue</label>
                                            <textarea value={scene.script} readOnly={scene.isDescriptionLocked} onChange={(e) => { const ns = [...storybookContent.scenes]; ns[index].script = e.target.value; setStorybookContent({...storybookContent, scenes: ns}); }} className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-[11px] font-bold text-gray-300 leading-relaxed min-h-[80px] resize-none outline-none focus:border-indigo-500/50 transition-all shadow-inner" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {storybookContent.scenes.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-32 opacity-10">
                                <div className="w-24 h-24 mb-6 rounded-full border-4 border-dashed border-white flex items-center justify-center"><BookOpenIcon className="w-12 h-12" /></div>
                                <h3 className="text-sm font-black uppercase tracking-[0.6em]">Scripting Desk Empty</h3>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* BOTTOM ACTION BAR */}
            <div className="p-6 border-t border-white/5 bg-[#0a0f1d] flex justify-end shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                {storybookContent.scenes.length > 0 && (
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end border-r border-white/10 pr-6">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Est. Production Cost</span>
                            <span className="text-2xl font-black text-indigo-400 tracking-tighter italic">{totalCost} CREDITS</span>
                        </div>
                        <button 
                            ref={batchButtonRef}
                            onClick={handleBatchProduce}
                            className={`px-10 py-4 font-black uppercase tracking-widest rounded-2xl shadow-2xl transition-all active:scale-95 flex items-center gap-3 text-sm border ${confirmingBatch ? 'bg-green-600 border-green-400 text-white animate-pulse' : 'bg-indigo-600 border-indigo-400 text-white hover:bg-indigo-500'}`}
                        >
                            <DocumentMagnifyingGlassIcon className="w-6 h-6"/> 
                            {confirmingBatch ? `Confirm (${totalCost}C)` : "Produce Sequence"}
                        </button>
                    </div>
                )}
            </div>

            {storyError && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-900 border border-red-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 z-[150]">
                    <span className="text-[10px] font-black uppercase">Error: {storyError}</span>
                    <button onClick={() => setStoryError(null)} className="p-1 hover:bg-white/10 rounded-full"><XIcon className="w-4 h-4"/></button>
                </div>
            )}
        </div>
    );
};
