import React, { useState, useEffect, useRef } from "react";
import {
  DownloadIcon,
  RefreshIcon,
  BookmarkIcon,
  CameraIcon,
  SparklesIcon,
  VideoIcon,
  TrashIcon,
  PlusIcon,
  ClapperboardIcon,
  XIcon,
  ExclamationTriangleIcon,
  StopIcon,
  UndoIcon,
  CircularProgressIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlayIcon,
  CreditCardIcon,
  ChevronDownIcon,
  PhotoIcon,
  SpeakerWaveIcon,
  FilmIcon,
  CheckIcon,
  ArrowsRightLeftIcon,
  LoaderIcon
} from "./Icons";
import {
  CAMERA_MOVEMENT_PROMPTS,
  enrichScript,
  type Character
} from "../services/geminiService";
import { PAYPAL_LINK } from "../utils/constants";

interface SceneProgressOverlayProps {
  onStop: () => void;
  label?: string;
}

export const SceneProgressOverlay: React.FC<SceneProgressOverlayProps> = ({
  onStop,
  label = "Producing..."
}) => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 99) return 99;
        const step = prev < 60 ? 4 : prev < 85 ? 1.5 : 0.4;
        return prev + step;
      });
    }, 300);
    return () => clearInterval(interval);
  }, []);

  const isDeducting = label.toLowerCase().includes("deducting");

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      {/* GRADUAL REVEAL PLACEHOLDER */}
      {!isDeducting && (
        <div
          className="absolute inset-0 z-0 opacity-20 transition-all duration-500"
          style={{
            filter: `blur(${20 - progress / 5}px) brightness(${0.5 + progress / 200})`,
            opacity: 0.1 + progress / 200
          }}
        >
          <img
            src="https://picsum.photos/seed/studio-card/800/450?blur=10"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
      </div>
      )}

      <div className="relative z-10 flex flex-col items-center">
        <div className="w-16 h-16 mb-4 relative flex items-center justify-center">
          <CircularProgressIcon
            progress={isDeducting ? 0 : progress}
            className="w-full h-full text-indigo-500"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-black text-white">
              {isDeducting ? "..." : `${Math.round(progress)}%`}
            </span>
          </div>
        </div>
        <p className="text-[10px] font-black text-indigo-300 tracking-[0.2em] uppercase animate-pulse">
        {label}
      </p>
      </div>
    </div>
  );
};

export interface SceneCardProps {
  consumeCredits: (action: string) => Promise<boolean>;

  scene: any;
  index: number;
  genId: number;
  videoState: any;
  videoLength: number;
  isSaved: boolean;
  isActive: boolean;
  status: string;
  draftScript: string;
  draftMovement: string;
  aspectRatio: string;
  onPreviewImage: (src: string) => void;
  onSave: () => void;
  onAngle: () => void;
  onEdit: () => void;
  onRegenerate: (genId: number, sceneId: string) => void;
  onDelete: () => void;
  onUndo: () => void;
  onVariantChange: (dir: "next" | "prev") => void;
  onStopScene: () => void;
  onToggleVideoCreator: () => void;
  onUpdateDraft: (updates: any) => void;
  onGenerateVideo: (
    script: string,
    movement: string,
    withAudio?: boolean
  ) => void;
  onAddToTimeline: (
    url: string,
    type: "video" | "image",
    duration?: number,
    obj?: any
  ) => void;
  onImportScript: () => void;
  hasScriptToImport: boolean;
  videoModel: string;
  videoResolution: string;
  setVideoModel: (val: string) => void;
  setVideoResolution: (val: string) => void;
  isDisabled: boolean;
  videoCostDisplay: string;
  isMusicVideo: boolean;
  isHistory: boolean;
  isEnhanced?: boolean;
  videoError?: string;
  isConfirmingVideo?: boolean;
  creditBalance: number;
  activeI2ISlot: { genId: number; sceneId: string } | null;
  setActiveI2ISlot: (slot: { genId: number; sceneId: string } | null) => void;
  onGenerateAudioOnly?: (genId: number, sceneId: string) => void;
  onAddAudioToTimeline?: (url: string, duration: number) => void;
  characters: Character[];
}

const formatImageSrc = (src: string) => {
  if (!src) return "";
  if (src.startsWith("data:")) return src;
  const isJpeg = src.startsWith("/9j/");
  return `data:image/${isJpeg ? "jpeg" : "png"};base64,${src}`;
};

