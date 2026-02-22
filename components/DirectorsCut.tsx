import React, { useState, useRef, useEffect, useCallback } from "react";
import { GoogleGenAI } from "@google/genai";
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
  EraserIcon
} from "./Icons";


import { supabase } from "../services/supabaseClient";

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
  consumeCredits,
  onGenerateImage,
  onGenerateVideo
}) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [visibleAssetIds, setVisibleAssetIds] = useState<string[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamFlipped, setWebcamFlipped] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">(
    "user"
  );

  const [isRecording, setIsRecording] = useState(false);
  const [isRecordConfirming, setIsRecordConfirming] = useState(false);
  const [isAssetPlaying, setIsAssetPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Interaction Mode
  const [isLocked, setIsLocked] = useState(false);
  const [grabbedPart, setGrabbedPart] = useState<
    "move" | "top" | "bottom" | "left" | "right" | null
  >(null);
  const [isPinching, setIsPinching] = useState(false);
 
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

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

  const startTouchRef = useRef({ x: 0, y: 0, scale: 0, dist: 0 });
  const isDraggingRef = useRef(false);
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<number | null>(null);
  const lastPenTapRef = useRef<number>(0);
  const penTapTimeoutRef = useRef<number | null>(null);

  // --- Refs ---
  const isRecordingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const requestRef = useRef<number>(0);
  const recordingIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const videoSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const activeStreamRef = useRef<MediaStream | null>(null);
  const wakeLockRef = useRef<any>(null);
  const micOnlyStreamRef = useRef<MediaStream | null>(null);

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
        return { ...prev, progress: prev.progress + 2 };
      });
    }, 30);

    return () => clearInterval(interval);
  }, [isTracking?.assetId]); // Depend on assetId to restart if needed, but mainly just running when isTracking exists

  useEffect(() => {
    if (isTracking && isTracking.progress >= 100) {
      // Apply Effect
      const { assetId, type, rect } = isTracking;

      if (type === "blur") {
        setAssets((prev) =>
          prev.map((a) => {
            if (a.id === assetId) {
              return {
                ...a,
                effects: [...(a.effects || []), { type: "blur", rect }]
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
        v.play()
          .then(() => setIsAssetPlaying(true))
          .catch((e) => console.warn(e));
    } else {
      v.pause();
      setIsAssetPlaying(false);
    }
    },
    [isLooping, isFinalizing, isReviewing]
  );

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
    if (timeSinceLastTap < 300) {
      // Double tap detected: RESET
      if (tapTimeoutRef.current) window.clearTimeout(tapTimeoutRef.current);
      toggleAssetPlayback(true);
      lastTapRef.current = 0;
    } else {
      // Single tap: PLAY/STOP
      lastTapRef.current = now;
      tapTimeoutRef.current = window.setTimeout(() => {
        toggleAssetPlayback();
        tapTimeoutRef.current = null;
      }, 300);
    }
  }, [toggleAssetPlayback, isFinalizing, isReviewing]);

  const clearAllDrawings = useCallback(() => {
    setAssets((prev) => prev.map((a) => ({ ...a, drawings: [] })));
  }, []);

  const handlePenInteraction = useCallback(() => {
    if (isFinalizing || isReviewing) return;
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
      for (const part of response.candidates[0].content.parts) {
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
          audio: true
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
    if (webcamActive && webcamRef.current?.readyState >= 2) {
      const v = webcamRef.current;
      const vRatio = v.videoWidth / v.videoHeight,
        targetRatio = w / h;
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
      ctx.restore();
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
          const relX =
            (pt.x - trans.cropLeft / 100) /
            (1 - (trans.cropLeft + trans.cropRight) / 100);
          const relY =
            (pt.y - trans.cropTop / 100) /
            (1 - (trans.cropTop + trans.cropBottom) / 100);
          return { x: drawX + relX * finalW, y: drawY + relY * finalH };
        };

        // Render Blur Effects
        if (asset.effects) {
          asset.effects.forEach((effect) => {
            if (effect.type === "blur") {
              const p0 = sourceToCanvas({ x: effect.rect.x, y: effect.rect.y });
              const p1 = sourceToCanvas({
                x: effect.rect.x + effect.rect.w,
                y: effect.rect.y + effect.rect.h
              });

              const bx = p0.x;
              const by = p0.y;
              const bw = p1.x - p0.x;
              const bh = p1.y - p0.y;

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
          // Draw tracking box
          const p0 = sourceToCanvas({
            x: isTracking.rect.x,
            y: isTracking.rect.y
          });
          const p1 = sourceToCanvas({
            x: isTracking.rect.x + isTracking.rect.w,
            y: isTracking.rect.y + isTracking.rect.h
          });

          const bx = p0.x;
          const by = p0.y;
          const bw = p1.x - p0.x;
          const bh = p1.y - p0.y;

          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(bx, by, bw, bh);

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
          ctx.fillText("TRACKING...", barX + barW / 2, barY - 5);

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
    requestRef.current = requestAnimationFrame(drawFrame);
  }, [
    visibleAssetIds,
    assets,
    selectedAssetId,
    webcamActive,
    webcamFlipped,
    isLocked,
    selectedAsset?.fullFrame,
    isDrawingMode,
    drawingShape,
    isAiProcessing,
    isRecording,
    activePath
  ]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [drawFrame]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAiProcessing || isFinalizing || isReviewing) return;
    isDraggingRef.current = false;
    const clientX = e.touches[0].clientX,
      clientY = e.touches[0].clientY;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvas = canvasRef.current!;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

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
    if (isLocked || selectedAsset?.fullFrame || !selectedAssetId) return;
    if (e.touches.length === 1) {
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
      startTouchRef.current = {
        ...startTouchRef.current,
        x: clientX,
        y: clientY
      };
    } else if (e.touches.length === 2) {
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
    isDraggingRef.current = true;
    const clientX = e.touches[0].clientX,
      clientY = e.touches[0].clientY,
      rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvas = canvasRef.current!;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const cX = (clientX - rect.left) * scaleX;
    const cY = (clientY - rect.top) * scaleY;

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
      const dx = (clientX - startTouchRef.current.x) * (1080 / rect.width),
        dy = (clientY - startTouchRef.current.y) * (1920 / rect.height);
      const trans = { ...selectedAsset!.transform },
        baseDrawW = 1080 * (trans.scale / 100),
        baseDrawH = baseDrawW * (selectedAsset!.height / selectedAsset!.width);
      if (grabbedPart === "move")
        updateAssetTransform(selectedAssetId, {
          x: trans.x + (dx / 1080) * 100,
          y: trans.y + (dy / 1920) * 100
        });
      else {
        const swAct =
            selectedAsset!.width *
            (1 - (trans.cropLeft + trans.cropRight) / 100),
          shAct =
            selectedAsset!.height *
            (1 - (trans.cropTop + trans.cropBottom) / 100);
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
      startTouchRef.current = {
        ...startTouchRef.current,
        x: clientX,
        y: clientY
      };
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

  const handleTouchEnd = () => {
    if (isAiProcessing || isFinalizing || isReviewing) return;

    const wasDragging = isDraggingRef.current;

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
    // setActivePath([]); // Removed this global clear to support magic selection persistence
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    handleTouchStart({
      touches: [{ clientX: e.clientX, clientY: e.clientY }],
      preventDefault: () => e.preventDefault(),
      stopPropagation: () => e.stopPropagation()
    } as any);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons !== 1) return;
    handleTouchMove({
      touches: [{ clientX: e.clientX, clientY: e.clientY }],
      preventDefault: () => e.preventDefault(),
      stopPropagation: () => e.stopPropagation()
    } as any);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      setIsFinalizing(true);
      isRecordingRef.current = false;
      setIsRecording(false);
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current)
        clearInterval(recordingIntervalRef.current);

      // Stop all playback immediately
      if (videoRef.current) {
        videoRef.current.pause();
        setIsAssetPlaying(false);
      }
      if (wakeLockRef.current)
        try {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        } catch (err) {}
      if (micOnlyStreamRef.current) {
        micOnlyStreamRef.current.getTracks().forEach((t) => t.stop());
        micOnlyStreamRef.current = null;
      }
    } else if (isRecordConfirming) {
      // Actually start recording
      if (!canvasRef.current) return;
      setIsRecordConfirming(false);
      isRecordingRef.current = true;
      setIsRecording(true);

      if ("wakeLock" in navigator)
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request(
            "screen"
          );
        } catch (err) {}
      if (!audioContextRef.current)
        audioContextRef.current = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
      const audioCtx = audioContextRef.current;
      if (audioCtx.state === "suspended") await audioCtx.resume();

      const dest = audioCtx.createMediaStreamDestination();

      let commentary: MediaStream | null = webcamRef.current
        ?.srcObject as MediaStream;
      if (!commentary || commentary.getAudioTracks().length === 0) {
        try {
          commentary = await navigator.mediaDevices.getUserMedia({
            audio: true
          });
          micOnlyStreamRef.current = commentary;
        } catch (err) {
          console.warn("Mic access denied, continuing without audio.");
        }
      }

      if (commentary && commentary.getAudioTracks().length > 0)
        audioCtx.createMediaStreamSource(commentary).connect(dest);
      if (videoRef.current?.src) {
        if (!videoSourceNodeRef.current) {
          videoSourceNodeRef.current = audioCtx.createMediaElementSource(
            videoRef.current
          );
          gainNodeRef.current = audioCtx.createGain();
          videoSourceNodeRef.current.connect(gainNodeRef.current);
          gainNodeRef.current.connect(audioCtx.destination);
        }
        gainNodeRef.current.connect(dest);
      }

      const stream = canvasRef.current.captureStream(30);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

      const mime =
        ["video/mp4;codecs=h264,aac", "video/mp4", "video/webm"].find((m) =>
          MediaRecorder.isTypeSupported(m)
        ) || "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        setRecordedBlob(new Blob(chunks, { type: mime }));
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
      // Prompt for confirmation
      setIsRecordConfirming(true);
      // Auto-cancel confirmation if not acted upon
      setTimeout(
        () => setIsRecordConfirming((prev) => (prev ? false : false)),
        4000
      );
    }
  };

  const handleFinalSave = async () => {
    if (!recordedBlob) return;
        const fileName = `directors-cut-${Date.now()}.mp4`;

        // --- Web Share API Integration ---
        if (navigator.share && navigator.canShare) {
      const file = new File([recordedBlob], fileName, {
        type: recordedBlob.type
      });
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
            title: "My Reaction",
            text: "Made with Director's Cut"
              });
              return;
        } catch (err) {}
            }
          }
    const url = URL.createObjectURL(recordedBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
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

      v.onerror = () => {
        console.error("Error loading video for thumbnail");
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
    <div className="flex flex-col h-[100dvh] bg-black text-white overflow-hidden font-sans touch-none select-none">
      <section
        className="relative w-full flex-1 flex items-center justify-center overflow-hidden z-10"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleTouchEnd}
      >
        <div className="relative aspect-[9/16] h-full max-h-full overflow-hidden bg-[#050505] shadow-2xl rounded-2xl border border-white/10">
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
          className="absolute top-6 left-6 z-50 w-8 h-8 flex items-center justify-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-full text-white/60 hover:text-white transition-all shadow-xl disabled:opacity-20"
        >
          <XIcon className="text-xs" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isFinalizing && !isReviewing) {
              setWebcamFlipped((p) => !p);
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          disabled={isFinalizing || isReviewing}
          className={`absolute top-6 right-6 z-50 w-7 h-7 flex items-center justify-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-full text-white/60 hover:text-white transition-all shadow-xl disabled:opacity-20 ${
            webcamFlipped ? "text-blue-400 border-blue-400/50" : ""
          }`}
        >
          <ArrowsRightLeftIcon className="text-xs" />
        </button>

        <div className="absolute left-1 top-1/2 -translate-y-1/2 flex flex-col space-y-4 z-30">
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isFinalizing && !isReviewing) {
                if (!webcamActive) {
                  setWebcamActive(true);
                  setCameraFacing("user");
                } else if (cameraFacing === "user") {
                  setCameraFacing("environment");
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
            className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 active:scale-95 border ${
              webcamActive
                ? "bg-blue-500 border-blue-300 text-white shadow-[0_0_25px_rgba(59,130,246,0.9)]"
                : "bg-blue-500/20 border-blue-400 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
            }`}
          >
            <CameraIcon className="drop-shadow-[0_0_6px_rgba(59,130,246,0.9)]" />
            <span className="text-[7px] font-black mt-1 uppercase">
              {!webcamActive
                ? "Sight"
                : cameraFacing === "user"
                  ? "Front"
                  : "Back"}
            </span>
          </button>
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
                  Magic
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

                      if (selectedAsset?.type === "video") {
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

              {selectedAsset?.type !== "video" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      magicMode === "cut_selecting" &&
                      activePath.length > 0
                    ) {
                      // CONFIRM CUT
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

                      if (selectedAsset?.type === "video") {
                        // Start Tracking for Video
                        setIsTracking({
                          assetId: selectedAssetId!,
                          type: "cut",
                          rect,
                          progress: 0
                        });
                        setMagicMode(null);
                        setActivePath([]);
                      } else {
                        // Apply immediately (AI) for Image
                        handleMagicCutout(rect);
                      }
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
              )}
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
            className="absolute bottom-1 right-3 z-50 w-10 h-10 bg-black/60 backdrop-blur-xl border-2 border-red-500/40 rounded-2xl flex flex-col items-center justify-center text-red-500"
          >
            <TrashIcon className="text-xs" />
            <span className="text-[5px] font-black mt-0.5 uppercase">
              Remove
            </span>
          </button>
        )}

        {/* 
            Finalizing Overlay:
            Now uses pointer-events-auto to strictly block all clicks to the studio behind it.
        */}
        {isFinalizing && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center pointer-events-auto">
            <div className="w-20 h-20 mb-8 bg-red-600 rounded-[2rem] flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.5)]">
              <LoaderIcon className="text-4xl text-white" />
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-2 uppercase italic">
              Finalizing Cut
            </h2>
            <p className="text-white/40 text-sm font-medium tracking-widest">
              Applying cuts and filters...
            </p>
          </div>
        )}

        {/* Review & Choice Screen */}
        {isReviewing && (
          <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-10 text-center pointer-events-auto animate-fade-in">
            <div className="w-24 h-24 mb-10 bg-emerald-600 rounded-[2rem] flex items-center justify-center shadow-[0_20px_50px_rgba(16,185,129,0.4)] animate-bounce">
              <FilmIcon className="text-5xl text-white" />
            </div>
            <div className="space-y-2 mb-12">
              <h2 className="text-4xl font-black tracking-tighter uppercase italic leading-none">
                Production Ready
              </h2>
              <p className="text-emerald-400/60 text-xs font-bold tracking-[0.4em] uppercase">
                Cut #{(assets.length + 1).toString().padStart(3, "0")}
              </p>
            </div>

            <div className="w-full max-w-sm space-y-4">
              <button
                onClick={handleFinalSave}
                className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase text-sm tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center space-x-3"
              >
                <i className="fa-solid fa-share-nodes"></i>
                <span>Share / Save Video</span>
              </button>

              <button
                onClick={() => {
                  setIsReviewing(false);
                  setRecordedBlob(null);
                }}
                className="w-full bg-white/5 border border-white/10 text-white/60 py-5 rounded-3xl font-bold uppercase text-xs tracking-[0.2em] active:scale-95 transition-all"
              >
                Close & Return to Studio
              </button>
            </div>

            <p className="mt-12 text-[10px] text-white/20 font-medium max-w-[200px]">
              The video file is processed and ready for your gallery or social
              media.
            </p>
          </div>
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

      <footer className="relative flex-none bg-black flex flex-col items-center justify-between pb-safe pt-2 px-4 z-40 border-t border-white/5 overflow-visible">
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
                    <FilmIcon className="text-[10px] bg-black/50 p-1" />
                  ) : (
                    <ImageIcon className="text-[10px] bg-black/50 p-1" />
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
        <div className="relative w-full flex flex-col items-center justify-center py-4">
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
          <div className="w-full max-w-xs pt-4 space-y-4">
            <label className="block w-full bg-white text-black py-5 rounded-3xl font-black cursor-pointer active:scale-95 text-center text-sm tracking-widest  shadow-2xl">
              Import Media
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,video/*"
              />
            </label>

            {/* ENTER STUDIO BUTTON */}
            <button
              onClick={() => (window.location.href = "/")}
              className="w-full bg-white/10 border border-white/20 text-white py-4 rounded-3xl font-black text-xs tracking-[0.3em] uppercase hover:bg-white/20 active:scale-95 transition-all"
            >
              ThetoriAi
            </button>
          </div>
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
