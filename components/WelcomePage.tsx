import React, { useState, useRef, useEffect } from "react";
import {
  Logo,
  SparklesIcon,
  VideoIcon,
  UserPlusIcon,
  ChevronRightIcon,
  ClapperboardIcon
} from "./Icons";
import { Auth } from "./Auth";
import { HELLO_EMAIL } from "../utils/constants";

interface WelcomePageProps {
  onEnter: () => void;
  session?: any;
}

const REEL_VIDEOS = [
  "https://istoria-ai.github.io/my-production-reel/89dd41fd-9efb-4319-9e9d-993a908ccd6e.mp4",
  "https://istoria-ai.github.io/my-production-reel/939be0a3-8414-4a49-ac39-cc8e497fbf4b.mp4",
  "https://istoria-ai.github.io/my-production-reel/A spicy rooster strutting around the farmhouse like a macho ___.mp4",
  "https://istoria-ai.github.io/my-production-reel/generated-video-3-clip-4.mp4"
];

const HoverVideo: React.FC<{
  src: string;
  isActive: boolean;
  isMobile?: boolean;
  onActivate?: () => void;
  onDeactivate?: () => void;
  innerRef?: React.Ref<HTMLDivElement>;
}> = ({ src, isActive, isMobile, onActivate, onDeactivate, innerRef }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
      videoRef.current.play().catch(() => {});
      } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    }
  }, [isActive]);

  return (
    <div
      ref={innerRef}
      onMouseEnter={() => !isMobile && onActivate?.()}
      onMouseLeave={() => !isMobile && onDeactivate?.()}
      className={`bg-black/60 rounded-2xl border transition-all duration-700 overflow-hidden shadow-2xl relative group ${isActive ? "border-indigo-500 scale-[1.02] ring-4 ring-indigo-500/20 shadow-[0_0_30px_rgba(79,70,229,0.3)]" : "border-white/10 opacity-70"} ${isMobile ? "aspect-video w-full" : "aspect-video"}`}
    >
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        preload="auto"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 ring-1 ring-inset ring-white/5 rounded-2xl pointer-events-none"></div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>

      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center opacity-40 transition-opacity pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-black/40 border border-white/10 flex items-center justify-center">
            <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export const WelcomePage: React.FC<WelcomePageProps> = ({
  onEnter,
  session
}) => {
  const isMobile = window.innerWidth < 768;
  const [showAuthOverlay, setShowAuthOverlay] = useState(false);
  const [activeReelIdx, setActiveReelIdx] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLDivElement | null)[]>([]);
  const bgVideoRef = useRef<HTMLVideoElement>(null);

  // CLEAN MODE: If logged in, hide all overlay UI elements to allow pure background viewing.
  const isCleanBackgroundMode = !!session;

  const handleEnterClick = () => {
    if (!session) setShowAuthOverlay(true);
    else onEnter();
  };

  // Center-weighted scroll tracking for mobile
  useEffect(() => {
    if (!isMobile || showAuthOverlay || isCleanBackgroundMode) return;

    const handleScroll = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const viewportCenter = window.innerHeight / 2;
      let closestIdx = -1;
      let minDistance = Infinity;

      videoRefs.current.forEach((ref, idx) => {
        if (!ref) return;
        const rect = ref.getBoundingClientRect();
        const elementCenter = rect.top + rect.height / 2;
        const distance = Math.abs(viewportCenter - elementCenter);

        if (distance < minDistance) {
          minDistance = distance;
          closestIdx = idx;
        }
      });

      // Activation threshold: The element must be reasonably close to the center
      if (minDistance < window.innerHeight * 0.35) {
        setActiveReelIdx(closestIdx);
    } else {
        setActiveReelIdx(null);
    }
  };

    const scrollArea = scrollContainerRef.current;
    if (scrollArea) {
      scrollArea.addEventListener("scroll", handleScroll, { passive: true });
      // Initial check
      setTimeout(handleScroll, 100);
    }
    return () => scrollArea?.removeEventListener("scroll", handleScroll);
  }, [isMobile, showAuthOverlay, isCleanBackgroundMode]);

  return (
    <div
      ref={scrollContainerRef}
      className="w-full h-full flex flex-col bg-[#030712] overflow-y-auto scrollbar-none font-sans relative"
    >
      {/* Dynamic Background - Significant opacity reduction on mobile clean mode to ensure menu contrast */}
      <div
        className={`fixed inset-0 z-0 overflow-hidden pointer-events-none transition-all duration-1000 ${isCleanBackgroundMode && isMobile ? "opacity-40" : isCleanBackgroundMode ? "opacity-20" : showAuthOverlay ? "blur-sm scale-100 opacity-90" : "blur-0 opacity-20"}`}
      >
        <video
          ref={bgVideoRef}
          src={REEL_VIDEOS[0]}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className={`w-full h-full object-cover transition-all duration-1000 ${isCleanBackgroundMode && isMobile ? "brightness-50" : isCleanBackgroundMode ? "brightness-40" : showAuthOverlay ? "brightness-75" : "brightness-40"}`}
        />
      </div>

      {/* Conditional UI Rendering */}
      {!isCleanBackgroundMode && (
      <div
        className={`px-6 pt-2 md:pt-4 flex flex-col items-center text-center transition-all duration-700 relative z-10`}
      >
        <div className="w-12 h-12 md:w-20 md:h-20 bg-indigo-600/10 border border-indigo-500/20 rounded-full flex items-center justify-center p-2 md:p-4 mb-2 md:mb-6 shadow-[0_0_40px_rgba(79,70,229,0.25)] border-white/5 transition-all">
            <Logo className="w-full h-full text-white" />
          </div>
        <h1 className="text-3xl md:text-6xl lg:text-7xl font-black text-white italic tracking-tighter leading-none mb-0.5 transition-all">
          Thetori <span className="text-indigo-400">Ai</span>
          </h1>
        <p className="text-[7px] md:text-[11px] font-black text-gray-500 tracking-[0.5em] uppercase mb-4 md:mb-10 opacity-90 transition-all">
          Integrated Production Studio
        </p>

        <div
          className={`transition-all duration-500 w-full flex flex-col items-center ${showAuthOverlay ? "opacity-0 h-0 overflow-hidden pointer-events-none" : "opacity-100 h-auto"}`}
        >
            <button
              onClick={handleEnterClick}
            className="px-10 py-4 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-black tracking-[0.4em] rounded-[2rem] shadow-[0_20px_50px_rgba(79,70,229,0.4)] active:scale-95 transition-all text-[9px] md:text-xs uppercase flex items-center justify-center gap-4 border border-indigo-400/30 mb-12"
          >
            Enter Studio <ChevronRightIcon className="w-4 h-4" />
          </button>

          <div className="px-4 md:px-12 pb-32 space-y-10 relative z-10 max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-4 px-2">
              <span className="text-[9px] font-black text-gray-500 tracking-[0.5em] uppercase whitespace-nowrap">
                Screening Room
              </span>
              <div className="h-px bg-white/10 flex-1"></div>
      </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
              {REEL_VIDEOS.map((src, i) => (
                <div
                  key={i}
                  className="animate-in fade-in slide-in-from-bottom-8 duration-1000 relative"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  <div
                    className={`absolute -inset-4 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none transition-opacity duration-700 ${activeReelIdx === i ? "opacity-60" : "opacity-0"}`}
                  ></div>
                  <HoverVideo
                    innerRef={(el) => {
                      videoRefs.current[i] = el;
                    }}
                    src={src}
                    isActive={activeReelIdx === i}
                    isMobile={isMobile}
                    onActivate={() => !isMobile && setActiveReelIdx(i)}
                    onDeactivate={() =>
                      !isMobile && activeReelIdx === i && setActiveReelIdx(null)
                    }
                  />
                  <div className="mt-4 flex items-center justify-between px-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-2 h-2 rounded-full transition-all duration-500 ${activeReelIdx === i ? "bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,1)] scale-125" : "bg-gray-700"}`}
                      ></div>
                      <span
                        className={`text-[8px] font-black tracking-[0.25em] uppercase transition-colors duration-500 ${activeReelIdx === i ? "text-indigo-400" : "text-gray-500"}`}
                      >
                        Master {i + 1}
                      </span>
                    </div>
                    <ClapperboardIcon
                      className={`w-4 h-4 transition-colors duration-500 ${activeReelIdx === i ? "text-indigo-900" : "text-gray-800"}`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="py-20 text-center">
              <div className="inline-block w-12 h-1 bg-white/5 rounded-full mb-6"></div>
              <p className="text-[9px] font-black text-gray-700 tracking-[1em] uppercase opacity-50">
                Creative Intelligence • High Fidelity
            </p>
          </div>
        </div>
        </div>

      {showAuthOverlay && !session && (
          <div className="w-full max-w-[320px] animate-in fade-in zoom-in-95 duration-500 pb-10 mt-2">
            <Auth onBack={() => setShowAuthOverlay(false)} isOverlay={true} />
        </div>
      )}
      </div>
      )}
    </div>
  );
};