export const SceneCard: React.FC<SceneCardProps> = (props) => {
  const { scene, index, isActive, videoState, status, isConfirmingVideo } =
    props;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [displayMode, setDisplayMode] = useState<"image" | number>("image");
  const [isAddedToTimeline, setIsAddedToTimeline] = useState(
    scene?.isAlreadyInTimeline === true
  );
  const [isPortrait, setIsPortrait] = useState(props.aspectRatio === "9:16");
  const [isEnriching, setIsEnriching] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [creditError, setCreditError] = useState(false);
  const [isConfirmingAngle, setIsConfirmingAngle] = useState(false);
  const [angleCreditError, setAngleCreditError] = useState(false);
  const [isAngleLocked, setIsAngleLocked] = useState(false);
  const isVideoLoading = videoState?.status === "loading";

  const [withAudio, setWithAudio] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  // Detect if this card already contains a generated video clip
  const isViewingVideo =
    typeof displayMode === "number" && videoState?.clips?.[displayMode];

  // AUTOMATIC ASPECT DETECTION: Card morphs based on content, not just session settings.
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalHeight > naturalWidth) {
      setIsPortrait(true);
    } else {
      setIsPortrait(false);
    }
  };

  useEffect(() => {
    setWithAudio(props.draftScript.trim().length > 0);
  }, [props.draftScript]);
  useEffect(() => {
    if (
      videoState?.status === "loading" ||
      videoState?.status === "generating"
    ) {
      setIsConfirming(false);
    }
  }, [videoState?.status]);
  useEffect(() => {
    if (!isConfirming) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      if (
        cardRef.current &&
        !cardRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setTimeout(() => {
          setIsConfirming(false);
        }, 150);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isConfirming]);

  useEffect(() => {
    if (!isActive) setDisplayMode("image");
    else if (videoState?.clips?.length > 0)
      setDisplayMode(videoState.clips.length - 1);
  }, [isActive, videoState]);

  const prevClipCount = useRef(videoState?.clips?.length || 0);
  useEffect(() => {
    const currentLength = videoState?.clips?.length || 0;
    if (currentLength > prevClipCount.current)
      setDisplayMode(currentLength - 1);
    prevClipCount.current = currentLength;
  }, [videoState?.clips?.length]);

  const hasVariants = scene.variants && scene.variants.length > 1;
  const currentVariantIndex = scene.selectedVariantIndex || 0;
  const totalVariants = scene.variants ? scene.variants.length : 1;
  const showVideoPlayer =
    typeof displayMode === "number" && videoState?.clips?.[displayMode];
  const currentVideo =
    typeof displayMode === "number" ? videoState?.clips?.[displayMode] : null;

  const originLabel = scene.originSection || "FootageFrontSection";
  const isFromStorybook = originLabel === "StorybookSection";
  const isUploaded = originLabel === "UploadedSection";

  const hasScriptText = props.draftScript.trim().length > 0;
  const voiceCostModifier = withAudio && hasScriptText ? 1 : 0;
  // FIX: Dynamic video credit cost matching Quick Footage logic

  let baseVideoCost = 6;
  let tierShortLabel = "FAST";

  // use videoLength prop if available
  const duration = props.videoLength === 8 ? 8 : 6;

  if (props.videoModel === "veo-3.1-fast-generate-preview") {
    baseVideoCost = duration === 8 ? 8 : 6;
    tierShortLabel = "FAST";
  } else {
    baseVideoCost = duration === 8 ? 16 : 12;
    tierShortLabel = "HD";
  }

  const totalCompoundCost = baseVideoCost + voiceCostModifier;
  const handleDragStart = (e: React.DragEvent) => {
    if (!scene.src) return;

    const formattedSrc = formatImageSrc(scene.src);

    const payload = {
      src: formattedSrc,
      sceneId: scene.sceneId,
      genId: props.genId,
      type: "image"
    };

    e.dataTransfer.setData("application/json", JSON.stringify(payload));

    e.dataTransfer.effectAllowed = "copy";
  };

  const handleAddMediaToTimeline = () => {
    if (status !== "complete") return;
    if (isAddedToTimeline) return;

    if (displayMode === "image") {
      const src = formatImageSrc(scene.src);
      props.onAddToTimeline(src, "image", 5);
    } else if (
      typeof displayMode === "number" &&
      videoState?.clips?.[displayMode]
    ) {
      const clip = videoState.clips[displayMode];
      props.onAddToTimeline(
        clip.videoUrl,
        "video",
        videoRef.current?.duration,
        clip.videoObject
      );
    }

    setIsAddedToTimeline(true);
    scene.isAlreadyInTimeline = true;
  };

  const toggleTier = (e: React.MouseEvent) => {
    e.stopPropagation();

    const nextModel =
      props.videoModel === "veo-3.1-fast-generate-preview"
        ? "veo-3.1-generate-preview"
        : "veo-3.1-fast-generate-preview";

    props.setVideoModel(nextModel);

    setIsConfirming(false);
  };

  const handleEnrich = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!props.draftScript.trim()) return;
    if (isEnriching) return;
    if (props.creditBalance < 1) return;

    setIsEnriching(true);

    try {
      const enriched = await enrichScript(
        props.draftScript,
        props.characters,
        "Cinematic"
      );

      props.onUpdateDraft({ draftScript: enriched });
    } finally {
      setIsEnriching(false);
    }
  };

  const isMinorBlock = scene.error === "BLOCK_MINOR";
  const isExplicitBlock = scene.error === "BLOCK_SAFETY_GENERAL";
  const isAnySafetyBlock = isMinorBlock || isExplicitBlock;

  return (
    <div
      ref={cardRef}
      className={`bg-[#1e293b] rounded-[1.5rem] shadow-2xl overflow-hidden flex flex-col cursor-grab active:cursor-grabbing themed-artline transition-all duration-500 h-fit ${isPortrait ? "min-h-[580px]" : ""} ${scene.isCameraAngleFor !== undefined ? "ring-2 ring-indigo-500" : ""} ${isAnySafetyBlock ? "border-2 border-amber-500/50 animate-pulse-amber" : ""}`}
    >
      <div
        className={`relative ${isPortrait ? "aspect-[9/16]" : "aspect-video"} bg-black rounded-t-[1rem] flex items-center justify-center group overflow-hidden shrink-0`}
      >
        {/* BACKGROUND IMAGE LAYER (STAYS DURING VIDEO PRODUCTION) */}
        {scene.src && (
          <div
            className={`absolute inset-0 z-0 transition-all duration-1000 ${isVideoLoading ? "blur-xl scale-110 opacity-50" : "opacity-100"}`}
          >
            <img
              src={formatImageSrc(scene.src)}
              className="w-full h-full object-cover cursor-grab active:cursor-grabbing"
              draggable={true}
              onLoad={handleImageLoad}
              onDragStart={(e) => {
                const src = scene.src.startsWith("data")
                  ? scene.src
                  : `data:image/png;base64,${scene.src}`;

                const payload = {
                  src,
                  type: "image",
                  sceneId: scene.sceneId
                };

                e.dataTransfer.setData(
                  "application/json",
                  JSON.stringify(payload)
                );

                e.dataTransfer.effectAllowed = "copy";

                console.log("Dragging from SceneCard:", payload);
              }}
            />
          </div>
        )}

        {status === "generating" ? (
          <SceneProgressOverlay
            onStop={props.onStopScene}
            label="Producing visual..."
          />
        ) : isVideoLoading ? (
          <SceneProgressOverlay
            onStop={props.onStopScene}
            label={videoState?.loadingMessage || "Rendering clip..."}
          />
        ) : status === "pending" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/50 backdrop-blur-sm m-2 rounded-lg border border-gray-700/50">
            <div className="relative z-10 flex flex-col items-center opacity-40">
              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mb-2">
                <SparklesIcon className="w-5 h-5 text-gray-500" />
              </div>
              <span className="px-2 py-0.5 rounded text-[9px] font-bold text-gray-400 tracking-widest">
                Queued
              </span>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 z-10 w-full h-full flex items-center justify-center">
            {showVideoPlayer && currentVideo ? (
              <div className="w-full h-full relative group/video">
                <video
                  ref={videoRef}
                  src={currentVideo.videoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full object-contain"
                />
                <button
                  onClick={() =>
                    props.onAddToTimeline(
                      currentVideo.videoUrl,
                      "video",
                      videoRef.current?.duration,
                      currentVideo.videoObject
                    )
                  }
                  className="absolute top-2 right-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg shadow-xl opacity-100 md:opacity-0 md:group-hover/video:opacity-100 transition-opacity z-20 flex items-center gap-1"
                >
                  Add to timeline
                </button>
              </div>
            ) : scene.src ? (
              <div className="w-full h-full relative">
                <div
                  className="w-full h-full cursor-zoom-in"
                  onClick={() =>
                    props.onPreviewImage(formatImageSrc(scene.src))
                  }
                >
                  <img
                    src={formatImageSrc(scene.src)}
                    className="w-full h-full object-cover"
                    draggable={false}
                    onLoad={handleImageLoad}
                  />
                </div>
                {hasVariants && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onVariantChange("prev");
                      }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/60 text-white rounded-full hover:bg-indigo-600 transition-colors z-20"
                    >
                      <ChevronLeftIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onVariantChange("next");
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/60 text-white rounded-full hover:bg-indigo-600 transition-colors z-20"
                    >
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 px-2 py-0.5 rounded-full text-[9px] text-white font-bold pointer-events-none">
                      {currentVariantIndex + 1} / {totalVariants}
                    </div>
                  </>
                )}
                {scene.src && status === "complete" && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                    <a
                      href={formatImageSrc(scene.src)}
                      download={`scene_${index}.png`}
                      className="p-1.5 bg-black/60 text-white rounded-lg hover:bg-indigo-600 pointer-events-auto shadow-lg"
                    >
                      <DownloadIcon className="w-4 h-4" />
                    </a>
                  </div>
                )}
                {scene.prompt && (
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
                    <p className="text-[9px] font-black text-white  tracking-widest line-clamp-1 drop-shadow-md opacity-90">
                      {scene.prompt}
                    </p>
                  </div>
                )}
              </div>
            ) : isAnySafetyBlock ? (
              <div className="absolute inset-0 bg-amber-950/20 backdrop-blur-sm p-6 flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
                <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mb-4 border border-amber-500/30">
                  <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />
                </div>
                <h4 className="text-[10px] font-black text-amber-500  tracking-[0.2em] mb-2 leading-none">
                  {isMinorBlock
                    ? "Production Advisory: Minor Detected"
                    : "Content Rejected: Explicit"}
                </h4>
                <p className="text-[9px] font-bold text-amber-400/70 leading-relaxed max-w-xs mb-5">
                  {isMinorBlock
                    ? "This studio does not support the generation of children. Please redescribe the character as an adult to continue production."
                    : "Descriptions violating safety standards for explicit content are purged. Please adhere to production guidelines."}
                </p>
                <button
                  onClick={() => props.onDelete()}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-black text-[9px] font-black  tracking-widest rounded-lg transition-all shadow-xl active:scale-95"
                >
                  Reset Card
                </button>
              </div>
            ) : (
              <div className="text-center text-red-400 p-4 font-bold text-[10px] tracking-widest leading-relaxed">
                <ExclamationTriangleIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />{" "}
                Signal Lost
              </div>
            )}
          </div>
        )}
      </div>

      <div
        className={`p-4 bg-[#111827] flex-1 flex flex-col justify-between rounded-b-[1rem] ${isActive ? "hidden" : "flex"}`}
      >
        <div className="flex justify-between items-start mb-4">
          <span className="px-2.5 py-1 bg-indigo-600/30 text-indigo-100 rounded-lg text-[10px] font-black tracking-wider border border-indigo-500/40">
            {isFromStorybook ? `SCENE ${index + 1}` : `CLIP ${index + 1}`}
            {scene.angleName ? ` | ${scene.angleName}` : ""}
          </span>
          <div className="flex gap-1">
            {(status === "complete" || (status === "error" && scene.src)) && (
              <>
                {scene.previousSrc && (
                  <button
                    onClick={props.onUndo}
                    className="p-1.5 text-gray-100 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    title="Undo"
                  >
                    <UndoIcon className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={props.onSave}
                  className={`p-1.5 rounded-lg hover:bg-gray-700 transition-colors ${props.isSaved ? "text-indigo-400" : "text-gray-100 hover:text-white"}`}
                  title="Save"
                >
                  <BookmarkIcon className="w-4 h-4" solid={props.isSaved} />
                </button>
                <button
                  onClick={props.onAngle}
                  className="p-1.5 text-gray-100 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Camera Angles"
                >
                  <CameraIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    props.onEdit();
                  }}
                  className="p-1.5 text-gray-100 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Edit Canvas"
                >
                  <SparklesIcon className="w-4 h-4" />
                </button>
              </>
            )}
            {(status === "complete" || status === "error") &&
              !isUploaded &&
              !isAnySafetyBlock && (
                <button
                  onClick={async () => {
                    // DO add comment: Fixed Credit Key. Changed "IMAGE_REGEN" to "IMAGE_NORMAL" to enable the regeneration functionality.
                    const ok = await props.consumeCredits("IMAGE_NORMAL");
                    if (!ok) return;

                    props.onRegenerate(props.genId, scene.sceneId);
                  }}
                  className="p-1.5 text-gray-100 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Regenerate Image"
                >
                  <RefreshIcon className="w-4 h-4" />
                </button>
              )}
            <button
              onClick={props.onDelete}
              className="p-1.5 text-gray-100 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
              title="Remove Card"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className={`flex gap-2 ${isPortrait ? "flex-col" : "mt-0"}`}>
          <button
            disabled={status !== "complete" || isAddedToTimeline}
            onClick={handleAddMediaToTimeline}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[10px] font-black tracking-widest transition-all shadow-inner rounded-xl disabled:opacity-30 ${isAddedToTimeline ? "bg-green-600 text-white" : "bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/20"}`}
          >
            {isAddedToTimeline ? (
              <CheckIcon className="w-4 h-4" />
            ) : (
              <PlusIcon className="w-4 h-4" />
            )}

            {isAddedToTimeline ? "Added to Timeline" : "Add to Timeline"}
          </button>
          {!isViewingVideo && (
            <button
              onClick={props.onToggleVideoCreator}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 text-[10px] font-black tracking-widest transition-all bg-gray-800 text-gray-200 hover:bg-indigo-600 hover:text-white border border-white/5 shadow-inner rounded-xl group"
            >
              <VideoIcon className="w-4 h-4" /> Motion
            </button>
          )}
        </div>
      </div>

      {(status === "complete" || (status === "error" && scene.src)) &&
        !isAnySafetyBlock &&
        isActive &&
        !isViewingVideo && (
          <div className="p-4 bg-gray-900/50 space-y-4 animate-in slide-in-from-top-4 relative z-50 border-t border-white/5 rounded-b-[1rem] flex-1 flex flex-col justify-start overflow-y-auto scrollbar-none">
            {props.videoError && (
              <div className="p-2 bg-red-900/30 border border-red-800 rounded flex items-start gap-2 animate-in shake duration-300">
                <ExclamationTriangleIcon className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-[10px] text-red-300 text-left leading-tight font-bold">
                  {props.videoError}
                </p>
              </div>
            )}

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none shrink-0">
              <button
                onClick={() => setDisplayMode("image")}
                className={`shrink-0 w-14 h-11 rounded-lg border overflow-hidden transition-all ${displayMode === "image" ? "border-indigo-500 ring-2 ring-indigo-500/50 opacity-100 shadow-lg" : "border-gray-700 opacity-60 hover:opacity-100 hover:bg-gray-700"}`}
              >
                {scene.src ? (
                  <img
                    src={formatImageSrc(scene.src)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-black flex items-center justify-center">
                    <PhotoIcon className="w-4 h-4 text-gray-700" />
                  </div>
                )}
              </button>
              {videoState?.clips?.map((clip: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setDisplayMode(idx)}
                  className={`shrink-0 w-14 h-11 rounded-lg border overflow-hidden transition-all bg-black ${displayMode === idx ? "border-indigo-500 ring-2 ring-indigo-500/50 opacity-100 shadow-lg" : "border-gray-700 opacity-60 hover:opacity-100 hover:bg-gray-700"}`}
                >
                  <div className="relative w-full h-full">
                    <video
                      src={clip.videoUrl}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <PlayIcon className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-1.5 flex-1 min-h-0">
              <div className="flex justify-between items-center px-0.5">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-black text-gray-200 tracking-[0.2em]">
                    The Narrative
                  </label>
                  <button
                    onClick={() => setWithAudio(!withAudio)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${withAudio ? "bg-indigo-600/40 border-indigo-500 text-indigo-100 shadow-lg" : "bg-gray-800 border-gray-700 text-gray-400"}`}
                  >
                    <SparklesIcon
                      className={`w-3.5 h-3.5 ${props.draftScript.trim() ? "text-indigo-400" : "text-gray-600"}`}
                    />
                  </button>
                  <label className="text-[10px] font-black text-gray-200 tracking-[0.2em]">
                    The Narrative
                  </label>

                  {props.hasScriptToImport && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onImportScript();
                      }}
                      className="px-2 py-1 text-[8px] font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow transition-all"
                    >
                      Import Narrative
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setWithAudio(!withAudio)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[8px] font-bold ${withAudio ? "bg-indigo-600/40 border-indigo-500 text-indigo-100" : "bg-gray-800 border-gray-700 text-gray-400"}`}
                >
                  <SpeakerWaveIcon
                    className={`w-3 h-3 ${withAudio && hasScriptText ? "animate-pulse" : ""}`}
                  />{" "}
                  AI Voice
                </button>
              </div>
              <div className="relative group">
                <textarea
                  value={props.draftScript}
                  onChange={(e) =>
                    props.onUpdateDraft({ draftScript: e.target.value })
                  }
                  placeholder="Describe action..."
                  className="w-full bg-black/30 border border-gray-600 rounded-xl p-3 text-[11px] text-white h-20 outline-none resize-none relative z-10"
                />
                {!props.draftScript && (
                  <div className="absolute top-3 left-3 text-[11px] text-gray-700 pointer-events-none z-0 italic">
                    Start with Name: Dialogue...
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-end gap-1.5 shrink-0">
              <div className="flex-1">
                <label className="text-[9px] font-bold text-gray-300 mb-0.5 block tracking-widest px-1 ">
                  Camera Movement
                </label>
                <div className="relative">
                  <select
                    value={props.draftMovement}
                    onChange={(e) =>
                      props.onUpdateDraft({
                        draftCameraMovement: e.target.value
                      })
                    }
                    className="w-full bg-black/30 border border-gray-600 rounded-xl px-3 text-[10px] font-black text-gray-100 focus:border-indigo-500 appearance-none h-10 outline-none shadow-sm cursor-pointer hover:bg-black/40"
                  >
                    {Object.keys(CAMERA_MOVEMENT_PROMPTS).map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-80">
                    <ChevronDownIcon className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4 shrink-0">
              <button
                ref={buttonRef}
                onClick={async (e) => {
                  e.stopPropagation();
                  e.preventDefault();

                  if (isVideoLoading) return;

                  if (!isConfirming) {
                    setCreditError(false);
                    setIsConfirming(true);
                    return;
                  }

                  const action =
                    props.videoModel === "veo-3.1-fast-generate-preview"
                      ? "VIDEO_FAST_6S"
                      : "VIDEO_HQ_6S";

                  let success = false;

                  try {
                    success = await props.consumeCredits(action);
                  } catch {
                    success = false;
                  }

                  if (!success) {
                    setCreditError(true);
                    return;
                  }

                  setCreditError(false);

                  props.onGenerateVideo(
                    props.draftScript,
                    props.draftMovement,
                    withAudio
                  );

                  setIsConfirming(false);
                }}
                disabled={props.isDisabled || isVideoLoading}
                className={`flex-1 h-12 font-black tracking-widest rounded-xl transition-all active:scale-95 flex items-center justify-center border shadow-xl overflow-hidden
  ${
    creditError
      ? "bg-red-600 text-white border-red-500 animate-pulse"
      : isConfirming
        ? "bg-green-600 text-white border-green-500"
        : "bg-indigo-600 text-white hover:bg-indigo-500 border-indigo-400"
  }`}
              >
                {isVideoLoading ? (
                  <LoaderIcon className="w-5 h-5 animate-spin" />
                ) : creditError ? (
                  <span className="text-[11px] font-black uppercase">
                    Insufficient credit
                  </span>
                ) : (
                  <>
                    <div className="flex-1 flex items-center justify-center gap-2 pl-4">
                      {isConfirming ? (
                        <span className="text-[12px] font-black uppercase">
                          Confirm
                        </span>
                      ) : (
                        <>
                          <ClapperboardIcon className="w-4 h-4" />
                          <span className="text-[11px] uppercase">Produce</span>
                        </>
                      )}
                    </div>

                    <div
                      onClick={(e) => toggleTier(e)}
                      className={`h-full flex items-center transition-all cursor-pointer border-l border-white/10 px-4
        ${isConfirming ? "bg-black/40" : "bg-black/20 hover:bg-black/40"}`}
                    >
                      <div className="flex flex-col items-center justify-center leading-none">
                        <span className="text-[10px] font-black">
                          {tierShortLabel}
                        </span>

                        <span className="text-[11px] font-black text-sky-400">
                          {totalCompoundCost}C
                        </span>
                      </div>

                      <ArrowsRightLeftIcon className="w-3 h-3 opacity-40 ml-2" />
                    </div>
                  </>
                )}
              </button>
              <button
                onClick={props.onToggleVideoCreator}
                className="px-5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors shadow-xl rounded-xl border border-white/5 active:scale-90"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
    </div>
  );
};;;
