// Studio Re-architecture: Distinct rendering paths for PC (Integrated) and Mobile (Hub-and-Spoke).
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Auth } from './components/Auth';
import { Modals } from './components/Modals';
import { WelcomePage } from './components/WelcomePage';
import { ActorRoster } from './components/ActorRoster';
import { StorybookCreator } from './components/Storybook';
import { Storyboard } from './components/Storyboard';
import { Timeline } from './components/Timeline';
import { HistoryPanel } from './components/History';
import { Footage } from './components/Footage';
// DO add comment above each fix. Added missing TrashIcon to imports.
import { XIcon, SparklesIcon, VideoIcon, FilmIcon, CheckIcon, CreditCardIcon, ChevronLeftIcon, TrashIcon } from './components/Icons';
import { supabase } from './services/supabaseClient';
import { type Character, type Storybook, generateSingleImage, generateCharacterDescription, generateCharacterVisual, editImage, generatePromptFromAudio, type Outfit, generateSpeech, generateVideoFromScene } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { dbGet, dbSet } from './utils/indexedDB';
import { SUPPORT_EMAIL } from './utils/constants';

// Define aistudio interface extension
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const PrivacyPolicy: React.FC = () => (
    <div className="min-h-screen bg-gray-950 text-gray-300 p-8 md:p-20 overflow-y-auto font-sans selection:bg-indigo-500/30">
        <div className="max-w-3xl mx-auto space-y-12 pb-32">
            <a href="/" className="inline-flex items-center gap-2 text-indigo-400 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em] mb-10 group">
                <ChevronLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Studio
            </a>
            
            <header className="space-y-4 border-l-4 border-indigo-600 pl-8">
                <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Privacy Policy</h1>
                <h2 className="text-2xl font-black text-indigo-500 italic tracking-tighter uppercase leading-none">Data Deletion Instructions</h2>
                <p className="text-[10px] text-gray-500 uppercase tracking-[0.4em] font-bold">Effective Date: October 24, 2023</p>
            </header>
            
            <div className="prose prose-invert max-w-none space-y-10">
                <section className="space-y-4">
                    <h3 className="text-lg font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">1. Overview</h3>
                    <p className="leading-relaxed text-sm text-gray-400">Thetori Ai ("the App") is an AI-powered creative workspace. This policy describes how we handle your information when you access our services through Facebook or Google authentication.</p>
                </section>

                <section className="space-y-4">
                    <h3 className="text-lg font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">2. Data Collection</h3>
                    <p className="leading-relaxed text-sm text-gray-400 font-medium">When you use Facebook Login, we request access to:</p>
                    <ul className="list-disc ml-6 space-y-3 text-sm text-gray-400">
                        <li><span className="text-white font-bold">Email Address:</span> Used to uniquely identify your studio account and sync your production credits.</li>
                        <li><span className="text-white font-bold">Public Profile (Name/Picture):</span> Used to personalize your workspace interface.</li>
                    </ul>
                </section>

                <section className="space-y-6 bg-indigo-900/10 border border-indigo-500/20 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <TrashIcon className="w-20 h-20 text-indigo-500" />
                    </div>
                    <h3 className="text-xl font-black text-indigo-400 uppercase tracking-widest flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                        3. User Data Deletion Instructions
                    </h3>
                    <p className="leading-relaxed text-sm text-indigo-100/70 font-medium">
                        According to Facebook's Platform Rules, we provide a clear path for users to request the deletion of their data. You may delete your account and all associated AI production assets at any time.
                    </p>
                    <div className="space-y-4">
                        <div className="flex items-start gap-4 bg-black/40 p-4 rounded-xl border border-white/5">
                            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-black text-white shrink-0 mt-1">1</div>
                            <p className="text-sm text-gray-300">Email <span className="text-indigo-400 font-black">{SUPPORT_EMAIL}</span> from your registered email address.</p>
                        </div>
                        <div className="flex items-start gap-4 bg-black/40 p-4 rounded-xl border border-white/5">
                            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-black text-white shrink-0 mt-1">2</div>
                            <p className="text-sm text-gray-300">Subject line: <span className="text-white font-bold uppercase tracking-wider italic">"Data Deletion Request - [Your Name]"</span>.</p>
                        </div>
                        <div className="flex items-start gap-4 bg-black/40 p-4 rounded-xl border border-white/5">
                            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-black text-white shrink-0 mt-1">3</div>
                            <p className="text-sm text-gray-300">Our team will verify the request and permanently purge your email, profile data, and AI assets from our servers within <span className="text-white font-bold">48 hours</span>.</p>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-lg font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">4. Data Usage</h3>
                    <p className="leading-relaxed text-sm text-gray-400">We do not sell, rent, or trade user data. Your data is used exclusively to maintain your "Actor Roster," "Storyboard History," and "Credit Balance."</p>
                </section>

                <section className="space-y-4 pt-10">
                    <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em] text-center">
                        Thetori Ai Production Engine • Privacy Compliance Office
                    </p>
                </section>
            </div>
        </div>
    </div>
);

