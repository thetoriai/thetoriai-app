
import React, { useRef, useState, useEffect } from 'react';
import { TrashIcon, LoaderIcon, PlusIcon, SparklesIcon, DownloadIcon, UploadIcon, UserPlusIcon, ExclamationTriangleIcon } from './Icons';
import type { Character } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';

interface ActorRosterProps {
    characters: Character[];
    setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
    handleBuildCharacterVisual: (id: number) => void;
    handleUploadNewCharacterImage: (file: File) => void;
    handleCharacterImageUpload: (file: File, id: number) => void;
    updateCharacter: (id: number, props: Partial<Character>) => void;
    removeCharacter: (id: number) => void;
    onToggleHero?: (id: number) => void;
    onUpdateHeroData?: (id: number, data: Partial<Character['heroData']>) => void;
    visualStyle?: string;
}

const HeroStarIcon = ({ solid, className }: { solid?: boolean; className?: string }) => (
    <svg className={className} fill={solid ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
);

export const ActorRoster: React.FC<ActorRosterProps> = (props) => {
    const studioFileInputRef = useRef<HTMLInputElement>(null);
    const newEntryUploadRef = useRef<HTMLInputElement>(null);
    const replacementUploadRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const [activeStudioId, setActiveStudioId] = useState<number | null>(null);
    const [studioUploadKey, setStudioUploadKey] = useState<string | null>(null);
    const [showRefineId, setShowRefineId] = useState<number | null>(null);
    const [uploadTargetId, setUploadTargetId] = useState<number | null>(null);

    // CLICK ANYWHERE TO CLOSE REFINEMENT BOX
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (showRefineId !== null && !target.closest('.refine-zone')) {
                setShowRefineId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showRefineId]);

    const runAnalysis = (char: Character) => {
        if (char.originalImageBase64 && char.originalImageMimeType && char.name.trim()) {
            const blob = new Blob([new Uint8Array(atob(char.originalImageBase64).split("").map(c => c.charCodeAt(0)))], { type: char.originalImageMimeType });
            const file = new File([blob], "asset.png", { type: char.originalImageMimeType });
            props.handleCharacterImageUpload(file, char.id);
        }
    };

    const handleNameChange = (id: number, val: string) => {
        const capitalized = val.length > 0 ? val.charAt(0).toUpperCase() + val.slice(1) : val;
        props.updateCharacter(id, { name: capitalized });
    };

    const handleNameBlur = (char: Character) => {
        // AUTOMATED: Analysis starts as soon as a name is entered and you click away IF there is an image
        if (char.name.trim().length > 1 && char.imagePreview && !char.description && !char.isAnalyzing) {
            runAnalysis(char);
        }
    };

    const handleNewEmptyActor = () => {
        const newChar: Character = { 
            id: Date.now(), 
            name: '', 
            imagePreview: null, 
            originalImageBase64: null, 
            originalImageMimeType: null, 
            description: null, 
            detectedImageStyle: null, 
            isDescribing: false, 
            isHero: false 
        };
        props.setCharacters(prev => [...prev, newChar]);
        setShowRefineId(newChar.id);
    };

    const handleNewEntryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const base64 = await fileToBase64(file);
            const newChar: Character = { 
                id: Date.now(), 
                name: '', 
                imagePreview: `data:${file.type};base64,${base64}`, 
                originalImageBase64: base64, 
                originalImageMimeType: file.type, 
                description: null, 
                detectedImageStyle: null, 
                isDescribing: false, 
                isHero: false 
            };
            props.setCharacters(prev => [...prev, newChar]);
        }
        e.target.value = '';
    };

    const handleReplacementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && uploadTargetId !== null) {
            const base64 = await fileToBase64(file);
            props.updateCharacter(uploadTargetId, {
                imagePreview: `data:${file.type};base64,${base64}`,
                originalImageBase64: base64,
                originalImageMimeType: file.type
            });
            // Auto trigger analysis if name is present
            const char = props.characters.find(c => c.id === uploadTargetId);
            if (char && char.name.trim()) {
                props.handleCharacterImageUpload(file, uploadTargetId);
            }
        }
        e.target.value = '';
        setUploadTargetId(null);
    };

    const handleDownload = (char: Character) => {
        if (!char.imagePreview) return;
        const link = document.createElement('a');
        link.href = char.imagePreview;
        const safeName = encodeURIComponent(char.name || "Actor");
        link.download = `Toristori_${safeName}.png`;
        link.click();
    };

    const renderCharacterCard = (char: Character, isLead: boolean = false) => {
        const isProcessing = char.isAnalyzing || char.isDescribing;
        const isRefining = showRefineId === char.id;
        const hasName = char.name.trim().length > 0;
        const hasImage = !!char.imagePreview;

        // DO add comment: Add safety block checks.
        const isMinorBlock = char.detectedImageStyle === 'BLOCK_MINOR';
        const isExplicitBlock = char.detectedImageStyle === 'BLOCK_SAFETY_GENERAL';
        const isAnySafetyBlock = isMinorBlock || isExplicitBlock;

        // DO add comment: Dynamic Label Helper. Extracts the first word or short form of the style for the button.
        const styleLabel = (props.visualStyle || '3D').replace(' Render', '').toUpperCase();

        return (
            <div className={`group bg-[#0f172a] border relative transition-all shadow-2xl overflow-hidden flex flex-col refine-zone ${isLead ? 'border-amber-500/30 rounded-[2.5rem]' : 'border-white/5 rounded-2xl'} ${isRefining ? 'ring-1 ring-indigo-500/30 shadow-indigo-500/10' : ''} ${isAnySafetyBlock ? 'border-amber-500/50 animate-pulse-amber' : ''}`}>
                
                {/* IMAGE AREA - Click to close if open, Double-click to reveal specific change tools */}
                <div 
                    onClick={() => isRefining && setShowRefineId(null)}
                    onDoubleClick={() => !isProcessing && setShowRefineId(char.id)}
                    className="relative aspect-[3/4] bg-black overflow-hidden cursor-pointer flex flex-col items-center justify-center"
                >
                    {hasImage && !isAnySafetyBlock ? (
                        <div className="w-full h-full relative">
                            <img src={char.imagePreview!} className={`w-full h-full object-cover transition-all duration-700 ${isProcessing ? 'opacity-30' : 'opacity-100'}`} />
                            
                            {/* Metadata Tags: Automatically visible after AI analysis */}
                            {char.description && !isProcessing && (
                                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
                                    <p className="text-[7px] font-bold text-gray-500 uppercase tracking-widest line-clamp-1">
                                        {char.description.replace(/Who: |Age: |Clothes: /g, '')}
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : isAnySafetyBlock ? (
                        // ROSTER SAFETY ADVISORY
                        <div className="absolute inset-0 bg-amber-950/20 backdrop-blur-sm p-4 flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
                             <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center mb-3 border border-amber-500/30">
                                <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                            </div>
                            <h4 className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">
                                {isMinorBlock ? 'Minor Detected' : 'Content Rejected'}
                            </h4>
                            <p className="text-[8px] font-bold text-amber-400/70 leading-relaxed mb-4">
                                {isMinorBlock 
                                    ? "Child generation not supported. Use adult descriptions."
                                    : "Explicit content is prohibited by safety standards."}
                            </p>
                            <button 
                                onClick={(e) => { e.stopPropagation(); props.updateCharacter(char.id, { imagePreview: null, detectedImageStyle: null, description: null }); setShowRefineId(char.id); }}
                                className="px-4 py-1.5 bg-amber-600 text-black text-[8px] font-black uppercase tracking-widest rounded transition-all active:scale-95"
                            >
                                Reset Artist
                            </button>
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-[#070b14] relative group/empty">
                            {isProcessing ? (
                                <div className="flex flex-col items-center">
                                    <LoaderIcon className="w-8 h-8 text-indigo-500 animate-spin" />
                                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.4em] mt-4">Analysing...</span>
                                </div>
                            ) : (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mb-4 group-hover/empty:scale-110 transition-transform">
                                        <UserPlusIcon className="w-6 h-6 text-gray-800 group-hover/empty:text-indigo-500" />
                                    </div>
                                    <span className="text-[8px] font-black text-gray-700 uppercase tracking-[0.3em] text-center px-4 leading-relaxed group-hover/empty:text-gray-500">Double-click to<br/>Describe Artist</span>
                                    
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setUploadTargetId(char.id); replacementUploadRef.current?.click(); }}
                                        className="absolute bottom-4 p-2 bg-white/5 hover:bg-indigo-600 rounded-xl text-gray-600 hover:text-white transition-all opacity-0 group-hover/empty:opacity-100"
                                        title="Upload Photo Instead"
                                    >
                                        <UploadIcon className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-[90]">
                        <button onClick={(e) => { e.stopPropagation(); props.removeCharacter(char.id); }} className="p-1.5 bg-red-600/80 text-white rounded shadow-lg hover:bg-red-600 transition-colors" title="Remove Artist"><TrashIcon className="w-3.5 h-3.5" /></button>
                        {hasImage && !isAnySafetyBlock && <button onClick={(e) => { e.stopPropagation(); handleDownload(char); }} className="p-1.5 bg-indigo-600/80 text-white rounded shadow-lg hover:bg-indigo-600 transition-colors" title="Download Roster Image"><DownloadIcon className="w-3.5 h-3.5" /></button>}
                    </div>

                    {hasImage && !isProcessing && !isRefining && !isAnySafetyBlock && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <button onClick={(e) => { e.stopPropagation(); props.onToggleHero?.(char.id); }} className={`p-4 rounded-full shadow-2xl pointer-events-auto transition-transform hover:scale-110 ${char.isHero ? 'bg-amber-500 text-black' : 'bg-white/10 text-white backdrop-blur-md'}`} title="Set as Lead Actor"><HeroStarIcon solid={char.isHero} className="w-5 h-5"/></button>
                        </div>
                    )}
                </div>
                
                {/* BOTTOM STACK */}
                <div className="p-3 bg-[#0a0f1d] border-t border-white/5 flex flex-col">
                    
                    {/* Specific Changes (Only shows on double-click) */}
                    {isRefining && (
                        <div className="flex flex-col animate-in fade-in slide-in-from-top-1 duration-200">
                            <textarea 
                                value={char.customInstruction || ''} 
                                autoFocus
                                onChange={(e) => props.updateCharacter(char.id, { customInstruction: e.target.value })}
                                placeholder="Describe artist features, clothing, or physical traits..."
                                className="w-full h-16 bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] font-bold text-white placeholder-gray-800 focus:border-indigo-500 outline-none resize-none leading-tight mt-4"
                            />

                            <button 
                                disabled={!hasName}
                                onClick={(e) => { e.stopPropagation(); props.handleBuildCharacterVisual(char.id); setShowRefineId(null); }}
                                className={`w-full py-2.5 text-[9px] font-black uppercase tracking-[0.2em] rounded-lg border transition-all active:scale-95 shadow-lg mt-3 ${hasName ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400/20' : 'bg-gray-800 text-gray-600 border-transparent cursor-not-allowed'}`}
                            >
                                {hasName ? (hasImage ? `REFINE ${styleLabel} ASSET` : `CREATE ${styleLabel} ASSET`) : 'NAME REQUIRED'}
                            </button>
                        </div>
                    )}

                    {/* Multi-Character Identity Tag (Name is the ID) */}
                    <div className="flex items-center gap-2 pt-3 mt-1 border-t border-white/5 px-1">
                        <div className="flex-1 flex items-center justify-between">
                            <input 
                                value={char.name} 
                                onBlur={() => handleNameBlur(char)}
                                onChange={(e) => handleNameChange(char.id, e.target.value)} 
                                className={`flex-1 bg-transparent border-none p-0 font-black text-left text-white outline-none tracking-tighter uppercase placeholder-gray-800 ${isLead ? 'text-lg' : 'text-[11px]'} ${!hasName ? 'ring-1 ring-amber-500/20 px-2 py-0.5 rounded' : ''}`} 
                                placeholder="ID LINK (NAME)" 
                            />
                            {!isRefining && char.name && !char.description && hasImage && !isAnySafetyBlock && (
                                <button onClick={(e) => { e.stopPropagation(); runAnalysis(char); }} className="p-1 text-indigo-500/40 hover:text-indigo-400 transition-colors">
                                    <SparklesIcon className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const hero = props.characters.find(c => c.isHero);
    const supportingCast = props.characters.filter(c => !c.isHero);

    return (
        <div ref={containerRef} className="space-y-10 pb-60 px-4">
            {hero && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="flex items-center gap-3">
                        <HeroStarIcon solid className="w-3 h-3 text-amber-500" />
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Master Lead</span>
                        <div className="h-px bg-amber-500/10 flex-1"></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
                        {renderCharacterCard(hero, true)}

                        <div className="space-y-6">
                            <div className="bg-[#0f172a] border border-white/5 p-8 rounded-[2.5rem] shadow-xl">
                                <div className="flex items-center justify-between mb-8">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest opacity-50">Studio Visual Key</span>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    {['frontView', 'backView', 'sideViewLeft'].map((slotKey) => {
                                        const label = slotKey === 'frontView' ? 'Front' : slotKey === 'backView' ? 'Back' : 'Profile';
                                        const img = hero.heroData?.[slotKey as keyof typeof hero.heroData];
                                        return (
                                            <div 
                                                key={slotKey}
                                                onClick={() => { setActiveStudioId(hero.id); setStudioUploadKey(slotKey); studioFileInputRef.current?.click(); }}
                                                className={`aspect-square border border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative ${img ? 'border-amber-500/50 bg-black/40' : 'border-white/10 hover:border-amber-500/30 bg-black/20'}`}
                                            >
                                                {img ? <img src={`data:image/png;base64,${img}`} className="w-full h-full object-cover" /> : (
                                                    <span className="text-[8px] font-black text-gray-700 uppercase tracking-widest">{label}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="p-5 border border-indigo-500/20 rounded-3xl bg-indigo-600/5">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5">Production Mandate</p>
                                <p className="text-[9px] text-gray-500 font-bold uppercase leading-relaxed italic">
                                    Double-click any artist to open refinement tools. Names are used to link actors to scripts. You can define characters manually or via photo upload.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-8 pt-4">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em]">Supporting Roster</span>
                    <div className="h-px bg-white/5 flex-1"></div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {supportingCast.map(char => (
                        <div key={char.id} className="animate-in fade-in zoom-in-95 duration-500">
                            {renderCharacterCard(char)}
                        </div>
                    ))}
                    
                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={handleNewEmptyActor}
                            className="aspect-[3/4] border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-600/5 hover:border-indigo-500/40 transition-all group"
                        >
                            <div className="w-12 h-12 border border-white/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <PlusIcon className="w-5 h-5 text-gray-700 group-hover:text-indigo-500" />
                            </div>
                            <span className="text-[8px] font-black text-gray-700 uppercase tracking-[0.4em] group-hover:text-indigo-400">New Actor</span>
                        </button>
                        
                        <button 
                            onClick={() => newEntryUploadRef.current?.click()}
                            className="flex items-center justify-center gap-2 py-3 border border-white/5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-all"
                        >
                            <UploadIcon className="w-3.5 h-3.5 text-gray-600" />
                            <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Import Artist</span>
                        </button>
                    </div>
                </div>
            </div>
            
            <input type="file" ref={studioFileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                if (e.target.files?.[0] && activeStudioId && studioUploadKey && props.onUpdateHeroData) {
                    fileToBase64(e.target.files[0]).then(base64 => props.onUpdateHeroData!(activeStudioId, { [studioUploadKey]: base64 }));
                }
                e.target.value = '';
            }} />
            <input type="file" ref={newEntryUploadRef} className="hidden" accept="image/*" onChange={handleNewEntryFile} />
            <input type="file" ref={replacementUploadRef} className="hidden" accept="image/*" onChange={handleReplacementUpload} />
        </div>
    );
};
