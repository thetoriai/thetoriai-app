import React, { useRef, useState, useEffect } from "react";
import {
  TrashIcon,
  LoaderIcon,
  PlusIcon,
  SparklesIcon,
  DownloadIcon,
  UploadIcon,
  UserPlusIcon,
  ExclamationTriangleIcon
} from "./Icons";
import type { Character } from "../services/geminiService";
import { fileToBase64 } from "../utils/fileUtils";

interface ActorRosterProps {
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  handleBuildCharacterVisual: (id: number) => void;
  handleUploadNewCharacterImage: (file: File) => void;
  handleCharacterImageUpload: (file: File, id: number) => void;
  updateCharacter: (id: number, props: Partial<Character>) => void;
  removeCharacter: (id: number) => void;
  onToggleHero?: (id: number) => void;
  onUpdateHeroData?: (id: number, data: Partial<Character["heroData"]>) => void;
  visualStyle?: string;
}

const HeroStarIcon = ({
  solid,
  className
}: {
  solid?: boolean;
  className?: string;
}) => (
  <svg
    className={className}
    fill={solid ? "currentColor" : "none"}
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
    />
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
      if (showRefineId !== null && !target.closest(".refine-zone")) {
        setShowRefineId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showRefineId]);

  const runAnalysis = (char: Character) => {
    if (
      char.originalImageBase64 &&
      char.originalImageMimeType &&
      char.name.trim()
    ) {
      const blob = new Blob(
        [
          new Uint8Array(
            atob(char.originalImageBase64)
              .split("")
              .map((c) => c.charCodeAt(0))
          )
        ],
        { type: char.originalImageMimeType }
      );
      const file = new File([blob], "asset.png", {
        type: char.originalImageMimeType
      });
      props.handleCharacterImageUpload(file, char.id);
    }
  };

  const handleNameChange = (id: number, val: string) => {
    const capitalized =
      val.length > 0 ? val.charAt(0).toUpperCase() + val.slice(1) : val;
    props.updateCharacter(id, { name: capitalized });
  };

  const handleNameBlur = (char: Character) => {
    if (
      char.name.trim().length > 1 &&
      char.imagePreview &&
      !char.description &&
      !char.isAnalyzing
    ) {
      runAnalysis(char);
    }
  };

  const handleNewEmptyActor = () => {
    const newChar: Character = {
      id: Date.now(),
      name: "",
      imagePreview: null,
      originalImageBase64: null,
      originalImageMimeType: null,
      description: null,
      detectedImageStyle: null,
      isDescribing: false,
      isHero: false
    };
    props.setCharacters((prev) => [...prev, newChar]);
    setShowRefineId(newChar.id);
  };

  const handleNewEntryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      const newChar: Character = {
        id: Date.now(),
        name: "",
        imagePreview: `data:${file.type};base64,${base64}`,
        originalImageBase64: base64,
        originalImageMimeType: file.type,
        description: null,
        detectedImageStyle: null,
        isDescribing: false,
        isHero: false
      };
      props.setCharacters((prev) => [...prev, newChar]);
    }
    e.target.value = "";
  };

  const handleReplacementUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file && uploadTargetId !== null) {
      const base64 = await fileToBase64(file);
      props.updateCharacter(uploadTargetId, {
        imagePreview: `data:${file.type};base64,${base64}`,
        originalImageBase64: base64,
        originalImageMimeType: file.type
      });
      const char = props.characters.find((c) => c.id === uploadTargetId);
      if (char && char.name.trim()) {
        props.handleCharacterImageUpload(file, uploadTargetId);
      }
    }
    e.target.value = "";
    setUploadTargetId(null);
  };

  const handleDownload = (char: Character) => {
    if (!char.imagePreview) return;
    const link = document.createElement("a");
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
    const isAnySafetyBlock =
      char.detectedImageStyle === "BLOCK_MINOR" ||
      char.detectedImageStyle === "BLOCK_SAFETY_GENERAL";
    const styleLabel = (props.visualStyle || "3D")
      .replace(" Render", "")
      .toUpperCase();

    return (
      <div
        className={`group bg-[#0f172a] border relative transition-all shadow-20xl overflow-hidden flex flex-col refine-zone ${isLead ? "border-amber-500/20 rounded-[2rem]" : "border-white/5 rounded-xl"} ${isRefining ? "themed-artline" : ""} ${isAnySafetyBlock ? "border-amber-500/50 animate-pulse-amber" : ""}`}
      >
        <div
          onClick={() => isRefining && setShowRefineId(null)}
          onDoubleClick={() => !isProcessing && setShowRefineId(char.id)}
          className="relative aspect-[3/4] bg-black overflow-hidden cursor-pointer flex flex-col items-center justify-center"
        >
          {hasImage && !isAnySafetyBlock ? (
            <div className="w-full h-full relative">
              <img
                src={char.imagePreview!}
                className={`w-full h-full object-cover transition-all duration-700 ${isProcessing ? "opacity-30" : "opacity-100"}`}
              />
              {char.description && !isProcessing && (
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/100 via-black/80 to-transparent pointer-events-none">
                  <p className="text-[10px] font-black text-white  tracking-widest line-clamp-2 drop-shadow-md">
                    {char.description.replace(/Who: |Age: |Clothes: /g, "")}
                  </p>
                </div>
              )}
            </div>
          ) : isAnySafetyBlock ? (
            <div className="absolute inset-0 bg-amber-950/20 backdrop-blur-sm p-4 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center mb-3 border border-amber-500/30">
                <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
              </div>
              <h4 className="text-[8px] font-black text-amber-500  tracking-widest mb-1">
                {char.detectedImageStyle === "BLOCK_MINOR"
                  ? "Minor Detected"
                  : "Content Rejected"}
              </h4>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.updateCharacter(char.id, {
                    imagePreview: null,
                    detectedImageStyle: null,
                    description: null
                  });
                  setShowRefineId(char.id);
                }}
                className="px-4 py-1.5 bg-amber-600 text-black text-[8px] font-black  tracking-widest rounded transition-all active:scale-95"
              >
                Reset Artist
              </button>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#070b14] relative group/empty">
              {isProcessing ? (
                <div className="flex flex-col items-center">
                  <LoaderIcon className="w-8 h-8 text-indigo-500 animate-spin" />
                  <span className="text-[8px] font-black text-indigo-400  tracking-[0.4em] mt-4">
                    Analysing...
                  </span>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mb-4 group-hover/empty:scale-110 transition-transform">
                    <UserPlusIcon className="w-5 h-5 text-gray-400 group-hover/empty:text-indigo-500" />
                  </div>
                  <span className="text-[12px] font-black text-gray-300  tracking-[0.25em] text-center px-6 leading-relaxed group-hover/empty:text-white transition-colors">
                    Double-click to
                    <br />
                    Describe <br />
                    Artist
                  </span>
                </>
              )}
            </div>
          )}
          <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-[90]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.removeCharacter(char.id);
              }}
              className="p-1.5 bg-red-600/80 text-white rounded shadow-lg hover:bg-red-600 transition-colors"
              title="Remove Artist"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
            {hasImage && !isAnySafetyBlock && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(char);
                }}
                className="p-1.5 bg-indigo-600/80 text-white rounded shadow-lg hover:bg-indigo-600 transition-colors"
                title="Download Roster Image"
              >
                <DownloadIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {hasImage && !isProcessing && !isRefining && !isAnySafetyBlock && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.onToggleHero?.(char.id);
                }}
                className={`p-2.5 rounded-full shadow-2xl pointer-events-auto transition-transform hover:scale-110 ${char.isHero ? "bg-amber-500 text-black" : "bg-white/10 text-white backdrop-blur-md"}`}
                title="Set as Lead Actor"
              >
                <HeroStarIcon solid={char.isHero} className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>
        <div className="p-2.5 bg-[#0a0f1d] border-t border-white/5 flex flex-col">
          {isRefining && (
            <div className="flex flex-col animate-in fade-in slide-in-from-top-1 duration-200">
              <textarea
                value={char.customInstruction || ""}
                autoFocus
                onChange={(e) =>
                  props.updateCharacter(char.id, {
                    customInstruction: e.target.value
                  })
                }
                placeholder="Describe physical traits, clothing, age..."
                className="w-full h-14 bg-black/40 border border-white/10 rounded-lg p-2 text-[12px] font-medium text-white placeholder-gray-400 focus:border-indigo-500 outline-none resize-none leading-tight mt-2"
              />
              <div className="flex gap-2 mt-2">
                <button
                  disabled={!hasName}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.handleBuildCharacterVisual(char.id);
                    setShowRefineId(null);
                  }}
                  className={`flex-1 py-2 text-[8px] font-black  tracking-[0.2em] rounded-lg border transition-all active:scale-95 shadow-lg ${hasName ? "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400/20" : "bg-gray-800 text-gray-600 border-transparent cursor-not-allowed"}`}
                >
                  {hasName ? (hasImage ? `REFINE` : `CREATE`) : "NAME REQ"}
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 pt-2 mt-1 border-t border-white/5 px-1">
            <div className="flex-1 flex items-center justify-between">
              <input
                value={char.name}
                onBlur={() => handleNameBlur(char)}
                onChange={(e) => handleNameChange(char.id, e.target.value)}
                className={`flex-1 bg-transparent border-none p-0 font-black text-left text-white outline-none tracking-tighter  placeholder-gray-500 ${isLead ? "text-lg" : "text-[20px]"} ${!hasName ? "ring-1 ring-amber-500/20 px-2 py-0.5 rounded" : ""}`}
                placeholder="ACTOR NAME"
              />
              {!isRefining &&
                char.name &&
                !char.description &&
                hasImage &&
                !isAnySafetyBlock && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      runAnalysis(char);
                    }}
                    className="p-1 text-indigo-500/40 hover:text-indigo-400 transition-colors"
                  >
                    <SparklesIcon className="w-3 h-3" />
                  </button>
                )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const hero = props.characters.find((c) => c.isHero);
  const supportingCast = props.characters.filter((c) => !c.isHero);

  return (
    <div ref={containerRef} className="space-y-10 pb-60 px-4">
      {hero && (
        <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-3">
            <HeroStarIcon solid className="w-12 h-12 text-amber-500" />
            <span className="text-[12px] font-black text-amber-500  tracking-[0.4em]">
              Master Lead
            </span>
            <div className="h-px bg-amber-500/10 flex-1"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            {renderCharacterCard(hero, true)}
            <div className="space-y-6">
              <div className="bg-[#0f172a] border border-white/5 p-8 rounded-[1rem] shadow-xl themed-artline">
                <div className="flex items-center justify-between mb-8">
                  <span className="text-[12px] font-bold text-gray-400  tracking-widest opacity-80">
                    Studio Visual Key
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {["frontView", "backView", "sideViewLeft"].map((slotKey) => {
                    const label =
                      slotKey === "frontView"
                        ? "Front"
                        : slotKey === "backView"
                          ? "Back"
                          : "Profile";
                    const img =
                      hero.heroData?.[slotKey as keyof typeof hero.heroData];
                    return (
                      <div
                        key={slotKey}
                        onClick={() => {
                          setActiveStudioId(hero.id);
                          setStudioUploadKey(slotKey);
                          studioFileInputRef.current?.click();
                        }}
                        className={`aspect-square border border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative ${img ? "border-amber-500/50 bg-black/40" : "border-white/10 hover:border-amber-500/30 bg-black/20"}`}
                      >
                        {img ? (
                          <img
                            src={`data:image/png;base64,${img}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[7px] font-black text-gray-400  tracking-widest">
                            {label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="p-5 border border-indigo-500/20 rounded-3xl bg-indigo-600/5 themed-artline">
                <p className="text-[9px] font-black text-indigo-300  tracking-widest mb-1.5">
                  Production Mandate
                </p>
                <p className="text-[9px] text-gray-300 font-medium  leading-relaxed italic">
                  Double-click any artist to open refinement tools. Names are
                  used to link actors to scripts.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-8 pt-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-gray-400  tracking-[0.4em]">
            Supporting Roster
          </span>
          <div className="h-px bg-white/5 flex-1"></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {supportingCast.map((char) => (
            <div
              key={char.id}
              className="animate-in fade-in zoom-in-95 duration-500"
            >
              {renderCharacterCard(char)}
            </div>
          ))}

          <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <button
              onClick={handleNewEmptyActor}
              className="aspect-[3/4] border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-600/5 hover:border-indigo-500/40 transition-all group themed-artline"
            >
              <div className="w-10 h-10 border border-white/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <PlusIcon className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" />
              </div>
              <span className="text-[8px] font-black text-gray-300  tracking-[0.4em] group-hover:text-indigo-400">
                New Actor
              </span>
            </button>
            <button
              onClick={() => newEntryUploadRef.current?.click()}
              className="flex items-center justify-center gap-2 py-3 border border-white/10 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] transition-all"
            >
              <UploadIcon className="w-3 h-3 text-gray-300" />
              <span className="text-[8px] font-black text-gray-300  tracking-widest">
                Import Artist
              </span>
            </button>
          </div>
        </div>
      </div>
      <input
        type="file"
        ref={studioFileInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          if (
            e.target.files?.[0] &&
            activeStudioId &&
            studioUploadKey &&
            props.onUpdateHeroData
          ) {
            fileToBase64(e.target.files[0]).then((base64) =>
              props.onUpdateHeroData!(activeStudioId, {
                [studioUploadKey]: base64
              })
            );
          }
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={newEntryUploadRef}
        className="hidden"
        accept="image/*"
        onChange={handleNewEntryFile}
      />
      <input
        type="file"
        ref={replacementUploadRef}
        className="hidden"
        accept="image/*"
        onChange={handleReplacementUpload}
      />
    </div>
  );
};
