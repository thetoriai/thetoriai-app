import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  XIcon,
  DownloadIcon,
  CameraIcon,
  UserPlusIcon,
  CreditCardIcon,
  SparklesIcon,
  VideoIcon,
  FilmIcon,
  CheckIcon,
  LoaderIcon,
  GiftIcon,
  PlayIcon,
  ArrowsRightLeftIcon,
  ExclamationTriangleIcon
} from "./Icons";
import { CAMERA_ANGLE_OPTIONS } from "../services/geminiService";
import type { Character, Storybook, Outfit } from "../services/geminiService";
import { ImageEditor } from "./ImageEditor";
import { HistoryPanel } from "./History";
import { StorybookCreator } from "./Storybook";
import { Timeline } from "./Timeline";
import { Storyboard } from "./Storyboard";
import { ActorRoster } from "./ActorRoster";
import {
  PAYPAL_STARTER_LINK,
  PAYPAL_PRO_LINK,
  PAYPAL_STUDIO_LINK
} from "../utils/constants";

interface ModalsProps {
  activeModal: string | null;
  setActiveModal: (modal: string | null) => void;
  modalData: any;
  onClose: () => void;
  onConfirm?: () => void;
  storybookContent: Storybook;
  setStorybookContent: (data: Storybook) => void;
  onGenerateFromStorybook: (scenes: string[]) => void;
  history: any[];
  masterHistory: any[];
  onLoadHistory: (index: number, sceneId?: string, restore?: boolean) => void;
  onDeleteHistory?: (index: number) => void;
  onDeleteHistoryImage?: (sessionId: number, sceneId: string) => void;
  onClearHistory: () => void;
  characters: Character[];
  onEditImage: (
    prompt: string,
    mask?: string,
    style?: string,
    referenceImage?: string | null
  ) => void;
  onEditImageInModal?: (
    genId: number,
    sceneId: string,
    src: string,
    variants: any[]
  ) => void;
  onApplyCameraAngle: (angle: string, subject?: string) => void;
  costPerImage: number;
  currencySymbol: string;
  exchangeRate: number;
  savedItems: any[];
  characterStyle: string;
  selectedCountry: string;
  onToggleSave: (card: any) => void;
  imageModel?: string;
  setImageModel?: (val: string) => void;
  onGenerateSingleStorybookScene?: (index: number, model: string) => void;
  creditBalance?: number;
  onUpdateModalData?: (newData: any) => void;
  isGenerating?: boolean;
  onUpdateImage?: (base64: string) => void;
  onSwapOutfit?: (sceneIndex: number, outfit: Outfit) => Promise<void>;
  onAddAudioToTimeline?: (url: string, duration: number) => void;
  onAddAudioClip?: (
    url: string | File,
    duration?: number,
    startTime?: number
  ) => void;
  // DO add comment: Updated to Promise<boolean> to match async credit consumption in App.tsx
  onDeductAudioCredit?: () => Promise<boolean>;
  onResetStorybook: () => void;
  onUndo?: () => void;
  storySeed: string;
  setStorySeed: (val: string) => void;
  visualStyle?: string;

  timelineClips?: any[];
  audioClips?: any[];
  textClips?: any[];
  onUpdateClips?: (clips: any[]) => void;
  onUpdateAudioClips?: (clips: any[]) => void;
  onUpdateTextClips?: (clips: any[]) => void;
  onUpdateTimelineClip?: (id: string, updates: any) => void;
  onUpdateAudioClip?: (id: string, updates: any) => void;
  onDeleteTimelineClip?: (id: string) => void;
  onDeleteAudio?: (id: string) => void;
  onAddTimelineClip?: (
    url: string | File,
    type: "video" | "image",
    duration?: number,
    startTime?: number,
    layer?: number
  ) => void;
  onAddTextClip?: (text: string, startTime?: number) => void;
  onCaptureFrameFromTimeline?: (base64: string) => void;
  timelinePlaybackTime?: number;
  onUpdateTimelinePlaybackTime?: (time: number) => void;
  onExportTimeline?: () => void;

