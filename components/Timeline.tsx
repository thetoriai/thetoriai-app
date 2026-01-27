// Production Timeline: Ultra-Compact Pro Engine - Bi-Directional Scaling Edition
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  PlayIcon,
  DownloadIcon,
  MusicalNoteIcon,
  TrashIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  XIcon,
  DocumentTextIcon,
  FilmIcon,
  SparklesIcon,
  ScissorsIcon,
  SquareIcon,
  Square2StackIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  UndoIcon,
  ChevronDownIcon,
  LoaderIcon,
  CameraIcon
} from "./Icons";

interface TimelineClip {
  id: string;
  url: string | File;
  type: "video" | "image";
  duration: number;
  startTime: number;
  originalDuration: number;
  layer: number;
  videoObject?: any;
  isMuted?: boolean;
  volume?: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  zoom?: number;
  posX?: number;
  posY?: number;
}

interface AudioClip {
  id: string;
  url: string | File;
  duration: number;
  startTime: number;
  originalDuration: number;
  isMuted?: boolean;
  volume?: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
}

interface TextClip {
  id: string;
  text: string;
  startTime: number;
  duration: number;
  bgColor?: string;
  bgOpacity?: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  transition?:
    | "none"
    | "zoom-in"
    | "zoom-out"
    | "slide-left"
    | "slide-right"
    | "slide-top"
    | "slide-bottom";
  fullBackground?: boolean;
  posX?: number;
  posY?: number;
  zoom?: number;
}

interface TimelineProps {
  clips: TimelineClip[];
  audioClips: AudioClip[];
  textClips: TextClip[];
  onUpdateClips: (clips: TimelineClip[]) => void;
  onUpdateAudioClips: (clips: AudioClip[]) => void;
  onUpdateTextClips: (textClips: TextClip[]) => void;
  onDelete: (id: string) => void;
  onDeleteAudio: (id: string) => void;
  onUpdateClip: (id: string, updates: Partial<TimelineClip>) => void;
  onUpdateAudioClip: (id: string, updates: any) => void;
  onAddClip: (
    url: string | File,
    type: "video" | "image",
    duration?: number,
    startTime?: number,
    layer?: number,
    videoObject?: any
  ) => void;
  onAddAudioClip: (
    url: string | File,
    duration?: number,
    startTime?: number
  ) => void;
  onAddTextClip: (text: string, startTime?: number) => void;
  onExport: () => void;
  onCaptureFrame?: (base64: string) => void;
  onUndo?: () => void;
  playbackTime: number; // This is now treated as initialPlaybackTime
  onUpdatePlaybackTime: (time: number) => void;
}

