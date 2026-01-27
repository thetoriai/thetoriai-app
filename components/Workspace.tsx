import React, { useRef, useState, useEffect } from "react";
import {
  DownloadIcon,
  RefreshIcon,
  BookmarkIcon,
  CameraIcon,
  SparklesIcon,
  VideoIcon,
  TrashIcon,
  PlusIcon,
  UploadIcon,
  ClapperboardIcon,
  XIcon,
  ExclamationTriangleIcon,
  StopIcon,
  UndoIcon,
  CircularProgressIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PhotoIcon,
  FilmIcon,
  PlayIcon
} from "./Icons";
import { CAMERA_MOVEMENT_PROMPTS } from "../services/geminiService";

interface WorkspaceProps {
  generationItem: any;
  savedItems: any[];
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
    cameraMovement?: string
  ) => void;
  // Redundant onToggleVideoCreator removed as it matched onOpenVideoCreator usage
  onAddToTimeline: (videoUrl: string, videoObject?: any) => void;
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
  onUploadToSession?: (file: File) => void;
  storybook?: any;
  onNavigateHistory: (direction: number) => void;
  historyIndex: number;
  totalHistoryItems: number;
  currency: "USD" | "SEK";
  exchangeRate: number;
  onCloseSession?: () => void;
  history: any[];
  onSwitchSession: (index: number, sceneId?: string, restore?: boolean) => void;
  onNewSession: () => void;
  onUpdateVideoDraft: (genId: number, sceneId: string, updates: any) => void;
  creditBalance: number;
  onStopScene?: (genId: number, sceneId: string) => void;
  onUndoEdit?: (genId: number, sceneId: string) => void;
  onSceneVariantChange?: (
    genId: number,
    sceneId: string,
    direction: "next" | "prev"
  ) => void;
}

const SceneProgressOverlay: React.FC<{
  onStop: () => void;
  label?: string;
}> = ({ onStop, label = "Generating..." }) => {
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
        <StopIcon className="w-3 h-3" /> CANCEL
      </button>
    </div>
  );
};

interface SceneCardProps {
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
  onRegenerate: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onVariantChange: (dir: "next" | "prev") => void;
  onStopScene: () => void;
  onToggleVideoCreator: () => void;
  onUpdateDraft: (updates: any) => void;
  onGenerateVideo: (script: string, movement: string) => void;
  onAddToTimeline: (url: string, obj: any) => void;
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
  videoError?: string;
  isConfirmingVideo: boolean;
}

