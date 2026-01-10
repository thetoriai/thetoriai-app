import React, { useState, useRef, useEffect } from 'react';
import { 
    XIcon, SparklesIcon, LoaderIcon, UndoIcon, TrashIcon, 
    PlusCircleIcon, StopIcon, RefreshIcon, PencilIcon, UploadIcon, CheckIcon,
    LassoIcon, SquareIcon, PaintBrushIcon
} from './Icons';
import { editImage, Character } from '../services/geminiService';
import { parseErrorMessage } from '../utils/errorUtils';
import { fileToBase64 } from '../utils/fileUtils';

interface ImageEditorProps {
    isOpen: boolean;
    imageSrc: string; // Base64 string
    initialVersions?: string[];
    initialPrompt?: string;
    aspectRatio: string;
    imageStyle: string;
    genre: string;
    characters: Character[];
    imageModel: string;
    onClose: () => void;
    onSave: (newImageSrc: string, newPrompt: string) => void;
    onUpdateImage?: (base64: string, prompt: string) => void;
}

type SelectionTool = 'brush' | 'lasso' | 'rect';

export const ImageEditor: React.FC<ImageEditorProps> = ({
    isOpen,
    imageSrc,
    initialVersions = [],
    initialPrompt = '',
    aspectRatio,
    imageStyle,
    genre,
    characters,
    imageModel,
    onClose,
    onSave,
    onUpdateImage
}) => {
    // --- State ---
    const [currentSrc, setCurrentSrc] = useState(imageSrc);
    const [versions, setVersions] = useState<string[]>(initialVersions.length > 0 ? initialVersions : [imageSrc]);
    
    const [editPrompt, setEditPrompt] = useState(initialPrompt);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [referenceImg, setReferenceImg] = useState<string | null>(null);

    // Canvas / Drawing State
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const referenceInputRef = useRef<HTMLInputElement>(null);
    
    const [drawingMode, setDrawingMode] = useState<'add' | 'remove'>('add'); 
    const [tool, setTool] = useState<SelectionTool>('brush');
    const [brushSize, setBrushSize] = useState(40);
    const [hasDrawn, setHasDrawn] = useState(false);
    
    const isDrawingRef = useRef(false);
    const pointsRef = useRef<{ x: number; y: number }[]>([]);
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);
    const startPosRef = useRef<{ x: number; y: number } | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

    // --- Effects ---

    useEffect(() => {
        if (isOpen) {
            setCurrentSrc(imageSrc);
            setVersions(initialVersions.length > 0 ? initialVersions : [imageSrc]);
            setEditPrompt(initialPrompt);
            setHasDrawn(false);
            setDrawingMode('add');
            setTool('brush');
            setError(null);
            setReferenceImg(null);
        }
    }, [isOpen, imageSrc, initialVersions, initialPrompt]);

    useEffect(() => {
        if (currentSrc && canvasRef.current) {
             const img = new Image();
             img.src = `data:image/png;base64,${currentSrc}`;
             img.onload = () => {
                 if (canvasRef.current) {
                     canvasRef.current.width = img.naturalWidth;
                     canvasRef.current.height = img.naturalHeight;
                     const ctx = canvasRef.current.getContext('2d');
                     if (ctx) ctx.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
                     setHasDrawn(false);
                 }
             };
        }
    }, [currentSrc]);

    const handleSwitchVersion = (src: string) => {
        setCurrentSrc(src);
    };

    // --- Canvas Logic ---

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (!canvasRef.current) return;
        isDrawingRef.current = true;
        const coords = getCoordinates(e, canvasRef.current);
        lastPosRef.current = coords;
        startPosRef.current = coords;
        pointsRef.current = [coords];
        if ('touches' in e) e.preventDefault();
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current || !canvasRef.current) return;
        if ('touches' in e) e.preventDefault();
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        const coords = getCoordinates(e, canvasRef.current);
        const color = drawingMode === 'add' ? 'rgba(74, 222, 128, 0.5)' : 'rgba(248, 113, 113, 0.5)';
        
        if (tool === 'brush') {
            ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = brushSize; ctx.strokeStyle = color;
            ctx.beginPath(); ctx.moveTo(lastPosRef.current!.x, lastPosRef.current!.y); ctx.lineTo(coords.x, coords.y); ctx.stroke();
            lastPosRef.current = coords; setHasDrawn(true);
        } else if (tool === 'lasso') {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.strokeStyle = 'white';
            ctx.beginPath(); pointsRef.current.push(coords); ctx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
            pointsRef.current.forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
        } else if (tool === 'rect') {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.strokeStyle = 'white';
            const start = startPosRef.current!; ctx.strokeRect(start.x, start.y, coords.x - start.x, coords.y - start.y);
        }
    };

    const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current || !canvasRef.current) return;
        isDrawingRef.current = false;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        const color = drawingMode === 'add' ? 'rgba(74, 222, 128, 0.5)' : 'rgba(248, 113, 113, 0.5)';
        if (tool === 'lasso') {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            ctx.setLineDash([]); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
            pointsRef.current.forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill(); setHasDrawn(true);
        } else if (tool === 'rect') {
            const coords = getCoordinates(e, canvasRef.current);
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            ctx.setLineDash([]); ctx.fillStyle = color; const start = startPosRef.current!;
            ctx.fillRect(start.x, start.y, coords.x - start.x, coords.y - start.y); setHasDrawn(true);
        }
        lastPosRef.current = null; startPosRef.current = null;
    };
    
    const clearCanvas = () => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            setHasDrawn(false);
        }
    };

    const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            try { const base64 = await fileToBase64(e.target.files[0]); setReferenceImg(base64); } catch (err) { console.error(err); }
        }
    };

    const handleApply = async () => {
        const isRemoval = drawingMode === 'remove';
        if (!editPrompt.trim() && !hasDrawn && !isRemoval) return;
        setIsProcessing(true); setError(null);
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController(); abortControllerRef.current = controller;
        try {
            let maskBase64: string | undefined = undefined;
            if (hasDrawn && canvasRef.current && imageRef.current) {
                const img = imageRef.current;
                const maskCanvas = document.createElement('canvas');
                maskCanvas.width = img.naturalWidth; maskCanvas.height = img.naturalHeight;
                const mCtx = maskCanvas.getContext('2d');
                if (mCtx) {
                    mCtx.fillStyle = '#000000'; mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
                    mCtx.globalCompositeOperation = 'source-over'; mCtx.drawImage(canvasRef.current, 0, 0); 
                    mCtx.globalCompositeOperation = 'source-in'; mCtx.fillStyle = '#FFFFFF';
                    mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
                    maskBase64 = maskCanvas.toDataURL('image/png').split(',')[1];
                }
            }
            let finalPrompt = editPrompt.trim();
            if (!finalPrompt && hasDrawn && drawingMode === 'remove') finalPrompt = "Remove selection.";
            const { src, error: apiError } = await editImage({
                imageBase64: currentSrc, mimeType: 'image/png', editPrompt: finalPrompt,
                aspectRatio, visualStyle: imageStyle, genre, characters, hasVisualMasks: !!maskBase64,
                overlayImage: maskBase64 ? { base64: maskBase64, mimeType: 'image/png' } : undefined,
                referenceImage: referenceImg ? { base64: referenceImg, mimeType: 'image/png' } : undefined,
                signal: controller.signal, imageModel: imageModel.includes('gemini') ? imageModel : 'gemini-3-pro-image-preview'
            });
            if (src) { 
                setVersions(prev => [...prev, src]); 
                setCurrentSrc(src); 
                if (onUpdateImage) onUpdateImage(src, finalPrompt); 
                clearCanvas(); 
            } else if (apiError && apiError !== 'Aborted') setError(apiError);
        } catch (e) { const msg = parseErrorMessage(e); if (msg !== 'Aborted') setError(msg); } finally { setIsProcessing(false); abortControllerRef.current = null; }
    };

    const handleSaveAndClose = () => { onSave(currentSrc, editPrompt); onClose(); };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-6xl flex flex-col h-[90vh]" onClick={e => e.stopPropagation()}>
                
                {/* --- HEADER --- */}
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900 shrink-0">
                    <div className="flex items-center gap-3">
                        <h2 className="font-bold text-white flex items-center gap-2"><PencilIcon className="w-5 h-5 text-indigo-500"/> Photo Editor</h2>
                        <div className="h-4 w-px bg-gray-700"></div>
                        <div className="flex gap-2 overflow-x-auto max-w-xl scrollbar-none items-center">
                            {versions.map((v, i) => (
                                <button key={i} onClick={() => handleSwitchVersion(v)} className={`relative w-10 h-10 rounded border overflow-hidden shrink-0 transition-all ${v === currentSrc ? 'border-indigo-500 ring-2 ring-indigo-500/50 shadow-lg' : 'border-gray-600 opacity-60 hover:opacity-100'}`}>
                                    <img src={`data:image/png;base64,${v}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><span className="text-[9px] font-bold text-white shadow-sm drop-shadow-md">{i === 0 ? 'Orig' : i}</span></div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-2"><button onClick={handleSaveAndClose} className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded border border-gray-600">Save & Close</button></div>
                </div>
                
                <div className="flex-1 flex overflow-hidden relative">
                    {isProcessing && (
                        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
                            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_20px_rgba(79,70,229,0.5)]"></div>
                            <div className="text-white font-bold text-lg animate-pulse">Processing...</div>
                        </div>
                    )}
                    
                    {/* Floating Toolbar */}
                    <div className="absolute top-4 left-4 z-40 bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg p-1.5 flex flex-col gap-2 shadow-2xl">
                        <button onClick={() => setTool('brush')} className={`p-2 rounded transition-colors ${tool === 'brush' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`} title="Brush Tool"><PaintBrushIcon className="w-5 h-5"/></button>
                        <button onClick={() => setTool('lasso')} className={`p-2 rounded transition-colors ${tool === 'lasso' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`} title="Lasso Selection"><LassoIcon className="w-5 h-5"/></button>
                        <button onClick={() => setTool('rect')} className={`p-2 rounded transition-colors ${tool === 'rect' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`} title="Box Selection"><SquareIcon className="w-5 h-5"/></button>
                        <div className="h-px bg-gray-700 mx-2"></div>
                        <button onClick={clearCanvas} className="p-2 rounded text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-colors" title="Clear Canvas"><TrashIcon className="w-5 h-5"/></button>
                    </div>
                    
                    <div className="flex-1 bg-[url('https://res.cloudinary.com/dvvxl2r1f/image/upload/v1727788934/transparent-bg_wbmclx.png')] relative overflow-hidden flex items-center justify-center p-8">
                        <div className="relative shadow-2xl border border-gray-700" ref={containerRef}>
                            <img ref={imageRef} src={`data:image/png;base64,${currentSrc}`} className="max-w-full max-h-[75vh] object-contain pointer-events-none select-none" />
                            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-crosshair touch-none" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                        </div>
                    </div>

                    {/* --- SIDEBAR --- */}
                    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0">
                        <div className="p-4 space-y-6 overflow-y-auto flex-1">
                            
                            {/* Brush Settings */}
                            {tool === 'brush' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex justify-between">Brush Size <span>{brushSize}px</span></label>
                                    <input type="range" min="10" max="150" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full accent-indigo-500 bg-gray-800 rounded-lg h-1.5 cursor-pointer" />
                                </div>
                            )}

                            {/* Selection Mode */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Selection Mode</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setDrawingMode('add')} className={`flex-1 py-3 rounded flex flex-col items-center gap-1 border transition-all ${drawingMode === 'add' ? 'bg-green-900/30 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-current flex items-center justify-center"><div className="w-1.5 h-1.5 bg-current rounded-full"></div></div>
                                        <span className="text-[9px] font-bold uppercase">Add</span>
                                    </button>
                                    <button onClick={() => setDrawingMode('remove')} className={`flex-1 py-3 rounded flex flex-col items-center gap-1 border transition-all ${drawingMode === 'remove' ? 'bg-red-900/30 border-red-500 text-red-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                                        <div className="w-3.5 h-3.5 rounded-full bg-red-500"></div>
                                        <span className="text-[9px] font-bold uppercase">Remove</span>
                                    </button>
                                </div>
                            </div>

                            {/* COMPACT: Instruction & Reference Side-by-Side */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Instruction & Reference</label>
                                <div className="flex gap-2 items-start">
                                    <textarea 
                                        value={editPrompt} 
                                        onChange={(e) => setEditPrompt(e.target.value)} 
                                        placeholder="Describe what to add or change here..."
                                        className="flex-1 h-32 bg-black/30 border border-gray-700 rounded p-3 text-xs text-white resize-none focus:border-indigo-500 focus:outline-none"
                                    />
                                    <div className="w-16 h-16 shrink-0">
                                        {referenceImg ? (
                                            <div className="relative w-full h-full bg-black/40 rounded border border-gray-700 overflow-hidden group">
                                                <img src={`data:image/png;base64,${referenceImg}`} className="w-full h-full object-cover opacity-80" />
                                                <button onClick={() => setReferenceImg(null)} className="absolute inset-0 bg-red-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><XIcon className="w-4 h-4" /></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => referenceInputRef.current?.click()} className="w-full h-full bg-gray-800 border border-dashed border-gray-600 rounded flex flex-col items-center justify-center hover:border-indigo-500 text-gray-500 hover:text-indigo-400 transition-colors">
                                                <UploadIcon className="w-4 h-4" />
                                                <span className="text-[7px] font-bold uppercase mt-1">Ref</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <input type="file" ref={referenceInputRef} className="hidden" accept="image/*" onChange={handleReferenceUpload} />
                                <p className="text-[9px] text-gray-500 italic">Select an area on the left first for precision.</p>
                            </div>
                            
                            {error && <div className="p-2 bg-red-900/30 border border-red-800 rounded text-[10px] text-red-300">{error}</div>}
                        </div>

                        {/* Footer Action */}
                        <div className="p-4 border-t border-gray-800 bg-gray-900">
                            <button 
                                onClick={handleApply} 
                                disabled={isProcessing || (!editPrompt.trim() && !hasDrawn && drawingMode !== 'remove')}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
                            >
                                {isProcessing ? <><LoaderIcon className="w-4 h-4 animate-spin"/> Processing...</> : <><SparklesIcon className="w-4 h-4"/> Apply Changes</>}
                            </button>
                            <p className="text-[9px] text-gray-500 text-center mt-2 font-bold uppercase tracking-tighter">Cost: 2 Credits</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