const App: React.FC = () => {
    const [session, setSession] = useState<any>(null);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [activeView, setActiveView] = useState('welcome'); 
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    
    // Check for privacy route
    const isPrivacyPage = window.location.pathname === '/privacy';

    const [visualStyle, setVisualStyle] = useState(() => localStorage.getItem('visualStyle') || '3D Render');
    const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem('aspectRatio') || '16:9');
    const [characterStyle, setCharacterStyle] = useState(() => localStorage.getItem('characterStyle') || 'Afro-toon');
    const [selectedCountry, setSelectedCountry] = useState(() => localStorage.getItem('selectedCountry') || 'Nigeria');
    const [imageModel, setImageModel] = useState('gemini-2.5-flash-image');
    const [videoModel, setVideoModel] = useState('veo-3.1-fast-generate-preview');
    const [videoResolution, setVideoResolution] = useState('720p');

    const [characters, setCharacters] = useState<Character[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [savedScenes, setSavedScenes] = useState<any[]>([]);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    
    const [creditSettings, setCreditSettings] = useState({ creditBalance: 1000, currency: 'USD' });

    useEffect(() => {
        const fetchProfile = async () => {
            if (session?.user?.id) {
                const { data, error } = await supabase.from('profiles').select('credits').eq('id', session.user.id).single();
                if (!error && data) {
                    setCreditSettings(prev => ({ ...prev, creditBalance: data.credits }));
                }
            }
        };
        fetchProfile();
    }, [session]);

    const [storybook, setStorybook] = useState<Storybook>(() => {
        try {
            const saved = localStorage.getItem('storybookState');
            return saved ? JSON.parse(saved) : { title: '', characters: [], storyNarrative: '', scenes: [], includeDialogue: true };
        } catch (e) { return { title: '', characters: [], storyNarrative: '', scenes: [], includeDialogue: true }; }
    });
    
    const [storySeed, setStorySeed] = useState(() => localStorage.getItem('storySeedMemory') || '');
    const [activeHistoryIndex, setActiveHistoryIndex] = useState(-1);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // FOOTAGE DESK SPECIFIC STATE (PERSISTENT)
    const [footageHistory, setFootageHistory] = useState<any[]>([]);
    const [footagePrompt, setFootagePrompt] = useState(() => localStorage.getItem('footagePrompt') || '');
    const [footageMode, setFootageMode] = useState<'image' | 'video'>(() => (localStorage.getItem('footageMode') as any) || 'image');
    const [footageVideoTier, setFootageVideoTier] = useState(() => localStorage.getItem('footageVideoTier') || 'veo31-fast');
    const [footageImageTier, setFootageImageTier] = useState(() => localStorage.getItem('footageImageTier') || 'fast');
    const [footageRefImages, setFootageRefImages] = useState<(string | null)[]>(() => {
        try {
            const saved = localStorage.getItem('footageRefImages');
            return saved ? JSON.parse(saved) : [null, null, null];
        } catch (e) { return [null, null, null]; }
    });

    // TIMELINE PERSISTENT STATE
    const [timelineClips, setTimelineClips] = useState<any[]>([]);
    const [audioClips, setAudioClips] = useState<any[]>([]);
    const [textClips, setTextClips] = useState<any[]>([]);

    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [modalData, setModalData] = useState<any>({});
    const [activeVideoIndices, setActiveVideoIndices] = useState<number[]>([]);
    const [activeI2ISlot, setActiveI2ISlot] = useState<{ genId: number, sceneId: string } | null>(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }: any) => { 
            setSession(session); 
            setIsAuthChecking(false); 
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => { 
            setSession(session); 
            if (session && activeView === 'welcome') {
                setActiveView(isMobile ? 'menu' : 'welcome');
            }
            if (_event === 'SIGNED_OUT') {
                setCharacters([]);
                setHistory([]);
                setFootageHistory([]);
                setTimelineClips([]);
                setAudioClips([]);
                setTextClips([]);
                setActiveHistoryIndex(-1);
            }
        });
        return () => subscription.unsubscribe();
    }, [activeView, isMobile]);

    useEffect(() => {
        const loadData = async () => {
            const h = await dbGet('appHistory'); const s = await dbGet('savedScenes'); const c = await dbGet('characters');
            const tc = await dbGet('timelineClips'); const ac = await dbGet('audioClips'); const txt = await dbGet('textClips');
            const fh = await dbGet('footageHistory');
            if (h) setHistory(h); if (s) setSavedScenes(s); if (c) setCharacters(c);
            if (tc) setTimelineClips(tc); if (ac) setAudioClips(ac); if (txt) setTextClips(txt);
            if (fh) setFootageHistory(fh);
            setIsDataLoaded(true);
        };
        loadData();
    }, []);

    useEffect(() => { if(isDataLoaded) dbSet('appHistory', history); }, [history, isDataLoaded]);
    useEffect(() => { if(isDataLoaded) dbSet('savedScenes', savedScenes); }, [savedScenes, isDataLoaded]);
    useEffect(() => { if(isDataLoaded) dbSet('characters', characters); }, [characters, isDataLoaded]);
    useEffect(() => { if(isDataLoaded) dbSet('timelineClips', timelineClips); }, [timelineClips, isDataLoaded]);
    useEffect(() => { if(isDataLoaded) dbSet('audioClips', audioClips); }, [audioClips, isDataLoaded]);
    useEffect(() => { if(isDataLoaded) dbSet('textClips', textClips); }, [textClips, isDataLoaded]);
    useEffect(() => { if(isDataLoaded) dbSet('footageHistory', footageHistory); }, [footageHistory, isDataLoaded]);

    // Footage Desk Persistence
    useEffect(() => localStorage.setItem('footagePrompt', footagePrompt), [footagePrompt]);
    useEffect(() => localStorage.setItem('footageMode', footageMode), [footageMode]);
    useEffect(() => localStorage.setItem('footageVideoTier', footageVideoTier), [footageVideoTier]);
    useEffect(() => localStorage.setItem('footageImageTier', footageImageTier), [footageImageTier]);
    useEffect(() => localStorage.setItem('footageRefImages', JSON.stringify(footageRefImages)), [footageRefImages]);

    useEffect(() => localStorage.setItem('storybookState', JSON.stringify(storybook)), [storybook]);
    useEffect(() => localStorage.setItem('selectedCountry', selectedCountry), [selectedCountry]);
    useEffect(() => localStorage.setItem('visualStyle', visualStyle), [visualStyle]);
    useEffect(() => localStorage.setItem('aspectRatio', aspectRatio), [aspectRatio]);
    useEffect(() => localStorage.setItem('characterStyle', characterStyle), [characterStyle]);

    // Sync Credits back to database
    useEffect(() => {
        if (session?.user?.id && isDataLoaded) {
            supabase.from('profiles').update({ credits: creditSettings.creditBalance }).eq('id', session.user.id);
        }
    }, [creditSettings.creditBalance, session, isDataLoaded]);

    const ensureApiKey = async () => {
        if (typeof window.aistudio !== 'undefined' && typeof window.aistudio.hasSelectedApiKey === 'function') {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (!hasKey) {
                await window.aistudio.openSelectKey();
                return true; 
            }
        }
        return true;
    };

    const handleGenerate = async (prompts: string[], source: string = 'idea', referenceImage?: string, preferredImageModel?: string) => {
        const activeImageModel = preferredImageModel || imageModel;
        
        if (activeImageModel === 'gemini-3-pro-image-preview') {
            await ensureApiKey();
        }

        const cost = (activeImageModel === 'gemini-3-pro-image-preview' ? 2 : 1) + (referenceImage ? 1 : 0);
        const totalCost = (prompts?.length || 1) * cost;
        if (creditSettings.creditBalance < totalCost) return;
        setIsGenerating(true); 
        
        if (source !== 'footage') setActiveView('storyboard');

        try {
            let sessionId = Date.now();
            const sessionTitle = source === 'storybook' ? 'Storywriter' : source === 'footage' ? 'Footage Desk' : "Production";
            const newItem = { id: sessionId, type: source, prompt: sessionTitle, imageSet: [], videoStates: [], aspectRatio, characterStyle, visualStyle, isClosed: false };
            
            setHistory(prev => {
                const next = [...prev, newItem];
                if (source !== 'footage') setActiveHistoryIndex(next.length - 1);
                return next;
            });

            const placeholders = prompts.map((p, i) => ({ sceneId: `scene-${sessionId}-${i}`, prompt: p, src: null, error: null, isHidden: false, status: 'pending', variants: [] }));
            setHistory(prev => prev.map(h => h.id === sessionId ? { ...h, imageSet: placeholders, videoStates: placeholders.map(() => ({ status: 'idle', clips: [], draftScript: '', draftCameraMovement: 'Zoom In (Focus In)' })) } : h));
            
            let currentSequentialRef: string | undefined = referenceImage;

            for (let i = 0; i < prompts.length; i++) {
                const activeRef = (source === 'storybook' && i > 0) ? currentSequentialRef : referenceImage;
                
                const { src, error } = await generateSingleImage(prompts[i], aspectRatio, characterStyle, visualStyle, "General", characters, activeImageModel, activeRef);
                
                if (src) {
                    currentSequentialRef = src;
                }

                const updatedScene = { 
                    sceneId: `scene-${sessionId}-${i}`, 
                    src, 
                    error, 
                    status: error ? 'error' : 'complete', 
                    variants: src ? [{ src, prompt: prompts[i], angleName: 'Original' }] : [], 
                    selectedVariantIndex: 0, 
                    originSessionId: sessionId, 
                    originSection: source === 'storybook' ? 'StorybookSection' : source === 'footage' ? 'FootageFrontSection' : 'FootageFrontSection' 
                };

                setHistory(prev => prev.map(h => h.id === sessionId ? { ...h, imageSet: h.imageSet.map((s: any, idx: number) => idx === i ? updatedScene : s) } : h));
                
                if (source === 'footage') {
                    setFootageHistory(prev => [updatedScene, ...prev]);
                }

                const isSafetyBlock = error === 'BLOCK_MINOR' || error === 'BLOCK_SAFETY_GENERAL';
                if (src && !isSafetyBlock) {
                    setCreditSettings((p: any) => ({ ...p, creditBalance: p.creditBalance - cost }));
                }
            }
        } catch (e: any) { console.error(e); } finally { setIsGenerating(false); }
    };

    const handleRegenerateScene = async (genId: number, sceneId: string) => {
        const sessionId = genId;
        const session = history.find(h => h.id === sessionId);
        if (!session) return;
        
        const sceneIndex = session.imageSet.findIndex((s: any) => s.sceneId === sceneId);
        if (sceneIndex === -1) return;
        
        const currentScene = session.imageSet[sceneIndex];
        const prompt = currentScene.prompt;
        
        let refImage = null;
        if (sceneIndex > 0) {
            refImage = session.imageSet[sceneIndex - 1].src;
        }

        if (creditSettings.creditBalance < 1) return;
        
        // DO add comment: Fixed status update. Removed illegal references to src/error before API call.
        setHistory(prev => prev.map(h => h.id === genId ? {
            ...h,
            imageSet: h.imageSet.map((s: any) => s.sceneId === sceneId ? { ...s, status: 'generating' } : s)
        } : h));

        try {
            const { src, error } = await generateSingleImage(prompt, aspectRatio, characterStyle, visualStyle, "General", characters, imageModel, refImage);
            
            setHistory(prev => prev.map(h => h.id === genId ? {
                ...h,
                imageSet: h.imageSet.map((s: any) => { 
                    if (s.sceneId === sceneId) {
                        return {
                            ...s, 
                            src: src || s.src, 
                            error, 
                            status: error ? 'error' : 'complete',
                            variants: src ? [...(s.variants || []), { src, prompt, angleName: 'Regenerated' }] : s.variants,
                            selectedVariantIndex: src ? (s.variants?.length || 0) : s.selectedVariantIndex
                        };
                    }
                    return s;
                })
            } : h));

            const isSafetyBlock = error === 'BLOCK_MINOR' || error === 'BLOCK_SAFETY_GENERAL';
            if (src && !isSafetyBlock) setCreditSettings((p: any) => ({ ...p, creditBalance: p.creditBalance - 1 }));
        } catch (e) {
            console.error(e);
            setHistory(prev => prev.map(h => h.id === genId ? {
                ...h,
                imageSet: h.imageSet.map((s: any) => s.sceneId === sceneId ? { ...s, status: 'error', error: 'Regeneration failed' } : s)
            } : h));
        }
    };

    const handleFootageProduce = async (prompt: string, mode: 'image' | 'video' | 'i2i', refImage?: string, videoTier?: string, imageTier?: string) => {
        const modelToUse = imageTier === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
        
        const ethnicityContext = characterStyle === 'Afro-toon' ? "Subject: African/Black person." : `Subject: Person from ${selectedCountry}.`;
        const styleContext = `Visual Medium: [${visualStyle}].`;
        const finalPrompt = `${styleContext} ${ethnicityContext} Location: ${selectedCountry}. Scene Description: ${prompt}`;
        
        await handleGenerate([finalPrompt], 'footage', refImage, modelToUse);
    };

    const handleAnimateFootage = async (item: any) => {
        await ensureApiKey();
        const cost = videoModel.includes('fast') ? 5 : 8;
        if (creditSettings.creditBalance < cost) return;

        setFootageHistory(prev => prev.map(f => f.sceneId === item.sceneId ? { ...f, videoStatus: 'loading' } : f));
        
        try {
            const { videoUrl, videoObject } = await generateVideoFromScene(
                { src: item.src, prompt: item.prompt }, 
                aspectRatio, 
                item.prompt, 
                null, 
                visualStyle, 
                characterStyle, 
                videoModel, 
                videoResolution as any, 
                'Zoom In', 
                () => {},
                characters
            );
            
            if (videoUrl) {
                setFootageHistory(prev => prev.map(f => f.sceneId === item.sceneId ? { 
                    ...f, 
                    videoStatus: 'complete', 
                    videoClips: [...(f.videoClips || []), { videoUrl, videoObject }] 
                } : f));
                setCreditSettings((p: any) => ({ ...p, creditBalance: p.creditBalance - cost }));
            }
        } catch (e) {
            console.error(e);
            setFootageHistory(prev => prev.map(f => f.sceneId === item.sceneId ? { ...f, videoStatus: 'error' } : f));
        }
    };

    const handleApplyCameraAngle = async (angle: string, subject?: string) => {
        if (!modalData.genId || !modalData.sceneId) return;
        const sess = history.find(h => h.id === modalData.genId);
        const scene = sess?.imageSet.find((s: any) => s.sceneId === modalData.sceneId);
        if (!scene || !sess) return;

        if (creditSettings.creditBalance < 2) return;
        setIsGenerating(true);
        setActiveModal(null);

        try {
            const focusDirective = subject ? ` focusing specifically on ${subject}` : "";
            const prompt = `A ${angle}${focusDirective}. Re-render the existing scene with a new camera placement. Maintain environment and subject identical.`;
            
            const { src, error } = await generateSingleImage(
                prompt,
                sess.aspectRatio,
                sess.characterStyle,
                sess.visualStyle,
                "General",
                characters,
                imageModel,
                scene.src,
                null
            );

            if (src) {
                handleAddSceneVariant(modalData.genId, modalData.sceneId, src, prompt, angle);
                const isSafetyBlock = error === 'BLOCK_MINOR' || error === 'BLOCK_SAFETY_GENERAL';
                if (!isSafetyBlock) setCreditSettings((p: any) => ({ ...p, creditBalance: p.creditBalance - 2 }));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateSingleStorybookScene = async (index: number, model: string) => {
        const scene = storybook.scenes[index];
        if (!scene) return;
        handleGenerate([scene.imageDescription], 'storybook', undefined, model);
    };

    const masterHistory = useMemo(() => {
        return (history || []).flatMap(h => (h.imageSet || []).map((s: any) => ({
            ...s, 
            originSessionId: h.id,
            timestamp: h.id, 
            originSection: h.type === 'storybook' ? 'StorybookSection' : h.type === 'upload' ? 'UploadedSection' : h.type === 'timeline' ? 'TimelineSection' : h.type === 'footage' ? 'FootageFrontSection' : 'FootageFrontSection'
        })));
    }, [history]);

    const handleUploadStartImage = async (file: File) => {
        try {
            const rawBase64 = await fileToBase64(file);
            const sessionId = Date.now();
            const sceneId = `scene-${sessionId}-0`;
            const newItem = { id: sessionId, type: 'upload', prompt: "Manual Upload", imageSet: [{ sceneId, src: rawBase64, status: 'complete', prompt: 'Uploaded Image', variants: [{ src: rawBase64, prompt: 'Original Upload', angleName: 'Original' }], selectedVariantIndex: 0, originSessionId: sessionId, originSection: 'UploadedSection' }], videoStates: [{ status: 'idle', clips: [], draftScript: '', draftCameraMovement: 'Zoom In (Focus In)' }], aspectRatio, characterStyle, visualStyle, isClosed: false };
            
            setHistory(prev => {
                const next = [...prev, newItem];
                setActiveHistoryIndex(next.length - 1);
                return next;
            });
            
            setActiveView('storyboard');
        } catch (e) { console.error("Upload failed", e); }
    };

    const handleCaptureFrame = (base64: string) => {
        const existingTimelineIndex = history.findIndex(h => h.type === 'timeline');

        if (existingTimelineIndex !== -1) {
            const existingSess = history[existingTimelineIndex];
            const sceneId = `scene-${existingSess.id}-${existingSess.imageSet.length}`;
            const newScene = { 
                sceneId, 
                src: base64, 
                status: 'complete', 
                prompt: 'Timeline Frame', 
                variants: [{ src: base64, prompt: 'Snap', angleName: 'Timeline' }], 
                selectedVariantIndex: 0, 
                originSessionId: existingSess.id,
                originSection: 'TimelineSection' 
            };
            const newVideoState = { status: 'idle', clips: [], draftScript: '', draftCameraMovement: 'Zoom In (Focus In)' };

            setHistory(prev => prev.map((h, i) => i === existingTimelineIndex ? {
                ...h,
                imageSet: [...h.imageSet, newScene],
                videoStates: [...h.videoStates, newVideoState],
                isClosed: false
            } : h));
            setActiveHistoryIndex(existingTimelineIndex);
        } else {
            const sessionId = Date.now();
            const sceneId = `scene-${sessionId}-0`;
            const newItem = { 
                id: sessionId, 
                type: 'timeline', 
                prompt: "Timeline Snap", 
                imageSet: [{ 
                    sceneId, 
                    src: base64,
                    status: 'complete', 
                    prompt: 'Timeline Frame', 
                    variants: [{ src: base64, prompt: 'Snap', angleName: 'Timeline' }], 
                    selectedVariantIndex: 0, 
                    originSessionId: sessionId,
                    originSection: 'TimelineSection' 
                }], 
                videoStates: [{ status: 'idle', clips: [], draftScript: '', draftCameraMovement: 'Zoom In (Focus In)' }], 
                aspectRatio, 
                characterStyle, 
                visualStyle, 
                isClosed: false 
            };
            setHistory(prev => {
                const next = [...prev, newItem];
                setActiveHistoryIndex(next.length - 1);
                return next;
            });
        }
        setActiveView('storyboard');
    };

    const handleToggleSave = (card: any) => {
        const sceneIdToMatch = card.sceneId || card.id;
        const isSaved = savedScenes.some(s => (s.sceneId || s.id) === sceneIdToMatch);
        if (isSaved) {
            setSavedScenes(prev => prev.filter(s => (s.sceneId || s.id) !== sceneIdToMatch));
        } else {
            setSavedScenes(prev => [...prev, { ...card, id: card.id || `${card.originSessionId || Date.now()}-${sceneIdToMatch}` }]);
        }
    };

    const handleDeleteScene = (genId: number, sceneId: string) => {
        setHistory(prev => {
            const newHistory = prev.map(h => {
                if (h.id !== genId) return h;
                const updatedImageSet = h.imageSet.map((s: any) => s.sceneId === sceneId ? { ...s, isHidden: true } : s);
                const hasVisible = updatedImageSet.some((s: any) => !s.isHidden);
                return { ...h, imageSet: updatedImageSet, isClosed: !hasVisible };
            });

            const currentSession = newHistory.find(h => h.id === genId);
            if (currentSession?.isClosed) {
                const nextOpenIdx = newHistory.findIndex(h => !h.isClosed);
                setActiveHistoryIndex(nextOpenIdx);
            }
            return newHistory;
        });
    };

    const handleLoadHistory = (index: number, sceneId?: string, restore?: boolean) => {
        if (index === -1) return;
        setHistory(prev => prev.map((h, i) => {
            if (i !== index) return h;
            return {
                ...h,
                isClosed: false,
                imageSet: h.imageSet.map((s: any) => 
                    (s.sceneId === sceneId || !sceneId) ? { ...s, isHidden: false } : s
                )
            };
        }));
        setActiveHistoryIndex(index);
        setActiveView('storyboard');
        setActiveModal(null);
    };

    const handleUploadToSession = async (file: File, sessionId: number) => {
        try {
            const rawBase64 = await fileToBase64(file);
            setHistory(prev => prev.map(h => h.id === sessionId ? {
                ...h,
                isClosed: false, 
                imageSet: [...h.imageSet, {
                    sceneId: `scene-${sessionId}-${h.imageSet.length}`,
                    src: rawBase64,
                    status: 'complete',
                    prompt: 'Uploaded Image',
                    variants: [{ src: rawBase64, prompt: 'Original Upload', angleName: 'Original' }],
                    selectedVariantIndex: 0,
                    originSessionId: sessionId,
                    originSection: 'UploadedSection'
                }],
                videoStates: [...h.videoStates, { status: 'idle', clips: [], draftScript: '', draftCameraMovement: 'Zoom In (Focus In)' }]
            } : h));
        } catch (e) { console.error("Upload to session failed", e); }
    };

    const handleUndoEdit = (genId: number, sceneId: string) => {
        setHistory(prev => prev.map(h => h.id === genId ? {
            ...h,
            imageSet: h.imageSet.map((s: any) => {
                if (s.sceneId !== sceneId || !s.variants || s.variants.length <= 1) return s;
                const newVariants = s.variants.slice(0, -1);
                const prevVariant = newVariants[newVariants.length - 1];
                return { ...s, src: prevVariant.src, variants: newVariants, selectedVariantIndex: newVariants.length - 1 };
            })
        } : h));
    };

    const handleAddSceneVariant = (genId: number, sceneId: string, src: string, prompt: string, angleName: string) => {
        setHistory(prev => prev.map(h => h.id === genId ? {
            ...h,
            imageSet: h.imageSet.map((s: any) => s.sceneId === sceneId ? {
                ...s,
                src: src, 
                variants: [...(s.variants || []), { src, prompt, angleName }],
                selectedVariantIndex: (s.variants?.length || 0)
            } : s)
        } : h));
    };

    // DO add comment above each fix. Removed duplicate definition of handleSelectSceneVariant.
    const handleSelectSceneVariant = (genId: number, sceneId: string, variantIndex: number) => {
        setHistory(prev => prev.map(h => h.id === genId ? {
            ...h,
            imageSet: h.imageSet.map((s: any) => s.sceneId === sceneId ? {
                ...s,
                src: s.variants[variantIndex].src,
                selectedVariantIndex: variantIndex
            } : s)
        } : h));
    };

    const handleUpdateSceneImage = (genId: number, sceneId: string, base64: string) => {
        setHistory(prev => prev.map(h => h.id === genId ? {
            ...h,
            imageSet: h.imageSet.map((s: any) => {
                if (s.sceneId !== sceneId) return s;
                const vIdx = s.variants?.findIndex((v: any) => v.src === base64);
                if (vIdx !== -1 && vIdx !== undefined) {
                    return { ...s, src: base64, selectedVariantIndex: vIdx };
                }
                return { ...s, src: base64 };
            })
        } : h));
    };

    const handleGenerateVideo = async (genId: number, sceneId: string, script?: string, cameraMovement?: string, withAudio?: boolean) => {
        await ensureApiKey();
        const cost = (videoModel.includes('fast') ? 5 : 8) + (withAudio ? 1 : 0);
        if (creditSettings.creditBalance < cost) return;
        const item = history.find(h => h.id === genId);
        const sceneIdx = item.imageSet.findIndex((s: any) => s.sceneId === sceneId);
        setHistory(prev => prev.map(h => h.id === genId ? { ...h, videoStates: h.videoStates.map((vs: any, idx: number) => idx === sceneIdx ? { ...vs, status: 'loading' } : vs) } : h));
        try {
            const { videoUrl, videoObject } = await generateVideoFromScene(item.imageSet[sceneIdx], aspectRatio, item.imageSet[sceneIdx].prompt, null, visualStyle, characterStyle, videoModel, videoResolution as any, cameraMovement || 'Zoom In', () => {}, characters);
            if (videoUrl) {
                setHistory(prev => prev.map(h => h.id === genId ? { ...h, videoStates: h.videoStates.map((vs: any, idx: number) => idx === sceneIdx ? { ...vs, status: 'complete', clips: [...(vs.clips || []), { videoUrl, videoObject }] } : vs) } : h));
                const currentEnd = Math.max(0, ...timelineClips.map(c => (c.startTime || 0) + c.duration));
                setTimelineClips(prev => [...prev, { id: Date.now().toString(), url: videoUrl, duration: 8, startTime: currentEnd, originalDuration: 8, videoObject, isMuted: false }]);
                setCreditSettings((p: any) => ({ ...p, creditBalance: p.creditBalance - cost }));
            }
        } catch (e: any) { 
            console.error(e); 
            if (e.message?.includes('Requested entity was not found')) {
                await window.aistudio.openSelectKey();
            }
            setHistory(prev => prev.map(h => h.id === genId ? { ...h, videoStates: h.videoStates.map((vs: any, idx: number) => idx === sceneIdx ? { ...vs, status: 'idle' } : vs) } : h));
        }
    };

    const handleClearHistory = useCallback(() => {
        setHistory(prev => {
            const filteredHistory = prev.map(session => {
                const newImageSet: any[] = [];
                const newVideoStates: any[] = [];
                
                (session.imageSet || []).forEach((img: any, idx: number) => {
                    const isSaved = savedScenes.some(s => (s.sceneId || s.id) === img.sceneId);
                    const isActiveOnStage = !session.isClosed && !img.isHidden;
                    
                    if (isSaved || isActiveOnStage) {
                        newImageSet.push(img);
                        if (session.videoStates && session.videoStates[idx]) {
                            newVideoStates.push(session.videoStates[idx]);
                        }
                    }
                });

                if (newImageSet.length === 0) return null;

                return {
                    ...session,
                    imageSet: newImageSet,
                    videoStates: newVideoStates
                };
            }).filter(Boolean);

            const activeSessionId = prev[activeHistoryIndex]?.id;
            const nextActiveIdx = filteredHistory.findIndex(h => h.id === activeSessionId);
            setActiveHistoryIndex(nextActiveIdx);

            return filteredHistory;
        });
    }, [savedScenes, activeHistoryIndex]);

    if (isPrivacyPage) return <PrivacyPolicy />;

    const MobileViewWrapper: React.FC<{ children: React.ReactNode, title: string }> = ({ children, title }) => (
        <div className="fixed inset-0 z-[100] bg-gray-950 flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="p-4 border-b border-white/5 bg-[#0a0f1d] flex justify-between items-center shrink-0">
                <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] ml-2">{title}</h2>
                <button onClick={() => setActiveView('menu')} className="p-2.5 bg-gray-800 hover:bg-red-900/30 rounded-xl text-gray-400 hover:text-red-400 transition-all">
                    <XIcon className="w-6 h-6" />
                </button>
            </div>
            <div className="flex-1 overflow-hidden">
                {children}
            </div>
        </div>
    );

    const renderRoster = () => (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-gray-800">
            <div className="max-w-5xl mx-auto w-full">
                <ActorRoster characters={characters} setCharacters={setCharacters} handleBuildCharacterVisual={async (id) => {
                    if (creditSettings.creditBalance < 3) return; 
                    const char = characters.find(c => c.id === id); if (!char) return;
                    setCharacters(prev => prev.map(c => c.id === id ? { ...c, isDescribing: true } : c));
                    try { 
                        const { src, error } = await generateCharacterVisual(char, visualStyle, characterStyle, selectedCountry); 
                        if (src) {
                            const { description } = await generateCharacterDescription(src, 'image/png');
                            setCharacters(prev => prev.map(c => c.id === id ? { ...c, imagePreview: `data:image/png;base64,${src}`, description, detectedImageStyle: null } : c));
                            setCreditSettings((p: any) => ({ ...p, creditBalance: p.creditBalance - 3 }));
                        } else if (error) {
                            setCharacters(prev => prev.map(c => c.id === id ? { ...c, detectedImageStyle: error } : c));
                        }
                    } finally { 
                        setCharacters(prev => prev.map(c => c.id === id ? { ...c, isDescribing: false } : c)); 
                    }
                }} handleUploadNewCharacterImage={async (f) => {
                    const base64 = await fileToBase64(f);
                    const newChar: Character = { id: Date.now(), name: '', imagePreview: `data:${f.type};base64,${base64}`, originalImageBase64: base64, originalImageMimeType: f.type, description: null, detectedImageStyle: null, isDescribing: false, isHero: false };
                    setCharacters(prev => [...prev, newChar]);
                }} handleCharacterImageUpload={async (f, id) => {
                    if (creditSettings.creditBalance < 1) return; 
                    const base64 = await fileToBase64(f); setCharacters(prev => prev.map(c => c.id === id ? { ...c, isAnalyzing: true } : c));
                    try { 
                        const { description, detectedStyle } = await generateCharacterDescription(base64, f.type); 
                        setCharacters(prev => prev.map(c => c.id === id ? { ...c, imagePreview: `data:${f.type};base64,${base64}`, originalImageBase64: base64, originalImageMimeType: f.type, description, detectedStyle, isAnalyzing: false } : c)); 
                        setCreditSettings((p: any) => ({ ...p, creditBalance: p.creditBalance - 1 }));
                    } catch { 
                        setCharacters(prev => prev.map(c => c.id === id ? { ...c, isAnalyzing: false } : c)); 
                    }
                }} updateCharacter={(id, p) => setCharacters(prev => prev.map(c => c.id === id ? { ...c, ...p } : c))} removeCharacter={(id) => setCharacters(prev => prev.filter(c => c.id !== id))} onToggleHero={(id) => setCharacters(prev => prev.map(c => ({ ...c, isHero: c.id === id ? !c.isHero : false })))} visualStyle={visualStyle} />
            </div>
        </div>
    );

    const renderStorybook = () => (
        <StorybookCreator 
            storybookContent={storybook} setStorybookContent={setStorybook} 
            characters={characters} characterStyle={characterStyle} selectedCountry={selectedCountry} creditBalance={creditSettings.creditBalance}
            onClose={() => setActiveView(isMobile ? 'menu' : 'welcome')} onGenerateFromStorybook={(s) => handleGenerate(s, 'storybook')}
            onGenerateSingleStorybookScene={handleGenerateSingleStorybookScene}
            onResetStorybook={() => setStorybook({ title: '', characters: [], storyNarrative: '', scenes: [], includeDialogue: true })}
            storySeed={storySeed} setStorySeed={setStorySeed}
        />
    );

    const renderStoryboard = () => (
        <Storyboard 
            generationItem={activeHistoryIndex !== -1 ? history[activeHistoryIndex] : null} savedItems={savedScenes} history={history} historyIndex={activeHistoryIndex}
            onSaveScene={(gid, sid) => { const sess = history.find(h => h.id === gid); const img = sess?.imageSet.find((s:any) => s.sceneId === sid); if(img) handleToggleSave(img); }}
            onEditScene={(gid, sid) => { const sess = history.find(h => h.id === gid); const img = sess?.imageSet.find((s:any) => s.sceneId === sid); setModalData({ genId: gid, sceneId: sid, src: img.src, variants: img.variants || [] }); setActiveModal('edit-image'); }}
            onRegenerateScene={handleRegenerateScene} onAngleSelect={(gid, sid) => { const sess = history.find(h => h.id === gid); const img = sess?.imageSet.find((s:any) => s.sceneId === sid); setModalData({ genId: gid, sceneId: sid, src: img.src }); setActiveModal('camera-angles'); }}
            onOpenVideoCreator={(idx) => setActiveVideoIndices(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}
            onGenerateVideo={handleGenerateVideo} onAddToTimeline={(url, dur, obj) => setTimelineClips(prev => {
                const end = Math.max(0, ...prev.map(c => (c.startTime || 0) + c.duration));
                return [...prev, { id: Date.now().toString(), url, duration: dur || 8, startTime: end, originalDuration: dur || 8, videoObject: obj, isMuted: false }];
            })}
            isGenerating={isGenerating} isDisabled={false} activeVideoIndices={activeVideoIndices}
            videoModel={videoModel} setVideoModel={setVideoModel} setVideoResolution={setVideoResolution}
            onPreviewImage={(src) => { setModalData({ src }); setActiveModal('image-preview'); }}
            onSwitchSession={handleLoadHistory} onNewSession={() => setActiveHistoryIndex(-1)}
            onUpdateVideoDraft={(gid, sid, upd) => setHistory(prev => prev.map(h => h.id === gid ? { ...h, videoStates: h.videoStates.map((vs: any, idx: number) => h.imageSet[idx].sceneId === sid ? { ...vs, ...upd } : vs) } : h))}
            creditBalance={creditSettings.creditBalance} currency="USD" activeI2ISlot={activeI2ISlot} setActiveI2ISlot={setActiveI2ISlot}
            onUploadStartImage={handleUploadStartImage} onUploadToSession={handleUploadToSession} onStop={() => setIsGenerating(false)}
            onDeleteScene={handleDeleteScene} onUndoEdit={handleUndoEdit}
            storybook={storybook}
            onSceneVariantChange={(gid, sid, dir) => {
                const hIdx = history.findIndex(h => h.id === gid);
                if (hIdx === -1) return;
                const scene = history[hIdx].imageSet.find((s: any) => s.sceneId === sid);
                if (!scene || !scene.variants) return;
                const cur = scene.selectedVariantIndex || 0;
                let nextIdx = dir === 'next' ? cur + 1 : cur - 1;
                if (nextIdx < 0) nextIdx = scene.variants.length - 1;
                if (nextIdx >= scene.variants.length) nextIdx = 0;
                handleSelectSceneVariant(gid, sid, nextIdx);
            }}
        />
    );

    const renderTimeline = () => (
        <Timeline 
            clips={timelineClips} 
            audioClips={audioClips}
            textClips={textClips}
            onUpdateTextClips={setTextClips}
            onReorder={() => {}} onReorderAudio={() => {}}
            onDelete={(id) => setTimelineClips(p => p.filter(c => c.id !== id))} 
            onDeleteAudio={(id) => setAudioClips(p => p.filter(c => c.id !== id))}
            onUpdateClip={(id, u) => setTimelineClips(p => p.map(c => c.id === id ? { ...c, ...u } : c))}
            onUpdateAudioClip={(id, u) => setAudioClips(p => p.map(c => c.id === id ? { ...c, ...u } : c))} 
            onClear={() => { setTimelineClips([]); setAudioClips([]); setTextClips([]); }} 
            onExport={() => { setModalData({ clips: timelineClips }); setActiveModal('export-video'); }}
            isMinimized={false} setIsMinimized={() => {}} isTheaterMode={true} setIsTheaterMode={() => {}}
            onAddClip={(url, file, dur, start) => setTimelineClips(prev => {
                const end = start !== undefined ? start : Math.max(0, ...prev.map(c => (c.startTime || 0) + c.duration));
                return [...prev, { id: Date.now().toString(), url, duration: dur || 8, startTime: end, originalDuration: dur || 8, isMuted: false }];
            })}
            onAddAudioClip={(url, dur, start) => setAudioClips(prev => {
                const end = start !== undefined ? start : Math.max(0, ...prev.map(ac => ac.startTime + ac.duration));
                return [...prev, { id: Date.now().toString(), url, duration: dur || 10, startTime: end, isMuted: false }];
            })}
            onExtend={() => {}} onPlayAll={() => {}} onCreateScene={() => {}} onCaptureFrame={handleCaptureFrame}
        />
    );

    const renderFootageDesk = () => (
        <Footage 
            characters={characters}
            visualStyle={visualStyle}
            aspectRatio={aspectRatio}
            characterStyle={characterStyle}
            selectedCountry={selectedCountry}
            onProduce={handleFootageProduce}
            isGenerating={isGenerating}
            creditBalance={creditSettings.creditBalance}
            footageHistory={footageHistory}
            onSaveItem={handleToggleSave}
            onDeleteItem={(sid) => setFootageHistory(prev => prev.filter(f => f.sceneId !== sid))}
            onToTimeline={(item) => {
                const url = item.videoClips?.[0]?.videoUrl || (item.src ? `data:image/png;base64,${item.src}` : null);
                if (url) {
                    const currentEnd = Math.max(0, ...timelineClips.map(c => (c.startTime || 0) + c.duration));
                    const defaultDur = 8;
                    setTimelineClips(prev => [...prev, { id: Date.now().toString(), url, duration: defaultDur, startTime: currentEnd, originalDuration: defaultDur, isMuted: false }]);
                }
            }}
            onAnimate={handleAnimateFootage}
            savedItems={savedScenes}
            footagePrompt={footagePrompt}
            setFootagePrompt={setFootagePrompt}
            footageMode={footageMode}
            setFootageMode={setFootageMode}
            footageVideoTier={footageVideoTier}
            setFootageVideoTier={setFootageVideoTier}
            footageImageTier={footageImageTier}
            setFootageImageTier={setFootageImageTier}
            footageRefImages={footageRefImages}
            setFootageRefImages={setFootageRefImages}
        />
    );

    const renderHistory = () => (
        <div className="flex-1 overflow-y-auto bg-gray-950 p-4 md:p-8 scrollbar-thin scrollbar-thumb-gray-800">
            <HistoryPanel 
                history={history} 
                masterHistory={masterHistory} 
                savedItems={savedScenes} 
                onClose={() => setActiveView(isMobile ? 'menu' : 'welcome')} 
                onLoadHistory={handleLoadHistory} 
                onClearHistory={handleClearHistory} 
                onToggleSave={handleToggleSave} 
            />
        </div>
    );

    const renderCredits = () => (
        <div className="flex-1 h-full flex flex-col items-center justify-center bg-gray-950 p-2 overflow-hidden">
             <div className="flex flex-col items-center max-w-5xl w-full animate-in fade-in zoom-in-95 duration-500 scale-[0.9] origin-center">
                <div className="text-center mb-4">
                    <h2 className="text-2xl font-black text-white italic tracking-tighter mb-0.5 uppercase leading-none">Studio Top-Up</h2>
                    <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-indigo-600/10 border border-indigo-500/30 rounded-full">
                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest italic">Pay-As-You-Produce • NOT a subscription</span>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-6">
                    <div className="bg-[#0f172a] border border-sky-500/20 rounded-xl p-4 flex flex-col items-center text-center transition-all hover:scale-[1.02] shadow-xl group">
                        <div className="w-10 h-10 rounded-xl bg-sky-600/10 flex items-center justify-center mb-3 border border-sky-500/20 group-hover:bg-sky-600 group-hover:text-white transition-all text-sky-400">
                            <CreditCardIcon className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-black text-white mb-0.5 italic tracking-tighter uppercase leading-none">Line Up</h3>
                        <div className="flex items-baseline gap-1 mb-3">
                            <span className="text-2xl font-black text-white tracking-tighter">$12</span>
                            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">One-time</span>
                        </div>
                        <a href="https://www.paypal.com/ncp/payment/4EQJXXNTMMUWW" target="_blank" className="w-full py-2.5 bg-sky-600 text-white font-black text-[9px] uppercase tracking-widest rounded-lg shadow-lg mb-4 hover:bg-sky-500 transition-colors">Purchase Now</a>
                        <div className="w-full space-y-2 text-left border-t border-white/5 pt-3">
                            <div className="flex items-center gap-2 text-sky-300">
                                <CheckIcon className="w-3.5 h-3.5 shrink-0"/>
                                <span className="text-[9px] font-black uppercase tracking-wider">100 Production Credits</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/[0.03] border-2 border-white/20 rounded-xl p-4 flex flex-col items-center text-center scale-105 z-10 shadow-[0_0_40px_rgba(255,255,255,0.05)] relative overflow-hidden group">
                        <div className="absolute top-0 left-0 right-0 bg-white text-[7px] font-black text-black py-0.5 uppercase tracking-[0.2em]">MOST POPULAR</div>
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center mt-2 mb-3 shadow-lg text-indigo-950">
                            <SparklesIcon className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-black text-white mb-0.5 italic tracking-tighter uppercase leading-none">Production</h3>
                        <div className="flex items-baseline gap-1 mb-3">
                            <span className="text-2xl font-black text-white tracking-tighter">$25</span>
                            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest italic">Best Value</span>
                        </div>
                        <a href="https://www.paypal.com/ncp/payment/Q4LLSWNWJTC4G" target="_blank" className="w-full py-2.5 bg-white text-black font-black text-[9px] uppercase tracking-widest rounded-lg shadow-lg mb-4 hover:bg-gray-200 transition-all">Fuel Vision</a>
                        <div className="w-full space-y-2 text-left border-t border-white/10 pt-3">
                            <div className="flex items-center gap-2 text-white">
                                <CheckIcon className="w-3.5 h-3.5 shrink-0 text-white"/>
                                <span className="text-[9px] font-black uppercase tracking-wider">300 Production Credits</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#0f172a] border border-amber-500/20 rounded-xl p-4 flex flex-col items-center text-center transition-all hover:scale-[1.02] shadow-xl group">
                        <div className="w-10 h-10 rounded-xl bg-amber-600/10 flex items-center justify-center mb-3 border border-amber-500/20 group-hover:bg-amber-600 group-hover:text-white transition-all text-amber-500">
                            <VideoIcon className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-black text-white mb-0.5 italic tracking-tighter uppercase leading-none">Studio</h3>
                        <div className="flex items-baseline gap-1 mb-3">
                            <span className="text-2xl font-black text-white tracking-tighter">$50</span>
                            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Max Power</span>
                        </div>
                        <a href="https://www.paypal.com/ncp/payment/QUAASXG9J8JCW" target="_blank" className="w-full py-2.5 bg-amber-600 text-white font-black text-[9px] uppercase tracking-widest rounded-lg shadow-lg mb-4 hover:bg-amber-500 transition-colors">Purchase Now</a>
                        <div className="w-full space-y-2 text-left border-t border-white/5 pt-3">
                            <div className="flex items-center gap-2 text-amber-400">
                                <CheckIcon className="w-3.5 h-3.5 shrink-0"/>
                                <span className="text-[9px] font-black uppercase tracking-wider">700 Production Credits</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full max-w-2xl bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center animate-in slide-in-from-bottom-4 shadow-2xl space-y-2">
                    <p className="text-gray-500 text-[9px] sm:text-[10px] leading-relaxed font-bold tracking-tight max-w-xl mx-auto italic">
                        freedom, no obligation. from Thetori Ai
                    </p>
                    <p className="text-indigo-400 text-[9px] sm:text-[10px] leading-relaxed font-black tracking-tight max-w-xl mx-auto italic px-4">
                        Are you a content creator wondering how to create consistent characters in your movies, but you don't really have the content? That's why Thetori Ai is here for you. a trial will convince you.
                    </p>
                    <div className="pt-2 border-t border-white/5 mt-2">
                        <span className="text-[8px] font-black text-indigo-500 uppercase tracking-[0.4em]">New Account Welcome Bonus: 1,000 Credits Applied Automatically</span>
                    </div>
                </div>
            </div>
        </div>
    );

    if (isAuthChecking) return <div className="h-screen bg-gray-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="flex h-screen bg-gray-950 text-white font-sans overflow-hidden">
            {!isMobile && session && (
                <Sidebar 
                    activeView={activeView} setActiveView={setActiveView} visualStyle={visualStyle} setVisualStyle={setVisualStyle}
                    aspectRatio={aspectRatio} setAspectRatio={setAspectRatio} characterStyle={characterStyle} setCharacterStyle={setCharacterStyle}
                    selectedCountry={selectedCountry} setSelectedCountry={setSelectedCountry} onLogout={() => { supabase.auth.signOut(); setActiveView('welcome'); }}
                    creditBalance={creditSettings.creditBalance} session={session}
                />
            )}

            <main className="flex-1 h-full overflow-hidden relative flex flex-col bg-gray-950">
                {activeView === 'welcome' && (
                    <WelcomePage session={session} onEnter={() => { if (!session) setActiveView('welcome'); else setActiveView(isMobile ? 'menu' : 'welcome'); }} />
                )}

                {!isMobile && (
                    <>
                        {activeView === 'roster' && renderRoster()}
                        {activeView === 'storybook' && <div className="flex-1 h-full overflow-hidden">{renderStorybook()}</div>}
                        {activeView === 'storyboard' && renderStoryboard()}
                        {activeView === 'timeline' && renderTimeline()}
                        {activeView === 'history' && renderHistory()}
                        {activeView === 'buy-credits' && renderCredits()}
                        {activeView === 'footage' && renderFootageDesk()}
                    </>
                )}

                {isMobile && session && (
                    <>
                        {activeView === 'menu' && (
                            <Sidebar 
                                activeView={activeView} setActiveView={setActiveView} visualStyle={visualStyle} setVisualStyle={setVisualStyle}
                                aspectRatio={aspectRatio} setAspectRatio={setAspectRatio} characterStyle={characterStyle} setCharacterStyle={setCharacterStyle}
                                selectedCountry={selectedCountry} setSelectedCountry={setSelectedCountry} onLogout={() => { supabase.auth.signOut(); setActiveView('welcome'); }}
                                creditBalance={creditSettings.creditBalance} session={session}
                            />
                        )}
                        {activeView === 'roster' && <MobileViewWrapper title="Character Roster">{renderRoster()}</MobileViewWrapper>}
                        {activeView === 'storybook' && <MobileViewWrapper title="Storywriter Section">{renderStorybook()}</MobileViewWrapper>}
                        {activeView === 'storyboard' && <MobileViewWrapper title="Production Stage">{renderStoryboard()}</MobileViewWrapper>}
                        {activeView === 'timeline' && <MobileViewWrapper title="Story Timeline">{renderTimeline()}</MobileViewWrapper>}
                        {activeView === 'history' && <MobileViewWrapper title="Production History">{renderHistory()}</MobileViewWrapper>}
                        {activeView === 'buy-credits' && <MobileViewWrapper title="Credit Exchange">{renderCredits()}</MobileViewWrapper>}
                        {activeView === 'footage' && <MobileViewWrapper title="Footage Desk">{renderFootageDesk()}</MobileViewWrapper>}
                    </>
                )}
            </main>

            <Modals 
                activeModal={activeModal} setActiveModal={setActiveModal} modalData={modalData} onClose={() => setActiveModal(null)}
                storybookContent={storybook} setStorybookContent={setStorybook} onGenerateFromStorybook={(s) => handleGenerate(s, 'storybook')}
                history={history} masterHistory={masterHistory} onLoadHistory={handleLoadHistory}
                onClearHistory={handleClearHistory} characters={characters} creditBalance={creditSettings.creditBalance}
                onEditImage={() => setActiveModal('edit-image')} onApplyCameraAngle={handleApplyCameraAngle} onUpdateImage={() => {}}
                onResetStorybook={() => setStorybook({ title: '', characters: [], storyNarrative: '', scenes: [], includeDialogue: true })}
                storySeed={storySeed} setStorySeed={setStorySeed} savedItems={savedScenes} characterStyle={characterStyle} selectedCountry={selectedCountry} currencySymbol="$" exchangeRate={1} costPerImage={1} onToggleSave={handleToggleSave}
                timelineClips={timelineClips}
                audioClips={audioClips}
                textClips={textClips}
                onUpdateTextClips={setTextClips}
                onUpdateTimelineClip={(id, u) => setTimelineClips(p => p.map(c => c.id === id ? { ...c, ...u } : c))}
                onDeleteTimelineClip={(id) => setTimelineClips(p => p.filter(c => c.id !== id))}
                onAddTimelineClip={(url, file, dur, start) => setTimelineClips(prev => {
                    const end = start !== undefined ? start : Math.max(0, ...prev.map(c => (c.startTime || 0) + c.duration));
                    return [...prev, { id: Date.now().toString(), url, duration: dur || 8, startTime: end, originalDuration: dur || 8, isMuted: false }];
                })}
                onAddAudioClip={(url, dur, start) => setAudioClips(prev => {
                    const end = start !== undefined ? start : Math.max(0, ...prev.map(ac => ac.startTime + ac.duration));
                    return [...prev, { id: Date.now().toString(), url, duration: dur || 10, startTime: end, isMuted: false }];
                })}
                onCaptureFrameFromTimeline={handleCaptureFrame}
                onExportTimeline={() => { setModalData({ clips: timelineClips }); setActiveModal('export-video'); }}
                generationItem={activeHistoryIndex !== -1 ? history[activeHistoryIndex] : null}
                historyIndex={activeHistoryIndex}
                activeVideoIndices={activeVideoIndices}
                onOpenVideoCreator={(idx) => setActiveVideoIndices(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}
                onGenerateVideo={handleGenerateVideo}
                onAddToTimeline={(url, dur, obj) => setTimelineClips(prev => {
                    const end = Math.max(0, ...prev.map(c => (c.startTime || 0) + c.duration));
                    return [...prev, { id: Date.now().toString(), url, duration: dur || 8, startTime: end, originalDuration: dur || 8, videoObject: obj, isMuted: false }];
                })}
                videoModel={videoModel}
                setVideoModel={setVideoModel}
                setVideoResolution={setVideoResolution}
                onSwitchSession={handleLoadHistory}
                onNewSession={() => setActiveHistoryIndex(-1)}
                onUpdateVideoDraft={(gid, sid, upd) => setHistory(prev => prev.map(h => h.id === gid ? { ...h, videoStates: h.videoStates.map((vs: any, idx: number) => h.imageSet[idx].sceneId === sid ? { ...vs, ...upd } : vs) } : h))}
                activeI2ISlot={activeI2ISlot}
                setActiveI2ISlot={setActiveI2ISlot}
                onUploadStartImage={handleUploadStartImage}
                onUploadToSession={handleUploadToSession}
                onDeleteScene={handleDeleteScene}
                onUndoEdit={handleUndoEdit}
                setCharacters={setCharacters}
                handleBuildCharacterVisual={async (id) => {
                    if (creditSettings.creditBalance < 3) return; 
                    const char = characters.find(c => c.id === id); if (!char) return;
                    setCharacters(prev => prev.map(c => c.id === id ? { ...c, isDescribing: true } : c));
                    try { 
                        const { src, error } = await generateCharacterVisual(char, visualStyle, characterStyle, selectedCountry); 
                        if (src) {
                            const { description } = await generateCharacterDescription(src, 'image/png');
                            setCharacters(prev => prev.map(c => c.id === id ? { ...c, imagePreview: `data:image/png;base64,${src}`, description, detectedImageStyle: null } : c));
                            setCreditSettings((p: any) => ({ ...p, creditBalance: p.creditBalance - 3 }));
                        } else if (error) {
                            setCharacters(prev => prev.map(c => c.id === id ? { ...c, detectedImageStyle: error } : c));
                        }
                    } finally { 
                        setCharacters(prev => prev.map(c => c.id === id ? { ...c, isDescribing: false } : c)); 
                    }
                }}
                handleUploadNewCharacterImage={async (f) => {
                    const base64 = await fileToBase64(f);
                    const newChar = { id: Date.now(), name: '', imagePreview: `data:${f.type};base64,${base64}`, originalImageBase64: base64, originalImageMimeType: f.type, description: null, detectedImageStyle: null, isDescribing: false, isHero: false };
                    setCharacters(prev => [...prev, newChar]);
                }}
                handleCharacterImageUpload={async (f, id) => {
                    if (creditSettings.creditBalance < 1) return;
                    const base64 = await fileToBase64(f); setCharacters(prev => prev.map(c => c.id === id ? { ...c, isAnalyzing: true } : c));
                    try { 
                        const { description, detectedStyle } = await generateCharacterDescription(base64, f.type); 
                        setCharacters(prev => prev.map(c => c.id === id ? { ...c, imagePreview: `data:${f.type};base64,${base64}`, originalImageBase64: base64, originalImageMimeType: f.type, description, detectedImageStyle: detectedStyle, isAnalyzing: false } : c)); 
                        setCreditSettings((p: any) => ({ ...p, creditBalance: p.creditBalance - 1 }));
                    } catch { 
                        setCharacters(prev => prev.map(c => c.id === id ? { ...c, isAnalyzing: false } : c)); 
                    }
                }}
                updateCharacter={(id, p) => setCharacters(prev => prev.map(c => c.id === id ? { ...c, ...p } : c))}
                removeCharacter={(id) => setCharacters(prev => prev.filter(c => c.id !== id))}
                onToggleHero={(id) => setCharacters(prev => prev.map(c => ({ ...c, isHero: c.id === id ? !c.isHero : false })))}
                onGenerateSingleStorybookScene={handleGenerateSingleStorybookScene}
                onAddSceneVariant={handleAddSceneVariant}
                onSelectSceneVariant={handleSelectSceneVariant}
                onSceneVariantChange={(gid, sid, dir) => {
                    const hIdx = history.findIndex(h => h.id === gid);
                    if (hIdx === -1) return;
                    const scene = history[hIdx].imageSet.find((s: any) => s.sceneId === sid);
                    if (!scene || !scene.variants) return;
                    const cur = scene.selectedVariantIndex || 0;
                    let nextIdx = dir === 'next' ? cur + 1 : cur - 1;
                    if (nextIdx < 0) nextIdx = scene.variants.length - 1;
                    if (nextIdx >= scene.variants.length) nextIdx = 0;
                    handleSelectSceneVariant(gid, sid, nextIdx);
                }}
                onUpdateSceneImage={handleUpdateSceneImage}
                onRegenerateScene={handleRegenerateScene}
                onAngleSelect={(gid, sid) => { const sess = history.find(h => h.id === gid); const img = sess?.imageSet.find((s:any) => s.sceneId === sid); setModalData({ genId: gid, sceneId: sid, src: img.src }); setActiveModal('camera-angles'); }}
                visualStyle={visualStyle}
            />
        </div>
    );
};

export default App;