  generationItem?: any;
  historyIndex?: number;
  activeVideoIndices?: number[];
  onOpenVideoCreator?: (idx: number) => void;
  onGenerateVideo?: (
    genId: number,
    sceneId: string,
    script?: string,
    cameraMovement?: string,
    withAudio?: boolean
  ) => void;
  // DO add comment: Fix onAddToTimeline type signature to include the 'type' parameter for compatibility with SceneCard and App.
  onAddToTimeline?: (
    url: string,
    type: "video" | "image",
    duration?: number,
    videoObject?: any
  ) => void;
  videoModel?: string;
  setVideoModel?: (val: string) => void;
  setVideoResolution?: (val: string) => void;
  onSwitchSession?: (index: number) => void;
  onNewSession?: () => void;
  onUpdateVideoDraft?: (genId: number, sceneId: string, updates: any) => void;
  activeI2ISlot?: { genId: number; sceneId: string } | null;
  setActiveI2ISlot?: (slot: { genId: number; sceneId: string } | null) => void;
  onUploadStartImage?: (file: File) => void;
  onUploadToSession?: (file: File, sessionId: number) => void;
  onDeleteScene?: (genId: number, sceneId: string) => void;
  onUndoEdit?: (genId: number, sceneId: string) => void;
  onRegenerateScene?: (genId: number, sceneId: string) => void;
  onAngleSelect?: (genId: number, sceneId: string) => void;

  setCharacters?: React.Dispatch<React.SetStateAction<Character[]>>;
  handleBuildCharacterVisual?: (id: number) => void;
  handleUploadNewCharacterImage?: (file: File) => void;
  handleCharacterImageUpload?: (file: File, id: number) => void;
  updateCharacter?: (id: number, props: Partial<Character>) => void;
  removeCharacter?: (id: number) => void;
  onToggleHero?: (id: number) => void;

  onAddSceneVariant?: (
    genId: number,
    sceneId: string,
    src: string,
    prompt: string,
    angleName: string
  ) => void;
  onSelectSceneVariant?: (
    genId: number,
    sceneId: string,
    variantIndex: number
  ) => void;
  onSceneVariantChange?: (
    genId: number,
    sceneId: string,
    direction: "next" | "prev"
  ) => void;
  onUpdateSceneImage?: (genId: number, sceneId: string, base64: string) => void;
}

const ModalWrapper = ({
  children,
  title,
  onClose
}: {
  children?: React.ReactNode;
  title: string;
  onClose: () => void;
}) => (
  <div
    className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-2xl p-0 md:p-6"
    onClick={onClose}
  >
    <div
      className="w-full h-full md:max-w-4xl md:max-h-[85vh] bg-[#070b14] md:rounded-[3rem] shadow-[0_0_150px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden border border-white/10 animate-in fade-in zoom-in-[0.98] duration-500 relative"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#0a0f1d] shrink-0 z-10">
        <h2 className="text-[10px] font-black text-gray-500  tracking-[0.4em] ml-4">
          {title}
        </h2>
        <button
          onClick={onClose}
          className="p-2 mr-2 bg-gray-800/50 hover:bg-red-900/30 rounded-full transition-all text-gray-400 hover:text-red-400"
        >
          <XIcon className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 overflow-hidden h-full flex flex-col relative">
        {children}
      </div>
    </div>
  </div>
);

/**
 * PRODUCTION VIDEO RENDER ENGINE v8.0 - ZERO-DELAY START
 * Fixed: 'Black first frame' issue.
 * Added: Pre-warming phase for MediaRecorder and robust composition logic.
 */
