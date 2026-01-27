import React, { useState, useRef, useEffect } from "react";
import {
  SparklesIcon,
  VideoIcon,
  ClapperboardIcon,
  PhotoIcon,
  LoaderIcon,
  BookmarkIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
  HistoryIcon,
  XIcon,
  ArrowsRightLeftIcon,
  ChevronDownIcon,
  FilmIcon,
  EllipsisVerticalIcon
} from "./Icons";
import { SceneProgressOverlay } from "./Card";
import type { Character } from "../services/geminiService";
import { fileToBase64 } from "../utils/fileUtils";
import { AFRICAN_COUNTRIES, WORLD_COUNTRIES } from "../utils/constants";

interface FootageCardProps {
  item: any;
  onSave: () => void;
  onAddToTimeline: () => void;
  onToVideo: () => void;
  onDelete: () => void;
  isSaved: boolean;
  isGeneratingVideo?: boolean;
}

const FootageCard: React.FC<FootageCardProps> = ({
  item,
  onSave,
  onAddToTimeline,
  onToVideo,
  onDelete,
  isSaved,
  isGeneratingVideo
}) => {
  const isVideo =
    item.type === "video" || (item.videoClips && item.videoClips.length > 0);
  const displaySrc = item.src
    ? item.src.startsWith("data")
      ? item.src
      : `data:image/png;base64,${item.src}`
    : null;
  const latestVideo = item.videoClips?.[item.videoClips.length - 1]?.videoUrl;

  return (
    <div className="flex flex-col bg-[#0f172a]/60 border border-white/5 rounded-xl overflow-hidden shadow-2xl group animate-in zoom-in-95 duration-500 hover:border-indigo-500/30 transition-all themed-artline">
      <div className="relative aspect-video bg-black overflow-hidden">
        {item.status === "pending" || item.status === "generating" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/50 backdrop-blur-sm">
            <LoaderIcon className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest animate-pulse">
              Producing...
            </span>
          </div>
        ) : isGeneratingVideo ? (
          <SceneProgressOverlay onStop={() => {}} label="Rendering Motion..." />
        ) : (
          <>
            {latestVideo ? (
              <video
                src={latestVideo}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <img
                src={displaySrc || ""}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
              />
            )}
            <div className="absolute top-2 left-2">
              <span
                className={`px-1.5 py-0.5 rounded text-[6px] font-black uppercase tracking-widest border shadow-lg ${isVideo ? "bg-emerald-600 border-emerald-400 text-white" : "bg-indigo-600 border-indigo-400 text-white"}`}
              >
                {isVideo ? "Motion" : "Frame"}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="p-1.5 flex items-center justify-between bg-white/[0.02] border-t border-white/5">
        <div className="flex gap-1">
          <button
            onClick={onSave}
            className={`p-1.5 rounded-lg transition-all ${isSaved ? "bg-indigo-600 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
            title="Save"
          >
            <BookmarkIcon className="w-3 h-3" solid={isSaved} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 bg-white/5 text-gray-500 hover:text-red-400 rounded-lg transition-all"
            title="Discard"
          >
            <TrashIcon className="w-3 h-3" />
          </button>
        </div>

        <div className="flex gap-1">
          {!isVideo && item.status === "complete" && (
            <button
              onClick={onToVideo}
              className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-indigo-600 text-gray-400 hover:text-white rounded-lg text-[7px] font-black uppercase tracking-widest transition-all"
            >
              <VideoIcon className="w-3 h-3" /> Motion
            </button>
          )}
          <button
            disabled={item.status !== "complete"}
            onClick={onAddToTimeline}
            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[7px] font-black uppercase tracking-widest transition-all shadow-lg disabled:opacity-30"
          >
            <FilmIcon className="w-3 h-3" /> Timeline
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
  onProduce: (
    prompt: string,
    mode: "image" | "video" | "i2i",
    refImage?: string,
    videoTier?: string,
    imageTier?: string
  ) => void;
  isGenerating?: boolean;
  creditBalance: number;
  footageHistory: any[];
  onSaveItem: (item: any) => void;
  onDeleteItem: (id: string) => void;
  onToTimeline: (item: any) => void;
  onAnimate: (item: any) => void;
  onUpdateCountry: (val: string) => void;
  savedItems: any[];
  footagePrompt: string;
  setFootagePrompt: (v: string) => void;
  footageMode: "image" | "video";
  setFootageMode: (v: "image" | "video") => void;
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
  onUpdateCountry,
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
  const [showContextDropdown, setShowContextDropdown] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tierMenuRef = useRef<HTMLDivElement>(null);
  const contextDropdownRef = useRef<HTMLDivElement>(null);

  const hasRefImages = footageRefImages.some((img) => img !== null);
  const isSlot1Filled = !!footageRefImages[0];
  const isSlot2Filled = !!footageRefImages[1];
  const isSlot3Filled = !!footageRefImages[2];
  const showTransitionArrow = isSlot1Filled && isSlot2Filled && !isSlot3Filled;

  const countries =
    characterStyle === "Afro-toon" ? AFRICAN_COUNTRIES : WORLD_COUNTRIES;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (tierMenuRef.current && !tierMenuRef.current.contains(target))
        setShowTierMenu(false);
      if (
        contextDropdownRef.current &&
        !contextDropdownRef.current.contains(target)
      )
        setShowContextDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleProduce = () => {
    if (!footagePrompt.trim() || isGenerating) return;
    const activeMode = hasRefImages ? "i2i" : footageMode;
    onProduce(
      footagePrompt,
      activeMode as any,
      footageRefImages[0] || undefined,
      footageVideoTier,
      footageImageTier
    );
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

  let cost = footageImageTier === "pro" ? 2 : 1;
  if (footageMode === "video")
    cost = footageVideoTier === "veo31-quality" ? 8 : 5;

  return (
    <div className="w-full h-full flex flex-col bg-[#030712] animate-in fade-in duration-500 overflow-hidden font-sans">
      <div className="w-full shrink-0 bg-[#0a0f1d] border-b border-white/5 py-4 md:py-6 z-20">
        <div className="max-w-2xl mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col">
              <h2 className="text-lg font-black text-white italic tracking-tighter uppercase leading-none">
                Quick Footage Desk
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1 h-1 rounded-full bg-red-600 animate-pulse"></div>
                <p className="text-[7px] font-black text-gray-500 uppercase tracking-[0.4em]">
                  Rapid Terminal
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="px-2 py-0.5 bg-indigo-600/10 border border-indigo-500/20 rounded text-[7px] font-black text-indigo-400 uppercase tracking-widest">
                  {visualStyle}
                </div>
                <div className="px-2 py-0.5 bg-indigo-600/10 border border-indigo-500/20 rounded text-[7px] font-black text-indigo-400 uppercase tracking-widest">
                  {selectedCountry}
                </div>
              </div>
              <div className="relative" ref={contextDropdownRef}>
                <button
                  onClick={() => setShowContextDropdown(!showContextDropdown)}
                  className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-500 hover:text-white rounded border border-white/5 transition-all"
                >
                  <EllipsisVerticalIcon className="w-4 h-4" />
                </button>
                {showContextDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-[#0a0f1d] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[100] animate-in slide-in-from-top-1">
                    <div className="p-2 border-b border-white/5 bg-white/[0.02]">
                      <span className="text-[8px] font-black text-gray-500 uppercase">
                        Country Scope
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto scrollbar-none">
                      {countries.map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            onUpdateCountry(c);
                            setShowContextDropdown(false);
                          }}
                          className={`w-full text-left p-2.5 text-[9px] font-black uppercase tracking-widest transition-colors ${selectedCountry === c ? "bg-indigo-600 text-white" : "text-gray-400 hover:bg-white/5"}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[#030712] rounded-xl overflow-hidden border border-white/5 shadow-inner flex flex-col relative themed-artline">
            <textarea
              value={footagePrompt}
              onChange={(e) => setFootagePrompt(e.target.value)}
              placeholder="Describe footage... characters sync automatically."
              className="w-full h-16 bg-transparent border-none p-3 text-[13px] font-bold text-white placeholder-gray-700 resize-none focus:outline-none leading-tight italic scrollbar-none"
            />

            <div className="px-3 pb-2.5 flex items-center gap-2">
              {footageRefImages.map((img, idx) => (
                <React.Fragment key={idx}>
                  <div className="relative">
                    {img ? (
                      <div className="w-16 h-11 rounded-lg overflow-hidden border border-indigo-500/50 relative group">
                        <img
                          src={
                            img.startsWith("data")
                              ? img
                              : `data:image/png;base64,${img}`
                          }
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => clearSlot(idx)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <XIcon className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-11 rounded-lg border border-dashed border-white/10 bg-black/40 flex flex-col items-center justify-center gap-0.5 overflow-hidden group/empty">
                        <button
                          onClick={() => {
                            setActiveSlotIdx(idx);
                            setShowHistoryPicker(true);
                          }}
                          className="w-full flex-1 flex items-center justify-center bg-white/5 hover:bg-indigo-600 text-[6px] font-black text-gray-400 hover:text-white uppercase transition-all tracking-tighter"
                        >
                          Hist
                        </button>
                        <button
                          onClick={() => {
                            setActiveSlotIdx(idx);
                            fileInputRef.current?.click();
                          }}
                          className="w-full flex-1 flex items-center justify-center bg-white/5 hover:bg-indigo-600 text-[6px] font-black text-gray-400 hover:text-white uppercase transition-all tracking-tighter"
                        >
                          Comp
                        </button>
                      </div>
                    )}
                  </div>
                  {idx === 0 && showTransitionArrow && (
                    <ArrowsRightLeftIcon className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="border-t border-white/5 bg-white/[0.01] p-1.5 flex flex-col sm:flex-row gap-1.5 items-center">
              <div className="flex-1 w-full bg-black/50 rounded-lg p-0.5 flex items-center gap-0.5">
                <button
                  onClick={() => setFootageMode("image")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest transition-all ${footageMode === "image" && !hasRefImages ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-300"}`}
                >
                  <PhotoIcon className="w-3 h-3" /> Image
                </button>
                <button
                  onClick={() => setFootageMode("video")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest transition-all ${footageMode === "video" && !hasRefImages ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-300"}`}
                >
                  <VideoIcon className="w-3 h-3" /> Video
                </button>
                {hasRefImages && (
                  <div className="flex-1 bg-indigo-900/40 rounded-md py-1.5 flex items-center justify-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-indigo-300">
                    <SparklesIcon className="w-3 h-3" /> I2I
                  </div>
                )}
              </div>

              <div className="relative w-full sm:w-auto">
                <button
                  onClick={handleProduce}
                  disabled={isGenerating || !footagePrompt.trim()}
                  className="w-full sm:w-40 h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 disabled:bg-gray-800 disabled:text-gray-600 flex items-center justify-center gap-3 border border-indigo-400/20"
                >
                  {isGenerating ? (
                    <LoaderIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ClapperboardIcon className="w-4 h-4" />
                      <span className="text-[10px]">Initiate</span>
                      <div className="h-3 w-px bg-white/20"></div>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTierMenu(!showTierMenu);
                        }}
                        className="flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <span className="text-[8px] font-black">{cost}C</span>
                        <ChevronDownIcon className="w-2 h-2 opacity-60" />
                      </div>
                    </>
                  )}
                </button>
                {showTierMenu && (
                  <div
                    ref={tierMenuRef}
                    className="absolute bottom-full right-0 mb-2 w-36 bg-[#0a0f1d] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[110] animate-in slide-in-from-bottom-1"
                  >
                    {(footageMode === "image"
                      ? [
                          { id: "fast", l: "Flash", c: 1 },
                          { id: "pro", l: "Pro", c: 2 }
                        ]
                      : [
                          { id: "veo31-fast", l: "Fast", c: 5 },
                          { id: "veo31-quality", l: "Quality", c: 8 }
                        ]
                    ).map((tier: any) => (
                      <button
                        key={tier.id}
                        onClick={() => {
                          if (footageMode === "image")
                            setFootageImageTier(tier.id);
                          else setFootageVideoTier(tier.id);
                          setShowTierMenu(false);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 text-[8px] font-black uppercase tracking-widest transition-colors ${(footageMode === "image" ? footageImageTier : footageVideoTier) === tier.id ? "bg-indigo-600 text-white" : "text-gray-400 hover:bg-white/5"}`}
                      >
                        <span>{tier.l}</span>
                        <span className="opacity-60">{tier.c}C</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none relative bg-[#030712] p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <h3 className="text-[8px] font-black text-gray-600 uppercase tracking-[0.4em] whitespace-nowrap">
              Studio Floor
            </h3>
            <div className="h-px bg-white/5 flex-1"></div>
            <span className="text-[8px] font-black text-indigo-500 bg-indigo-900/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
              {footageHistory.length} ASSETS
            </span>
          </div>

          {footageHistory.length === 0 && !isGenerating ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-10">
              <ClapperboardIcon className="w-12 h-12 text-gray-600" />
              <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mt-4">
                Gallery Empty
              </h4>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
              {footageHistory.map((item, idx) => (
                <FootageCard
                  key={item.sceneId || idx}
                  item={item}
                  isSaved={savedItems.some((s) => s.sceneId === item.sceneId)}
                  onSave={() => onSaveItem(item)}
                  onDelete={() => onDeleteItem(item.sceneId)}
                  onAddToTimeline={() => onToTimeline(item)}
                  onToVideo={() => onAnimate(item)}
                  isGeneratingVideo={item.videoStatus === "loading"}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showHistoryPicker && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowHistoryPicker(false)}
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-4xl h-[70vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#0a0f1d]">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                Select Reference
              </h3>
              <button
                onClick={() => setShowHistoryPicker(false)}
                className="p-1.5 text-gray-500 hover:text-white"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {savedItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => selectFromHistory(item.src)}
                  className="aspect-video bg-black rounded-lg overflow-hidden cursor-pointer border border-white/10 hover:border-indigo-500 transition-all relative group"
                >
                  <img
                    src={
                      item.src.startsWith("data")
                        ? item.src
                        : `data:image/png;base64,${item.src}`
                    }
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileUpload}
      />
    </div>
  );
};
