// DO add comment: Refined History: Using masterHistory for persistence. Standalone panel layout for integrated workspace.

import React from 'react';
import { XIcon, HistoryIcon, BookmarkIcon } from './Icons';

interface HistoryPanelProps {
    history: any[];
    masterHistory: any[];
    savedItems: any[];
    onClose: () => void;
    onLoadHistory: (index: number, sceneId?: string, restore?: boolean) => void;
    onClearHistory: () => void;
    onToggleSave: (card: any) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, masterHistory, savedItems, onClose, onLoadHistory, onClearHistory, onToggleSave }) => {
    // DO add comment: Merged View. Displays all master assets.
    const flatHistory = [...masterHistory].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // DO add comment: Section Badge Stylist.
    const getSectionBadge = (section: string) => {
        switch(section) {
            case 'FootageFrontSection': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
            case 'UploadedSection': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'TimelineSection': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
            case 'StorybookSection': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto flex flex-col h-full bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in duration-500">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center shrink-0 bg-[#0a0f1d]">
                <h2 className="text-sm font-black text-gray-400 flex items-center gap-3  tracking-[0.4em]"><HistoryIcon className="w-5 h-5 text-indigo-500"/> Production History</h2>
                <span className="text-[10px] font-black text-gray-600 bg-gray-800/50 px-3 py-1 rounded-full  tracking-widest">{flatHistory.length} Assets Found</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-gray-800">
                {flatHistory.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-32 opacity-20">
                        <HistoryIcon className="w-20 h-20 mb-4" />
                        <p className="text-sm font-black  tracking-[0.4em]">Gallery Empty</p>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {flatHistory.map((card: any, idx: number) => { 
                        const isSaved = savedItems.some(saved => saved.sceneId === card.sceneId); 
                        const sectionLabel = card.originSection || "FootageFrontSection"; 
                        const sessIdx = history.findIndex(h => h.imageSet.some((s: any) => s.sceneId === card.sceneId));
                        
                        // DO add comment: Logic change. Asset is considered active only if parent session is open AND card is not hidden.
                        const isActiveOnBoard = sessIdx !== -1 && !history[sessIdx].isClosed && history[sessIdx].imageSet.some((s: any) => s.sceneId === card.sceneId && !s.isHidden);

                        return (
                            <div 
                                key={`${card.sceneId}-${idx}`} 
                                onClick={() => { if(isActiveOnBoard) onLoadHistory(sessIdx, card.sceneId); }} 
                                onDoubleClick={() => { onLoadHistory(sessIdx, card.sceneId, true); }}
                                className={`flex w-full h-28 bg-gray-800/50 border rounded-2xl overflow-hidden cursor-pointer transition-all group relative shadow-lg ${!isActiveOnBoard ? 'border-amber-900/30 opacity-80' : 'border-gray-700 hover:border-indigo-500 hover:scale-[1.01]'}`} 
                                title={!isActiveOnBoard ? "Archived - Double-click to restore to Board" : card.prompt}
                            >
                                <div className="w-32 h-full shrink-0 relative bg-gray-950">
                                    {card.src ? <img src={card.src.startsWith('data') ? card.src : `data:image/png;base64,${card.src}`} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" /> : <div className="w-full h-full flex items-center justify-center text-gray-700"><HistoryIcon className="w-6 h-6"/></div>}
                                </div>
                                <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex flex-col gap-1.5 min-w-0">
                                            <span className={`inline-block px-2 py-0.5 rounded border text-[8px] font-black  tracking-widest w-max ${getSectionBadge(sectionLabel)}`}>
                                                {sectionLabel}
                                            </span>
                                            <p className="text-[12px] font-bold text-gray-200 line-clamp-1 group-hover:text-white transition-colors">
                                                {card.prompt || "Generated footage"}
                                            </p>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onToggleSave(card); }}
                                            className={`p-2 rounded-full hover:bg-gray-700 transition-all ${isSaved ? 'text-indigo-400 bg-indigo-400/10' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            <BookmarkIcon className="w-5 h-5" solid={isSaved} />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] text-gray-600 font-mono tracking-tighter">REF_ID: {card.sceneId?.split('-').pop()}</span>
                                        {!isActiveOnBoard && (
                                            <span className="text-[8px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20  tracking-widest animate-pulse">ARCHIVED</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ); 
                    })}
                </div>
            </div>

            <div className="p-6 border-t border-gray-800 shrink-0 bg-[#0a0f1d]/80 flex flex-col items-center gap-4">
                <button onClick={onClearHistory} className="w-full max-w-sm py-4 bg-red-900/10 hover:bg-red-900/30 text-red-400 text-[10px] font-black  tracking-[0.3em] rounded-2xl border border-red-900/30 transition-all shadow-xl active:scale-95">
                    Selective Archival Cleanup
                </button>
                <p className="text-[9px] text-gray-600 text-center  font-bold tracking-widest opacity-60 max-w-md leading-relaxed">
                    MANAGES STORAGE BY PURGING UNSAVED ITEMS.<br/>
                    ACTIVE PRODUCTION ASSETS AND BOOKMARKS REMAIN PROTECTED.
                </p>
            </div>
        </div>
    );
};