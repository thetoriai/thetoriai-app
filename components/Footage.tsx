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
  onUpdateCountry: (val: string) => void;
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
  savedItems: any[];
}

export const Footage: React.FC<FootageProps> = ({
  visualStyle,
  aspectRatio,
  characterStyle,
  selectedCountry,
  onProduce,
  isGenerating = false,
  onUpdateCountry,
  footagePrompt,
  setFootagePrompt,
  footageMode,
  setFootageMode,
  footageVideoTier,
  setFootageVideoTier,
  footageImageTier,
  setFootageImageTier,
  footageRefImages,
  setFootageRefImages,
  savedItems
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
  const showTransitionArrow =
    isSlot1Filled && isSlot2Filled && !footageRefImages[2];

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
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <h2 className="text-xl font-black text-white italic tracking-tighter leading-none">
                Quick Footage 
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1 h-1 rounded-full bg-red-600 animate-pulse"></div>
                <p className="text-[7px] font-black text-gray-500  tracking-[0.4em]">
                  Rapid Terminal
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="px-2 py-0.5 bg-indigo-600/10 border border-indigo-500/20 rounded text-[7px] font-black text-indigo-400  tracking-widest">
                  {visualStyle}
                </div>
                <div className="px-2 py-0.5 bg-indigo-600/10 border border-indigo-500/20 rounded text-[7px] font-black text-indigo-400  tracking-widest">
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
                  <div className="absolute top-full right-0 mt-2 w-48 bg-[#0a0f1d] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[110] animate-in slide-in-from-top-1">
                    <div className="p-2 border-b border-white/5 bg-white/[0.02]">
                      <span className="text-[8px] font-black text-gray-500  ">
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
                          className={`w-full text-left p-2.5 text-[9px] font-black tracking-widest transition-colors ${selectedCountry === c ? "bg-indigo-600 text-white" : "text-gray-400 hover:bg-white/5"}`}
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

          <div className="bg-[#0a0f1d] rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col relative themed-artline p-1">
            <textarea
              value={footagePrompt}
              onChange={(e) => setFootagePrompt(e.target.value)}
              placeholder="Describe your footage vision... characters sync automatically."
              className="w-full h-32 bg-transparent border-none p-4 text-[15px] font-bold text-white placeholder-gray-700 resize-none focus:outline-none leading-relaxed italic scrollbar-none"
            />

            <div className="px-4 pb-4 flex items-center gap-3">
              {footageRefImages.map((img, idx) => (
                <React.Fragment key={idx}>
                  <div className="relative">
                    {img ? (
                      <div className="w-20 h-14 rounded-xl overflow-hidden border-2 border-indigo-500/50 relative group shadow-lg">
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
                          className="w-full flex-1 flex items-center justify-center bg-white/5 hover:bg-indigo-600 text-[6px] font-black text-gray-400 hover:text-white  transition-all tracking-tighter"
                        >
                          Hist
                        </button>
                        <button
                          onClick={() => {
                            setActiveSlotIdx(idx);
                            fileInputRef.current?.click();
                          }}
                          className="w-full flex-1 flex items-center justify-center bg-white/5 hover:bg-indigo-600 text-[8px] font-black text-gray-500 hover:text-white transition-all tracking-tighter border-t border-white/5"
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

            <div className="border-t border-white/5 bg-white/[0.01] p-3 flex flex-col sm:flex-row gap-3 items-center">
              <div className="flex-1 w-full bg-black/50 rounded-xl p-1 flex items-center gap-1 shadow-inner">
                <button
                  onClick={() => setFootageMode("image")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${footageMode === "image" && !hasRefImages ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-300"}`}
                >
                  <PhotoIcon className="w-4 h-4" /> Image
                </button>
                <button
                  onClick={() => setFootageMode("video")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${footageMode === "video" && !hasRefImages ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-300"}`}
                >
                  <VideoIcon className="w-4 h-4" /> Video
                </button>
                {hasRefImages && (
                  <div className="flex-1 bg-indigo-900/40 rounded-lg py-2.5 flex items-center justify-center gap-2 text-[10px] font-black tracking-widest text-indigo-300">
                    <SparklesIcon className="w-4 h-4" /> I2I
                  </div>
                )}
              </div>

              <div className="relative w-full sm:w-auto">
                <button
                  onClick={handleProduce}
                  disabled={isGenerating || !footagePrompt.trim()}
                  className="w-full sm:w-48 h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-black tracking-widest rounded-xl transition-all active:scale-95 disabled:bg-gray-800 disabled:text-gray-600 flex items-center justify-center gap-3 border border-indigo-400/20 shadow-xl"
                >
                  {isGenerating ? (
                    <LoaderIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <ClapperboardIcon className="w-5 h-5" />
                      <span className="text-[12px]">Initiate</span>
                      <div className="h-4 w-px bg-white/20"></div>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTierMenu(!showTierMenu);
                        }}
                        className="flex items-center gap-1 px-1.5 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                      >
                        <span className="text-[9px] font-black">{cost}C</span>
                        <ChevronDownIcon className="w-2.5 h-2.5 opacity-60" />
                      </div>
                    </>
                  )}
                </button>
                {showTierMenu && (
                  <div
                    ref={tierMenuRef}
                    className="absolute bottom-full right-0 mb-3 w-44 bg-[#0a0f1d] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[110] animate-in slide-in-from-bottom-1"
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
                        className={`w-full flex items-center justify-between p-3.5 text-[9px] font-black tracking-widest transition-colors ${(footageMode === "image" ? footageImageTier : footageVideoTier) === tier.id ? "bg-indigo-600 text-white" : "text-gray-400 hover:bg-white/5"}`}
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

          <div className="mt-12 flex flex-col items-center text-center opacity-30">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-700 flex items-center justify-center mb-4">
              <SparklesIcon className="w-8 h-8 text-gray-700" />
            </div>
            <p className="text-[10px] font-black text-gray-500 tracking-[0.5em] uppercase">
              Ready for Production
            </p>
            <p className="text-[9px] text-gray-600 max-w-sm mt-2 leading-relaxed">
              Initiated assets will automatically appear in your Production
              Stage for cinematic editing and timeline assembly.
            </p>
            </div>
        </div>
      </div>

      {showHistoryPicker && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={() => setShowHistoryPicker(false)}
        >
          <div
            className="bg-[#0a0f1d] border border-white/10 rounded-3xl w-full max-w-4xl h-[70vh] flex flex-col overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0a0f1d] shrink-0">
              <h3 className="text-sm font-black text-gray-400 tracking-[0.3em] uppercase ml-2">
                Select Reference
              </h3>
              <button
                onClick={() => setShowHistoryPicker(false)}
                className="p-2.5 bg-gray-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400 rounded-full transition-all"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 scrollbar-thin scrollbar-thumb-gray-800">
              {savedItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => selectFromHistory(item.src)}
                  className="aspect-video bg-black rounded-xl overflow-hidden cursor-pointer border border-white/10 hover:border-indigo-500 hover:scale-[1.02] transition-all relative group shadow-lg"
                >
                  <img
                    src={
                      item.src.startsWith("data")
                        ? item.src
                        : `data:image/png;base64,${item.src}`
                    }
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
              {savedItems.length === 0 && (
                <div className="col-span-full h-full flex flex-col items-center justify-center opacity-20 py-20">
                  <BookmarkIcon className="w-16 h-16 mb-4" />
                  <p className="text-xs font-black tracking-widest">
                    NO SAVED ASSETS FOUND
                  </p>
                </div>
              )}
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
