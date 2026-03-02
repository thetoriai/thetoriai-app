import React, { useRef, useState, useEffect, useMemo } from "react";
import {
  SparklesIcon,
  PlusIcon,
  
  XIcon,
  ClapperboardIcon,
  BookOpenIcon,
  Logo,
  MusicalNoteIcon,
  LoaderIcon,
  HistoryIcon,
  FilmIcon,
  PhotoIcon,
  VideoIcon,
  ArrowsRightLeftIcon,
  ChevronDownIcon
} from "./Icons";
import { SceneCard } from "./Card";
import { fileToBase64 } from "../utils/fileUtils";

interface StoryboardProps {
  videoLength: number;
  
  generationItem: any;
  savedItems: any[];
  history: any[];
  historyIndex: number;

  footageHistory: any[];

  // REQUIRED: credit handler used by SceneCard
  consumeCredits: (actionType: string) => Promise<boolean>;
  onSaveScene: (genId: number, sceneId: string) => void;
  onEditScene: (genId: number, sceneId: string) => void;
  onRegenerateScene: (genId: number, sceneId: string) => void;
  onAngleSelect: (genId: number, sceneId: string) => void;
  onDeleteScene?: (genId: number, sceneId: string) => void;
  onOpenVideoCreator: (idx: number) => void;
  onGenerateVideo: (
    genId: number,
    sceneId: string,
    script?: string,
    cameraMovement?: string,
    withAudio?: boolean
  ) => void;
  // DO add comment: Fix onAddToTimeline type signature to match SceneCard's required 4-parameter interface.
  onAddToTimeline: (
    url: string,
    type: "video" | "image",
    duration?: number,
    obj?: any
  ) => void;
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

  // DO add comment above each fix. Fix currency type: Added 'EUR' to the allowed currency union to resolve type mismatch in App and Modals.
  currency: "EUR";
  onCloseSession?: () => void;

  onSwitchSession: (index: number, sceneId?: string, restore?: boolean) => void;
  onNewSession: () => void;
  onNewSessionFromAsset?: (src: string) => void;
  onUpdateVideoDraft: (genId: number, sceneId: string, updates: any) => void;
  creditBalance: number;
 
  onStopScene?: (genId: number, sceneId: string) => void;
  onUndoEdit?: (genId: number, sceneId: string) => void;
  onSceneVariantChange?: (
    genId: number,
    sceneId: string,
    direction: "next" | "prev"
  ) => void;
  isBlurred?: boolean;
  activeI2ISlot: { genId: number; sceneId: string } | null;
  setActiveI2ISlot: (slot: { genId: number; sceneId: string } | null) => void;
  onGenerateAudioOnly?: (genId: number, sceneId: string) => void;
  onAddAudioToTimeline?: (url: string, duration: number) => void;
  characters: any[];
  // Quick Footage Integration Props
  onProduceQuickFootage?: (
    prompt: string,
    mode: "image" | "video" | "i2i",
    refImage?: string,
    videoTier?: string,
    imageTier?: string,
    endImage?: string
  ) => void;
  initialTab?: "quickFootage" | "storybook";
}