const VideoExporter: React.FC<{ clips: any[]; onClose: () => void }> = ({
  clips,
  onClose
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [projectName, setProjectName] = useState("");
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportBlob, setExportBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (clips.length === 0) return;
    setIsExporting(true);
    setError(null);
    setExportBlob(null);
    setExportSuccess(false);
    setProgress(0);

    try {
      // STEP 1: CALCULATE TOTAL TIMELINE DURATION
      const totalDuration = Math.max(
        ...clips.map(
          (c) => (Number(c.startTime) || 0) + (Number(c.duration) || 0)
        ),
        0.1
      );

      // STEP 2: RESOLVE AND PRE-LOAD ALL ASSETS
      const assetMap = new Map<string, HTMLImageElement | HTMLVideoElement>();
      await Promise.all(
        clips.map(async (clip) => {
          const url =
            typeof clip.url !== "string"
              ? URL.createObjectURL(clip.url)
              : clip.url.startsWith("data:") ||
                  clip.url.startsWith("http") ||
                  clip.url.startsWith("blob:")
                ? clip.url
                : `data:image/png;base64,${clip.url}`;

          return new Promise<void>((resolve, reject) => {
            if (clip.type === "video") {
              const v = document.createElement("video");
              v.src = url;
              v.crossOrigin = "anonymous";
              v.muted = true;
              v.playsInline = true;
              v.preload = "auto";
              v.oncanplaythrough = () => {
                assetMap.set(clip.id, v);
                resolve();
              };
              v.onerror = () =>
                reject(new Error("Video load failed: " + clip.id));
              v.load();
            } else {
              const img = new Image();
              img.src = url;
              img.crossOrigin = "anonymous";
              img.onload = () => {
                assetMap.set(clip.id, img);
                resolve();
              };
              img.onerror = () =>
                reject(new Error("Image load failed: " + clip.id));
            }
          });
        })
      );

      // STEP 3: SETUP DUAL-CANVAS SYSTEM
      const compositionCanvas = document.createElement("canvas");
      const captureCanvas = document.createElement("canvas");
      compositionCanvas.width = captureCanvas.width = 1280;
      compositionCanvas.height = captureCanvas.height = 720;

      const compCtx = compositionCanvas.getContext("2d", { alpha: false });
      const captCtx = captureCanvas.getContext("2d", { alpha: false });
      if (!compCtx || !captCtx)
        throw new Error("Hardware acceleration failed.");

      // Helper to render a specific time point to the capture canvas
      const renderFrameToCapture = async (time: number) => {
        compCtx.fillStyle = "black";
        compCtx.fillRect(
          0,
          0,
          compositionCanvas.width,
          compositionCanvas.height
        );

        // Slightly loose filter to avoid frame-skip on zero-boundaries
        const activeClips = clips
          .filter(
            (c) =>
              time >= c.startTime - 0.001 && time < c.startTime + c.duration
          )
          .sort((a, b) => (a.layer || 0) - (b.layer || 0));

        for (const clip of activeClips) {
          const asset = assetMap.get(clip.id);
          if (!asset) continue;

          if (asset instanceof HTMLVideoElement) {
            const localTime = Math.min(
              Math.max(0, time - clip.startTime),
              asset.duration - 0.05
            );
            asset.currentTime = localTime;
            await new Promise((res) => {
              const onSeeked = () => {
                asset.removeEventListener("seeked", onSeeked);
                res(true);
              };
              asset.addEventListener("seeked", onSeeked);
              setTimeout(res, 180);
            });
          }

          const assetW =
            asset instanceof HTMLVideoElement ? asset.videoWidth : asset.width;
          const assetH =
            asset instanceof HTMLVideoElement
              ? asset.videoHeight
              : asset.height;
          const ratio = Math.min(
            compositionCanvas.width / assetW,
            compositionCanvas.height / assetH
          );
          const w = assetW * ratio;
          const h = assetH * ratio;
          const x = (compositionCanvas.width - w) / 2;
          const y = (compositionCanvas.height - h) / 2;
          compCtx.drawImage(asset, x, y, w, h);
        }
        captCtx.drawImage(compositionCanvas, 0, 0);
      };

      // PRE-WARM: Draw the first frame BEFORE capture starts
      await renderFrameToCapture(0);

      const stream = captureCanvas.captureStream(30);
      const supportedTypes = [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4;codecs=h264",
        "video/webm;codecs=vp9",
        "video/webm"
      ];

      let options: MediaRecorderOptions = { videoBitsPerSecond: 12000000 }; // 12Mbps for high fidelity
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          options.mimeType = type;
          break;
        }
      }

      const recorder = new MediaRecorder(stream, options);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const recordingPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () =>
          resolve(new Blob(chunks, { type: options.mimeType || "video/mp4" }));
      });

      // Start recorder and wait for codec initialization
      recorder.start();
      await new Promise((r) => setTimeout(r, 250));

      // STEP 4: TIMELINE FRAME-STEPPER LOOP
      const fps = 30;
      const totalFrames = Math.ceil(totalDuration * fps);

      for (let f = 0; f < totalFrames; f++) {
        const currentTime = f / fps;
        await renderFrameToCapture(currentTime);

        if (f % 10 === 0) {
          setProgress(Math.round((f / totalFrames) * 100));
          await new Promise((r) => requestAnimationFrame(r));
        }
      }

      // Finalizing... Ensure last frame is encoded
      await new Promise((r) => setTimeout(r, 1000));
      recorder.stop();
      const finalBlob = await recordingPromise;
      setExportBlob(finalBlob);
      setExportSuccess(true);
      setIsExporting(false);
      setProgress(100);
    } catch (err: any) {
      console.error("Master Export Failure:", err);
      setError(err.message || "Renderer resource exhaustion.");
      setIsExporting(false);
    }
  }, [clips]);

  const handleSaveToDevice = async () => {
    if (!exportBlob) return;
    const finalTitle = projectName.trim() || `Production_Master_${Date.now()}`;
    const ext = exportBlob.type.includes("mp4") ? "mp4" : "webm";
    const filename = `${finalTitle.replace(/\s+/g, "_")}.${ext}`;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.share && navigator.canShare) {
      const file = new File([exportBlob], filename, { type: exportBlob.type });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: finalTitle });
          return;
        } catch (e) {
          console.warn("Native share dismissed.");
        }
      }
    }

    const url = URL.createObjectURL(exportBlob);
          const link = document.createElement("a");
          link.href = url;
    link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-950">
      <div
        className={`w-24 h-24 rounded-full flex items-center justify-center mb-8 border transition-all shadow-2xl ${exportSuccess ? "bg-green-600/10 border-green-500/20" : "bg-indigo-600/10 border-indigo-500/20"}`}
      >
        {exportSuccess ? (
          <CheckIcon className="w-12 h-12 text-green-500" />
        ) : (
          <FilmIcon className="w-12 h-12 text-indigo-500" />
        )}
      </div>

      <h3 className="text-2xl font-black text-white italic tracking-tighter  mb-6">
        {exportSuccess ? "Master Reel Ready" : "Finalize Production"}
      </h3>

      {exportSuccess ? (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center">
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 max-w-sm">
            <p className="text-green-400 text-sm font-black  tracking-[0.2em] leading-relaxed">
              Success: Your cinematic reel is ready for download.
            </p>
          </div>
          <div className="flex flex-col gap-4 w-full">
            <button
              onClick={handleSaveToDevice}
              className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black  tracking-[0.4em] rounded-[2rem] shadow-[0_20px_50px_rgba(79,70,229,0.3)] transition-all active:scale-95 text-[11px] border border-indigo-400/30 flex items-center justify-center gap-3"
            >
              <DownloadIcon className="w-5 h-5" /> Save Reel to Device
            </button>
          <button
            onClick={onClose}
            className="px-16 py-4 bg-white/5 hover:bg-white/10 text-white font-black  tracking-[0.3em] rounded-2xl transition-all text-[10px] border border-white/5"
          >
              Return to Desk
          </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-gray-500 text-[11px] max-w-md mb-12 font-bold  tracking-widest leading-relaxed">
            Finalizing high-fidelity export for your sequence.
          </p>

          <div className="w-full max-sm space-y-8">
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black text-indigo-400  tracking-[0.3em] ml-2">
                Project Label
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="E.g. The_Lion_Of_Lagos"
                className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-5 text-white focus:border-indigo-500 outline-none transition-all placeholder-gray-800 text-sm shadow-inner group-hover:border-indigo-500/50"
              />
              <p className="text-[8px] text-gray-600 font-bold  tracking-widest ml-2 italic">
                Leave blank to use cinematic defaults
              </p>
            </div>

      {isExporting ? (
              <div className="space-y-6">
                <div className="h-2.5 bg-gray-900 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
                <div className="flex items-center justify-center gap-3">
                  <LoaderIcon className="w-4 h-4 animate-spin text-indigo-500" />
                  <p className="text-[10px] font-black text-indigo-400  tracking-[0.4em] animate-pulse">
            Rendering Master Reel... {progress}%
          </p>
                </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={handleExport}
                  className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black  tracking-[0.4em] rounded-[2rem] shadow-2xl transition-all active:scale-95 text-[12px] border border-indigo-400/20"
          >
                  Start Master Render
          </button>
          <button
            onClick={onClose}
            className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-400 font-black  tracking-widest rounded-xl transition-all text-[10px]"
          >
            Cancel
          </button>
        </div>
      )}
            {error && (
              <div className="p-4 bg-red-900/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-in shake">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0" />
                <p className="text-red-400 text-[10px] font-black  tracking-widest text-left leading-tight">
                  {error}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const BuyCreditsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [isGiftMode, setIsGiftMode] = useState(false);
  const [giftRecipientEmail, setGiftRecipientEmail] = useState("");

  const getPurchaseLink = (baseLink: string) => {
    if (isGiftMode && giftRecipientEmail.trim()) {
      return `${baseLink}&custom=${encodeURIComponent(giftRecipientEmail.trim())}`;
    }
    return baseLink;
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-gray-950 p-4 sm:p-8 scrollbar-thin scrollbar-thumb-gray-800">
      <div className="max-w-5xl mx-auto flex flex-col items-center animate-in fade-in zoom-in-95 duration-500 origin-top">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-white italic tracking-tighter mb-2  leading-none">
            Studio Top-Up
          </h2>
          <div className="inline-flex flex-col items-center gap-4">
            <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10 shadow-inner">
              <button
                onClick={() => setIsGiftMode(false)}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black  tracking-widest transition-all ${!isGiftMode ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-300"}`}
              >
                Account Recharge
              </button>
              <button
                onClick={() => setIsGiftMode(true)}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black  tracking-widest transition-all ${isGiftMode ? "bg-amber-500 text-black shadow-lg" : "text-gray-500 hover:text-gray-300"}`}
              >
                <GiftIcon className="w-4 h-4" /> Gift Someone
              </button>
            </div>

            {isGiftMode && (
              <div className="w-full max-w-md animate-in slide-in-from-top-4 duration-300">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-amber-500  tracking-[0.2em] block ml-2">
                    Recipient Email Address
                  </label>
                  <div className="relative group">
                    <input
                      type="email"
                      value={giftRecipientEmail}
                      onChange={(e) => setGiftRecipientEmail(e.target.value)}
                      placeholder="registered-user@studio.com"
                      className="w-full bg-black/40 border border-amber-500/30 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition-all placeholder-gray-800 text-sm shadow-inner group-hover:border-amber-500/50"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                      <span className="text-[8px] font-black text-amber-500/50  tracking-widest">
                        Required
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-10">
          <div
            className={`${isGiftMode ? "bg-[#1e1a0f] border-amber-500/20" : "bg-[#0f172a] border-sky-500/20"} border rounded-2xl p-6 flex flex-col items-center text-center shadow-xl group transition-all hover:scale-[1.02]`}
          >
            <h3 className="text-xl font-black text-white mb-1 italic tracking-tighter  tracking-widest">
              €10 (100C)
            </h3>
            <a
              href={getPurchaseLink(PAYPAL_STARTER_LINK)}
              target="_blank"
              className={`w-full py-4 font-black text-[10px]  tracking-widest rounded-xl transition-colors text-center ${isGiftMode ? "bg-amber-600 text-black" : "bg-sky-600 text-white"}`}
            >
              {isGiftMode ? "Send Gift" : "Purchase"}
            </a>
          </div>
          <div
            className={`border-2 rounded-2xl flex flex-col items-center text-center shadow-xl p-6 transition-all hover:scale-[1.02] ${isGiftMode ? "bg-[#221c0e] border-amber-500/30" : "bg-[#111827] border-white/20"}`}
          >
            <h3 className="text-xl font-black text-white mb-1 italic tracking-widest">
              €20 (300C)
            </h3>
            <a
              href={getPurchaseLink(PAYPAL_PRO_LINK)}
              target="_blank"
              className={`w-full py-4 font-black text-[10px]  tracking-widest rounded-xl transition-colors text-center ${isGiftMode ? "bg-amber-600 text-black" : "bg-white text-black"}`}
            >
              {isGiftMode ? "Send Gift" : "Best Value"}
            </a>
          </div>
          <div
            className={`${isGiftMode ? "bg-[#1e1a0f] border-amber-500/20" : "bg-[#0f172a] border-sky-500/20"} border rounded-2xl p-6 flex flex-col items-center text-center shadow-xl group transition-all hover:scale-[1.02]`}
          >
            <h3 className="text-xl font-black text-white mb-1 italic tracking-widest">
              €40 (700C)
            </h3>
            <a
              href={getPurchaseLink(PAYPAL_STUDIO_LINK)}
              target="_blank"
              className={`w-full py-4 font-black text-[10px]  tracking-widest rounded-xl transition-colors text-center ${isGiftMode ? "bg-amber-600 text-black" : "bg-amber-600 text-white"}`}
            >
              {isGiftMode ? "Send Gift" : "Max Pack"}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Modals: React.FC<ModalsProps> = ({
  activeModal,
  setActiveModal,
  modalData,
  onClose,
  storybookContent,
  setStorybookContent,
  onGenerateFromStorybook,
  history,
  masterHistory,
  onLoadHistory,
  onDeleteHistory,
  onDeleteHistoryImage,
  onClearHistory,
  characters,
  onEditImage,
  onApplyCameraAngle,
  costPerImage,
  currencySymbol,
  exchangeRate,
  savedItems,
  characterStyle,
  selectedCountry,
  onToggleSave,
  imageModel,
  setImageModel,
  onGenerateSingleStorybookScene,
  creditBalance = 0,
  onUpdateModalData,
  isGenerating = false,
  onUpdateImage,
  onSwapOutfit,
  onAddAudioToTimeline,
  onAddAudioClip,
  onDeductAudioCredit,
  onResetStorybook,
  onUndo,
  storySeed,
  setStorySeed,
  timelineClips,
  audioClips,
  textClips,
  onUpdateClips,
  onUpdateAudioClips,
  onUpdateTextClips,
  onUpdateTimelineClip,
  onUpdateAudioClip,
  onDeleteTimelineClip,
  onDeleteAudio,
  onAddTimelineClip,
  onAddTextClip,
  onCaptureFrameFromTimeline,
  timelinePlaybackTime,
  onUpdateTimelinePlaybackTime,
  onExportTimeline,
  generationItem,
  historyIndex,
  activeVideoIndices,
  onOpenVideoCreator,
  onGenerateVideo,
  onAddToTimeline,
  videoModel,
  setVideoModel,
  setVideoResolution,
  onSwitchSession,
  onNewSession,
  onUpdateVideoDraft,
  activeI2ISlot,
  setActiveI2ISlot,
  setCharacters,
  handleBuildCharacterVisual,
  handleUploadNewCharacterImage,
  handleCharacterImageUpload,
  updateCharacter,
  removeCharacter,
  onToggleHero,
  onUploadStartImage,
  onUploadToSession,
  onDeleteScene,
  onUndoEdit,
  onAddSceneVariant,
  onSelectSceneVariant,
  onSceneVariantChange,
  onUpdateSceneImage,
  onRegenerateScene,
  onAngleSelect,
  visualStyle
}) => {
  const [selectedAngle, setSelectedAngle] = useState("");
  const [focusSubject, setFocusSubject] = useState("");
  const [isConfirmingAngle, setIsConfirmingAngle] = useState(false);
  const angleContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => setIsConfirmingAngle(false), [activeModal, selectedAngle]);

  useEffect(() => {
    if (!isConfirmingAngle) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        angleContentRef.current &&
        !angleContentRef.current.contains(e.target as Node)
      ) {
        setIsConfirmingAngle(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isConfirmingAngle]);

  if (!activeModal) return null;

  if (activeModal === "export-video") {
    return (
      <ModalWrapper title="Final Production Render" onClose={onClose}>
        <VideoExporter clips={modalData.clips} onClose={onClose} />
      </ModalWrapper>
    );
  }

  if (activeModal === "image-preview")
    return (
      <div
        className="fixed inset-0 z-[400] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl"
        onClick={onClose}
      >
        <div
          className="relative max-w-5xl max-h-full"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute -top-12 right-0 text-white hover:text-indigo-400 transition-colors p-2"
          >
            <XIcon className="w-8 h-8" />
          </button>
          <img
            src={modalData.src}
            className="max-w-full max-h-[90vh] object-contain rounded-3xl shadow-2xl border border-white/5"
          />
        </div>
      </div>
    );

  if (activeModal === "edit-image") {
    const currentSession = history.find((h) => h.id === modalData.genId);
    const existingVersions = (modalData.variants || []).map((v: any) => v.src);
    return (
      <ImageEditor
        isOpen={true}
        imageSrc={modalData.src}
        initialVersions={existingVersions}
        initialPrompt=""
        aspectRatio={currentSession?.aspectRatio || "16:9"}
        imageStyle={currentSession?.visualStyle || "3D Render"}
        genre={currentSession?.genre || "General"}
        characters={characters}
        imageModel={imageModel || "gemini-3-pro-image-preview"}
        onClose={onClose}
        onSave={(newImageSrc, newPrompt) => {
          // EDIT SAVE FIDELITY: Ensure the selected thumbnail from the editor is saved as the active visual on the card.
          if (onUpdateSceneImage)
            onUpdateSceneImage(modalData.genId, modalData.sceneId, newImageSrc);
          onClose();
        }}
        onUpdateImage={(newSrc, prompt) => {
          if (onAddSceneVariant)
            onAddSceneVariant(
              modalData.genId,
              modalData.sceneId,
              newSrc,
              prompt || "Edited variation",
              "Edit"
            );
        }}
      />
    );
  }

  if (activeModal === "history") {
    return (
      <ModalWrapper title="Production History" onClose={onClose}>
        <HistoryPanel
          history={history}
          masterHistory={masterHistory}
          savedItems={savedItems}
          onClose={onClose}
          // DO add comment: Fixed name error: 'handleLoadHistory' replaced with 'onLoadHistory' which is available from destructured props.
          onLoadHistory={onLoadHistory}
          onClearHistory={onClearHistory}
          onToggleSave={onToggleSave}
        />
      </ModalWrapper>
    );
  }

  if (activeModal === "storybook") {
    return (
      <StorybookCreator
        storybookContent={storybookContent}
        setStorybookContent={setStorybookContent}
        characters={characters}
        characterStyle={characterStyle}
        selectedCountry={selectedCountry}
        creditBalance={creditBalance}
        onClose={onClose}
        onGenerateFromStorybook={onGenerateFromStorybook}
        onGenerateSingleStorybookScene={onGenerateSingleStorybookScene}
        onSwapOutfit={onSwapOutfit}
        onAddAudioToTimeline={onAddAudioToTimeline}
        onAddAudioClip={onAddAudioClip}
        onDeductAudioCredit={onDeductAudioCredit}
        onResetStorybook={onResetStorybook}
        storySeed={storySeed}
        setStorySeed={setStorySeed}
      />
    );
  }

  if (activeModal === "timeline") {
    return (
      <ModalWrapper title="Sequence Timeline" onClose={onClose}>
        <Timeline
          clips={timelineClips || []}
          audioClips={audioClips || []}
          textClips={textClips || []}
          // DO add comment: Fixed missing props to satisfy TimelineProps requirements.
          onUpdateClips={onUpdateClips || (() => {})}
          onUpdateAudioClips={onUpdateAudioClips || (() => {})}
          onUpdateTextClips={onUpdateTextClips || (() => {})}
          onDelete={onDeleteTimelineClip || (() => {})}
          onDeleteAudio={onDeleteAudio || (() => {})}
          onUpdateClip={onUpdateTimelineClip || (() => {})}
          onUpdateAudioClip={onUpdateAudioClip || (() => {})}
          onExport={onExportTimeline || (() => {})}
          onAddClip={onAddTimelineClip || (() => {})}
          onAddAudioClip={onAddAudioClip || (() => {})}
          // DO add comment: Pass onAddTextClip to the Timeline component.
          onAddTextClip={onAddTextClip || (() => {})}
          onCaptureFrame={onCaptureFrameFromTimeline}
          // DO add comment: Passed onUndo to Timeline component inside activeModal === 'timeline' block.
          onUndo={onUndo}
          playbackTime={timelinePlaybackTime ?? modalData.playbackTime ?? 0}
          onUpdatePlaybackTime={onUpdateTimelinePlaybackTime || (() => {})}
        />
      </ModalWrapper>
    );
  }

  // DO add comment: Corrected prop mapping for Storyboard component to resolve variable scope errors (savedScenes, handleLoadHistory, etc.).
  if (activeModal === "storyboard") {
    return (
      <ModalWrapper title="Production Stage" onClose={onClose}>
        <Storyboard
          generationItem={generationItem}
          savedItems={savedItems}
          history={history}
          historyIndex={historyIndex ?? -1}
          onSaveScene={(gid, sid) => {
            const sess = history.find((h) => h.id === gid);
            const img = sess?.imageSet.find((s: any) => s.sceneId === sid);
            if (img) onToggleSave(img);
          }}
          onEditScene={(gid, sid) => {
            const sess = history.find((h) => h.id === gid);
            const img = sess?.imageSet.find((s: any) => s.sceneId === sid);
            onUpdateModalData?.({
              genId: gid,
              sceneId: sid,
              src: img.src,
              variants: img.variants || []
            });
            setActiveModal("edit-image");
          }}
          onRegenerateScene={onRegenerateScene || (() => {})}
          onAngleSelect={onAngleSelect || (() => {})}
          onOpenVideoCreator={onOpenVideoCreator || (() => {})}
          onGenerateVideo={onGenerateVideo || (() => {})}
          onAddToTimeline={onAddToTimeline || (() => {})}
          isGenerating={isGenerating}
          isDisabled={false}
          activeVideoIndices={activeVideoIndices || []}
          videoModel={videoModel || ""}
          setVideoModel={setVideoModel || (() => {})}
          setVideoResolution={setVideoResolution || (() => {})}
          onPreviewImage={(src) => onUpdateModalData?.({ src })}
          onSwitchSession={onLoadHistory}
          onDeleteScene={onDeleteScene}
          onUndoEdit={onUndoEdit}
          onNewSession={onNewSession || (() => {})}
          onUpdateVideoDraft={onUpdateVideoDraft || (() => {})}
          creditBalance={creditBalance}
          onStop={() => {}}
          currency="EUR"
          activeI2ISlot={activeI2ISlot || null}
          setActiveI2ISlot={setActiveI2ISlot || (() => {})}
          onUploadStartImage={onUploadStartImage}
          onUploadToSession={onUploadToSession}
          onSceneVariantChange={onSceneVariantChange}
        />
      </ModalWrapper>
    );
  }

  if (activeModal === "roster") {
    return (
      <ModalWrapper title="Character Roster" onClose={onClose}>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-gray-800">
          <div className="max-w-4xl mx-auto w-full">
            <ActorRoster
              characters={characters}
              setCharacters={setCharacters || (() => {})}
              handleBuildCharacterVisual={
                handleBuildCharacterVisual || (() => {})
              }
              handleUploadNewCharacterImage={
                handleUploadNewCharacterImage || (() => {})
              }
              handleCharacterImageUpload={
                handleCharacterImageUpload || (() => {})
              }
              updateCharacter={updateCharacter || (() => {})}
              removeCharacter={removeCharacter || (() => {})}
              onToggleHero={onToggleHero || (() => {})}
              visualStyle={visualStyle}
            />
          </div>
        </div>
      </ModalWrapper>
    );
  }

  if (activeModal === "buy-credits") {
    return (
      <ModalWrapper title="Credit Exchange" onClose={onClose}>
        <BuyCreditsModal onClose={onClose} />
      </ModalWrapper>
    );
  }

  if (activeModal === "camera-angles") {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          ref={angleContentRef}
          className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h2 className="font-bold text-white flex items-center gap-2">
              <CameraIcon className="w-5 h-5" /> Camera Angles
            </h2>
            <button onClick={onClose} className="p-2">
              <XIcon className="w-5 h-5 text-gray-500 hover:text-white" />
            </button>
          </div>
          <div className="p-4 max-h-[70vh] overflow-y-auto space-y-6">
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-3">
                Sync Character (Focus Actor)
              </label>
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                {characters.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => setFocusSubject(char.name)}
                    className={`shrink-0 w-12 h-12 rounded-full border-2 transition-all relative group ${focusSubject === char.name ? "border-indigo-500 scale-110 ring-4 ring-indigo-500/20" : "border-gray-800 opacity-40 grayscale hover:opacity-100 hover:grayscale-0"}`}
                    title={char.name}
                  >
                    {char.imagePreview ? (
                      <img
                        src={char.imagePreview}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-full">
                        <UserPlusIcon className="w-4 h-4 text-gray-600" />
                      </div>
                    )}
                    {focusSubject === char.name && (
                      <div className="absolute -top-1 -right-1 bg-indigo-500 text-white rounded-full p-0.5 shadow-lg animate-in zoom-in">
                        <CheckIcon className="w-2 h-2" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-[8px] text-gray-600 font-bold  mt-2 tracking-widest italic">
                Locks visual identity to specific actor
              </p>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-500  tracking-[0.2em] block mb-3">
                Select Shot
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CAMERA_ANGLE_OPTIONS.map((angle) => (
                  <button
                    key={angle.key}
                    onClick={() => setSelectedAngle(angle.name)}
                    className={`p-2 text-left rounded-lg border transition-all ${selectedAngle === angle.name ? "bg-indigo-900/50 border-indigo-500 text-white shadow-lg" : "bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-600 hover:bg-gray-900"}`}
                  >
                    <div className="text-[11px] font-black  tracking-tight">
                      {angle.name}
                    </div>
                    <div className="text-[8px] opacity-60 leading-tight mt-0.5 font-bold">
                      {angle.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-gray-800 flex justify-end items-center gap-3 bg-[#0a0f1d]">
            {isConfirmingAngle && (
              <span className="text-[10px] font-black text-gray-500  tracking-widest">
                Cost: 2 Credits
              </span>
            )}
            {isConfirmingAngle && (
              <button
                onClick={() => setIsConfirmingAngle(false)}
                className="text-[10px] font-black text-gray-500 hover:text-gray-300  tracking-widest mr-2"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() =>
                isConfirmingAngle
                  ? onApplyCameraAngle(selectedAngle, focusSubject)
                  : setIsConfirmingAngle(true)
              }
              disabled={!selectedAngle}
              className={`px-6 py-2.5 text-white text-[10px] font-black  tracking-widest rounded-xl shadow-2xl transition-all flex items-center gap-2 active:scale-95 ${isConfirmingAngle ? "bg-green-600 hover:bg-green-700" : "bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-800 disabled:text-gray-500"}`}
            >
              {isConfirmingAngle ? (
                "Confirm Shot"
              ) : (
                <>
                  <CameraIcon className="w-4 h-4" /> Initiate Shot
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
