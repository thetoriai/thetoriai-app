import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ClapperboardIcon, XIcon } from './Icons';

// --- Consolidated Types ---
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

const HANDLE_SIZE = 40; // Size of touch target for handles in canvas units

const DirectorsCut: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  // --- State ---
  const [assets, setAssets] = useState<Asset[]>([]);
  const [visibleAssetIds, setVisibleAssetIds] = useState<string[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  
  const [webcamActive, setWebcamActive] = useState(false);
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

  // Computed
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
          if (visibleImages.length >= 2) {
            next = next.filter((vId) => vId !== visibleImages[0]);
          }
        }
        next.push(id);
        setSelectedAssetId(id);
      }
      return next;
    });
  };

  const toggleAssetPlayback = useCallback((forceReset = false) => {
    const v = videoRef.current;
    if (!v || !v.src) return;
    if (forceReset) {
      v.currentTime = 0;
      v.pause();
      setIsAssetPlaying(false);
      return;
    }
    if (v.paused || v.ended) {
      v.play().catch(console.warn);
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

  // --- Media Initialization ---
  useEffect(() => {
    let currentStream: MediaStream | null = null;

    const startWebcam = async () => {
      // Clear previous stream if any
      if (webcamRef.current?.srcObject) {
        (webcamRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
      }

      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true 
        });
      } catch (err) {
        try {
          currentStream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
        } catch (e) {
          setWebcamActive(false);
        }
      }

      if (currentStream && webcamRef.current) {
        webcamRef.current.srcObject = currentStream;
        webcamRef.current.play().catch(() => {});
      }
    };

    if (webcamActive) startWebcam();
    else {
      const stream = webcamRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach((track) => track.stop());
      if (webcamRef.current) webcamRef.current.srcObject = null;
    }

    return () => currentStream?.getTracks().forEach((track) => track.stop());
  }, [webcamActive]);

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
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, w, h);
    }

    // 2. Visible Assets
    const renderOrder = [...visibleAssetIds].sort((a, b) => {
      if (a === selectedAssetId) return 1;
      if (b === selectedAssetId) return -1;
      return 0;
    });

    renderOrder.forEach((id) => {
      const asset = assets.find((a) => a.id === id);
      if (!asset) return;

      let source: HTMLImageElement | HTMLVideoElement | null = null;
      if (asset.type === "video") {
        source = videoRef.current;
      } else {
        source = imageCache.current.get(id) || null;
      }

      // Check if source is actually ready. After a seek/reset, it might briefly be unready.
      if (
        source &&
        (asset.type === "image" || (source as HTMLVideoElement).readyState >= 1)
      ) {
        const sW = asset.width;
        const sH = asset.height;
        const trans = asset.transform;

        const sx = sW * (trans.cropLeft / 100);
        const sy = sH * (trans.cropTop / 100);
        const swActual = sW * (1 - (trans.cropLeft + trans.cropRight) / 100);
        const shActual = sH * (1 - (trans.cropTop + trans.cropBottom) / 100);

        const baseDrawW = w * (trans.scale / 100);
        const baseDrawH = baseDrawW * (sH / sW);
        const drawW = baseDrawW * (swActual / sW);
        const drawH = baseDrawH * (shActual / sH);

        let drawX,
          drawY,
          finalW = drawW,
          finalH = drawH;

        if (isFullFrame && id === selectedAssetId) {
          const assetAspect = swActual / shActual;
          const frameAspect = w / h;
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
      // Hit detection for handles
      const trans = selectedAsset!.transform;
      // We need to re-calculate current draw rect to check hit
      // This is a simplified hit check
      const w = 1080,
        h = 1920;
      const sW = selectedAsset!.width,
        sH = selectedAsset!.height;
      const swActual = sW * (1 - (trans.cropLeft + trans.cropRight) / 100);
      const shActual = sH * (1 - (trans.cropTop + trans.cropBottom) / 100);

      const baseDrawW = w * (trans.scale / 100);
      const baseDrawH = baseDrawW * (sH / sW);
      const drawW = baseDrawW * (swActual / sW);
      const drawH = baseDrawH * (shActual / sH);
      const drawX = w * (trans.x / 100) - drawW / 2;
      const drawY = h * (trans.y / 100) - drawH / 2;

      const hitHandle = 100;
      if (
        Math.abs(canvasY - drawY) < hitHandle &&
        Math.abs(canvasX - (drawX + drawW / 2)) < 200
      )
        setGrabbedPart("top");
      else if (
        Math.abs(canvasY - (drawY + drawH)) < hitHandle &&
        Math.abs(canvasX - (drawX + drawW / 2)) < 200
      )
        setGrabbedPart("bottom");
      else if (
        Math.abs(canvasX - drawX) < hitHandle &&
        Math.abs(canvasY - (drawY + drawH / 2)) < 200
      )
        setGrabbedPart("left");
      else if (
        Math.abs(canvasX - (drawX + drawW)) < hitHandle &&
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
      // Sensitivity factor
      const canvasWidth = 1080,
        canvasHeight = 1920;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx =
        (clientX - startTouchRef.current.x) * (canvasWidth / rect.width);
      const dy =
        (clientY - startTouchRef.current.y) * (canvasHeight / rect.height);

      const trans = { ...selectedAsset!.transform };
      const sW = selectedAsset!.width,
        sH = selectedAsset!.height;
      const baseDrawW = canvasWidth * (trans.scale / 100);
      const baseDrawH = baseDrawW * (sH / sW);

      if (grabbedPart === "move") {
        const dXPercent = (dx / canvasWidth) * 100;
        const dYPercent = (dy / canvasHeight) * 100;
        updateAssetTransform(selectedAssetId, {
          x: trans.x + dXPercent,
          y: trans.y + dYPercent
        });
      } else {
        // --- SPATIAL ANCHORING LOGIC ---
        // We calculate absolute edges on the canvas to compensate the center 'x,y'
        // while the width/height changes due to cropping.
        const swActual = sW * (1 - (trans.cropLeft + trans.cropRight) / 100);
        const shActual = sH * (1 - (trans.cropTop + trans.cropBottom) / 100);
        const drawW = baseDrawW * (swActual / sW);
        const drawH = baseDrawH * (shActual / sH);

        const xLeft = (canvasWidth * trans.x) / 100 - drawW / 2;
        const xRight = (canvasWidth * trans.x) / 100 + drawW / 2;
        const yTop = (canvasHeight * trans.y) / 100 - drawH / 2;
        const yBottom = (canvasHeight * trans.y) / 100 + drawH / 2;

        if (grabbedPart === "left") {
          const cropDelta = (dx / baseDrawW) * 100;
          const newCrop = Math.max(0, Math.min(90, trans.cropLeft + cropDelta));
          const newSwActual = sW * (1 - (newCrop + trans.cropRight) / 100);
          const newDrawW = baseDrawW * (newSwActual / sW);
          const newX = ((xRight - newDrawW / 2) / canvasWidth) * 100;
          updateAssetTransform(selectedAssetId, { cropLeft: newCrop, x: newX });
        } else if (grabbedPart === "right") {
          const cropDelta = (dx / baseDrawW) * 100;
          const newCrop = Math.max(
            0,
            Math.min(90, trans.cropRight - cropDelta)
          );
          const newSwActual = sW * (1 - (trans.cropLeft + newCrop) / 100);
          const newDrawW = baseDrawW * (newSwActual / sW);
          const newX = ((xLeft + newDrawW / 2) / canvasWidth) * 100;
        updateAssetTransform(selectedAssetId, {
            cropRight: newCrop,
            x: newX
          });
        } else if (grabbedPart === "top") {
          const cropDelta = (dy / baseDrawH) * 100;
          const newCrop = Math.max(0, Math.min(90, trans.cropTop + cropDelta));
          const newShActual = sH * (1 - (newCrop + trans.cropBottom) / 100);
          const newDrawH = baseDrawH * (newShActual / sH);
          const newY = ((yBottom - newDrawH / 2) / canvasHeight) * 100;
          updateAssetTransform(selectedAssetId, { cropTop: newCrop, y: newY });
      } else if (grabbedPart === "bottom") {
          const cropDelta = (dy / baseDrawH) * 100;
          const newCrop = Math.max(
            0,
            Math.min(90, trans.cropBottom - cropDelta)
          );
          const newShActual = sH * (1 - (trans.cropTop + newCrop) / 100);
          const newDrawH = baseDrawH * (newShActual / sH);
          const newY = ((yTop + newDrawH / 2) / canvasHeight) * 100;
        updateAssetTransform(selectedAssetId, {
            cropBottom: newCrop,
            y: newY
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
      const delta = dist / (startTouchRef.current.dist || 1);
      const nextScale = Math.min(
        200,
        Math.max(10, startTouchRef.current.scale * delta)
      );
      updateAssetTransform(selectedAssetId, { scale: nextScale });
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
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) setRecordedChunks((prev) => [...prev, e.data]);
      };
      recorder.onstop = () => {
        setRecordedChunks((prev) => {
          const blob = new Blob(prev, { type: mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `directors-cut-${Date.now()}.${mime.includes("mp4") ? "mp4" : "webm"}`;
          a.click();
          return [];
        });
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = file.type.startsWith("video") ? "video" : "image";
      const url = URL.createObjectURL(file);
      const id = Date.now().toString();

      if (type === "video") {
        const v = document.createElement("video");
        v.src = url;
        v.muted = true;
        v.onloadedmetadata = () => {
          // Generate real thumbnail for the footer
          const captureCanvas = document.createElement("canvas");
          captureCanvas.width = 160;
          captureCanvas.height = 160;
          const ctx = captureCanvas.getContext("2d");
          v.currentTime = 0.5; // Seek a bit in
          v.onseeked = () => {
            if (ctx) {
              const ratio = v.videoWidth / v.videoHeight;
              let sw, sh, sx, sy;
              if (ratio > 1) {
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
            const thumbnail = captureCanvas.toDataURL("image/jpeg");
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
              ...prev.filter((vid) => {
                const a = [...assets, newAsset].find((item) => item.id === vid);
                return a?.type !== "video";
              }),
              id
            ]);
            setSelectedAssetId(id);
          };
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
            transform: { ...DEFAULT_TRANSFORM }
          };
          imageCache.current.set(id, img);
          setAssets((p) => [...p, newAsset]);
          setVisibleAssetIds((prev) => {
            const visibleImages = prev.filter((vid) => {
              const a = [...assets, newAsset].find((item) => item.id === vid);
              return a?.type === "image";
            });
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
    }
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
      {/* 1. STAGE */}
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

        {/* --- CLOSE/BACK BUTTON (Overlay) --- */}
        <button
          onClick={onClose}
          className="absolute top-6 left-6 z-50 w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-full text-white/60 hover:text-white transition-all shadow-xl active:scale-90"
        >
          <XIcon className="w-6 h-6" />
        </button>

        {/* --- LEFT SIDEBAR (CONTROLS) --- */}
        <div
          className="absolute left-2 top-58 flex flex-col space-y-4 z-30"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all ${isLocked ? "bg-red-600 text-white" : "bg-white text-black shadow-2xl"} active:scale-90`}
          >
            <i
              className={`fas ${isLocked ? "fa-lock" : "fa-lock-open"} text-lg`}
            ></i>
            <span className="text-[7px] font-black uppercase mt-1 tracking-widest">
              {isLocked ? "LOCKED" : "LOCK"}
            </span>
          </button>

          {currentVisibleVideo && (
            <div className="flex flex-col space-y-4 animate-in fade-in slide-in-from-left-4">
              <button
                onClick={() => toggleAssetPlayback()}
                className={`w-12 h-12 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90 ${isAssetPlaying ? "text-white" : "text-white/40"}`}
              >
                <i
                  className={`fas ${isAssetPlaying ? "fa-pause" : "fa-play"} text-lg`}
                ></i>
                <span className="text-[7px] font-black uppercase mt-1 tracking-widest">
                  PLAY
                </span>
              </button>
              <button
                onClick={() => toggleAssetPlayback(true)}
                className="w-12 h-12 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-2xl flex flex-col items-center justify-center active:scale-90 text-white/40"
              >
                <i className="fas fa-rotate-left text-lg"></i>
                <span className="text-[7px] font-black uppercase mt-1 tracking-widest">
                  RESET
                </span>
              </button>
            </div>
          )}
        </div>

        {/* --- RIGHT SIDEBAR (MODES) --- */}
        <div
          className="absolute right-2 top-58 flex flex-col space-y-4 z-30"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setWebcamActive(!webcamActive)}
            className={`w-12 h-12 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90 ${webcamActive ? "text-white" : "text-white/30"}`}
          >
            <i className="fas fa-camera text-lg"></i>
            <span className="text-[7px] font-black uppercase mt-1 tracking-widest">
              SIGHT
            </span>
          </button>

          {selectedAssetId && (
            <>
              <button
                onClick={() => setIsFullFrame(!isFullFrame)}
                className={`w-12 h-12 backdrop-blur-3xl border border-white/20 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90 ${isFullFrame ? "bg-blue-600 text-white border-blue-400" : "bg-white/10 text-white"}`}
              >
                <i
                  className={`fas ${isFullFrame ? "fa-compress" : "fa-expand"} text-lg`}
                ></i>
                <span className="text-[7px] font-black uppercase mt-1 tracking-widest">
                  VIEW
                </span>
              </button>

              <button
                onClick={() => deleteAsset(selectedAssetId)}
                className="w-12 h-12 bg-red-600/20 hover:bg-red-600 backdrop-blur-3xl border border-red-500/30 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90 text-red-500 hover:text-white"
              >
                <i className="fas fa-trash-can text-lg"></i>
                <span className="text-[7px] font-black uppercase mt-1 tracking-widest">
                  REMOVE
                </span>
              </button>
            </>
          )}
        </div>

        {/* MASTER SOURCE ELEMENT (NOT VISIBLE) */}
        <div className="invisible absolute -z-50 pointer-events-none w-0 h-0">
          <video
            ref={videoRef}
            src={currentVisibleVideo?.url}
            playsInline
            crossOrigin="anonymous"
          />
          <video ref={webcamRef} autoPlay muted playsInline />
        </div>
      </section>

      {/* 2. FOOTER */}
      <footer className="relative flex-none bg-black flex flex-col items-center justify-between pb-safe pt-2 px-4 z-40 overflow-hidden min-h-[140px] border-t border-white/5">
        <div className="w-full flex items-center justify-center space-x-3 mt-2 overflow-x-auto no-scrollbar">
          {assets.map((asset) => {
            const isVisible = visibleAssetIds.includes(asset.id);
            const isSelected = selectedAssetId === asset.id;
            return (
              <button
                key={asset.id}
                onClick={() => toggleAssetVisibility(asset.id)}
                className={`shrink-0 w-16 h-16 rounded-xl border-2 transition-all overflow-hidden relative flex items-center justify-center bg-zinc-900 ${isVisible ? "border-white opacity-100" : "border-zinc-800 opacity-30"} ${isSelected ? "scale-110 shadow-lg shadow-white/20" : "scale-100"}`}
              >
                {asset.type === "video" ? (
                  <img
                    src={asset.thumbnail}
                    className="w-full h-full object-cover pointer-events-none"
                  />
                ) : (
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="w-full h-full object-cover pointer-events-none"
                  />
                )}
                <div className="absolute top-1 right-1">
                  <i
                    className={`fas ${asset.type === "video" ? "fa-film" : "fa-image"} text-[8px] text-white/50 bg-black/60 p-1 rounded-sm`}
                  ></i>
                </div>
              </button>
            );
          })}
          <label className="shrink-0 w-12 h-12 bg-zinc-900 border-2 border-zinc-800 border-dashed rounded-xl flex items-center justify-center cursor-pointer active:scale-95 transition-all">
            <i className="fas fa-plus text-zinc-500 text-sm"></i>
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
          <div className="w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center transform -rotate-12 shadow-[0_20px_40px_rgba(220,38,38,0.4)]">
            <i className="fas fa-clapperboard text-3xl text-white"></i>
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white leading-none">
              DIRECTOR'S CUT
            </h1>
            <p className="text-white/20 text-[9px] font-bold uppercase tracking-[0.4em]">
              REACTION ASSEMBLY STUDIO
            </p>
          </div>
          <div className="flex flex-col gap-4 w-full max-w-xs">
            <label className="block w-full bg-white text-black py-4 rounded-2xl font-black uppercase cursor-pointer active:scale-95 text-center text-sm tracking-widest shadow-2xl transition-transform">
              IMPORT MEDIA
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,video/*"
              />
            </label>
            <button
              onClick={onClose}
              className="w-full py-4 text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-colors"
            >
              CANCEL & RETURN
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