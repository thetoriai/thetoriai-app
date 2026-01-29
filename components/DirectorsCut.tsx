import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  XIcon,
  LockIcon,
  LockOpenIcon,
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
  ArrowsRightLeftIcon
} from "./Icons";

/**
 * REFACTOR: Decentralized Icons
 * All icon logic is now handled by the Icons.tsx module.
 * This ensures consistency across the app and simplifies the render block.
 */

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

export interface Asset {
  id: string;
  type: 'video' | 'image';
  url: string;
  thumbnail?: string; // Generated on upload for reliability
  name: string;
  width: number;
  height: number;
  transform: Transform;
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
  const [webcamFlipped, setWebcamFlipped] = useState(false); // UI Mirroring
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">(
    "user"
  ); // Hardware Lens switching

  const [isRecording, setIsRecording] = useState(false);
  const [isAssetPlaying, setIsAssetPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  
  // Interaction Mode
  const [isLocked, setIsLocked] = useState(false); 
  const [grabbedPart, setGrabbedPart] = useState<
    "move" | "top" | "bottom" | "left" | "right" | null
  >(null);
  const [isPinching, setIsPinching] = useState(false);
  const [isFullFrame, setIsFullFrame] = useState(false);
  
  // Tracking asset dimensions
  const [activeAssetDimensions, setActiveAssetDimensions] = useState({ w: 1, h: 1 });
  
  const startTouchRef = useRef({ x: 0, y: 0, scale: 0, dist: 0 });
  const lastTapRef = useRef<number>(0);

  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const requestRef = useRef<number>(0);
  const recordingIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const videoSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Cache for static assets (images)
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // TRACKING REF: To ensure camera hardware is fully stopped on unmount
  const activeStreamRef = useRef<MediaStream | null>(null);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) || null;

  // --- Helpers ---
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
        a.id === id ? { ...a, transform: { ...a.transform, ...updates } } : a
      )
    );
  };

  const deleteAsset = (id: string) => {
    const assetToDelete = assets.find((a) => a.id === id);
    if (assetToDelete) {
      URL.revokeObjectURL(assetToDelete.url);
      imageCache.current.delete(id);
    }
    
    setAssets((prev) => prev.filter((a) => a.id !== id));
    setVisibleAssetIds((prev) => prev.filter((vId) => vId !== id));
    if (selectedAssetId === id) {
      setSelectedAssetId(null);
        setIsFullFrame(false);
      }
  };

  const toggleAssetVisibility = (id: string) => {
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;

    setVisibleAssetIds((prev) => {
      const isVisible = prev.includes(id);
      let next = [...prev];

      if (isVisible) {
        // If it's already selected and visible, we toggle it OFF
        if (selectedAssetId === id) {
          next = next.filter((vId) => vId !== id);
          setSelectedAssetId(null);
        } else {
          // If it's visible but not selected, we SELECT it
          setSelectedAssetId(id);
        }
      } else {
        // Add to visible stage
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

    // AUDIO STABILITY: Maintain high-priority routing for both preview and recording.
    if (!audioContextRef.current)
      audioContextRef.current = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    const audioCtx = audioContextRef.current;

    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    // Ensure Routing: If not recording, we still need to route through the context
    // to prevent the "1-second skip" which happens when the browser mutes unhandled nodes.
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
      // Explicitly check volume and mute status to bypass aggressive autoplay blocks.
      v.muted = false;
      v.volume = 1;
      const playPromise = v.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) =>
          console.warn("Native Playback Logic Interrupted:", err)
        );
      }
      setIsAssetPlaying(true);
    } else {
      v.pause();
      setIsAssetPlaying(false);
    }
  }, []);

  // Sync state with actual video element status
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const updatePlaying = () => setIsAssetPlaying(!v.paused && !v.ended);
    v.addEventListener("play", updatePlaying);
    v.addEventListener("pause", updatePlaying);
    v.addEventListener("ended", updatePlaying);
    return () => {
      v.removeEventListener("play", updatePlaying);
      v.removeEventListener("pause", updatePlaying);
      v.removeEventListener("ended", updatePlaying);
    };
  }, []);

  /**
   * REFINED WEBCAM LIFECYCLE
   * This effect ensures that all tracks are closed when navigating away (unmounting).
   */
  useEffect(() => {
    const stopTracks = () => {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((track) => {
          track.stop();
          console.log(`Director's Cut: Stopped hardware track [${track.kind}]`);
        });
        activeStreamRef.current = null;
      }
      if (webcamRef.current) webcamRef.current.srcObject = null;
    };

    const startWebcam = async () => {
      stopTracks();

      const constraintStages = [
        // Stage 1: Ideal facing + Audio + High-res
        {
          video: {
            facingMode: cameraFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true 
        },
        // Stage 2: Ideal facing + Audio (Auto resolution)
        { video: { facingMode: cameraFacing }, audio: true },
        // Stage 3: Facing only (No audio)
        { video: { facingMode: cameraFacing }, audio: false },
        // Stage 4: Basic any video device
        { video: true, audio: false }
      ];

      let stream: MediaStream | null = null;
      let lastError: any = null;

      for (const constraints of constraintStages) {
        try {
          console.log(
            "Director's Cut: Attempting camera access with:",
            constraints
          );
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream) break;
        } catch (err) {
          console.warn(`Director's Cut: Camera stage failed:`, err);
          lastError = err;
        }
      }

      if (stream) {
          activeStreamRef.current = stream;
          if (webcamRef.current) {
            webcamRef.current.srcObject = stream;
            webcamRef.current.play().catch(() => {});
          }
      } else {
        console.error(
          "Director's Cut: All camera access stages failed:",
          lastError
        );
          setWebcamActive(false);
        }
    };

    if (webcamActive) {
      startWebcam();
    } else {
      stopTracks();
    }

    // MANDATORY CLEANUP ON UNMOUNT (NAVIGATING AWAY)
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

    // 1. Webcam background
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
        const sx = sW * (trans.cropLeft / 100);
        const sy = sH * (trans.cropTop / 100);
        const swActual = sW * (1 - (trans.cropLeft + trans.cropRight) / 100);
        const shActual = sH * (1 - (trans.cropTop + trans.cropBottom) / 100);

        const baseDrawW = w * (trans.scale / 100);
        const baseDrawH = baseDrawW * (sH / sW);
        const drawW = baseDrawW * (swActual / sW),
          drawH = baseDrawH * (shActual / sH);

        let drawX,
          drawY,
          finalW = drawW,
          finalH = drawH;

        if (isFullFrame && id === selectedAssetId) {
          const assetAspect = swActual / shActual,
            frameAspect = w / h;
          if (assetAspect > frameAspect) {
            finalW = w;
            finalH = w / assetAspect;
          } else {
            finalH = h;
            finalW = h * assetAspect;
          }
          drawX = (w - finalW) / 2;
          drawY = (h - finalH) / 2;
        } else {
          drawX = w * (trans.x / 100) - drawW / 2;
          drawY = h * (trans.y / 100) - drawH / 2;
        }
        
        ctx.save();
        if (id === selectedAssetId && !isLocked && !isFullFrame) {
          // Glow and Stroke for Selected
          ctx.shadowColor = "rgba(255,255,255,0.4)";
          ctx.shadowBlur = 20;
          ctx.strokeStyle = "white";
          ctx.lineWidth = 4;
          ctx.strokeRect(drawX, drawY, finalW, finalH);

          // Render Handles
          ctx.fillStyle = "white";
          ctx.shadowBlur = 0;
          const hSize = 50,
            hThick = 15;
          ctx.fillRect(
            drawX + finalW / 2 - hSize / 2,
            drawY - hThick / 2,
            hSize,
            hThick
          ); // Top
          ctx.fillRect(
            drawX + finalW / 2 - hSize / 2,
            drawY + finalH - hThick / 2,
            hSize,
            hThick
          ); // Bottom
          ctx.fillRect(
            drawX - hThick / 2,
            drawY + finalH / 2 - hSize / 2,
            hThick,
            hSize
          ); // Left
          ctx.fillRect(
            drawX + finalW - hThick / 2,
            drawY + finalH / 2 - hSize / 2,
            hThick,
            hSize
          ); // Right
        }

        ctx.drawImage(
          source,
          sx,
          sy,
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

    requestRef.current = requestAnimationFrame(drawFrame);
  }, [
    visibleAssetIds,
    assets,
    selectedAssetId,
    webcamActive,
    webcamFlipped,
    isLocked,
    isFullFrame
  ]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [drawFrame]);

  // --- Input Handlers ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isLocked || isFullFrame || !selectedAssetId) return;
    const clientX = e.touches[0].clientX,
      clientY = e.touches[0].clientY;

    // Map client coordinates to canvas space for hit detection
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const canvasX = (clientX - rect.left) * (1080 / rect.width);
    const canvasY = (clientY - rect.top) * (1920 / rect.height);

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
        drawY = h * (trans.y / 100) - drawH / 2;
      const hit = 100;
      if (
        Math.abs(canvasY - drawY) < hit &&
        Math.abs(canvasX - (drawX + drawW / 2)) < 200
      )
        setGrabbedPart("top");
      else if (
        Math.abs(canvasY - (drawY + drawH)) < hit &&
        Math.abs(canvasX - (drawX + drawW / 2)) < 200
      )
        setGrabbedPart("bottom");
      else if (
        Math.abs(canvasX - drawX) < hit &&
        Math.abs(canvasY - (drawY + drawH / 2)) < 200
      )
        setGrabbedPart("left");
      else if (
        Math.abs(canvasX - (drawX + drawW)) < hit &&
        Math.abs(canvasY - (drawY + drawH / 2)) < 200
      )
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
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      startTouchRef.current = {
        ...startTouchRef.current,
        dist,
        scale: selectedAsset?.transform.scale || 65
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isLocked || isFullFrame || !selectedAssetId) return;
    const clientX = e.touches[0].clientX,
      clientY = e.touches[0].clientY;

    if (grabbedPart && e.touches.length === 1) {
      const w = 1080,
        h = 1920,
        rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = (clientX - startTouchRef.current.x) * (w / rect.width),
        dy = (clientY - startTouchRef.current.y) * (h / rect.height);
      const trans = { ...selectedAsset!.transform },
        sW = selectedAsset!.width,
        sH = selectedAsset!.height;
      const baseDrawW = w * (trans.scale / 100),
        baseDrawH = baseDrawW * (sH / sW);

      if (grabbedPart === "move") {
        updateAssetTransform(selectedAssetId, {
          x: trans.x + (dx / w) * 100,
          y: trans.y + (dy / h) * 100
        });
      } else {
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

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current)
        clearInterval(recordingIntervalRef.current);
    } else {
      if (!canvasRef.current) return;
      if (!audioContextRef.current)
        audioContextRef.current = new AudioContext();
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
        videoSourceNodeRef.current.disconnect();
        videoSourceNodeRef.current.connect(dest);
        videoSourceNodeRef.current.connect(audioCtx.destination);
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
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime }),
          url = URL.createObjectURL(blob),
          a = document.createElement("a");
          a.href = url;
          a.download = `directors-cut-${Date.now()}.${mime.includes("mp4") ? "mp4" : "webm"}`;
          a.click();
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

      const loadVideo = () =>
        new Promise<void>((resolve) => {
        v.onloadedmetadata = () => {
            v.currentTime = 0.5;
          };
          v.onseeked = () => resolve();
        });

      await loadVideo();
      const cap = document.createElement("canvas");
      cap.width = 160;
      cap.height = 160;
      const ctx = cap.getContext("2d");
            if (ctx) {
        const r = v.videoWidth / v.videoHeight;
              let sw, sh, sx, sy;
        if (r > 1) {
                sh = v.videoHeight;
                sw = sh;
                sx = (v.videoWidth - sw) / 2;
                sy = 0;
              } else {
                sw = v.videoWidth;
                sh = sw;
                sx = 0;
                sy = (v.videoHeight - sh) / 2;
              }
              ctx.drawImage(v, sx, sy, sw, sh, 0, 0, 160, 160);
            }
      const thumbnail = cap.toDataURL("image/jpeg");
      const newAsset: Asset = {
        id,
        name: file.name,
              type,
        url,
              thumbnail,
              width: v.videoWidth,
              height: v.videoHeight,
        transform: { ...DEFAULT_TRANSFORM }
      };
      setAssets((p) => [...p, newAsset]);
            setVisibleAssetIds((prev) => [
        ...prev.filter(
          (vid) => assets.find((a) => a.id === vid)?.type !== "video"
        ),
              id
            ]);
            setSelectedAssetId(id);
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
            transform: { ...DEFAULT_TRANSFORM }
          };
          imageCache.current.set(id, img);
          setAssets((p) => [...p, newAsset]);
          setVisibleAssetIds((prev) => {
          const visibleImages = prev.filter(
            (vid) => assets.find((a) => a.id === vid)?.type === "image"
          );
            const next =
              visibleImages.length >= 2
                ? prev.filter((vid) => vid !== visibleImages[0])
                : prev;
            return [...next, id];
          });
          setSelectedAssetId(id);
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
        onTouchEnd={() => {
          setGrabbedPart(null);
          setIsPinching(false);
        }}
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

        {/* LENS SWITCHER: Fixes "Requested device not found" by allowing hardware lens toggle */}
        <button
          onClick={() =>
            setCameraFacing((prev) =>
              prev === "user" ? "environment" : "user"
            )
          }
          className={`absolute top-6 right-6 z-50 w-7 h-7 flex items-center justify-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-full transition-all shadow-xl active:scale-90 ${cameraFacing === "environment" ? "text-green-400 border-green-500/50" : "text-white/60 hover:text-white"}`}
          title="Switch Camera Lens"
        >
          <ArrowsRightLeftIcon className="text-xs" />
        </button>
            
        <div
          className="absolute left-2 top-58 flex flex-col space-y-4 z-30"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center transition-all ${isLocked ? "bg-red-600 text-white shadow-lg" : "bg-white text-black shadow-xl"} active:scale-90`}
          >
            {isLocked ? (
              <LockIcon className="text-lg" />
            ) : (
              <LockOpenIcon className="text-lg" />
            )}
            <span className="text-[5px] font-black  mt-0.5 tracking-tighter">
              {isLocked ? "LOCKED" : "LOCK"}
            </span>
          </button>

          {/* CONTEXTUAL UI: Playback controls only appear when a video asset is selected */}
          {selectedAsset?.type === "video" && (
            <div className="flex flex-col space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <button
                onClick={() => toggleAssetPlayback()}
                className={`w-12 h-12 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90 ${isAssetPlaying ? "text-white" : "text-white/40"}`}
              >
                {isAssetPlaying ? (
                  <PauseIcon className="text-lg" />
                ) : (
                  <PlayIcon className="text-lg" />
                )}
                <span className="text-[7px] font-black  mt-1 tracking-tighter">
                  PLAY
                </span>
              </button>
              <button
                onClick={() => toggleAssetPlayback(true)}
                className="w-12 h-12 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-2xl flex flex-col items-center justify-center active:scale-90 text-white/40"
              >
                <ResetIcon className="text-lg" />
                <span className="text-[7px] font-black  mt-1 tracking-tighter">
                  RESET
                </span>
              </button>
            </div>
          )}
        </div>

        {/* --- RIGHT SIDEBAR (MODES) --- */}
        <div
          className="absolute right-2 top-58 flex flex-col space-y-3 z-30"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setWebcamActive(!webcamActive)}
            className={`w-12 h-12 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90 ${webcamActive ? "text-white" : "text-white/30"}`}
          >
            <CameraIcon className="text-lg" />
            <span className="text-[7px] font-black  mt-1 tracking-widest">
              SIGHT
            </span>
          </button>

          <button
            onClick={() => setWebcamFlipped(!webcamFlipped)}
            className={`w-7 h-7 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-lg flex flex-col items-center justify-center transition-all active:scale-90 ${webcamFlipped ? "text-indigo-400" : "text-white/30"}`}
          >
            <ArrowsRightLeftIcon className="text-[10px]" />
            <span className="text-[4px] font-black uppercase mt-0.5 tracking-tighter">
              FLIP
            </span>
          </button>

          {selectedAssetId && (
            <>
              <button
                onClick={() => setIsFullFrame(!isFullFrame)}
                className={`w-12 h-12 backdrop-blur-3xl border border-white/20 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90 ${isFullFrame ? "bg-blue-600 text-white border-blue-400" : "bg-white/10 text-white"}`}
              >
                {isFullFrame ? (
                  <CompressIcon className="text-lg" />
                ) : (
                  <ExpandIcon className="text-lg" />
                )}
                <span className="text-[7px] font-black  mt-1 tracking-tighter">
                  VIEW
                </span>
              </button>

              <button
                onClick={() => deleteAsset(selectedAssetId)}
                className="w-12 h-12 bg-red-600/20 hover:bg-red-600 backdrop-blur-3xl border border-red-500/30 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90 text-red-500 hover:text-white"
              >
                <TrashIcon className="text-xs" />
                <span className="text-[5px] font-black  mt-0.5 tracking-tighter">
                  REMOVE
                </span>
              </button>
            </>
          )}
        </div>

        {/* 
            CRITICAL FIX: Ensure source elements are technially "visible" for browsers to decode frames.
            Opacity-0 and fixed positioning allows background decoding without UI clutter.
        */}
        <div className="fixed top-0 left-0 opacity-0 pointer-events-none w-10 h-10 -z-50 overflow-hidden">
          <video
            ref={videoRef}
            src={currentVisibleVideo?.url}
            playsInline
            muted
            crossOrigin="anonymous"
          />
          <video ref={webcamRef} autoPlay muted playsInline />
        </div>
      </section>

      {/* 2. FOOTER */}
      <footer className="relative flex-none bg-black flex flex-col items-center justify-between pb-safe pt-2 px-4 z-40 overflow-hidden min-h-[140px] border-t border-white/5">
        <div className="w-full flex items-center justify-center space-x-2 mt-2 overflow-x-auto no-scrollbar">
          {assets.map((asset) => {
            const isVisible = visibleAssetIds.includes(asset.id),
              isSelected = selectedAssetId === asset.id;
            return (
              <button
                key={asset.id}
                onClick={() => toggleAssetVisibility(asset.id)}
                /* 
            down button video & image holder        */

                className={`shrink-0 w-12 h-12 rounded-xl border-2 transition-all overflow-hidden relative flex items-center justify-center bg-zinc-900 ${isVisible ? "border-white opacity-100 ring-2 ring-white/10" : "border-zinc-800 opacity-30"} ${isSelected ? "scale-110 shadow-lg shadow-white/10 border-white" : "scale-100"}`}
              >
                <img
                  src={asset.type === "video" ? asset.thumbnail : asset.url}
                  className="w-full h-full object-cover pointer-events-none"
                />
                <div className="absolute top-1 right-1">
                  {asset.type === "video" ? (
                    <FilmIcon className="text-[8px] text-white/50 bg-black/60 p-1 rounded-sm" />
                  ) : (
                    <ImageIcon className="text-[8px] text-white/50 bg-black/60 p-1 rounded-sm" />
                  )}
                </div>
              </button>
            );
          })}
          <label className="shrink-0 w-14 h-14 bg-zinc-900 border-2 border-zinc-800 border-dashed rounded-xl flex items-center justify-center cursor-pointer active:scale-95 transition-all">
            <PlusIcon className="text-zinc-500 [8px]" />
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
            ></div>
          </button>
          {isRecording && (
            <div className="absolute top-1/2 -translate-y-1/2 right-4 bg-red-600 px-3 py-1 rounded-full text-[10px] font-black tracking-widest text-white shadow-lg flex items-center">
              <span className="w-1.5 h-1.5 bg-white rounded-full mr-1.5 animate-ping"></span>
              {Math.floor(recordingTime / 60)}:
              {(recordingTime % 60).toString().padStart(2, "0")}
            </div>
          )}
        </div>
      </footer>

      {/* Intro Overlay */}
      {assets.length === 0 && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-8 text-center space-y-8">
          <div className="w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center transform -rotate-12 shadow-[0_20px_40px_rgba(220,38,38,0.4)] overflow-hidden">
            <ClapperboardIcon className="w-12 h-12 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black italic tracking-tighter  text-white leading-none">
              Direct CUT
            </h1>
            <p className="text-white/20 text-[9px] font-bold  tracking-[0.4em]">
              REACTION ASSEMBLY STUDIO
            </p>
          </div>
          <label className="block w-full max-w-xs bg-white text-black py-4 rounded-2xl font-black  cursor-pointer active:scale-95 text-center text-sm tracking-widest shadow-2xl transition-transform">
            IMPORT MEDIA
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept="image/*,video/*"
            />
          </label>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 16px); }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-from-left { from { transform: translateX(-20px); } to { transform: translateX(0); } }
        .animate-in { animation-duration: 300ms; animation-fill-mode: both; }
        .fade-in { animation-name: fade-in; }
        .slide-in-from-left-4 { animation-name: slide-in-from-left; }
      `
        }}
      />
    </div>
  );
};

export default DirectorsCut;
