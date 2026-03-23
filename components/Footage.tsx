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
  EllipsisVerticalIcon,
  DownloadIcon,
  CheckIcon,
  PlayIcon,
  RefreshIcon,
  CircularProgressIcon,
  // DO add comment above each fix. Fix missing icon import: Added ExclamationTriangleIcon to resolve name not found error in result card.
  ExclamationTriangleIcon
} from "./Icons";
import type { Character } from "../services/geminiService";
import { fileToBase64, formatBase64Src } from "../utils/fileUtils";
import { AFRICAN_COUNTRIES, WORLD_COUNTRIES } from "../utils/constants";

interface FootageProps {
  characters: Character[];
  visualStyle: string;
  aspectRatio: string;
  videoLength: number;
  characterStyle: string;
  selectedCountry: string;
  onProduce: (
    prompt: string,
    mode: "image" | "video" | "i2i",
    refImage?: string,
    videoTier?: string,
    imageTier?: string,
    endImage?: string
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
  footageHistory: any[];
  onAnimateFootage: (item: any) => void;
  onAddToTimeline: (
    url: string,
    type: "video" | "image",
    duration: number,
    obj?: any
  ) => void;
}

// DO add comment: Compact Footage Card for the results grid.
const FootageResultCard: React.FC<{
  item: any;
  onAddToTimeline: (
    url: string,
    type: "video" | "image",
    duration: number,
    obj?: any
  ) => void;
}> = ({ item, onAddToTimeline }) => {
  const [isAdded, setIsAdded] = useState(false);
  const [progress, setProgress] = useState(0);

  // Simulate progress for the internal loading circle
  useEffect(() => {
    if (item.status === "deducting") {
      setProgress(0);
      return;
    }
    if (item.status !== "generating") return;

    // Start from 5 if we just finished deducting
    setProgress(5);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 99) return 99;
        // Slow down as we get closer to 100
        const increment = prev > 80 ? 0.5 : 2;
        return prev + increment;
      });
    }, 300);
    return () => clearInterval(interval);
  }, [item.status]);

  const handleAdd = () => {
    const url =
      item.type === "video"
        ? item.videoUrl
        : item.src?.startsWith("data")
          ? item.src
          : `data:image/png;base64,${item.src}`;

    onAddToTimeline(
      url,
      item.type,
      item.type === "video" ? item.videoDuration || 6 : 5,
      item.videoObject
    );

    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const handleDownload = () => {
    const url =
      item.type === "video"
        ? item.videoUrl
        : item.src?.startsWith("data")
          ? item.src
          : `data:image/png;base64,${item.src}`;

    const link = document.createElement("a");
    link.href = url;
    link.download = `Footage_${Date.now()}.${
      item.type === "video" ? "mp4" : "png"
    }`;
    link.click();
  };

  const currentSrc = item.src || item.image || "";

  return (
    <div
      draggable
      onDragStart={(e) => {
        const src = item.src?.startsWith("data")
          ? item.src
          : `data:image/png;base64,${item.src}`;

        e.dataTransfer.setData(
          "application/json",
          JSON.stringify({
            src,
            type: item.type
          })
        );
      }}
      className="bg-[#0f172a] rounded-2xl border border-white/5 overflow-hidden flex flex-col shadow-xl group animate-in zoom-in-95 duration-500 relative cursor-grab active:cursor-grabbing"
    >
      <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden">
        {/* BACKGROUND IMAGE LAYER */}
        {currentSrc && (
          <div
            className={`absolute inset-0 z-0 transition-all duration-1000 ${item.status === "generating" ? "blur-xl scale-110 opacity-40" : "opacity-100"}`}
          >
            <img
              src={
                currentSrc.startsWith("data")
                  ? currentSrc
                  : `data:image/png;base64,${currentSrc}`
              }
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* GENERATING / DEDUCTING OVERLAY */}
        {(item.status === "generating" || item.status === "deducting") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
            {/* GRADUAL REVEAL PLACEHOLDER */}
            <div
              className="absolute inset-0 z-0 opacity-30 transition-all duration-500"
              style={{
                filter: `blur(${20 - progress / 5}px) brightness(${0.5 + progress / 200})`,
                opacity: 0.1 + progress / 200
              }}
            >
              <img
                src="https://picsum.photos/seed/studio/800/450?blur=10"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="relative z-10 flex flex-col items-center">
              <div className="w-16 h-16 relative flex items-center justify-center">
                <CircularProgressIcon
                  progress={item.status === "deducting" ? 0 : progress}
                  className="w-full h-full text-cyan-500"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-black text-white">
                    {item.status === "deducting"
                      ? "..."
                      : `${Math.round(progress)}%`}
                  </span>
                </div>
              </div>
              <span className="text-[8px] font-black text-cyan-400 tracking-[0.3em] mt-4 uppercase animate-pulse">
                {item.status === "deducting"
                  ? "Deducting Credits..."
                  : "Producing Footage..."}
              </span>
            </div>
          </div>
        )}

        {item.status === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/20 p-4 text-center">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-500 mb-2" />
            <span className="text-[8px] font-black text-red-400 tracking-widest uppercase">
              Signal Lost
            </span>
          </div>
        ) : item.type === "video" ? (
          <video
            src={item.videoUrl}
            className="w-full h-full object-cover"
            controls
            playsInline
            loop
            muted
          />
        ) : (
          <img
            src={
              currentSrc.startsWith("data")
                ? currentSrc
                : `data:image/png;base64,${currentSrc}`
            }
            className="w-full h-full object-cover"
          />
        )}

        {/* OVERLAY ACTIONS */}
        {item.status === "complete" && (
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <button
              onClick={handleDownload}
              className="p-1.5 bg-black/60 text-white rounded-lg hover:bg-cyan-600 transition-all shadow-lg"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="p-3 bg-[#0a0f1d] border-t border-white/5 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span
            className={`px-2 py-0.5 rounded text-[7px] font-black tracking-widest uppercase border ${item.type === "video" ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"}`}
          >
            {item.type}
          </span>
          <p className="text-[8px] font-bold text-gray-500 truncate flex-1 ml-2 tracking-tight opacity-60">
            {item.prompt}
          </p>
        </div>
        <button
          disabled={item.status !== "complete" || isAdded}
          onClick={handleAdd}
          className={`w-full py-2.5 rounded-xl text-[8px] font-black tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 border ${isAdded ? "bg-green-600 text-white border-green-500/50" : "bg-white/5 text-gray-400 hover:bg-white/10 border-white/5"}`}
        >
          {isAdded ? (
            <CheckIcon className="w-3 h-3" />
          ) : (
            <PlusIcon className="w-3 h-3" />
          )}
          {isAdded ? "ADDED" : "ADD TO TIMELINE"}
        </button>
      </div>
    </div>
  );
};

export const Footage: React.FC<FootageProps> = ({
  visualStyle,
  aspectRatio,
  videoLength,
  characterStyle,
  selectedCountry,
  onProduce,
  isGenerating = false,
  creditBalance,

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
  savedItems,
  footageHistory,
  onAddToTimeline
}) => {
  const [activeSlotIdx, setActiveSlotIdx] = useState<number | null>(null);
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);
  const [showContextDropdown, setShowContextDropdown] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [creditError, setCreditError] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextDropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

      if (
        contextDropdownRef.current &&
        !contextDropdownRef.current.contains(target)
      ) {
        setShowContextDropdown(false);
      }

      // FIX: Do NOT cancel confirmation immediately.
      // Only cancel if clicking completely outside and NOT the generate button
      if (
        isConfirming &&
        !creditError &&
        buttonRef.current &&
        target instanceof Element &&
        !buttonRef.current.contains(target)
      ) {
        setTimeout(() => {
          setIsConfirming(false);
        }, 150);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isConfirming, creditError]);

  useEffect(() => {
    // Safety: never allow history picker to stay open during generation only
    if (isGenerating) {
      setShowHistoryPicker(false);
      setActiveSlotIdx(null);
    }
  }, [isGenerating]);

  const handleProduceClick = async () => {
    if (!footagePrompt.trim() || isGenerating) return;

    // First click = confirmation only
    if (!isConfirming) {
      if (creditError) return;
      setCreditError(false);
      setIsConfirming(true);
      return;
    }

    // Second click = trigger production (App will deduct credits)
    setCreditError(false);

    onProduce(
      footagePrompt,
      hasRefImages ? "i2i" : footageMode,
      footageRefImages[0] || undefined,
      footageVideoTier,
      footageImageTier,
      footageRefImages[1] || undefined
    );

    setIsConfirming(false);
  };

  const toggleTier = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirming(false); // Reset confirmation if they change the tier
    if (footageMode === "image") {
      setFootageImageTier(footageImageTier === "fast" ? "pro" : "fast");
    } else {
      setFootageVideoTier(
        footageVideoTier === "veo31-fast" ? "veo31-quality" : "veo31-fast"
      );
    }
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
  let shortTier = footageImageTier === "pro" ? "PRO" : "FAST";

  if (footageMode === "video") {
    if (footageVideoTier === "veo31-quality") {
      cost = videoLength === 8 ? 16 : 12;
      shortTier = "HD";
    } else {
      cost = videoLength === 8 ? 8 : 6;
      shortTier = "FAST";
    }
  }
  // Filter for items originating from this section or specifically marked as footage
  const recentResults = footageHistory.filter(
    (h) =>
      h.originSection === "FootageFrontSection" ||
      h.sceneId?.startsWith("footage-")
  );

  return (
    <div className="w-full h-full flex flex-col bg-[#030712] animate-in fade-in duration-500 font-sans">
      <div className="w-full flex flex-col items-center p-4 shrink-0">
        <div className="w-full max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <h2 className="text-xl font-black text-white italic tracking-tighter leading-none">
                Quick Footage
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1 h-1 rounded-full bg-red-600 animate-pulse"></div>
                <p className="text-[7px] font-black text-gray-500 tracking-[0.4em]">
                  Rapid Terminal
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="px-2 py-0.5 bg-indigo-600/10 border border-indigo-500/20 rounded text-[7px] font-black text-indigo-400 tracking-widest">
                  {visualStyle}
                </div>
                <div className="px-2 py-0.5 bg-indigo-600/10 border border-indigo-500/20 rounded text-[7px] font-black text-indigo-400 tracking-widest">
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
                      <span className="text-[8px] font-black text-gray-500">
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
              onChange={(e) => {
                setFootagePrompt(e.target.value);
                setIsConfirming(false);
                setCreditError(false);
              }}
              placeholder="Describe your footage vision... characters sync automatically."
              className="w-full h-32 bg-transparent border-none p-4 text-[15px] font-bold text-white placeholder-gray-700 resize-none focus:outline-none leading-relaxed italic scrollbar-none"
            />

            <div className="px-4 pb-4 flex items-center gap-3">
              {footageRefImages.map((img, idx) => (
                <React.Fragment key={idx}>
                  <div className="relative">
                    {img ? (
                      <div
                        className="w-20 h-14 rounded-xl border-2 border-dashed border-white/10 bg-black/40 flex items-center justify-center overflow-hidden relative"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          try {
                            const raw =
                              e.dataTransfer.getData("application/json");

                            if (!raw) {
                              console.log("DROP FAILED: no data");
                              return;
                            }

                            const data = JSON.parse(raw);

                            if (!data.src) {
                              console.log("DROP FAILED: no src");
                              return;
                            }

                            const next = [...footageRefImages];
                            next[idx] = data.src;

                            setFootageRefImages(next);

                            console.log("DROP SUCCESS");
                          } catch (err) {
                            console.error("DROP ERROR:", err);
                          }
                        }}
                      >
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
                          <XIcon className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-14 rounded-xl border-2 border-dashed border-white/10 bg-black/40 flex flex-col items-center justify-center gap-0.5 overflow-hidden group/empty">
                        <button
                          onClick={() => {
                            setActiveSlotIdx(idx);
                            setShowHistoryPicker(true);
                          }}
                          className="w-full flex-1 flex items-center justify-center bg-white/5 hover:bg-indigo-600 text-[8px] font-black text-gray-500 hover:text-white transition-all tracking-tighter"
                        >
                          HIST
                        </button>
                        <button
                          onClick={() => {
                            setActiveSlotIdx(idx);
                            fileInputRef.current?.click();
                          }}
                          className="w-full flex-1 flex items-center justify-center bg-white/5 hover:bg-indigo-600 text-[8px] font-black text-gray-500 hover:text-white transition-all tracking-tighter border-t border-white/5"
                        >
                          COMP
                        </button>
                      </div>
                    )}
                  </div>
                  {idx === 0 && showTransitionArrow && (
                    <ArrowsRightLeftIcon className="w-4 h-4 text-indigo-600" />
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="border-t border-white/5 bg-white/[0.01] p-3 flex flex-wrap items-center gap-3">
              <div className="flex bg-black/50 rounded-xl p-1 items-center gap-1 shadow-inner shrink-0">
                <button
                  onClick={() => {
                    setFootageMode("image");
                    setIsConfirming(false);
                  }}
                  className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${footageMode === "image" && !hasRefImages ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-300"}`}
                >
                  <PhotoIcon className="w-3.5 h-3.5" /> IMAGE
                </button>
                <button
                  onClick={() => {
                    setFootageMode("video");
                    setIsConfirming(false);
                  }}
                  className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${footageMode === "video" && !hasRefImages ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-300"}`}
                >
                  <VideoIcon className="w-3.5 h-3.5" /> VIDEO
                </button>
                {hasRefImages && (
                  <div className="px-3.5 bg-indigo-900/40 rounded-lg py-2.5 flex items-center justify-center gap-2 text-[10px] font-black tracking-widest text-indigo-300">
                    <SparklesIcon className="w-3.5 h-3.5" /> I2I
                  </div>
                )}
              </div>

              <div className="relative flex items-center w-full sm:w-auto sm:ml-auto">
                {creditError && (
                  <div className="absolute -top-8 right-0 text-red-500 text-xs font-bold">
                    Insufficient credits
                  </div>
                )}
                <button
                  ref={buttonRef}
                  onClick={handleProduceClick}
                  disabled={isGenerating || !footagePrompt.trim()}
                  className={`h-12 w-full sm:w-auto px-6 shrink-0 font-black  font-black tracking-widest rounded-xl transition-all active:scale-95 flex items-center justify-center border shadow-xl overflow-hidden disabled:opacity-40 disabled:bg-gray-800 disabled:text-gray-600 disabled:border-white/5 disabled:cursor-not-allowed ${
                    creditError
                      ? "bg-red-600 text-white border-red-500 animate-pulse"
                      : isConfirming
                        ? "bg-green-600 text-white border-green-500"
                        : "bg-indigo-600 text-white hover:bg-indigo-500 border-indigo-400"
                  }`}
                >
                  {isGenerating ? (
                    <LoaderIcon className="w-5 h-5 animate-spin" />
                  ) : creditError ? (
                    <span className="text-[11px] font-black uppercase">
                      Insufficient credit
                    </span>
                  ) : (
                    <>
                      <div className="flex-1 flex items-center justify-center gap-2 pl-4">
                        {isConfirming ? (
                          <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                            <span className="text-[12px] font-black uppercase tracking-[0.1em]">
                              Confirm
                            </span>
                          </div>
                        ) : (
                          <>
                            <ClapperboardIcon className="w-4 h-4" />
                            <span className="text-[11px] font-black uppercase">
                              Generate
                            </span>
                          </>
                        )}
                      </div>

                      <div
                        onClick={(e) => toggleTier(e)}
                        className={`h-full flex items-center transition-all cursor-pointer border-l border-white/10 px-4 group/tier ${isConfirming ? "bg-black/40" : "bg-black/20 hover:bg-black/40"}`}
                      >
                        <div className="flex flex-col items-center justify-center leading-none">
                          <span className="text-[10px] font-black tracking-widest text-white group-hover/tier:text-sky-400 transition-colors">
                            {shortTier}
                          </span>
                          <span className="text-[11px] font-black text-sky-400 mt-0.5">
                            {cost}C
                          </span>
                        </div>
                        <ArrowsRightLeftIcon className="w-3 h-3 opacity-40 group-hover/tier:opacity-100 ml-2 transition-all group-hover/tier:rotate-180" />
                      </div>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RESULTS GRID - ALWAYS BELOW THE ENGINE */}
        <div className="w-full max-w-6xl">
          <div className="flex items-center gap-4 px-2 mb-6">
            <span className="text-[10px] font-black text-gray-500 tracking-[0.5em] uppercase whitespace-nowrap">
              Production Reel
            </span>
            <div className="h-px bg-white/5 flex-1"></div>
          </div>

          {recentResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-20">
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center mb-6">
                <ClapperboardIcon className="w-10 h-10 text-gray-600" />
              </div>
              <p className="text-[10px] font-black text-gray-500 tracking-[0.5em] uppercase">
                Ready for Production
              </p>
              <p className="text-[9px] text-gray-600 max-w-sm mt-2 leading-relaxed">
                Initiated assets will automatically appear in your Production
                Stage for cinematic editing and timeline assembly.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentResults.map((item, idx) => (
                <FootageResultCard
                  key={item.sceneId || idx}
                  item={item}
                  onAddToTimeline={(...args) => {
                    setShowHistoryPicker(false);
                    setActiveSlotIdx(null);
                    onAddToTimeline(...args);
                  }}
                />
              ))}
            </div>
          )}
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