export const Storyboard = React.memo(
  (props: StoryboardProps) => {
    const { history, savedItems, storybook, videoLength } = props;

    const qfFileInputRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [activeStudioTab, setActiveStudioTab] = useState<
      "quickFootage" | "storybook"
    >(props.initialTab || "quickFootage");

    useEffect(() => {
      if (props.initialTab) {
        setActiveStudioTab(props.initialTab);
      }
    }, [props.initialTab]);

    const [qfPrompt, setQfPrompt] = useState("");
    const [qfMode, setQfMode] = useState<"image" | "video">("image");
    const [qfImageTier, setQfImageTier] = useState<"fast" | "pro">("fast");
    const [qfVideoTier, setQfVideoTier] = useState<
      "veo31-fast" | "veo31-quality"
    >("veo31-fast");
    const [qfRefImages, setQfRefImages] = useState<(string | null)[]>([
      null,
      null
    ]);
    const [qfActiveSlotIdx, setQfActiveSlotIdx] = useState<number | null>(null);
    const [isConfirmingQF, setIsConfirmingQF] = useState(false);
    const [qfCreditError, setQfCreditError] = useState(false);

    const isPhone = window.innerWidth <= 500;

    // Unified helper for extracting metadata and content from different history sources
    const allFootageAssets = useMemo(() => {
      const footageLabels = [
        "FootageFrontSection",
        "UploadedSection",
        "TimelineSection"
      ];

      const fromFootage = props.footageHistory.filter((f) =>
        footageLabels.includes(f.originSection || "FootageFrontSection")
      );

      const fromHistory = history
        .filter((h) => h.type !== "storybook")
        .flatMap((h) =>
          (h.imageSet || []).map((s: any, idx: number) => ({
            ...s,
            genId: h.id,
            videoState: h.videoStates ? h.videoStates[idx] : null,
            aspectRatio: h.aspectRatio,
            originSection:
              s.originSection ||
              (h.type === "upload"
                ? "UploadedSection"
                : h.type === "timeline"
                  ? "TimelineSection"
                  : "FootageFrontSection")
          }))
        );

      return [...fromFootage, ...fromHistory]
        .filter((s) => footageLabels.includes(s.originSection) && !s.isHidden)
        .sort(
          (a, b) =>
            (b.timestamp || b.genId || 0) - (a.timestamp || a.genId || 0)
        );
    }, [history, props.footageHistory]);

    // SPLIT ASSETS FOR UI GRID AS REQUESTED
    const producedFootage = useMemo(
      () =>
        allFootageAssets.filter(
          (a) => a.originSection === "FootageFrontSection"
        ),
      [allFootageAssets]
    );

    const uploadedFootage = useMemo(
      () =>
        allFootageAssets.filter((a) => a.originSection === "UploadedSection"),
      [allFootageAssets]
    );

    const capturedFootage = useMemo(
      () =>
        allFootageAssets.filter((a) => a.originSection === "TimelineSection"),
      [allFootageAssets]
    );

    const storybookAssets = useMemo(() => {
      // Items generated from the storybook tool
      const fromHistory = history
        .filter((h) => h.type === "storybook")
        .flatMap((h) =>
          (h.imageSet || []).map((s: any, idx: number) => ({
            ...s,
            genId: h.id,
            videoState: h.videoStates ? h.videoStates[idx] : null,
            aspectRatio: h.aspectRatio,
            originSection: "StorybookSection"
          }))
        );

      const fromFootage = props.footageHistory.filter(
        (f) => f.originSection === "StorybookSection"
      );

      return [...fromHistory, ...fromFootage]
        .filter((s) => !s.isHidden)
        .sort(
          (a, b) =>
            (b.timestamp || b.genId || 0) - (a.timestamp || a.genId || 0)
        );
    }, [history, props.footageHistory]);

  const handleQFProduce = async () => {
    if (!qfPrompt.trim() || props.isGenerating) return;

    if (!isConfirmingQF) {
      if (qfCreditError) return;
      setQfCreditError(false);
      setIsConfirmingQF(true);
      return;
    }

    const hasRefs = qfRefImages.some((img) => img !== null);
    const isVideoMode = !hasRefs && qfMode === "video";

    let action = "IMAGE_FAST";

  if (hasRefs) {
    action = qfImageTier === "pro" ? "IMAGE_PRO" : "IMAGE_FAST";
  } else if (qfMode === "image") {
    action = qfImageTier === "pro" ? "IMAGE_PRO" : "IMAGE_FAST";
  } else if (qfMode === "video") {
    if (qfVideoTier === "veo31-quality") {
      action = videoLength === 8 ? "VIDEO_HQ_8S" : "VIDEO_HQ_6S";
    } else {
      action = videoLength === 8 ? "VIDEO_FAST_8S" : "VIDEO_FAST_6S";
    }
  }

    try {
      const ok = await props.consumeCredits(action);

      if (!ok) {
        setQfCreditError(true);
        setIsConfirmingQF(false);
        
        return;
      }
    } catch {
      setQfCreditError(true);
      setIsConfirmingQF(false);
      
      return;
    }

    setQfCreditError(false);

    if (isVideoMode) {
      props.onProduceQuickFootage?.(
        qfPrompt,
        "video",
        undefined,
        qfVideoTier,
        qfImageTier,
        undefined
      );
    } else {
      const mode = hasRefs ? "i2i" : "image";

      props.onProduceQuickFootage?.(
        qfPrompt,
        mode,
        qfRefImages[0] || undefined,
        qfVideoTier,
        qfImageTier,
        qfRefImages[1] || undefined
      );
    }

    setQfPrompt("");
    setQfRefImages([null, null]);
    setIsConfirmingQF(false);
  };
    
    const handleQFFileUpload = async (
      e: React.ChangeEvent<HTMLInputElement>
    ) => {
      if (e.target.files?.[0] && qfActiveSlotIdx !== null) {
        const base64 = await fileToBase64(e.target.files[0]);
        const next = [...qfRefImages];
        next[qfActiveSlotIdx] = base64;
        setQfRefImages(next);
        setQfActiveSlotIdx(null);
      }
    };

    const renderAssetGrid = (
      assets: any[],
      title: string,
      icon: React.ReactNode
    ) => {
      if (assets.length === 0) return null; // Ensure section doesn't appear if empty
      return (
        <div className="animate-in fade-in duration-700 mb-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              {icon}
              <h3 className="text-[10px] font-black text-gray-400 tracking-[0.4em] uppercase">
                {title}
              </h3>
            </div>
            <div className="h-px bg-white/5 flex-1"></div>
          </div>
          {assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 opacity-20">
              <HistoryIcon className="w-20 h-20 mb-6" />
              <p className="text-[11px] font-black tracking-[0.4em] uppercase text-gray-500">
                Awaiting production
              </p>
            </div>
          ) : (
            <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {assets.map(
                (scene, idx) => (
                  console.log("SCENE DATA:", scene),
                  (
                    <div
                      key={scene.sceneId || idx}
                      draggable={true}
                      onDragStart={(e) => {
                        const payload = {
                          src: scene.src || scene.image,
                          sceneId: scene.sceneId,
                          genId: scene.genId
                        };

                        e.dataTransfer.setData(
                          "application/json",
                          JSON.stringify(payload)
                        );

                        e.dataTransfer.effectAllowed = "copy";
                      }}
                    >
                      <SceneCard
                        scene={scene}
                        index={idx}
                        consumeCredits={props.consumeCredits}
                        genId={
                          scene.genId ||
                          scene.originSessionId ||
                          scene.timestamp ||
                          0
                        }
                        videoState={scene.videoState}
                        isSaved={savedItems.some(
                          (i) => (i.sceneId || i.id) === scene.sceneId
                        )}
                        videoLength={props.videoLength}
                        isActive={props.activeVideoIndices.includes(idx)}
                        status={
                          scene.status || (scene.src ? "complete" : "pending")
                        }
                        draftScript={scene.videoState?.draftScript || ""}
                        draftMovement={
                          scene.videoState?.draftCameraMovement ||
                          "Zoom In (Focus In)"
                        }
                        aspectRatio={scene.aspectRatio || "16:9"}
                        onPreviewImage={props.onPreviewImage}
                        onSave={() =>
                          props.onSaveScene(
                            scene.genId || scene.originSessionId,
                            scene.sceneId
                          )
                        }
                        onAngle={() =>
                          props.onAngleSelect(
                            scene.genId || scene.originSessionId,
                            scene.sceneId
                          )
                        }
                        onEdit={() =>
                          props.onEditScene(
                            scene.genId || scene.originSessionId,
                            scene.sceneId
                          )
                        }
                        onRegenerate={() =>
                          props.onRegenerateScene(
                            scene.genId || scene.originSessionId,
                            scene.sceneId
                          )
                        }
                        onDelete={() =>
                          props.onDeleteScene?.(
                            scene.genId || scene.originSessionId,
                            scene.sceneId
                          )
                        }
                        onUndo={() =>
                          props.onUndoEdit?.(
                            scene.genId || scene.originSessionId,
                            scene.sceneId
                          )
                        }
                        onVariantChange={(dir) =>
                          props.onSceneVariantChange?.(
                            scene.genId || scene.originSessionId,
                            scene.sceneId,
                            dir
                          )
                        }
                        onStopScene={() =>
                          props.onStopScene?.(
                            scene.genId || scene.originSessionId,
                            scene.sceneId
                          )
                        }
                        onToggleVideoCreator={() =>
                          props.onOpenVideoCreator(idx)
                        }
                        onUpdateDraft={(updates) =>
                          props.onUpdateVideoDraft(
                            scene.genId || scene.originSessionId,
                            scene.sceneId,
                            updates
                          )
                        }
                        onGenerateVideo={(script, mvmnt, withAudio) =>
                          props.onGenerateVideo(
                            scene.genId || scene.originSessionId,
                            scene.sceneId,
                            script,
                            mvmnt,
                            withAudio
                          )
                        }
                        onAddToTimeline={props.onAddToTimeline}
                        onImportScript={() => {
                          if (scene.storyScript) {
                            props.onUpdateVideoDraft(
                              scene.genId || scene.originSessionId,
                              scene.sceneId,
                              { draftScript: scene.storyScript }
                            );
                          }
                        }}
                        hasScriptToImport={!!scene.storyScript}
                        videoModel={props.videoModel}
                        videoResolution={props.videoResolution || "720p"}
                        setVideoModel={props.setVideoModel}
                        setVideoResolution={props.setVideoResolution}
                        isDisabled={props.isDisabled}
                        videoCostDisplay={
                          props.videoModel === "veo-3.1-fast-generate-preview"
                            ? props.videoLength === 8
                              ? "8 Credits"
                              : "6 Credits"
                            : props.videoLength === 8
                              ? "16 Credits"
                              : "12 Credits"
                        }
                        isMusicVideo={false}
                        isHistory={false}
                        creditBalance={props.creditBalance}
                        activeI2ISlot={props.activeI2ISlot}
                        setActiveI2ISlot={props.setActiveI2ISlot}
                        characters={props.characters}
                      />
                    </div>
                  )
                )
              )}
            </div>
          )}
        </div>
      );
    };

    const qfCost =
      qfMode === "image"
        ? qfImageTier === "pro"
          ? 2
          : 1
        : qfVideoTier === "veo31-quality"
          ? videoLength === 8
            ? 16
            : 12
          : videoLength === 8
            ? 8
            : 6;

    const qfShortTier =
      qfMode === "image"
        ? qfImageTier === "pro"
          ? "PRO"
          : "FAST"
        : qfVideoTier === "veo31-quality"
          ? "HD"
          : "FAST";

    const toggleQfTier = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsConfirmingQF(false); // Reset confirmation if they change the tier
      if (qfMode === "image") {
        setQfImageTier(qfImageTier === "fast" ? "pro" : "fast");
      } else {
        setQfVideoTier(
          qfVideoTier === "veo31-fast" ? "veo31-quality" : "veo31-fast"
        );
      }
    };

    return (
      <div
        className={`flex-1 flex flex-col h-full overflow-hidden bg-gray-950 relative ${props.isBlurred ? "blur-sm pointer-events-none" : ""}`}
      >
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img
            src="https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&q=80&w=2000"
            className="w-full h-full object-cover opacity-[0.15]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-transparent to-gray-950"></div>
        </div>

        <div className="px-6 pt-6 shrink-0 z-20 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveStudioTab("quickFootage")}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${activeStudioTab === "quickFootage" ? "bg-indigo-600 text-white shadow-xl border border-indigo-400" : "bg-gray-900 text-gray-500 border border-white/5 hover:text-white"}`}
            >
              QUICK FOOTAGE
            </button>
            <button
              onClick={() => setActiveStudioTab("storybook")}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${activeStudioTab === "storybook" ? "bg-indigo-600 text-white shadow-xl border border-indigo-400" : "bg-gray-900 text-gray-500 border border-white/5 hover:text-white"}`}
            >
              STORYBOOK
            </button>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 relative z-10 p-8 ${isPhone ? "pb-32" : "pb-40"}`}
        >
          {activeStudioTab === "quickFootage" ? (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex items-center gap-3 mb-4">
                <SparklesIcon className="w-5 h-5 text-indigo-400" />
                <h3 className="text-[11px] font-black text-gray-400 tracking-[0.4em] uppercase">
                  QUICK FOOTAGE
                </h3>
                <div className="h-px bg-white/5 flex-1"></div>
              </div>

              <div className="bg-[#0f172a] rounded-3xl border border-white/10 shadow-2xl p-1 overflow-hidden themed-artline mb-12">
                <textarea
                  value={qfPrompt}
                  onChange={(e) => {
                    setQfPrompt(e.target.value);
                    setQfCreditError(false);
                    setIsConfirmingQF(false);
                  }}
                  placeholder="Describe your emotion vision or motion process... results appear below."
                  className="w-full h-24 bg-transparent border-none p-5 text-[15px] font-bold text-white placeholder-gray-700 resize-none focus:outline-none leading-relaxed italic scrollbar-none"
                />

                <div className="px-5 pb-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {qfRefImages.map((img, idx) => (
                      <React.Fragment key={idx}>
                        <div
                          onClick={() => {
                            setQfActiveSlotIdx(idx);
                            qfFileInputRef.current?.click();
                          }}
                          className={`w-16 h-12 rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden flex items-center justify-center relative ${img ? "border-indigo-500 bg-black" : "border-white/10 hover:border-white/20 bg-black/40"}`}
                        >
                          {img ? (
                            <>
                              <img
                                src={
                                  img.startsWith("data")
                                    ? img
                                    : `data:image/png;base64,${img}`
                                }
                                className="w-full h-full object-cover"
                              />
                              <div
                                className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const next = [...qfRefImages];
                                  next[idx] = null;
                                  setQfRefImages(next);
                                }}
                              >
                                <XIcon className="w-4 h-4 text-white" />
                              </div>
                            </>
                          ) : (
                            <PlusIcon className="w-4 h-4 text-gray-700" />
                          )}
                        </div>
                        {idx === 0 && (
                          <ArrowsRightLeftIcon className="w-4 h-4 text-indigo-900/50" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 items-center gap-1 shadow-inner shrink-0">
                    <button
                      onClick={() => {
                        setQfMode("image");
                        setIsConfirmingQF(false);
                      }}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black tracking-widest transition-all ${qfMode === "image" ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-300"}`}
                    >
                      <PhotoIcon className="w-3.5 h-3.5" /> IMAGE
                    </button>
                    <button
                      onClick={() => {
                        setQfMode("video");
                        setIsConfirmingQF(false);
                      }}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black tracking-widest transition-all ${qfMode === "video" ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-300"}`}
                    >
                      <VideoIcon className="w-3.5 h-3.5" /> VIDEO
                    </button>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleQFProduce}
                      disabled={props.isGenerating || !qfPrompt.trim()}
                      className={`flex-1 sm:w-56 h-14 font-black tracking-[0.2em] rounded-2xl transition-all active:scale-95 flex items-center justify-center text-[11px] shadow-2xl border overflow-hidden disabled:opacity-40 disabled:bg-gray-800 disabled:text-gray-600 disabled:border-white/5 disabled:cursor-not-allowed ${
                        qfCreditError
                          ? "bg-red-600 border-red-500 text-white animate-pulse"
                          : isConfirmingQF
                            ? "bg-green-600 border-green-400 text-white"
                            : "bg-[#4f46e5] border-indigo-400 text-white hover:bg-indigo-500"
                      }`}
                    >
                      {props.isGenerating ? (
                        <LoaderIcon className="w-4 h-4 animate-spin" />
                      ) : qfCreditError ? (
                        "INSUFFICIENT CREDIT"
                      ) : (
                        <>
                          <div className="flex-1 flex items-center justify-center gap-2 pl-4">
                            {isConfirmingQF ? (
                              <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                                <span className="text-[11px] font-black uppercase tracking-[0.1em]">
                                  Confirm
                                </span>
                              </div>
                            ) : (
                              <>
                                <ClapperboardIcon className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase">
                                  Generate
                                </span>
                              </>
                            )}
                          </div>

                          <div
                            onClick={(e) => toggleQfTier(e)}
                            className={`h-full flex items-center transition-all cursor-pointer border-l border-white/10 px-4 group/qf-tier ${isConfirmingQF ? "bg-black/40" : "bg-black/20 hover:bg-black/40"}`}
                          >
                            <div className="flex flex-col items-center justify-center leading-none">
                              <span className="text-[9px] font-black tracking-widest text-white group-hover/qf-tier:text-sky-400 transition-colors">
                                {qfShortTier}
                              </span>
                              <span className="text-[10px] font-black text-sky-400 mt-0.5">
                                {qfCost}C
                              </span>
                            </div>
                            <ArrowsRightLeftIcon className="w-3 h-3 opacity-40 group-hover/qf-tier:opacity-100 ml-2 transition-all group-hover/qf-tier:rotate-180" />
                          </div>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {renderAssetGrid(
                producedFootage,
                "QUICK FOOTAGE RESULTS",
                <SparklesIcon className="w-4 h-4 text-indigo-400" />
              )}

              {renderAssetGrid(
                uploadedFootage,
                "UPLOADED IMAGE RESULTS",
                <PhotoIcon className="w-4 h-4 text-emerald-400" />
              )}

              {renderAssetGrid(
                capturedFootage,
                "TIMELINE IMAGE RESULTS",
                <FilmIcon className="w-4 h-4 text-rose-400" />
              )}

              {allFootageAssets.length === 0 && !props.isGenerating && (
                <div className="flex flex-col items-center justify-center py-32 opacity-20">
                  <HistoryIcon className="w-20 h-20 mb-6" />
                  <p className="text-[11px] font-black tracking-[0.4em] uppercase text-gray-500">
                    Awaiting production
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              {renderAssetGrid(
                storybookAssets,
                "STORYBOOK RESULTS",
                <BookOpenIcon className="w-4 h-4 text-amber-400" />
              )}
            </div>
          )}

          {props.isGenerating && (
            <div className="flex items-center gap-3 mt-12 px-2 opacity-80">
              <LoaderIcon className="w-4 h-4 animate-spin text-indigo-500" />
              <span className="text-[10px] font-black text-gray-500 tracking-[0.4em] uppercase">
                Rendering production results...
              </span>
            </div>
          )}
        </div>

        <input
          type="file"
          ref={qfFileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleQFFileUpload}
        />
      </div>
    );
  },
  (p, n) =>
    p.history === n.history &&
    p.footageHistory === n.footageHistory &&
    p.savedItems === n.savedItems &&
    p.isGenerating === n.isGenerating &&
    p.historyIndex === n.historyIndex &&
    p.videoResolution === n.videoResolution &&
    p.videoModel === n.videoModel &&
    p.creditBalance === n.creditBalance &&
    p.activeVideoIndices === n.activeVideoIndices &&
    p.storybook === n.storybook &&
    p.videoLength === n.videoLength
);