const hexToRgba = (hex: string, alpha: number) => {
  let r = 0,
    g = 0,
    b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const Timeline: React.FC<TimelineProps> = ({
  clips = [],
  audioClips = [],
  textClips = [],
  onUpdateClips,
  onUpdateAudioClips,
  onUpdateTextClips,
  onDelete,
  onDeleteAudio,
  onAddClip,
  onAddAudioClip,
  onAddTextClip,
  onExport,
  onUpdateClip,
  onUpdateAudioClip,
  onCaptureFrame,
  onUndo,
  playbackTime: initialPlaybackTime,
  onUpdatePlaybackTime
}) => {
  const isMobile = window.innerWidth < 768;
  const [pixelsPerSecond, setPixelsPerSecond] = useState(isMobile ? 30 : 60);
  const [isPlaying, setIsPlaying] = useState(false);

  // Performance optimization: Use local state for 60fps playback
  const [localPlaybackTime, setLocalPlaybackTime] =
    useState(initialPlaybackTime);

  const [selectedClip, setSelectedClip] = useState<{
    id: string;
    type: "visual" | "audio" | "text";
  } | null>(null);
  const [masterAspectRatio, setMasterAspectRatio] = useState<"16:9" | "9:16">(
    "16:9"
  );

  const [flashingClipId, setFlashingClipId] = useState<string | null>(null);
  const [isProcessingFrame, setIsProcessingFrame] = useState(false);

  // DO add comment: Side panel ID state remains to track double-click activity.
  const [sidePanelClipId, setSidePanelClipId] = useState<string | null>(null);

  const mainMonitorRef = useRef<HTMLVideoElement>(null);
  const overlayMonitorRef = useRef<HTMLVideoElement>(null);
  const audioMonitorRef = useRef<HTMLAudioElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const requestRef = useRef<number>(null);
  const lastTickRef = useRef<number>(0);
  const isScrubbingRef = useRef(false);

  // Persistence Cache: Store created Blob URLs for File objects to prevent leaks and flickering
  const objectUrlCache = useRef(new Map<File | Blob, string>());

  // Cleanup Blob URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlCache.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlCache.current.clear();
    };
  }, []);

  // Sync back to parent when scrubbing or unmounting to save position
  useEffect(() => {
    return () => {
      onUpdatePlaybackTime(localPlaybackTime);
    };
  }, [localPlaybackTime, onUpdatePlaybackTime]);

  const contentDuration = Math.max(
    ...(clips || []).map(
      (c) => (Number(c.startTime) || 0) + (Number(c.duration) || 0)
    ),
    ...(audioClips || []).map(
      (a) => (Number(a.startTime) || 0) + (Number(a.duration) || 0)
    ),
    ...(textClips || []).map(
      (t) => (Number(t.startTime) || 0) + (Number(t.duration) || 0)
    ),
    0.1
  );

  const viewportDuration = Math.max(contentDuration + 10, 30);
  const labelWidth = isMobile ? 36 : 60;

  const formatAssetUrl = useCallback((url: string | File) => {
    if (!url) return "";

    // Handle File/Blob objects from manual uploads for cross-session persistence
    if (typeof url !== "string") {
      if (objectUrlCache.current.has(url))
        return objectUrlCache.current.get(url)!;
      const newUrl = URL.createObjectURL(url);
      objectUrlCache.current.set(url, newUrl);
      return newUrl;
    }

    if (
      url.startsWith("http") ||
      url.startsWith("blob:") ||
      url.startsWith("data:")
    )
      return url;
    return `data:image/png;base64,${url}`;
  }, []);

  const handleCapture = async () => {
    if (!selectedClip || !onCaptureFrame || isProcessingFrame) return;
    setIsProcessingFrame(true);
    setFlashingClipId(selectedClip.id);
    await new Promise((r) => setTimeout(r, 150));
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const activeData = getActiveClipsAtTime(localPlaybackTime);
      let source: HTMLVideoElement | null = null;
      if (activeData.overlay?.clip.id === selectedClip.id)
        source = overlayMonitorRef.current;
      else if (activeData.main?.clip.id === selectedClip.id)
        source = mainMonitorRef.current;
      if (source && source instanceof HTMLVideoElement) {
        canvas.width = source.videoWidth;
        canvas.height = source.videoHeight;
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        onCaptureFrame(canvas.toDataURL("image/png").split(",")[1]);
      } else {
        const clip = (clips || []).find((c) => c.id === selectedClip.id);
        if (clip && clip.type === "image") {
          const formattedUrl = formatAssetUrl(clip.url);
          // If it's data URL, use it directly. If it's blob/file, we might need to draw it to a canvas.
          if (formattedUrl.startsWith("data:")) {
            onCaptureFrame(formattedUrl.split(",")[1]);
          } else {
            // Handle Blob/File capture for images
            const img = new Image();
            img.src = formattedUrl;
            await new Promise((res) => (img.onload = res));
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);
            onCaptureFrame(canvas.toDataURL("image/png").split(",")[1]);
          }
        }
      }
    } catch (e) {
      console.error("Capture failed", e);
    } finally {
      setTimeout(() => {
        setFlashingClipId(null);
        setIsProcessingFrame(false);
      }, 300);
    }
  };

  // DO add comment: handleCaptureLastFrameAction now specifically navigates to the end of the clip and captures it.
  const handleCaptureLastFrameAction = async (clip: TimelineClip) => {
    const lastFrameTime = clip.startTime + clip.duration - 0.01;
    setLocalPlaybackTime(lastFrameTime);
    onUpdatePlaybackTime(lastFrameTime);
    setSelectedClip({ id: clip.id, type: 'visual' });
    setSidePanelClipId(null);
    setTimeout(() => {
        handleCapture();
    }, 150);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;
      if (e.code === "Space" && !isTyping) {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !isTyping) {
        e.preventDefault();
        onUndo?.();
      }
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        !isTyping &&
        selectedClip
      ) {
        e.preventDefault();
        if (selectedClip.type === "visual") onDelete(selectedClip.id);
        else if (selectedClip.type === "audio") onDeleteAudio(selectedClip.id);
        else
          onUpdateTextClips(
            (textClips || []).filter((t) => t.id !== selectedClip.id)
          );
        setSelectedClip(null);
        
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedClip, onDelete, onDeleteAudio, onUpdateTextClips, textClips, onUndo]);

  useEffect(() => {
    if (isPlaying && scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current;
      const playheadX = localPlaybackTime * pixelsPerSecond;
      const viewportWidth = scrollArea.clientWidth - labelWidth;
      const scrollLeft = scrollArea.scrollLeft;
      if (playheadX > scrollLeft + viewportWidth * 0.7) {
        scrollArea.scrollTo({
          left: playheadX - viewportWidth * 0.4,
          behavior: "smooth"
        });
      }
      if (playheadX < scrollLeft) {
        scrollArea.scrollTo({ left: playheadX - 10, behavior: "smooth" });
      }
    }
  }, [localPlaybackTime, isPlaying, pixelsPerSecond, labelWidth]);

  const getFadeOpacity = (time: number, clip: any) => {
    if (!clip) return 1;
    const elapsed = time - clip.startTime;
    const remaining = clip.startTime + clip.duration - time;
    let opacity = 1;
    if ((clip.fadeInDuration || 0) > 0 && elapsed < clip.fadeInDuration)
      opacity = Math.max(0, elapsed / clip.fadeInDuration);
    else if (
      (clip.fadeOutDuration || 0) > 0 &&
      remaining < clip.fadeOutDuration
    )
      opacity = Math.max(0, remaining / clip.fadeOutDuration);
    return opacity;
  };

  const getActiveClipsAtTime = useCallback(
    (time: number) => {
      let main: any = null;
      let overlay: any = null;
      let audio: any = null;
      let text: any = null;
      for (const clip of clips || []) {
        if (time >= clip.startTime && time <= clip.startTime + clip.duration) {
          const data = {
            clip,
            internalTime: Math.min(time - clip.startTime, clip.duration - 0.05),
            opacity: getFadeOpacity(time, clip)
          };
          if ((clip.layer || 0) === 1) overlay = data;
          else if ((clip.layer || 0) === 0) main = data;
        }
      }
      for (const a of audioClips || [])
        if (time >= a.startTime && time <= a.startTime + a.duration)
          audio = {
            clip: a,
            internalTime: time - a.startTime,
            opacity: getFadeOpacity(time, a)
          };
      for (const t of textClips || [])
        if (time >= t.startTime && time <= t.startTime + t.duration)
          text = { clip: t, opacity: getFadeOpacity(time, t) };
      return { main, overlay, audio, text };
    },
    [clips, audioClips, textClips]
  );

  const activeData = getActiveClipsAtTime(localPlaybackTime);
  const [dragging, setDragging] = useState<{
    id: string;
    type: "text" | "audio" | "visual" | "trim";
    startX: number;
    originalValue: number;
  } | null>(null);

  const animate = useCallback(
    (time: number) => {
      if (localPlaybackTime >= contentDuration) {
        setIsPlaying(false);
        setLocalPlaybackTime(contentDuration);
        return;
      }
      if (lastTickRef.current !== 0) {
        const delta = (time - lastTickRef.current) / 1000;
        setLocalPlaybackTime((prev) => {
          const next = prev + delta;
          if (next >= contentDuration) {
            setIsPlaying(false);
            return contentDuration;
          }
          return next;
        });
      }
      lastTickRef.current = time;
      if (isPlaying) requestRef.current = requestAnimationFrame(animate);
    },
    [isPlaying, contentDuration, localPlaybackTime]
  );

  useEffect(() => {
    if (isPlaying) {
      lastTickRef.current = performance.now();
      requestRef.current = requestAnimationFrame(animate);
    } else {
      lastTickRef.current = 0;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, animate]);

  useEffect(() => {
    const updateMonitor = (
      ref: React.RefObject<HTMLMediaElement>,
      entry: any
    ) => {
      if (!ref.current) return;
      if (
        entry &&
        (entry.clip.type === "video" || ref.current instanceof HTMLAudioElement)
      ) {
        const url = formatAssetUrl(entry.clip.url);
        if (ref.current.src !== url) {
          ref.current.src = url;
          ref.current.load();
        }
        if (Math.abs(ref.current.currentTime - entry.internalTime) > 0.04)
          ref.current.currentTime = entry.internalTime;
        if (isPlaying) ref.current.play().catch(() => {});
        else ref.current.pause();
        ref.current.muted = entry.clip.isMuted ?? false;
        if (ref.current instanceof HTMLVideoElement) {
          ref.current.style.opacity = entry.opacity.toString();
          ref.current.style.transform = `translate(${entry.clip.posX || 0}%, ${entry.clip.posY || 0}%) scale(${entry.clip.zoom || 1})`;
          ref.current.style.visibility = "visible";
        } else if (ref.current instanceof HTMLAudioElement)
          ref.current.volume =
            (entry.clip.isMuted ? 0 : (entry.clip.volume ?? 1)) * entry.opacity;
      } else if (ref.current) {
        ref.current.pause();
        if (ref.current instanceof HTMLVideoElement)
          ref.current.style.visibility = "hidden";
      }
    };
    updateMonitor(mainMonitorRef, activeData.main);
    updateMonitor(overlayMonitorRef, activeData.overlay);
    updateMonitor(audioMonitorRef, activeData.audio);
  }, [activeData, isPlaying, formatAssetUrl]);

  const performScrub = useCallback(
    (clientX: number) => {
      if (!scrollAreaRef.current) return;
      const rect = scrollAreaRef.current.getBoundingClientRect();
        const clickX = clientX - rect.left + scrollAreaRef.current.scrollLeft - labelWidth;
        const newTime = Math.max(0, Math.min(contentDuration, clickX / pixelsPerSecond));
        
        // MAGNET SNAPPING LOGIC
        const SNAP_THRESHOLD = 0.2;
        const boundaries = [
            0, contentDuration,
            ...clips.map(c => c.startTime),
            ...clips.map(c => c.startTime + c.duration),
            ...audioClips.map(a => a.startTime),
            ...audioClips.map(a => a.startTime + a.duration),
            ...textClips.map(t => t.startTime),
            ...textClips.map(t => t.startTime + t.duration)
        ];
        
        let snappedTime = newTime;
        for (const b of boundaries) {
            if (Math.abs(newTime - b) < SNAP_THRESHOLD) {
                snappedTime = b;
                break;
            }
        }
        
        setLocalPlaybackTime(snappedTime);
        onUpdatePlaybackTime(snappedTime);
    }, [contentDuration, pixelsPerSecond, labelWidth, onUpdatePlaybackTime, clips, audioClips, textClips]);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent | TouchEvent) => {
      const isTouch = "touches" in e;
      const clientX = isTouch
        ? (e as TouchEvent).touches[0].clientX
        : (e as MouseEvent).clientX;
      if (isScrubbingRef.current) performScrub(clientX);
      else if (dragging) {
        const deltaX = clientX - dragging.startX;
        if (dragging.type === "trim") {
          const list = dragging.id.startsWith("text")
            ? textClips
            : dragging.id.startsWith("audio")
              ? audioClips
              : clips;
          const current = (list || []).find((item) => item.id === dragging.id);
          if (!current) return;
          const sameTrack = (list || []).filter(
            (item) =>
              item.id !== dragging.id &&
              (!dragging.id.startsWith("text") &&
              !dragging.id.startsWith("audio")
                ? (item as any).layer === (current as any).layer
                : true)
          );
          const next = sameTrack
            .filter((item) => item.startTime > current.startTime)
            .sort((a, b) => a.startTime - b.startTime)[0];
          const maxDur = Math.min(
            next ? next.startTime - current.startTime : Infinity,
            (current as any).originalDuration ||
              (current as any).duration ||
              Infinity
          );
          const newDuration = Math.max(
            0.1,
            Math.min(maxDur, dragging.originalValue + deltaX / pixelsPerSecond)
          );
          if (dragging.id.startsWith("text"))
            onUpdateTextClips(
              (textClips || []).map((t) =>
                t.id === dragging.id ? { ...t, duration: newDuration } : t
              )
            );
          else if (dragging.id.startsWith("audio"))
            onUpdateAudioClip(dragging.id, { duration: newDuration });
          else onUpdateClip(dragging.id, { duration: newDuration });
        } else {
          const list =
            dragging.type === "text"
              ? textClips
              : dragging.type === "audio"
                ? audioClips
                : clips;
          const current = (list || []).find((item) => item.id === dragging.id);
          if (!current) return;
          const sameTrack = (list || []).filter(
            (item) =>
              item.id !== dragging.id &&
              (dragging.type === "visual"
                ? (item as any).layer === (current as any).layer
                : true)
          );
          const prev = sameTrack
            .filter((item) => item.startTime < current.startTime)
            .sort((a, b) => a.startTime - b.startTime)[0];
          const next = sameTrack
            .filter((item) => item.startTime > current.startTime)
            .sort((a, b) => a.startTime - b.startTime)[0];
          const min = prev ? prev.startTime + prev.duration : 0;
          const max = next ? next.startTime - current.duration : Infinity;
          let newTime = Math.max(
            min,
            Math.min(max, dragging.originalValue + deltaX / pixelsPerSecond)
          );
          if (dragging.type === "text")
            onUpdateTextClips(
              (textClips || []).map((t) =>
                t.id === dragging.id ? { ...t, startTime: newTime } : t
              )
            );
          else if (dragging.type === "audio")
            onUpdateAudioClip(dragging.id, { startTime: newTime });
          else if (dragging.type === "visual")
            onUpdateClip(dragging.id, { startTime: newTime });
        }
      }
    };
    const handleGlobalMouseUp = () => {
      isScrubbingRef.current = false;
      setDragging(null);
    };
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("touchmove", handleGlobalMouseMove, {
      passive: false
    });
    window.addEventListener("touchend", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("touchmove", handleGlobalMouseMove);
      window.removeEventListener("touchend", handleGlobalMouseUp);
    };
  }, [
    pixelsPerSecond,
    dragging,
    performScrub,
    onUpdateClip,
    onUpdateAudioClip,
    onUpdateTextClips,
    textClips,
    clips,
    audioClips,
    labelWidth
  ]);

  const handleSplit = () => {
    if (selectedClip?.type !== "visual") return;
    const clip = (clips || []).find((c) => c.id === selectedClip.id);
    if (
      !clip ||
      localPlaybackTime <= clip.startTime ||
      localPlaybackTime >= clip.startTime + clip.duration
    )
      return;
    const splitPoint = localPlaybackTime - clip.startTime;
    const newClips = [...(clips || [])];
    const idx = newClips.findIndex((c) => c.id === selectedClip.id);
    newClips[idx] = { ...clip, duration: splitPoint };
    newClips.push({
      ...clip,
      id: "v-" + Date.now().toString(),
      startTime: localPlaybackTime,
      duration: clip.duration - splitPoint,
      fadeInDuration: 0,
      fadeOutDuration: 0
    });
    onUpdateClips(newClips);
  };

  const currentSelected = (
    selectedClip?.type === "visual"
      ? (clips || []).find((c) => c.id === selectedClip.id)
      : selectedClip?.type === "audio"
        ? (audioClips || []).find((a) => a.id === selectedClip.id)
        : (textClips || []).find((t) => t.id === selectedClip?.id)
  ) as any;

  const getMotionStyle = (clip: any, time: number) => {
    if (!clip) return {};
    const posStyle = {
      transform: `translate(${clip.posX || 0}px, ${clip.posY || 0}px) scale(${clip.zoom || 1})`
    };
    if (!clip.transition || clip.transition === "none") return posStyle;
    let progress = Math.min(1, Math.max(0, (time - clip.startTime) / 1.5));
    progress = progress * progress * (3 - 2 * progress);
    let transPart = "";
    switch (clip.transition) {
      case "zoom-in":
        transPart = `scale(${0.5 + 0.5 * progress})`;
        break;
      case "zoom-out":
        transPart = `scale(${1.5 - 0.5 * progress})`;
        break;
      case "slide-left":
        transPart = `translateX(${-100 + 100 * progress}%)`;
        break;
      case "slide-right":
        transPart = `translateX(${100 - 100 * progress}%)`;
        break;
      case "slide-top":
        transPart = `translateY(${-100 + 100 * progress}%)`;
        break;
      case "slide-bottom":
        transPart = `translateY(${100 - 100 * progress}%)`;
        break;
    }
    return { ...posStyle, transform: `${posStyle.transform} ${transPart}` };
  };

  const ControlButton = ({
    icon: Icon,
    onClick,
    active,
    colorClass,
    title,
    label
  }: any) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      title={title}
      className={`px-1.5 md:px-2 py-1 md:py-1.5 rounded-lg transition-all shadow-sm active:scale-90 flex items-center gap-1 md:gap-1.5 ${active ? colorClass || "bg-indigo-600 text-white shadow-md" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"}`}
    >
      <Icon className="w-3 md:w-3.5 h-3 md:h-3.5" />
      {label && (
        <span className="text-[6px] md:text-[7px] font-black uppercase tracking-widest">
          {label}
        </span>
      )}
    </button>
  );

  const ControlSlider = ({ label, value, onChange, min, max, step }: any) => (
    <div
      className="flex flex-col items-center px-0.5 md:px-1"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <span className="text-[6px] md:text-[7px] font-black text-gray-500 uppercase tracking-tighter mb-0.5 md:mb-1 select-none">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          e.stopPropagation();
          onChange(e);
        }}
        className="w-10 md:w-20 accent-indigo-500 bg-white/10 h-1 md:h-1.5 rounded-full appearance-none cursor-pointer"
      />
    </div>
  );

  const canMoveLayer = (clip: TimelineClip) => {
    const targetLayer = clip.layer === 0 ? 1 : 0;
    const start = Number(clip.startTime);
    const end = start + Number(clip.duration);
    return !(clips || [])
      .filter((c) => c.id !== clip.id && Number(c.layer) === targetLayer)
      .some((oc) => {
        const os = Number(oc.startTime);
        const oe = os + Number(oc.duration);
        return start < oe && os < end;
      });
  };

  return (
    <div
      className="flex-1 flex flex-col h-full bg-[#0a0f1d] overflow-hidden select-none font-sans relative"
      onClick={() => {
        setSelectedClip(null);
        // DO add comment: Sidebar dismiss logic remains intact.
        setSidePanelClipId(null);
      }}
    >
      <div className="h-8 md:h-10 bg-gray-950 border-b border-white/5 flex items-center justify-between px-2 md:px-4 shrink-0 z-[110] shadow-md">
        <div className="flex items-center gap-1.5 md:gap-3 px-2 md:px-3 py-0.5 md:py-1 bg-black/40 rounded-full border border-white/5 shrink-0">
          <div
            className={`w-1 md:w-1.5 h-1 md:h-1.5 rounded-full ${isPlaying ? "bg-red-600 animate-pulse" : "bg-gray-700"}`}
          ></div>
          <span className="text-[8px] md:text-[10px] font-mono font-black text-indigo-400 tracking-wider">
            00:{localPlaybackTime.toFixed(2).padStart(5, "0")}
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center px-1 md:px-8">
          <div className="flex items-center gap-1 md:gap-4 bg-black/40 px-2 md:px-6 py-0.5 md:py-1.5 rounded-full border border-white/5 w-full max-w-[90px] md:max-w-md">
            <span className="text-[5px] md:text-[8px] font-black text-gray-600 uppercase tracking-tighter hidden xs:block">
              Zoom
            </span>
            <input
              type="range"
              min="15"
              max="250"
              value={pixelsPerSecond}
              onChange={(e) => setPixelsPerSecond(parseInt(e.target.value))}
              className="flex-1 accent-indigo-600 bg-white/5 h-0.5 md:h-1 rounded-full appearance-none cursor-pointer"
            />
            <span className="text-[6px] md:text-[8px] font-black text-gray-500 uppercase tracking-tighter ml-1">
              {pixelsPerSecond}
            </span>
          </div>
        </div>

        <div className="flex gap-0.5 md:gap-1 bg-black/40 rounded-lg md:rounded-xl p-0.5 border border-white/5 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMasterAspectRatio("16:9");
            }}
            className={`px-1.5 md:px-3 py-0.5 md:py-1 rounded-md md:rounded-lg text-[6px] md:text-[9px] font-black transition-all ${masterAspectRatio === "16:9" ? "bg-indigo-600 text-white" : "text-gray-500"}`}
          >
            16:9
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMasterAspectRatio("9:16");
            }}
            className={`px-1.5 md:px-3 py-0.5 md:py-1 rounded-md md:rounded-lg text-[6px] md:text-[9px] font-black transition-all ${masterAspectRatio === "9:16" ? "bg-indigo-600 text-white" : "text-gray-500"}`}
          >
            9:16
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative p-2 md:p-6 overflow-hidden max-h-[28vh] md:max-h-none shrink-0 bg-[#030712]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0%,transparent_70%)] pointer-events-none"></div>
        <div
          className={`relative bg-black transition-all duration-500 overflow-hidden shadow-2xl border-4 themed-artline ${masterAspectRatio === "16:9" ? "w-full md:w-auto md:h-full aspect-video" : "w-auto h-full aspect-[9/16]"}`}
        >
          {!activeData.main && (
            <div className="absolute inset-0 z-0 flex flex-col items-center justify-center bg-[#111827] grayscale opacity-40">
              <div className="w-8 md:w-16 h-8 md:h-16 rounded-full border-2 md:border-4 border-dashed border-gray-600 flex items-center justify-center mb-2 md:mb-4">
                <FilmIcon className="w-4 md:w-8 h-4 md:h-8 text-gray-600" />
              </div>
              <span className="text-[7px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest">
                Track Offline
              </span>
            </div>
          )}
          {activeData.text?.clip.fullBackground && (
            <div
              style={{
                backgroundColor: activeData.text.clip.bgColor || "black",
                opacity: activeData.text.opacity,
                background: hexToRgba(
                  activeData.text.clip.bgColor || "#000000",
                  activeData.text.clip.bgOpacity ?? 0.8
                )
              }}
              className="absolute inset-0 z-[40] transition-all duration-300"
            />
          )}
          {activeData.main && (
            <div
              style={{ opacity: activeData.main.opacity }}
              className="absolute inset-0 w-full h-full z-0 transition-opacity"
            >
              {activeData.main.clip.type === "image" ? (
                <img
                  src={formatAssetUrl(activeData.main.clip.url)}
                  className="w-full h-full object-contain"
                  style={{
                    transform: `translate(${activeData.main.clip.posX || 0}%, ${activeData.main.clip.posY || 0}%) scale(${activeData.main.clip.zoom || 1})`
                  }}
                />
              ) : (
                <video
                  ref={mainMonitorRef}
                  className="w-full h-full object-contain"
                  style={{
                    transform: `translate(${activeData.main.clip.posX || 0}%, ${activeData.main.clip.posY || 0}%) scale(${activeData.main.clip.zoom || 1})`
                  }}
                  playsInline
                  preload="auto"
                />
              )}
            </div>
          )}
          {activeData.overlay && (
            <div
              style={{ opacity: activeData.overlay.opacity }}
              className="absolute inset-0 w-full h-full z-20 transition-opacity"
            >
              {activeData.overlay.clip.type === "image" ? (
                <img
                  src={formatAssetUrl(activeData.overlay.clip.url)}
                  className="w-full h-full object-contain"
                  style={{
                    transform: `translate(${activeData.overlay.clip.posX || 0}%, ${activeData.overlay.clip.posY || 0}%) scale(${activeData.overlay.clip.zoom || 1})`
                  }}
                />
              ) : (
                <video
                  ref={overlayMonitorRef}
                  className="w-full h-full object-contain"
                  style={{
                    transform: `translate(${activeData.overlay.clip.posX || 0}%, ${activeData.overlay.clip.posY || 0}%) scale(${activeData.overlay.clip.zoom || 1})`
                  }}
                  playsInline
                  preload="auto"
                />
              )}
            </div>
          )}
          {activeData.text && (
            <div
              style={{ opacity: activeData.text.opacity }}
              className="absolute inset-0 z-50 flex items-center justify-center p-2 pointer-events-none overflow-hidden transition-opacity"
            >
              <span
                key={activeData.text.clip.id}
                style={{
                  backgroundColor: activeData.text.clip.fullBackground
                    ? "transparent"
                    : hexToRgba(
                        activeData.text.clip.bgColor || "#000000",
                        activeData.text.clip.bgOpacity ?? 0.8
                      ),
                  ...getMotionStyle(activeData.text.clip, localPlaybackTime)
                }}
                className={`text-white text-[8px] md:text-2xl font-black text-center px-4 md:px-6 py-2 md:py-3 rounded-lg md:rounded-2xl transition-all duration-300`}
              >
                {" "}
                {activeData.text.clip.text}{" "}
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        className="h-12 md:h-16 bg-gray-950 border-t border-white/5 flex items-center px-2 md:px-4 z-[100] shrink-0 gap-2 md:gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 md:gap-3 bg-black/30 px-1 md:px-3 py-1 md:py-1.5 rounded-xl md:rounded-2xl border border-white/5 shadow-inner">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUndo?.();
            }}
            className="w-8 md:w-10 h-8 md:h-10 rounded-lg md:rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all active:scale-90"
          >
            <UndoIcon className="w-4 md:w-5 h-4 md:h-5" />
          </button>
        </div>

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`w-8 md:w-11 h-8 md:h-11 shrink-0 rounded-lg md:rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95 ${isPlaying ? "bg-red-600" : "bg-indigo-600 hover:bg-indigo-700"}`}
        >
          {isPlaying ? (
            <div className="w-3 md:w-3.5 h-3 md:h-3.5 bg-white rounded-sm" />
          ) : (
            <PlayIcon className="w-4 md:w-6 h-4 md:h-6 text-white ml-0.5 md:ml-1" />
          )}
        </button>

        <div className="flex-1 flex items-center gap-1.5 md:gap-3 overflow-x-auto scrollbar-none h-full">
          {selectedClip && currentSelected ? (
            <div className="flex items-center gap-2 md:gap-4 animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="flex items-center gap-1 md:gap-2">
                <ControlButton
                  icon={ScissorsIcon}
                  title="Split Clip"
                  onClick={handleSplit}
                  active={
                    selectedClip.type === "visual" &&
                    localPlaybackTime > currentSelected.startTime &&
                    localPlaybackTime <
                      currentSelected.startTime + currentSelected.duration
                  }
                />
                {/* DO add comment: Removed the Capture button from the main toolbar settings as requested. */}
                <ControlButton
                  icon={TrashIcon}
                  title="Delete"
                  onClick={() => {
                    if (selectedClip.type === "visual")
                      onDelete(selectedClip.id);
                    else if (selectedClip.type === "audio")
                      onDeleteAudio(selectedClip.id);
                    else
                      onUpdateTextClips(
                        (textClips || []).filter(
                          (t) => t.id !== selectedClip.id
                        )
                      );
                    setSelectedClip(null);
                  }}
                />
                <ControlButton
                  icon={SparklesIcon}
                  label="In"
                  onClick={() => {
                    const upd = {
                      fadeInDuration:
                        (currentSelected.fadeInDuration || 0) > 0 ? 0 : 0.5
                    };
                    if (selectedClip.type === "visual")
                      onUpdateClip(selectedClip.id, upd);
                    else if (selectedClip.type === "audio")
                      onUpdateAudioClip(selectedClip.id, upd);
                    else
                      onUpdateTextClips(
                        (textClips || []).map((t) =>
                          t.id === selectedClip.id ? { ...t, ...upd } : t
                        )
                      );
                  }}
                  active={(currentSelected.fadeInDuration || 0) > 0}
                  colorClass="bg-emerald-600 text-white"
                />
                <ControlButton
                  icon={SparklesIcon}
                  label="Out"
                  onClick={() => {
                    const upd = {
                      fadeOutDuration:
                        (currentSelected.fadeOutDuration || 0) > 0 ? 0 : 0.5
                    };
                    if (selectedClip.type === "visual")
                      onUpdateClip(selectedClip.id, upd);
                    else if (selectedClip.type === "audio")
                      onUpdateAudioClip(selectedClip.id, upd);
                    else
                      onUpdateTextClips(
                        (textClips || []).map((t) =>
                          t.id === selectedClip.id ? { ...t, ...upd } : t
                        )
                      );
                  }}
                  active={(currentSelected.fadeOutDuration || 0) > 0}
                  colorClass="bg-rose-600 text-white"
                />
              </div>
              <div className="h-6 w-px bg-white/5 hidden md:block" />
              <div className="flex items-center gap-2">
                {selectedClip.type === "text" && (
                  <>
                    <div className="flex flex-col">
                      <span className="text-[6px] font-black text-gray-500 uppercase tracking-tighter mb-0.5 ml-1">
                        Motion
                      </span>
                      <div className="relative">
                        <select
                          value={currentSelected.transition || "none"}
                          onChange={(e) =>
                            onUpdateTextClips(
                              (textClips || []).map((t) =>
                                t.id === selectedClip.id
                                  ? { ...t, transition: e.target.value as any }
                                  : t
                              )
                            )
                          }
                          className="bg-black/40 border border-white/10 rounded-md text-[7px] md:text-[9px] font-black text-indigo-400 outline-none px-1.5 md:px-3 py-1 appearance-none min-w-[50px] md:min-w-[80px]"
                        >
                          <option value="none">None</option>
                          <option value="zoom-in">Z-In</option>
                          <option value="zoom-out">Z-Out</option>
                          <option value="slide-left">S-L</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[6px] font-black text-gray-500 uppercase tracking-tighter mb-0.5 ml-1">
                        Text
                      </span>
                      <input
                        type="text"
                        value={currentSelected.text}
                        onChange={(e) =>
                          onUpdateTextClips(
                            (textClips || []).map((t) =>
                              t.id === selectedClip.id
                                ? { ...t, text: e.target.value }
                                : t
                            )
                          )
                        }
                        className="bg-black/40 border border-indigo-500/20 rounded-md px-1.5 md:px-3 py-1 text-[8px] md:text-[10px] font-bold text-white outline-none w-20 md:w-32"
                      />
                    </div>
                  </>
                )}
                {(selectedClip.type === "audio" ||
                  (selectedClip.type === "visual" &&
                    currentSelected.type === "video")) && (
                  <div className="flex flex-col">
                    <span className="text-[6px] font-black text-gray-500 uppercase tracking-tighter mb-0.5 ml-1">
                      Mute
                    </span>
                    <ControlButton
                      icon={
                        currentSelected.isMuted
                          ? SpeakerXMarkIcon
                          : SpeakerWaveIcon
                      }
                      onClick={() => {
                        if (selectedClip.type === "visual")
                          onUpdateClip(currentSelected.id, {
                            isMuted: !currentSelected.isMuted
                          });
                        else
                          onUpdateAudioClip(currentSelected.id, {
                            isMuted: !currentSelected.isMuted
                          });
                      }}
                      active={currentSelected.isMuted}
                      colorClass="bg-red-600 text-white"
                    />
                  </div>
                )}
                {(selectedClip.type === "visual" ||
                  selectedClip.type === "text") && (
                  <div className="flex items-center gap-2">
                    <ControlSlider
                      label="Pos Y"
                      value={currentSelected.posY || 0}
                      min="-100"
                      max="100"
                      step="1"
                      onChange={(e: any) => {
                        const val = parseInt(e.target.value);
                        if (selectedClip.type === "visual")
                          onUpdateClip(currentSelected.id, { posY: val });
                        else
                          onUpdateTextClips(
                            (textClips || []).map((t) =>
                              t.id === selectedClip.id ? { ...t, posY: val } : t
                            )
                          );
                      }}
                    />
                    <ControlSlider
                      label="Zoom"
                      value={currentSelected.zoom || 1}
                      min="0.1"
                      max="4"
                      step="0.05"
                      onChange={(e: any) => {
                        const val = parseFloat(e.target.value);
                        if (selectedClip.type === "visual")
                          onUpdateClip(currentSelected.id, { zoom: val });
                        else
                          onUpdateTextClips(
                            (textClips || []).map((t) =>
                              t.id === selectedClip.id ? { ...t, zoom: val } : t
                            )
                          );
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 opacity-30">
              <SparklesIcon className="w-3 md:w-4 h-3 md:h-4 text-indigo-400" />
              <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">
                Deck Ready
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
          <button
            onClick={onExport}
            className="p-2 md:p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg md:rounded-2xl shadow-xl active:scale-95"
          >
            <DownloadIcon className="w-4 md:w-5 h-4 md:h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#030712] relative flex flex-col overflow-hidden border-t border-white/5">
        <div
          ref={scrollAreaRef}
          className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-professional relative pt-4 md:pt-6 touch-none scroll-smooth"
          onMouseDown={(e) => {
            if (
              !(e.target as HTMLElement).closest(".clip-block") &&
              !(e.target as HTMLElement).closest(".handle")
            ) {
              isScrubbingRef.current = true;
              performScrub(e.clientX);
              e.stopPropagation();
            }
          }}
          onTouchStart={(e) => {
            if (
              !(e.target as HTMLElement).closest(".clip-block") &&
              !(e.target as HTMLElement).closest(".handle")
            ) {
              isScrubbingRef.current = true;
              performScrub(e.touches[0].clientX);
              e.stopPropagation();
            }
          }}
        >
          <div
            className="relative"
            style={{
              width: `${viewportDuration * pixelsPerSecond + 1000}px`,
              marginLeft: `${labelWidth}px`
            }}
          >
            <div className="h-6 md:h-7 border-b border-white/10 sticky top-0 bg-[#030712]/95 backdrop-blur-sm z-[110] flex items-end">
              {Array.from({ length: Math.ceil(viewportDuration / 5) + 1 }).map(
                (_, i) => (
                  <div
                    key={i}
                    className="absolute border-l border-white/10 h-2 md:h-3"
                    style={{ left: `${i * 5 * pixelsPerSecond}px` }}
                  >
                    <span className="text-[7px] md:text-[8px] font-black text-gray-600 ml-1.5 mb-1 block">
                      {i * 5}s
                    </span>
                  </div>
                )
              )}
            </div>
            <div className="flex-1 flex-col relative z-[95]">
              <div className="relative w-full h-8 md:h-10 border-b border-white/5 group/track">
                <div
                  className="absolute top-0 bottom-0 flex items-center justify-center bg-gray-950 border-r border-white/10 z-[120]"
                  style={{ left: `-${labelWidth}px`, width: `${labelWidth}px` }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddTextClip("New Caption");
                    }}
                    className="p-1 md:p-2 rounded-lg text-gray-600 hover:text-amber-500"
                  >
                    <DocumentTextIcon className="w-4 md:w-5 h-4 md:h-5" />
                  </button>
                </div>
                {(textClips || []).map((t) => (
                  <div
                    key={t.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedClip({ id: t.id, type: "text" });
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDragging({
                        id: t.id,
                        type: "text",
                        startX: e.clientX,
                        originalValue: t.startTime
                      });
                    }}
                    className={`clip-block absolute h-6 md:h-8 top-1 rounded-lg flex items-center px-2 cursor-grab transition-all border-2 ${selectedClip?.id === t.id ? "bg-amber-500 text-white border-white" : "bg-amber-950/40 border-amber-500/20 text-amber-400"}`}
                    style={{
                      left: `${t.startTime * pixelsPerSecond}px`,
                      width: `${t.duration * pixelsPerSecond}px`
                    }}
                  >
                    {" "}
                    <span className="text-[8px] md:text-[10px] font-black truncate uppercase">
                      {t.text}
                    </span>{" "}
                    <div
                      className="handle absolute top-0 right-0 bottom-0 w-4 cursor-ew-resize z-50 flex justify-end"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDragging({
                          id: t.id,
                          type: "trim",
                          startX: e.clientX,
                          originalValue: t.duration
                        });
                      }}
                    >
                      <div className="w-1 h-full bg-amber-400/30 rounded-r-lg" />
                    </div>{" "}
                  </div>
                ))}
              </div>
              {[1, 0].map((layer) => {
                // DO add comment: Identify the most recently added clip on this layer chronologically to restrict double-click logic.
                const layerClips = (clips || []).filter(c => Number(c.layer) === layer);
                const lastClipInLayer = layerClips.length > 0 ? layerClips.reduce((prev, current) => (prev.startTime > current.startTime) ? prev : current) : null;

                return (
                <div
                  key={layer}
                  className="relative w-full h-10 md:h-12 border-b border-white/5 group/track"
                >
                  <div
                    className="absolute top-0 bottom-0 flex items-center justify-center bg-gray-950 border-r border-white/10 z-[120]"
                    style={{
                      left: `-${labelWidth}px`,
                      width: `${labelWidth}px`
                    }}
                  >
                    <button
                      disabled={layer === 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (layer === 0) fileInputRef.current?.click();
                      }}
                      className={`p-1 md:p-2 rounded-lg ${layer === 1 ? "text-gray-800" : "text-indigo-400"}`}
                    >
                      {" "}
                      <div className="relative">
                        {" "}
                        <FilmIcon className="w-4 md:w-5 h-4 md:h-5" />{" "}
                        <span
                          className={`absolute -bottom-1 -right-1 text-[5px] md:text-[6px] font-black px-0.5 rounded-full border ${layer === 1 ? "bg-gray-700 text-gray-500 border-gray-600" : "bg-indigo-600 text-white border-white/20"}`}
                        >
                          {" "}
                          {layer === 1 ? "V2" : "V1"}{" "}
                        </span>{" "}
                      </div>{" "}
                    </button>
                  </div>
                  {layerClips.map((clip) => {
                      const isSelected = selectedClip?.id === clip.id;
                      const isFlashing = flashingClipId === clip.id;
                      // DO add comment: Logic to check if this clip has been double-clicked to show the side-panel.
                      const isSidePanelOpen = sidePanelClipId === clip.id;
                      // DO add comment: Check if this specific clip is the last one in the layer.
                      const isLastInLayer = lastClipInLayer?.id === clip.id;

                      return (
                        <div
                          key={clip.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClip({ id: clip.id, type: "visual" });
                            // DO add comment: Clicking the video causes the panel to disappear.
                            setSidePanelClipId(null);
                          }}
                          // DO add comment: Double-click behavior draws out the side-panel, but only for the very last clip added to the track.
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (isLastInLayer && clip.type === 'video') {
                                setSidePanelClipId(clip.id);
                            }
                          }}
                          onMouseDown={(e) => {
                            if (!(e.target as HTMLElement).closest(".handle")) {
                              e.stopPropagation();
                              setDragging({
                                id: clip.id,
                                type: "visual",
                                startX: e.clientX,
                                originalValue: clip.startTime
                              });
                            }
                          }}
                          className={`clip-block absolute h-8 md:h-10 top-1 transition-all ${isSelected ? "z-[105]" : "z-[90]"}`}
                          style={{
                            left: `${clip.startTime * pixelsPerSecond}px`,
                            width: `${clip.duration * pixelsPerSecond}px`
                          }}
                        >
                          {/* DO add comment: Compact side-panel. Small rectangle containing only the logo, with the last frame as visual background. */}
                          {isSidePanelOpen && (
                            <div 
                              className="absolute top-0 bottom-0 left-full ml-1.5 z-[200] bg-gray-950 border border-indigo-500 rounded-md w-12 flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.4)] animate-in slide-in-from-left-2 duration-200 overflow-hidden"
                              onClick={e => e.stopPropagation()}
                            >
                              {/* DO add comment: Dynamic background showing the last frame inside the compact rectangle. */}
                              <div className="absolute inset-0 z-0 bg-black">
                                {clip.type === 'video' ? (
                                    <video 
                                        src={formatAssetUrl(clip.url)} 
                                        className="w-full h-full object-cover opacity-60" 
                                        muted 
                                        onLoadedMetadata={(e) => {
                                            (e.target as HTMLVideoElement).currentTime = clip.duration - 0.1;
                                        }}
                                    />
                                ) : (
                                    <img src={formatAssetUrl(clip.url)} className="w-full h-full object-cover opacity-60" />
                                )}
                              </div>
                              {/* DO add comment: Small rectangular blue overlay containing ONLY the logo/icon. */}
                              <button 
                                onClick={() => handleCaptureLastFrameAction(clip)}
                                className="relative z-10 w-full h-full bg-blue-600/40 hover:bg-blue-500/60 text-white transition-all flex items-center justify-center group/btn"
                                title="Take Last Frame"
                              >
                                <CameraIcon className="w-5 h-5 drop-shadow-md transition-transform group-hover/btn:scale-110" />
                              </button>
                            </div>
                          )}

                          <div
                            className={`relative w-full h-full border-2 rounded-lg md:rounded-xl overflow-hidden bg-black transition-all ${isSelected ? "border-indigo-500 ring-2 ring-indigo-500/30" : "border-white/10 shadow-sm opacity-80"} ${isFlashing ? "bg-white" : ""}`}
                          >
                            {clip.type === "video" ? (
                              <video
                                src={formatAssetUrl(clip.url)}
                                className={`absolute inset-0 w-full h-full object-cover transition-opacity ${isFlashing ? "opacity-0" : "opacity-100"}`}
                                muted
                                onLoadedData={(e) =>
                                  ((e.target as HTMLVideoElement).currentTime =
                                    0.1)
                                }
                              />
                            ) : (
                              <img
                                src={formatAssetUrl(clip.url)}
                                className={`absolute inset-0 w-full h-full object-cover transition-opacity ${isFlashing ? "opacity-0" : "opacity-100"}`}
                              />
                            )}
                          </div>
                          {isSelected && canMoveLayer(clip) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateClip(clip.id, {
                                  layer: clip.layer === 0 ? 1 : 0
                                });
                              }}
                              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 md:w-8 h-6 md:h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center transition-all z-[150] shadow-lg border border-white/20 active:scale-95"
                            >
                              {" "}
                              {clip.layer === 0 ? (
                                <ArrowUpIcon className="w-3 md:w-5 h-3 md:h-5" />
                              ) : (
                                <ArrowDownIcon className="w-3 md:w-5 h-3 md:h-5" />
                              )}{" "}
                            </button>
                          )}
                          <div
                            className="handle absolute top-0 right-0 bottom-0 w-4 md:w-6 cursor-ew-resize z-50 flex justify-end"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setDragging({
                                id: clip.id,
                                type: "trim",
                                startX: e.clientX,
                                originalValue: clip.duration
                              });
                            }}
                          >
                            {" "}
                            <div className="w-1 md:w-2 h-full bg-white/30 rounded-r-lg" />{" "}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )})}
              <div className="relative w-full h-8 md:h-12 border-b border-white/5 group/track">
                <div
                  className="absolute top-0 bottom-0 flex flex-col items-center justify-center bg-gray-950 border-r border-white/10 z-[120]"
                  style={{ left: `-${labelWidth}px`, width: `${labelWidth}px` }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      audioInputRef.current?.click();
                    }}
                    className="p-1 md:p-2 rounded-lg text-gray-600 hover:text-emerald-500"
                  >
                    <MusicalNoteIcon className="w-4 md:w-5 h-4 md:h-5" />
                  </button>
                </div>
                {(audioClips || []).map((audio) => (
                  <div
                    key={audio.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedClip({ id: audio.id, type: "audio" });
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDragging({
                        id: audio.id,
                        type: "audio",
                        startX: e.clientX,
                        originalValue: audio.startTime
                      });
                    }}
                    className={`clip-block absolute h-6 md:h-8 top-1 rounded-lg border-2 cursor-grab transition-all flex items-center pl-1 md:pl-2 pr-4 md:pr-5 ${selectedClip?.id === audio.id ? "bg-emerald-600 border-white text-white" : "bg-emerald-950/40 border-emerald-500/20 text-emerald-400"}`}
                    style={{
                      width: `${audio.duration * pixelsPerSecond}px`,
                      left: `${audio.startTime * pixelsPerSecond}px`
                    }}
                  >
                    {" "}
                    <div
                      className={`p-0.5 rounded-full ${audio.isMuted ? "bg-red-600" : "bg-emerald-600"} opacity-80 mr-1`}
                    >
                      <SpeakerWaveIcon className="w-2.5 h-2.5 text-white" />
                    </div>{" "}
                    {/* DO add comment: Removed redundant 'Audio' text caption from audio clips to keep visual appearance clean as requested. */}
                    <div
                      className="handle absolute top-0 right-0 bottom-0 w-4 md:w-5 cursor-ew-resize z-50 flex justify-end"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDragging({
                          id: audio.id,
                          type: "trim",
                          startX: e.clientX,
                          originalValue: audio.duration
                        });
                      }}
                    >
                      <div className="w-1 h-full bg-emerald-400/30 rounded-r-lg" />
                    </div>{" "}
                  </div>
                ))}
              </div>
            </div>
            <div
              className="absolute top-0 bottom-0 w-[1px] md:w-[2px] bg-red-600 z-[120] pointer-events-none"
              style={{ left: `${localPlaybackTime * pixelsPerSecond}px` }}
            >
              {" "}
              <div className="absolute -top-[3px] md:-top-[4px] -left-[3.5px] md:-left-[5px] w-2 md:w-3 h-2 md:h-3 bg-red-600 rounded-full border md:border-2 border-white shadow-md"></div>{" "}
            </div>
          </div>
        </div>
      </div>
      <audio ref={audioMonitorRef} className="hidden" preload="auto" />
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="video/*,image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            onAddClip(
              URL.createObjectURL(file),
              file.type.startsWith("video/") ? "video" : "image",
              5,
              undefined,
              0
            );
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={audioInputRef}
        className="hidden"
        // Strict JS-level MIME-type check to block video files from the audio track.
        accept=".mp3,.wav,.ogg,.m4a,audio/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            // Reinforced validation: Only allow standard audio MIME types.
            if (!file.type.startsWith("audio/")) {
              console.warn(
                "Operation Blocked: Audio slots only accept audio files. Video detected."
              );
              e.target.value = "";
              return;
            }
            onAddAudioClip(file, 10, undefined);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
};
