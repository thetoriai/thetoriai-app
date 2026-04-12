import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleGenAI } from "@google/genai";
// // import { Capacitor } from "@capacitor/core";
import {
  XIcon,
  PauseIcon,
  PlayIcon,
  ResetIcon,
  CameraIcon,
  CompressIcon,
  ExpandIcon,
  TrashIcon,
  FilmIcon,
  ImageIcon,
  PlusIcon,
  ClapperboardIcon,
  ArrowsRightLeftIcon,
  PenIcon,
  CircleIcon,
  SquareIcon,
  ArrowPointerIcon,
  SparklesIcon,
  GhostIcon,
  LoaderIcon,
  RepeatIcon,
  UserSlashIcon,
  EraserIcon,
  MicIcon,
  MicOffIcon,
  WatermarkIcon,
  TextIcon
} from "./Icons";
// import ScreenRecorder from "./plugins/ScreenRecorder";

// import { supabase } from "../services/supabaseClient";

// --- Types ---
export interface Transform {
  x: number;
  y: number;
  scale: number;
  cropTop: number;
  cropBottom: number;
  cropLeft: number;
  cropRight: number;
}

export interface TextItem {
  id: string;
  text: string;
  x: number; // 0-1 relative to canvas
  y: number; // 0-1 relative to canvas
  scale: number;
  color: string;
  rotation: number;
}

export interface Point {
  x: number;
  y: number;
}

export type DrawingShape = "free" | "circle" | "square" | "arrow";

export interface DrawingItem {
  shape: DrawingShape;
  points: Point[]; // Coordinates relative to the source asset (0.0 to 1.0)
  color: string;
  width: number;
}

export interface Effect {
  type: "blur";
  rect: { x: number; y: number; w: number; h: number }; // Normalized 0-1 relative to asset
  isTracked?: boolean;
  trackingId?: string;
}

export interface Asset {
  id: string;
  type: "video" | "image";
  url: string;
  thumbnail?: string;
  name: string;
  width: number;
  height: number;
  transform: Transform;
  drawings: DrawingItem[];
  effects?: Effect[];

  opacity?: number;
  targetOpacity?: number;

  fullFrame?: boolean;
}

const DEFAULT_TRANSFORM: Transform = {
  x: 50,
  y: 35,
  scale: 65,
  cropTop: 0,
  cropBottom: 0,
  cropLeft: 0,
  cropRight: 0
};

interface DirectorsCutProps {
  onClose?: () => void;
  consumeCredits: (action: string) => Promise<boolean>;
  onGenerateImage?: (prompt: string) => Promise<string>;
  onGenerateVideo?: (prompt: string) => Promise<any>;
}

