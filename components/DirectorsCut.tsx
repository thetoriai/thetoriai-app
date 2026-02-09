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
  SparklesIcon,
  LoaderIcon,
  PenIcon,
  CircleIcon,
  SquareIcon,
  ArrowPointerIcon
} from "./Icons";

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
  points: Point[];
  color: string;
  width: number;
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

const DirectorsCut: React.FC<{
  onClose?: () => void
  consumeCredits: (action: "IMAGE" | "VIDEO_FAST") => Promise<boolean>
}> = ({
  onClose: externalClose,
  consumeCredits
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
  const [isAssetPlaying, setIsAssetPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Interaction Mode
  const [isLocked, setIsLocked] = useState(false);
  const [grabbedPart, setGrabbedPart] = useState<
    "move" | "top" | "bottom" | "left" | "right" | null
  >(null);
  const [isPinching, setIsPinching] = useState(false);
  const [isFullFrame, setIsFullFrame] = useState(false);

  // Drawing State
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingShape, setDrawingShape] = useState<DrawingShape>("free");
  const currentPathRef = useRef<Point[]>([]);

  // Generation State
  const [isCreationHubOpen, setIsCreationHubOpen] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState("");

  const startTouchRef = useRef({ x: 0, y: 0, scale: 0, dist: 0 });
  const isDraggingRef = useRef(false);
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<number | null>(null);
  const lastPenTapRef = useRef<number>(0);
  const penTapTimeoutRef = useRef<number | null>(null);

  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const requestRef = useRef<number>(0);
  const recordingIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const videoSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const activeStreamRef = useRef<MediaStream | null>(null);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) || null;

  // --- Visibility Logic (Disable Camera/Mic when navigating away) ---
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
            const visibleVideos = next.filter(
              (vId) => currentAssets.find((a) => a.id === vId)?.type === "video"
            );
            next = next.filter((vId) => !visibleVideos.includes(vId));
          } else {
            const visibleImages = next.filter(
              (vId) => currentAssets.find((a) => a.id === vId)?.type === "image"
            );
            if (visibleImages.length >= 2)
              next = next.filter((vId) => vId !== visibleImages[0]);
          }
          next.push(id);
        }
        return next;
      });
      setSelectedAssetId(id);
    },
    []
  );

  // --- AI Handlers ---
  const handleGenerateImage = async () => {
  if (!generationPrompt) return;

  const ok = await consumeCredits("IMAGE");
  if (!ok) return;

  setIsGenerating(true);
  setGenStatus("Synthesizing Image...");

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [{ text: generationPrompt }] }
    });

    let base64 = "";
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        base64 = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!base64) return;

    const id = Date.now().toString();
    const img = new Image();
    img.src = base64;

    img.onload = () => {
      const newAsset: Asset = {
        id,
        name: generationPrompt,
        type: "image",
        url: base64,
        width: img.naturalWidth,
        height: img.naturalHeight,
        transform: { ...DEFAULT_TRANSFORM },
        drawings: []
      };

      imageCache.current.set(id, img);
      setAssets((p) => {
        const next = [...p, newAsset];
        selectAndShowAsset(id, "image", next);
        return next;
      });

      setIsCreationHubOpen(false);
      setGenerationPrompt("");
    };
  } catch (err) {
    console.error(err);
    alert("Generation failed.");
  } finally {
    setIsGenerating(false);
    setGenStatus("");
  }
};



  const handleGenerateVideo = async () => {
  if (!generationPrompt) return

  // 1. DEDUCT CREDITS FIRST
  const ok = await consumeCredits("VIDEO_FAST")
  if (!ok) return

  if (typeof (window as any).aistudio?.hasSelectedApiKey === "function") {
    if (!(await (window as any).aistudio.hasSelectedApiKey()))
      await (window as any).aistudio.openSelectKey()
  }

  setIsGenerating(true)
  setGenStatus("Directing AI Video (1-2 mins)...")

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY })
    let operation = await ai.models.generateVideos({
      model: "veo-3.1-fast-generate-preview",
      prompt: generationPrompt,
      config: { numberOfVideos: 1, resolution: "720p", aspectRatio: "16:9" }
    })

    while (!operation.done) {
      await new Promise((r) => setTimeout(r, 10000))
      operation = await ai.operations.getVideosOperation({ operation })
    }

    const downloadLink =
      operation.response?.generatedVideos?.[0]?.video?.uri

    const videoRes = await fetch(
      `${downloadLink}&key=${process.env.API_KEY}`
    )

    const blob = await videoRes.blob()
    const url = URL.createObjectURL(blob)
    const id = Date.now().toString()
    const v = document.createElement("video")
    v.src = url

    v.onloadedmetadata = () => {
      const cap = document.createElement("canvas")
      cap.width = 160
      cap.height = 160
      const ctx = cap.getContext("2d")
      if (ctx) ctx.drawImage(v, 0, 0, 160, 160)
      const thumb = cap.toDataURL("image/jpeg")

      const newAsset: Asset = {
        id,
        name: generationPrompt,
        type: "video",
        url,
        thumbnail: thumb,
        width: v.videoWidth,
        height: v.videoHeight,
        transform: { ...DEFAULT_TRANSFORM },
        drawings: []
      }

      setAssets((p) => {
        const next = [...p, newAsset]
        selectAndShowAsset(id, "video", next)
        return next
      })

      setIsCreationHubOpen(false)
      setGenerationPrompt("")
    }
  } catch (err) {
    console.error(err)
    alert("Video Gen Failed.")
  } finally {
    setIsGenerating(false)
    setGenStatus("")
  
}
  };

  const resetApp = () => {
    assets.forEach((a) => URL.revokeObjectURL(a.url));
    setAssets([]);
    setVisibleAssetIds([]);
    setSelectedAssetId(null);
    setWebcamActive(false);
    setIsFullFrame(false);
    setIsAssetPlaying(false);
    if (externalClose) externalClose();
  };

  const updateAssetTransform = (id: string, updates: Partial<Transform>) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, transform: getConstrainedTransform(a, updates) }
          : a
      )
    );
  };

  const deleteAsset = (id: string) => {
    const asset = assets.find((a) => a.id === id);
    if (asset) {
      URL.revokeObjectURL(asset.url);
      imageCache.current.delete(id);
    }
    setAssets((prev) => prev.filter((a) => a.id !== id));
    setVisibleAssetIds((prev) => prev.filter((vId) => vId !== id));
    if (selectedAssetId === id) {
      setSelectedAssetId(null);
      setIsFullFrame(false);
    }
  };

  const clearAssetDrawings = (id: string) => {
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, drawings: [] } : a))
    );
  };

  const toggleAssetVisibility = (id: string) => {
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;
    setVisibleAssetIds((prev) => {
      const isVisible = prev.includes(id);
      let next = [...prev];
      if (isVisible) {
        if (selectedAssetId === id) {
          next = next.filter((vId) => vId !== id);
          setSelectedAssetId(null);
        } else {
          setSelectedAssetId(id);
        }
      } else {
        if (asset.type === "video") {
          const visibleVideos = next.filter(
            (vId) => assets.find((a) => a.id === vId)?.type === "video"
          );
          next = next.filter((vId) => !visibleVideos.includes(vId));
        } else {
          const visibleImages = next.filter(
            (vId) => assets.find((a) => a.id === vId)?.type === "image"
          );
          if (visibleImages.length >= 2)
            next = next.filter((vId) => vId !== visibleImages[0]);
        }
        next.push(id);
        setSelectedAssetId(id);
      }
      return next;
    });
  };

  const toggleAssetPlayback = useCallback(async (forceReset = false) => {
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
      videoSourceNodeRef.current.connect(audioCtx.destination);
    }
    if (forceReset) {
      v.currentTime = 0;
      v.pause();
      setIsAssetPlaying(false);
      return;
    }
    if (v.paused || v.ended) {
      v.muted = false;
      v.volume = 1;
      v.play().catch((e) => console.warn(e));
      setIsAssetPlaying(true);
    } else {
      v.pause();
      setIsAssetPlaying(false);
    }
  }, []);

  const handlePlaybackInteraction = useCallback(() => {
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
  }, [toggleAssetPlayback]);

  const handlePenInteraction = useCallback(() => {
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
          if (next) setIsLocked(true);
          else {
            setIsLocked(false);
            if (selectedAssetId) clearAssetDrawings(selectedAssetId);
          }
          return next;
        });
        penTapTimeoutRef.current = null;
      }, 300);
    }
  }, [selectedAssetId]);

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
    const renderOrder = [...visibleAssetIds].sort((a, b) =>
      a === selectedAssetId ? 1 : b === selectedAssetId ? -1 : 0
    );
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
        if (isFullFrame && id === selectedAssetId) {
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
        ctx.beginPath();
        ctx.rect(drawX, drawY, finalW, finalH);
        ctx.clip();
        ctx.drawImage(
          source,
          sW * (trans.cropLeft / 100),
          sH * (trans.cropTop / 100),
          swActual,
          shActual,
          drawX,
          drawY,
          finalW,
          finalH
        );

        const allPaths = [...asset.drawings];
        if (id === selectedAssetId && currentPathRef.current.length > 0)
          allPaths.push({
            shape: drawingShape,
            points: [...currentPathRef.current],
            color: "#eaff00",
            width: 8
          });
        allPaths.forEach((item) => {
          if (item.points.length < 1) return;
          ctx.beginPath();
          ctx.strokeStyle = item.color;
          ctx.lineWidth = item.width;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.shadowBlur = 10;
          ctx.shadowColor = item.color;
          if (item.shape === "free") {
            ctx.moveTo(
              drawX + item.points[0].x * finalW,
              drawY + item.points[0].y * finalH
            );
            for (let i = 1; i < item.points.length; i++)
              ctx.lineTo(
                drawX + item.points[i].x * finalW,
                drawY + item.points[i].y * finalH
              );
            ctx.stroke();
          } else if (item.shape === "circle" && item.points.length >= 2) {
            const centerX = drawX + item.points[0].x * finalW,
              centerY = drawY + item.points[0].y * finalH,
              edgeX = drawX + item.points[1].x * finalW,
              edgeY = drawY + item.points[1].y * finalH;
            ctx.arc(
              centerX,
              centerY,
              Math.hypot(edgeX - centerX, edgeY - centerY),
              0,
              Math.PI * 2
            );
            ctx.stroke();
          } else if (item.shape === "square" && item.points.length >= 2) {
            const centerX = drawX + item.points[0].x * finalW,
              centerY = drawY + item.points[0].y * finalH,
              edgeX = drawX + item.points[1].x * finalW,
              edgeY = drawY + item.points[1].y * finalH,
              side = Math.hypot(edgeX - centerX, edgeY - centerY);
            ctx.strokeRect(centerX - side, centerY - side, side * 2, side * 2);
          } else if (item.shape === "arrow" && item.points.length >= 2) {
            const targetX = drawX + item.points[0].x * finalW,
              targetY = drawY + item.points[0].y * finalH,
              sourceX = drawX + item.points[1].x * finalW,
              sourceY = drawY + item.points[1].y * finalH;
            ctx.moveTo(sourceX, sourceY);
            ctx.lineTo(targetX, targetY);
            ctx.stroke();
            const angle = Math.atan2(targetY - sourceY, targetX - sourceX),
              hLen = 70,
              hAng = Math.PI / 4;
            ctx.beginPath();
            ctx.moveTo(targetX, targetY);
            ctx.lineTo(
              targetX - hLen * Math.cos(angle - hAng),
              targetY - hLen * Math.sin(angle - hAng)
            );
            ctx.moveTo(targetX, targetY);
            ctx.lineTo(
              targetX - hLen * Math.cos(angle + hAng),
              targetY - hLen * Math.sin(angle + hAng)
            );
            ctx.stroke();
          }
        });
        ctx.restore();
        if (
          id === selectedAssetId &&
          !isLocked &&
          !isFullFrame &&
          !isDrawingMode
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
    isFullFrame,
    isDrawingMode,
    drawingShape
  ]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [drawFrame]);

  const handleTouchStart = (e: React.TouchEvent) => {
    isDraggingRef.current = false;
    const clientX = e.touches[0].clientX,
      clientY = e.touches[0].clientY;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvasX = (clientX - rect.left) * (1080 / rect.width),
      canvasY = (clientY - rect.top) * (1920 / rect.height);
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
      let drawX,
        drawY,
        finalW = drawW,
        finalH = drawH;
      if (isFullFrame) {
        const aR = swActual / shActual,
          fR = 1080 / 1920;
        if (aR > fR) {
          finalW = 1080;
          finalH = 1080 / aR;
        } else {
          finalH = 1920;
          finalW = 1920 * aR;
        }
        drawX = (1080 - finalW) / 2;
        drawY = (1920 - finalH) / 2;
      } else {
        drawX = 1080 * (trans.x / 100) - drawW / 2;
        drawY = 1920 * (trans.y / 100) - drawH / 2;
      }
      if (
        canvasX >= drawX &&
        canvasX <= drawX + finalW &&
        canvasY >= drawY &&
        canvasY <= drawY + finalH
      ) {
        currentPathRef.current = [
          { x: (canvasX - drawX) / finalW, y: (canvasY - drawY) / finalH }
        ];
      }
      return;
    }
    if (isLocked || isFullFrame || !selectedAssetId) return;
    if (e.touches.length === 1) {
      const trans = selectedAsset!.transform,
        w = 1080,
        h = 1920,
        sW = selectedAsset!.width,
        sH = selectedAsset!.height;
      const swActual = sW * (1 - (trans.cropLeft + trans.cropRight) / 100),
        shActual = sH * (1 - (trans.cropTop + trans.cropBottom) / 100);
      const drawW = w * (trans.scale / 100) * (swActual / sW),
        drawH = w * (trans.scale / 100) * (sH / sW) * (shActual / sH);
      const drawX = w * (trans.x / 100) - drawW / 2,
        drawY = h * (trans.y / 100) - drawH / 2,
        hit = 100;
      if (Math.abs(canvasY - drawY) < hit) setGrabbedPart("top");
      else if (Math.abs(canvasY - (drawY + drawH)) < hit)
        setGrabbedPart("bottom");
      else if (Math.abs(canvasX - drawX) < hit) setGrabbedPart("left");
      else if (Math.abs(canvasX - (drawX + drawW)) < hit)
        setGrabbedPart("right");
      else if (
        canvasX > drawX &&
        canvasX < drawX + drawW &&
        canvasY > drawY &&
        canvasY < drawY + drawH
      )
        setGrabbedPart("move");
      else setGrabbedPart(null);
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
    isDraggingRef.current = true;
    const clientX = e.touches[0].clientX,
      clientY = e.touches[0].clientY,
      rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (isDrawingMode) {
      e.preventDefault();
      if (!selectedAssetId || currentPathRef.current.length === 0) return;
      const canvasX = (clientX - rect.left) * (1080 / rect.width),
        canvasY = (clientY - rect.top) * (1920 / rect.height);
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
      let drawX,
        drawY,
        finalW = drawW,
        finalH = drawH;
      if (isFullFrame) {
        const aR = swActual / shActual,
          fR = 1080 / 1920;
        if (aR > fR) {
          finalW = 1080;
          finalH = 1080 / aR;
        } else {
          finalH = 1920;
          finalW = 1920 * aR;
        }
        drawX = (1080 - finalW) / 2;
        drawY = (1920 - finalH) / 2;
      } else {
        drawX = 1080 * (trans.x / 100) - drawW / 2;
        drawY = 1920 * (trans.y / 100) - drawH / 2;
      }
      const newPt = {
        x:
          (Math.max(drawX, Math.min(drawX + finalW, canvasX)) - drawX) / finalW,
        y: (Math.max(drawY, Math.min(drawY + finalH, canvasY)) - drawY) / finalH
      };
      if (drawingShape === "free")
        currentPathRef.current = [...currentPathRef.current, newPt];
      else currentPathRef.current = [currentPathRef.current[0], newPt];
      return;
    }
    if (isLocked || isFullFrame || !selectedAssetId) return;
    if (grabbedPart && e.touches.length === 1) {
      const w = 1080,
        h = 1920,
        dx = (clientX - startTouchRef.current.x) * (w / rect.width),
        dy = (clientY - startTouchRef.current.y) * (h / rect.height);
      const trans = { ...selectedAsset!.transform },
        sW = selectedAsset!.width,
        sH = selectedAsset!.height,
        baseDrawW = w * (trans.scale / 100),
        baseDrawH = baseDrawW * (sH / sW);
      if (grabbedPart === "move")
        updateAssetTransform(selectedAssetId, {
          x: trans.x + (dx / w) * 100,
          y: trans.y + (dy / h) * 100
        });
      else {
        const swAct = sW * (1 - (trans.cropLeft + trans.cropRight) / 100),
          shAct = sH * (1 - (trans.cropTop + trans.cropBottom) / 100);
        const xL = (w * trans.x) / 100 - (baseDrawW * swAct) / sW / 2,
          xR = (w * trans.x) / 100 + (baseDrawW * swAct) / sW / 2;
        const yT = (h * trans.y) / 100 - (baseDrawH * shAct) / sH / 2,
          yB = (h * trans.y) / 100 + (baseDrawH * shAct) / sH / 2;
        if (grabbedPart === "left") {
          const newCrop = Math.max(
            0,
            Math.min(90, trans.cropLeft + (dx / baseDrawW) * 100)
          );
          updateAssetTransform(selectedAssetId, {
            cropLeft: newCrop,
            x:
              ((xR -
                (baseDrawW * (1 - (newCrop + trans.cropRight) / 100)) / 2) /
                w) *
              100
          });
        } else if (grabbedPart === "right") {
          const newCrop = Math.max(
            0,
            Math.min(90, trans.cropRight - (dx / baseDrawW) * 100)
          );
          updateAssetTransform(selectedAssetId, {
            cropRight: newCrop,
            x:
              ((xL + (baseDrawW * (1 - (trans.cropLeft + newCrop) / 100)) / 2) /
                w) *
              100
          });
        } else if (grabbedPart === "top") {
          const newCrop = Math.max(
            0,
            Math.min(90, trans.cropTop + (dy / baseDrawH) * 100)
          );
          updateAssetTransform(selectedAssetId, {
            cropTop: newCrop,
            y:
              ((yB -
                (baseDrawH * (1 - (newCrop + trans.cropBottom) / 100)) / 2) /
                h) *
              100
          });
        } else if (grabbedPart === "bottom") {
          const newCrop = Math.max(
            0,
            Math.min(90, trans.cropBottom - (dy / baseDrawH) * 100)
          );
          updateAssetTransform(selectedAssetId, {
            cropBottom: newCrop,
            y:
              ((yT + (baseDrawH * (1 - (trans.cropTop + newCrop) / 100)) / 2) /
                h) *
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
    // Playback logic on touch end if not dragging or drawing
    // ONLY triggered if we're not pinching/dragging and we have a video selected
    if (
      !isDraggingRef.current &&
      !isPinching &&
      !isDrawingMode &&
      selectedAssetId &&
      selectedAsset?.type === "video"
    ) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const cX = (startTouchRef.current.x - rect.left) * (1080 / rect.width);
        const cY = (startTouchRef.current.y - rect.top) * (1920 / rect.height);
        const trans = selectedAsset!.transform,
          w = 1080,
          h = 1920,
          sW = selectedAsset!.width,
          sH = selectedAsset!.height;
        const swAct = sW * (1 - (trans.cropLeft + trans.cropRight) / 100),
          shAct = sH * (1 - (trans.cropTop + trans.cropBottom) / 100);
        const drawW = w * (trans.scale / 100) * (swAct / sW),
          drawH = w * (trans.scale / 100) * (sH / sW) * (shAct / sH);
        let dX,
          dY,
          fW = drawW,
          fH = drawH;
        if (isFullFrame) {
          // Full frame might have different layout, but usually it fills the 9:16 target
          const aR = swAct / shAct,
            fR = w / h;
          if (aR > fR) {
            fW = w;
            fH = w / aR;
          } else {
            fH = h;
            fW = h * aR;
          }
          dX = (w - fW) / 2;
          dY = (h - fH) / 2;
        } else {
          dX = w * (trans.x / 100) - drawW / 2;
          dY = h * (trans.y / 100) - drawH / 2;
        }

        // Hit detection specifically for the video clip on the canvas
        if (cX > dX && cX < dX + fW && cY > dY && cY < dY + fH) {
          handlePlaybackInteraction();
        }
      }
    }

    if (isDrawingMode && currentPathRef.current.length > 0 && selectedAssetId) {
      const item: DrawingItem = {
        shape: drawingShape,
        points: [...currentPathRef.current],
        color: "#eaff00",
        width: 8
      };
      setAssets((p) =>
        p.map((a) =>
          a.id === selectedAssetId
            ? { ...a, drawings: [...a.drawings, item] }
            : a
        )
      );
    }
    setGrabbedPart(null);
    setIsPinching(false);
    currentPathRef.current = [];
  };

  const toggleRecording = async () => {
    if (isRecording) {
      // --- MASTER STOP ---
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current)
        clearInterval(recordingIntervalRef.current);

      // Stop all playback immediately
      if (videoRef.current) {
        videoRef.current.pause();
        setIsAssetPlaying(false);
      }
    } else {
      // --- MASTER START ---
      if (!canvasRef.current) return;
      if (!audioContextRef.current)
        audioContextRef.current = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
      const audioCtx = audioContextRef.current;
      if (audioCtx.state === "suspended") await audioCtx.resume();
      const dest = audioCtx.createMediaStreamDestination();
      const webcamStream = webcamRef.current?.srcObject as MediaStream;
      if (webcamStream?.getAudioTracks().length > 0)
        audioCtx.createMediaStreamSource(webcamStream).connect(dest);
      if (videoRef.current?.src) {
        if (!videoSourceNodeRef.current)
          videoSourceNodeRef.current = audioCtx.createMediaElementSource(
            videoRef.current
          );
        videoSourceNodeRef.current.connect(dest);
      }
      const compositeStream = canvasRef.current.captureStream(30);
      dest.stream
        .getAudioTracks()
        .forEach((track) => compositeStream.addTrack(track));
      const mime =
        ["video/mp4;codecs=h264,aac", "video/mp4", "video/webm"].find((m) =>
          MediaRecorder.isTypeSupported(m)
        ) || "video/webm";
      const recorder = new MediaRecorder(compositeStream, { mimeType: mime });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mime });
        const fileName = `directors-cut-${Date.now()}.mp4`;

        const tryShare = async () => {
          const file = new File([blob], fileName, { type: mime });
          if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({ files: [file] })
          ) {
            try {
              await navigator.share({
                files: [file],
                title: "Director's Cut Studio",
                text: "My new reaction montage!"
              });
              return true;
            } catch (err) {
              console.warn("Share failed or cancelled", err);
              return false;
            }
          }
          return false;
        };

        const success = await tryShare();
        if (!success) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
        a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
        a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        setRecordingTime(0);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      recordingIntervalRef.current = window.setInterval(
        () => setRecordingTime((p) => p + 1),
        1000
      );
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type.startsWith("video") ? "video" : "image",
      url = URL.createObjectURL(file),
      id = Date.now().toString();
    if (type === "video") {
      const v = document.createElement("video");
      v.src = url;
      v.muted = true;
      v.playsInline = true;
      v.crossOrigin = "anonymous";
      v.load();
      v.onloadeddata = () => {
        v.currentTime = 0.5;
      };
      v.onseeked = () => {
        const cap = document.createElement("canvas");
        cap.width = 160;
        cap.height = 160;
        const ctx = cap.getContext("2d");
        if (ctx) ctx.drawImage(v, 0, 0, 160, 160);
        const thumb = cap.toDataURL("image/jpeg");
        const newAsset: Asset = {
          id,
          name: file.name,
          type,
          url,
          thumbnail: thumb,
          width: v.videoWidth,
          height: v.videoHeight,
          transform: { ...DEFAULT_TRANSFORM },
          drawings: []
        };
        setAssets((p) => {
          const next = [...p, newAsset];
          selectAndShowAsset(id, "video", next);
          return next;
        });
      };
    } else {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        const newAsset: Asset = {
          id,
          name: file.name,
          type,
          url,
          width: img.naturalWidth,
          height: img.naturalHeight,
          transform: { ...DEFAULT_TRANSFORM },
          drawings: []
        };
        imageCache.current.set(id, img);
        setAssets((p) => {
          const next = [...p, newAsset];
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
      >
        <div className="relative aspect-[9/16] h-full max-h-full overflow-hidden bg-[#050505] shadow-2xl rounded-2xl border border-white/10">
          <canvas
            ref={canvasRef}
            width={1080}
            height={1920}
            className="w-full h-full object-contain"
          />
        </div>

        <button
          onClick={resetApp}
          className="absolute top-6 left-6 z-50 w-8 h-8 flex items-center justify-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-full text-white/60 hover:text-white transition-all shadow-xl active:scale-90"
        >
          <XIcon className="text-xs" />
        </button>

        <button
          onClick={() =>
            setCameraFacing((p) => (p === "user" ? "environment" : "user"))
          }
          className="absolute top-6 right-6 z-50 w-7 h-7 flex items-center justify-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-full text-white/60 hover:text-white transition-all shadow-xl active:scale-90"
        >
          <ArrowsRightLeftIcon className="text-xs" />
        </button>

        {/* LEFT SIDEBAR - Playback & Tools */}
        <div
          className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col space-y-4 z-30"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <button
            onClick={handlePenInteraction}
            className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center transition-all ${isDrawingMode ? "bg-yellow-400 text-black shadow-[0_0_15px_rgba(234,255,0,0.5)]" : "bg-white text-black shadow-xl"} active:scale-90`}
          >
            {drawingShape === "free" ? (
              <PenIcon className="text-lg" />
            ) : drawingShape === "circle" ? (
              <CircleIcon className="text-lg" />
            ) : drawingShape === "square" ? (
              <SquareIcon className="text-lg" />
            ) : (
              <ArrowPointerIcon className="text-lg" />
            )}
            <span className="text-[5px] font-black mt-0.5 tracking-tighter uppercase">
              {isDrawingMode ? "PEN ON" : "DRAW"}
            </span>
          </button>
          {selectedAsset?.type === "video" && (
            <div className="flex flex-col space-y-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlaybackInteraction();
                }}
                className={`w-14 h-14 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90 ${isAssetPlaying ? "text-emerald-400" : "text-white/40"}`}
              >
                {isAssetPlaying ? (
                  <PauseIcon className="text-2xl" />
                ) : (
                  <PlayIcon className="text-2xl" />
                )}
                <span className="text-[8px] font-black mt-1 tracking-tighter uppercase">
                  {isAssetPlaying ? "Playing" : "Play"}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR - AI & View */}
        <div
          className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col space-y-3 z-30"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setWebcamActive(!webcamActive)}
            className={`w-12 h-12 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90 ${webcamActive ? "text-white" : "text-white/30"}`}
          >
            <CameraIcon className="text-lg" />
            <span className="text-[7px] font-black mt-1 tracking-widest uppercase">
              Sight
            </span>
          </button>
          <button
            onClick={() => setIsCreationHubOpen(true)}
            className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-indigo-600 border border-white/20 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90 text-white shadow-xl"
          >
            <SparklesIcon className="text-lg" />
            <span className="text-[7px] font-black mt-1 tracking-widest uppercase">
              Gen
            </span>
          </button>
          {selectedAssetId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsFullFrame(!isFullFrame);
              }}
              className={`w-12 h-12 backdrop-blur-3xl border border-white/20 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90 ${isFullFrame ? "bg-emerald-600 text-white border-emerald-400" : "bg-white/10 text-white"}`}
            >
              {isFullFrame ? (
                <CompressIcon className="text-lg" />
              ) : (
                <ExpandIcon className="text-lg" />
              )}
              <span className="text-[7px] font-black mt-1 tracking-tighter uppercase">
                View
              </span>
            </button>
          )}
        </div>

        {/* FLOATING DELETE */}
        {selectedAssetId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteAsset(selectedAssetId);
            }}
            className="absolute bottom-6 right-6 z-50 w-14 h-14 bg-black/60 backdrop-blur-xl border-2 border-red-500/40 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90 text-red-500 hover:bg-red-500/20"
          >
            <TrashIcon className="text-xs" />
            <span className="text-[5px] font-black mt-0.5 tracking-tighter uppercase">
              Remove
            </span>
          </button>
        )}

        <div className="fixed top-0 left-0 opacity-0 pointer-events-none w-10 h-10 -z-50 overflow-hidden">
          <video
            ref={videoRef}
            src={currentVisibleVideo?.url}
            playsInline
            muted
            crossOrigin="anonymous"
            loop
          />
          <video ref={webcamRef} autoPlay muted playsInline />
        </div>
      </section>

      <footer className="relative flex-none bg-black flex flex-col items-center justify-between pb-safe pt-2 px-4 z-40 overflow-hidden min-h-[140px] border-t border-white/5">
        <div className="w-full flex items-center justify-center space-x-2 mt-2 overflow-x-auto no-scrollbar">
          {assets.map((asset) => {
            const isVisible = visibleAssetIds.includes(asset.id),
              isSelected = selectedAssetId === asset.id;
            return (
              <button
                key={asset.id}
                onClick={() => toggleAssetVisibility(asset.id)}
                className={`shrink-0 w-12 h-12 rounded-xl border-2 transition-all overflow-hidden relative flex items-center justify-center bg-zinc-900 ${isVisible ? (isSelected ? "border-emerald-500 opacity-100" : "border-white opacity-80") : "border-zinc-800 opacity-30"} ${isSelected ? "scale-110 shadow-lg shadow-emerald-500/20" : "scale-100"}`}
              >
                <img
                  src={asset.type === "video" ? asset.thumbnail : asset.url}
                  className="w-full h-full object-cover pointer-events-none"
                />
                <div className="absolute top-1 right-1">
                  {asset.type === "video" ? (
                    <FilmIcon className="text-[16px] text-white/90 bg-black/70 p-1.5 rounded-sm" />
                  ) : (
                    <ImageIcon className="text-[16px] text-white/90 bg-black/70 p-1.5 rounded-sm" />
                  )}
                </div>
              </button>
            );
          })}
          <label
            className="
    shrink-0
    w-14 h-14
    sm:w-14 sm:h-14
    md:w-12 md:h-12
    lg:w-9 lg:h-9
    bg-zinc-900
    border-2 border-zinc-800 border-dashed
    rounded-xl
    flex items-center justify-center
    cursor-pointer
    transition-all
    active:scale-95
  "
          >
            <PlusIcon
              className="
      w-6 h-6
      sm:w-6 sm:h-6
      md:w-5 md:h-5
      lg:w-4 lg:h-4
      text-zinc-500
    "
            />
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept="image/*,video/*"
            />
          </label>
        </div>
        <div className="relative w-full flex justify-center py-4">
          <button
            onClick={toggleRecording}
            disabled={visibleAssetIds.length === 0}
            className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 shadow-2xl border-4 ${isRecording ? "bg-red-600 border-red-500" : "bg-white border-zinc-300"}`}
          >
            <div
              className={`transition-all duration-300 ${isRecording ? "w-5 h-5 bg-white rounded-sm" : "w-7 h-7 bg-red-600 rounded-full"}`}
            />
          </button>
          {isRecording && (
            <div className="absolute top-1/2 -translate-y-1/2 right-4 bg-red-600 px-3 py-1 rounded-full text-[10px] font-black tracking-widest text-white shadow-lg flex items-center">
              <span className="w-2.5 h-2.5 bg-white rounded-full mr-1.5 animate-ping" />
              {Math.floor(recordingTime / 60)}:
              {(recordingTime % 60).toString().padStart(2, "0")}
            </div>
          )}
        </div>
      </footer>

      {isCreationHubOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-2xl flex items-end justify-center animate-fade-in">
          <div className="w-full max-w-lg bg-zinc-900 rounded-t-[40px] p-8 border-t border-white/10 shadow-2xl animate-slide-up relative">
            <button
              onClick={() => setIsCreationHubOpen(false)}
              className="absolute top-6 right-8 text-white/40 hover:text-white transition-colors"
            >
              <XIcon className="text-2xl" />
            </button>
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-12 h-12 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                <SparklesIcon className="text-white text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase italic tracking-tighter">
                  AI Studio
                </h2>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                  Generate media from words
                </p>
              </div>
            </div>
            <textarea
              value={generationPrompt}
              onChange={(e) => setGenerationPrompt(e.target.value)}
              placeholder="Describe your scene..."
              className="w-full bg-black/40 border border-white/10 rounded-3xl p-6 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all min-h-[120px] mb-6"
              disabled={isGenerating}
            />
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleGenerateImage}
                disabled={isGenerating || !generationPrompt}
                className="group bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 flex flex-col items-center transition-all active:scale-95 disabled:opacity-50"
              >
                <ImageIcon className="text-2xl mb-2 text-blue-400" />
                <span className="text-xs font-black uppercase">Photo</span>
              </button>
              <button
                onClick={handleGenerateVideo}
                disabled={isGenerating || !generationPrompt}
                className="group bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 flex flex-col items-center transition-all active:scale-95 disabled:opacity-50"
              >
                <FilmIcon className="text-2xl mb-2 text-purple-400" />
                <span className="text-xs font-black uppercase">Video</span>
              </button>
            </div>
            {isGenerating && (
              <div className="mt-8 p-6 bg-purple-500/10 border border-purple-500/20 rounded-3xl flex items-center justify-center space-x-4 animate-pulse text-purple-200">
                <LoaderIcon className="text-xl" />{" "}
                <span className="text-sm font-bold">{genStatus}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {assets.length === 0 && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-8 text-center space-y-12 ">
          <div className="w-24 h-24 bg-red-600 rounded-[0.5rem] flex items-center justify-center transform -rotate-12 shadow-[0_30px_70px_-1px_rgba(220,38,38,0.6)] overflow-hidden ">
            <ClapperboardIcon className="text-7xl text-white  " />
          </div>
          <div className="space-y-2 ">
            <h1 className="text-4xl font-black italic tracking-tighter text-white  leading-none ">
              Direct Cut
            </h1>
            <p className="text-white/30 text-[12px] font-bold tracking-[0.6em]  ">
              Reaction Assembly Studio
            </p>
          </div>
          <div className="w-full max-w-xs space-y-4 ">
            <label className="block w-full bg-white text-black py-5 rounded-3xl font-black cursor-pointer active:scale-95 text-center text-sm tracking-widest shadow-2xl transition-transform ">
              Import Media
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,video/*"
              />
            </label>
            <button
              onClick={() => setIsCreationHubOpen(true)}
              className="block w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-5 rounded-3xl font-black active:scale-95 text-sm tracking-widest shadow-2xl  "
            >
              AI Generate
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
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `
        }}
      />
    </div>
  );
};

export default DirectorsCut;
