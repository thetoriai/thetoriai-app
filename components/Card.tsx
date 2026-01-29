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
  SpeakerWaveIcon
} from "./Icons";
import { CAMERA_MOVEMENT_PROMPTS } from "../services/geminiService";
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
        if (prev >= 95) return prev;
        const step = prev < 60 ? 5 : prev < 85 ? 2 : 0.5;
        return prev + step;
      });
    }, 400);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-16 h-16 mb-3 relative flex items-center justify-center">
        <CircularProgressIcon progress={progress} className="w-full h-full" />
      </div>
      <p className="text-xs font-bold text-indigo-300 mb-3 animate-pulse">
        {label}
      </p>
      <button
        onClick={onStop}
        className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/50 rounded-full text-[10px] font-bold transition-colors"
      >
        <StopIcon className="w-3 h-3" /> Cancel
      </button>
    </div>
  );
};

export interface SceneCardProps {
  scene: any;
  index: number;
  genId: number;
  videoState: any;
  isSaved: boolean;
  isActive: boolean;
  status: string;
  draftScript: string;
  draftMovement: string;
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
  onAddToTimeline: (url: string, duration?: number, obj?: any) => void;
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
  isConfirmingVideo: boolean;
  creditBalance: number;
  activeI2ISlot: { genId: number; sceneId: string } | null;
  setActiveI2ISlot: (slot: { genId: number; sceneId: string } | null) => void;
}

const formatImageSrc = (src: string) => {
  if (!src) return "";
  if (src.startsWith("data:")) return src;
  const isJpeg = src.startsWith("/9j/");
  return `data:image/${isJpeg ? "jpeg" : "png"};base64,${src}`;
};

export const SceneCard: React.FC<SceneCardProps> = (props) => {
  const { scene, index, isActive, videoState, status } = props;
  const [displayMode, setDisplayMode] = useState<"image" | number>("image");
  const isVideoLoading = videoState?.status === "loading";

  const [withAudio, setWithAudio] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (props.draftScript.trim().length > 0) setWithAudio(true);
    else setWithAudio(false);
  }, [props.draftScript]);

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
  const baseVideoCost =
    props.videoModel === "veo-3.1-fast-generate-preview" ? 5 : 8;
  const totalCompoundCost = baseVideoCost + voiceCostModifier;

  const handleDragStart = (e: React.DragEvent) => {
    if (scene.src) {
      e.dataTransfer.setData("text/plain", scene.src);
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const isMinorBlock = scene.error === "BLOCK_MINOR";
  const isExplicitBlock = scene.error === "BLOCK_SAFETY_GENERAL";
  const isAnySafetyBlock = isMinorBlock || isExplicitBlock;

  return (
    <div
      draggable={!!scene.src && status === "complete"}
      onDragStart={handleDragStart}
      className={`bg-[#1e293b] rounded-[1.5rem] shadow-2xl overflow-hidden flex flex-col cursor-grab active:cursor-grabbing themed-artline min-h-[420px] ${scene.isCameraAngleFor !== undefined ? "ring-2 ring-indigo-500" : ""} ${isAnySafetyBlock ? "border-2 border-amber-500/50 animate-pulse-amber" : ""}`}
    >
      <div className="relative aspect-video bg-black rounded-t-[1rem] flex items-center justify-center group overflow-hidden shrink-0">
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
          <>
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
          </>
        )}
      </div>

      <div
        className={`p-4 bg-[#111827] flex-1 flex flex-col justify-between rounded-b-[1rem] ${isActive ? "hidden" : "flex"}`}
      >
        <div className="flex justify-between items-start">
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
                  onClick={props.onEdit}
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
                  onClick={() => props.onRegenerate(props.genId, scene.sceneId)}
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

        <button
          onClick={props.onToggleVideoCreator}
          className="w-full flex items-center justify-center gap-2 mt-auto py-3.5 text-[10px] font-black tracking-[0.3em]  transition-all bg-gray-800 text-gray-200 hover:bg-indigo-600 hover:text-white border border-white/5 shadow-inner rounded-xl group"
        >
          <VideoIcon className="w-4 h-4" /> Create Video
        </button>
      </div>

      {(status === "complete" || (status === "error" && scene.src)) &&
        !isAnySafetyBlock &&
        isActive && (
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
                <img
                  src={formatImageSrc(scene.src)}
                  className="w-full h-full object-cover"
                />
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
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-black text-gray-200 tracking-[0.2em] ">
                    {props.isMusicVideo ? "Notes" : "The Story"}
                  </label>
                  {props.hasScriptToImport && !isUploaded && (
                    <button
                      onClick={props.onImportScript}
                      className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-lg hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)] border border-white/10"
                    >
                      <SparklesIcon className="w-3 h-3 text-amber-300" />
                      <span className="text-[8px] font-black ">
                        Magic Script
                      </span>
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setWithAudio(!withAudio)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${withAudio ? "bg-indigo-600/40 border-indigo-500 text-indigo-100 shadow-lg" : "bg-gray-800 border-gray-700 text-gray-400"}`}
                >
                  <SpeakerWaveIcon
                    className={`w-3 h-3 ${withAudio && hasScriptText ? "animate-pulse" : ""}`}
                  />
                  <span className="text-[8px] font-bold">AI Voice</span>
                </button>
              </div>
              <textarea
                value={props.draftScript}
                onChange={(e) =>
                  props.onUpdateDraft({ draftScript: e.target.value })
                }
                placeholder="Type character lines or narrative details here..."
                className="w-full bg-black/30 border border-gray-600 rounded-xl p-3 text-[11px] font-bold text-white placeholder-gray-500 focus:border-indigo-500 outline-none resize-none h-20 shadow-inner leading-relaxed"
              />
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
              {props.isConfirmingVideo && (
                <div className="flex flex-col animate-in slide-in-from-right-1">
                  <label className="text-[9px] font-bold text-indigo-200 mb-0.5 block tracking-widest px-1 ">
                    Engine
                  </label>
                  <select
                    value={props.videoModel}
                    onChange={(e) => props.setVideoModel(e.target.value)}
                    className="h-10 bg-indigo-900/40 text-[10px] font-bold text-indigo-50 border border-indigo-500/50 rounded-xl px-2 outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="veo-3.1-fast-generate-preview">Fast</option>
                    <option value="veo-3.1-generate-preview">HQ-Pro</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4 shrink-0">
              <button
                onClick={() =>
                  props.onGenerateVideo(
                    props.draftScript,
                    props.draftMovement,
                    withAudio
                  )
                }
                disabled={props.isDisabled || isVideoLoading}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-black tracking-[0.2em]  transition-all text-white shadow-xl rounded-xl ${props.isConfirmingVideo ? "bg-green-600 hover:bg-green-700 scale-[1.02]" : "bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-800 disabled:text-gray-600"}`}
              >
                {isVideoLoading ? (
                  "Producing..."
                ) : props.isConfirmingVideo ? (
                  `Confirm (${totalCompoundCost}C)`
                ) : (
                  <>
                    <ClapperboardIcon className="w-4 h-4" /> Produce
                  </>
                )}
              </button>
              <button
                onClick={props.onToggleVideoCreator}
                className="px-5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border-l border-gray-700 transition-colors shadow-xl rounded-xl"
                title="Close Panel"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
    </div>
  );
};