const DirectorsCut: React.FC<DirectorsCutProps> = ({
  onClose: externalClose,
  consumeCredits
}) => {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [visibleAssetIds, setVisibleAssetIds] = useState<string[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamFlipped, setWebcamFlipped] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [webcamMode, setWebcamMode] = useState<"fullscreen" | "floating">(
    "fullscreen"
  );
  const [webcamTransform, setWebcamTransform] = useState<Transform>({
    x: 80,
    y: 80,
    scale: 25,
    cropTop: 0,
    cropBottom: 0,
    cropLeft: 0,
    cropRight: 0
  });
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">(
    "user"
  );

  const [isRecording, setIsRecording] = useState(false);
  const [isRecordConfirming, setIsRecordConfirming] = useState(false);
  const [isAssetPlaying, setIsAssetPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showWatermark, setShowWatermark] = useState(true);
  const [watermarkUnlocked, setWatermarkUnlocked] = useState(false);

  // Interaction Mode
  const [isLocked, setIsLocked] = useState(false);
  const [grabbedPart, setGrabbedPart] = useState<
    "move" | "top" | "bottom" | "left" | "right" | null
  >(null);
  const [isPinching, setIsPinching] = useState(false);

  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSimulatedRecording, setIsSimulatedRecording] = useState(false);

  // NEW: Store the native path to bypass fetch() crashes!
  const [nativeVideoPath, setNativeVideoPath] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [reviewPlaybackRate, setReviewPlaybackRate] = useState(1);
  const [reviewVideoUrl, setReviewVideoUrl] = useState<string | null>(null);
  const [isReviewPlaying, setIsReviewPlaying] = useState(true);
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 1]);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [videoDuration, setVideoDuration] = useState(0);

  const [fadeMode, setFadeMode] = useState(false);

  // New: Confirmation state for Magic button
  const [isConfirmingMagic, setIsConfirmingMagic] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);
  const [magicMode, setMagicMode] = useState<
    "menu" | "blur_selecting" | "cut_selecting" | null
  >(null);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);

  // Drawing State
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingShape, setDrawingShape] = useState<DrawingShape>("free");
  const [activePath, setActivePath] = useState<Point[]>([]);

  // Text State
  const [isTextMode, setIsTextMode] = useState(false);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editingTextValue, setEditingTextValue] = useState("");

  const startTouchRef = useRef({ x: 0, y: 0, scale: 0, dist: 0 });
  const initialTouchRef = useRef({ x: 0, y: 0 });
  const dragStartTransformRef = useRef<Transform>(DEFAULT_TRANSFORM);
  const isDraggingRef = useRef(false);
  const isDraggingWebcamRef = useRef(false);
  const isResizingTextRef = useRef(false);
  const lastTapRef = useRef<number>(0);
  const tapCountRef = useRef<number>(0);
  const tapTimeoutRef = useRef<number | null>(null);
  const lastPenTapRef = useRef<number>(0);
  const penTapTimeoutRef = useRef<number | null>(null);
  const lastTouchTimeRef = useRef<number>(0);
  const lastActiveTextIdRef = useRef<string | null>(null);

  // --- Refs ---
  const isRecordingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const requestRef = useRef<number>(0);
  const recordingIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(
    null
  );
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const videoSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const activeStreamRef = useRef<MediaStream | null>(null);
  const wakeLockRef = useRef<any>(null);
  const micOnlyStreamRef = useRef<MediaStream | null>(null);
  const reviewVideoRef = useRef<HTMLVideoElement>(null);

  const trackingCanvasRef = useRef<HTMLCanvasElement>(null);
  const trackingState = useRef<Map<string, any>>(new Map());

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) || null;

  const [isTracking, setIsTracking] = useState<{
    assetId: string;
    type: "blur" | "cut";
    rect: { x: number; y: number; w: number; h: number };
    progress: number;
  } | null>(null);

  // Magic button timeout effect
  useEffect(() => {
    setIsConfirmingMagic(false);
    setMagicMode(null);
    setSelectionRect(null);
    setIsTracking(null);
  }, [selectedAssetId]);

  // Tracking Simulation
  useEffect(() => {
    if (!isTracking) return;

    const interval = setInterval(() => {
      setIsTracking((prev) => {
        if (!prev) return null;
        if (prev.progress >= 100) {
          // Complete
          clearInterval(interval);
          return prev;
        }
        // Slower progress for more realistic "analysis" feel (0.5% per 30ms -> ~6 seconds)
        return { ...prev, progress: prev.progress + 0.5 };
      });
    }, 30);

    return () => clearInterval(interval);
  }, [isTracking?.assetId]); // Depend on assetId to restart if needed, but mainly just running when isTracking exists

  useEffect(() => {
    if (isTracking && isTracking.progress >= 100) {
      // Apply Effect
      const { assetId, type, rect } = isTracking;

      if (type === "blur") {
        // Initialize Tracker
        const trackId = `${assetId}-${Date.now()}`;

        // Capture template
        const asset = assets.find((a) => a.id === assetId);
        if (asset && asset.type === "video" && videoRef.current) {
          const vid = videoRef.current;
          const tCanvas = document.createElement("canvas"); // Temporary canvas for capture
          const tw = 32; // Template width (small for performance)
          const th = 32;
          tCanvas.width = tw;
          tCanvas.height = th;
          const tCtx = tCanvas.getContext("2d");

          if (tCtx) {
            // Draw the specific region of the video to the template canvas
            // rect is normalized 0-1.
            const sx = rect.x * vid.videoWidth;
            const sy = rect.y * vid.videoHeight;
            const sw = rect.w * vid.videoWidth;
            const sh = rect.h * vid.videoHeight;

            tCtx.drawImage(vid, sx, sy, sw, sh, 0, 0, tw, th);
            const templateData = tCtx.getImageData(0, 0, tw, th).data;

            trackingState.current.set(trackId, {
              template: templateData,
              tWidth: tw,
              tHeight: th,
              lastX: rect.x,
              lastY: rect.y,
              assetWidth: vid.videoWidth,
              assetHeight: vid.videoHeight
            });
          }
        }

        setAssets((prev) =>
          prev.map((a) => {
            if (a.id === assetId) {
              return {
                ...a,
                effects: [
                  ...(a.effects || []),
                  { type: "blur", rect, isTracked: true, trackingId: trackId }
                ]
              };
            }
            return a;
          })
        );
      } else if (type === "cut") {
        // For video cut, we currently convert to image.
        // We can pass the rect to handleMagicCutout
        // We need to ensure selectedAssetId is correct or pass it
        if (selectedAssetId === assetId) {
          handleMagicCutout(rect);
        }
      }
      setIsTracking(null);
    }
  }, [isTracking?.progress]);

  // Auto-play and reset video when entering review mode
  useEffect(() => {
    if (isReviewing && reviewVideoRef.current && reviewVideoUrl) {
      reviewVideoRef.current.currentTime = 0;
      reviewVideoRef.current.play().catch(() => {
        // Suppress auto-play policy errors if they occur
      });
    }
  }, [isReviewing, reviewVideoUrl]);

  // --- Visibility Logic ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setWebcamActive(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (recordedBlob) {
      const url = URL.createObjectURL(recordedBlob);
      setReviewVideoUrl(url);
      setTrimRange([0, 1]);
      setReviewPlaybackRate(1);

      // Generate thumbnails
      const generateThumbnails = async () => {
        const video = document.createElement("video");
        video.src = url;
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = "anonymous";
        await video.play();
        video.pause();

        const duration = video.duration;
        setVideoDuration(duration);

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const thumbCount = 10;
        const thumbs: string[] = [];

        canvas.width = 160; // Small width for performance
        canvas.height = 90; // 16:9 aspect ratio roughly

        for (let i = 0; i < thumbCount; i++) {
          const time = (duration / thumbCount) * i;
          video.currentTime = time;
          await new Promise((resolve) => {
            const onSeek = () => {
              video.removeEventListener("seeked", onSeek);
              resolve(null);
            };
            video.addEventListener("seeked", onSeek);
          });

          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            thumbs.push(canvas.toDataURL("image/jpeg", 0.5));
          }
        }
        setThumbnails(thumbs);
      };

      generateThumbnails();

      return () => URL.revokeObjectURL(url);
    } else {
      setReviewVideoUrl(null);
      setThumbnails([]);
    }
  }, [recordedBlob]);

  const togglePlaybackSpeed = (speed: number) => {
    const newSpeed = reviewPlaybackRate === speed ? 1 : speed;
    setReviewPlaybackRate(newSpeed);
    if (reviewVideoRef.current) {
      reviewVideoRef.current.playbackRate = newSpeed;
      if (reviewVideoRef.current.paused) {
        reviewVideoRef.current.play();
        setIsReviewPlaying(true);
      }
    }
  };

  const handleReviewTimeUpdate = () => {
    const video = reviewVideoRef.current;
    if (!video) return;

    // 1. Safely handle the Chrome WebM Infinity duration bug
    let safeDuration = video.duration;
    if (!safeDuration || safeDuration === Infinity || isNaN(safeDuration)) {
      // Fallback to the buffered end if duration is broken
      safeDuration =
        video.buffered.length > 0
          ? video.buffered.end(video.buffered.length - 1)
          : 100;
    }

    // 2. Explicitly protect against 0 * Infinity = NaN
    const start = trimRange[0] === 0 ? 0 : trimRange[0] * safeDuration;
    const end = trimRange[1] === 1 ? safeDuration : trimRange[1] * safeDuration;

    if (video.currentTime < start) {
      video.currentTime = start;
    }

    if (video.currentTime >= end) {
      video.pause();
      video.currentTime = start;
    }
  };

  const handleReviewClose = () => {
    setIsReviewing(false);
    setRecordedBlob(null);
    setWebcamActive(false);
    setIsMuted(true);
    if (micOnlyStreamRef.current) {
      micOnlyStreamRef.current.getTracks().forEach((t) => t.stop());
      micOnlyStreamRef.current = null;
    }
  };

  // --- Boundary Constraint Logic ---

  const toggleFullFrame = (id: string) => {
    setAssets((prev) =>
      prev.map((asset) =>
        asset.id === id ? { ...asset, fullFrame: !asset.fullFrame } : asset
      )
    );
  };

  const getConstrainedTransform = (
    asset: Asset,
    next: Partial<Transform>
  ): Transform => {
    const t = { ...asset.transform, ...next };
    const w = 1080,
      h = 1920;
    const swActual = asset.width * (1 - (t.cropLeft + t.cropRight) / 100);
    const shActual = asset.height * (1 - (t.cropTop + t.cropBottom) / 100);
    const baseDrawW = w * (t.scale / 100);
    const baseDrawH = baseDrawW * (asset.height / asset.width);
    const drawW = baseDrawW * (swActual / asset.width);
    const drawH = baseDrawH * (shActual / asset.height);

    if (drawW <= w) {
      t.x = Math.max(
        (drawW / 2 / w) * 100,
        Math.min(100 - (drawW / 2 / w) * 100, t.x)
      );
    } else {
      t.x = Math.max(
        100 - (drawW / 2 / w) * 100,
        Math.min((drawW / 2 / w) * 100, t.x)
      );
    }

    if (drawH <= h) {
      t.y = Math.max(
        (drawH / 2 / h) * 100,
        Math.min(100 - (drawH / 2 / h) * 100, t.y)
      );
    } else {
      t.y = Math.max(
        100 - (drawH / 2 / h) * 100,
        Math.min((drawH / 2 / h) * 100, t.y)
      );
    }
    return t;
  };

  const selectAndShowAsset = useCallback(
    (id: string, type: "video" | "image", currentAssets: Asset[]) => {
      setVisibleAssetIds((prev) => {
        let next = [...prev];

        if (!next.includes(id)) {
          if (type === "video") {
            // remove ONLY other videos
            next = next.filter(
              (vId) => currentAssets.find((a) => a.id === vId)?.type !== "video"
            );
          }

          // images do nothing, just add

          next.push(id);
        }

        return next;
      });

      setSelectedAssetId(id);
    },
    []
  );

  const resetApp = () => {
    if (isFinalizing || isReviewing) return;
    assets.forEach((a) => URL.revokeObjectURL(a.url));
    setAssets([]);
    setVisibleAssetIds([]);
    setSelectedAssetId(null);
    setWebcamActive(false);
    setIsMuted(true);
    if (micOnlyStreamRef.current) {
      micOnlyStreamRef.current.getTracks().forEach((t) => t.stop());
      micOnlyStreamRef.current = null;
    }

    setIsAssetPlaying(false);
    setIsLooping(false);
    if (externalClose) externalClose();
  };

  const updateAssetTransform = (id: string, updates: Partial<Transform>) => {
    if (isFinalizing || isReviewing) return;
    setAssets((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, transform: getConstrainedTransform(a, updates) }
          : a
      )
    );
  };

  const deleteAsset = (id: string) => {
    if (isFinalizing || isReviewing) return;
    const asset = assets.find((a) => a.id === id);
    if (asset) {
      URL.revokeObjectURL(asset.url);
      imageCache.current.delete(id);
    }

    // Check if this is the last asset being deleted
    const remainingAssets = assets.filter((a) => a.id !== id);
    if (remainingAssets.length === 0) {
      setWebcamActive(false);
      setIsMuted(true);
      if (micOnlyStreamRef.current) {
        micOnlyStreamRef.current.getTracks().forEach((t) => t.stop());
        micOnlyStreamRef.current = null;
      }
    }

    setAssets((prev) => prev.filter((a) => a.id !== id));
    setVisibleAssetIds((prev) => prev.filter((vId) => vId !== id));
    if (selectedAssetId === id) {
      setSelectedAssetId(null);
    }
  };

  const toggleAssetVisibility = (id: string) => {
    if (isFinalizing || isReviewing) return;

    const asset = assets.find((a) => a.id === id);
    if (!asset) return;

    // Ghost mode ON → smooth fade system
    if (fadeMode) {
      setAssets((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a;

          const current = a.targetOpacity ?? 1;

          return {
            ...a,
            targetOpacity: current === 1 ? 0 : 1,
            opacity: a.opacity ?? current
          };
        })
      );

      setSelectedAssetId(id);

      setVisibleAssetIds((prev) => {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      });

      return;
    }

    // Normal mode
    const isVisible = visibleAssetIds.includes(id);
    let next = [...visibleAssetIds];

    if (isVisible) {
      if (selectedAssetId === id) {
        next = next.filter((vId) => vId !== id);
        setSelectedAssetId(null);
      } else {
        next = next.filter((vId) => vId !== id);
        next.push(id);
        setSelectedAssetId(id);
      }
    } else {
      if (asset.type === "video") {
        // remove ONLY other videos
        next = next.filter(
          (vId) => assets.find((a) => a.id === vId)?.type !== "video"
        );
      }

      // images stay, just add
      next.push(id);
      setSelectedAssetId(id);
    }
    setVisibleAssetIds(next);

    setAssets((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              opacity: 1,
              targetOpacity: 1
            }
          : a
      )
    );
  };

  const handleExternalRecordingToggle = async (isStarting: boolean) => {
    if (isStarting) {
      // Start ReplayKit and show the red STOP screen
      // try {
      //   const result = await ScreenRecorder.startRecording();
      //   if (result.success) {
      //     setIsSimulatedRecording(true);
      //   }
      // } catch (err) {
      //   console.error("Failed to start external recording", err);
      // }
      console.warn("ScreenRecorder plugin not implemented");
    } else {
      // Stop ReplayKit, convert the file path, and import it to the studio
      setIsSimulatedRecording(false);
      // try {
      //   const result = await ScreenRecorder.stopRecording();
      //   if (result.success && result.videoPath) {
      //     // Convert the file:// path so the WebView can read it
      //     const webPath = Capacitor.convertFileSrc(result.videoPath);
      //
      //     const newAsset: Asset = {
      //       id: `imported-${Date.now()}`,
      //       type: "video",
      //       url: webPath,
      //       name: "Screen Recording",
      //       width: 1080, // Allow your renderer to constrain it natively
      //       height: 1920,
      //       transform: DEFAULT_TRANSFORM,
      //       drawings: []
      //     };
      //
      //     setAssets((prev) => [...prev, newAsset]);
      //     selectAndShowAsset(newAsset.id, "video", [...assets, newAsset]);
      //   }
      // } catch (err) {
      //   console.error("Failed to stop external recording", err);
      // }
      console.warn("ScreenRecorder plugin not implemented");
    }
  };

  const toggleAssetPlayback = useCallback(
    async (forceReset = false) => {
      if (isFinalizing || isReviewing) return;
      const v = videoRef.current;
      if (!v || !v.src) return;
      if (!audioContextRef.current)
        audioContextRef.current = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
      const audioCtx = audioContextRef.current;
      if (audioCtx.state === "suspended") await audioCtx.resume();
      if (!videoSourceNodeRef.current) {
        videoSourceNodeRef.current = audioCtx.createMediaElementSource(v);
        gainNodeRef.current = audioCtx.createGain();
        videoSourceNodeRef.current.connect(gainNodeRef.current);
        gainNodeRef.current.connect(audioCtx.destination);
      }

      if (gainNodeRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(
          isLooping ? 0 : 1,
          audioCtx.currentTime,
          0.05
        );
      }

      if (forceReset) {
        v.currentTime = 0;
        v.pause();
        setIsAssetPlaying(false);
        return;
      }
      if (v.paused || v.ended) {
        v.muted = isLooping;
        v.volume = isLooping ? 0 : 1;
        setIsAssetPlaying(true);
        v.play().catch((e) => {
          console.warn(e);
          setIsAssetPlaying(false);
        });
      } else {
        v.pause();
        setIsAssetPlaying(false);
      }
    },
    [isLooping, isFinalizing, isReviewing]
  );

  useEffect(() => {
    const video = reviewVideoRef.current;
    if (!video) return;

    const duration = video.duration;
    if (!duration) return;

    const start = trimRange[0] * duration;

    video.currentTime = start;
  }, [trimRange[0]]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.loop = isLooping;
      v.muted = isLooping;
      v.volume = isLooping ? 0 : 1;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(
        isLooping ? 0 : 1,
        audioContextRef.current?.currentTime || 0,
        0.05
      );
    }
  }, [isLooping]);

  const handlePlaybackInteraction = useCallback(() => {
    if (isFinalizing || isReviewing) return;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 250) {
      // Double tap detected: RESET
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      toggleAssetPlayback(true);
      lastTapRef.current = 0;
    } else {
      // Single tap: PLAY/STOP
      lastTapRef.current = now;
      // Debounce single tap to wait for potential double tap
      tapTimeoutRef.current = window.setTimeout(() => {
        toggleAssetPlayback();
        tapTimeoutRef.current = null;
      }, 250);
    }
  }, [toggleAssetPlayback, isFinalizing, isReviewing]);

  const clearAllDrawings = useCallback(() => {
    setAssets((prev) => prev.map((a) => ({ ...a, drawings: [] })));
  }, []);

  const handlePenInteraction = useCallback(() => {
    if (isFinalizing || isReviewing) return;
    setIsTextMode(false);
    const now = Date.now();
    const timeSinceLastTap = now - lastPenTapRef.current;
    if (timeSinceLastTap < 300) {
      if (penTapTimeoutRef.current)
        window.clearTimeout(penTapTimeoutRef.current);
      setDrawingShape((prev) => {
        if (prev === "free") return "circle";
        if (prev === "circle") return "square";
        if (prev === "square") return "arrow";
        return "free";
      });
      setIsDrawingMode(true);
      setIsLocked(true);
      lastPenTapRef.current = 0;
    } else {
      lastPenTapRef.current = now;
      penTapTimeoutRef.current = window.setTimeout(() => {
        setIsDrawingMode((prev) => {
          const next = !prev;
          if (next) {
            setIsLocked(true);
          } else {
            setIsLocked(false);
            // Delete all pen strokes on any surface when unselecting the pen
            clearAllDrawings();
          }
          return next;
        });
        penTapTimeoutRef.current = null;
      }, 300);
    }
  }, [isFinalizing, isReviewing, clearAllDrawings]);

  const handleTextInteraction = useCallback(() => {
    if (isFinalizing || isReviewing) return;
    setIsDrawingMode(false);
    setIsTextMode((prev) => {
      const next = !prev;
      if (next) {
        setIsLocked(true);
        // Resume last active text if available, otherwise create new
        if (
          lastActiveTextIdRef.current &&
          textItems.some((t) => t.id === lastActiveTextIdRef.current)
        ) {
          setActiveTextId(lastActiveTextIdRef.current);
        } else {
          // Create new text item if none exists
          const newId = Date.now().toString();
          const newItem: TextItem = {
            id: newId,
            text: "Double tap to edit",
            x: 0.5,
            y: 0.5,
            scale: 100,
            color: "#ffffff",
            rotation: 0
          };
          setTextItems((prevItems) => [...prevItems, newItem]);
          setActiveTextId(newId);
          lastActiveTextIdRef.current = newId;
        }
      } else {
        setIsLocked(false);
        setActiveTextId(null);
        setIsEditingText(false);
      }
      return next;
    });
  }, [isFinalizing, isReviewing, textItems]);

  const handleAddText = useCallback(() => {
    if (isFinalizing || isReviewing) return;
    const newId = Date.now().toString();
    const newItem: TextItem = {
      id: newId,
      text: "Double tap to edit",
      x: 0.5,
      y: 0.5,
      scale: 100,
      color: "#ffffff",
      rotation: 0
    };
    setTextItems((prevItems) => [...prevItems, newItem]);
    setActiveTextId(newId);
    lastActiveTextIdRef.current = newId;
  }, [isFinalizing, isReviewing]);

  // --- Magic Cutout Logic ---
  const processTransparency = (img: HTMLImageElement): string => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return img.src;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Sample more aggressively from corners and edges to find background white
    const sampleIndices = [];
    const inset = 2; // pixel inset
    // Top Row
    for (let x = 0; x < canvas.width; x += 10)
      sampleIndices.push((inset * canvas.width + x) * 4);
    // Bottom Row
    for (let x = 0; x < canvas.width; x += 10)
      sampleIndices.push(((canvas.height - inset - 1) * canvas.width + x) * 4);
    // Left edge
    for (let y = 0; y < canvas.height; y += 10)
      sampleIndices.push((y * canvas.width + inset) * 4);
    // Right edge
    for (let y = 0; y < canvas.height; y += 10)
      sampleIndices.push((y * canvas.width + (canvas.width - inset - 1)) * 4);

    let rSum = 0,
      gSum = 0,
      bSum = 0,
      count = 0;
    sampleIndices.forEach((i) => {
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
      count++;
    });
    const avgR = rSum / count;
    const avgG = gSum / count;
    const avgB = bSum / count;

    // Wider threshold for near-white removal
    const threshold = 120;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const dist = Math.sqrt(
        Math.pow(r - avgR, 2) + Math.pow(g - avgG, 2) + Math.pow(b - avgB, 2)
      );
      // Specifically target high lightness/near-white even if distance isn't perfect
      const isVeryLight = r > 240 && g > 240 && b > 240;
      if (dist < threshold || isVeryLight) {
        data[i + 3] = 0; // Transparent
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  };

  const handleMagicCutout = async (overrideRect?: {
    x: number;
    y: number;
    w: number;
    h: number;
  }) => {
    if (!selectedAsset || isFinalizing || isReviewing) return;
    // CREDIT DEDUCTION

    setIsAiProcessing(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      let base64Data = "";
      if (selectedAsset.type === "video") {
        // Capture frame from video
        const videoEl = videoRef.current;
        if (!videoEl) throw new Error("Video element not found");

        const canvas = document.createElement("canvas");
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context failed");

        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        base64Data = canvas.toDataURL("image/png").split(",")[1];
      } else if (selectedAsset.url.startsWith("data:")) {
        base64Data = selectedAsset.url.split(",")[1];
      } else {
        const res = await fetch(selectedAsset.url);
        const blob = await res.blob();
        const reader = new FileReader();
        base64Data = await new Promise((resolve) => {
          reader.onloadend = () =>
            resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(blob);
        });
      }
      // Enhanced prompt for pure background isolation
      let prompt = `Precisely isolate the main subject. Place the subject on a pure, solid #FFFFFF white background. No shadows, no gradients, no borders. Ensure every background pixel is perfectly white.`;

      const rectToUse = overrideRect || selectionRect;
      if (rectToUse) {
        const center = {
          x: Math.round((rectToUse.x + rectToUse.w / 2) * 100),
          y: Math.round((rectToUse.y + rectToUse.h / 2) * 100)
        };
        prompt += ` The subject is located approximately at ${center.x}% horizontal and ${center.y}% vertical position. Focus on the subject in this area.`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: "image/png" } },
            {
              text: prompt
            }
          ]
        }
      });

      let rawResultUrl = "";
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          rawResultUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (rawResultUrl) {
        const tempImg = new Image();
        tempImg.crossOrigin = "anonymous";
        tempImg.src = rawResultUrl;
        tempImg.onload = () => {
          const transparentUrl = processTransparency(tempImg);

          const finalTransparentImg = new Image();
          finalTransparentImg.crossOrigin = "anonymous";
          finalTransparentImg.src = transparentUrl;
          finalTransparentImg.onload = () => {
            imageCache.current.set(selectedAsset.id, finalTransparentImg);
            setAssets((prev) =>
              prev.map((a) =>
                a.id === selectedAsset.id
                  ? {
                      ...a,
                      type: "image", // Force convert to image if it was video
                      url: transparentUrl,
                      width: finalTransparentImg.naturalWidth,
                      height: finalTransparentImg.naturalHeight,
                      drawings: [],
                      thumbnail: transparentUrl // Update thumbnail
                    }
                  : a
              )
            );
            setIsAiProcessing(false);
            setIsConfirmingMagic(false);
            setMagicMode(null);
            setSelectionRect(null);
            setActivePath([]);
          };
        };
      } else {
        setIsAiProcessing(false);
      }
    } catch (err) {
      console.error("Magic failed", err);
      setIsAiProcessing(false);
    }
  };

  useEffect(() => {
    if (!fadeMode) return;

    const interval = setInterval(() => {
      setAssets((prev) =>
        prev.map((asset) => {
          let opacity = asset.opacity ?? 0;
          let target = asset.targetOpacity ?? 0;

          if (opacity === target) return asset;

          const speed = 0.003;

          opacity =
            target > opacity
              ? Math.min(target, opacity + speed)
              : Math.max(target, opacity - speed);

          return {
            ...asset,
            opacity,
            targetOpacity: target
          };
        })
      );
    }, 16);

    return () => clearInterval(interval);
  }, [fadeMode]);

  useEffect(() => {
    if (!fadeMode) return;

    setVisibleAssetIds((prev) => {
      const newOrder = [...prev];

      assets.forEach((asset) => {
        if ((asset.opacity ?? 0) > 0.2) {
          const index = newOrder.indexOf(asset.id);
          if (index !== -1) {
            newOrder.splice(index, 1);
            newOrder.push(asset.id);
          }
        }
      });

      return newOrder;
    });
  }, [assets, fadeMode]);

  useEffect(() => {
    const stopTracks = () => {
      if (activeStreamRef.current)
        activeStreamRef.current.getTracks().forEach((t) => t.stop());
      activeStreamRef.current = null;
      if (webcamRef.current) webcamRef.current.srcObject = null;
    };
    const startWebcam = async () => {
      stopTracks();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: cameraFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        activeStreamRef.current = stream;
        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
          webcamRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error("Camera failed", err);
        setWebcamActive(false);
      }
    };
    if (webcamActive) startWebcam();
    else stopTracks();
    return () => stopTracks();
  }, [webcamActive, cameraFacing]);

  const toggleMute = useCallback(async () => {
    if (isMuted) {
      // Currently muted (off), so turn it ON
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });
        micOnlyStreamRef.current = stream;
        setIsMuted(false);

        // If recording, connect to destination
        if (
          isRecordingRef.current &&
          audioContextRef.current &&
          audioDestinationRef.current
        ) {
          const source =
            audioContextRef.current.createMediaStreamSource(stream);
          source.connect(audioDestinationRef.current);
          micSourceNodeRef.current = source;
        }
      } catch (err) {
        console.warn("Mic permission denied");
        // Keep isMuted as true
      }
    } else {
      // Currently unmuted (on), so turn it OFF
      if (micOnlyStreamRef.current) {
        micOnlyStreamRef.current.getTracks().forEach((t) => t.stop());
        micOnlyStreamRef.current = null;
      }
      if (micSourceNodeRef.current) {
        micSourceNodeRef.current.disconnect();
        micSourceNodeRef.current = null;
      }
      setIsMuted(true);
    }
  }, [isMuted]);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width,
      h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    // Helper to draw webcam
    const drawWebcam = (isFloating: boolean) => {
      if (webcamActive && (webcamRef.current?.readyState ?? 0) >= 2) {
        const v = webcamRef.current;
        if (!v) return;
        const vRatio = v.videoWidth / v.videoHeight;

        ctx.save();

        if (isFloating) {
          // Floating Mode
          const trans = webcamTransform;
          const baseDrawW = w * (trans.scale / 100);
          const baseDrawH = baseDrawW / vRatio; // Keep original aspect ratio

          const drawX = w * (trans.x / 100) - baseDrawW / 2;
          const drawY = h * (trans.y / 100) - baseDrawH / 2;

          // Shadow/Border for floating cam
          ctx.shadowColor = "rgba(0,0,0,0.5)";
          ctx.shadowBlur = 20;
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;

          if (webcamFlipped) {
            ctx.translate(drawX + baseDrawW, drawY);
            ctx.scale(-1, 1);
            ctx.drawImage(v, 0, 0, baseDrawW, baseDrawH);
          } else {
            ctx.drawImage(v, drawX, drawY, baseDrawW, baseDrawH);
          }

          // Reset transform for border
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.strokeRect(drawX, drawY, baseDrawW, baseDrawH);
        } else {
          // Fullscreen Mode (Background)
          const targetRatio = w / h;
          let sw, sh, sx, sy;
          if (vRatio > targetRatio) {
            sh = v.videoHeight;
            sw = sh * targetRatio;
            sx = (v.videoWidth - sw) / 2;
            sy = 0;
          } else {
            sw = v.videoWidth;
            sh = sw / targetRatio;
            sx = 0;
            sy = (v.videoHeight - sh) / 2;
          }
          ctx.save();

          if (webcamFlipped) {
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(v, sx, sy, sw, sh, 0, 0, w, h);
        }
        ctx.restore();
      }
    };

    // 1. Draw Webcam if Fullscreen (Background)
    if (webcamMode === "fullscreen") {
      drawWebcam(false);
    }

    const renderOrder = [...visibleAssetIds];
    renderOrder.forEach((id) => {
      const asset = assets.find((a) => a.id === id);
      if (!asset) return;
      const source =
        asset.type === "video" ? videoRef.current : imageCache.current.get(id);
      if (
        source &&
        (asset.type === "image" || (source as HTMLVideoElement).readyState >= 1)
      ) {
        const sW = asset.width,
          sH = asset.height,
          trans = asset.transform;
        const swActual = sW * (1 - (trans.cropLeft + trans.cropRight) / 100),
          shActual = sH * (1 - (trans.cropTop + trans.cropBottom) / 100);
        const baseDrawW = w * (trans.scale / 100),
          baseDrawH = baseDrawW * (sH / sW);
        const drawW = baseDrawW * (swActual / sW),
          drawH = baseDrawH * (shActual / sH);
        let drawX,
          drawY,
          finalW = drawW,
          finalH = drawH;
        if (asset.fullFrame) {
          const aR = swActual / shActual,
            fR = w / h;
          if (aR > fR) {
            finalW = w;
            finalH = w / aR;
          } else {
            finalH = h;
            finalW = h * aR;
          }
          drawX = (w - finalW) / 2;
          drawY = (h - finalH) / 2;
        } else {
          drawX = w * (trans.x / 100) - drawW / 2;
          drawY = h * (trans.y / 100) - drawH / 2;
        }
        ctx.save();

        ctx.globalAlpha = fadeMode ? (asset.opacity ?? 1) : 1;

        ctx.beginPath();
        ctx.rect(drawX, drawY, finalW, finalH);
        ctx.clip();
        ctx.drawImage(
          source as CanvasImageSource,
          sW * (trans.cropLeft / 100),
          sH * (trans.cropTop / 100),
          swActual,
          shActual,
          drawX,
          drawY,
          finalW,
          finalH
        );

        // Helper to convert source-relative points to canvas coordinates
        const sourceToCanvas = (pt: Point) => {
          const cropW = 1 - (trans.cropLeft + trans.cropRight) / 100;
          const cropH = 1 - (trans.cropTop + trans.cropBottom) / 100;

          // Relative position within the visible crop (0 to 1)
          const relX = (pt.x - trans.cropLeft / 100) / cropW;
          const relY = (pt.y - trans.cropTop / 100) / cropH;

          return {
            x: drawX + relX * finalW,
            y: drawY + relY * finalH
          };
        };

        // Render Blur Effects
        if (asset.effects) {
          asset.effects.forEach((effect) => {
            if (effect.type === "blur") {
              let rx = effect.rect.x;
              let ry = effect.rect.y;

              // Real-time Template Matching Tracking
              if (
                effect.isTracked &&
                effect.trackingId &&
                asset.type === "video" &&
                videoRef.current &&
                trackingState.current.has(effect.trackingId)
              ) {
                const tracker = trackingState.current.get(effect.trackingId)!;
                const vid = videoRef.current;

                // Perform tracking update (simple template matching)
                // We do this every frame. For optimization, could skip frames.

                // 1. Define search window around last known position
                // Search range: +/- 10% of video dimension or fixed pixels?
                // Let's use fixed pixels for stability. +/- 20px.
                const searchRange = 20;
                const tw = tracker.tWidth;
                const th = tracker.tHeight;

                // Current position in video pixels
                const curX = tracker.lastX * vid.videoWidth;
                const curY = tracker.lastY * vid.videoHeight;

                // Search bounds
                const searchX = Math.max(0, curX - searchRange);
                const searchY = Math.max(0, curY - searchRange);
                const searchW = Math.min(
                  vid.videoWidth - searchX,
                  tw + searchRange * 2
                );
                const searchH = Math.min(
                  vid.videoHeight - searchY,
                  th + searchRange * 2
                );

                // Use a shared canvas for processing to avoid creating one every frame
                if (!trackingCanvasRef.current) {
                  trackingCanvasRef.current = document.createElement("canvas");
                }
                const tc = trackingCanvasRef.current;
                if (tc.width < searchW || tc.height < searchH) {
                  tc.width = Math.max(tc.width, searchW);
                  tc.height = Math.max(tc.height, searchH);
                }
                const tCtx = tc.getContext("2d", { willReadFrequently: true });

                if (tCtx) {
                  tCtx.drawImage(
                    vid,
                    searchX,
                    searchY,
                    searchW,
                    searchH,
                    0,
                    0,
                    searchW,
                    searchH
                  );
                  const searchData = tCtx.getImageData(
                    0,
                    0,
                    searchW,
                    searchH
                  ).data;
                  const template = tracker.template;

                  let minSAD = Infinity;
                  let bestX = 0;
                  let bestY = 0;

                  // SAD (Sum of Absolute Differences) Loop
                  // Step size 2 for performance
                  for (let y = 0; y <= searchH - th; y += 2) {
                    for (let x = 0; x <= searchW - tw; x += 2) {
                      let sad = 0;
                      // Subsample pixels for performance (check every 4th pixel)
                      for (let i = 0; i < th; i += 4) {
                        for (let j = 0; j < tw; j += 4) {
                          const tIdx = (i * tw + j) * 4;
                          const sIdx = ((y + i) * searchW + (x + j)) * 4;
                          sad += Math.abs(template[tIdx] - searchData[sIdx]); // R
                          sad += Math.abs(
                            template[tIdx + 1] - searchData[sIdx + 1]
                          ); // G
                          sad += Math.abs(
                            template[tIdx + 2] - searchData[sIdx + 2]
                          ); // B
                        }
                        if (sad > minSAD) break; // Optimization: Early exit
                      }

                      if (sad < minSAD) {
                        minSAD = sad;
                        bestX = x;
                        bestY = y;
                      }
                    }
                  }

                  // Update position
                  // New center relative to search window -> relative to video -> normalized
                  const newVidX = searchX + bestX;
                  const newVidY = searchY + bestY;

                  // Smooth update (Exponential Moving Average) to reduce jitter
                  const smoothFactor = 0.5;
                  tracker.lastX =
                    tracker.lastX * (1 - smoothFactor) +
                    (newVidX / vid.videoWidth) * smoothFactor;
                  tracker.lastY =
                    tracker.lastY * (1 - smoothFactor) +
                    (newVidY / vid.videoHeight) * smoothFactor;

                  rx = tracker.lastX;
                  ry = tracker.lastY;
                }
              } else if (
                effect.isTracked &&
                asset.type === "video" &&
                videoRef.current
              ) {
                // Fallback to simulation if tracking data missing (shouldn't happen with new logic)
                const t = videoRef.current.currentTime;
                const wobbleX =
                  Math.sin(t * 3.5) * 0.01 + Math.cos(t * 1.2) * 0.01;
                const wobbleY =
                  Math.cos(t * 2.8) * 0.01 + Math.sin(t * 0.9) * 0.01;
                rx += wobbleX;
                ry += wobbleY;
              }

              const p0 = sourceToCanvas({ x: rx, y: ry });
              const p1 = sourceToCanvas({
                x: rx + effect.rect.w,
                y: ry + effect.rect.h
              });

              const bx = Math.min(p0.x, p1.x);
              const by = Math.min(p0.y, p1.y);
              const bw = Math.abs(p1.x - p0.x);
              const bh = Math.abs(p1.y - p0.y);

              ctx.save();
              ctx.beginPath();
              ctx.rect(bx, by, bw, bh);
              ctx.clip();
              ctx.filter = "blur(15px)";
              // Draw the image again to apply blur only to this region
              ctx.drawImage(
                source as CanvasImageSource,
                sW * (trans.cropLeft / 100),
                sH * (trans.cropTop / 100),
                swActual,
                shActual,
                drawX,
                drawY,
                finalW,
                finalH
              );
              ctx.restore();
            }
          });
        }

        // Render Tracking Progress
        if (id === selectedAssetId && isTracking) {
          ctx.save();

          // Simulate tracking box movement during analysis
          let tx = isTracking.rect.x;
          let ty = isTracking.rect.y;
          const t = Date.now() / 1000;
          const wobbleX = Math.sin(t * 10) * 0.005; // Fast jitter
          const wobbleY = Math.cos(t * 8) * 0.005;
          tx += wobbleX;
          ty += wobbleY;

          const p0 = sourceToCanvas({
            x: tx,
            y: ty
          });
          const p1 = sourceToCanvas({
            x: tx + isTracking.rect.w,
            y: ty + isTracking.rect.h
          });

          const bx = Math.min(p0.x, p1.x);
          const by = Math.min(p0.y, p1.y);
          const bw = Math.abs(p1.x - p0.x);
          const bh = Math.abs(p1.y - p0.y);

          // Draw Tracking Box
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(bx, by, bw, bh);

          // Draw Scanning Line
          const scanY = by + bh * ((Date.now() % 1000) / 1000);
          ctx.beginPath();
          ctx.moveTo(bx, scanY);
          ctx.lineTo(bx + bw, scanY);
          ctx.strokeStyle = "rgba(16, 185, 129, 0.8)";
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.stroke();

          // Draw Progress Bar above box
          const barW = 100;
          const barH = 8;
          const barX = bx + bw / 2 - barW / 2;
          const barY = by - 20;

          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

          ctx.fillStyle = "#34d399";
          ctx.fillRect(barX, barY, barW * (isTracking.progress / 100), barH);

          ctx.font = "bold 10px sans-serif";
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.fillText(
            `ANALYZING ${Math.floor(isTracking.progress)}%`,
            barX + barW / 2,
            barY - 5
          );

          ctx.restore();
        }

        // Render Selection Lasso (Magic Mode)
        if (
          id === selectedAssetId &&
          activePath.length > 0 &&
          (magicMode === "blur_selecting" || magicMode === "cut_selecting")
        ) {
          ctx.save();
          ctx.beginPath();

          const p0 = sourceToCanvas(activePath[0]);
          ctx.moveTo(p0.x, p0.y);

          for (let i = 1; i < activePath.length; i++) {
            const pi = sourceToCanvas(activePath[i]);
            ctx.lineTo(pi.x, pi.y);
          }

          // DO NOT close path while drawing
          ctx.strokeStyle =
            magicMode === "blur_selecting" ? "#f59e0b" : "#ec4899"; // Amber for blur, Pink for cut
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 5]);

          if (!isDraggingRef.current) {
            ctx.closePath();
            ctx.stroke();
            ctx.fillStyle = "rgba(34, 197, 94, 0.4)";
            ctx.fill();
          } else {
            ctx.stroke();
          }

          ctx.restore();
        }

        const allDrawings = [...asset.drawings];
        if (id === selectedAssetId && activePath.length > 0 && isDrawingMode) {
          allDrawings.push({
            shape: drawingShape,
            points: activePath,
            color: "#eaff00",
            width: 8
          });
        }

        allDrawings.forEach((item) => {
          if (item.points.length < 1) return;
          ctx.beginPath();
          ctx.strokeStyle = item.color;
          ctx.lineWidth = item.width;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.shadowBlur = 10;
          ctx.shadowColor = item.color;

          const p0 = sourceToCanvas(item.points[0]);

          if (item.shape === "free") {
            ctx.moveTo(p0.x, p0.y);
            for (let i = 1; i < item.points.length; i++) {
              const pi = sourceToCanvas(item.points[i]);
              ctx.lineTo(pi.x, pi.y);
            }
            ctx.stroke();
          } else if (item.shape === "circle" && item.points.length >= 2) {
            const p1 = sourceToCanvas(item.points[1]);
            ctx.arc(
              p0.x,
              p0.y,
              Math.hypot(p1.x - p0.x, p1.y - p0.y),
              0,
              Math.PI * 2
            );
            ctx.stroke();
          } else if (item.shape === "square" && item.points.length >= 2) {
            const p1 = sourceToCanvas(item.points[1]);
            const side = Math.hypot(p1.x - p0.x, p1.y - p0.y);
            ctx.strokeRect(p0.x - side, p0.y - side, side * 2, side * 2);
          } else if (item.shape === "arrow" && item.points.length >= 2) {
            const p1 = sourceToCanvas(item.points[1]);
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p0.x, p0.y);
            ctx.stroke();
            const angle = Math.atan2(p0.y - p1.y, p0.x - p1.x);
            const hLen = 65,
              hAng = Math.PI / 4;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(
              p0.x - hLen * Math.cos(angle - hAng),
              p0.y - hLen * Math.sin(angle - hAng)
            );
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(
              p0.x - hLen * Math.cos(angle + hAng),
              p0.y - hLen * Math.sin(angle + hAng)
            );
            ctx.stroke();
          }
        });

        // AI Processing Indicator
        if (id === selectedAssetId && isAiProcessing) {
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(drawX, drawY, finalW, finalH);
          ctx.font = "bold 80px sans-serif";
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.fillText(
            "MAGIC CUTOUT...",
            drawX + finalW / 2,
            drawY + finalH / 2
          );
        }

        ctx.restore();
        ctx.globalAlpha = 1;
        // CLEAN FEED LOGIC: Only draw border/handles if NOT recording
        if (
          id === selectedAssetId &&
          !isLocked &&
          !selectedAsset?.fullFrame &&
          !isDrawingMode &&
          !isAiProcessing &&
          !isRecordingRef.current
        ) {
          ctx.save();
          ctx.shadowColor = "rgba(16, 185, 129, 0.5)";
          ctx.shadowBlur = 20;
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 4;
          ctx.strokeRect(drawX, drawY, finalW, finalH);
          ctx.fillStyle = "#10b981";
          ctx.shadowBlur = 0;
          const hSize = 50,
            hThick = 15;
          ctx.fillRect(
            drawX + finalW / 2 - hSize / 2,
            drawY - hThick / 2,
            hSize,
            hThick
          );
          ctx.fillRect(
            drawX + finalW / 2 - hSize / 2,
            drawY + finalH - hThick / 2,
            hSize,
            hThick
          );
          ctx.fillRect(
            drawX - hThick / 2,
            drawY + finalH / 2 - hSize / 2,
            hThick,
            hSize
          );
          ctx.fillRect(
            drawX + finalW - hThick / 2,
            drawY + finalH / 2 - hSize / 2,
            hThick,
            hSize
          );
          ctx.restore();
        }
      }
    });

    // 2. Draw Webcam if Floating (Foreground)
    if (webcamMode === "floating") {
      drawWebcam(true);
    }

    // Render Text Items
    textItems.forEach((item) => {
      if (isEditingText && item.id === activeTextId) return;
      ctx.save();
      const fontSize = 80 * (item.scale / 100);
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillStyle = item.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const x = 1080 * item.x;
      const y = 1920 * item.y;

      // Shadow for visibility
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      ctx.fillText(item.text, x, y);

      // Selection box if active and in text mode
      if (isTextMode && item.id === activeTextId) {
        const textMetrics = ctx.measureText(item.text);
        const w = textMetrics.width;
        const h = fontSize; // Approximate height

        ctx.strokeStyle = "#eaff00";
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 10]);
        ctx.strokeRect(x - w / 2 - 30, y - h / 2 - 30, w + 60, h + 60);

        // Resize Handle
        ctx.setLineDash([]);
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#eaff00";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x + w / 2 + 30, y + h / 2 + 30, 35, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Delete Handle (Top-Left)
        ctx.fillStyle = "#ef4444"; // Red
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x - w / 2 - 30, y - h / 2 - 30, 35, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw X
        ctx.beginPath();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        const dx = x - w / 2 - 30;
        const dy = y - h / 2 - 30;
        const r = 10;
        ctx.moveTo(dx - r, dy - r);
        ctx.lineTo(dx + r, dy + r);
        ctx.moveTo(dx + r, dy - r);
        ctx.lineTo(dx - r, dy + r);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 3. Draw Watermark
    if (showWatermark || !watermarkUnlocked) {
      ctx.save();
      ctx.font = "900 30px 'Inter', sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fillText("DIRECTOR'S CUT", canvas.width - 100, canvas.height - 1);
      ctx.restore();
    }

    requestRef.current = requestAnimationFrame(drawFrame);
  }, [
    visibleAssetIds,
    assets,
    selectedAssetId,
    webcamActive,
    webcamFlipped,
    webcamMode,
    webcamTransform,
    isLocked,
    selectedAsset?.fullFrame,
    isDrawingMode,
    drawingShape,
    isAiProcessing,
    isRecording,
    activePath,
    showWatermark,
    textItems,
    activeTextId,
    isTextMode
  ]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [drawFrame]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAiProcessing || isFinalizing || isReviewing) return;

    if (e.type === "touchstart") {
      lastTouchTimeRef.current = Date.now();
    }

    // Prevent default to avoid double-firing with mouse events on touch devices
    if (e.cancelable !== false && e.preventDefault) {
      e.preventDefault();
    }

    isDraggingRef.current = false;
    const clientX = e.touches[0].clientX,
      clientY = e.touches[0].clientY;

    initialTouchRef.current = { x: clientX, y: clientY };

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvas = canvasRef.current!;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    // Webcam Floating Interaction
    if (webcamActive && webcamMode === "floating") {
      const trans = webcamTransform;
      const v = webcamRef.current;
      const vRatio = v ? v.videoWidth / v.videoHeight : 16 / 9;
      const baseDrawW = 1080 * (trans.scale / 100);
      const baseDrawH = baseDrawW / vRatio;
      const dX = 1080 * (trans.x / 100) - baseDrawW / 2;
      const dY = 1920 * (trans.y / 100) - baseDrawH / 2;

      if (
        canvasX >= dX &&
        canvasX <= dX + baseDrawW &&
        canvasY >= dY &&
        canvasY <= dY + baseDrawH
      ) {
        e.preventDefault();

        // Triple Tap Detection for Webcam Flip
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          tapCountRef.current += 1;
        } else {
          tapCountRef.current = 1;
        }
        lastTapRef.current = now;

        if (tapCountRef.current === 3) {
          setWebcamFlipped((prev) => !prev);
          tapCountRef.current = 0;
          return;
        }

        isDraggingWebcamRef.current = true;
        dragStartTransformRef.current = { ...webcamTransform };
        startTouchRef.current = {
          ...startTouchRef.current,
          x: clientX,
          y: clientY,
          scale: trans.scale,
          dist: 0 // Will be set if pinching
        };

        if (e.touches.length === 2) {
          setIsPinching(true);
          startTouchRef.current.dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        }
        return;
      }
    }

    // Text Mode Interaction
    if (isTextMode) {
      e.preventDefault();
      let hitTextId = null;
      let isResizeHandle = false;
      let isDeleteHandle = false;

      const ctx = canvas.getContext("2d");
      for (let i = textItems.length - 1; i >= 0; i--) {
        const item = textItems[i];
        const fontSize = 80 * (item.scale / 100);
        let textWidth = 0;
        if (ctx) {
          ctx.font = `bold ${fontSize}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          textWidth = ctx.measureText(item.text).width;
        } else {
          textWidth = item.text.length * fontSize * 0.6;
        }
        const textHeight = fontSize;
        const itemX = 1080 * item.x;
        const itemY = 1920 * item.y;

        // Check Handles (only for active item)
        if (activeTextId === item.id) {
          const handleX = itemX + textWidth / 2 + 30;
          const handleY = itemY + textHeight / 2 + 30;
          const dist = Math.hypot(canvasX - handleX, canvasY - handleY);
          if (dist < 70) {
            hitTextId = item.id;
            isResizeHandle = true;
            break;
          }

          // Delete Handle (Top-Left)
          const deleteX = itemX - textWidth / 2 - 30;
          const deleteY = itemY - textHeight / 2 - 30;
          const distDelete = Math.hypot(canvasX - deleteX, canvasY - deleteY);
          if (distDelete < 70) {
            hitTextId = item.id;
            isDeleteHandle = true;
            break;
          }
        }

        const padding = 40;
        const left = itemX - textWidth / 2 - padding;
        const right = itemX + textWidth / 2 + padding;
        const top = itemY - textHeight / 2 - padding;
        const bottom = itemY + textHeight / 2 + padding;

        if (
          canvasX >= left &&
          canvasX <= right &&
          canvasY >= top &&
          canvasY <= bottom
        ) {
          hitTextId = item.id;
          break;
        }
      }

      if (hitTextId) {
        if (isDeleteHandle) {
          setTextItems((prev) => prev.filter((t) => t.id !== hitTextId));
          if (activeTextId === hitTextId) {
            setActiveTextId(null);
            lastActiveTextIdRef.current = null;
          }
          return;
        }

        if (isResizeHandle) {
          isResizingTextRef.current = true;
          setActiveTextId(hitTextId);
          startTouchRef.current = {
            ...startTouchRef.current,
            x: clientX,
            y: clientY,
            scale: textItems.find((t) => t.id === hitTextId)!.scale,
            dist: 0 // Not used for single touch resize
          };
          return;
        }

        const now = Date.now();
        if (now - lastTapRef.current < 300 && activeTextId === hitTextId) {
          setEditingTextValue(textItems.find((t) => t.id === hitTextId)!.text);
          setIsEditingText(true);
          return;
        }
        lastTapRef.current = now;

        setActiveTextId(hitTextId);
        lastActiveTextIdRef.current = hitTextId;
        isDraggingRef.current = true;
        startTouchRef.current = {
          ...startTouchRef.current,
          x: clientX,
          y: clientY,
          scale: textItems.find((t) => t.id === hitTextId)!.scale,
          dist: 0
        };
        if (e.touches.length === 2) {
          setIsPinching(true);
          startTouchRef.current.dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        }
      } else {
        if (activeTextId) {
          // If text is selected, deselect it and STOP propagation (do NOT play video)
          setActiveTextId(null);
          setIsEditingText(false);
          return;
        } else {
          // No text hit, no text selected.
          // Allow fall-through to video playback logic in handleTouchEnd.
          // We need to set startTouchRef so handleTouchEnd detects it as a tap.
          startTouchRef.current = {
            ...startTouchRef.current,
            x: clientX,
            y: clientY,
            scale: 100,
            dist: 0
          };
          // Do NOT return, let it fall through to asset interaction logic setup
        }
      }
      if (hitTextId) return;
    }

    // Magic Selection Logic
    if (
      (magicMode === "blur_selecting" || magicMode === "cut_selecting") &&
      selectedAssetId
    ) {
      e.preventDefault();

      // Calculate asset-relative coordinates
      const trans = selectedAsset!.transform;
      const swActual =
        selectedAsset!.width * (1 - (trans.cropLeft + trans.cropRight) / 100);
      const shActual =
        selectedAsset!.height * (1 - (trans.cropTop + trans.cropBottom) / 100);
      const drawW =
        1080 * (trans.scale / 100) * (swActual / selectedAsset!.width);
      const drawH =
        1080 *
        (trans.scale / 100) *
        (selectedAsset!.height / selectedAsset!.width) *
        (shActual / selectedAsset!.height);

      let dX,
        dY,
        fW = drawW,
        fH = drawH;

      if (selectedAsset?.fullFrame) {
        const aR = swActual / shActual;
        const fR = 1080 / 1920;
        if (aR > fR) {
          fW = 1080;
          fH = 1080 / aR;
        } else {
          fH = 1920;
          fW = 1920 * aR;
        }
        dX = (1080 - fW) / 2;
        dY = (1920 - fH) / 2;
      } else {
        dX = 1080 * (trans.x / 100) - drawW / 2;
        dY = 1920 * (trans.y / 100) - drawH / 2;
      }

      // Check if touch is inside asset bounds
      if (
        canvasX >= dX &&
        canvasX <= dX + fW &&
        canvasY >= dY &&
        canvasY <= dY + fH
      ) {
        const rX = (canvasX - dX) / fW;
        const rY = (canvasY - dY) / fH;

        // Convert to normalized asset coordinates (0-1) considering crop
        const normX =
          trans.cropLeft / 100 +
          rX * (1 - (trans.cropLeft + trans.cropRight) / 100);
        const normY =
          trans.cropTop / 100 +
          rY * (1 - (trans.cropTop + trans.cropBottom) / 100);

        setActivePath([{ x: normX, y: normY }]);
      } else {
        setActivePath([]);
      }
      return;
    }

    if (isDrawingMode) {
      e.preventDefault();
      if (!selectedAssetId) return;
      const trans = selectedAsset!.transform,
        swActual =
          selectedAsset!.width * (1 - (trans.cropLeft + trans.cropRight) / 100),
        shActual =
          selectedAsset!.height *
          (1 - (trans.cropTop + trans.cropBottom) / 100);
      const drawW =
          1080 * (trans.scale / 100) * (swActual / selectedAsset!.width),
        drawH =
          1080 *
          (trans.scale / 100) *
          (selectedAsset!.height / selectedAsset!.width) *
          (shActual / selectedAsset!.height);
      let dX,
        dY,
        fW = drawW,
        fH = drawH;
      if (selectedAsset?.fullFrame) {
        const aR = swActual / shActual,
          fR = 1080 / 1920;
        if (aR > fR) {
          fW = 1080;
          fH = 1080 / aR;
        } else {
          fH = 1920;
          fW = 1920 * aR;
        }
        dX = (1080 - fW) / 2;
        dY = (1920 - fH) / 2;
      } else {
        dX = 1080 * (trans.x / 100) - drawW / 2;
        dY = 1920 * (trans.y / 100) - drawH / 2;
      }
      if (
        canvasX >= dX &&
        canvasX <= dX + fW &&
        canvasY >= dY &&
        canvasY <= dY + fH
      ) {
        const rX = (canvasX - dX) / fW,
          rY = (canvasY - dY) / fH;
        setActivePath([
          {
            x:
              trans.cropLeft / 100 +
              rX * (1 - (trans.cropLeft + trans.cropRight) / 100),
            y:
              trans.cropTop / 100 +
              rY * (1 - (trans.cropTop + trans.cropBottom) / 100)
          }
        ]);
      }
      return;
    }
    if (!selectedAssetId) return;

    if (e.touches.length === 1) {
      startTouchRef.current = {
        ...startTouchRef.current,
        x: clientX,
        y: clientY
      };
      if (selectedAsset) {
        dragStartTransformRef.current = { ...selectedAsset.transform };
      }

      if (isLocked || selectedAsset?.fullFrame) return;

      const trans = selectedAsset!.transform,
        swActual =
          selectedAsset!.width * (1 - (trans.cropLeft + trans.cropRight) / 100),
        shActual =
          selectedAsset!.height *
          (1 - (trans.cropTop + trans.cropBottom) / 100);
      const drawW =
          1080 * (trans.scale / 100) * (swActual / selectedAsset!.width),
        drawH =
          1080 *
          (trans.scale / 100) *
          (selectedAsset!.height / selectedAsset!.width) *
          (shActual / selectedAsset!.height);
      const dX = 1080 * (trans.x / 100) - drawW / 2,
        dY = 1920 * (trans.y / 100) - drawH / 2,
        h = 100;
      if (Math.abs(canvasY - dY) < h) setGrabbedPart("top");
      else if (Math.abs(canvasY - (dY + drawH)) < h) setGrabbedPart("bottom");
      else if (Math.abs(canvasX - dX) < h) setGrabbedPart("left");
      else if (Math.abs(canvasX - (dX + drawW)) < h) setGrabbedPart("right");
      else if (
        canvasX > dX &&
        canvasX < dX + drawW &&
        canvasY > dY &&
        canvasY < dY + drawH
      )
        setGrabbedPart("move");
    } else if (e.touches.length === 2) {
      if (isLocked || selectedAsset?.fullFrame) return;
      setIsPinching(true);
      startTouchRef.current = {
        ...startTouchRef.current,
        dist: Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        ),
        scale: selectedAsset?.transform.scale || 65
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isAiProcessing || isFinalizing || isReviewing) return;

    if (e.type === "touchmove") {
      lastTouchTimeRef.current = Date.now();
    }

    const clientX = e.touches[0].clientX,
      clientY = e.touches[0].clientY;

    // Handle Webcam Dragging
    if (isDraggingWebcamRef.current) {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const canvas = canvasRef.current!;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      if (e.touches.length === 1 && !isPinching) {
        const dx = (clientX - startTouchRef.current.x) * scaleX;
        const dy = (clientY - startTouchRef.current.y) * scaleY;
        const trans = dragStartTransformRef.current;

        setWebcamTransform({
          ...trans,
          x: trans.x + (dx / 1080) * 100,
          y: trans.y + (dy / 1920) * 100
        });
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scaleFactor = dist / (startTouchRef.current.dist || 1);
        const newScale = Math.min(
          100,
          Math.max(10, startTouchRef.current.scale * scaleFactor)
        );

        setWebcamTransform((prev) => ({
          ...prev,
          scale: newScale
        }));
      }
      return;
    }

    if (!isDraggingRef.current) {
      const dist = Math.hypot(
        clientX - initialTouchRef.current.x,
        clientY - initialTouchRef.current.y
      );
      if (dist > 5) {
        isDraggingRef.current = true;
      } else {
        return;
      }
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvas = canvasRef.current!;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const cX = (clientX - rect.left) * scaleX;
    const cY = (clientY - rect.top) * scaleY;

    // Text Mode Move/Scale
    if (isTextMode && activeTextId) {
      e.preventDefault();

      if (isResizingTextRef.current) {
        const item = textItems.find((t) => t.id === activeTextId);
        if (item) {
          const itemX = 1080 * item.x; // Center X
          const itemY = 1920 * item.y; // Center Y

          // Convert start touch to canvas coords
          const startCanvasX = (startTouchRef.current.x - rect.left) * scaleX;
          const startCanvasY = (startTouchRef.current.y - rect.top) * scaleY;

          // Convert current touch to canvas coords
          const currentCanvasX = cX; // calculated above as (clientX - rect.left) * scaleX
          const currentCanvasY = cY;

          const initialDist = Math.hypot(
            startCanvasX - itemX,
            startCanvasY - itemY
          );
          const currentDist = Math.hypot(
            currentCanvasX - itemX,
            currentCanvasY - itemY
          );

          if (initialDist > 0) {
            const scaleFactor = currentDist / initialDist;
            const newScale = Math.max(
              10,
              startTouchRef.current.scale * scaleFactor
            );

            setTextItems((prev) =>
              prev.map((t) => {
                if (t.id === activeTextId) {
                  return { ...t, scale: newScale };
                }
                return t;
              })
            );
          }
        }
        return;
      }

      if (e.touches.length === 1 && !isPinching) {
        const dx = (clientX - startTouchRef.current.x) * scaleX;
        const dy = (clientY - startTouchRef.current.y) * scaleY;

        setTextItems((prev) =>
          prev.map((item) => {
            if (item.id === activeTextId) {
              return {
                ...item,
                x: item.x + dx / 1080,
                y: item.y + dy / 1920
              };
            }
            return item;
          })
        );
        startTouchRef.current = {
          ...startTouchRef.current,
          x: clientX,
          y: clientY
        };
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scaleFactor = dist / (startTouchRef.current.dist || 1);
        setTextItems((prev) =>
          prev.map((item) => {
            if (item.id === activeTextId) {
              return {
                ...item,
                scale: Math.max(10, startTouchRef.current.scale * scaleFactor)
              };
            }
            return item;
          })
        );
      }
      return;
    }

    // Magic Selection Logic (Rectangle)
    if (
      (magicMode === "blur_selecting" || magicMode === "cut_selecting") &&
      selectedAssetId
    ) {
      e.preventDefault();
      const canvas = canvasRef.current!;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const cX = (clientX - rect.left) * scaleX;
      const cY = (clientY - rect.top) * scaleY;

      const trans = selectedAsset!.transform,
        swActual =
          selectedAsset!.width * (1 - (trans.cropLeft + trans.cropRight) / 100),
        shActual =
          selectedAsset!.height *
          (1 - (trans.cropTop + trans.cropBottom) / 100);
      const drawW =
          1080 * (trans.scale / 100) * (swActual / selectedAsset!.width),
        drawH =
          1080 *
          (trans.scale / 100) *
          (selectedAsset!.height / selectedAsset!.width) *
          (shActual / selectedAsset!.height);
      let dX,
        dY,
        fW = drawW,
        fH = drawH;
      if (selectedAsset?.fullFrame) {
        const aR = swActual / shActual,
          fR = 1080 / 1920;
        if (aR > fR) {
          fW = 1080;
          fH = 1080 / aR;
        } else {
          fH = 1920;
          fW = 1920 * aR;
        }
        dX = (1080 - fW) / 2;
        dY = (1920 - fH) / 2;
      } else {
        dX = 1080 * (trans.x / 100) - drawW / 2;
        dY = 1920 * (trans.y / 100) - drawH / 2;
      }

      // Clamp coordinates to asset bounds for smooth edge drawing
      const clampedX = Math.max(dX, Math.min(dX + fW, cX));
      const clampedY = Math.max(dY, Math.min(dY + fH, cY));

      const rX = (clampedX - dX) / fW,
        rY = (clampedY - dY) / fH;

      // Start point is already in activePath[0]
      if (activePath.length > 0) {
        const startPt = activePath[0];
        const currentPt = {
          x:
            trans.cropLeft / 100 +
            rX * (1 - (trans.cropLeft + trans.cropRight) / 100),
          y:
            trans.cropTop / 100 +
            rY * (1 - (trans.cropTop + trans.cropBottom) / 100)
        };

        // Create rectangle path: Start -> TopRight -> BottomRight -> BottomLeft -> Start
        // Actually, we just need 4 points to define the rect for rendering
        // But for the rect calculation we just need min/max

        // Let's store the 4 corners so it draws as a rect
        // But to keep it simple for the state, we can just store Start and Current,
        // and calculate the 4 corners in the render loop?
        // The previous code expects activePath to be the points to draw.
        // So let's generate the 4 points.

        const p0 = startPt;
        const p2 = currentPt;
        const p1 = { x: p2.x, y: p0.y };
        const p3 = { x: p0.x, y: p2.y };

        setActivePath([p0, p1, p2, p3, p0]);
      }
      return;
    }

    if (isDrawingMode) {
      e.preventDefault();
      if (!selectedAssetId || activePath.length === 0) return;
      const canvas = canvasRef.current!;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const cX = (clientX - rect.left) * scaleX;
      const cY = (clientY - rect.top) * scaleY;
      const trans = selectedAsset!.transform,
        swActual =
          selectedAsset!.width * (1 - (trans.cropLeft + trans.cropRight) / 100),
        shActual =
          selectedAsset!.height *
          (1 - (trans.cropTop + trans.cropBottom) / 100);
      const drawW =
          1080 * (trans.scale / 100) * (swActual / selectedAsset!.width),
        drawH =
          1080 *
          (trans.scale / 100) *
          (selectedAsset!.height / selectedAsset!.width) *
          (shActual / selectedAsset!.height);
      let dX,
        dY,
        fW = drawW,
        fH = drawH;
      if (selectedAsset?.fullFrame) {
        const aR = swActual / shActual,
          fR = 1080 / 1920;
        if (aR > fR) {
          fW = 1080;
          fH = 1080 / aR;
        } else {
          fH = 1920;
          fW = 1920 * aR;
        }
        dX = (1080 - fW) / 2;
        dY = (1920 - fH) / 2;
      } else {
        dX = 1080 * (trans.x / 100) - drawW / 2;
        dY = 1920 * (trans.y / 100) - drawH / 2;
      }
      const rX = (Math.max(dX, Math.min(dX + fW, cX)) - dX) / fW,
        rY = (Math.max(dY, Math.min(dY + fH, cY)) - dY) / fH;
      const newPt = {
        x:
          trans.cropLeft / 100 +
          rX * (1 - (trans.cropLeft + trans.cropRight) / 100),
        y:
          trans.cropTop / 100 +
          rY * (1 - (trans.cropTop + trans.cropBottom) / 100)
      };
      if (drawingShape === "free") {
        setActivePath((prev) => [...prev, newPt]);
      } else {
        setActivePath((prev) => [prev[0], newPt]);
      }
      return;
    }
    if (isLocked || selectedAsset?.fullFrame || !selectedAssetId) return;
    if (grabbedPart && e.touches.length === 1) {
      const dx = (clientX - startTouchRef.current.x) * scaleX,
        dy = (clientY - startTouchRef.current.y) * scaleY;
      const trans = { ...dragStartTransformRef.current };
      const baseDrawW = 1080 * (trans.scale / 100);
      const baseDrawH =
        baseDrawW * (selectedAsset!.height / selectedAsset!.width);

      if (grabbedPart === "move") {
        updateAssetTransform(selectedAssetId, {
          x: trans.x + (dx / 1080) * 100,
          y: trans.y + (dy / 1920) * 100
        });
      } else {
        const swAct =
            selectedAsset!.width *
            (1 - (trans.cropLeft + trans.cropRight) / 100),
          shAct =
            selectedAsset!.height *
            (1 - (trans.cropTop + trans.cropBottom) / 100);

        // Calculate original bounding box from initial transform
        const xL =
            (1080 * trans.x) / 100 -
            (baseDrawW * swAct) / selectedAsset!.width / 2,
          xR =
            (1080 * trans.x) / 100 +
            (baseDrawW * swAct) / selectedAsset!.width / 2;
        const yT =
            (1920 * trans.y) / 100 -
            (baseDrawH * shAct) / selectedAsset!.height / 2,
          yB =
            (1920 * trans.y) / 100 +
            (baseDrawH * shAct) / selectedAsset!.height / 2;

        if (grabbedPart === "left") {
          const nc = Math.max(
            0,
            Math.min(90, trans.cropLeft + (dx / baseDrawW) * 100)
          );
          updateAssetTransform(selectedAssetId, {
            cropLeft: nc,
            x:
              ((xR - (baseDrawW * (1 - (nc + trans.cropRight) / 100)) / 2) /
                1080) *
              100
          });
        } else if (grabbedPart === "right") {
          const nc = Math.max(
            0,
            Math.min(90, trans.cropRight - (dx / baseDrawW) * 100)
          );
          updateAssetTransform(selectedAssetId, {
            cropRight: nc,
            x:
              ((xL + (baseDrawW * (1 - (trans.cropLeft + nc) / 100)) / 2) /
                1080) *
              100
          });
        } else if (grabbedPart === "top") {
          const nc = Math.max(
            0,
            Math.min(90, trans.cropTop + (dy / baseDrawH) * 100)
          );
          updateAssetTransform(selectedAssetId, {
            cropTop: nc,
            y:
              ((yB - (baseDrawH * (1 - (nc + trans.cropBottom) / 100)) / 2) /
                1920) *
              100
          });
        } else if (grabbedPart === "bottom") {
          const nc = Math.max(
            0,
            Math.min(90, trans.cropBottom - (dy / baseDrawH) * 100)
          );
          updateAssetTransform(selectedAssetId, {
            cropBottom: nc,
            y:
              ((yT + (baseDrawH * (1 - (trans.cropTop + nc) / 100)) / 2) /
                1920) *
              100
          });
        }
      }
      // Do NOT update startTouchRef here for single touch drag
    } else if (isPinching && e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      updateAssetTransform(selectedAssetId, {
        scale: Math.min(
          200,
          Math.max(
            10,
            startTouchRef.current.scale *
              (dist / (startTouchRef.current.dist || 1))
          )
        )
      });
    }
  };

  const handleTouchEnd = (e?: any) => {
    if (isAiProcessing || isFinalizing || isReviewing) return;

    if (e && e.type === "touchend") {
      lastTouchTimeRef.current = Date.now();
    }
    if (
      e &&
      e.type === "mouseup" &&
      Date.now() - lastTouchTimeRef.current < 500
    ) {
      return;
    }

    const wasDragging = isDraggingRef.current;
    isResizingTextRef.current = false;

    if (magicMode === "blur_selecting" || magicMode === "cut_selecting") {
      // Just ensure the path is valid, don't apply yet
      if (activePath.length > 0 && selectedAssetId) {
        // Calculate Rect
        const xs = activePath.map((p) => p.x);
        const ys = activePath.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const rect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

        // Check if valid rect (some size)
        if (rect.w > 0.01 && rect.h > 0.01) {
          // Keep the selection for the user to click Apply
        } else {
          // Too small, just clear
          setActivePath([]);
        }
      }
      isDraggingRef.current = false;
      return;
    }

    if (
      !wasDragging &&
      !isPinching &&
      !isDrawingMode &&
      !isTextMode &&
      selectedAssetId &&
      selectedAsset?.type === "video"
    ) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const cX = (startTouchRef.current.x - rect.left) * (1080 / rect.width),
          cY = (startTouchRef.current.y - rect.top) * (1920 / rect.height);
        const trans = selectedAsset!.transform,
          swAct =
            selectedAsset!.width *
            (1 - (trans.cropLeft + trans.cropRight) / 100),
          shAct =
            selectedAsset!.height *
            (1 - (trans.cropTop + trans.cropBottom) / 100);
        const drawW =
            1080 * (trans.scale / 100) * (swAct / selectedAsset!.width),
          drawH =
            1080 *
            (trans.scale / 100) *
            (selectedAsset!.height / selectedAsset!.width) *
            (shAct / selectedAsset!.height);
        let dX,
          dY,
          fW = drawW,
          fH = drawH;
        if (selectedAsset?.fullFrame) {
          // Full frame might have different layout, but usually it fills the 9:16 target
          const aR = swAct / shAct,
            fR = 1080 / 1920;
          if (aR > fR) {
            fW = 1080;
            fH = 1080 / aR;
          } else {
            fH = 1920;
            fW = 1920 * aR;
          }
          dX = (1080 - fW) / 2;
          dY = (1920 - fH) / 2;
        } else {
          dX = 1080 * (trans.x / 100) - drawW / 2;
          dY = 1920 * (trans.y / 100) - drawH / 2;
        }
        if (cX > dX && cX < dX + fW && cY > dY && cY < dY + fH)
          handlePlaybackInteraction();
      }
    }
    if (isDrawingMode && activePath.length > 0 && selectedAssetId) {
      setAssets((p) =>
        p.map((a) =>
          a.id === selectedAssetId
            ? {
                ...a,
                drawings: [
                  ...a.drawings,
                  {
                    shape: drawingShape,
                    points: [...activePath],
                    color: "#eaff00",
                    width: 8
                  }
                ]
              }
            : a
        )
      );
      setActivePath([]); // Clear path after adding drawing
    }
    setGrabbedPart(null);
    setIsPinching(false);
    isDraggingRef.current = false;
    isDraggingWebcamRef.current = false;
    // setActivePath([]); // Removed this global clear to support magic selection persistence
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (Date.now() - lastTouchTimeRef.current < 500) return;
    handleTouchStart({
      touches: [{ clientX: e.clientX, clientY: e.clientY }],
      preventDefault: () => e.preventDefault(),
      stopPropagation: () => e.stopPropagation()
    } as any);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons !== 1) return;
    if (Date.now() - lastTouchTimeRef.current < 500) return;
    handleTouchMove({
      touches: [{ clientX: e.clientX, clientY: e.clientY }],
      preventDefault: () => e.preventDefault(),
      stopPropagation: () => e.stopPropagation()
    } as any);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      // 1. STOPPING RECORDING
      setIsFinalizing(true);
      isRecordingRef.current = false;
      setIsRecording(false);

      // Disable camera and other streams
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((t) => t.stop());
        activeStreamRef.current = null;
        if (webcamRef.current) webcamRef.current.srcObject = null;
      }

      // Web Fallback
      mediaRecorderRef.current?.stop();

      if (recordingIntervalRef.current)
        clearInterval(recordingIntervalRef.current);
      if (videoRef.current) {
        videoRef.current.pause();
        setIsAssetPlaying(false);
      }
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        } catch (err) {}
      }
      if (micOnlyStreamRef.current) {
        micOnlyStreamRef.current.getTracks().forEach((t) => t.stop());
        micOnlyStreamRef.current = null;
      }
    } else if (isRecordConfirming) {
      // 2. STARTING RECORDING
      if (!canvasRef.current) return;
      setIsRecordConfirming(false);
      isRecordingRef.current = true;
      setIsRecording(true);

      if ("wakeLock" in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request(
            "screen"
          );
        } catch (err) {}
      }

      // Web Fallback Logic...
      // 1. Ensure audio context exists
      if (!audioContextRef.current)
        audioContextRef.current = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();

      const audioCtx = audioContextRef.current;
      if (audioCtx.state === "suspended") await audioCtx.resume();

      // 2. Start with canvas stream ONLY
      let stream = canvasRef.current.captureStream(30);

      // 3. Detect available audio sources
      const audioSource = micOnlyStreamRef.current;
      const hasMic =
        audioSource &&
        audioSource.getAudioTracks().length > 0 &&
        audioSource.getAudioTracks()[0].enabled;

      const hasVideoAudio = videoRef.current?.src;

      // 4. ONLY create audio pipeline if needed
      if (hasMic || hasVideoAudio) {
        const dest = audioCtx.createMediaStreamDestination();

        // Mic audio
        if (hasMic) {
          const source = audioCtx.createMediaStreamSource(audioSource!);
          source.connect(dest);
          micSourceNodeRef.current = source;
        }

        // Video audio
        if (hasVideoAudio) {
          if (!videoSourceNodeRef.current) {
            videoSourceNodeRef.current = audioCtx.createMediaElementSource(
              videoRef.current!
            );
            gainNodeRef.current = audioCtx.createGain();
            videoSourceNodeRef.current.connect(gainNodeRef.current);
            gainNodeRef.current.connect(audioCtx.destination);
          }
          gainNodeRef.current!.connect(dest);
        }

        // Attach audio tracks only if they exist
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      }

      // 5. Keep your codec logic
      const mime =
        ["video/mp4;codecs=h264,aac", "video/mp4", "video/webm"].find((m) =>
          MediaRecorder.isTypeSupported(m)
        ) || "video/webm";

      const recorder = new MediaRecorder(stream, { mimeType: mime });

      // 6. Start recorder with delay (IMPORTANT)
      setTimeout(() => recorder.start(1000), 100);

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime });
        setRecordedBlob(blob);
        setReviewVideoUrl(URL.createObjectURL(blob));
        setRecordingTime(0);
        setIsFinalizing(false);
        setIsReviewing(true);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      recordingIntervalRef.current = window.setInterval(
        () => setRecordingTime((p) => p + 1),
        1000
      );
    } else {
      setIsRecordConfirming(true);
      setTimeout(() => setIsRecordConfirming(false), 4000);
    }
  };

  // NEW: Securely Export Native OR Web files
  const handleFinalSave = async () => {
    // 2. Web Fallback (If not using ReplayKit)
    if (!recordedBlob) return;
    setIsFinalizing(true);
    setIsAssetPlaying(false);

    try {
      // Helper function to safely trigger the iOS Share Sheet
    const saveOrShareBlob = async (targetBlob: Blob, isEdited = false) => {
        // FORCE the correct video MIME type so iOS accepts it!
        const mimeType =
          targetBlob.type && targetBlob.type !== "application/octet-stream"
            ? targetBlob.type
            : "video/mp4";

        const fileExt = mimeType.includes("webm") ? "webm" : "mp4";
        const fileName = `directors-cut-${isEdited ? "edited-" : ""}${Date.now()}.${fileExt}`;

        const validBlob = new Blob([targetBlob], { type: mimeType });
        const file = new File([validBlob], fileName, { type: mimeType });

        if (
          navigator.share &&
          navigator.canShare &&
          navigator.canShare({ files: [file] })
        ) {
          try {
          await navigator.share({
            files: [file],
            title: "My Reaction",
            text: "Made with Director's Cut"
          });
          return;
          } catch (err) {}
        } else {
        const url = URL.createObjectURL(validBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    };

      if (
        reviewPlaybackRate === 1 &&
        trimRange[0] === 0 &&
        trimRange[1] === 1
      ) {
        await saveOrShareBlob(recordedBlob, false);
        setIsFinalizing(false);
        return;
      }

      const video = document.createElement("video");
      video.src = URL.createObjectURL(recordedBlob);
      video.muted = false;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      await new Promise((r) => {
        video.onloadedmetadata = r;
      });

      const duration = video.duration;
      const start = trimRange[0] * duration;
      const end = trimRange[1] * duration;
      const speed = reviewPlaybackRate;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setIsFinalizing(false);
        return;
      }

      const audioCtx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const source = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);

      video.currentTime = start;
      video.playbackRate = speed;

      const stream = canvas.captureStream(30);
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) stream.addTrack(audioTrack);

      let mimeType = "video/webm;codecs=vp9";
      if (MediaRecorder.isTypeSupported("video/mp4")) mimeType = "video/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        try {
        const finalEditedBlob = new Blob(chunks, { type: mimeType });
        await saveOrShareBlob(finalEditedBlob, true);
        } catch (err) {
          console.error("Error in recorder.onstop:", err);
        } finally {
        audioCtx.close();
        setIsFinalizing(false);
        }
      };

      recorder.start();
      await video.play();

      // Safety timeout: 60 seconds
      const safetyTimeout = setTimeout(() => {
        if (recorder.state !== "inactive") {
          console.error("Export timed out, forcing stop.");
          recorder.stop();
        }
      }, 60000);

      const draw = () => {
        if (video.paused || video.ended || video.currentTime >= end) {
          clearTimeout(safetyTimeout);
          recorder.stop();
          video.pause();
          return;
        }
        ctx.drawImage(video, 0, 0);
        requestAnimationFrame(draw);
      };
      draw();
    } catch (error) {
      console.error("Error finalizing cut:", error);
      setIsFinalizing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFinalizing || isReviewing) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const type = (file.type.startsWith("video") ? "video" : "image") as
      | "video"
      | "image";
    const url = URL.createObjectURL(file),
      id = Date.now().toString();
    if (type === "video") {
      const v = document.createElement("video");
      v.preload = "auto";
      v.muted = true;
      v.playsInline = true;

      v.onloadedmetadata = () => {
        // Seek to 0.1s to avoid potential black start frames
        v.currentTime = 0.1;
      };

      v.onseeked = () => {
        const cap = document.createElement("canvas");
        cap.width = 160;
        cap.height = 160;
        const ctx = cap.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, 160, 160);
          const vWidth = v.videoWidth;
          const vHeight = v.videoHeight;
          const vRatio = vWidth / vHeight;
          let dWidth, dHeight, dx, dy;
          // Maintain aspect ratio while covering the 160x160 area
          if (vRatio > 1) {
            dWidth = 160 * vRatio;
            dHeight = 160;
            dx = (160 - dWidth) / 2;
            dy = 0;
          } else {
            dWidth = 160;
            dHeight = 160 / vRatio;
            dx = 0;
            dy = (160 - dHeight) / 2;
          }
          ctx.drawImage(v, dx, dy, dWidth, dHeight);
        }

        const thumbnail = cap.toDataURL("image/jpeg");
        setAssets((p) => {
          const next: Asset[] = [
            ...p,
            {
              id,
              name: file.name,
              type,
              url,
              thumbnail,
              width: v.videoWidth,
              height: v.videoHeight,
              transform: { ...DEFAULT_TRANSFORM },
              drawings: [],
              opacity: 1,
              targetOpacity: 1
            }
          ];
          selectAndShowAsset(id, "video", next);
          return next;
        });
        // Cleanup listeners
        v.onseeked = null;
        v.onloadedmetadata = null;
      };

      v.onerror = (err) => {
        console.error("Error loading video for thumbnail", err);
        setAssets((p) => {
          const next: Asset[] = [
            ...p,
            {
              id,
              name: file.name,
              type,
              url,
              thumbnail: "",
              width: 1920,
              height: 1080,
              transform: { ...DEFAULT_TRANSFORM },
              drawings: []
            }
          ];
          selectAndShowAsset(id, "video", next);
          return next;
        });
      };

      v.src = url;
      v.load();
    } else {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      img.onload = () => {
        imageCache.current.set(id, img);
        setAssets((p) => {
          const next: Asset[] = [
            ...p,
            {
              id,
              name: file.name,
              type,
              url,
              width: img.naturalWidth,
              height: img.naturalHeight,
              transform: { ...DEFAULT_TRANSFORM },
              drawings: [],
              opacity: 1,
              targetOpacity: 1
            }
          ];
          selectAndShowAsset(id, "image", next);
          return next;
        });
      };
    }
    e.target.value = "";
  };

  const currentVisibleVideo = assets.find(
    (a) =>
      a.id ===
      visibleAssetIds.find(
        (vid) => assets.find((ax) => ax.id === vid)?.type === "video"
      )
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white overflow-hidden font-sans touch-none select-none outline-none ring-0">
      <section
        className={`relative w-full flex-1 flex items-start justify-center overflow-hidden z-10 outline-none ring-0 pt-[calc(env(safe-area-inset-top)+3rem)] ${
          isReviewing ? "pointer-events-none select-none" : ""
        }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleTouchEnd}
      >
        <div className="relative aspect-[9/16] h-full max-h-full overflow-hidden bg-[#050505] shadow-2xl border border-white/10">
          {magicError && (
            <div
              className="absolute inset-0 z-[999] bg-black/85 flex items-center justify-center"
              onClick={() => setMagicError(null)}
            >
              <div
                className="bg-white text-black px-8 py-6 rounded-3xl text-center shadow-2xl cursor-pointer w-[260px]"
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = "/";
                }}
              >
                <div className="text-xs font-bold tracking-widest text-zinc-500 mb-2">
                  ThetoriAi
                </div>

                <div className="text-sm font-black mb-4">
                  Login and buy credits
                </div>

                <div className="text-[10px] text-zinc-400 font-medium">
                  Unlock premium magic tools
                </div>
              </div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={1080}
            height={1920}
            className="w-full h-full object-contain"
          />
          {isEditingText &&
            activeTextId &&
            (() => {
              const activeItem = textItems.find((t) => t.id === activeTextId);
              if (!activeItem) return null;

              return (
                <div
                  className="absolute inset-0 z-50 bg-black/30"
                  onClick={() => {
                    setIsEditingText(false);
                    if (!editingTextValue.trim()) {
                      setTextItems((prev) =>
                        prev.filter((item) => item.id !== activeTextId)
                      );
                      setActiveTextId(null);
                    }
                  }}
                >
                  <input
                    type="text"
                    value={editingTextValue}
                    onChange={(e) => {
                      setEditingTextValue(e.target.value);
                      setTextItems((prev) =>
                        prev.map((item) => {
                          if (item.id === activeTextId) {
                            return { ...item, text: e.target.value };
                          }
                          return item;
                        })
                      );
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.target.select()}
                    className="absolute bg-transparent border-none text-center focus:outline-none p-0 m-0"
                    autoFocus
                    style={{
                      left: `${activeItem.x * 100}%`,
                      top: `${activeItem.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      fontSize: `${Math.max(16, 50 * (activeItem.scale / 100) * (Math.min(window.innerHeight, window.innerWidth * (16 / 9)) / 1920))}px`,
                      lineHeight: "1",
                      color: activeItem.color,
                      fontFamily: "Arial",
                      fontWeight: "bold",
                      textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                      width: "80%"
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setIsEditingText(false);
                      }
                    }}
                  />
                </div>
              );
            })()}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            resetApp();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          disabled={isFinalizing || isReviewing}
          className="absolute top-4 left-0 z-50 w-8 h-8 flex items-center justify-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-full text-white/60 hover:text-white transition-all shadow-xl disabled:opacity-20"
        >
          <XIcon className="text-xs" />
        </button>

        <div className="absolute left-1 top-1/2 -translate-y-1/2 flex flex-col space-y-4 z-30">
          <div className="relative flex items-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleTextInteraction();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              disabled={isFinalizing || isReviewing}
              className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center transition-all ${isTextMode ? "bg-yellow-400 text-black shadow-[0_0_20px_#eaff0080]" : "bg-white text-black"} disabled:opacity-20`}
            >
              <TextIcon className="text-lg" />
              <span className="text-[5px] font-black mt-0.5 uppercase">
                TEXT
              </span>
            </button>
            {isTextMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddText();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                className="absolute left-full ml-2 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-90 transition-transform"
              >
                <PlusIcon className="text-sm" />
              </button>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePenInteraction();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            disabled={isFinalizing || isReviewing}
            className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center transition-all ${isDrawingMode ? "bg-yellow-400 text-black shadow-[0_0_20px_#eaff0080]" : "bg-white text-black"} disabled:opacity-20`}
          >
            {drawingShape === "free" ? (
              <PenIcon />
            ) : drawingShape === "circle" ? (
              <CircleIcon />
            ) : drawingShape === "square" ? (
              <SquareIcon />
            ) : (
              <ArrowPointerIcon />
            )}
            <span className="text-[5px] font-black mt-0.5 uppercase">
              {isDrawingMode ? "ON" : "DRAW"}
            </span>
          </button>
          {selectedAsset?.type === "video" && (
            <div className="flex flex-col space-y-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlaybackInteraction();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                disabled={isFinalizing || isReviewing}
                className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 active:scale-95 border ${
                  isAssetPlaying
                    ? "bg-emerald-500 border-emerald-300 text-white shadow-[0_0_25px_rgba(16,185,129,0.9)]"
                    : "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                }`}
              >
                {isAssetPlaying ? (
                  <PauseIcon className="text-2xl drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
                ) : (
                  <PlayIcon className="text-2xl drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
                )}
                <span className="text-[8px] font-black mt-1 uppercase">
                  Play
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLooping(!isLooping);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                disabled={isFinalizing || isReviewing}
                className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 active:scale-95 border ${
                  isLooping
                    ? "bg-indigo-500 border-indigo-300 text-white shadow-[0_0_25px_rgba(99,102,241,0.9)]"
                    : "bg-indigo-500/20 border-indigo-400 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                }`}
              >
                <RepeatIcon className="drop-shadow-[0_0_6px_rgba(99,102,241,0.9)]" />
                <span className="text-[7px] font-black mt-1 uppercase">
                  Loop
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col space-y-3 z-30">
          {/* PASTE GHOST BUTTON HERE */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setFadeMode((prev) => !prev);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            disabled={isFinalizing || isReviewing}
            className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 active:scale-95 border ${
              fadeMode
                ? "bg-purple-500 border-purple-300 text-white shadow-[0_0_25px_rgba(168,85,247,0.9)]"
                : "bg-purple-500/20 border-purple-400 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.5)]"
            }`}
          >
            <GhostIcon className="drop-shadow-[0_0_6px_rgba(168,85,247,0.9)]" />
            <span className="text-[7px] font-black mt-1 uppercase">Ghost</span>
          </button>
          {selectedAsset && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (magicMode === "menu") {
                    setMagicMode(null);
                    setActivePath([]);
                  } else {
                    setMagicMode("menu");
                    setActivePath([]);
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                disabled={isAiProcessing || isFinalizing || isReviewing}
                className={`w-12 h-12 border border-white/20 rounded-2xl flex flex-col items-center justify-center transition-all disabled:opacity-20 ${
                  isAiProcessing
                    ? "bg-zinc-800 animate-pulse"
                    : magicMode !== null
                      ? "bg-emerald-600"
                      : "bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-xl"
                }`}
              >
                {isAiProcessing ? <LoaderIcon /> : <SparklesIcon />}
                <span className="text-[7px] font-black mt-1 uppercase">
                  {magicMode !== null ? "Close" : "Magic"}
                </span>
              </button>
            </div>
          )}

          {magicMode !== null && (
            <>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (magicMode === "blur_selecting" && activePath.length > 0) {
                    // CONFIRM BLUR
                    const xs = activePath.map((p) => p.x);
                    const ys = activePath.map((p) => p.y);
                    const minX = Math.min(...xs);
                    const maxX = Math.max(...xs);
                    const minY = Math.min(...ys);
                    const maxY = Math.max(...ys);
                    const rect = {
                      x: minX,
                      y: minY,
                      w: maxX - minX,
                      h: maxY - minY
                    };

                    if (
                      magicMode === "blur_selecting" &&
                      activePath.length > 0
                    ) {
                      const xs = activePath.map((p) => p.x);
                      const ys = activePath.map((p) => p.y);
                      const minX = Math.min(...xs);
                      const maxX = Math.max(...xs);
                      const minY = Math.min(...ys);
                      const maxY = Math.max(...ys);

                      const rect = {
                        x: minX,
                        y: minY,
                        w: maxX - minX,
                        h: maxY - minY
                      };

                      if (!selectedAsset) return;

                      if (selectedAsset.type === "video") {
                        setIsTracking({
                          assetId: selectedAssetId!,
                          type: "blur",
                          rect,
                          progress: 0
                        });
                      } else {
                        try {
                          const ok = await consumeCredits("IMAGE_NORMAL");
                          if (!ok) {
                            setMagicError("Login and buy credits");
                            return;
                          }
                        } catch {
                          setMagicError("Login and buy credits");
                          return;
                        }
                        setAssets((prev) =>
                          prev.map((a) => {
                            if (a.id === selectedAssetId) {
                              return {
                                ...a,
                                effects: [
                                  ...(a.effects || []),
                                  { type: "blur", rect }
                                ]
                              };
                            }
                            return a;
                          })
                        );

                        setMagicMode(null);
                        setActivePath([]);
                      }

                      setMagicMode(null);
                      setActivePath([]);
                    }
                  } else {
                    setMagicMode("blur_selecting");
                    setActivePath([]);
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 active:scale-95 border ${
                  magicMode === "blur_selecting"
                    ? activePath.length > 0
                      ? "bg-green-500 border-green-300 text-white shadow-[0_0_25px_rgba(34,197,94,0.9)] animate-pulse"
                      : "bg-amber-500 border-amber-300 text-white shadow-[0_0_25px_rgba(245,158,11,0.9)]"
                    : "bg-amber-500/20 border-amber-400/30 text-amber-300/50"
                }`}
              >
                <UserSlashIcon
                  className={`drop-shadow-[0_0_6px_rgba(245,158,11,0.9)]`}
                />
                <span className="text-[7px] font-black mt-1 uppercase">
                  {magicMode === "blur_selecting" && activePath.length > 0
                    ? "Apply"
                    : "Blur"}
                </span>
              </button>

              {
                /* Cut Tool - ONLY for Images */
                selectedAsset?.type !== "video" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        magicMode === "cut_selecting" &&
                        activePath.length > 0
                      ) {
                        // CONFIRM CUT (Image Only)
                        const xs = activePath.map((p) => p.x);
                        const ys = activePath.map((p) => p.y);
                        const minX = Math.min(...xs);
                        const maxX = Math.max(...xs);
                        const minY = Math.min(...ys);
                        const maxY = Math.max(...ys);
                        const rect = {
                          x: minX,
                          y: minY,
                          w: maxX - minX,
                          h: maxY - minY
                        };

                        // Apply immediately (AI) for Image
                        handleMagicCutout(rect);
                      } else {
                        setMagicMode("cut_selecting");
                        setActivePath([]);
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 active:scale-95 border ${
                      magicMode === "cut_selecting"
                        ? activePath.length > 0
                          ? "bg-green-500 border-green-300 text-white shadow-[0_0_25px_rgba(34,197,94,0.9)] animate-pulse"
                          : "bg-pink-500 border-pink-300 text-white shadow-[0_0_25px_rgba(236,72,153,0.9)]"
                        : "bg-pink-500/20 border-pink-400/30 text-pink-300/50"
                    }`}
                  >
                    <EraserIcon
                      className={`drop-shadow-[0_0_6px_rgba(236,72,153,0.9)]`}
                    />
                    <span className="text-[7px] font-black mt-1 uppercase">
                      {magicMode === "cut_selecting" && activePath.length > 0
                        ? "Apply"
                        : "Cut"}
                    </span>
                  </button>
                )
              }
            </>
          )}

          {selectedAssetId && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedAssetId && !isFinalizing && !isReviewing) {
                    toggleFullFrame(selectedAssetId);
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                disabled={isFinalizing || isReviewing}
                className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 active:scale-95 border ${
                  selectedAsset?.fullFrame
                    ? "bg-cyan-500 border-cyan-300 text-white shadow-[0_0_25px_rgba(6,182,212,0.9)]"
                    : "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                }`}
              >
                {selectedAsset?.fullFrame ? (
                  <CompressIcon className="drop-shadow-[0_0_6px_rgba(6,182,212,0.9)]" />
                ) : (
                  <ExpandIcon className="drop-shadow-[0_0_6px_rgba(6,182,212,0.9)]" />
                )}
                <span className="text-[7px] font-black mt-1 uppercase">
                  View
                </span>
              </button>
            </>
          )}
        </div>

        {/* Watermark Button */}
        {!isFinalizing && !isReviewing && !magicMode && (
          <button
            onClick={async (e) => {
              e.stopPropagation();

              try {
                const ok = await consumeCredits("CHECK_ONLY");

                if (!ok) {
                  setMagicError("Login and buy credits");
                  return;
                }

                setShowWatermark((prev) => !prev);
              } catch {
                setMagicError("Login and buy credits");
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className="absolute bottom-14 right-0 z-50 w-10 h-10 flex items-center justify-center drop-shadow-lg active:scale-90 transition-transform"
          >
            <WatermarkIcon
              className={`text-2xl ${showWatermark ? "text-white" : "text-red-500/50"}`}
            />
          </button>
        )}

        {selectedAssetId && !isFinalizing && !isReviewing && !magicMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteAsset(selectedAssetId);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className="absolute bottom-1 right-0 z-50 w-10 h-10 bg-black/60 backdrop-blur-xl border-2 border-red-500/40 rounded-2xl flex flex-col items-center justify-center text-red-500"
          >
            <TrashIcon className="text-xs" />
            <span className="text-[5px] font-black mt-0.5 uppercase">
              Remove
            </span>
          </button>
        )}

        {/* Review & Choice Screen */}
        {isReviewing && (
          <>
            {/* Blur + Dark Background Overlay */}
            <div className="fixed inset-0 z-[9000] backdrop-blur-lg bg-black/70"></div>

            {/* Review Panel */}
            <div className="fixed inset-0 z-[9999] flex flex-col animate-fade-in pointer-events-auto bg-black">
              {/* Top Speed Controls */}
              <div className="flex justify-center pt-10 pb-4 z-20">
                <div className="flex space-x-2 bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/10">
                  {[1.5, 2, 2.5].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => togglePlaybackSpeed(speed)}
                      className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                        reviewPlaybackRate === speed
                          ? "bg-emerald-500 text-black shadow-lg"
                          : "text-white/60 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Video Preview - Flex 1 to fill available space */}
              <div className="flex-1 flex items-center justify-center overflow-hidden">
                {reviewVideoUrl && (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <video
                      ref={reviewVideoRef}
                      src={reviewVideoUrl}
                      className="max-w-full max-h-full object-contain"
                      playsInline
                      loop={false}
                      controls={false}
                      onPlay={() => setIsReviewPlaying(true)}
                      onPause={() => setIsReviewPlaying(false)}
                      onTimeUpdate={handleReviewTimeUpdate}
                      onClick={() => {
                        const video = reviewVideoRef.current;
                        if (!video) return;

                        // Apply the same safe duration logic here
                        let safeDuration = video.duration;
                        if (
                          !safeDuration ||
                          safeDuration === Infinity ||
                          isNaN(safeDuration)
                        ) {
                          safeDuration =
                            video.buffered.length > 0
                              ? video.buffered.end(video.buffered.length - 1)
                              : 100;
                        }

                        const start =
                          trimRange[0] === 0 ? 0 : trimRange[0] * safeDuration;
                        const end =
                          trimRange[1] === 1
                            ? safeDuration
                            : trimRange[1] * safeDuration;

                        if (video.paused) {
                          // If finished or out of bounds, restart from trim start
                          if (
                            video.currentTime >= end - 0.1 ||
                            video.currentTime < start
                          ) {
                            video.currentTime = start;
                          }
                          video
                            .play()
                            .catch((e) => console.warn("Playback failed:", e));
                        } else {
                          video.pause();
                        }
                      }}
                    />
                    {/* Play/Pause Overlay */}
                    <div
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      onClick={() => {
                        const video = reviewVideoRef.current;
                        if (!video) return;
                        if (video.paused) video.play();
                        else video.pause();
                      }}
                    >
                      <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center pointer-events-auto active:scale-95 transition-transform">
                        {isReviewPlaying ? (
                          <PauseIcon className="text-white w-6 h-6" />
                        ) : (
                          <PlayIcon className="text-white w-6 h-6 ml-1" />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Controls Area */}
              <div className="w-full bg-gradient-to-t from-black via-black/80 to-transparent pb-safe pt-12 px-6 z-30">
                {/* Timeline / Trim Slider */}
                <div className="relative w-full h-12 mb-6 select-none touch-none">
                  {/* Thumbnails Background */}
                  <div className="absolute inset-0 flex overflow-hidden rounded-lg opacity-80 border border-white/10">
                    {thumbnails.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        className="h-full flex-1 object-cover"
                        draggable={false}
                      />
                    ))}
                  </div>

                  {/* Red Playhead */}
                  {reviewVideoRef.current?.duration && (
                    <div
                      className="absolute top-2 bottom-2 w-0.5 bg-red-500 z-30 pointer-events-none"
                      style={{
                        left: `${(Math.max(trimRange[0] * reviewVideoRef.current.duration, Math.min(currentTime, trimRange[1] * reviewVideoRef.current.duration)) / reviewVideoRef.current.duration) * 100}%`
                      }}
                    />
                  )}

                  {/* Dimmed Overlays */}
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-black/60 pointer-events-none backdrop-blur-[1px]"
                    style={{ width: `${trimRange[0] * 100}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 right-0 bg-black/60 pointer-events-none backdrop-blur-[1px]"
                    style={{ width: `${(1 - trimRange[1]) * 100}%` }}
                  />

                  {/* Active Range Border */}
                  <div
                    className="absolute top-0 bottom-0 border-t-2 border-b-2 border-emerald-500 pointer-events-none"
                    style={{
                      left: `${trimRange[0] * 100}%`,
                      width: `${(trimRange[1] - trimRange[0]) * 100}%`
                    }}
                  />

                  {/* Left Handle */}
                  <div
                    className="absolute top-0 bottom-0 w-6 -ml-3 bg-emerald-500 rounded-l-md cursor-ew-resize flex items-center justify-center z-20 touch-manipulation shadow-lg"
                    style={{ left: `${trimRange[0] * 100}%` }}
                    onTouchStart={(e) => {
                      const startX = e.touches[0].clientX;
                      const startVal = trimRange[0];
                      const w = e.currentTarget.parentElement?.clientWidth || 1;

                      const handleMove = (em: TouchEvent) => {
                        const dx = em.touches[0].clientX - startX;
                        const dVal = dx / w;
                        let newVal = Math.max(
                          0,
                          Math.min(trimRange[1] - 0.1, startVal + dVal)
                        );
                        setTrimRange((prev) => {
                          const next: [number, number] = [newVal, prev[1]];

                          const video = reviewVideoRef.current;
                          if (video && video.duration) {
                            video.currentTime = video.duration * next[0];
                          }

                          return next;
                        });
                      };
                      const handleEnd = () => {
                        window.removeEventListener("touchmove", handleMove);
                        window.removeEventListener("touchend", handleEnd);
                      };
                      window.addEventListener("touchmove", handleMove);
                      window.addEventListener("touchend", handleEnd);
                    }}
                    onMouseDown={(e) => {
                      const startX = e.clientX;
                      const startVal = trimRange[0];
                      const w = e.currentTarget.parentElement?.clientWidth || 1;

                      const handleMove = (em: MouseEvent) => {
                        const dx = em.clientX - startX;
                        const dVal = dx / w;
                        let newVal = Math.max(
                          0,
                          Math.min(trimRange[1] - 0.1, startVal + dVal)
                        );
                        setTrimRange((prev) => [newVal, prev[1]]);
                      };
                      const handleEnd = () => {
                        window.removeEventListener("mousemove", handleMove);
                        window.removeEventListener("mouseup", handleEnd);
                      };
                      window.addEventListener("mousemove", handleMove);
                      window.addEventListener("mouseup", handleEnd);
                    }}
                  >
                    <div className="w-1 h-4 bg-black/20 rounded-full" />
                  </div>

                  {/* Right Handle */}
                  <div
                    className="absolute top-0 bottom-0 w-6 -ml-3 bg-emerald-500 rounded-r-md cursor-ew-resize flex items-center justify-center z-20 touch-manipulation shadow-lg"
                    style={{ left: `${trimRange[1] * 100}%` }}
                    onTouchStart={(e) => {
                      const startX = e.touches[0].clientX;
                      const startVal = trimRange[1];
                      const w = e.currentTarget.parentElement?.clientWidth || 1;

                      const handleMove = (em: TouchEvent) => {
                        const dx = em.touches[0].clientX - startX;
                        const dVal = dx / w;
                        let newVal = Math.min(
                          1,
                          Math.max(trimRange[0] + 0.1, startVal + dVal)
                        );
                        setTrimRange((prev) => [prev[0], newVal]);
                      };
                      const handleEnd = () => {
                        window.removeEventListener("touchmove", handleMove);
                        window.removeEventListener("touchend", handleEnd);
                      };
                      window.addEventListener("touchmove", handleMove);
                      window.addEventListener("touchend", handleEnd);
                    }}
                    onMouseDown={(e) => {
                      const startX = e.clientX;
                      const startVal = trimRange[1];
                      const w = e.currentTarget.parentElement?.clientWidth || 1;

                      const handleMove = (em: MouseEvent) => {
                        const dx = em.clientX - startX;
                        const dVal = dx / w;
                        let newVal = Math.min(
                          1,
                          Math.max(trimRange[0] + 0.1, startVal + dVal)
                        );
                        setTrimRange((prev) => [prev[0], newVal]);
                      };
                      const handleEnd = () => {
                        window.removeEventListener("mousemove", handleMove);
                        window.removeEventListener("mouseup", handleEnd);
                      };
                      window.addEventListener("mousemove", handleMove);
                      window.addEventListener("mouseup", handleEnd);
                    }}
                  >
                    <div className="w-1 h-4 bg-black/20 rounded-full" />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 mb-4">
                  {/* Close Button */}
                  <button
                    onClick={handleReviewClose}
                    className="flex-1 bg-white/10 border border-white/10 text-white py-3 rounded-full font-bold text-sm active:scale-95 transition-all hover:bg-white/20"
                  >
                    Discard
                  </button>

                  {/* Export Button */}
                  <button
                    onClick={() => {
                      if (reviewVideoRef.current)
                        reviewVideoRef.current.pause();
                      handleFinalSave();
                    }}
                    disabled={isFinalizing}
                    className="flex-[2] bg-emerald-400 text-white py-3 rounded-full font-bold text-sm shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95 transition-all hover:bg-emerald-300 flex items-center justify-center gap-2"
                  >
                    Export
                    {isFinalizing && (
                      <LoaderIcon className="animate-spin w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="fixed top-0 left-0 opacity-0 pointer-events-none w-10 h-10 -z-50 overflow-hidden">
          <video
            ref={videoRef}
            src={currentVisibleVideo?.url}
            playsInline
            crossOrigin="anonymous"
            muted={isLooping}
            loop={isLooping}
          />
          <video ref={webcamRef} autoPlay muted playsInline />
        </div>
      </section>

      <footer
        className={`relative flex-none bg-black flex flex-col items-center justify-between pb-safe pt-2 px-4 z-40 border-t border-white/5 overflow-visible ${
          isReviewing ? "pointer-events-none select-none opacity-50" : ""
        }`}
      >
        <div className="w-full flex items-center space-x-3 mt-2 overflow-x-auto overflow-y-visible no-scrollbar py-2 px-1">
          {assets.map((asset) => {
            const isVisible = visibleAssetIds.includes(asset.id),
              isSelected = selectedAssetId === asset.id;
            return (
              <button
                key={asset.id}
                onClick={() => toggleAssetVisibility(asset.id)}
                disabled={isFinalizing || isReviewing}
                className={`shrink-0 w-12 h-12 rounded-xl border-2 transition-all relative flex items-center justify-center bg-zinc-900 overflow-visible ${isVisible ? (isSelected ? "border-emerald-500 opacity-100 shadow-[0_0_15px_#10b98160]" : "border-white opacity-100") : "border-zinc-800 opacity-60"} ${isSelected ? "scale-110 -translate-y-1 z-20" : "scale-100"} disabled:opacity-20`}
              >
                <img
                  src={asset.type === "video" ? asset.thumbnail : asset.url}
                  className="w-full h-full object-cover rounded-xl"
                />
                <div className="absolute top-1 right-1">
                  {asset.type === "video" ? (
                    <FilmIcon className="w-6 h-6 stroke-white bg-black/60 p-1 rounded-md" />
                  ) : (
                    <ImageIcon className="w-6 h-5 stroke-white bg-black/60 p-1 rounded-md" />
                  )}
                </div>
              </button>
            );
          })}
          {!isFinalizing && !isReviewing && (
            <label className="shrink-0 w-12 h-12 bg-zinc-900 border-2 border-zinc-800 border-dashed rounded-xl flex items-center justify-center cursor-pointer active:scale-95 transition-all hover:border-zinc-500">
              <PlusIcon className="text-zinc-500 text-lg" />
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,video/*"
              />
            </label>
          )}
        </div>
        <div
          className={`relative w-full flex flex-col items-center justify-center py-4 transition-all duration-500 ${
            isReviewing ? "blur-xl opacity-30 grayscale" : ""
          }`}
        >
          {/* Left Controls: Webcam & Mic */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center space-x-4 z-50">
            {/* Webcam Toggle */}
            <div className="relative w-12 h-12">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isFinalizing && !isReviewing) {
                    if (!webcamActive) {
                      setWebcamActive(true);
                      setWebcamMode("fullscreen");
                      setCameraFacing("user");
                    } else if (webcamMode === "fullscreen") {
                      setWebcamMode("floating");
                    } else {
                      setWebcamActive(false);
                    }
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                disabled={isFinalizing || isReviewing}
                className={`w-full h-full rounded-2xl flex flex-col items-center justify-center transition-all duration-300 active:scale-95 border ${
                  webcamActive
                    ? "bg-blue-500 border-blue-300 text-white shadow-[0_0_25px_rgba(59,130,246,0.9)]"
                    : "bg-blue-500/20 border-blue-400 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                }`}
              >
                {webcamActive && webcamMode === "floating" ? (
                  <ExpandIcon className="drop-shadow-[0_0_6px_rgba(59,130,246,0.9)]" />
                ) : webcamActive ? (
                  <CompressIcon className="drop-shadow-[0_0_6px_rgba(59,130,246,0.9)]" />
                ) : (
                  <CameraIcon className="drop-shadow-[0_0_6px_rgba(59,130,246,0.9)]" />
                )}
                <span className="text-[7px] font-black mt-1 uppercase">
                  {!webcamActive
                    ? "Sight"
                    : webcamMode === "fullscreen"
                      ? "Full"
                      : "Float"}
                </span>
              </button>

              {/* Mini Toggle Switch for Front/Back Camera */}
              {webcamActive && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setCameraFacing((prev) =>
                      prev === "user" ? "environment" : "user"
                    );
                  }}
                  className="absolute -top-5 left-1/2 -translate-x-1/2 w-8 h-4 bg-black/60 backdrop-blur-md border border-white/30 rounded-full flex items-center p-0.5 cursor-pointer z-50 shadow-lg"
                >
                  <div
                    className={`w-3 h-3 rounded-full shadow-sm transition-all duration-300 ${
                      cameraFacing === "environment"
                        ? "bg-blue-400 translate-x-4"
                        : "bg-white translate-x-0"
                    }`}
                  />
                </div>
              )}
            </div>

            {/* Mic Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center drop-shadow-lg active:scale-90 transition-transform border ${
                isMuted
                  ? "bg-red-500/20 border-red-400 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                  : "bg-white border-white text-black shadow-[0_0_25px_rgba(255,255,255,0.9)]"
              }`}
            >
              {isMuted ? (
                <MicOffIcon className="text-xl text-red-500" />
              ) : (
                <MicIcon className="w-6 h-6 text-black fill-black" />
              )}
            </button>
          </div>

          {isRecordConfirming && (
            <div className="absolute bottom-20 bg-emerald-600/90 backdrop-blur-lg px-4 py-2 rounded-2xl text-[10px] font-black tracking-widest uppercase text-white shadow-2xl animate-bounce">
              Are you sure?
            </div>
          )}
          <button
            onClick={toggleRecording}
            disabled={
              visibleAssetIds.length === 0 || isFinalizing || isReviewing
            }
            className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 border-4 ${isRecording ? "bg-red-600 border-red-500 shadow-[0_0_30px_#ef444480]" : isRecordConfirming ? "bg-emerald-600 border-emerald-400" : "bg-white border-zinc-300 shadow-xl"}`}
          >
            {isRecording ? (
              <div className="w-6 h-6 bg-white rounded-sm animate-pulse" />
            ) : isRecordConfirming ? (
              <span className="text-white text-[10px] font-black">START?</span>
            ) : (
              <div className="w-8 h-8 bg-red-600 rounded-full" />
            )}
          </button>
          {isRecording && (
            <div className="absolute top-1/2 -translate-y-1/2 right-4 bg-red-600 px-3 py-1 rounded-full text-[10px] font-black tracking-widest text-white shadow-lg flex items-center transition-all">
              <span className="w-2.5 h-2.5 bg-white rounded-full mr-1.5 animate-ping" />
              REC {Math.floor(recordingTime / 60)}:
              {(recordingTime % 60).toString().padStart(2, "0")}
            </div>
          )}
          {!isRecording &&
            !isRecordConfirming &&
            visibleAssetIds.length > 0 && (
              <div className="absolute top-1/2 -translate-y-1/2 right-4 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[7px] font-bold tracking-widest text-white/40 uppercase">
                Ready to Record
              </div>
            )}
        </div>
      </footer>

      {assets.length === 0 && !isFinalizing && !isReviewing && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-8 text-center space-y-12 animate-fade-in">
          <div className="w-28 h-28 bg-red-600 rounded-[2rem] flex items-center justify-center transform -rotate-12 shadow-[0_30px_60px_-15px_rgba(220,38,38,0.6)]">
            <ClapperboardIcon className="text-6xl text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-black italic tracking-tighter text-white  leading-none">
              Direct CUT
            </h1>
            <p className="text-white/30 text-[10px] font-bold tracking-[0.6em] ">
              Reaction Assembly Studio
            </p>
          </div>
          <div className="w-full max-w-xs pt-4 flex flex-col gap-3">
            <label className="block w-full bg-white text-black py-4 rounded-2xl font-black cursor-pointer active:scale-95 text-center text-[10px] tracking-widest shadow-2xl uppercase">
              Import Media
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,video/*"
              />
            </label>
            <a
              href="https://thetoriai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-transparent border border-white/20 text-white py-4 rounded-2xl font-black text-[10px] tracking-widest uppercase hover:bg-white/10 active:scale-95 transition-all shadow-2xl text-center flex flex-col items-center justify-center"
            >
              <span className="text-[8px] opacity-70 mb-0.5">Visit</span>
              ThetoriAi
            </a>
          </div>
        </div>
      )}

      {isSimulatedRecording && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-8 text-center space-y-8">
          <div className="text-white text-2xl font-black animate-pulse">
            RECORDING SCREEN...
          </div>
          <button
            onClick={() => {
              handleExternalRecordingToggle(false);
              navigate("/export");
            }}
            className="w-32 h-32 bg-red-600 rounded-full flex items-center justify-center text-white font-black text-sm active:scale-95 shadow-[0_0_40px_#ef444480]"
          >
            STOP
          </button>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 16px); }
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
      `
        }}
      />
    </div>
  );
};

export default DirectorsCut;