const SceneCard: React.FC<SceneCardProps> = (props) => {
  const { scene, index, isActive, videoState, status } = props;
  const [displayMode, setDisplayMode] = useState<"image" | number>("image");
  const isVideoLoading = videoState?.status === "loading";
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

  return (
    <div
      className={`bg-gray-800 rounded-lg shadow-lg overflow-hidden flex flex-col ${scene.isCameraAngleFor !== undefined ? "border-l-4 border-indigo-500" : ""}`}
    >
      <div className="relative aspect-video bg-gray-900 flex items-center justify-center group overflow-hidden">
        {status === "generating" ? (
          <SceneProgressOverlay
            onStop={props.onStopScene}
            label="Generating Image..."
          />
        ) : isVideoLoading ? (
          <SceneProgressOverlay
            onStop={props.onStopScene}
            label={videoState?.loadingMessage || "Rendering Video..."}
          />
        ) : status === "pending" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/50 backdrop-blur-sm m-2 rounded-lg border border-gray-700/50">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800/10 to-gray-900/10 backdrop-blur-[2px]"></div>
            <div className="relative z-10 flex flex-col items-center opacity-60">
              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mb-2">
                <SparklesIcon className="w-5 h-5 text-gray-500" />
              </div>
              <span className="px-2 py-0.5 bg-gray-900/60 rounded text-[9px] font-bold text-gray-400 border border-gray-700/50">
                Waiting in Queue
              </span>
            </div>
          </div>
        ) : (
          <>
            {showVideoPlayer && currentVideo ? (
              <div className="w-full h-full relative group/video">
                <video
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
                      currentVideo.videoObject
                    )
                  }
                  className="absolute top-2 right-2 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded shadow-md opacity-0 group-hover/video:opacity-100 transition-opacity z-20 flex items-center gap-1"
                >
                  <PlusIcon className="w-3 h-3" /> Add to timeline
                </button>
              </div>
            ) : scene.src ? (
              <div className="w-full h-full relative">
                <div
                  className="w-full h-full cursor-zoom-in"
                  onClick={() =>
                    props.onPreviewImage(`data:image/png;base64,${scene.src}`)
                  }
                  title="Click to zoom"
                >
                  <img
                    src={`data:image/png;base64,${scene.src}`}
                    className="w-full h-full object-contain"
                  />
                </div>
                {hasVariants && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onVariantChange("prev");
                      }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/60 text-white rounded-full hover:bg-indigo-600 transition-colors z-20"
                    >
                      <ChevronLeftIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onVariantChange("next");
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/60 text-white rounded-full hover:bg-indigo-600 transition-colors z-20"
                    >
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 px-2 py-0.5 rounded-full text-[9px] text-white font-bold pointer-events-none">
                      {currentVariantIndex + 1} / {totalVariants}
                    </div>
                  </>
                )}
                {scene.src && status === "complete" && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                    <a
                      href={`data:image/png;base64,${scene.src}`}
                      download={`scene_${index}.png`}
                      className="p-1 bg-black/60 text-white rounded hover:bg-indigo-600 pointer-events-auto"
                    >
                      <DownloadIcon className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-red-400 p-4">
                <ExclamationTriangleIcon className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold">{scene.error || "Failed"}</p>
              </div>
            )}
            {status === "error" && scene.src && (
              <div className="absolute top-0 left-0 right-0 bg-red-900/90 text-white text-[10px] font-bold p-1.5 text-center flex items-center justify-center gap-1 animate-in slide-in-from-top-full">
                <ExclamationTriangleIcon className="w-3 h-3" />{" "}
                {scene.error || "Error"}
              </div>
            )}
          </>
        )}
      </div>

      <div
        className={`p-3 bg-gray-800 relative z-10 transition-all duration-300 ${isActive ? "h-0 py-0 overflow-hidden opacity-0 invisible" : "h-auto opacity-100"}`}
      >
        <div className="flex justify-between items-start mb-2">
          {scene.prompt !== "Image Load Section" &&
          scene.prompt !== "Uploaded Image" ? (
            <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-[10px] font-bold rounded uppercase">
              {scene.angleName || `Scene ${index + 1}`}
            </span>
          ) : (
            <div></div>
          )}
          <div className="flex gap-1">
            {(status === "complete" || (status === "error" && scene.src)) && (
              <>
                {scene.previousSrc && (
                  <button
                    onClick={props.onUndo}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-600 rounded"
                    title="Undo Edit"
                  >
                    <UndoIcon className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={props.onSave}
                  className={`p-1.5 rounded hover:bg-gray-600 ${props.isSaved ? "text-indigo-400" : "text-gray-400"}`}
                  title="Save"
                >
                  <BookmarkIcon className="w-4 h-4" solid={props.isSaved} />
                </button>
                <button
                  onClick={props.onAngle}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-600 rounded"
                  title="Camera"
                >
                  <CameraIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={props.onEdit}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-600 rounded"
                  title="Edit"
                >
                  <SparklesIcon className="w-4 h-4" />
                </button>
              </>
            )}
            {(status === "complete" || status === "error") && (
              <button
                onClick={props.onRegenerate}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-600 rounded"
                title="Regenerate"
              >
                <RefreshIcon className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={props.onDelete}
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded ml-1"
              title="Delete"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {(status === "complete" || (status === "error" && scene.src)) && (
        <div className="bg-gray-800 border-t border-gray-700">
          {isActive ? (
            <div className="p-3 bg-gray-900/50 space-y-3 animate-in slide-in-from-top-4 duration-300">
              {props.videoError && (
                <div className="p-2 bg-red-900/30 border border-red-800 rounded flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                  <ExclamationTriangleIcon className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-[10px] text-red-300 text-left leading-tight">
                    {props.videoError}
                  </p>
                </div>
              )}
              {videoState?.status === "error" && !props.videoError && (
                <p className="text-[9px] text-red-400 text-center bg-red-900/20 p-1 rounded">
                  {videoState.error}
                </p>
              )}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                <button
                  onClick={() => setDisplayMode("image")}
                  className={`shrink-0 w-12 h-10 rounded border overflow-hidden flex items-center justify-center transition-all ${displayMode === "image" ? "border-indigo-500 ring-2 ring-indigo-500/50 opacity-100" : "border-gray-600 opacity-60 hover:opacity-100"}`}
                  title="View Source Image"
                >
                  <img
                    src={`data:image/png;base64,${scene.src}`}
                    className="w-full h-full object-cover"
                  />
                </button>
                {videoState?.clips?.map((clip: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setDisplayMode(idx)}
                    className={`shrink-0 w-12 h-10 rounded border overflow-hidden flex items-center justify-center transition-all bg-black ${displayMode === idx ? "border-indigo-500 ring-2 ring-indigo-500/50 opacity-100" : "border-gray-600 opacity-60 hover:opacity-100"}`}
                    title={`View Clip ${idx + 1}`}
                  >
                    <div className="relative w-full h-full">
                      <video
                        src={clip.videoUrl}
                        className="w-full h-full object-cover pointer-events-none"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <PlayIcon className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  </button>
                ))}
                {(!videoState?.clips || videoState.clips.length === 0) && (
                  <div className="h-10 px-2 flex items-center justify-center text-[9px] text-gray-500 italic border border-dashed border-gray-700 rounded">
                    No videos
                  </div>
                )}
              </div>
              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">
                    {props.isMusicVideo
                      ? "Director's Notes"
                      : props.isHistory
                        ? "Narration"
                        : "Narrator/Dialogue"}
                  </label>
                  {props.hasScriptToImport && (
                    <button
                      onClick={props.onImportScript}
                      className="flex items-center gap-1 text-[8px] text-indigo-400 hover:text-indigo-300 font-bold"
                    >
                      <SparklesIcon className="w-2.5 h-2.5" /> Import
                    </button>
                  )}
                </div>
                <textarea
                  value={props.draftScript}
                  onChange={(e) =>
                    props.onUpdateDraft({ draftScript: e.target.value })
                  }
                  placeholder={
                    props.isMusicVideo ? "e.g. Pan left..." : "Narrator:..."
                  }
                  className="w-full bg-black/30 border border-gray-600 rounded p-1.5 text-[10px] text-gray-200 focus:outline-none focus:border-indigo-500 resize-none h-10"
                />
              </div>
              <div className="flex items-end gap-1.5">
                <div className="flex-1 min-w-0">
                  <label className="text-[8px] font-bold text-gray-500 uppercase mb-0.5 block">
                    Camera
                  </label>
                  <div className="relative">
                    <select
                      value={props.draftMovement}
                      onChange={(e) =>
                        props.onUpdateDraft({
                          draftCameraMovement: e.target.value
                        })
                      }
                      className="w-full bg-black/30 border border-gray-600 rounded p-1 pr-5 text-[10px] text-gray-200 focus:outline-none focus:border-indigo-500 appearance-none truncate h-7"
                    >
                      {Object.keys(CAMERA_MOVEMENT_PROMPTS).map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                    <ClapperboardIcon className="w-2.5 h-2.5 text-gray-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <div className="flex flex-col">
                    <label className="text-[8px] font-bold text-gray-500 uppercase mb-0.5 block">
                      Model
                    </label>
                    <select
                      value={props.videoModel}
                      onChange={(e) => props.setVideoModel(e.target.value)}
                      className="h-7 bg-black/30 text-[10px] text-gray-400 hover:text-white border border-gray-700 rounded px-1 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="veo-3.1-fast-generate-preview">
                        Veo Fast
                      </option>
                      <option value="veo-3.1-generate-preview">Veo HQ</option>
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[8px] font-bold text-gray-500 uppercase mb-0.5 block">
                      Res
                    </label>
                    <select
                      value={props.videoResolution}
                      onChange={(e) => props.setVideoResolution(e.target.value)}
                      className="h-7 bg-black/30 text-[10px] text-gray-400 hover:text-white border border-gray-700 rounded px-1 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="720p">720p</option>
                      <option value="1080p">1080p</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex bg-gray-700/50 rounded overflow-hidden mt-3">
                <button
                  onClick={() =>
                    props.onGenerateVideo(
                      props.draftScript,
                      props.draftMovement
                    )
                  }
                  disabled={props.isDisabled || isVideoLoading}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition-all text-white ${props.isConfirmingVideo ? "bg-green-600 hover:bg-green-500" : "bg-indigo-600 hover:bg-indigo-500"}`}
                >
                  {isVideoLoading ? (
                    "Processing..."
                  ) : props.isConfirmingVideo ? (
                    `Confirm (${props.videoCostDisplay})`
                  ) : (
                    <>
                      <ClapperboardIcon className="w-4 h-4" /> Generate Clip
                    </>
                  )}
                </button>
                <button
                  onClick={props.onToggleVideoCreator}
                  className="px-4 bg-gray-700 hover:bg-gray-600 border-l border-gray-600 text-gray-400 hover:text-white transition-colors"
                  title="Close Creator"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={props.onToggleVideoCreator}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold transition-all bg-gray-800 text-gray-300 hover:bg-gray-700"
            >
              <VideoIcon className="w-4 h-4" /> Create Video
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const Workspace = React.memo(
  (props: WorkspaceProps) => {
    const { generationItem, savedItems, history } = props;
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const addImageInputRef = useRef<HTMLInputElement>(null);
    const [videoErrors, setVideoErrors] = useState<{ [key: string]: string }>(
      {}
    );
    const [confirmingVideoSceneId, setConfirmingVideoSceneId] = useState<
      string | null
    >(null);

    const handleImportScript = (idx: number, sceneId: string) => {
      if (props.storybook?.scenes && props.storybook.scenes[idx])
        props.onUpdateVideoDraft(generationItem.id, sceneId, {
          draftScript: props.storybook.scenes[idx].script || ""
        });
    };

    const handleVideoGenerateClick = (
      genId: number,
      sceneId: string,
      script: string,
      movement: string
    ) => {
      if (props.creditBalance < 10) {
        setVideoErrors((prev) => ({
          ...prev,
          [sceneId]: `Insufficient credits. Required: 10 Credits.`
        }));
        return;
      }
      if (confirmingVideoSceneId !== sceneId) {
        setConfirmingVideoSceneId(sceneId);
        setVideoErrors((prev) => {
          const next = { ...prev };
          delete next[sceneId];
          return next;
        });
        return;
      }
      setConfirmingVideoSceneId(null);
      props.onGenerateVideo(genId, sceneId, script, movement);
    };

    const videoCostDisplay = "10 Credits";
    const openSessions = history
      ? history
          .map((h, i) => ({ ...h, originalIndex: i }))
          .filter((h) => !h.isClosed)
      : [];
    const hasActiveUploadSession = history
      ? history.some((h) => !h.isClosed && h.type === "upload")
      : false;
    const isCurrentSessionUpload = generationItem?.type === "upload";
    const isMusicVideo = generationItem?.genre === "Music Video";
    const isHistory = generationItem?.genre === "History";

    const renderTabBar = () => (
      <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-2 scrollbar-thin scrollbar-thumb-gray-700">
        {openSessions.map((session) => (
          <div
            key={session.id}
            onClick={() => props.onSwitchSession(session.originalIndex)}
            className={`group flex items-center gap-2 px-3 py-2 rounded-t-lg cursor-pointer border-t border-l border-r border-transparent min-w-[120px] max-w-[200px] animate-in fade-in zoom-in-95 duration-300 ${props.historyIndex === session.originalIndex ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-900/50 hover:bg-gray-800/80 text-gray-400 hover:text-gray-300"}`}
          >
            <span className="text-xs font-bold truncate flex-1">
              {session.prompt || "Untitled Session"}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (
                  props.historyIndex === session.originalIndex &&
                  props.onCloseSession
                )
                  props.onCloseSession();
                else props.onSwitchSession(session.originalIndex);
              }}
              className={`p-0.5 rounded-full hover:bg-red-900/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ${props.historyIndex === session.originalIndex ? "opacity-100" : ""}`}
            >
              <XIcon className="w-3 h-3" />
            </button>
          </div>
        ))}
        {!hasActiveUploadSession && (
          <button
            onClick={props.onNewSession}
            className={`flex items-center justify-center w-8 h-8 rounded hover:bg-gray-800 transition-colors ${props.historyIndex === -1 ? "bg-gray-800 text-white" : "text-gray-500"}`}
            title="New Session"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    );

    if (
      !generationItem ||
      generationItem.isClosed ||
      props.historyIndex === -1
    ) {
      return (
        <div className="flex-1 flex flex-col h-full relative">
          <div className="px-4 pt-2 border-b border-gray-800">
            {renderTabBar()}
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 p-8 pb-32">
            <div className="p-6 bg-gray-800 rounded-full mb-6 border border-gray-700 shadow-xl">
              <SparklesIcon className="w-16 h-16 text-indigo-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-300 mb-2">
              Start Creating
            </h2>
            <p className="max-w-md text-sm mb-8 text-gray-400">
              Use the sidebar to describe your scenes, or upload an image to
              start working immediately.
            </p>
            {props.onUploadStartImage && (
              <div className="flex flex-col items-center">
                <button
                  onClick={() => uploadInputRef.current?.click()}
                  className="flex flex-col items-center justify-center w-64 h-40 bg-gray-800 border-2 border-dashed border-gray-700 hover:border-indigo-500 rounded-xl group transition-all"
                >
                  <UploadIcon className="w-8 h-8 text-gray-500 group-hover:text-indigo-400 mb-2 transition-colors" />
                  <span className="text-sm font-bold text-gray-400 group-hover:text-white">
                    Upload Image to Start
                  </span>
                  <span className="text-[10px] text-gray-600 mt-1">
                    Supports PNG, JPG
                  </span>
                </button>
                <input
                  type="file"
                  ref={uploadInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      props.onUploadStartImage!(e.target.files[0]);
                      e.target.value = "";
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="px-4 pt-2 border-b border-gray-800 shrink-0">
          {renderTabBar()}
        </div>
        <div className="flex-1 p-6 overflow-y-auto pb-40">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1 mr-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Storyboard</h2>
                {isMusicVideo && (
                  <span className="px-2 py-0.5 bg-indigo-900 text-indigo-200 text-[10px] uppercase font-bold rounded border border-indigo-700">
                    Music Video Mode
                  </span>
                )}
                {isHistory && (
                  <span className="px-2 py-0.5 bg-amber-900 text-amber-200 text-[10px] uppercase font-bold rounded border border-amber-700">
                    History Mode
                  </span>
                )}
              </div>
              {generationItem.prompt !== "Image Load Section" && (
                <p className="text-xs text-gray-400 mt-1 max-w-lg truncate">
                  {generationItem.prompt}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {props.onUploadToSession && isCurrentSessionUpload && (
                <>
                  <button
                    onClick={() => addImageInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded hover:border-indigo-500 hover:text-indigo-400 text-gray-300 text-xs font-bold transition-all mr-2"
                    title="Add an image to this session"
                  >
                    <UploadIcon className="w-4 h-4" /> Add Image
                  </button>
                  <input
                    type="file"
                    ref={addImageInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        props.onUploadToSession!(e.target.files[0]);
                        e.target.value = "";
                      }
                    }}
                  />
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
            {(generationItem.imageSet || []).map(
              (scene: any, index: number) => {
                if (scene.isHidden) return null;
                const sceneId = scene.sceneId || `legacy-${index}`;
                const isSaved = savedItems.some(
                  (i) =>
                    i.id === `${generationItem.id}-${sceneId}` ||
                    (scene.originalSavedId && i.id === scene.originalSavedId)
                );
                const status =
                  scene.status ||
                  (scene.isGenerating || scene.isRegenerating
                    ? "generating"
                    : scene.src
                      ? "complete"
                      : scene.error
                        ? "error"
                        : "pending");
                const videoState = generationItem.videoStates
                  ? generationItem.videoStates[index]
                  : null;
                const isActive = props.activeVideoIndices.includes(index);
                const isConfirmingVideo = confirmingVideoSceneId === sceneId;
                return (
                  <SceneCard
                    key={sceneId}
                    scene={scene}
                    index={index}
                    genId={generationItem.id}
                    videoState={videoState}
                    isSaved={isSaved}
                    isActive={isActive}
                    status={status}
                    draftScript={videoState?.draftScript || ""}
                    draftMovement={
                      videoState?.draftCameraMovement || "Zoom In (Focus In)"
                    }
                    onPreviewImage={props.onPreviewImage}
                    onSave={() => props.onSaveScene(generationItem.id, sceneId)}
                    onAngle={() =>
                      props.onAngleSelect(generationItem.id, sceneId)
                    }
                    onEdit={() => props.onEditScene(generationItem.id, sceneId)}
                    onRegenerate={() =>
                      props.onRegenerateScene(generationItem.id, sceneId)
                    }
                    onDelete={() =>
                      props.onDeleteScene &&
                      props.onDeleteScene(generationItem.id, sceneId)
                    }
                    onUndo={() =>
                      props.onUndoEdit &&
                      props.onUndoEdit(generationItem.id, sceneId)
                    }
                    onVariantChange={(dir) =>
                      props.onSceneVariantChange &&
                      props.onSceneVariantChange(
                        generationItem.id,
                        sceneId,
                        dir
                      )
                    }
                    onStopScene={() =>
                      props.onStopScene &&
                      props.onStopScene(generationItem.id, sceneId)
                    }
                    onToggleVideoCreator={() => props.onOpenVideoCreator(index)}
                    onUpdateDraft={(updates) =>
                      props.onUpdateVideoDraft(
                        generationItem.id,
                        sceneId,
                        updates
                      )
                    }
                    onGenerateVideo={(script, movement) =>
                      handleVideoGenerateClick(
                        generationItem.id,
                        sceneId,
                        script,
                        movement
                      )
                    }
                    onAddToTimeline={props.onAddToTimeline}
                    onImportScript={() => handleImportScript(index, sceneId)}
                    hasScriptToImport={
                      !!(
                        props.storybook?.scenes && props.storybook.scenes[index]
                      )
                    }
                    videoModel={props.videoModel}
                    videoResolution={props.videoResolution || "720p"}
                    setVideoModel={props.setVideoModel}
                    setVideoResolution={props.setVideoResolution}
                    isDisabled={props.isDisabled}
                    videoCostDisplay={videoCostDisplay}
                    isMusicVideo={isMusicVideo}
                    isHistory={isHistory}
                    videoError={videoErrors[sceneId]}
                    isConfirmingVideo={isConfirmingVideo}
                  />
                );
              }
            )}
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.generationItem === next.generationItem &&
      prev.activeVideoIndices === next.activeVideoIndices &&
      prev.isGenerating === next.isGenerating &&
      prev.savedItems === next.savedItems &&
      prev.historyIndex === next.historyIndex &&
      prev.history === next.history &&
      prev.videoResolution === next.videoResolution &&
      prev.videoModel === next.videoModel &&
      prev.creditBalance === next.creditBalance
    );
  }
);
