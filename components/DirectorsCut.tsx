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
  LoaderIcon,
  RepeatIcon,
  VolumeXIcon
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

const DirectorsCut: React.FC<{ onClose?: () => void }> = ({
  onClose: externalClose
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
  const [isLooping, setIsLooping] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Interaction Mode
  const [isLocked, setIsLocked] = useState(false);
  const [grabbedPart, setGrabbedPart] = useState<
    "move" | "top" | "bottom" | "left" | "right" | null
  >(null);
  const [isPinching, setIsPinching] = useState(false);
  const [isFullFrame, setIsFullFrame] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Drawing State
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingShape, setDrawingShape] = useState<DrawingShape>("free");
  const currentPathRef = useRef<Point[]>([]);

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
  const gainNodeRef = useRef<GainNode | null>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const activeStreamRef = useRef<MediaStream | null>(null);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) || null;

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

  const resetApp = () => {
    assets.forEach((a) => URL.revokeObjectURL(a.url));
    setAssets([]);
    setVisibleAssetIds([]);
    setSelectedAssetId(null);
    setWebcamActive(false);
    setIsFullFrame(false);
    setIsAssetPlaying(false);
    setIsLooping(false);
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

  const toggleAssetPlayback = useCallback(
    async (forceReset = false) => {
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
    [isLooping]
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
          }
          return next;
        });
        penTapTimeoutRef.current = null;
      }, 300);
    }
  }, [selectedAssetId]);

  // --- Magic Cutout Logic ---
  const processTransparency = (img: HTMLImageElement): string => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return img.src;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Sample background from top-left corner
    const bgR = data[0],
      bgG = data[1],
      bgB = data[2];
    const threshold = 40;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const dist = Math.sqrt(
        Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2)
      );
      if (dist < threshold) {
        data[i + 3] = 0; // Transparent
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  };

  const handleMagicCutout = async () => {
    if (!selectedAsset || selectedAsset.type !== "image") return;
    setIsAiProcessing(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      let base64Data = "";
      if (selectedAsset.url.startsWith("data:")) {
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

      const prompt = `Remove the background from this image. Keep only the subject highlighted by the user markings. Return the subject as a high-quality cutout. The background must be a pure solid black color so it can be extracted for transparency. Edge quality is critical.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: "image/png" } },
            { text: prompt }
          ]
        }
      });

      let resultUrl = "";
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          resultUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (resultUrl) {
        const img = new Image();
        img.src = resultUrl;
        img.onload = () => {
          // Force transparency based on solid background sampling
          const transparentUrl = processTransparency(img);
          const finalImg = new Image();
          finalImg.src = transparentUrl;
          finalImg.onload = () => {
            imageCache.current.set(selectedAsset.id, finalImg);
            setAssets((prev) =>
              prev.map((a) =>
                a.id === selectedAsset.id
                  ? {
                      ...a,
                      url: transparentUrl,
                      width: finalImg.naturalWidth,
                      height: finalImg.naturalHeight,
                      drawings: []
                    }
                  : a
              )
            );
          };
        };
      }
    } catch (err) {
      console.error("Magic failed", err);
      alert("AI processing failed. Check your connection or markings.");
    } finally {
      setIsAiProcessing(false);
    }
  };

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
            const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
            const hLen = 65,
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
        if (
          id === selectedAssetId &&
          !isLocked &&
          !isFullFrame &&
          !isDrawingMode &&
          !isAiProcessing
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
    drawingShape,
    isAiProcessing
  ]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [drawFrame]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAiProcessing) return;
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
    if (isAiProcessing) return;
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
    if (isAiProcessing) return;
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

              {/* Loop & Mute Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLooping(!isLooping);
                }}
                className={`w-14 h-14 backdrop-blur-3xl border border-white/20 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90 ${isLooping ? "bg-indigo-600 text-white border-indigo-400" : "bg-white/10 text-white/40"}`}
              >
                {isLooping ? (
                  <RepeatIcon className="text-xl" />
                ) : (
                  <VolumeXIcon className="text-xl" />
                )}
                <span className="text-[7px] font-black mt-1 tracking-tighter uppercase">
                  {isLooping ? "Looping" : "Normal"}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR - View & Camera */}
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

          {/* Magic Button (Relocated back to sidebar) */}
          {selectedAsset?.type === "image" && (
          <button
              onClick={handleMagicCutout}
              disabled={isAiProcessing}
              className={`w-12 h-12 bg-gradient-to-tr from-purple-600 to-indigo-600 border border-white/20 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90 text-white shadow-xl ${isAiProcessing ? "animate-pulse" : ""}`}
          >
              {isAiProcessing ? (
                <LoaderIcon className="text-lg" />
              ) : (
            <SparklesIcon className="text-lg" />
              )}
              <span className="text-[7px] font-black mt-1 tracking-tighter uppercase">
                Magic
            </span>
          </button>
          )}

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
            crossOrigin="anonymous"
            muted={isLooping}
            loop={isLooping}
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
                    <FilmIcon className="text-[14px] text-white/90 bg-black/70 p-1.5 rounded-sm" />
                  ) : (
                    <ImageIcon className="text-[14px] text-white/90 bg-black/70 p-1.5 rounded-sm" />
                  )}
                </div>
              </button>
            );
          })}
          <label className="shrink-0 w-14 h-14 bg-zinc-900 border-2 border-zinc-800 border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-95">
            <PlusIcon className="w-6 h-6 text-zinc-500" />
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
